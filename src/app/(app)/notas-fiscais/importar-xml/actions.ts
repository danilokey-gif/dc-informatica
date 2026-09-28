'use server'

import { prisma } from "@/lib/prisma"
import { getCompanySettings } from "@/lib/settings"
import { extrairDadosNfeCompleta, TP_EVENTO_CANCELAMENTO } from "@/lib/nfe/distribuicao"
import { formatarErro } from "@/lib/formatar-erro"
import { revalidatePath } from "next/cache"
import JSZip from "jszip"

// Teto por envio, só pra uma pasta errada (milhares de arquivos) não travar a função.
const MAX_XMLS_POR_ENVIO = 500

export interface ResultadoArquivo {
  arquivo: string
  status: 'importada' | 'atualizada' | 'ja-existia' | 'erro'
  detalhe: string
}

export interface ResultadoImportacao {
  resultados: ResultadoArquivo[]
  erro?: string
}

function tag(xml: string, nome: string): string | null {
  return xml.match(new RegExp(`<${nome}(?:\\s[^>]*)?>([^<]*)</${nome}>`))?.[1] ?? null
}

function formatarDocumento(doc: string | null): string {
  if (!doc) return 'não informado'
  if (doc.length === 14) return doc.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  if (doc.length === 11) return doc.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  return doc
}

const BRL = (v: number | null) => v == null ? '' : ` — ${v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`

/** Evento de cancelamento exportado pelo emissor (procEventoNFe): marca a nota como cancelada. */
async function importarEvento(arquivo: string, xml: string): Promise<ResultadoArquivo> {
  const tpEvento = tag(xml, 'tpEvento')
  const chave = tag(xml, 'chNFe')
  if (tpEvento !== TP_EVENTO_CANCELAMENTO || !chave) {
    return { arquivo, status: 'erro', detalhe: `Evento que não é de cancelamento (tipo ${tpEvento || 'desconhecido'}); nada a importar.` }
  }
  // 135 = evento registrado; 155 = cancelamento homologado fora de prazo. Sem isso o evento não valeu.
  const retorno = xml.match(/<retEvento[\s\S]*?<\/retEvento>/)?.[0] || ''
  const cStat = tag(retorno, 'cStat')
  if (cStat !== '135' && cStat !== '155') {
    return { arquivo, status: 'erro', detalhe: `Cancelamento sem registro da Sefaz (cStat ${cStat || 'ausente'}); a nota continua valendo.` }
  }

  const emitida = await prisma.nfeEmissao.findUnique({ where: { chaveAcesso: chave } })
  if (emitida) {
    if (emitida.status === 'CANCELADA') return { arquivo, status: 'ja-existia', detalhe: `NF-e nº ${emitida.numero} já estava como cancelada.` }
    await prisma.nfeEmissao.update({ where: { id: emitida.id }, data: { status: 'CANCELADA' } })
    return { arquivo, status: 'atualizada', detalhe: `NF-e nº ${emitida.numero} marcada como cancelada.` }
  }
  const recebida = await prisma.nfeRecebida.findUnique({ where: { chaveAcesso: chave } })
  if (recebida) {
    if (recebida.situacao === '3') return { arquivo, status: 'ja-existia', detalhe: `Nota de fornecedor nº ${recebida.numero ?? '-'} já estava como cancelada.` }
    await prisma.nfeRecebida.update({ where: { id: recebida.id }, data: { situacao: '3' } })
    return { arquivo, status: 'atualizada', detalhe: `Nota de fornecedor nº ${recebida.numero ?? '-'} marcada como cancelada.` }
  }
  return { arquivo, status: 'erro', detalhe: 'A nota deste cancelamento ainda não está no sistema. Importe primeiro o XML da nota e depois o do cancelamento.' }
}

async function importarUmXml(arquivo: string, xml: string, cnpjEmpresa: string): Promise<ResultadoArquivo> {
  if (/<procEventoNFe[\s>]/.test(xml) || (/<evento[\s>]/.test(xml) && /<tpEvento>/.test(xml))) {
    return importarEvento(arquivo, xml)
  }
  if (/<resNFe[\s>]/.test(xml)) {
    return { arquivo, status: 'erro', detalhe: 'Este arquivo é só o resumo da nota, sem itens. Importe o XML completo.' }
  }
  if (/<(CompNfse|NFSe|infNFSe)[\s>]/.test(xml)) {
    return { arquivo, status: 'erro', detalhe: 'Este XML é de NFS-e (nota de serviço). As NFS-e vêm pelo botão "Buscar notas de NFS-e no governo".' }
  }

  const d = extrairDadosNfeCompleta(xml)
  if (!d) return { arquivo, status: 'erro', detalhe: 'Não reconheci este arquivo como uma NF-e.' }
  if (d.chaveAcesso.slice(20, 22) === '65') {
    return { arquivo, status: 'erro', detalhe: 'Este XML é de NFC-e (cupom, modelo 65). Aqui entram só NF-e modelo 55.' }
  }

  // Sem o protNFe o arquivo é só a nota assinada, antes da Sefaz autorizar — não tem valor fiscal.
  const protNFe = xml.match(/<protNFe[\s\S]*?<\/protNFe>/)?.[0]
  if (!protNFe) {
    return { arquivo, status: 'erro', detalhe: 'XML sem o protocolo de autorização da Sefaz. Exporte o XML da nota autorizada (o que traz o protocolo), não o XML só assinado.' }
  }
  const cStatProt = tag(protNFe, 'cStat')
  if (cStatProt !== '100' && cStatProt !== '150') {
    return { arquivo, status: 'erro', detalhe: `A Sefaz não autorizou esta nota (cStat ${cStatProt}: ${tag(protNFe, 'xMotivo') || 'sem motivo'}).` }
  }
  if (d.ambiente === '2') {
    return { arquivo, status: 'erro', detalhe: 'Nota de homologação (teste, sem valor fiscal); não entra no sistema.' }
  }

  const numero = d.numero ?? (parseInt(d.chaveAcesso.slice(25, 34), 10) || 0)
  const serie = d.serie ?? String(parseInt(d.chaveAcesso.slice(22, 25), 10))

  // Nota emitida pela empresa (venda feita em outro emissor): entra junto com as notas emitidas.
  if (d.emitenteCnpj === cnpjEmpresa) {
    const existente = await prisma.nfeEmissao.findUnique({ where: { chaveAcesso: d.chaveAcesso } })
    if (existente) return { arquivo, status: 'ja-existia', detalhe: `NF-e de venda nº ${numero} já estava no sistema.` }
    await prisma.nfeEmissao.create({
      data: {
        ambiente: 'producao',
        numero,
        serie,
        status: 'AUTORIZADA',
        chaveAcesso: d.chaveAcesso,
        xmlNfe: xml,
        xmlProtocolo: protNFe,
        origem: 'IMPORTADA_XML',
        destinatarioNome: d.destinatarioNome,
        destinatarioDocumento: d.destinatarioDocumento,
        valorTotal: d.valorTotal,
        dataEmissao: d.dataEmissao,
      },
    })
    return { arquivo, status: 'importada', detalhe: `NF-e de venda nº ${numero} — ${d.destinatarioNome || 'consumidor'}${BRL(d.valorTotal)}.` }
  }

  // Nota de fornecedor contra o CNPJ da empresa: entra nas notas recebidas.
  if (d.destinatarioDocumento === cnpjEmpresa) {
    const existente = await prisma.nfeRecebida.findUnique({ where: { chaveAcesso: d.chaveAcesso } })
    if (existente?.completa) return { arquivo, status: 'ja-existia', detalhe: `Nota de fornecedor nº ${numero} já estava no sistema.` }
    const dados = {
      emitenteCnpj: d.emitenteCnpj,
      emitenteNome: d.emitenteNome,
      emitenteIe: d.emitenteIe,
      numero,
      serie,
      valorTotal: d.valorTotal,
      dataEmissao: d.dataEmissao,
      situacao: d.situacao,
      completa: true,
      xml,
    }
    if (existente) {
      await prisma.nfeRecebida.update({ where: { id: existente.id }, data: dados })
      return { arquivo, status: 'atualizada', detalhe: `Nota de fornecedor nº ${numero} (${d.emitenteNome || 'fornecedor'}): o resumo foi trocado pelo XML completo.` }
    }
    await prisma.nfeRecebida.create({ data: { chaveAcesso: d.chaveAcesso, origem: 'IMPORTADA_XML', ...dados } })
    return { arquivo, status: 'importada', detalhe: `Nota de fornecedor nº ${numero} — ${d.emitenteNome || 'fornecedor'}${BRL(d.valorTotal)}.` }
  }

  return {
    arquivo, status: 'erro',
    detalhe: `Esta nota não é da empresa: emitente ${formatarDocumento(d.emitenteCnpj)}, destinatário ${formatarDocumento(d.destinatarioDocumento)}.`,
  }
}

export async function importarXmls(formData: FormData): Promise<ResultadoImportacao> {
  try {
    const arquivos = formData.getAll('arquivos').filter((f): f is File => f instanceof File && f.size > 0)
    if (arquivos.length === 0) return { resultados: [], erro: 'Selecione ao menos um arquivo .xml ou .zip.' }

    const empresa = await getCompanySettings()
    const cnpjEmpresa = (empresa.document || '').replace(/\D/g, '')
    if (!cnpjEmpresa) return { resultados: [], erro: 'CNPJ da empresa não configurado. Vá em Configurações.' }

    const resultados: ResultadoArquivo[] = []
    const xmls: { nome: string; conteudo: string }[] = []

    for (const arquivo of arquivos) {
      if (/\.zip$/i.test(arquivo.name)) {
        const zip = await JSZip.loadAsync(await arquivo.arrayBuffer())
        const entradas = Object.values(zip.files).filter(e => !e.dir && /\.xml$/i.test(e.name))
        if (entradas.length === 0) resultados.push({ arquivo: arquivo.name, status: 'erro', detalhe: 'O .zip não tem nenhum arquivo .xml.' })
        for (const entrada of entradas) xmls.push({ nome: `${arquivo.name} › ${entrada.name}`, conteudo: await entrada.async('string') })
      } else if (/\.xml$/i.test(arquivo.name)) {
        xmls.push({ nome: arquivo.name, conteudo: await arquivo.text() })
      } else {
        resultados.push({ arquivo: arquivo.name, status: 'erro', detalhe: 'Não é .xml nem .zip.' })
      }
    }

    if (xmls.length > MAX_XMLS_POR_ENVIO) {
      return { resultados, erro: `São ${xmls.length} XMLs; envie no máximo ${MAX_XMLS_POR_ENVIO} por vez.` }
    }

    for (const { nome, conteudo } of xmls) {
      try {
        resultados.push(await importarUmXml(nome, conteudo, cnpjEmpresa))
      } catch (error) {
        // Um arquivo problemático não derruba o lote inteiro.
        resultados.push({ arquivo: nome, status: 'erro', detalhe: formatarErro(error) })
      }
    }

    revalidatePath('/notas-fiscais')
    revalidatePath('/notas-fiscais/fornecedores')
    revalidatePath('/relatorios')
    return { resultados }
  } catch (error) {
    return { resultados: [], erro: formatarErro(error) }
  }
}
