import { NextRequest } from "next/server"
import { processarCobrancasDoDia } from "@/lib/cobranca-mensal"

export const dynamic = 'force-dynamic'
// Emissão da NFS-e + PDF + e-mail podem passar dos 10s padrão.
export const maxDuration = 60

/**
 * Chamada todo dia pela Vercel (vercel.json → crons). Emite as notas das cobranças mensais cujo dia
 * já chegou e que ainda não saíram neste mês. Rodar diariamente (e não só no dia marcado) faz a
 * nota sair no dia seguinte se a Vercel falhar justo no dia.
 *
 * As rotas /api ficam fora do login (middleware), então a proteção é o CRON_SECRET: quando ele está
 * cadastrado nas variáveis de ambiente da Vercel, ela manda "Authorization: Bearer <CRON_SECRET>"
 * e qualquer outra chamada é recusada. Sem ele, só passa quem se identifica como o agendador da
 * Vercel. Em qualquer caso não há risco de nota em dobro (cada competência sai uma vez só).
 */
export async function GET(request: NextRequest) {
  const segredo = process.env.CRON_SECRET
  if (segredo) {
    if (request.headers.get('authorization') !== `Bearer ${segredo}`) return new Response('Não autorizado.', { status: 401 })
  } else if (!(request.headers.get('user-agent') || '').startsWith('vercel-cron/')) {
    // Sem CRON_SECRET, aceita só o agendador da Vercel (que se identifica como "vercel-cron/1.0").
    // Não é à prova de quem forje o cabeçalho; por isso a tela de cobranças segue recomendando o segredo.
    return new Response('Não autorizado.', { status: 401 })
  }

  const resultados = await processarCobrancasDoDia()
  return Response.json({ executadoEm: new Date().toISOString(), resultados })
}
