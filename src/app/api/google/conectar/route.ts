import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"
import { ESCOPO_DRIVE, urlRedirecionamento } from "@/lib/google-drive-usuario"

export const dynamic = 'force-dynamic'

/** Leva o usuário à tela de autorização do Google (rotas /api não passam pelo middleware de login). */
export async function GET(request: NextRequest) {
  const usuario = await getCurrentUser()
  if (!usuario || usuario.role !== 'ADMIN') return NextResponse.redirect(new URL('/login', request.url))

  const s = await prisma.companySettings.findUnique({ where: { id: 'main' }, select: { gdriveClientId: true, gdriveClientSecret: true } })
  if (!s?.gdriveClientId || !s.gdriveClientSecret) {
    return NextResponse.redirect(new URL('/configuracoes?drive=sem-credenciais#google-drive', request.url))
  }

  const estado = crypto.randomBytes(24).toString('hex')
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.search = new URLSearchParams({
    client_id: s.gdriveClientId,
    redirect_uri: urlRedirecionamento(request.nextUrl.origin),
    response_type: 'code',
    scope: `${ESCOPO_DRIVE} openid email`,
    access_type: 'offline',
    // Sempre pedir consentimento: garante que o Google devolva o refresh token.
    prompt: 'consent',
    state: estado,
  }).toString()

  const resposta = NextResponse.redirect(url)
  resposta.cookies.set('google_oauth_estado', estado, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/api/google' })
  return resposta
}
