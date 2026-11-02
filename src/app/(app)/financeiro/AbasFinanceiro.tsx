'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

const ABAS = [
  { href: '/financeiro', rotulo: 'Visão geral', ativa: (p: string) => p === '/financeiro' },
  { href: '/financeiro/contas', rotulo: 'Lançamentos', ativa: (p: string, q: URLSearchParams) => p.startsWith('/financeiro/contas') && !q.get('aberto') },
  { href: '/financeiro/contas?aberto=RECEITA', rotulo: 'A receber', ativa: (p: string, q: URLSearchParams) => p === '/financeiro/contas' && q.get('aberto') === 'RECEITA' },
  { href: '/financeiro/contas?aberto=DESPESA', rotulo: 'A pagar', ativa: (p: string, q: URLSearchParams) => p === '/financeiro/contas' && q.get('aberto') === 'DESPESA' },
  { href: '/financeiro/investimentos', rotulo: 'Investimentos e sócio', ativa: (p: string) => p.startsWith('/financeiro/investimentos') },
  { href: '/financeiro/cobrancas-mensais', rotulo: 'Cobranças mensais', ativa: (p: string) => p.startsWith('/financeiro/cobrancas-mensais') },
  { href: '/financeiro/importar', rotulo: 'Importar extrato', ativa: (p: string) => p.startsWith('/financeiro/importar') },
  { href: '/financeiro/categorias', rotulo: 'Categorias', ativa: (p: string) => p.startsWith('/financeiro/categorias') },
]

/** Abas do Financeiro, iguais em todas as telas da seção. */
export default function AbasFinanceiro() {
  const pathname = usePathname()
  const q = useSearchParams()
  return (
    <nav className="abas-notas no-print" aria-label="Financeiro">
      {ABAS.map(a => (
        <Link key={a.href} href={a.href} className={`aba-nota${a.ativa(pathname, q) ? ' ativa' : ''}`}>{a.rotulo}</Link>
      ))}
    </nav>
  )
}
