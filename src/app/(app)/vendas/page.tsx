import { prisma } from "@/lib/prisma"
import Link from "next/link"

export const dynamic = 'force-dynamic'

export default async function VendasPage() {
  const vendas = await prisma.sale.findMany({
    orderBy: { createdAt: 'desc' },
    include: { customer: true, items: true, nfeEmissoes: { orderBy: { createdAt: 'desc' } } }
  })

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-4">
        <h2>Vendas</h2>
        <Link href="/vendas/novo" className="btn btn-primary">Nova Venda</Link>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Cliente</th>
              <th>Itens</th>
              <th>Total</th>
              <th>Pagamento</th>
              <th>Nota Fiscal</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {vendas.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-muted">Nenhuma venda registrada.</td>
              </tr>
            )}
            {vendas.map(venda => (
              <tr key={venda.id}>
                <td>{new Date(venda.createdAt).toLocaleDateString('pt-BR')}</td>
                <td>{venda.customer?.name || 'Cliente não identificado'}</td>
                <td>{venda.items.reduce((acc, item) => acc + item.quantity, 0)}</td>
                <td>{venda.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                <td>{venda.paymentMethod}</td>
                 <td>
                  {(() => {
                    const ultimaNfe = venda.nfeEmissoes?.[0]
                    if (ultimaNfe) {
                      if (ultimaNfe.status === 'AUTORIZADA') {
                        return <span className="badge badge-success" style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>NF-e nº {ultimaNfe.numero}</span>
                      }
                      if (ultimaNfe.status === 'CANCELADA') {
                        return <span className="badge badge-danger" style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#dc2626', color: 'white' }}>NF-e nº {ultimaNfe.numero} (Cancelada)</span>
                      }
                      if (ultimaNfe.status === 'PROCESSANDO') {
                        return <span className="badge badge-warning" style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>Processando...</span>
                      }
                      if (ultimaNfe.status === 'REJEITADA') {
                        return <span className="badge badge-danger" style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#dc2626', color: 'white' }}>Rejeitada</span>
                      }
                    }
                    if (venda.invoiceNumber) {
                      return <span>{venda.invoiceType} {venda.invoiceNumber}</span>
                    }
                    return <span className="text-muted">Não emitida</span>
                  })()}
                </td>
                <td>
                  <Link href={`/vendas/${venda.id}/imprimir`} className="text-primary" style={{ fontWeight: 500 }}>Ver Recibo</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
