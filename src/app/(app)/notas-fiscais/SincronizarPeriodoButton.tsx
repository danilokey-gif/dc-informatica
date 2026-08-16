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
  const [resultado, setResultado] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [novosTotal, setNovosTotal] = useState(0)
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
            nsuInicial: rodada === 0 ? undefined : proximoNsu,
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
          if (!resposta.temMais) {
            setResultado(`${jaExistentes} nota(s) já estavam no sistema nesse período. ${novos} nova(s) encontrada(s) agora no governo.`)
            return
          }
        } catch (e) {
          setErro(e instanceof Error ? e.message : String(e))
          return
        }
      }
      setResultado(`${novos} nota(s) nova(s) encontrada(s) até agora nesse período. Ainda pode haver mais — clique em "Buscar" de novo pra continuar.`)
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
        <button type="button" className="btn btn-outline" onClick={buscar} disabled={isPending || (!inicio && !fim)}>
          {isPending ? `Buscando… (${novosTotal} encontrada(s))` : `🔍 Buscar ${tipo} no período`}
        </button>
        {isPending && (
          <button type="button" className="btn btn-outline" onClick={cancelar} style={{ fontSize: '0.8rem' }}>
            Parar
          </button>
        )}
      </div>
      {resultado && <p style={{ color: 'var(--accent-green)', fontSize: '0.85rem', marginTop: '0.5rem' }}>{resultado}</p>}
      {erro && <p style={{ color: 'var(--accent-red)', fontSize: '0.85rem', marginTop: '0.5rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{erro}</p>}
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
