import { prisma } from "@/lib/prisma"
import { getCompanySettings, getNfseConfig } from "@/lib/settings"
import { gerarPdfDanfse, gerarPdfDanfe } from "@/lib/pdf-notas"
import JSZip from "jszip"
import { NextRequest } from "next/server"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const inicioStr = searchParams.get('inicio')
  const fimStr = searchParams.get('fim')

  if (!inicioStr || !fimStr) {
    return new Response('Informe o período (início e fim).', { status: 400 })
  }

  const inicio = new Date(`${inicioStr}T00:00:00.000Z`)
  // Inclui o dia inteiro do "fim": vai até o início do dia seguinte.
  const fim = new Date(new Date(`${fimStr}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000)

  const [empresa, nfseConfig, emissoesNfse, emissoesNfe] = await Promise.all([
    getCompanySettings(),
    getNfseConfig(),
    prisma.nfseEmissao.findMany({
      where: { status: 'AUTORIZADA', createdAt: { gte: inicio, lt: fim } },
      include: { serviceOrder: { include: { customer: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.nfeEmissao.findMany({
      where: { status: 'AUTORIZADA', createdAt: { gte: inicio, lt: fim } },
      include: { sale: { include: { customer: true, items: { include: { product: true } } } } },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  if (emissoesNfse.length === 0 && emissoesNfe.length === 0) {
    return new Response('Nenhuma nota fiscal autorizada encontrada nesse período.', { status: 404 })
  }

  const zip = new JSZip()

  for (const e of emissoesNfse) {
    const dataStr = e.createdAt.toISOString().slice(0, 10)
    const clienteSlug = e.serviceOrder.customer.name.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')
    const nomeBase = `${dataStr}_NFSe-${e.numeroDps}_${clienteSlug}`

    if (e.xmlNfse) zip.file(`NFSe/${nomeBase}.xml`, e.xmlNfse)

    const os = e.serviceOrder
    const numeroNfse = e.xmlNfse?.match(/<nNFSe>(\d+)<\/nNFSe>/)?.[1] || e.numeroDps
    const municipioLabel = nfseConfig.nomeMunicipio ? `${nfseConfig.nomeMunicipio} - SP` : '-'
    const enderecoPrestador = `${empresa.enderLogradouro || ''}${empresa.enderNumero ? `, ${empresa.enderNumero}` : ''}${empresa.enderBairro ? `, ${empresa.enderBairro}` : ''}`
    const pdf = await gerarPdfDanfse({
      ambiente: e.ambiente,
      numeroNfse,
      numeroDps: e.numeroDps,
      serieDps: e.serieDps,
      chaveAcesso: e.chaveAcesso || '',
      dataEmissao: e.createdAt,
      prestadorNome: empresa.name,
      prestadorCnpj: empresa.document || '',
      prestadorTelefone: empresa.phone,
      prestadorEmail: empresa.email,
      prestadorEndereco: enderecoPrestador,
      prestadorCep: empresa.enderCep,
      tomadorNome: os.customer.name,
      tomadorDocumento: os.customer.document,
      tomadorTelefone: os.customer.phone,
      tomadorEmail: os.customer.email,
      tomadorEndereco: os.customer.address,
      descricaoServico: `${os.device} — ${os.issue}`,
      codigoServico: nfseConfig.codigoServico,
      descricaoCodServico: nfseConfig.descricaoCodServico,
      municipioLabel,
      regimeTributario: nfseConfig.regimeTributario,
      aliquotaIss: nfseConfig.aliquotaIss,
      valorTotal: (os.price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
    })
    zip.file(`NFSe/${nomeBase}.pdf`, pdf)
  }

  for (const e of emissoesNfe) {
    const dataStr = e.createdAt.toISOString().slice(0, 10)
    const clienteNome = e.sale.customer?.name || 'Consumidor'
    const clienteSlug = clienteNome.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')
    const nomeBase = `${dataStr}_NFe-${e.numero}_${clienteSlug}`

    if (e.xmlNfe) zip.file(`NFe/${nomeBase}.xml`, e.xmlNfe)

    const pdf = await gerarPdfDanfe({
      ambiente: e.ambiente,
      numero: e.numero,
      serie: e.serie,
      chaveAcesso: e.chaveAcesso || '',
      emitenteNome: empresa.name,
      emitenteCnpj: empresa.document || '',
      emitenteIe: empresa.inscricaoEstadual,
      destinatarioNome: clienteNome,
      destinatarioDocumento: e.sale.customer?.document,
      itens: e.sale.items.map(item => ({
        codigo: item.product.sku || item.productId.slice(-8),
        descricao: item.product.name,
        ncm: item.product.ncm || '-',
        cfop: item.product.cfop || '-',
        quantidade: item.quantity,
        valorUnitario: item.unitPrice,
        valorTotal: item.unitPrice * item.quantity,
      })),
      valorTotal: e.sale.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
    })
    zip.file(`NFe/${nomeBase}.pdf`, pdf)
  }

  const zipBuffer = await zip.generateAsync({ type: 'uint8array' })
  const arrayBuffer = zipBuffer.buffer.slice(zipBuffer.byteOffset, zipBuffer.byteOffset + zipBuffer.byteLength) as ArrayBuffer
  const nomeArquivo = `notas-fiscais_${inicioStr}_a_${fimStr}.zip`

  return new Response(arrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${nomeArquivo}"`,
    },
  })
}
