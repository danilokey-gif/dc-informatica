import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { createInvoice } from "../actions"

export default async function NovaInvoicePage() {
  const serviceOrders = await prisma.serviceOrder.findMany({
    include: { customer: true },
    where: { status: { in: ['COMPLETED', 'DELIVERED'] } },
    orderBy: { createdAt: 'desc' }
  })

  return (
    <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div className="flex justify-between items-center mb-4">
        <h2>Emitir Nota Fiscal Eletrônica</h2>
        <Link href="/nfe" className="text-muted">Voltar</Link>
      </div>

      <div className="card">
        <form action={createInvoice}>
          <div className="input-group">
            <label className="input-label" htmlFor="serviceOrderId">Ordem de Serviço *</label>
            <select id="serviceOrderId" name="serviceOrderId" className="input-field" required>
              <option value="">Selecione uma ordem de serviço</option>
              {serviceOrders.map(os => (
                <option key={os.id} value={os.id}>
                  #{os.id.slice(-6).toUpperCase()} - {os.customer.name} - R$ {os.price ? os.price.toFixed(2) : '0.00'}
                </option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="customerId">Cliente *</label>
            <select id="customerId" name="customerId" className="input-field" required>
              <option value="">Selecione um cliente</option>
              {serviceOrders.map(os => (
                <option key={os.customerId} value={os.customerId}>
                  {os.customer.name}
                </option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="totalAmount">Valor Total (R$) *</label>
            <input type="number" step="0.01" id="totalAmount" name="totalAmount" className="input-field" required />
          </div>

          <div style={{ marginTop: '2rem' }}>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Emitir NFe
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
