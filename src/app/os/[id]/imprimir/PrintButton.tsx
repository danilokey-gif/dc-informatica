'use client'

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="btn btn-primary"
      style={{ padding: '0.75rem 2rem', fontSize: '1.125rem' }}
    >
      🖨️ Imprimir Agora
    </button>
  )
}
