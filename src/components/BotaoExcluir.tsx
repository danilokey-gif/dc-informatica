'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Botão "Excluir" com confirmação. A ação devolve { erro } quando a exclusão não é permitida
 * (ex.: cliente com histórico, OS com nota fiscal), e a mensagem aparece para o usuário.
 */
export default function BotaoExcluir({ action, confirmar, depois, rotulo = 'Excluir', estilo = 'link' }: {
  action: () => Promise<{ ok?: boolean; erro?: string }>
  confirmar: string
  /** Para onde ir depois de excluir (ex.: a lista). Sem isso, só recarrega a tela. */
  depois?: string
  rotulo?: string
  estilo?: 'link' | 'botao'
}) {
  const router = useRouter()
  const [ocupado, setOcupado] = useState(false)

  async function excluir() {
    if (!window.confirm(confirmar)) return
    setOcupado(true)
    try {
      const r = await action()
      if (r?.erro) { window.alert(r.erro); return }
      if (depois) router.push(depois)
      else router.refresh()
    } finally {
      setOcupado(false)
    }
  }

  const css: React.CSSProperties = estilo === 'botao'
    ? { borderColor: 'var(--accent-red)', color: 'var(--accent-red)' }
    : { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 500, padding: 0 }
  return (
    <button type="button" onClick={excluir} disabled={ocupado} className={estilo === 'botao' ? 'btn btn-outline' : undefined} style={css}>
      {ocupado ? 'Excluindo…' : estilo === 'botao' ? `🗑 ${rotulo}` : rotulo}
    </button>
  )
}
