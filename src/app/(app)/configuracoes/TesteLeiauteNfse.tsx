'use client'

import { useState, useTransition } from 'react'
import { testarLeiauteNovoHomologacao } from './teste-nfse-actions'

/** Botão que testa o leiaute novo (NT 009) na homologação da NFS-e, sem valor fiscal. */
export default function TesteLeiauteNfse() {
  const [enviando, iniciar] = useTransition()
  const [resultado, setResultado] = useState<{ ok: boolean; mensagem: string } | null>(null)
  const [documento, setDocumento] = useState('')

  return (
    <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
      <p style={{ fontWeight: 600, margin: '0 0 0.25rem' }}>Testar o leiaute novo (IBS/CBS)</p>
      <p className="text-muted" style={{ fontSize: '0.8rem', margin: '0 0 0.75rem' }}>
        Envia uma nota de R$ 1,00 para a <strong>homologação</strong> do governo (ambiente de testes, sem valor fiscal),
        para o CPF ou CNPJ que você digitar abaixo (precisa ser diferente do CNPJ da empresa, ex.: seu CPF pessoal).
        Não usa a numeração das notas reais.
      </p>
      <input className="input-field" style={{ maxWidth: 260, marginBottom: '0.6rem' }} inputMode="numeric" autoComplete="off"
        placeholder="CPF ou CNPJ do cliente de teste" value={documento} onChange={e => setDocumento(e.target.value)} />
      <br />
      <button type="button" className="btn btn-outline" disabled={enviando}
        onClick={() => { setResultado(null); iniciar(async () => setResultado(await testarLeiauteNovoHomologacao(documento))) }}>
        {enviando ? 'Enviando teste…' : 'Testar na homologação'}
      </button>
      {resultado && (
        <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.875rem',
          background: resultado.ok ? 'var(--badge-success-bg)' : 'var(--badge-danger-bg)', color: resultado.ok ? 'var(--badge-success-text)' : 'var(--badge-danger-text)' }}>
          {resultado.ok ? '✅ ' : '❌ '}{resultado.mensagem}
        </div>
      )}
    </div>
  )
}
