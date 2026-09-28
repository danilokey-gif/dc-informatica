'use client'

import { useRef, useState, useTransition } from 'react'
import { buscarNotasFornecedores } from './actions'

// Cada rodada é uma chamada curta ao servidor; o laço só continua enquanto a Sefaz indicar que ainda
// há documentos (NSUs em ordem crescente, o que a Sefaz permite). Isso é só um teto de segurança.
const MAX_RODADAS = 20

export default function BuscarFornecedoresButton({ bloqueadoAte }: { bloqueadoAte: string | null }) {
  const [isPending, startTransition] = useTransition()
  const [resultado, setResultado] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const cancelarRef = useRef(false)

  function buscar() {
    setResultado(null)
    setErro(null)
    cancelarRef.current = false

    startTransition(async () => {
      let novas = 0
      let atualizadas = 0
      for (let rodada = 0; rodada < MAX_RODADAS; rodada++) {
        if (cancelarRef.current) break
        try {
          const r = await buscarNotasFornecedores()
          novas += r.novas
          atualizadas += r.atualizadas
          if (r.erro) {
            setErro(r.erro)
            if (novas || atualizadas) setResultado(`${novas} nota(s) nova(s) e ${atualizadas} atualizada(s) antes da interrupção.`)
            return
          }
          if (!r.temMais) {
            setResultado(rodada === 0 ? r.mensagem : `${novas} nota(s) nova(s) de fornecedores, ${atualizadas} atualizada(s). Tudo em dia com a Sefaz.`)
            return
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          setErro(msg.includes('unexpected response') || msg.includes('digest')
            ? 'A consulta demorou demais e foi interrompida pelo servidor. Tente de novo — ela continua de onde parou.'
            : msg)
          return
        }
      }
      setResultado(`${novas} nota(s) nova(s) de fornecedores, ${atualizadas} atualizada(s). Ainda há mais na Sefaz — clique de novo para continuar.`)
    })
  }

  const bloqueado = bloqueadoAte ? new Date(bloqueadoAte) > new Date() : false

  return (
    <div>
      <div className="flex gap-4" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-primary" onClick={buscar} disabled={isPending || bloqueado}>
          {isPending ? 'Consultando a Sefaz…' : '🔄 Buscar notas de fornecedores'}
        </button>
        {isPending && (
          <button type="button" className="btn btn-outline" onClick={() => { cancelarRef.current = true }}>Parar</button>
        )}
        {bloqueado && bloqueadoAte && !isPending && (
          <span className="text-muted" style={{ fontSize: '0.85rem' }}>
            Próxima consulta liberada às{' '}
            <strong>{new Date(bloqueadoAte).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}</strong>
            {' '}(regra da Sefaz).
          </span>
        )}
      </div>
      {resultado && <p style={{ color: 'var(--accent-green)', fontSize: '0.85rem', marginTop: '0.5rem' }}>{resultado}</p>}
      {erro && <p style={{ color: 'var(--accent-red)', fontSize: '0.85rem', marginTop: '0.5rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{erro}</p>}
    </div>
  )
}
