'use client'

import { useState, useTransition } from 'react'
import type { ResultadoSincronizacao, OpcoesSincronizacao } from './sync-actions'

export default function SincronizarPeriodoButton({ tipo, action }: { tipo: 'NFS-e' | 'NF-e'; action: (opcoes?: OpcoesSincronizacao) => Promise<ResultadoSincronizacao> }) {
  const [isPending, startTransition] = useTransition()
  const [baixando, setBaixando] = useState(false)
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [resultado, setResultado] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [proximoNsu, setProximoNsu] = useState<string | undefined>(undefined)
  const [temMais, setTemMais] = useState(false)
  const [chaves, setChaves] = useState<string[]>([])

  const tipoRota = tipo === 'NFS-e' ? 'nfse' : 'nfe'

  function buscar(continuar: boolean) {
    setErro(null)
    if (!continuar) {
      setResultado(null)
      setProximoNsu(undefined)
      setTemMais(false)
      setChaves([])
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
          setChaves(prev => continuar ? [...prev, ...(resposta.chaves || [])] : (resposta.chaves || []))
        }
      } catch (e) {
        setErro(e instanceof Error ? e.message : String(e))
      }
    })
  }

  async function baixarZip() {
    setBaixando(true)
    setErro(null)
    try {
      const res = await fetch('/notas-fiscais/download-importadas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: tipoRota, chaves }),
      })
      if (!res.ok) {
        setErro(`Falha ao gerar o .zip (HTTP ${res.status}).`)
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `notas-${tipoRota}-importadas-governo.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setBaixando(false)
    }
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
      <div className="flex gap-4" style={{ marginTop: '0.5rem', flexWrap: 'wrap' }}>
        {temMais && !erro && (
          <button type="button" className="btn btn-primary" onClick={() => buscar(true)} disabled={isPending}>
            {isPending ? 'Buscando…' : 'Continuar buscando mais'}
          </button>
        )}
        {chaves.length > 0 && !erro && (
          <button type="button" className="btn btn-outline" onClick={baixarZip} disabled={baixando}>
            {baixando ? 'Gerando .zip…' : `💾 Baixar .zip deste período (${chaves.length})`}
          </button>
        )}
      </div>
    </div>
  )
}
