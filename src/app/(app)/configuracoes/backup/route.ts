import { getCurrentUser } from "@/lib/auth"
import { gerarBackup } from "@/lib/backup"

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Baixa o backup do banco de dados direto para o computador (só administrador). */
export async function GET() {
  const usuario = await getCurrentUser()
  if (usuario?.role !== 'ADMIN') return new Response('Só o administrador pode baixar o backup.', { status: 403 })

  const backup = await gerarBackup()
  return new Response(new Uint8Array(backup.conteudo), {
    headers: {
      'Content-Type': 'application/gzip',
      'Content-Disposition': `attachment; filename="${backup.nome}"`,
      'Content-Length': String(backup.conteudo.length),
      'Cache-Control': 'no-store',
    },
  })
}
