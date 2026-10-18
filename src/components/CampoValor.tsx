'use client'

import { useState } from 'react'

/** "1.234,5" / "1234.50" / "360" → 1234.5 / 1234.5 / 360 (NaN se não for número). */
function lerValor(texto: string): number {
  const t = texto.replace(/[R$\s]/g, '')
  if (!t) return NaN
  // Com vírgula, o ponto é separador de milhar (padrão brasileiro).
  return Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t)
}
const formatar = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * Campo de dinheiro no padrão brasileiro: aceita "360", "360,5" ou "1.234,56" e, ao sair do campo,
 * mostra sempre com duas casas ("360,00"). O formulário recebe o número com ponto ("360.00").
 */
export default function CampoValor({ id, name, defaultValue, required, min = 0, placeholder = '0,00', onValor }: {
  id: string
  name: string
  defaultValue?: number | null
  required?: boolean
  min?: number
  placeholder?: string
  onValor?: (valor: number | null) => void
}) {
  const [texto, setTexto] = useState(defaultValue != null && !Number.isNaN(defaultValue) ? formatar(defaultValue) : '')
  const valor = lerValor(texto)
  const valido = !Number.isNaN(valor) && valor >= min

  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}>R$</span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className="input-field"
        style={{ paddingLeft: '2.4rem' }}
        placeholder={placeholder}
        value={texto}
        required={required}
        onChange={e => {
          const t = e.target.value.replace(/[^\d.,]/g, '')
          setTexto(t)
          const v = lerValor(t)
          onValor?.(Number.isNaN(v) ? null : v)
        }}
        onBlur={() => { if (valido) setTexto(formatar(valor)) }}
        onInvalid={e => (e.target as HTMLInputElement).setCustomValidity(texto && !valido ? 'Digite um valor válido, ex.: 360,00' : '')}
        onInput={e => (e.target as HTMLInputElement).setCustomValidity('')}
        pattern={required ? '[\\d.,]*\\d[\\d.,]*' : undefined}
      />
      <input type="hidden" name={name} value={valido ? valor.toFixed(2) : ''} />
    </div>
  )
}
