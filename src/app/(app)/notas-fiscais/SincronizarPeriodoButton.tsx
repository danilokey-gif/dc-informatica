'use client'

import { useRef, useState, useTransition } from 'react'
import type { ResultadoSincronizacao, OpcoesSincronizacao } from './sync-actions'

// Rede de segurança contra loop indefinido — cada rodada já é curta o bastante pra caber no
// tempo da Vercel, então isso não deveria ser atingido num uso normal.
const MAX_RODADAS = 60

export default function SincronizarPeriodoButton({ tipo, action }: { tipo: 'NFS-e' | 'NF-e'; action: (opcoes?: OpcoesSincronizacao) => Promise<ResultadoSincronizacao> }) {
  const [isPending, startTransition] = useTransition()
  const [baixando, setBaixando] = useState(false)
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [nsuInicialManual, setNsuInicialManual] = useState('')
  const [resultado, setResultado] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [novosTotal, setNovosTotal] = useState(0)
  const [ultimoNsuVerificado, setUltimoNsuVerificado] = useState<string | undefined>(undefined)
  const [chaves, setChaves] = useState<string[]>([])
  const cancelarRef = useRef(false)

  const tipoRota = tipo === 'NFS-e' ? 'nfse' : 'nfe'

  function buscar() {
    setErro(null)
    setResultado(null)
    setChaves([])
    setNovosTotal(0)
    cancelarRef.current = false

    startTransition(async () => {
      // O "NSU inicial" digitado pelo usuário só vale pra primeira rodada; depois disso a busca
      // segue de onde o governo parou.
      const nsuInicialUsado = nsuInicialManual.trim() ? nsuInicialManual.trim().padStart(15, '0') : undefined
      let proximoNsu: string | undefined = undefined
      let jaExistentes = 0
      let novos = 0
      let chavesAcumuladas: string[] = []

      for (let rodada = 0; rodada < MAX_RODADAS; rodada++) {
        if (cancelarRef.current) {
          setResultado(`Busca interrompida. ${novos} nota(s) nova(s) encontrada(s) até agora.`)
          return
        }
        try {
          const resposta = await action({
            inicio: inicio || undefined,
            fim: fim || undefined,
            nsuInicial: rodada === 0 ? nsuInicialUsado : proximoNsu,
          })
          if (resposta.erro) {
            setErro(resposta.erro)
            return
          }
          novos += resposta.novos
          chavesAcumuladas = rodada === 0 ? (resposta.chaves || []) : [...chavesAcumuladas, ...(resposta.chaves || [])]
          setNovosTotal(novos)
          setChaves(chavesAcumuladas)
          if (rodada === 0) {
            // A mensagem da 1ª rodada já traz "X já estavam no sistema"; guardamos só pro texto final.
            const match = resposta.mensagem.match(/^(\d+) nota/)
            jaExistentes = match ? parseInt(match[1], 10) : 0
          }
          proximoNsu = resposta.proximoNsu
          setUltimoNsuVerificado(resposta.proximoNsu)
          if (!resposta.temMais) {
            setResultado(`${jaExistentes} nota(s) já estavam no sistema nesse período. ${novos} nova(s) encontrada(s) agora no governo.`)
            return
          }
        } catch (e) {
          setErro(e instanceof Error ? e.message : String(e))
          return
        }
      }
      setResultado(`${novos} nota(s) nova(s) encontrada(s) nesse período. A busca parou no limite de segurança de rodadas — clique em "Buscar" de novo pra continuar de onde parou.`)
    })
  }

  function cancelar() {
    cancelarRef.current = true
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
        <button type="button" className="btn btn-outline" onClick={buscar} disabled={isPending || (!inicio && !fim)}>
          {isPending ? `Buscando… (${novosTotal} encontrada(s))` : `🔍 Buscar ${tipo} no período`}
        </button>
        {isPending && (
          <button type="button" className="btn btn-outline" onClick={cancelar} style={{ fontSize: '0.8rem' }}>
            Parar
          </button>
        )}
      </div>
      {tipo === 'NFS-e' && (
        <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.4rem' }}>
          💡 <strong>Dica:</strong> A busca continua sozinha até o governo dizer que não há mais nada (use &quot;Parar&quot; pra interromper). Se suas notas estiverem em NSUs muito altos, preencha &quot;NSU inicial&quot; pra pular direto pra lá.
        </p>
      )}
      {resultado && <p style={{ color: 'var(--accent-green)', fontSize: '0.85rem', marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>{resultado}</p>}
      {erro && <p style={{ color: 'var(--accent-red)', fontSize: '0.85rem', marginTop: '0.5rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{erro}</p>}
      {ultimoNsuVerificado && (
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
          📌 Próximo NSU a verificar: <strong>{String(BigInt(ultimoNsuVerificado) + BigInt(1))}</strong>
          {' — '}
          <button
            type="button"
            style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', textDecoration: 'underline', padding: 0, fontSize: '0.78rem' }}
            onClick={() => setNsuInicialManual(String(BigInt(ultimoNsuVerificado) + BigInt(1)))}
          >
            Copiar para NSU inicial
          </button>
        </p>
      )}
      {chaves.length > 0 && !erro && (
        <div style={{ marginTop: '0.5rem' }}>
          <button type="button" className="btn btn-outline" onClick={baixarZip} disabled={baixando}>
            {baixando ? 'Gerando .zip…' : `💾 Baixar .zip deste período (${chaves.length})`}
          </button>
        </div>
      )}
    </div>
  )
}
