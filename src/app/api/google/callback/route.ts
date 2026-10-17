import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"
import { decryptSecret, encryptSecret } from "@/lib/crypto"
import { pastaRaiz, urlRedirecionamento } from "@/lib/google-drive-usuario"

export const dynamic = 'force-dynamic'

/** Volta da autorização do Google: troca o código pelo refresh token e guarda criptografado. */
export async function GET(request: NextRequest) {
  const voltar = (situacao: string) => {
    const r = NextResponse.redirect(new URL(`/configuracoes?drive=${situacao}#google-drive`, request.url))
    r.cookies.delete({ name: 'google_oauth_estado', path: '/api/google' })
    return r
  }

  const usuario = await getCurrentUser()
  if (!usuario || usuario.role !== 'ADMIN') return NextResponse.redirect(new URL('/login', request.url))

  const params = request.nextUrl.searchParams
  if (params.get('error')) return voltar('negado')
  const estado = request.cookies.get('google_oauth_estado')?.value
  if (!estado || estado !== params.get('state') || !params.get('code')) return voltar('invalido')

  const s = await prisma.companySettings.findUnique({ where: { id: 'main' }, select: { gdriveClientId: true, gdriveClientSecret: true } })
  if (!s?.gdriveClientId || !s.gdriveClientSecret) return voltar('sem-credenciais')

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: params.get('code')!,
      client_id: s.gdriveClientId,
      client_secret: decryptSecret(s.gdriveClientSecret),
      redirect_uri: urlRedirecionamento(request.nextUrl.origin),
      grant_type: 'authorization_code',
    }),
  })
  const d = await r.json()
  if (!r.ok || !d.refresh_token) {
    console.error('[Google OAuth] troca do código falhou:', d.error, d.error_description)
    return voltar('falhou')
  }

  // E-mail da conta conectada (vem no id_token, que acabou de chegar direto do Google).
  let conta: string | null = null
  try { conta = JSON.parse(Buffer.from(String(d.id_token).split('.')[1], 'base64url').toString()).email ?? null } catch { /* sem e-mail */ }

  await prisma.companySettings.update({
    where: { id: 'main' },
    data: { gdriveRefreshToken: encryptSecret(d.refresh_token), gdriveConta: conta, gdrivePastaRaizId: null },
  })
  try { await pastaRaiz(d.access_token) } catch (e) { console.error('[Google Drive] não criou a pasta raiz:', e) }
  return voltar('conectado')
}
