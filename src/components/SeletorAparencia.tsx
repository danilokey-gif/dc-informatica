'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TEMAS, LAYOUTS, COOKIE_TEMA, COOKIE_LAYOUT, type Tema, type Layout } from '@/lib/aparencia'

const gravar = (nome: string, valor: string) => {
  document.cookie = `${nome}=${valor}; path=/; max-age=31536000; samesite=lax`
}

/** Desenho pequeno de cada formato de menu. */
function Miniatura({ layout }: { layout: Layout }) {
  const cor = 'var(--primary)'
  const linha = 'var(--text-muted)'
  return (
    <svg viewBox="0 0 60 38" width="60" height="38" aria-hidden style={{ flexShrink: 0, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-color)' }}>
      {layout === 'lateral' && <><rect x="0" y="0" width="15" height="38" fill="var(--surface)" /><rect x="3" y="5" width="9" height="2.5" rx="1" fill={cor} /><rect x="3" y="11" width="9" height="2" rx="1" fill={linha} /><rect x="3" y="16" width="9" height="2" rx="1" fill={linha} /></>}
      {layout === 'topo' && <><rect x="0" y="0" width="60" height="9" fill="var(--surface)" /><rect x="14" y="3.5" width="8" height="2" rx="1" fill={cor} /><rect x="25" y="3.5" width="8" height="2" rx="1" fill={linha} /><rect x="25" y="10" width="14" height="12" rx="1.5" fill="var(--surface)" stroke="var(--border)" strokeWidth="0.6" /></>}
      {layout === 'faixas' && <><rect x="0" y="0" width="60" height="8" fill={cor} /><rect x="0" y="8" width="60" height="6" fill="var(--surface)" /><rect x="4" y="10" width="8" height="2" rx="1" fill={cor} /><rect x="15" y="10" width="8" height="2" rx="1" fill={linha} /></>}
      {layout === 'icones' && <><rect x="0" y="0" width="60" height="9" fill="var(--surface)" />{[13, 21, 29, 37, 45].map((x, i) => <circle key={x} cx={x} cy="4.5" r="2" fill={i === 0 ? cor : linha} />)}</>}
      {layout !== 'lateral' && <><rect x="6" y="26" width="48" height="3" rx="1" fill="var(--surface)" /><rect x="6" y="31" width="34" height="3" rx="1" fill="var(--surface)" /></>}
      {layout === 'lateral' && <><rect x="19" y="5" width="37" height="3" rx="1" fill="var(--surface)" /><rect x="19" y="11" width="28" height="3" rx="1" fill="var(--surface)" /></>}
    </svg>
  )
}

/**
 * Botão "Aparência": escolhe as cores e o formato do menu. Vale só para este computador
 * (fica gravado no navegador) e troca na hora, sem perder o que está na tela.
 */
export default function SeletorAparencia({ tema, layout }: { tema: Tema; layout: Layout }) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [temaAtual, setTemaAtual] = useState(tema)
  const [layoutAtual, setLayoutAtual] = useState(layout)
  const caixa = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => { if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false) }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc) }
  }, [aberto])

  const escolherTema = (t: Tema) => {
    setTemaAtual(t)
    gravar(COOKIE_TEMA, t)
    document.documentElement.dataset.tema = t // troca as cores na hora
  }
  const escolherLayout = (l: Layout) => {
    setLayoutAtual(l)
    gravar(COOKIE_LAYOUT, l)
    router.refresh() // o menu é montado pelo servidor
  }

  return (
    <div ref={caixa} style={{ position: 'relative' }}>
      <button type="button" className="btn btn-outline seletor-aparencia-botao" onClick={() => setAberto(v => !v)} aria-expanded={aberto} title="Mudar cores e menu">
        <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden>
          <path d="M10 3a7 7 0 1 0 0 14c1 0 1.5-.7 1.5-1.4 0-.9-.8-1.3-.8-2.1 0-.8.6-1.4 1.5-1.4H14a3 3 0 0 0 3-3C17 5.7 13.9 3 10 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx="6.5" cy="9" r="1" fill="currentColor" /><circle cx="9" cy="6" r="1" fill="currentColor" /><circle cx="12.5" cy="6.5" r="1" fill="currentColor" />
        </svg>
        <span>Aparência</span>
      </button>

      {aberto && (
        <div className="seletor-aparencia">
          <div className="seletor-aparencia-titulo">Cores</div>
          <div className="seletor-aparencia-temas">
            {TEMAS.map(t => (
              <button key={t.id} type="button" onClick={() => escolherTema(t.id)} className={`seletor-aparencia-opcao${temaAtual === t.id ? ' ativo' : ''}`}>
                <span style={{ display: 'flex', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border)' }}>
                  {t.cores.map(c => <span key={c} style={{ width: 14, height: 22, background: c }} />)}
                </span>
                <span>{t.nome}</span>
              </button>
            ))}
          </div>

          <div className="seletor-aparencia-titulo" style={{ marginTop: '0.9rem' }}>Menu</div>
          <div style={{ display: 'grid', gap: '0.4rem' }}>
            {LAYOUTS.map(l => (
              <button key={l.id} type="button" onClick={() => escolherLayout(l.id)} className={`seletor-aparencia-opcao${layoutAtual === l.id ? ' ativo' : ''}`}>
                <Miniatura layout={l.id} />
                <span style={{ textAlign: 'left' }}>
                  <span style={{ display: 'block', fontWeight: 600 }}>{l.nome}</span>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{l.texto}</span>
                </span>
              </button>
            ))}
          </div>
          <p style={{ margin: '0.75rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>Vale só para este computador.</p>
        </div>
      )}
    </div>
  )
}
