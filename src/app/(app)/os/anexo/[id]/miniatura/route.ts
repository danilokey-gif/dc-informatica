import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { dadosDoArquivo, tokenDoUsuario } from "@/lib/google-drive-usuario"

export const dynamic = 'force-dynamic'

/** Miniatura da foto/vídeo anexado à OS (o arquivo inteiro fica no Google Drive). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const anexo = await prisma.osAnexo.findUnique({ where: { id: (await params).id } })
  if (!anexo) return new Response(null, { status: 404 })
  try {
    const token = await tokenDoUsuario()
    const arq = await dadosDoArquivo(token, anexo.driveFileId)
    if (!arq.thumbnailLink) return new Response(null, { status: 404 })
    const r = await fetch(arq.thumbnailLink.replace(/=s\d+$/, '=s480'), { headers: { Authorization: `Bearer ${token}` } })
    if (!r.ok) return new Response(null, { status: 404 })
    return new Response(await r.arrayBuffer(), {
      headers: { 'Content-Type': r.headers.get('content-type') || 'image/jpeg', 'Cache-Control': 'private, max-age=86400' },
    })
  } catch {
    return new Response(null, { status: 404 })
  }
}
