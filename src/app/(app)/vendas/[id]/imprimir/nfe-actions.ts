'use server'

import { prisma } from "@/lib/prisma"
import { getCompanySettings, getNfeConfig } from "@/lib/settings"
import { decryptSecret } from "@/lib/crypto"
import { extractCertMaterial } from "@/lib/nfse/certificate"
import { NfeSoapClient } from "@/lib/nfe/soap-client"
import { montarXmlNfe, assinarNfe, montarEventoCancelamento, assinarEventoNfe } from "@/lib/nfe/xml"
import { enviarEmail } from "@/lib/email"
import { revalidatePath } from "next/cache"
import { gerarPdfDanfe } from "@/lib/pdf-notas"
import { salvarNotaNoDrive, moverNotaNoGoogleDriveCancelada } from "@/lib/drive"
import { formatarErro } from "@/lib/formatar-erro"

const TP_PAGAMENTO_POR_METODO: Record<string, 'dinheiro' | 'pix' | 'cartao_credito' | 'cartao_debito' | 'outro'> = {
  'Dinheiro': 'dinheiro',
  'PIX': 'pix',
  'Cartão de Crédito': 'cartao_credito',
  'Cartão de Débito': 'cartao_debito',
}

export async function emitirNfeVenda(saleId: string) {
  let emissaoId: string | null = null
  try {
    const [venda, empresa, nfeConfig] = await Promise.all([
      prisma.sale.findUniqueOrThrow({ where: { id: saleId }, include: { customer: true, items: { include: { product: true } } } }),
      getCompanySettings(),
      getNfeConfig(),
    ])

    if (!nfeConfig.certificado || !nfeConfig.certificadoSenha) {
      throw new Error('Certificado digital não configurado. Vá em Configurações > Nota Fiscal de Produtos.')
    }
    if (!empresa.document) {
      throw new Error('CNPJ da empresa não configurado. Vá em Configurações > Dados da Empresa.')
    }
    if (!empresa.inscricaoEstadual) {
      throw new Error('Inscrição Estadual não configurada. Vá em Configurações > Dados da Empresa.')
    }
    if (!empresa.enderLogradouro || !empresa.enderNumero || !empresa.enderBairro || !empresa.enderCep) {
      throw new Error('Endereço da empresa incompleto (logradouro/número/bairro/CEP). Vá em Configurações > Dados da Empresa.')
    }
    if (!nfeConfig.codigoMunicipio || !nfeConfig.nomeMunicipio) {
      throw new Error('Município da empresa não configurado. Vá em Configurações > Nota Fiscal de Produtos.')
    }

    const itensSemNcm = venda.items.filter(item => !item.product.ncm)
    if (itensSemNcm.length > 0) {
      throw new Error(`Produto(s) sem NCM cadastrado: ${itensSemNcm.map(i => i.product.name).join(', ')}. Edite o produto em Produtos.`)
    }

    const cliente = venda.customer
    if (!cliente || !cliente.document) {
      throw new Error('A NF-e (Modelo 55) exige a identificação do destinatário. Vincule um cliente com CPF ou CNPJ preenchido a esta venda.')
    }
    if (!cliente.enderLogradouro || !cliente.enderNumero || !cliente.enderBairro || !cliente.enderCep || !cliente.enderMunicipio || !cliente.enderUf || !cliente.enderCodMunicipio) {
      throw new Error(`Endereço do cliente "${cliente.name}" incompleto (a NF-e exige endereço estruturado). Edite o cliente em Clientes.`)
    }

    const pfxBuffer = Buffer.from(nfeConfig.certificado, 'base64')
    const certSenha = decryptSecret(nfeConfig.certificadoSenha)
    const certMaterial = extractCertMaterial(pfxBuffer, certSenha)

    const numero = nfeConfig.proximoNumero
    const ambiente = nfeConfig.ambiente === 'producao' ? 'producao' : 'homologacao'

    const { xml, chaveAcesso } = montarXmlNfe({
      ambiente,
      serie: nfeConfig.serie,
      numero,
      emitente: {
        cnpj: empresa.document,
        razaoSocial: empresa.name,
        inscricaoEstadual: empresa.inscricaoEstadual,
        crt: nfeConfig.crt,
        endereco: {
          logradouro: empresa.enderLogradouro,
          numero: empresa.enderNumero,
          bairro: empresa.enderBairro,
          codigoMunicipio: nfeConfig.codigoMunicipio,
          nomeMunicipio: nfeConfig.nomeMunicipio,
          uf: nfeConfig.uf,
          cep: empresa.enderCep,
        },
      },
      destinatario: venda.customer ? {
        documento: venda.customer.document || undefined,
        nome: venda.customer.name,
        endereco: venda.customer.document && venda.customer.enderLogradouro ? {
          logradouro: venda.customer.enderLogradouro,
          numero: venda.customer.enderNumero!,
          bairro: venda.customer.enderBairro!,
          codigoMunicipio: venda.customer.enderCodMunicipio!,
          nomeMunicipio: venda.customer.enderMunicipio!,
          uf: venda.customer.enderUf!,
          cep: venda.customer.enderCep!,
        } : undefined,
      } : undefined,
      itens: venda.items.map(item => ({
        codigo: item.product.sku || item.productId.slice(-8),
        descricao: item.product.name,
        ncm: item.product.ncm!,
        cfop: item.product.cfop || nfeConfig.cfopPadrao,
        unidade: 'UN',
        quantidade: item.quantity,
        valorUnitario: item.unitPrice,
      })),
      formaPagamento: TP_PAGAMENTO_POR_METODO[venda.paymentMethod] || 'outro',
    })

    const id = `NFe${chaveAcesso}`
    const xmlAssinado = assinarNfe(xml, id, certMaterial)

    const emissao = await prisma.nfeEmissao.create({
      data: {
        saleId,
        ambiente,
        numero,
        serie: nfeConfig.serie,
        status: 'PROCESSANDO',
        chaveAcesso,
        xmlNfe: xmlAssinado,
      }
    })
    emissaoId = emissao.id

    const client = new NfeSoapClient({ ambiente, pfxBuffer, certPassword: certSenha })
    const idLote = String(Date.now()).slice(-15)
    const respostaXml = await client.autorizarNfe(idLote, xmlAssinado)

    const cStatMatch = respostaXml.match(/<cStat>(\d+)<\/cStat>/g)
    const cStatFinal = cStatMatch ? cStatMatch[cStatMatch.length - 1].replace(/<\/?cStat>/g, '') : null
    const xMotivoMatch = respostaXml.match(/<xMotivo>([^<]*)<\/xMotivo>/g)
    const xMotivoFinal = xMotivoMatch ? xMotivoMatch[xMotivoMatch.length - 1].replace(/<\/?xMotivo>/g, '') : 'Sem retorno da Sefaz'

    if (cStatFinal === '100') {
      await prisma.$transaction([
        prisma.nfeEmissao.update({
          where: { id: emissao.id },
          data: {
            status: 'AUTORIZADA',
            xmlProtocolo: respostaXml,
            // Mesma razao do NFS-e: relatorios e filtros por periodo leem dataEmissao.
            dataEmissao: xmlAssinado.match(/<dhEmi>([^<]+)<\/dhEmi>/)?.[1]
              ? new Date(xmlAssinado.match(/<dhEmi>([^<]+)<\/dhEmi>/)![1])
              : new Date(),
          }
        }),
        prisma.nfeConfig.update({
          where: { id: 'main' },
          data: { proximoNumero: { increment: 1 } }
        })
      ])

      try {
        const valor = venda.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        const pdfBuffer = await gerarPdfDanfe({
          ambiente,
          numero,
          serie: nfeConfig.serie,
          chaveAcesso,
          emitenteNome: empresa.name,
          emitenteCnpj: empresa.document || '',
          emitenteIe: empresa.inscricaoEstadual,
          emitenteLogo: empresa.logo,
          emitenteEndereco: `${empresa.enderLogradouro || ''}${empresa.enderNumero ? `, ${empresa.enderNumero}` : ''}${empresa.enderBairro ? `, ${empresa.enderBairro}` : ''}`,
          emitenteMunicipio: nfeConfig.nomeMunicipio,
          emitenteUf: nfeConfig.uf,
          destinatarioNome: venda.customer?.name || 'Consumidor',
          destinatarioDocumento: venda.customer?.document,
          destinatarioEndereco: venda.customer ? `${venda.customer.enderLogradouro || ''}${venda.customer.enderNumero ? `, ${venda.customer.enderNumero}` : ''}` : '-',
          destinatarioBairro: venda.customer?.enderBairro || '-',
          destinatarioCep: venda.customer?.enderCep || '-',
          destinatarioMunicipio: venda.customer?.enderMunicipio || '-',
          destinatarioUf: venda.customer?.enderUf || '-',
          destinatarioTelefone: venda.customer?.phone || '-',
          itens: venda.items.map(item => ({
            codigo: item.product.sku || item.productId.slice(-8),
            descricao: item.product.name,
            ncm: item.product.ncm || '-',
            cfop: item.product.cfop || '-',
            quantidade: item.quantity,
            valorUnitario: item.unitPrice,
            valorTotal: item.unitPrice * item.quantity,
          })),
          valorTotal: valor,
          protocolo: respostaXml.match(/<nProt>(\d+)<\/nProt>/)?.[1] || null,
          dataEmissao: new Date(),
        })
        
        await salvarNotaNoDrive('NFe', chaveAcesso, xmlAssinado, pdfBuffer)
      } catch (err) {
        console.error('[Drive] Erro ao gerar/salvar PDF da NFe no drive local:', err)
      }
    } else {
      await prisma.nfeEmissao.update({
        where: { id: emissao.id },
        data: { status: 'REJEITADA', motivoErro: `[${cStatFinal}] ${xMotivoFinal}`, xmlProtocolo: respostaXml }
      })
    }
  } catch (error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    if (emissaoId) {
      await prisma.nfeEmissao.update({
        where: { id: emissaoId },
        data: { status: 'REJEITADA', motivoErro: errorMsg }
      })
    } else {
      await prisma.nfeEmissao.create({
        data: {
          saleId,
          ambiente: 'homologacao',
          numero: 0,
          serie: '0',
          status: 'REJEITADA',
          motivoErro: errorMsg,
        }
      })
    }
  }

  revalidatePath(`/vendas/${saleId}/imprimir`)
}

export async function enviarNfeEmail(saleId: string) {
  const [venda, empresa, nfeConfig, emissao] = await Promise.all([
    prisma.sale.findUniqueOrThrow({
      where: { id: saleId },
      include: { customer: true, items: { include: { product: true } } }
    }),
    getCompanySettings(),
    getNfeConfig(),
    prisma.nfeEmissao.findFirst({ where: { saleId, status: 'AUTORIZADA' }, orderBy: { createdAt: 'desc' } }),
  ])

  if (!venda.customer?.email) {
    throw new Error('Cliente não tem e-mail cadastrado. Edite o cliente para adicionar um.')
  }
  if (!emissao) {
    throw new Error('Nenhuma NF-e autorizada encontrada para esta venda.')
  }

  const valor = venda.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const pdfBuffer = await gerarPdfDanfe({
    ambiente: emissao.ambiente,
    numero: emissao.numero,
    serie: emissao.serie,
    chaveAcesso: emissao.chaveAcesso || '',
    emitenteNome: empresa.name,
    emitenteCnpj: empresa.document || '',
    emitenteIe: empresa.inscricaoEstadual,
    emitenteLogo: empresa.logo,
    emitenteEndereco: `${empresa.enderLogradouro || ''}${empresa.enderNumero ? `, ${empresa.enderNumero}` : ''}${empresa.enderBairro ? `, ${empresa.enderBairro}` : ''}`,
    emitenteMunicipio: nfeConfig.nomeMunicipio,
    emitenteUf: nfeConfig.uf,
    destinatarioNome: venda.customer?.name || 'Consumidor',
    destinatarioDocumento: venda.customer?.document,
    destinatarioEndereco: venda.customer ? `${venda.customer.enderLogradouro || ''}${venda.customer.enderNumero ? `, ${venda.customer.enderNumero}` : ''}` : '-',
    destinatarioBairro: venda.customer?.enderBairro || '-',
    destinatarioCep: venda.customer?.enderCep || '-',
    destinatarioMunicipio: venda.customer?.enderMunicipio || '-',
    destinatarioUf: venda.customer?.enderUf || '-',
    destinatarioTelefone: venda.customer?.phone || '-',
    itens: venda.items.map(item => ({
      codigo: item.product.sku || item.productId.slice(-8),
      descricao: item.product.name,
      ncm: item.product.ncm || '-',
      cfop: item.product.cfop || '-',
      quantidade: item.quantity,
      valorUnitario: item.unitPrice,
      valorTotal: item.unitPrice * item.quantity,
    })),
    valorTotal: valor,
    protocolo: emissao.xmlProtocolo?.match(/<nProt>(\d+)<\/nProt>/)?.[1] || null,
    dataEmissao: emissao.dataEmissao ?? emissao.createdAt,
  })

  await enviarEmail({
    to: venda.customer.email,
    subject: `Nota Fiscal de Produtos - ${empresa.name}`,
    html: `
      <p>Olá, ${venda.customer.name}!</p>
      <p>Segue a Nota Fiscal referente à sua compra.</p>
      <p><strong>Chave de acesso:</strong> ${emissao.chaveAcesso}</p>
      <p><strong>Valor:</strong> ${valor}</p>
      <p><strong>Ambiente:</strong> ${emissao.ambiente === 'producao' ? 'Produção' : 'Homologação (sem valor fiscal)'}</p>
      <p>Qualquer dúvida, entre em contato conosco.</p>
      <p>${empresa.name}${empresa.phone ? ` - ${empresa.phone}` : ''}</p>
    `,
    logoDataUrl: empresa.logo,
    arquivos: [
      ...(emissao.xmlNfe ? [{
        filename: `NFe-${emissao.chaveAcesso}.xml`,
        content: emissao.xmlNfe,
        contentType: 'application/xml',
      }] : []),
      {
        filename: `DANFE-${emissao.chaveAcesso}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      }
    ],
  })

  revalidatePath(`/vendas/${saleId}/imprimir`)
}

export interface ResultadoCancelamentoNfe {
  ok: boolean
  mensagem?: string
  erro?: string
}

function tagEm(xml: string, nome: string): string | null {
  return xml.match(new RegExp(`<${nome}>([^<]*)</${nome}>`))?.[1] ?? null
}

/**
 * Cancela a NF-e na Sefaz (evento 110111). Só depois que a Sefaz registra o evento a nota passa a
 * CANCELADA aqui — o botão antigo só trocava o status no banco e a nota continuava válida.
 * Devolve o erro em vez de lançar: em produção o Next esconde a mensagem de erros lançados.
 */
export async function cancelarNfe(emissaoId: string, justificativa: string): Promise<ResultadoCancelamentoNfe> {
  try {
    const [emissao, empresa, nfeConfig] = await Promise.all([
      prisma.nfeEmissao.findUnique({ where: { id: emissaoId } }),
      getCompanySettings(),
      getNfeConfig(),
    ])
    if (!emissao) return { ok: false, erro: 'Nota não encontrada.' }
    if (emissao.status !== 'AUTORIZADA') return { ok: false, erro: `Só notas autorizadas podem ser canceladas (esta está ${emissao.status}).` }
    if (!emissao.chaveAcesso) return { ok: false, erro: 'A nota não tem chave de acesso.' }

    const cnpjEmpresa = (empresa.document || '').replace(/\D/g, '')
    if (emissao.chaveAcesso.slice(6, 20) !== cnpjEmpresa) {
      return { ok: false, erro: 'Só a empresa que emitiu a nota pode cancelá-la.' }
    }
    const protocolo = emissao.xmlProtocolo?.match(/<nProt>(\d+)<\/nProt>/)?.[1]
    if (!protocolo) return { ok: false, erro: 'Não encontrei o protocolo de autorização desta nota; sem ele a Sefaz não aceita o cancelamento.' }

    const just = justificativa.trim()
    if (just.length < 15 || just.length > 255) return { ok: false, erro: 'A justificativa precisa ter entre 15 e 255 caracteres.' }

    if (!nfeConfig.certificado || !nfeConfig.certificadoSenha) {
      return { ok: false, erro: 'Certificado digital da NF-e não configurado.' }
    }
    const pfxBuffer = Buffer.from(nfeConfig.certificado, 'base64')
    const certSenha = decryptSecret(nfeConfig.certificadoSenha)

    // O cancelamento vai para o mesmo ambiente em que a nota foi autorizada.
    const ambiente = emissao.ambiente === 'producao' ? 'producao' : 'homologacao'
    const { xml, id } = montarEventoCancelamento({
      cnpjEmitente: cnpjEmpresa,
      chaveAcesso: emissao.chaveAcesso,
      tpAmb: ambiente === 'producao' ? '1' : '2',
      protocolo,
      justificativa: just,
    })
    const eventoAssinado = assinarEventoNfe(xml, id, extractCertMaterial(pfxBuffer, certSenha))

    const client = new NfeSoapClient({ ambiente, pfxBuffer, certPassword: certSenha })
    const resposta = await client.enviarEventoSefaz(String(Date.now()).slice(-15), eventoAssinado)

    const retEvento = resposta.match(/<retEvento[\s\S]*?<\/retEvento>/)?.[0]
    if (!retEvento) {
      return { ok: false, erro: `A Sefaz recusou o pedido [${tagEm(resposta, 'cStat')}] ${tagEm(resposta, 'xMotivo') || 'sem motivo informado'}.` }
    }
    const cStat = tagEm(retEvento, 'cStat')
    const xMotivo = tagEm(retEvento, 'xMotivo') || 'sem motivo informado'

    // 135 = cancelamento registrado; 155 = registrado fora do prazo (aceito pela Sefaz).
    // 573 (evento já registrado) e 218 (nota já cancelada na Sefaz) também significam que ela já está
    // cancelada lá — o sistema só se alinha. Qualquer outro código: a nota continua válida.
    if (cStat === '135' || cStat === '155') {
      await prisma.nfeEmissao.update({
        where: { id: emissao.id },
        data: {
          status: 'CANCELADA',
          motivoCancelamento: just,
          xmlEventoCancelamento: `<procEventoNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">${eventoAssinado}${retEvento}</procEventoNFe>`,
        },
      })
    } else if (cStat === '573' || cStat === '218') {
      await prisma.nfeEmissao.update({ where: { id: emissao.id }, data: { status: 'CANCELADA', motivoCancelamento: just } })
    } else {
      return { ok: false, erro: `A Sefaz não cancelou a nota [${cStat}] ${xMotivo}. Ela continua válida.` }
    }

    try {
      await moverNotaNoGoogleDriveCancelada('NFe', emissao.chaveAcesso)
    } catch (gdriveError) {
      // O cancelamento já valeu na Sefaz; falha no Drive não desfaz nada.
      console.error('[Google Drive] Falha ao mover NF-e cancelada:', gdriveError)
    }

    if (emissao.saleId) revalidatePath(`/vendas/${emissao.saleId}/imprimir`)
    revalidatePath('/notas-fiscais')
    revalidatePath('/relatorios')
    return { ok: true, mensagem: `NF-e nº ${emissao.numero} cancelada na Sefaz [${cStat}] ${xMotivo}.` }
  } catch (error) {
    return { ok: false, erro: formatarErro(error) }
  }
}
