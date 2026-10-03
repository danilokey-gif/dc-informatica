'use client'

import { useState } from 'react'
import CampoCep from './CampoCep'
import type { EnderecoCep } from '@/lib/cep'

interface CustomerFormProps {
  action: (formData: FormData) => void
  defaultValues?: {
    name?: string
    document?: string | null
    phone?: string | null
    email?: string | null
    address?: string | null
    enderLogradouro?: string | null
    enderNumero?: string | null
    enderBairro?: string | null
    enderCep?: string | null
    enderMunicipio?: string | null
    enderUf?: string | null
    enderCodMunicipio?: string | null
  }
  submitLabel: string
}

function validarCPF(cpf: string) {
  const clean = cpf.replace(/\D/g, '')
  if (clean.length !== 11 || /^(\d)\1+$/.test(clean)) return false
  
  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(clean[i]) * (10 - i)
  let rest = (sum * 10) % 11
  if (rest === 10 || rest === 11) rest = 0
  if (rest !== parseInt(clean[9])) return false
  
  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(clean[i]) * (11 - i)
  rest = (sum * 10) % 11
  if (rest === 10 || rest === 11) rest = 0
  if (rest !== parseInt(clean[10])) return false
  
  return true
}

function validarCNPJ(cnpj: string) {
  const clean = cnpj.replace(/\D/g, '')
  if (clean.length !== 14 || /^(\d)\1+$/.test(clean)) return false
  
  let length = clean.length - 2
  let numbers = clean.substring(0, length)
  const digits = clean.substring(length)
  let sum = 0
  let pos = length - 7
  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbers.charAt(length - i)) * pos--
    if (pos < 2) pos = 9
  }
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (result !== parseInt(digits.charAt(0))) return false
  
  length = length + 1
  numbers = clean.substring(0, length)
  sum = 0
  pos = length - 7
  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbers.charAt(length - i)) * pos--
    if (pos < 2) pos = 9
  }
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (result !== parseInt(digits.charAt(1))) return false
  
  return true
}

export default function CustomerForm({ action, defaultValues = {}, submitLabel }: CustomerFormProps) {
  const [doc, setDoc] = useState(defaultValues.document || '')
  const [phone, setPhone] = useState(defaultValues.phone || '')
  const [docError, setDocError] = useState('')
  
  const [logradouro, setLogradouro] = useState(defaultValues.enderLogradouro || '')
  const [bairro, setBairro] = useState(defaultValues.enderBairro || '')
  const [municipio, setMunicipio] = useState(defaultValues.enderMunicipio || '')
  const [uf, setUf] = useState(defaultValues.enderUf || '')
  const [codMunicipio, setCodMunicipio] = useState(defaultValues.enderCodMunicipio || '')

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value
    const cleaned = rawValue.replace(/\D/g, '')
    let formatted = cleaned
    if (cleaned.length > 0) {
      if (cleaned.length <= 10) {
        // Fixo: (XX) XXXX-XXXX
        formatted = cleaned.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3')
      } else {
        // Celular: (XX) XXXXX-XXXX
        formatted = cleaned.replace(/^(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3')
      }
    }
    setPhone(formatted.slice(0, 15))
  }

  const handleDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value
    const cleaned = rawValue.replace(/\D/g, '')
    let formatted = cleaned
    if (cleaned.length > 0) {
      if (cleaned.length <= 11) {
        // CPF: XXX.XXX.XXX-XX
        formatted = cleaned
          .replace(/^(\d{3})(\d)/, '$1.$2')
          .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
          .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
      } else {
        // CNPJ: XX.XXX.XXX/XXXX-XX
        formatted = cleaned
          .replace(/^(\d{2})(\d)/, '$1.$2')
          .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
          .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
          .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, '$1.$2.$3/$4-$5')
      }
    }
    setDoc(formatted.slice(0, 18))
    setDocError('')
  }

  const aoEncontrarCep = (e: EnderecoCep) => {
    setLogradouro(e.logradouro)
    setBairro(e.bairro)
    setMunicipio(e.municipio)
    setUf(e.uf)
    setCodMunicipio(e.codigoIbge || '')
    const enderecoCompleto = document.getElementById('address') as HTMLInputElement | null
    if (enderecoCompleto && !enderecoCompleto.value) {
      enderecoCompleto.value = [e.logradouro, e.bairro].filter(Boolean).join(', ') + ` - ${e.municipio}/${e.uf}`
    }
    // Rua e bairro já vieram: o próximo campo a preencher é o número.
    document.getElementById(e.logradouro ? 'enderNumero' : 'enderLogradouro')?.focus()
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const cleanDoc = doc.replace(/\D/g, '')
    if (cleanDoc.length > 0) {
      if (cleanDoc.length <= 11) {
        if (!validarCPF(cleanDoc)) {
          e.preventDefault()
          setDocError('CPF inválido. Verifique os dígitos.')
          return
        }
      } else {
        if (!validarCNPJ(cleanDoc)) {
          e.preventDefault()
          setDocError('CNPJ inválido. Verifique os dígitos.')
          return
        }
      }
    }
  }

  return (
    <form action={action} onSubmit={handleSubmit}>
      <div className="input-group">
        <label className="input-label" htmlFor="name">Nome Completo *</label>
        <input type="text" id="name" name="name" className="input-field" required defaultValue={defaultValues.name || ''} />
      </div>

      <div className="input-group">
        <label className="input-label" htmlFor="document">CPF/CNPJ</label>
        <input 
          type="text" 
          id="document" 
          name="document" 
          className="input-field" 
          value={doc} 
          onChange={handleDocChange}
          placeholder="Ex: 000.000.000-00 ou 00.000.000/0000-00"
        />
        {docError && <p style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.25rem', fontWeight: 600 }}>{docError}</p>}
      </div>

      <div className="input-group">
        <label className="input-label" htmlFor="phone">Telefone / WhatsApp</label>
        <input 
          type="text" 
          id="phone" 
          name="phone" 
          className="input-field" 
          value={phone} 
          onChange={handlePhoneChange}
          placeholder="Ex: (11) 99999-9999"
        />
      </div>

      <div className="input-group">
        <label className="input-label" htmlFor="email">E-mail</label>
        <input type="email" id="email" name="email" className="input-field" defaultValue={defaultValues.email || ''} />
      </div>

      <div className="input-group">
        <label className="input-label" htmlFor="address">Endereço Completo</label>
        <input type="text" id="address" name="address" className="input-field" defaultValue={defaultValues.address || ''} />
      </div>

      <h3 style={{ marginTop: '1.5rem', fontSize: '0.95rem' }}>
        Endereço estruturado (necessário para emitir NF-e de produto)
      </h3>
      
      <div className="input-group">
        <CampoCep defaultValue={defaultValues.enderCep} onEndereco={aoEncontrarCep} label="CEP (preenche o endereço sozinho)" />
      </div>

      <div className="input-group">
        <label className="input-label" htmlFor="enderLogradouro">Logradouro</label>
        <input 
          type="text" 
          id="enderLogradouro" 
          name="enderLogradouro" 
          className="input-field" 
          placeholder="Rua/Av." 
          value={logradouro}
          onChange={(e) => setLogradouro(e.target.value)}
        />
      </div>

      <div className="input-group">
        <label className="input-label" htmlFor="enderNumero">Número</label>
        <input type="text" id="enderNumero" name="enderNumero" className="input-field" defaultValue={defaultValues.enderNumero || ''} />
      </div>

      <div className="input-group">
        <label className="input-label" htmlFor="enderBairro">Bairro</label>
        <input 
          type="text" 
          id="enderBairro" 
          name="enderBairro" 
          className="input-field" 
          value={bairro}
          onChange={(e) => setBairro(e.target.value)}
        />
      </div>

      <div className="input-group">
        <label className="input-label" htmlFor="enderMunicipio">Município</label>
        <input 
          type="text" 
          id="enderMunicipio" 
          name="enderMunicipio" 
          className="input-field" 
          value={municipio}
          onChange={(e) => setMunicipio(e.target.value)}
        />
      </div>

      <div className="input-group">
        <label className="input-label" htmlFor="enderUf">UF</label>
        <input 
          type="text" 
          id="enderUf" 
          name="enderUf" 
          className="input-field" 
          maxLength={2} 
          placeholder="SP" 
          value={uf}
          onChange={(e) => setUf(e.target.value)}
        />
      </div>

      <div className="input-group">
        <label className="input-label" htmlFor="enderCodMunicipio">Código IBGE do Município</label>
        <input 
          type="text" 
          id="enderCodMunicipio" 
          name="enderCodMunicipio" 
          className="input-field" 
          placeholder="Ex: 3529005" 
          value={codMunicipio}
          onChange={(e) => setCodMunicipio(e.target.value)}
        />
      </div>

      <div style={{ marginTop: '2rem' }}>
        <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
