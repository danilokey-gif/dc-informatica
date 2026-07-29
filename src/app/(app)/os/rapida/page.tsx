import { createOSRapida } from "../actions"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import SearchableSelect from "@/components/SearchableSelect"

export const dynamic = 'force-dynamic'

export default async function NotaServicoAvulsaPage() {
  const clientes = await prisma.customer.findMany({ orderBy: { name: 'asc' } })

  return (
    <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div className="flex justify-between items-center mb-4">
        <h2>Nota de Serviço Avulsa</h2>
        <Link href="/os" className="text-muted">Voltar</Link>
      </div>

      <p className="text-muted" style={{ marginTop: '-0.5rem', marginBottom: '1rem' }}>
        Use esta tela quando você já atendeu o cliente e só precisa emitir a nota fiscal, sem abrir uma Ordem de Serviço completa (sem aparelho/defeito).
      </p>

      <div className="card">
        <form action={createOSRapida}>
          <div className="input-group">
            <label className="input-label" htmlFor="customerId">Cliente *</label>
            <SearchableSelect
              id="customerId"
              name="customerId"
              required
              placeholder="Digite o nome do cliente..."
              options={clientes.map(c => ({ value: c.id, label: c.name }))}
            />
            {clientes.length === 0 && (
              <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                Nenhum cliente cadastrado ainda. <Link href="/clientes/novo" className="text-primary">Cadastrar cliente</Link>
              </p>
            )}
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="descricao">Descrição do Serviço *</label>
            <textarea id="descricao" name="descricao" className="input-field" rows={4} required placeholder="Ex: Consultoria de rede, configuração de impressora, etc." />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="price">Valor do Serviço (R$) *</label>
            <input type="number" id="price" name="price" step="0.01" min="0" className="input-field" required />
          </div>

          <div style={{ marginTop: '2rem' }}>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Continuar para Emissão da Nota
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
