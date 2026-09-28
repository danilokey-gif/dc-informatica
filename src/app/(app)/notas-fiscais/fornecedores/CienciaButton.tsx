'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { darCiencia } from './actions'

// Limite do schema da Sefaz por lote de eventos; notas a mais vão em lotes seguidos.
const POR_LOTE = 20

const CONFIRMACAO =
  'A Ciência da Operação é um registro oficial na Sefaz, em nome do CNPJ da empresa, dizendo que ' +
  'ela sabe desta nota. Ela NÃO confirma nem recusa a compra. Depois dela, a Sefaz libera o XML ' +
  'completo na próxima busca de notas de compra.\n\nContinuar?'

export default function CienciaButton({ ids, rotulo, compacto = false }: { ids: string[]; rotulo: string; compacto?: boolean }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  function dar() {
    if (!window.confirm(ids.length > 1 ? `Dar ciência em ${ids.length} notas.\n\n${CONFIRMACAO}` : CONFIRMACAO)) return
    setMensagem(null)
    setErro(null)

    startTransition(async () => {
      let registradas = 0
      const falhas: string[] = []
      try {
        for (let i = 0; i < ids.length; i += POR_LOTE) {
          const r = await darCiencia(ids.slice(i, i + POR_LOTE))
          registradas += r.registradas
          for (const f of r.falhas) falhas.push(`${f.nota}: ${f.motivo}`)
          if (r.erro) {
            falhas.push(r.erro)
            break
          }
        }
      } catch (e) {
        falhas.push(e instanceof Error ? e.message : String(e))
      }
      if (registradas) setMensagem(`Ciência registrada em ${registradas} nota(s). O XML completo chega na próxima busca de notas de compra.`)
      if (falhas.length) setErro(falhas.join('\n'))
      router.refresh()
    })
  }

  return (
    <div>
      <button
        type="button"
        onClick={dar}
        disabled={isPending || ids.length === 0}
        className={compacto ? undefined : 'btn btn-outline'}
        style={compacto
          ? { background: 'none', border: 'none', padding: 0, color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline', font: 'inherit' }
          : undefined}
      >
        {isPending ? 'Registrando…' : rotulo}
      </button>
      {mensagem && <p style={{ color: 'var(--accent-green)', fontSize: '0.8rem', marginTop: '0.35rem' }}>{mensagem}</p>}
      {erro && <p style={{ color: 'var(--accent-red)', fontSize: '0.8rem', marginTop: '0.35rem', whiteSpace: 'pre-wrap' }}>{erro}</p>}
    </div>
  )
}
