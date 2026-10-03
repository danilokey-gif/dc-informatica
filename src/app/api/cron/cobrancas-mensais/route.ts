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
 * e qualquer outra chamada é recusada. Sem ele a rota continua segura contra nota em dobro (cada
 * competência só é emitida uma vez), mas qualquer pessoa poderia antecipar o horário da emissão.
 */
export async function GET(request: NextRequest) {
  const segredo = process.env.CRON_SECRET
  if (segredo && request.headers.get('authorization') !== `Bearer ${segredo}`) {
    return new Response('Não autorizado.', { status: 401 })
  }

  const resultados = await processarCobrancasDoDia()
  return Response.json({ executadoEm: new Date().toISOString(), resultados })
}
