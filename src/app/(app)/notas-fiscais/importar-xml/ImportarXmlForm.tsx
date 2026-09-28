'use client'

import { useRef, useState, useTransition } from 'react'
import { importarXmls, type ResultadoArquivo } from './actions'

// Mesmo limite configurado em next.config (serverActions.bodySizeLimit). Checar aqui evita um erro
// genérico do servidor e já diz ao usuário o que fazer.
const LIMITE_BYTES = 4 * 1024 * 1024

const ESTILO_STATUS: Record<ResultadoArquivo['status'], { rotulo: string; classe: string }> = {
  importada: { rotulo: 'Importada', classe: 'badge-success' },
  atualizada: { rotulo: 'Atualizada', classe: 'badge-success' },
  'ja-existia': { rotulo: 'Já existia', classe: 'badge-neutral' },
  erro: { rotulo: 'Não importada', classe: 'badge-danger' },
}

export default function ImportarXmlForm() {
  const [isPending, startTransition] = useTransition()
  const [resultados, setResultados] = useState<ResultadoArquivo[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)
    setResultados(null)

    const arquivos = Array.from(inputRef.current?.files || [])
    if (arquivos.length === 0) {
      setErro('Selecione ao menos um arquivo .xml ou .zip.')
      return
    }
    const total = arquivos.reduce((soma, f) => soma + f.size, 0)
    if (total > LIMITE_BYTES) {
      setErro(`Os arquivos somam ${(total / 1024 / 1024).toFixed(1)} MB e o limite por envio é 4 MB. Compacte os XMLs em um .zip (fica bem menor) ou envie em partes.`)
      return
    }

    const formData = new FormData()
    for (const f of arquivos) formData.append('arquivos', f)

    startTransition(async () => {
      try {
        const r = await importarXmls(formData)
        if (r.erro) setErro(r.erro)
        setResultados(r.resultados)
        if (inputRef.current && !r.erro) inputRef.current.value = ''
      } catch (err) {
        setErro(err instanceof Error ? err.message : String(err))
      }
    })
  }

  const contagem = resultados?.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {})

  return (
    <div>
      <form onSubmit={enviar} className="flex gap-4" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="input-group" style={{ marginBottom: 0, flex: '1 1 320px' }}>
          <label className="input-label" htmlFor="arquivos">Arquivos XML ou .zip</label>
          <input ref={inputRef} type="file" id="arquivos" name="arquivos" accept=".xml,.zip" multiple className="input-field" disabled={isPending} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={isPending}>
          {isPending ? 'Importando…' : '📥 Importar'}
        </button>
      </form>

      {erro && <p style={{ color: 'var(--accent-red)', fontSize: '0.875rem', marginTop: '0.75rem', whiteSpace: 'pre-wrap' }}>{erro}</p>}

      {resultados && resultados.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <p style={{ fontSize: '0.9rem', marginBottom: '0.75rem' }}>
            <strong>{(contagem?.importada || 0) + (contagem?.atualizada || 0)}</strong> importada(s) ou atualizada(s),{' '}
            <strong>{contagem?.['ja-existia'] || 0}</strong> já existia(m),{' '}
            <strong style={{ color: contagem?.erro ? 'var(--accent-red)' : undefined }}>{contagem?.erro || 0}</strong> não importada(s).
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem' }}>Arquivo</th>
                  <th style={{ padding: '0.5rem' }}>Resultado</th>
                  <th style={{ padding: '0.5rem' }}>Detalhe</th>
                </tr>
              </thead>
              <tbody>
                {resultados.map((r, i) => (
                  <tr key={`${r.arquivo}-${i}`} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.5rem', wordBreak: 'break-all' }}>{r.arquivo}</td>
                    <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>
                      <span className={`badge ${ESTILO_STATUS[r.status].classe}`}>{ESTILO_STATUS[r.status].rotulo}</span>
                    </td>
                    <td style={{ padding: '0.5rem' }}>{r.detalhe}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
