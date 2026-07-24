const LABELS: Record<string, { label: string; className: string }> = {
  AUTORIZADA: { label: 'Autorizada', className: 'badge-success' },
  REJEITADA: { label: 'Rejeitada', className: 'badge-danger' },
  PROCESSANDO: { label: 'Processando', className: 'badge-warning' },
}

export default function StatusBadge({ status }: { status: string }) {
  const info = LABELS[status] || { label: status, className: 'badge-neutral' }
  return <span className={`badge ${info.className}`}>{info.label}</span>
}
