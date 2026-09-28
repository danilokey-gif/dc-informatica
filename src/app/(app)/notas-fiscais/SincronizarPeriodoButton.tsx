'use client'

import { useState, useTransition } from 'react'
import type { ResultadoSincronizacao, OpcoesSincronizacao } from './sync-actions'

export default function SincronizarPeriodoButton({ tipo, action }: { tipo: 'NFS-e' | 'NF-e'; action: (opcoes?: OpcoesSincronizacao) => Promise<ResultadoSincronizacao> }) {
  const [isPending, startTransition] = useTransition()
  const [baixando, setBaixando] = useState(false)
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [nsuInicialManual, setNsuInicialManual] = useState('')
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
        // Se o usuário digitou um NSU manual e não estamos continuando, usa esse como ponto de partida
        const nsuParaUsar = continuar
          ? proximoNsu
          : (nsuInicialManual.trim() ? nsuInicialManual.trim().padStart(15, '0') : undefined)

        const resposta = await action({
          inicio: inicio || undefined,
          fim: fim || undefined,
          nsuInicial: nsuParaUsar,
        })
        if (resposta.erro) {
          setErro(resposta.erro)
        } else {
          setResultado(resposta.mensagem)
          setProximoNsu(resposta.proximoNsu)
          setTemMais(!!resposta.temMais)
          setChaves(prev => continuar ? [...new Set([...prev, ...(resposta.chaves || [])])] : (resposta.chaves || []))
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        if (msg.includes('unexpected response') || msg.includes('digest')) {
          setErro('A busca demorou demais. Tente novamente ou use um NSU inicial maior.')
        } else {
          setErro(msg)
        }
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
      <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>Buscar em um período específico:</p>
      <div className="flex gap-4" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label className="input-label" htmlFor={`inicio-${tipo}`}>De</label>
          <input type="date" id={`inicio-${tipo}`} className="input-field" value={inicio} onChange={e => setInicio(e.target.value)} />
        </div>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label className="input-label" htmlFor={`fim-${tipo}`}>Até</label>
          <input type="date" id={`fim-${tipo}`} className="input-field" value={fim} onChange={e => setFim(e.target.value)} />
        </div>
        {tipo === 'NFS-e' && (
          <div className="input-group" style={{ marginBottom: 0, maxWidth: '160px' }}>
            <label className="input-label" htmlFor={`nsu-${tipo}`}>NSU inicial (opcional)</label>
            <input
              type="number"
              id={`nsu-${tipo}`}
              className="input-field"
              placeholder="Ex: 5000"
              value={nsuInicialManual}
              onChange={e => setNsuInicialManual(e.target.value)}
              min={0}
            />
          </div>
        )}
        <button type="button" className="btn btn-outline" onClick={() => buscar(false)} disabled={isPending || (!inicio && !fim)}>
          {isPending ? 'Buscando…' : `🔍 Buscar ${tipo} no período`}
        </button>
      </div>
      {tipo === 'NFS-e' && (
        <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.4rem' }}>
          💡 <strong>Dica:</strong> Cada clique verifica 40 NSUs. Use &quot;NSU inicial&quot; para pular para um número maior e encontrar suas notas mais rápido. O próximo NSU aparece abaixo após cada busca.
        </p>
      )}
      {resultado && <p style={{ color: 'var(--accent-green)', fontSize: '0.85rem', marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>{resultado}</p>}
      {erro && <p style={{ color: 'var(--accent-red)', fontSize: '0.85rem', marginTop: '0.5rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{erro}</p>}
      {proximoNsu && (
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
          📌 Próximo NSU a verificar: <strong>{String(BigInt(proximoNsu) + BigInt(1))}</strong>
          {' — '}
          <button
            type="button"
            style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', textDecoration: 'underline', padding: 0, fontSize: '0.78rem' }}
            onClick={() => setNsuInicialManual(String(BigInt(proximoNsu) + BigInt(1)))}
          >
            Copiar para NSU inicial
          </button>
        </p>
      )}
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
