'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cancelarNfe } from './nfe-actions'

// Prazo padrão de cancelamento da NF-e. Depois dele a Sefaz costuma recusar (código 501).
const PRAZO_HORAS = 24

export default function CancelarNfeButton({ emissaoId, numero, autorizadaEm }: { emissaoId: string; numero: number; autorizadaEm: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [aberto, setAberto] = useState(false)
  const [justificativa, setJustificativa] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)

  const horasDesdeAutorizacao = (Date.now() - new Date(autorizadaEm).getTime()) / 3_600_000
  const foraDoPrazo = horasDesdeAutorizacao > PRAZO_HORAS
  const tamanho = justificativa.trim().length
  const justificativaOk = tamanho >= 15 && tamanho <= 255

  function cancelar() {
    if (!justificativaOk) return
    const aviso =
      `Cancelar a NF-e nº ${numero} na Sefaz?\n\n` +
      'O cancelamento é definitivo: a nota deixa de valer e não dá para desfazer.' +
      (foraDoPrazo ? `\n\nJá passaram mais de ${PRAZO_HORAS} horas da autorização, então a Sefaz pode recusar.` : '')
    if (!window.confirm(aviso)) return

    setErro(null)
    setMensagem(null)
    startTransition(async () => {
      try {
        const r = await cancelarNfe(emissaoId, justificativa)
        if (r.ok) {
          setMensagem(r.mensagem || 'Nota cancelada na Sefaz.')
          setAberto(false)
          router.refresh()
        } else {
          setErro(r.erro || 'A Sefaz não cancelou a nota.')
        }
      } catch (e) {
        setErro(e instanceof Error ? e.message : String(e))
      }
    })
  }

  if (!aberto) {
    return (
      <div style={{ flexBasis: '100%' }}>
        <button type="button" className="btn btn-danger" onClick={() => setAberto(true)}>🚫 Cancelar NF-e</button>
        {mensagem && <p style={{ color: 'var(--accent-green)', fontSize: '0.85rem', marginTop: '0.5rem' }}>{mensagem}</p>}
      </div>
    )
  }

  return (
    <div style={{ flexBasis: '100%', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '1rem' }}>
      <label className="input-label" htmlFor="justificativa-cancelamento">
        Justificativa do cancelamento (vai para a Sefaz)
      </label>
      <textarea
        id="justificativa-cancelamento"
        className="input-field"
        rows={3}
        maxLength={255}
        value={justificativa}
        onChange={e => setJustificativa(e.target.value)}
        placeholder="Ex.: Venda desfeita a pedido do cliente antes da entrega da mercadoria"
        disabled={isPending}
      />
      <p className="text-muted" style={{ fontSize: '0.75rem', margin: '0.25rem 0 0.75rem' }}>
        {tamanho}/255 caracteres{tamanho < 15 ? ` — mínimo 15` : ''}
      </p>
      {foraDoPrazo && (
        <p style={{ color: 'var(--accent-red)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
          Esta nota foi autorizada há mais de {PRAZO_HORAS} horas. O prazo normal de cancelamento já passou, e a Sefaz
          pode recusar. Se recusar, a nota continua válida: fale com o seu contador.
        </p>
      )}
      <div className="flex gap-4" style={{ flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-danger" onClick={cancelar} disabled={isPending || !justificativaOk}>
          {isPending ? 'Enviando à Sefaz…' : 'Confirmar cancelamento na Sefaz'}
        </button>
        <button type="button" className="btn btn-outline" onClick={() => { setAberto(false); setErro(null) }} disabled={isPending}>
          Voltar
        </button>
      </div>
      {erro && <p style={{ color: 'var(--accent-red)', fontSize: '0.85rem', marginTop: '0.75rem', whiteSpace: 'pre-wrap' }}>{erro}</p>}
    </div>
  )
}
