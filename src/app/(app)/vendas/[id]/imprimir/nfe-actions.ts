'use server'

import { prisma } from "@/lib/prisma"
import { getCompanySettings, getNfeConfig } from "@/lib/settings"
import { decryptSecret } from "@/lib/crypto"
import { extractCertMaterial } from "@/lib/nfse/certificate"
import { NfeSoapClient } from "@/lib/nfe/soap-client"
import { montarXmlNfe, assinarNfe } from "@/lib/nfe/xml"
import { enviarEmail } from "@/lib/email"
import { revalidatePath } from "next/cache"

const TP_PAGAMENTO_POR_METODO: Record<string, 'dinheiro' | 'pix' | 'cartao_credito' | 'cartao_debito' | 'outro'> = {
  'Dinheiro': 'dinheiro',
  'PIX': 'pix',
  'Cartão de Crédito': 'cartao_credito',
  'Cartão de Débito': 'cartao_debito',
}

export async function emitirNfeVenda(saleId: string) {
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
    destinatario: venda.customer ? { documento: venda.customer.document || undefined, nome: venda.customer.name } : undefined,
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

  const client = new NfeSoapClient({ ambiente, pfxBuffer, certPassword: certSenha })

  try {
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
          data: { status: 'AUTORIZADA', xmlProtocolo: respostaXml }
        }),
        prisma.nfeConfig.update({
          where: { id: 'main' },
          data: { proximoNumero: { increment: 1 } }
        })
      ])
    } else {
      await prisma.nfeEmissao.update({
        where: { id: emissao.id },
        data: { status: 'REJEITADA', motivoErro: `[${cStatFinal}] ${xMotivoFinal}`, xmlProtocolo: respostaXml }
      })
    }
  } catch (error) {
    await prisma.nfeEmissao.update({
      where: { id: emissao.id },
      data: {
        status: 'REJEITADA',
        motivoErro: error instanceof Error ? error.message : 'Erro desconhecido ao emitir a NF-e.',
      }
    })
  }

  revalidatePath(`/vendas/${saleId}/imprimir`)
}

export async function enviarNfeEmail(saleId: string) {
  const [venda, empresa, emissao] = await Promise.all([
    prisma.sale.findUniqueOrThrow({ where: { id: saleId }, include: { customer: true } }),
    getCompanySettings(),
    prisma.nfeEmissao.findFirst({ where: { saleId, status: 'AUTORIZADA' }, orderBy: { createdAt: 'desc' } }),
  ])

  if (!venda.customer?.email) {
    throw new Error('Cliente não tem e-mail cadastrado. Edite o cliente para adicionar um.')
  }
  if (!emissao) {
    throw new Error('Nenhuma NF-e autorizada encontrada para esta venda.')
  }

  const valor = venda.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

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
  })

  revalidatePath(`/vendas/${saleId}/imprimir`)
}
