'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { importarExtratoCaixinha } from './actions'

/** Envio do PDF "Extrato de Rendimentos – Caixinhas PJ" do Nubank. */
export default function ImportarCaixinha() {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [enviando, iniciar] = useTransition()
  const [resultado, setResultado] = useState<{ ok: boolean; mensagem: string } | null>(null)

  function enviar() {
    const arquivo = input.current?.files?.[0]
    if (!arquivo) { setResultado({ ok: false, mensagem: 'Escolha o PDF do extrato.' }); return }
    const dados = new FormData()
    dados.set('arquivo', arquivo)
    setResultado(null)
    iniciar(async () => {
      const r = await importarExtratoCaixinha(dados)
      setResultado(r)
      if (r.ok) { if (input.current) input.current.value = ''; router.refresh() }
    })
  }

  return (
    <div className="card">
      <h3 style={{ fontSize: '1.05rem' }}>📄 Enviar extrato da Caixinha (PDF)</h3>
      <p className="text-muted" style={{ fontSize: '0.8rem' }}>
        No app do Nubank PJ: Caixinhas → Extrato de rendimentos → escolha o período → baixar PDF. O sistema lê o saldo de cada mês,
        o rendimento e o IR. Pode enviar períodos que se repetem: nada é duplicado.
      </p>
      <div className="flex gap-4" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
        <input ref={input} type="file" accept="application/pdf,.pdf" className="input-field" style={{ maxWidth: 360 }} disabled={enviando} />
        <button type="button" className="btn btn-primary" onClick={enviar} disabled={enviando}>{enviando ? 'Lendo o PDF…' : 'Enviar PDF'}</button>
      </div>
      {resultado && (
        <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.875rem',
          background: resultado.ok ? 'var(--badge-success-bg)' : 'var(--badge-danger-bg)', color: resultado.ok ? 'var(--badge-success-text)' : 'var(--badge-danger-text)' }}>
          {resultado.ok ? '✅ ' : '❌ '}{resultado.mensagem}
        </div>
      )}
    </div>
  )
}
