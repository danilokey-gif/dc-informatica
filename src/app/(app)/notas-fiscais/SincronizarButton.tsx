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
        const msg = e instanceof Error ? e.message : String(e)
        // O Next.js em produção mostra essa mensagem genérica quando a Server Action demora demais (timeout).
        if (msg.includes('unexpected response') || msg.includes('NEXT_REDIRECT') || msg.includes('digest')) {
          setErro('A busca demorou demais e foi interrompida pelo servidor. Use a opção "Buscar por período" abaixo, que faz buscas menores e mais rápidas.')
        } else {
          setErro(msg)
        }
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
