'use client'

import { useRef, useState } from 'react'
import type { EnderecoCep } from '@/lib/cep'

export type { EnderecoCep }

/** ids dos campos que o CEP deve preencher, para formulários que não usam estado do React. */
interface CamposPorId {
  logradouro?: string
  bairro?: string
  municipio?: string
  uf?: string
  codigoIbge?: string
  /** Campo que recebe o foco depois de preencher (normalmente o número). */
  focar?: string
}

const mascara = (digitos: string) => (digitos.length > 5 ? `${digitos.slice(0, 5)}-${digitos.slice(5, 8)}` : digitos)

function preencher(id: string | undefined, valor: string | null) {
  if (!id) return
  const campo = document.getElementById(id) as HTMLInputElement | null
  if (campo && valor !== null) campo.value = valor
}

/**
 * Campo de CEP que completa o endereço sozinho: com 8 dígitos, consulta o CEP (ViaCEP, com a
 * BrasilAPI de reserva) e preenche logradouro, bairro, município, UF e código IBGE.
 * Aceita colar o CEP com ou sem hífen. O valor enviado no formulário vai só com os dígitos.
 */
export default function CampoCep({ id = 'enderCep', name = 'enderCep', defaultValue, onEndereco, onDigitos, preencherCampos, label = 'CEP' }: {
  id?: string
  name?: string
  defaultValue?: string | null
  /** Para formulários com estado no React. */
  onEndereco?: (endereco: EnderecoCep) => void
  /** Recebe o CEP digitado (só dígitos), para formulários que não usam o envio padrão. */
  onDigitos?: (digitos: string) => void
  /** Para formulários sem estado (preenche os campos pelo id). */
  preencherCampos?: CamposPorId
  label?: string
}) {
  const [digitos, setDigitos] = useState((defaultValue || '').replace(/\D/g, '').slice(0, 8))
  const [situacao, setSituacao] = useState<{ tipo: 'buscando' | 'ok' | 'erro'; texto: string } | null>(null)
  const ultimaBusca = useRef('')

  async function buscar(cep: string) {
    if (ultimaBusca.current === cep) return
    ultimaBusca.current = cep
    setSituacao({ tipo: 'buscando', texto: 'Buscando endereço…' })
    try {
      const r = await fetch(`/cep/${cep}`)
      const dados = await r.json()
      if (!r.ok) {
        setSituacao({ tipo: 'erro', texto: dados.erro || 'Não consegui consultar o CEP.' })
        return
      }
      const endereco = dados as EnderecoCep
      onEndereco?.(endereco)
      if (preencherCampos) {
        preencher(preencherCampos.logradouro, endereco.logradouro)
        preencher(preencherCampos.bairro, endereco.bairro)
        preencher(preencherCampos.municipio, endereco.municipio)
        preencher(preencherCampos.uf, endereco.uf)
        preencher(preencherCampos.codigoIbge, endereco.codigoIbge)
        if (preencherCampos.focar) document.getElementById(preencherCampos.focar)?.focus()
      }
      // CEP de cidade pequena (CEP único) não tem rua nem bairro: o usuário completa à mão.
      setSituacao({
        tipo: 'ok',
        texto: endereco.logradouro
          ? `${endereco.municipio} / ${endereco.uf}`
          : `${endereco.municipio} / ${endereco.uf} — CEP geral da cidade: preencha rua e bairro.`,
      })
    } catch {
      setSituacao({ tipo: 'erro', texto: 'Não consegui consultar o CEP. Preencha o endereço à mão.' })
    }
  }

  function aoMudar(e: React.ChangeEvent<HTMLInputElement>) {
    const novos = e.target.value.replace(/\D/g, '').slice(0, 8)
    setDigitos(novos)
    onDigitos?.(novos)
    if (novos.length === 8) buscar(novos)
    else {
      ultimaBusca.current = ''
      setSituacao(null)
    }
  }

  const cor = situacao?.tipo === 'erro' ? 'var(--accent-red)' : situacao?.tipo === 'ok' ? 'var(--accent-green)' : 'var(--text-muted)'

  return (
    <>
      <label className="input-label" htmlFor={id}>{label}</label>
      <input
        type="text"
        id={id}
        inputMode="numeric"
        autoComplete="postal-code"
        className="input-field"
        placeholder="00000-000"
        value={mascara(digitos)}
        onChange={aoMudar}
        maxLength={10}
      />
      {/* O formulário recebe só os dígitos, como o resto do sistema espera. */}
      <input type="hidden" name={name} value={digitos} />
      {situacao && <p style={{ fontSize: '0.78rem', marginTop: '0.25rem', color: cor }}>{situacao.texto}</p>}
    </>
  )
}
