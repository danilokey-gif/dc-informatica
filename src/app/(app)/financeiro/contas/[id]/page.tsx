import { prisma } from "@/lib/prisma"
import { updateTransaction, marcarComoPago, marcarComoPendente } from "../../actions"
import Link from "next/link"
import { notFound } from "next/navigation"

export const dynamic = 'force-dynamic'

export default async function EditarLancamentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [transacao, categorias, fornecedores, clientes] = await Promise.all([
    prisma.financeTransaction.findUnique({ where: { id } }),
    prisma.financeCategory.findMany({ orderBy: { name: 'asc' } }),
    prisma.supplier.findMany({ orderBy: { name: 'asc' } }),
    prisma.customer.findMany({ orderBy: { name: 'asc' } }),
  ])

  if (!transacao) {
    notFound()
  }

  const updateAction = updateTransaction.bind(null, id)
  const marcarPagoAction = marcarComoPago.bind(null, id)
  const marcarPendenteAction = marcarComoPendente.bind(null, id)

  return (
    <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div className="flex justify-between items-center mb-4">
        <h2>Editar Lançamento</h2>
        <Link href="/financeiro/contas" className="text-muted">Voltar</Link>
      </div>

      <div className="card mb-4">
        <div className="flex justify-between items-center">
          <div>
            <strong>Status:</strong>{' '}
            {transacao.status === 'PAGO' ? (
              <span style={{ color: '#16a34a' }}>Pago{transacao.paidDate && ` em ${new Date(transacao.paidDate).toLocaleDateString('pt-BR')}`}</span>
            ) : (
              <span style={{ color: '#f59e0b' }}>Pendente</span>
            )}
          </div>
          {transacao.status === 'PENDENTE' ? (
            <form action={marcarPagoAction}>
              <button type="submit" className="btn btn-primary">Marcar como Pago</button>
            </form>
          ) : (
            <form action={marcarPendenteAction}>
              <button type="submit" className="btn btn-outline">Reabrir</button>
            </form>
          )}
        </div>
      </div>

      <div className="card">
        <form action={updateAction}>
          <div className="input-group">
            <label className="input-label">Tipo</label>
            <input type="text" className="input-field" disabled value={transacao.type === 'RECEITA' ? 'Receita' : 'Despesa'} />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="description">Descrição *</label>
            <input type="text" id="description" name="description" className="input-field" required defaultValue={transacao.description} />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="amount">Valor (R$) *</label>
            <input type="number" step="0.01" min="0" id="amount" name="amount" className="input-field" required defaultValue={transacao.amount} />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="dueDate">Vencimento *</label>
            <input type="date" id="dueDate" name="dueDate" className="input-field" required defaultValue={new Date(transacao.dueDate).toISOString().slice(0, 10)} />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="categoryId">Categoria</label>
            <select id="categoryId" name="categoryId" className="input-field" defaultValue={transacao.categoryId || ''}>
              <option value="">Sem categoria</option>
              {categorias.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.type === 'RECEITA' ? 'Receita' : 'Despesa'})</option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="supplierId">Fornecedor</label>
            <select id="supplierId" name="supplierId" className="input-field" defaultValue={transacao.supplierId || ''}>
              <option value="">-</option>
              {fornecedores.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="customerId">Cliente</label>
            <select id="customerId" name="customerId" className="input-field" defaultValue={transacao.customerId || ''}>
              <option value="">-</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="paymentMethod">Forma de Pagamento</label>
            <input type="text" id="paymentMethod" name="paymentMethod" className="input-field" defaultValue={transacao.paymentMethod || ''} />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="notes">Observações</label>
            <textarea id="notes" name="notes" className="input-field" rows={3} defaultValue={transacao.notes || ''}></textarea>
          </div>

          <div style={{ marginTop: '2rem' }}>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Atualizar Lançamento
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
