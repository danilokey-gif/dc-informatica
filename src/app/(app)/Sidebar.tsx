'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"

const navItems = [
  { href: '/', label: 'Dashboard', icon: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M3 10.5 10 4l7 6.5M5 9v7h10V9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) },
  { href: '/clientes', label: 'Clientes', icon: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="10" cy="6.5" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.5 17c0-3.038 2.91-5.5 6.5-5.5s6.5 2.462 6.5 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ) },
  { href: '/produtos', label: 'Produtos', icon: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M3 6.5 10 3l7 3.5-7 3.5-7-3.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M3 6.5V14l7 3.5 7-3.5V6.5M10 10v7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) },
  { href: '/vendas', label: 'Vendas', icon: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M3 4h1.6l1.1 8.6a1.6 1.6 0 0 0 1.6 1.4h6.8a1.6 1.6 0 0 0 1.58-1.35L17 6.5H5.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="8" cy="17" r="1.1" fill="currentColor" />
      <circle cx="14.5" cy="17" r="1.1" fill="currentColor" />
    </svg>
  ) },
  { href: '/os', label: 'Ordens de Serviço', icon: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M12.4 3.6a2.3 2.3 0 0 1 3.25 3.25l-.7.7-3.25-3.25.7-.7Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M10.6 5.4 4 12v3.25h3.25L14 8.65" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ) },
  { href: '/fornecedores', label: 'Fornecedores', icon: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M3 16V8l7-4 7 4v8" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M7.5 16v-4.5h5V16" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ) },
  { href: '/financeiro', label: 'Financeiro', icon: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="10" cy="10" r="6.75" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10 6v8M12.25 8.1c0-.94-1.007-1.7-2.25-1.7s-2.25.76-2.25 1.7S8.757 9.8 10 9.8s2.25.76 2.25 1.7-1.007 1.7-2.25 1.7-2.25-.76-2.25-1.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ) },
  { href: '/relatorios', label: 'Relatórios', icon: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M4 16.5V11m5 5.5V6.5m5 10V9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 16.5h13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ) },
  { href: '/configuracoes', label: 'Configurações', icon: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="10" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10 3.5v1.4M10 15.1v1.4M16.5 10h-1.4M4.9 10H3.5M14.6 5.4l-1 1M6.4 13.6l-1 1M14.6 14.6l-1-1M6.4 6.4l-1-1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ) },
]

export default function Sidebar({ companyName, logo }: { companyName: string; logo: string | null }) {
  const pathname = usePathname()

  return (
    <aside className="sidebar no-print">
      <div className="sidebar-brand">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt={companyName} className="sidebar-logo" />
        ) : (
          <div className="sidebar-logo-fallback">{companyName.slice(0, 2).toUpperCase()}</div>
        )}
        <span className="sidebar-brand-name">{companyName}</span>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(item => {
          const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href} className={`sidebar-link${isActive ? ' active' : ''}`}>
              <Icon className="sidebar-icon" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
