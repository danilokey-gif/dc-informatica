'use client'

import { useState } from 'react'

export default function CopyPixButton({ copiaECola }: { copiaECola: string }) {
  const [copiado, setCopiado] = useState(false)

  return (
    <button
      type="button"
      className="btn btn-outline"
      onClick={() => {
        navigator.clipboard.writeText(copiaECola)
        setCopiado(true)
        setTimeout(() => setCopiado(false), 2000)
      }}
    >
      {copiado ? '✓ Copiado!' : '📋 Copiar Código Pix'}
    </button>
  )
}
