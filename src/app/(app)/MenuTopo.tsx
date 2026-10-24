'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { sections, topItems, itemAtivo, type NavItem } from "./Sidebar"
import type { Layout } from "@/lib/aparencia"

/** Botão de ação rápida mostrado na segunda faixa (modelo "duas faixas"), conforme o grupo. */
const ACAO_DO_GRUPO: Record<string, { href: string; label: string }> = {
  'Início': { href: '/os/novo', label: 'Nova OS' },
  'Atendimento': { href: '/os/novo', label: 'Nova OS' },
  'Notas Fiscais': { href: '/notas-fiscais/emitir', label: 'Emitir nota' },
  'Cadastros': { href: '/clientes/novo', label: 'Novo cliente' },
  'Gestão': { href: '/financeiro/contas/novo', label: 'Novo lançamento' },
}

/** Telas que ficam direto na barra no modelo "ícones"; o resto vai para "Mais". */
const PRINCIPAIS = ['/', '/os', '/vendas', '/notas-fiscais/emitir', '/clientes', '/produtos', '/financeiro']

function Marca({ companyName, logo }: { companyName: string; logo: string | null }) {
  return (
    <Link href="/" className="topnav-marca">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt={companyName} className="sidebar-logo" style={{ width: 32, height: 32 }} />
      ) : (
        <div className="sidebar-logo-fallback" style={{ width: 32, height: 32 }}>{companyName.slice(0, 2).toUpperCase()}</div>
      )}
      <span className="topnav-marca-nome">{companyName}</span>
    </Link>
  )
}

function ItemLink({ item, ativo, comIcone = true, classe = 'topnav-item' }: { item: NavItem; ativo: boolean; comIcone?: boolean; classe?: string }) {
  const Icon = item.icon
  return (
    <Link href={item.href} className={`${classe}${ativo ? ' active' : ''}`}>
      {comIcone && <Icon className="topnav-icone" />}
      <span>{item.label}</span>
    </Link>
  )
}

/** Grupo com lista que abre ao passar o mouse ou ao clicar (no toque). */
function GrupoSuspenso({ rotulo, itens, ativo, aberto, abrir, fechar, ativoHref }: {
  rotulo: string; itens: NavItem[]; ativo: boolean; aberto: boolean; abrir: () => void; fechar: () => void; ativoHref: string | null
}) {
  return (
    <div className="topnav-grupo" onMouseEnter={abrir} onMouseLeave={fechar}>
      <button type="button" className={`topnav-item${ativo ? ' active' : ''}${aberto ? ' aberto' : ''}`} onClick={abrir} aria-expanded={aberto}>
        <span>{rotulo}</span>
        <svg viewBox="0 0 20 20" width="14" height="14" fill="none" aria-hidden><path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {aberto && (
        <div className="topnav-lista">
          {itens.map(item => <ItemLink key={item.href} item={item} ativo={ativoHref === item.href} classe="topnav-lista-item" />)}
        </div>
      )}
    </div>
  )
}

export default function MenuTopo({ companyName, logo, role, layout, direita }: {
  companyName: string; logo: string | null; role: string; layout: Exclude<Layout, 'lateral'>; direita: React.ReactNode
}) {
  const pathname = usePathname()
  const isAdmin = role === 'ADMIN'
  const ativoHref = itemAtivo(pathname)
  const [aberto, setAberto] = useState<string | null>(null)
  const [celularAberto, setCelularAberto] = useState(false)
  const barra = useRef<HTMLElement>(null)

  const grupos = sections
    .map(s => ({ label: s.label, items: s.items.filter(i => !i.adminOnly || isAdmin) }))
    .filter(s => s.items.length > 0)
  const inicio = topItems.filter(i => !i.adminOnly || isAdmin)
  const grupoAtivo = grupos.find(g => g.items.some(i => i.href === ativoHref))?.label ?? 'Início'
  const [grupoEscolhido, setGrupoEscolhido] = useState(grupoAtivo)

  // Trocou de página: fecha as listas e mostra, na faixa de baixo, o grupo da página aberta.
  useEffect(() => { setAberto(null); setCelularAberto(false); setGrupoEscolhido(grupoAtivo) }, [pathname, grupoAtivo])

  // Clique fora fecha a lista aberta.
  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => { if (barra.current && !barra.current.contains(e.target as Node)) setAberto(null) }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [aberto])

  const todos = [...inicio, ...grupos.flatMap(g => g.items)]
  const principais = todos.filter(i => PRINCIPAIS.includes(i.href))
  const outros = todos.filter(i => !PRINCIPAIS.includes(i.href))

  let desktop: React.ReactNode
  if (layout === 'topo') {
    desktop = (
      <nav className="topnav-itens">
        {inicio.map(item => <ItemLink key={item.href} item={item} ativo={ativoHref === item.href} comIcone={false} />)}
        {grupos.map(g => (
          <GrupoSuspenso key={g.label} rotulo={g.label} itens={g.items} ativo={grupoAtivo === g.label} aberto={aberto === g.label}
            abrir={() => setAberto(g.label)} fechar={() => setAberto(a => (a === g.label ? null : a))} ativoHref={ativoHref} />
        ))}
      </nav>
    )
  } else if (layout === 'faixas') {
    desktop = (
      <nav className="topnav-itens">
        {['Início', ...grupos.map(g => g.label)].map(rotulo => (
          rotulo === 'Início'
            ? <Link key={rotulo} href="/" className={`topnav-item${grupoEscolhido === rotulo ? ' active' : ''}`} onClick={() => setGrupoEscolhido(rotulo)}>Início</Link>
            : <button key={rotulo} type="button" className={`topnav-item${grupoEscolhido === rotulo ? ' active' : ''}`} onClick={() => setGrupoEscolhido(rotulo)}>{rotulo}</button>
        ))}
      </nav>
    )
  } else {
    desktop = (
      <nav className="topnav-itens">
        {principais.map(item => <ItemLink key={item.href} item={item} ativo={ativoHref === item.href} />)}
        {outros.length > 0 && (
          <GrupoSuspenso rotulo="Mais" itens={outros} ativo={outros.some(i => i.href === ativoHref)} aberto={aberto === 'Mais'}
            abrir={() => setAberto('Mais')} fechar={() => setAberto(a => (a === 'Mais' ? null : a))} ativoHref={ativoHref} />
        )}
      </nav>
    )
  }

  const itensDaFaixa = grupos.find(g => g.label === grupoEscolhido)?.items ?? []
  const acao = ACAO_DO_GRUPO[grupoEscolhido]

  return (
    <header ref={barra} className={`topnav topnav-${layout} no-print`}>
      <div className="topnav-barra">
        <Marca companyName={companyName} logo={logo} />
        <div className="topnav-desktop">{desktop}</div>
        <div className="topnav-direita">{direita}</div>
        <button type="button" className="topnav-celular-botao" onClick={() => setCelularAberto(v => !v)} aria-label="Abrir menu" aria-expanded={celularAberto}>
          <svg viewBox="0 0 20 20" width="22" height="22" fill="none" aria-hidden><path d="M3 5.5h14M3 10h14M3 14.5h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        </button>
      </div>

      {layout === 'faixas' && (
        <div className="topnav-faixa topnav-desktop">
          {itensDaFaixa.map(item => <ItemLink key={item.href} item={item} ativo={ativoHref === item.href} />)}
          {itensDaFaixa.length === 0 && <span className="topnav-faixa-vazia">Escolha um grupo acima</span>}
          <div style={{ flex: 1 }} />
          {acao && <Link href={acao.href} className="btn btn-primary" style={{ padding: '0.35rem 0.9rem' }}>+ {acao.label}</Link>}
        </div>
      )}

      {celularAberto && (
        <nav className="topnav-celular">
          {inicio.map(item => <ItemLink key={item.href} item={item} ativo={ativoHref === item.href} classe="topnav-lista-item" />)}
          {grupos.map(g => (
            <div key={g.label}>
              <div className="sidebar-section-label">{g.label}</div>
              {g.items.map(item => <ItemLink key={item.href} item={item} ativo={ativoHref === item.href} classe="topnav-lista-item" />)}
            </div>
          ))}
          <div className="topnav-celular-direita">{direita}</div>
        </nav>
      )}
    </header>
  )
}
