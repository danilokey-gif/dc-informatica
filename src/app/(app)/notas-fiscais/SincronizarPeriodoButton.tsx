'use client'

import { useState, useTransition } from 'react'
import type { ResultadoSincronizacao, OpcoesSincronizacao } from './sync-actions'

export default function SincronizarPeriodoButton({ tipo, action }: { tipo: 'NFS-e' | 'NF-e'; action: (opcoes?: OpcoesSincronizacao) => Promise<ResultadoSincronizacao> }) {
  const [isPending, startTransition] = useTransition()
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [resultado, setResultado] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [proximoNsu, setProximoNsu] = useState<string | undefined>(undefined)
  const [temMais, setTemMais] = useState(false)

  function buscar(continuar: boolean) {
    setErro(null)
    if (!continuar) {
      setResultado(null)
      setProximoNsu(undefined)
      setTemMais(false)
    }
    startTransition(async () => {
      try {
        const resposta = await action({
          inicio: inicio || undefined,
          fim: fim || undefined,
          nsuInicial: continuar ? proximoNsu : undefined,
        })
        if (resposta.erro) {
          setErro(resposta.erro)
        } else {
          setResultado(resposta.mensagem)
          setProximoNsu(resposta.proximoNsu)
          setTemMais(!!resposta.temMais)
        }
      } catch (e) {
        setErro(e instanceof Error ? e.message : String(e))
      }
    })
  }

  return (
    <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
      <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>Ou busque só em um período específico:</p>
      <div className="flex gap-4" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label className="input-label" htmlFor={`inicio-${tipo}`}>De</label>
          <input type="date" id={`inicio-${tipo}`} className="input-field" value={inicio} onChange={e => setInicio(e.target.value)} />
        </div>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label className="input-label" htmlFor={`fim-${tipo}`}>Até</label>
          <input type="date" id={`fim-${tipo}`} className="input-field" value={fim} onChange={e => setFim(e.target.value)} />
        </div>
        <button type="button" className="btn btn-outline" onClick={() => buscar(false)} disabled={isPending || (!inicio && !fim)}>
          {isPending ? 'Buscando…' : `🔍 Buscar ${tipo} no período`}
        </button>
      </div>
      {resultado && <p style={{ color: 'var(--accent-green)', fontSize: '0.85rem', marginTop: '0.5rem' }}>{resultado}</p>}
      {erro && <p style={{ color: 'var(--accent-red)', fontSize: '0.85rem', marginTop: '0.5rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{erro}</p>}
      {temMais && !erro && (
        <button type="button" className="btn btn-primary" style={{ marginTop: '0.5rem' }} onClick={() => buscar(true)} disabled={isPending}>
          {isPending ? 'Buscando…' : 'Continuar buscando mais'}
        </button>
      )}
    </div>
  )
}
