'use client'

import { useFormStatus } from 'react-dom'

function Botao({ rotulo, rotuloPendente, className, style }: { rotulo: string; rotuloPendente: string; className?: string; style?: React.CSSProperties }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className={className} style={style} disabled={pending}>
      {pending ? rotuloPendente : rotulo}
    </button>
  )
}

/** Formulário de um botão só, que pede confirmação antes de chamar a ação no servidor. */
export default function BotaoConfirmar({ acao, confirmacao, rotulo, rotuloPendente = 'Aguarde…', className = 'btn btn-outline', style }: {
  acao: () => Promise<void>
  confirmacao: string
  rotulo: string
  rotuloPendente?: string
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <form action={acao} onSubmit={e => { if (!window.confirm(confirmacao)) e.preventDefault() }}>
      <Botao rotulo={rotulo} rotuloPendente={rotuloPendente} className={className} style={style} />
    </form>
  )
}
