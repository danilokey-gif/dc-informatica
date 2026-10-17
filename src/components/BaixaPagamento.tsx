'use client'

import { useState } from 'react'

const FORMAS = ['Pix', 'Boleto', 'Dinheiro', 'Cartão de Débito', 'Cartão de Crédito', 'Transferência']

/**
 * Botão "Receber" / "Pagar" de um lançamento: abre um mini formulário com a data do pagamento
 * (hoje por padrão) e a forma, e confirma a baixa.
 */
export default function BaixaPagamento({ action, tipo, formaAtual }: {
  action: (formData: FormData) => void | Promise<void>
  tipo: string
  formaAtual?: string | null
}) {
  const [aberto, setAberto] = useState(false)
  const rotulo = tipo === 'DESPESA' ? 'Pagar' : 'Receber'
  // "Boleto (3x)" → "Boleto"
  const forma = (formaAtual || '').replace(/\s*\(\d+x\)$/, '')
  const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })

  if (!aberto) {
    return (
      <button type="button" className="btn btn-primary" style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }} onClick={() => setAberto(true)}>
        ✓ {rotulo}
      </button>
    )
  }

  return (
    <form action={action} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <input type="date" name="paidDate" defaultValue={hoje} max={hoje} className="input-field" style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', width: 'auto' }} required title={tipo === 'DESPESA' ? 'Data do pagamento' : 'Data do recebimento'} />
      <select name="paymentMethod" defaultValue={FORMAS.includes(forma) ? forma : 'Pix'} className="input-field" style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', width: 'auto' }}>
        {FORMAS.map(f => <option key={f} value={f}>{f}</option>)}
      </select>
      <button type="submit" className="btn btn-primary" style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}>Confirmar</button>
      <button type="button" className="btn btn-outline" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={() => setAberto(false)}>Cancelar</button>
    </form>
  )
}
