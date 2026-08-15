import { prisma } from "@/lib/prisma"
import JSZip from "jszip"
import { NextRequest } from "next/server"

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { tipo?: string; chaves?: string[] } | null
  const tipo = body?.tipo
  const chaves = body?.chaves

  if ((tipo !== 'nfse' && tipo !== 'nfe') || !chaves?.length) {
    return new Response('Parâmetros inválidos.', { status: 400 })
  }

  const zip = new JSZip()

  if (tipo === 'nfse') {
    const emissoes = await prisma.nfseEmissao.findMany({ where: { chaveAcesso: { in: chaves } } })
    for (const e of emissoes) {
      if (!e.xmlNfse) continue
      const dataStr = e.createdAt.toISOString().slice(0, 10)
      zip.file(`NFSe-${dataStr}-${e.chaveAcesso}.xml`, e.xmlNfse)
    }
  } else {
    const emissoes = await prisma.nfeEmissao.findMany({ where: { chaveAcesso: { in: chaves } } })
    for (const e of emissoes) {
      if (!e.xmlNfe) continue
      const dataStr = e.createdAt.toISOString().slice(0, 10)
      zip.file(`NFe-${dataStr}-${e.chaveAcesso}.xml`, e.xmlNfe)
    }
  }

  const zipBuffer = await zip.generateAsync({ type: 'uint8array' })
  const nomeArquivo = `notas-${tipo}-importadas-governo.zip`

  return new Response(Buffer.from(zipBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${nomeArquivo}"`,
    },
  })
}
