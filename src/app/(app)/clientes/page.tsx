import { prisma } from "@/lib/prisma"
import Link from "next/link"
import ClientesList from "./ClientesList"

export const dynamic = 'force-dynamic'

export default async function ClientesPage() {
  // A busca é feita no próprio ClientesList, no navegador, sobre a lista já carregada — por isso
  // aqui não há mais filtro por query string (ter os dois ao mesmo tempo dava duas caixas de busca).
  const clientes = await prisma.customer.findMany({ orderBy: { createdAt: 'desc' } })

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-4" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <h2>Clientes</h2>
        <Link href="/clientes/novo" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>Novo Cliente</Link>
      </div>

      <ClientesList clientes={clientes} />
    </div>
  )
}
