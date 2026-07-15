import { cookies } from 'next/headers'
import { verifySession } from './session'
import { prisma } from './prisma'

/**
 * Busca o usuário logado a partir do cookie de sessão, com dados atualizados do banco
 * (então mudanças de nome/role feitas por um admin refletem na hora, sem precisar
 * relogar — só a checagem de rota no middleware é que usa o role gravado no cookie
 * e por isso só atualiza depois de um novo login).
 */
export async function getCurrentUser() {
  const cookieStore = await cookies()
  const session = await verifySession(cookieStore.get('auth_token')?.value)
  if (!session) return null

  return prisma.user.findUnique({ where: { id: session.userId } })
}
