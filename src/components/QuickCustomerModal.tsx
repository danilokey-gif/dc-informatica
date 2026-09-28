'use client'

import { useState } from 'react'

export interface QuickCustomerData {
  name: string
  document: string
  phone: string
}

interface Props {
  initialName: string
  onClose: () => void
  onSave: (data: QuickCustomerData) => Promise<void>
}

export default function QuickCustomerModal({ initialName, onClose, onSave }: Props) {
  const [name, setName] = useState(initialName)
  const [document, setDocument] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await onSave({ name, document, phone })
      onClose()
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar cliente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div className="card" style={{ width: '400px', maxWidth: '90%' }}>
        <h3 className="mb-4">Cadastrar Novo Cliente</h3>
        <form onSubmit={handleSave}>
          <div className="input-group">
            <label className="input-label">Nome Completo *</label>
            <input type="text" className="input-field" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="input-group">
            <label className="input-label">CPF / CNPJ</label>
            <input type="text" className="input-field" value={document} onChange={e => setDocument(e.target.value)} />
          </div>
          <div className="input-group">
            <label className="input-label">Telefone</label>
            <input type="text" className="input-field" value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <div className="flex gap-4" style={{ marginTop: '1.5rem', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
