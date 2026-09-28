import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { FileText } from 'lucide-react'

export default async function OrcamentosPage() {
  const quotes = await prisma.quote.findMany({
    include: { customer: true },
    orderBy: { createdAt: 'desc' }
  })

  return (
    <div>
      <div className="flex justify-between" style={{ alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className="text-2xl font-bold">Orçamentos</h1>
        <Link className="btn btn-primary" href="/orcamentos/novo">Novo</Link>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Cliente</th>
                <th>Total</th>
                <th>Status</th>
                <th>Validade</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {quotes.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-muted">Nenhum orçamento encontrado.</td>
                </tr>
              )}
              {quotes.map(quote => (
                <tr key={quote.id}>
                  <td>{quote.createdAt.toLocaleDateString('pt-BR')}</td>
                  <td>{quote.customer?.name || 'Não identificado'}</td>
                  <td>{quote.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  <td>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '0.25rem',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      backgroundColor: quote.status === 'APPROVED' ? '#dcfce7' : quote.status === 'REJECTED' ? '#fee2e2' : '#fef3c7',
                      color: quote.status === 'APPROVED' ? '#166534' : quote.status === 'REJECTED' ? '#991b1b' : '#92400e',
                    }}>
                      {quote.status === 'APPROVED' ? 'Aprovado' : quote.status === 'REJECTED' ? 'Rejeitado' : 'Pendente'}
                    </span>
                  </td>
                  <td>{quote.validUntil ? quote.validUntil.toLocaleDateString('pt-BR') : '-'}</td>
                  <td>
                    <div className="flex gap-2">
                      <Link href={`/orcamentos/${quote.id}/imprimir`} className="btn btn-outline" style={{ padding: '0.25rem 0.5rem' }} title="Imprimir">
                        <FileText size={18} />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
