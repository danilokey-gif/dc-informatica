import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifySession } from '@/lib/session'

const PUBLIC_PATHS = ['/manifest.json', '/sw.js']

// Rotas com dados sensíveis (financeiro, fiscal, configurações da empresa, gestão de usuários):
// visíveis só para ADMIN. Um técnico logado não deve ver nem acessar diretamente por URL.
const ADMIN_ONLY_PREFIXES = ['/financeiro', '/fornecedores', '/relatorios', '/configuracoes', '/usuarios', '/notas-fiscais']

export async function middleware(request: NextRequest) {
  if (PUBLIC_PATHS.includes(request.nextUrl.pathname) || request.nextUrl.pathname.startsWith('/icons/')) {
    return NextResponse.next()
  }

  const authCookie = request.cookies.get('auth_token')
  const session = await verifySession(authCookie?.value)

  if (!session && !request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (session && request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  if (session && session.role !== 'ADMIN' && ADMIN_ONLY_PREFIXES.some(prefix => request.nextUrl.pathname.startsWith(prefix))) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
