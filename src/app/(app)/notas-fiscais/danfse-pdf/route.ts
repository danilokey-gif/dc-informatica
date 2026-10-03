import { prisma } from "@/lib/prisma"
import { gerarDanfsePdf } from "@/lib/nfse/danfse"
import { NextRequest } from "next/server"

export const dynamic = 'force-dynamic'

/** PDF do DANFSe v2.0 (NT 008/2026), montado a partir do XML da NFS-e. ?download=1 baixa o arquivo. */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return new Response('Informe a nota.', { status: 400 })

  const emissao = await prisma.nfseEmissao.findUnique({
    where: { id },
    select: { xmlNfse: true, status: true, chaveAcesso: true, numeroDps: true },
  })
  if (!emissao?.xmlNfse) return new Response('Esta nota não tem XML para gerar o DANFSe.', { status: 404 })

  const pdf = await gerarDanfsePdf(emissao.xmlNfse, { cancelada: emissao.status === 'CANCELADA' })
  const numero = emissao.xmlNfse.match(/<nNFSe>(\d+)<\/nNFSe>/)?.[1] || String(emissao.numeroDps)
  const disposicao = searchParams.get('download') ? 'attachment' : 'inline'
  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${disposicao}; filename="DANFSe-${numero}.pdf"`,
    },
  })
}
