import { prisma } from "@/lib/prisma"
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

  const [emissoesNfse, emissoesNfe] = await Promise.all([
    prisma.nfseEmissao.findMany({
      where: { status: 'AUTORIZADA', createdAt: { gte: inicio, lt: fim } },
      include: { serviceOrder: { include: { customer: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.nfeEmissao.findMany({
      where: { status: 'AUTORIZADA', createdAt: { gte: inicio, lt: fim } },
      include: { sale: { include: { customer: true } } },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  if (emissoesNfse.length === 0 && emissoesNfe.length === 0) {
    return new Response('Nenhuma nota fiscal autorizada encontrada nesse período.', { status: 404 })
  }

  const zip = new JSZip()

  for (const e of emissoesNfse) {
    if (!e.xmlNfse) continue
    const dataStr = e.createdAt.toISOString().slice(0, 10)
    const clienteSlug = e.serviceOrder.customer.name.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')
    zip.file(`NFSe/${dataStr}_NFSe-${e.numeroDps}_${clienteSlug}.xml`, e.xmlNfse)
  }

  for (const e of emissoesNfe) {
    if (!e.xmlNfe) continue
    const dataStr = e.createdAt.toISOString().slice(0, 10)
    const clienteNome = e.sale.customer?.name || 'Consumidor'
    const clienteSlug = clienteNome.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')
    zip.file(`NFe/${dataStr}_NFe-${e.numero}_${clienteSlug}.xml`, e.xmlNfe)
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
