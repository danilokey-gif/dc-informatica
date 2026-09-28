'use client'

import { useRouter } from 'next/navigation'

export default function TableRowDoubleClick({ 
  url, 
  children 
}: { 
  url: string
  children: React.ReactNode 
}) {
  const router = useRouter()
  return (
    <tr 
      onDoubleClick={() => router.push(url)}
      style={{ cursor: 'pointer', transition: 'background-color 0.2s' }}
      onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      title="Dê um duplo clique para ver os lançamentos deste mês"
    >
      {children}
    </tr>
  )
}
