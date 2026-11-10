'use client'

import { useFormStatus } from 'react-dom'

export default function BotaoBackup() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? 'Fazendo backup…' : 'Fazer backup agora'}
    </button>
  )
}
