'use server'

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"
import { getCompanySettings, getNfeConfig } from "@/lib/settings"
import { decryptSecret } from "@/lib/crypto"
import { extractCertMaterial } from "@/lib/nfse/certificate"
import { NfeSoapClient } from "@/lib/nfe/soap-client"
import { montarXmlNfe, assinarNfe, cfopDevolucao } from "@/lib/nfe/xml"
import { lerNotaOriginal, quantidadesDevolvidas, notaEhDaEmpresa } from "@/lib/nfe/devolucao"
import { gerarDanfePdf, logoDeDataUrl } from "@/lib/nfe/danfe"
import { salvarNotaNoDrive } from "@/lib/drive"

export interface ResultadoDevolucao {
  ok: boolean
  mensagem: string
  emissaoId?: string
}

/** Busca o XML da nota original (compra recebida ou venda emitida) e se ela é uma nota de teste. */
async function xmlDaOrigem(tipo: 'compra' | 'venda', id: string): Promise<{ xml: string; deTeste: boolean }> {
  if (tipo === 'compra') {
    const nota = await prisma.nfeRecebida.findUnique({ where: { id } })
    if (!nota?.completa || !nota.xml) throw new Error('Esta nota de compra não tem o XML completo no sistema.')
    if (nota.situacao === '3') throw new Error('A nota de compra está cancelada.')
    return { xml: nota.xml, deTeste: false }
  }
  const nota = await prisma.nfeEmissao.findUnique({ where: { id } })
  if (!nota?.xmlNfe || nota.status !== 'AUTORIZADA') throw new Error('Esta venda não tem NF-e autorizada no sistema.')
  return { xml: nota.xmlNfe, deTeste: nota.ambiente !== 'producao' }
}

/**
 * Emite a NF-e de devolução (finNFe 4) referenciando a nota original.
 * itens: [{ nItem, quantidade }] escolhidos na tela. Em homologação usa a numeração de teste.
 */
export async function emitirDevolucao(entrada: {
  tipo: 'compra' | 'venda'
  origemId: string
  itens: { nItem: number; quantidade: number }[]
  motivo: string
  ajustarEstoque: boolean
  homologacao: boolean
}): Promise<ResultadoDevolucao> {
  const user = await getCurrentUser()
  if (user?.role !== 'ADMIN') return { ok: false, mensagem: 'Só o administrador pode emitir nota de devolução.' }

  let emissaoId: string | null = null
  try {
    const { tipo } = entrada
    const [empresa, cfg, origem] = await Promise.all([getCompanySettings(), getNfeConfig(), xmlDaOrigem(tipo, entrada.origemId)])
    const xmlOriginal = origem.xml
    // Nota de teste (homologação) só pode gerar devolução de teste: nunca uma nota real.
    if (origem.deTeste && !entrada.homologacao) throw new Error('Esta é uma nota de teste (homologação): a devolução dela só pode ser enviada como teste.')
    if (!cfg.certificado || !cfg.certificadoSenha) throw new Error('Certificado digital não configurado (Configurações > Nota Fiscal de Produtos).')
    if (!empresa.document || !empresa.inscricaoEstadual) throw new Error('CNPJ ou Inscrição Estadual da empresa não configurados.')
    if (!empresa.enderLogradouro || !empresa.enderNumero || !empresa.enderBairro || !empresa.enderCep || !cfg.codigoMunicipio || !cfg.nomeMunicipio) {
      throw new Error('Endereço da empresa incompleto (Configurações).')
    }
    const motivo = entrada.motivo.trim()
    if (motivo.length < 5) throw new Error('Escreva o motivo da devolução (ex.: produto com defeito).')

    const original = lerNotaOriginal(xmlOriginal, tipo)
    if (!entrada.homologacao && !notaEhDaEmpresa(original, tipo, empresa.document)) {
      throw new Error(tipo === 'compra'
        ? `Esta compra foi feita para o documento ${original.documentoDestinatario}, não para o CNPJ da empresa. A empresa não pode emitir a devolução dela; trate a troca direto com o fornecedor.`
        : 'Esta NF-e de venda não foi emitida pelo CNPJ da empresa.')
    }
    if (!original.parte.documento || !original.parte.endereco) {
      throw new Error(`A nota original não tem CPF/CNPJ ou endereço do ${tipo === 'compra' ? 'fornecedor' : 'cliente'}, que a devolução precisa.`)
    }

    // Não deixa devolver mais do que veio na nota (somando devoluções já autorizadas).
    const anteriores = await prisma.nfeEmissao.findMany({
      where: { chaveReferenciada: original.chave, status: 'AUTORIZADA', ambiente: entrada.homologacao ? 'homologacao' : 'producao' },
      select: { xmlNfe: true },
    })
    const jaDevolvido = quantidadesDevolvidas(anteriores.map(a => a.xmlNfe))
    const escolhidos = entrada.itens.filter(i => i.quantidade > 0).map(i => {
      const item = original.itens.find(o => o.nItem === i.nItem)
      if (!item) throw new Error(`Item ${i.nItem} não existe na nota original.`)
      const restante = item.quantidade - (jaDevolvido.get(item.codigo) ?? 0)
      if (i.quantidade > restante + 1e-9) throw new Error(`"${item.descricao}": só restam ${restante} para devolver.`)
      return { ...item, quantidade: i.quantidade }
    })
    if (escolhidos.length === 0) throw new Error('Escolha pelo menos um item e a quantidade a devolver.')

    const ambiente = entrada.homologacao ? 'homologacao' : 'producao'
    const numero = ambiente === 'producao' ? cfg.proximoNumero : cfg.proximoNumeroHomologacao
    const outroEstado = original.parte.endereco.uf !== cfg.uf
    const cfop = cfopDevolucao(tipo, outroEstado)
    const dataOriginal = original.dataEmissao ? new Date(original.dataEmissao).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : ''

    const pfx = Buffer.from(cfg.certificado, 'base64')
    const senha = decryptSecret(cfg.certificadoSenha)
    const cert = extractCertMaterial(pfx, senha)

    const { xml, chaveAcesso } = montarXmlNfe({
      ambiente,
      serie: cfg.serie,
      numero,
      emitente: {
        cnpj: empresa.document,
        razaoSocial: empresa.name,
        inscricaoEstadual: empresa.inscricaoEstadual,
        crt: cfg.crt,
        endereco: {
          logradouro: empresa.enderLogradouro, numero: empresa.enderNumero, bairro: empresa.enderBairro,
          codigoMunicipio: cfg.codigoMunicipio, nomeMunicipio: cfg.nomeMunicipio, uf: cfg.uf, cep: empresa.enderCep,
        },
      },
      destinatario: original.parte,
      itens: escolhidos.map(i => ({
        codigo: i.codigo, gtin: i.gtin, descricao: i.descricao, ncm: i.ncm, cfop,
        unidade: i.unidade, quantidade: i.quantidade, valorUnitario: i.valorUnitario,
      })),
      formaPagamento: 'outro',
      devolucao: {
        tipo,
        chaveReferenciada: original.chave,
        observacao: `DEVOLUCAO ${tipo === 'compra' ? 'DE COMPRA' : 'DE VENDA'} REF. NF-E ${original.numero}${dataOriginal ? ` DE ${dataOriginal}` : ''}, CHAVE ${original.chave}. MOTIVO: ${motivo}.`,
      },
    })
    const xmlAssinado = assinarNfe(xml, `NFe${chaveAcesso}`, cert)
    const valorTotal = Math.round(escolhidos.reduce((s, i) => s + i.quantidade * i.valorUnitario, 0) * 100) / 100

    const emissao = await prisma.nfeEmissao.create({
      data: {
        ambiente, numero, serie: cfg.serie, status: 'PROCESSANDO', chaveAcesso, xmlNfe: xmlAssinado,
        finalidade: tipo === 'compra' ? 'DEVOLUCAO_COMPRA' : 'DEVOLUCAO_VENDA',
        chaveReferenciada: original.chave,
        destinatarioNome: original.parte.nome,
        destinatarioDocumento: original.parte.documento,
        valorTotal,
      },
    })
    emissaoId = emissao.id

    const client = new NfeSoapClient({ ambiente, pfxBuffer: pfx, certPassword: senha })
    const resposta = await client.autorizarNfe(String(Date.now()).slice(-15), xmlAssinado)
    const cStats = resposta.match(/<cStat>(\d+)<\/cStat>/g) ?? []
    const cStat = cStats.length ? cStats[cStats.length - 1].replace(/<\/?cStat>/g, '') : null
    const motivos = resposta.match(/<xMotivo>([^<]*)<\/xMotivo>/g) ?? []
    const xMotivo = motivos.length ? motivos[motivos.length - 1].replace(/<\/?xMotivo>/g, '') : 'Sem retorno da Sefaz'

    if (cStat !== '100') {
      await prisma.nfeEmissao.update({ where: { id: emissao.id }, data: { status: 'REJEITADA', motivoErro: `[${cStat}] ${xMotivo}`, xmlProtocolo: resposta } })
      revalidatePath('/notas-fiscais/devolucao')
      return { ok: false, mensagem: `A Sefaz recusou: [${cStat}] ${xMotivo}`, emissaoId: emissao.id }
    }

    await prisma.$transaction([
      prisma.nfeEmissao.update({
        where: { id: emissao.id },
        data: { status: 'AUTORIZADA', xmlProtocolo: resposta, dataEmissao: new Date(xmlAssinado.match(/<dhEmi>([^<]+)<\/dhEmi>/)![1]) },
      }),
      prisma.nfeConfig.update({
        where: { id: 'main' },
        data: ambiente === 'producao' ? { proximoNumero: { increment: 1 } } : { proximoNumeroHomologacao: { increment: 1 } },
      }),
    ])

    // Estoque: devolução de compra tira da loja; devolução de venda volta para a loja. Só em produção.
    let avisoEstoque = ''
    if (entrada.ajustarEstoque && ambiente === 'producao') {
      const naoAchados: string[] = []
      for (const item of escolhidos) {
        const produto = await prisma.product.findFirst({
          where: { OR: [{ sku: item.codigo }, { name: item.descricao }, ...(item.gtin ? [{ gtin: item.gtin }] : []), ...(item.codigo.length === 8 ? [{ id: { endsWith: item.codigo } }] : [])] },
        })
        if (!produto) { naoAchados.push(item.descricao); continue }
        await prisma.product.update({
          where: { id: produto.id },
          data: { stockQty: tipo === 'compra' ? { decrement: item.quantidade } : { increment: item.quantidade } },
        })
      }
      if (naoAchados.length) avisoEstoque = ` Não achei no cadastro para ajustar o estoque: ${naoAchados.join(', ')}.`
    }

    try {
      const pdf = await gerarDanfePdf(xmlAssinado, { xmlProtocolo: resposta, logo: logoDeDataUrl(empresa.logo) })
      await salvarNotaNoDrive('NFe', chaveAcesso, xmlAssinado, pdf)
    } catch (e) {
      console.error('[Drive] Erro ao salvar a nota de devolução:', e)
    }

    revalidatePath('/notas-fiscais')
    revalidatePath('/notas-fiscais/devolucao')
    revalidatePath('/produtos')
    return {
      ok: true,
      emissaoId: emissao.id,
      mensagem: `Nota de devolução nº ${numero} autorizada${ambiente === 'homologacao' ? ' na HOMOLOGAÇÃO (teste, sem valor fiscal)' : ''}.${avisoEstoque}`,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (emissaoId) await prisma.nfeEmissao.update({ where: { id: emissaoId }, data: { status: 'REJEITADA', motivoErro: msg } })
    return { ok: false, mensagem: msg }
  }
}
