'use client'

import { useState } from 'react'
import { createOS } from '../actions'
import { createCustomerQuick } from '../../clientes/actions'
import SearchableSelect from '@/components/SearchableSelect'
import QuickCustomerModal, { QuickCustomerData } from '@/components/QuickCustomerModal'

interface Cliente {
  id: string
  name: string
  document?: string | null
}

interface Tecnico {
  id: string
  name: string
}

export default function OSForm({ clientes, tecnicos }: { clientes: Cliente[], tecnicos: Tecnico[] }) {
  const [localClientes, setLocalClientes] = useState<Cliente[]>(clientes)
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState('')

  async function handleSaveNewCustomer(data: QuickCustomerData) {
    const newCustomer = await createCustomerQuick(data)
    setLocalClientes([...localClientes, newCustomer])
    setSelectedCustomerId(newCustomer.id)
  }

  return (
    <form action={createOS}>
      <div className="input-group">
        <label className="input-label" htmlFor="customerId">Cliente *</label>
        <SearchableSelect
          id="customerId"
          name="customerId"
          value={selectedCustomerId}
          onValueChange={setSelectedCustomerId}
          required
          placeholder="Digite o nome do cliente..."
          options={localClientes.map(c => ({ 
            value: c.id, 
            label: c.document ? `${c.name} (${c.document})` : c.name 
          }))}
          onCreateNew={(name) => {
            setNewCustomerName(name)
            setShowCustomerModal(true)
          }}
        />
      </div>

      <div className="input-group">
        <label className="input-label" htmlFor="device">Aparelho / Marca / Modelo *</label>
        <input type="text" id="device" name="device" className="input-field" required />
      </div>

      <div className="input-group">
        <label className="input-label" htmlFor="issue">Defeito Relatado pelo Cliente *</label>
        <textarea id="issue" name="issue" className="input-field" rows={4} required></textarea>
      </div>

      <div className="input-group">
        <label className="input-label" htmlFor="technicianId">Técnico Responsável</label>
        <SearchableSelect
          id="technicianId"
          name="technicianId"
          placeholder="Não atribuído"
          options={tecnicos.map(t => ({ value: t.id, label: t.name }))}
        />
      </div>

      <div className="input-group">
        <label className="input-label" htmlFor="status">Status Inicial</label>
        <select id="status" name="status" className="input-field" defaultValue="BUDGET">
          <option value="BUDGET">Orçamento Pendente</option>
          <option value="APPROVED">Orçamento Aprovado</option>
          <option value="IN_PROGRESS">Em Andamento</option>
        </select>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
          Criar Ordem de Serviço
        </button>
      </div>

      {showCustomerModal && (
        <QuickCustomerModal
          initialName={newCustomerName}
          onClose={() => setShowCustomerModal(false)}
          onSave={handleSaveNewCustomer}
        />
      )}
    </form>
  )
}
