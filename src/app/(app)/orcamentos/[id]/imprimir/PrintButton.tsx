'use client'

import { Printer } from 'lucide-react'

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="btn btn-outline"
      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
    >
      <Printer size={18} />
      Imprimir PDF
    </button>
  )
}
