import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tipo = searchParams.get('tipo')
  const id = searchParams.get('id')

  if (!id || (tipo !== 'nfse' && tipo !== 'nfe')) {
    return new Response('Parâmetros inválidos.', { status: 400 })
  }

  if (tipo === 'nfse') {
    const emissao = await prisma.nfseEmissao.findUnique({ where: { id } })
    if (!emissao?.xmlNfse) return new Response('XML não encontrado.', { status: 404 })
    return new Response(emissao.xmlNfse, {
      headers: {
        'Content-Type': 'application/xml',
        'Content-Disposition': `attachment; filename="NFSe-${emissao.chaveAcesso || emissao.id}.xml"`,
      },
    })
  }

  const emissao = await prisma.nfeEmissao.findUnique({ where: { id } })
  if (!emissao?.xmlNfe) return new Response('XML não encontrado.', { status: 404 })
  return new Response(emissao.xmlNfe, {
    headers: {
      'Content-Type': 'application/xml',
      'Content-Disposition': `attachment; filename="NFe-${emissao.chaveAcesso || emissao.id}.xml"`,
    },
  })
}
