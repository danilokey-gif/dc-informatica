'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { excluirAnexo } from './imprimir/anexos-actions'

export interface AnexoGaleria {
  id: string
  driveFileId: string
  nome: string
  video: boolean
  quando: string
  descricao: string | null
}

/**
 * Miniaturas das fotos/vídeos da OS. Clicando, abre ampliado aqui mesmo (setas ← → para passar,
 * Esc para fechar). Foto vem pelo próprio sistema; vídeo toca no player do Google Drive embutido.
 */
export default function GaleriaAnexos({ anexos }: { anexos: AnexoGaleria[] }) {
  const router = useRouter()
  const [aberto, setAberto] = useState<number | null>(null)
  const [apagando, setApagando] = useState(false)
  const atual = aberto !== null ? anexos[aberto] : null

  async function apagar() {
    if (!atual) return
    if (!window.confirm(`Apagar "${atual.nome}" desta OS?

O arquivo vai para a lixeira do Google Drive, onde fica por 30 dias.`)) return
    setApagando(true)
    const r = await excluirAnexo(atual.id)
    setApagando(false)
    if (r.erro) { window.alert(r.erro); return }
    setAberto(anexos.length > 1 ? Math.min(aberto!, anexos.length - 2) : null)
    router.refresh()
  }

  const passar = useCallback((d: number) => setAberto(i => (i === null ? null : (i + d + anexos.length) % anexos.length)), [anexos.length])

  useEffect(() => {
    if (aberto === null) return
    const teclas = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAberto(null)
      if (e.key === 'ArrowRight') passar(1)
      if (e.key === 'ArrowLeft') passar(-1)
    }
    window.addEventListener('keydown', teclas)
    const rolagem = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', teclas); document.body.style.overflow = rolagem }
  }, [aberto, passar])

  const botao: React.CSSProperties = { background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', borderRadius: '999px', width: 44, height: 44, fontSize: '1.4rem', cursor: 'pointer' }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
        {anexos.map((a, i) => (
          <button key={a.id} type="button" onClick={() => setAberto(i)}
            style={{ border: '1px solid var(--border)', borderRadius: '0.4rem', overflow: 'hidden', display: 'block', padding: 0, background: 'none', color: 'inherit', textAlign: 'left', cursor: 'zoom-in', position: 'relative' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/os/anexo/${a.id}/miniatura`} alt={a.nome} loading="lazy" style={{ width: '100%', height: '110px', objectFit: 'cover', background: 'var(--surface-hover)', display: 'block' }} />
            {a.video && <span style={{ position: 'absolute', top: 38, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: '999px', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>▶</span>}
            <div style={{ padding: '0.35rem 0.45rem', fontSize: '0.7rem', lineHeight: 1.3 }}>
              <div>{a.video ? '🎬' : '📷'} {a.quando}</div>
              {a.descricao && <div className="text-muted">{a.descricao}</div>}
            </div>
          </button>
        ))}
      </div>

      {atual && (
        <div className="no-print" role="dialog" aria-label={atual.nome} onClick={() => setAberto(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 10000, display: 'flex', flexDirection: 'column' }}>
          <div onClick={e => e.stopPropagation()} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', padding: '0.75rem 1rem', color: '#fff', fontSize: '0.85rem' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{atual.nome}</div>
              <div style={{ opacity: 0.75 }}>{atual.quando}{atual.descricao ? ` — ${atual.descricao}` : ''} · {aberto! + 1} de {anexos.length}</div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
              <a href={`https://drive.google.com/file/d/${atual.driveFileId}/view`} target="_blank" rel="noopener noreferrer" style={{ color: '#fff', fontSize: '0.8rem', textDecoration: 'underline' }}>Original no Drive</a>
              <button type="button" onClick={apagar} disabled={apagando}
                style={{ background: 'rgba(239,68,68,0.85)', color: '#fff', border: 'none', borderRadius: 999, padding: '0.45rem 0.9rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                {apagando ? 'Apagando…' : '🗑 Apagar'}
              </button>
              <button type="button" onClick={() => setAberto(null)} style={botao} aria-label="Fechar">✕</button>
            </div>
          </div>
          <div onClick={e => e.stopPropagation()} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '0 0.75rem 1rem', minHeight: 0 }}>
            {anexos.length > 1 && <button type="button" onClick={() => passar(-1)} style={botao} aria-label="Anterior">‹</button>}
            <div style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 0 }}>
              {atual.video ? (
                <iframe key={atual.id} src={`https://drive.google.com/file/d/${atual.driveFileId}/preview`} title={atual.nome} allow="autoplay; fullscreen"
                  style={{ width: '100%', height: '100%', maxWidth: 1100, border: 'none', borderRadius: 8, background: '#000' }} />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={atual.id} src={`/os/anexo/${atual.id}/miniatura?tamanho=1600`} alt={atual.nome}
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 4 }} />
              )}
            </div>
            {anexos.length > 1 && <button type="button" onClick={() => passar(1)} style={botao} aria-label="Próxima">›</button>}
          </div>
        </div>
      )}
    </>
  )
}
