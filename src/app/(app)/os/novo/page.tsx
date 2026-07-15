import { createOS } from "../actions"
import { prisma } from "@/lib/prisma"
import Link from "next/link"

export const dynamic = 'force-dynamic'

export default async function NovaOSPage() {
  const [clientes, tecnicos] = await Promise.all([
    prisma.customer.findMany({ orderBy: { name: 'asc' } }),
    prisma.user.findMany({ orderBy: { name: 'asc' } }),
  ])

  return (
    <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div className="flex justify-between items-center mb-4">
        <h2>Nova Ordem de Serviço</h2>
        <Link href="/os" className="text-muted">Voltar</Link>
      </div>

      <div className="card">
        <form action={createOS}>
          <div className="input-group">
            <label className="input-label" htmlFor="customerId">Cliente *</label>
            <select id="customerId" name="customerId" className="input-field" required>
              <option value="">Selecione um cliente...</option>
              {clientes.map(cliente => (
                <option key={cliente.id} value={cliente.id}>{cliente.name}</option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="device">Aparelho / Marca / Modelo *</label>
            <input type="text" id="device" name="device" className="input-field" required />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="issue">Defeito Relatado pelo Cliente *</label>
            <textarea id="issue" name="issue" className="input-field" rows={4} required></textarea>
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="technicianId">Técnico Responsável</label>
            <select id="technicianId" name="technicianId" className="input-field" defaultValue="">
              <option value="">Não atribuído</option>
              {tecnicos.map(tecnico => (
                <option key={tecnico.id} value={tecnico.id}>{tecnico.name}</option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="status">Status Inicial</label>
            <select id="status" name="status" className="input-field" defaultValue="BUDGET">
              <option value="BUDGET">Orçamento Pendente</option>
              <option value="APPROVED">Orçamento Aprovado</option>
              <option value="IN_PROGRESS">Em Andamento</option>
            </select>
          </div>

          <div style={{ marginTop: '2rem' }}>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Criar Ordem de Serviço
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
