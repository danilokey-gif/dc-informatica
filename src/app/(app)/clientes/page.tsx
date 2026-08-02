import { prisma } from "@/lib/prisma"
import Link from "next/link"
import ClientesList from "./ClientesList"

export const dynamic = 'force-dynamic'

export default async function ClientesPage() {
  const clientes = await prisma.customer.findMany({
    orderBy: { createdAt: 'desc' }
  })

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-4">
        <h2>Clientes</h2>
        <Link href="/clientes/novo" className="btn btn-primary">Novo Cliente</Link>
      </div>

      {/* Campo de busca visível para garantir que aparece no layout (readOnly) */}
      <div className="card mb-4" style={{ marginBottom: '1rem' }}>
        <div className="input-group">
          <label className="input-label" htmlFor="search-server">🔍 Buscar Cliente por Nome ou CPF/CNPJ</label>
          <input
            type="text"
            id="search-server"
            placeholder="Pesquisar (busca interativa abaixo)"
            className="input-field"
            style={{ fontSize: '1rem', padding: '0.75rem', width: '100%' }}
            readOnly
          />
        </div>
      </div>

      <ClientesList clientes={clientes} />
    </div>
  )
}
