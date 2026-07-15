import { prisma } from "@/lib/prisma"
import { createTransaction } from "../../actions"
import Link from "next/link"

export const dynamic = 'force-dynamic'

export default async function NovoLancamentoPage() {
  const [categorias, fornecedores, clientes] = await Promise.all([
    prisma.financeCategory.findMany({ orderBy: { name: 'asc' } }),
    prisma.supplier.findMany({ orderBy: { name: 'asc' } }),
    prisma.customer.findMany({ orderBy: { name: 'asc' } }),
  ])

  const hoje = new Date().toISOString().slice(0, 10)

  return (
    <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div className="flex justify-between items-center mb-4">
        <h2>Novo Lançamento</h2>
        <Link href="/financeiro/contas" className="text-muted">Voltar</Link>
      </div>

      <div className="card">
        <form action={createTransaction}>
          <div className="input-group">
            <label className="input-label" htmlFor="type">Tipo *</label>
            <select id="type" name="type" className="input-field" required defaultValue="DESPESA">
              <option value="RECEITA">Receita (a receber)</option>
              <option value="DESPESA">Despesa (a pagar)</option>
            </select>
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="description">Descrição *</label>
            <input type="text" id="description" name="description" className="input-field" required />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="amount">Valor (R$) *</label>
            <input type="number" step="0.01" min="0" id="amount" name="amount" className="input-field" required />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="dueDate">Vencimento *</label>
            <input type="date" id="dueDate" name="dueDate" className="input-field" required defaultValue={hoje} />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="categoryId">Categoria</label>
            <select id="categoryId" name="categoryId" className="input-field" defaultValue="">
              <option value="">Sem categoria</option>
              {categorias.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.type === 'RECEITA' ? 'Receita' : 'Despesa'})</option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="supplierId">Fornecedor (opcional)</label>
            <select id="supplierId" name="supplierId" className="input-field" defaultValue="">
              <option value="">-</option>
              {fornecedores.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="customerId">Cliente (opcional)</label>
            <select id="customerId" name="customerId" className="input-field" defaultValue="">
              <option value="">-</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="paymentMethod">Forma de Pagamento</label>
            <input type="text" id="paymentMethod" name="paymentMethod" className="input-field" placeholder="Ex: PIX, Boleto, Dinheiro" />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="notes">Observações</label>
            <textarea id="notes" name="notes" className="input-field" rows={3}></textarea>
          </div>

          <div className="input-group">
            <label className="flex items-center gap-4" style={{ fontSize: '0.875rem', cursor: 'pointer' }}>
              <input type="checkbox" name="jaPago" value="1" />
              Já foi pago/recebido
            </label>
          </div>

          <div style={{ marginTop: '2rem' }}>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Salvar Lançamento
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
