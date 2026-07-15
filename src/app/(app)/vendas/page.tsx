import { prisma } from "@/lib/prisma"
import Link from "next/link"

export const dynamic = 'force-dynamic'

export default async function VendasPage() {
  const vendas = await prisma.sale.findMany({
    orderBy: { createdAt: 'desc' },
    include: { customer: true, items: true }
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
                  {venda.invoiceNumber
                    ? <span>{venda.invoiceType} {venda.invoiceNumber}</span>
                    : <span className="text-muted">Não emitida</span>}
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
