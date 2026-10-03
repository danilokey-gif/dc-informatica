'use client'

import { useState } from 'react'
import CampoCep from './CampoCep'
import type { EnderecoCep } from '@/lib/cep'

export interface QuickCustomerData {
  name: string
  document: string
  phone: string
  /** Endereço (opcional). Completo, ele já deixa o cliente pronto para NF-e e NFS-e. */
  enderCep?: string
  enderLogradouro?: string
  enderNumero?: string
  enderBairro?: string
  enderMunicipio?: string
  enderUf?: string
  enderCodMunicipio?: string
}

interface Props {
  initialName: string
  onClose: () => void
  onSave: (data: QuickCustomerData) => Promise<void>
}

export default function QuickCustomerModal({ initialName, onClose, onSave }: Props) {
  const [name, setName] = useState(initialName)
  const [documento, setDocumento] = useState('')
  const [phone, setPhone] = useState('')
  const [cep, setCep] = useState('')
  const [logradouro, setLogradouro] = useState('')
  const [numero, setNumero] = useState('')
  const [bairro, setBairro] = useState('')
  const [cidade, setCidade] = useState<{ municipio: string; uf: string; codigoIbge: string | null } | null>(null)
  const [loading, setLoading] = useState(false)

  function aoEncontrarCep(e: EnderecoCep) {
    setLogradouro(e.logradouro)
    setBairro(e.bairro)
    setCidade({ municipio: e.municipio, uf: e.uf, codigoIbge: e.codigoIbge })
    document.getElementById(e.logradouro ? 'quick-numero' : 'quick-logradouro')?.focus()
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await onSave({
        name,
        document: documento,
        phone,
        enderCep: cep || undefined,
        enderLogradouro: logradouro.trim() || undefined,
        enderNumero: numero.trim() || undefined,
        enderBairro: bairro.trim() || undefined,
        enderMunicipio: cidade?.municipio || undefined,
        enderUf: cidade?.uf || undefined,
        enderCodMunicipio: cidade?.codigoIbge || undefined,
      })
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
      <div className="card" style={{ width: '440px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 className="mb-4">Cadastrar Novo Cliente</h3>
        <form onSubmit={handleSave}>
          <div className="input-group">
            <label className="input-label">Nome Completo *</label>
            <input type="text" className="input-field" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="input-group">
            <label className="input-label">CPF / CNPJ</label>
            <input type="text" className="input-field" value={documento} onChange={e => setDocumento(e.target.value)} />
          </div>
          <div className="input-group">
            <label className="input-label">Telefone</label>
            <input type="text" className="input-field" value={phone} onChange={e => setPhone(e.target.value)} />
          </div>

          <p className="text-muted" style={{ fontSize: '0.8rem', margin: '1rem 0 0.5rem' }}>
            Endereço (opcional — necessário para nota fiscal)
          </p>
          <div className="input-group">
            <CampoCep id="quick-cep" name="quick-cep" onEndereco={aoEncontrarCep} onDigitos={setCep} />
          </div>
          <div className="input-group">
            <label className="input-label" htmlFor="quick-logradouro">Logradouro</label>
            <input id="quick-logradouro" type="text" className="input-field" value={logradouro} onChange={e => setLogradouro(e.target.value)} />
          </div>
          <div className="flex gap-4">
            <div className="input-group" style={{ flex: 1 }}>
              <label className="input-label" htmlFor="quick-numero">Número</label>
              <input id="quick-numero" type="text" className="input-field" value={numero} onChange={e => setNumero(e.target.value)} />
            </div>
            <div className="input-group" style={{ flex: 2 }}>
              <label className="input-label" htmlFor="quick-bairro">Bairro</label>
              <input id="quick-bairro" type="text" className="input-field" value={bairro} onChange={e => setBairro(e.target.value)} />
            </div>
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
