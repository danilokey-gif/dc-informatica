'use client'

import { useState, useTransition } from 'react'
import type { ResultadoSincronizacao } from './sync-actions'

export default function SincronizarButton({ tipo, action }: { tipo: 'NFS-e' | 'NF-e'; action: () => Promise<ResultadoSincronizacao> }) {
  const [isPending, startTransition] = useTransition()
  const [resultado, setResultado] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  function sincronizar() {
    setResultado(null)
    setErro(null)
    startTransition(async () => {
      try {
        const { mensagem, erro: erroRetornado } = await action()
        if (erroRetornado) {
          setErro(erroRetornado)
        } else {
          setResultado(mensagem)
        }
      } catch (e) {
        setErro(e instanceof Error ? e.message : String(e))
      }
    })
  }

  return (
    <div>
      <button type="button" className="btn btn-outline" onClick={sincronizar} disabled={isPending}>
        {isPending ? 'Sincronizando…' : `🔄 Buscar notas de ${tipo} no governo`}
      </button>
      {resultado && <p style={{ color: 'var(--accent-green)', fontSize: '0.85rem', marginTop: '0.5rem' }}>{resultado}</p>}
      {erro && <p style={{ color: 'var(--accent-red)', fontSize: '0.85rem', marginTop: '0.5rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{erro}</p>}
    </div>
  )
}
