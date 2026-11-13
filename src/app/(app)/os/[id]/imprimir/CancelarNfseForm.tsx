'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ResultadoCancelamentoNfse } from './nfse-actions'

/**
 * Cancelamento da NFS-e: mostra na tela o que o governo respondeu (inclusive a recusa), em vez de
 * quebrar a página. Só cancela depois de confirmar, porque o cancelamento é definitivo.
 */
export default function CancelarNfseForm({ action }: { action: (formData: FormData) => Promise<ResultadoCancelamentoNfse> }) {
  const router = useRouter()
  const [enviando, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!window.confirm('Cancelar esta NFS-e no governo?\n\nO cancelamento é definitivo: a nota deixa de valer e não dá para desfazer.')) return
    const dados = new FormData(e.currentTarget)
    setErro(null)
    setMensagem(null)
    iniciar(async () => {
      try {
        const r = await action(dados)
        if (r.ok) {
          setMensagem(r.mensagem || 'NFS-e cancelada.')
          router.refresh()
        } else {
          setErro(r.erro || 'O governo não cancelou a nota.')
        }
      } catch (e) {
        setErro(`Não foi possível concluir o cancelamento: ${e instanceof Error ? e.message : String(e)}`)
      }
    })
  }

  return (
    <form onSubmit={enviar} style={{ border: '1px solid #fecaca', borderRadius: '0.5rem', padding: '0.75rem', maxWidth: '360px' }}>
      <div className="input-group">
        <label className="input-label" htmlFor="cMotivo">Motivo do Cancelamento</label>
        <select id="cMotivo" name="cMotivo" className="input-field" defaultValue="9" disabled={enviando}>
          <option value="1">Erro na Emissão</option>
          <option value="2">Serviço não Prestado</option>
          <option value="9">Outros</option>
        </select>
      </div>
      <div className="input-group">
        <label className="input-label" htmlFor="xMotivo">Descreva o motivo (mínimo 15 letras) *</label>
        <textarea id="xMotivo" name="xMotivo" className="input-field" rows={2} required minLength={15} maxLength={255} disabled={enviando}
          placeholder="Ex: Nota emitida com o endereço do cliente incorreto" />
      </div>
      <button type="submit" className="btn btn-danger" disabled={enviando} style={{ backgroundColor: '#dc2626', color: 'white', width: '100%' }}>
        {enviando ? 'Enviando ao governo…' : '🚫 Cancelar NFS-e (envia ao governo)'}
      </button>
      {erro && <p style={{ color: '#b91c1c', fontSize: '0.85rem', marginTop: '0.75rem', whiteSpace: 'pre-wrap' }}>{erro}</p>}
      {mensagem && <p style={{ color: 'var(--accent-green)', fontSize: '0.85rem', marginTop: '0.75rem' }}>{mensagem}</p>}
    </form>
  )
}
