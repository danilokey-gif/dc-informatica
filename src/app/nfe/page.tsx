import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { deleteInvoice } from "./actions"

export default async function NFePage() {
  const invoices = await prisma.invoice.findMany({
    include: { customer: true, serviceOrder: true },
    orderBy: { createdAt: 'desc' }
  })

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-4">
        <h2>Notas Fiscais Eletrônicas</h2>
        <Link href="/nfe/nova" className="btn btn-primary">Emitir NFe</Link>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Número</th>
              <th>Cliente</th>
              <th>Valor</th>
              <th>Status</th>
              <th>Data</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-muted">Nenhuma nota fiscal emitida.</td>
              </tr>
            )}
            {invoices.map(invoice => {
              const deleteAction = deleteInvoice.bind(null, invoice.id)
              const statusColor = {
                PENDING: '#fbbf24',
                ISSUED: '#10b981',
                CANCELLED: '#ef4444'
              }[invoice.status as string] || '#6b7280'

              return (
                <tr key={invoice.id}>
                  <td><strong>{invoice.invoiceNumber}</strong></td>
                  <td>{invoice.customer.name}</td>
                  <td>R$ {invoice.totalAmount.toFixed(2).replace('.', ',')}</td>
                  <td>
                    <span style={{
                      backgroundColor: statusColor,
                      color: 'white',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '0.25rem',
                      fontSize: '0.875rem',
                      fontWeight: 500
                    }}>
                      {invoice.status === 'PENDING' ? 'Pendente' : invoice.status === 'ISSUED' ? 'Emitida' : 'Cancelada'}
                    </span>
                  </td>
                  <td>{new Date(invoice.createdAt).toLocaleDateString('pt-BR')}</td>
                  <td>
                    <div className="flex gap-4">
                      <Link href={`/nfe/${invoice.id}`} className="text-primary" style={{ fontWeight: 500 }}>Ver</Link>
                      {invoice.nfeUrl && (
                        <a href={invoice.nfeUrl} className="text-primary" style={{ fontWeight: 500 }} download>
                          📥 Download
                        </a>
                      )}
                      <form action={deleteAction} style={{ display: 'inline' }}>
                        <button type="submit" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 500 }}>
                          Excluir
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
