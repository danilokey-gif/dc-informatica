'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { ItemOriginal } from '@/lib/nfe/devolucao'
import { emitirDevolucao, type ResultadoDevolucao } from './actions'

const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function FormDevolucao({ tipo, origemId, itens, restantes, somenteTeste = false }: {
  tipo: 'compra' | 'venda'
  origemId: string
  itens: ItemOriginal[]
  restantes: Record<number, number>
  /** Nota de teste ou que não é da empresa: só o envio à homologação fica liberado. */
  somenteTeste?: boolean
}) {
  const router = useRouter()
  const [quantidades, setQuantidades] = useState<Record<number, number>>({})
  const [motivo, setMotivo] = useState('')
  const [ajustarEstoque, setAjustarEstoque] = useState(true)
  const [homologacaoMarcada, setHomologacao] = useState(true)
  const homologacao = somenteTeste || homologacaoMarcada
  const [enviando, iniciar] = useTransition()
  const [resultado, setResultado] = useState<ResultadoDevolucao | null>(null)

  const total = itens.reduce((s, i) => s + (quantidades[i.nItem] ?? 0) * i.valorUnitario, 0)
  const algum = Object.values(quantidades).some(q => q > 0)

  function emitir() {
    const aviso = homologacao
      ? 'Enviar a nota de devolução para a HOMOLOGAÇÃO (teste, sem valor fiscal)?'
      : `Emitir a nota de devolução REAL (produção) no valor de ${moeda(total)}?\n\nEla tem valor fiscal e só pode ser cancelada em até 24 horas.`
    if (!window.confirm(aviso)) return
    setResultado(null)
    iniciar(async () => {
      const r = await emitirDevolucao({
        tipo, origemId, motivo, ajustarEstoque, homologacao,
        itens: Object.entries(quantidades).map(([n, q]) => ({ nItem: Number(n), quantidade: q })),
      })
      setResultado(r)
      if (r.ok) router.refresh()
    })
  }

  return (
    <div style={{ marginTop: '1rem' }}>
      <div className="table-container">
        <table className="table">
          <thead>
            <tr><th>Item</th><th>Na nota</th><th>Pode devolver</th><th>Valor unit.</th><th style={{ width: 130 }}>Devolver</th></tr>
          </thead>
          <tbody>
            {itens.map(i => {
              const max = restantes[i.nItem] ?? i.quantidade
              return (
                <tr key={i.nItem}>
                  <td>{i.descricao}<div className="text-muted" style={{ fontSize: '0.75rem' }}>Cód. {i.codigo} · NCM {i.ncm}</div></td>
                  <td>{i.quantidade} {i.unidade}</td>
                  <td>{max}</td>
                  <td>{moeda(i.valorUnitario)}</td>
                  <td>
                    <input type="number" min={0} max={max} step="any" className="input-field" style={{ padding: '0.4rem 0.6rem' }}
                      disabled={max <= 0} value={quantidades[i.nItem] ?? ''} placeholder="0"
                      onChange={e => {
                        const v = Math.min(max, Math.max(0, Number(e.target.value) || 0))
                        setQuantidades(q => ({ ...q, [i.nItem]: v }))
                      }} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="input-group" style={{ marginTop: '1rem' }}>
        <label className="input-label" htmlFor="motivo">Motivo da devolução *</label>
        <input id="motivo" className="input-field" maxLength={200} value={motivo} onChange={e => setMotivo(e.target.value)}
          placeholder={tipo === 'compra' ? 'Ex.: produto com defeito de fábrica' : 'Ex.: cliente desistiu da compra'} />
      </div>

      <div className="flex gap-4" style={{ flexWrap: 'wrap', marginBottom: '1rem' }}>
        <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', cursor: 'pointer' }}>
          <input type="checkbox" checked={ajustarEstoque} onChange={e => setAjustarEstoque(e.target.checked)} />
          {tipo === 'compra' ? 'Tirar do estoque o que foi devolvido' : 'Voltar ao estoque o que o cliente devolveu'}
        </label>
        <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', cursor: 'pointer' }}>
          <input type="checkbox" checked={homologacao} disabled={somenteTeste} onChange={e => setHomologacao(e.target.checked)} />
          Testar na homologação (sem valor fiscal)
        </label>
      </div>

      <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <strong>Total da devolução: {moeda(total)}</strong>
        <button type="button" className="btn btn-primary" disabled={enviando || !algum || motivo.trim().length < 5} onClick={emitir}>
          {enviando ? 'Enviando à Sefaz…' : homologacao ? 'Testar nota de devolução' : 'Emitir nota de devolução'}
        </button>
      </div>
      {homologacao && <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>No teste o estoque não é alterado. {!somenteTeste && <> Desmarque &quot;Testar&quot; para emitir a nota real.</>}</p>}

      {resultado && (
        <div style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.9rem',
          background: resultado.ok ? 'var(--badge-success-bg)' : 'var(--badge-danger-bg)', color: resultado.ok ? 'var(--badge-success-text)' : 'var(--badge-danger-text)' }}>
          {resultado.ok ? '✅ ' : '❌ '}{resultado.mensagem}
          {resultado.ok && resultado.emissaoId && <> · <Link href={`/notas-fiscais/ver-danfe?id=${resultado.emissaoId}`} style={{ textDecoration: 'underline' }}>ver DANFE</Link></>}
        </div>
      )}
    </div>
  )
}
