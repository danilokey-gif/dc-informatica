'use client'

import { useState } from 'react'

const FORMAS = ['Boleto', 'Pix', 'Dinheiro', 'Cartão de Débito', 'Cartão de Crédito', 'Transferência']

/**
 * Botão "Vencimento" de uma conta em aberto: troca a data de vencimento (aceita data futura, ex.: o
 * dia do boleto) e, se quiser, a forma de pagamento. Não dá baixa: para isso é o botão "Receber".
 */
export default function AlterarVencimento({ action, vencimento, formaAtual }: {
  action: (formData: FormData) => void | Promise<void>
  /** Vencimento atual (AAAA-MM-DD). */
  vencimento: string
  formaAtual?: string | null
}) {
  const [aberto, setAberto] = useState(false)
  const forma = (formaAtual || '').replace(/\s*\(\d+x\)$/, '')

  if (!aberto) {
    return (
      <button type="button" className="btn btn-outline" style={{ padding: '0.3rem 0.7rem', fontSize: '0.8rem' }} onClick={() => setAberto(true)} title="Mudar a data de vencimento (ex.: dia do boleto)">
        📅 Vencimento
      </button>
    )
  }

  return (
    <form action={action} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <input type="date" name="dueDate" defaultValue={vencimento} className="input-field" required title="Data de vencimento"
        style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', width: 'auto' }} />
      <select name="paymentMethod" defaultValue="" className="input-field" title="Forma de pagamento combinada" style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', width: 'auto' }}>
        <option value="">{forma && FORMAS.includes(forma) ? `Manter (${forma})` : 'Forma: manter'}</option>
        {FORMAS.map(f => <option key={f} value={f}>{f}</option>)}
      </select>
      <button type="submit" className="btn btn-primary" style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}>Salvar</button>
      <button type="button" className="btn btn-outline" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={() => setAberto(false)}>Cancelar</button>
    </form>
  )
}
