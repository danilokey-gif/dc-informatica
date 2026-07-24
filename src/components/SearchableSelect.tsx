'use client'

import { useEffect, useRef, useState } from 'react'

export interface SearchableOption {
  value: string
  label: string
}

interface Props {
  id: string
  name?: string
  options: SearchableOption[]
  defaultValue?: string
  placeholder?: string
  required?: boolean
  /** Modo controlado (ex: usado dentro de outro state, sem name/hidden input de formulário). */
  value?: string
  onValueChange?: (value: string) => void
}

export default function SearchableSelect({
  id,
  name,
  options,
  defaultValue,
  placeholder,
  required,
  value: valorControlado,
  onValueChange,
}: Props) {
  const controlado = valorControlado !== undefined
  const inicial = options.find(o => o.value === (controlado ? valorControlado : defaultValue))
  const [texto, setTexto] = useState(inicial?.label || '')
  const [valorInterno, setValorInterno] = useState(defaultValue || '')
  const [aberto, setAberto] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const valorAtual = controlado ? valorControlado! : valorInterno

  // Mantém o texto exibido em sincronia quando o valor controlado é resetado de fora (ex: após adicionar ao carrinho)
  useEffect(() => {
    if (controlado) {
      const opt = options.find(o => o.value === valorControlado)
      setTexto(opt?.label || '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valorControlado])

  const filtradas = texto && texto !== options.find(o => o.value === valorAtual)?.label
    ? options.filter(o => o.label.toLowerCase().includes(texto.toLowerCase()))
    : options

  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false)
        const match = options.find(o => o.label === texto)
        if (!match) {
          setTexto('')
          if (controlado) onValueChange?.('')
          else setValorInterno('')
        }
      }
    }
    document.addEventListener('mousedown', aoClicarFora)
    return () => document.removeEventListener('mousedown', aoClicarFora)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto, options])

  function selecionar(opt: SearchableOption) {
    setTexto(opt.label)
    if (controlado) onValueChange?.(opt.value)
    else setValorInterno(opt.value)
    setAberto(false)
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        type="text"
        id={id}
        className="input-field"
        value={texto}
        placeholder={placeholder || 'Digite para buscar...'}
        autoComplete="off"
        required={required}
        onChange={e => {
          setTexto(e.target.value)
          if (controlado) onValueChange?.('')
          else setValorInterno('')
          setAberto(true)
        }}
        onFocus={() => setAberto(true)}
      />
      {!controlado && <input type="hidden" name={name} value={valorInterno} />}
      {aberto && filtradas.length > 0 && (
        <div className="searchable-select-menu">
          {filtradas.map(opt => (
            <div
              key={opt.value}
              className="searchable-select-option"
              onMouseDown={e => e.preventDefault()}
              onClick={() => selecionar(opt)}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
      {aberto && filtradas.length === 0 && (
        <div className="searchable-select-menu">
          <div className="searchable-select-option text-muted" style={{ cursor: 'default' }}>Nenhum resultado</div>
        </div>
      )}
    </div>
  )
}
