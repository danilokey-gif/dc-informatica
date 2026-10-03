import { prisma } from "@/lib/prisma"
import { getCompanySettings } from "@/lib/settings"
import { gerarDanfePdf, logoDeDataUrl } from "@/lib/nfe/danfe"
import { gerarDanfsePdf } from "@/lib/nfse/danfse"
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

  // O período é sobre a data REAL de emissão da nota (dhEmi). Em notas antigas, importadas antes
  // desse campo existir, dataEmissao é nulo e aí caímos no createdAt.
  const periodo = {
    OR: [
      { dataEmissao: { gte: inicio, lt: fim } },
      { dataEmissao: null, createdAt: { gte: inicio, lt: fim } },
    ],
  }

  const [empresa, emissoesNfse, emissoesNfe] = await Promise.all([
    getCompanySettings(),
    prisma.nfseEmissao.findMany({
      where: { status: 'AUTORIZADA', ...periodo },
      include: { serviceOrder: { include: { customer: true } } },
      orderBy: [{ dataEmissao: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.nfeEmissao.findMany({
      where: { status: 'AUTORIZADA', ...periodo },
      include: { sale: { include: { customer: true } } },
      orderBy: [{ dataEmissao: 'asc' }, { createdAt: 'asc' }],
    }),
  ])

  if (emissoesNfse.length === 0 && emissoesNfe.length === 0) {
    return new Response('Nenhuma nota fiscal autorizada encontrada nesse período.', { status: 404 })
  }

  const zip = new JSZip()

  for (const e of emissoesNfse) {
    const dataStr = (e.dataEmissao ?? e.createdAt).toISOString().slice(0, 10)
    const clienteNomeBase = e.serviceOrder?.customer.name || e.tomadorNome || 'cliente'
    const clienteSlug = clienteNomeBase.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')
    const numeroNfse = e.xmlNfse?.match(/<nNFSe>(\d+)<\/nNFSe>/)?.[1] || String(e.numeroDps)
    const nomeBase = `${dataStr}_NFSe-${numeroNfse}_${clienteSlug}`

    if (!e.xmlNfse) continue
    zip.file(`NFSe/${nomeBase}.xml`, e.xmlNfse)
    // DANFSe v2.0 (NT 008/2026): sai do XML, então vale também para as notas importadas do governo,
    // que antes iam no .zip só como XML.
    zip.file(`NFSe/${nomeBase}.pdf`, await gerarDanfsePdf(e.xmlNfse))
  }

  const logo = logoDeDataUrl(empresa.logo)
  for (const e of emissoesNfe) {
    const dataStr = (e.dataEmissao ?? e.createdAt).toISOString().slice(0, 10)
    const clienteNome = e.sale?.customer?.name || e.destinatarioNome || 'Consumidor'
    const clienteSlug = clienteNome.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')
    const nomeBase = `${dataStr}_NFe-${e.numero}_${clienteSlug}`

    if (!e.xmlNfe) continue
    zip.file(`NFe/${nomeBase}.xml`, e.xmlNfe)
    // DANFE a partir do XML: vale também para as notas importadas (emissor do Sebrae), que antes
    // iam no .zip só como XML por não terem venda vinculada.
    zip.file(`NFe/${nomeBase}.pdf`, await gerarDanfePdf(e.xmlNfe, { xmlProtocolo: e.xmlProtocolo, logo }))
  }

  const zipBuffer = await zip.generateAsync({ type: 'uint8array' })
  const nomeArquivo = `notas-fiscais_${inicioStr}_a_${fimStr}.zip`

  return new Response(Buffer.from(zipBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${nomeArquivo}"`,
    },
  })
}
