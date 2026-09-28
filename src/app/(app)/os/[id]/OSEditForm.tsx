'use client'

import { useState } from 'react'
import SearchableSelect from '@/components/SearchableSelect'

interface Props {
  updateAction: (formData: FormData) => Promise<void>
  os: {
    id: string
    device: string
    issue: string
    technicalReport: string | null
    price: number | null
    status: string
    technicianId: string | null
    customerId: string
  }
  clientes: { value: string; label: string }[]
  tecnicos: { value: string; label: string }[]
}

export default function OSEditForm({ updateAction, os, clientes, tecnicos }: Props) {
  const [status, setStatus] = useState(os.status)

  return (
    <form action={updateAction}>
      <div className="input-group">
        <label className="input-label" htmlFor="customerId">Cliente *</label>
        <SearchableSelect
          id="customerId"
          name="customerId"
          required
          defaultValue={os.customerId}
          options={clientes}
        />
      </div>

      <div className="input-group">
        <label className="input-label" htmlFor="device">Aparelho / Marca / Modelo</label>
        <input type="text" id="device" name="device" className="input-field" defaultValue={os.device} placeholder="Deixe em branco para uma nota de serviço avulsa" />
      </div>

      <div className="input-group">
        <label className="input-label" htmlFor="issue">Defeito Relatado pelo Cliente *</label>
        <textarea id="issue" name="issue" className="input-field" rows={3} required defaultValue={os.issue}></textarea>
      </div>

      <div className="input-group">
        <label className="input-label" htmlFor="technicalReport">Laudo Técnico (Orçamento/Solução)</label>
        <textarea id="technicalReport" name="technicalReport" className="input-field" rows={4} defaultValue={os.technicalReport || ''}></textarea>
      </div>

      <div className="input-group">
        <label className="input-label" htmlFor="technicianId">Técnico Responsável</label>
        <SearchableSelect
          id="technicianId"
          name="technicianId"
          placeholder="Não atribuído"
          defaultValue={os.technicianId || ''}
          options={tecnicos}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: status === 'DELIVERED' ? '1fr 1fr 1fr' : '1fr 1fr', gap: '1rem' }}>
        <div className="input-group">
          <label className="input-label" htmlFor="price">Valor (R$)</label>
          <input type="number" step="0.01" id="price" name="price" className="input-field" defaultValue={os.price || ''} />
        </div>

        <div className="input-group">
          <label className="input-label" htmlFor="status">Status Atual</label>
          <select
            id="status"
            name="status"
            className="input-field"
            value={status}
            onChange={e => setStatus(e.target.value)}
          >
            <option value="BUDGET">Orçamento Pendente</option>
            <option value="APPROVED">Orçamento Aprovado</option>
            <option value="IN_PROGRESS">Em Andamento</option>
            <option value="COMPLETED">Concluído (Pronto para Entrega)</option>
            <option value="DELIVERED">Entregue / Finalizado</option>
          </select>
        </div>

        {status === 'DELIVERED' && (
          <div className="input-group">
            <label className="input-label" htmlFor="paymentMethod">Forma de Pagamento</label>
            <select id="paymentMethod" name="paymentMethod" className="input-field">
              <option value="Dinheiro">Dinheiro</option>
              <option value="PIX">PIX</option>
              <option value="Cartão de Crédito">Cartão de Crédito</option>
              <option value="Cartão de Débito">Cartão de Débito</option>
              <option value="Boleto">Boleto</option>
              <option value="Transferência">Transferência</option>
            </select>
          </div>
        )}
      </div>

      {status === 'DELIVERED' && (
        <p style={{ fontSize: '0.82rem', color: 'var(--accent-green)', marginTop: '0.5rem', background: 'rgba(34,197,94,0.08)', padding: '0.5rem 0.75rem', borderRadius: '6px' }}>
          ✅ Ao salvar como <strong>Entregue / Finalizado</strong>, o valor da OS será lançado automaticamente como <strong>RECEITA PAGA</strong> no Financeiro.
        </p>
      )}

      <div style={{ marginTop: '2rem' }}>
        <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
          Atualizar Ordem de Serviço
        </button>
      </div>
    </form>
  )
}
