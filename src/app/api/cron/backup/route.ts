import { NextRequest } from "next/server"
import { fazerBackupNoDrive } from "@/lib/backup"

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Chamada toda madrugada pela Vercel (vercel.json → crons): salva o backup do banco de dados no
 * Google Drive. Mesma proteção da rota de cobranças: CRON_SECRET quando cadastrado; sem ele, só o
 * agendador da Vercel. Uma chamada indevida só geraria um backup a mais (não devolve dado nenhum).
 */
export async function GET(request: NextRequest) {
  const segredo = process.env.CRON_SECRET
  if (segredo) {
    if (request.headers.get('authorization') !== `Bearer ${segredo}`) return new Response('Não autorizado.', { status: 401 })
  } else if (!(request.headers.get('user-agent') || '').startsWith('vercel-cron/')) {
    return new Response('Não autorizado.', { status: 401 })
  }

  const r = await fazerBackupNoDrive('automático')
  return Response.json({ executadoEm: new Date().toISOString(), ok: r.ok }, { status: r.ok ? 200 : 500 })
}
