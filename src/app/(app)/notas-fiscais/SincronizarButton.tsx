'use client'

import { useRef, useState, useTransition } from 'react'
import type { ResultadoSincronizacao } from './sync-actions'

// Limite de segurança pra nunca ficar em loop indefinido (cada rodada já é curta o bastante pra
// caber no tempo da Vercel — isso só existe como rede de segurança, não deve ser atingido na prática).
const MAX_RODADAS = 60

export default function SincronizarButton({ tipo, action }: { tipo: 'NFS-e' | 'NF-e'; action: () => Promise<ResultadoSincronizacao> }) {
  const [isPending, startTransition] = useTransition()
  const [resultado, setResultado] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [totalNovos, setTotalNovos] = useState(0)
  const cancelarRef = useRef(false)

  function sincronizar() {
    setResultado(null)
    setErro(null)
    setTotalNovos(0)
    cancelarRef.current = false

    startTransition(async () => {
      let total = 0
      for (let rodada = 0; rodada < MAX_RODADAS; rodada++) {
        if (cancelarRef.current) {
          setResultado(`Busca interrompida. ${total} nota(s) nova(s) importada(s) até agora.`)
          return
        }
        try {
          const { novos, erro: erroRetornado, temMais } = await action()
          if (erroRetornado) {
            setErro(erroRetornado)
            return
          }
          total += novos
          setTotalNovos(total)
          if (!temMais) {
            setResultado(`${total} nota(s) nova(s) importada(s) do governo.`)
            return
          }
        } catch (e) {
          setErro(e instanceof Error ? e.message : String(e))
          return
        }
      }
      setResultado(`${total} nota(s) nova(s) importada(s) até agora. Ainda pode haver mais — clique em "Buscar" de novo pra continuar.`)
    })
  }

  function cancelar() {
    cancelarRef.current = true
  }

  return (
    <div>
      <div className="flex gap-4" style={{ alignItems: 'center' }}>
        <button type="button" className="btn btn-outline" onClick={sincronizar} disabled={isPending}>
          {isPending ? `Buscando… (${totalNovos} encontrada(s))` : `🔄 Buscar notas de ${tipo} no governo`}
        </button>
        {isPending && (
          <button type="button" className="btn btn-outline" onClick={cancelar} style={{ fontSize: '0.8rem' }}>
            Parar
          </button>
        )}
      </div>
      {resultado && <p style={{ color: 'var(--accent-green)', fontSize: '0.85rem', marginTop: '0.5rem' }}>{resultado}</p>}
      {erro && <p style={{ color: 'var(--accent-red)', fontSize: '0.85rem', marginTop: '0.5rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{erro}</p>}
    </div>
  )
}
