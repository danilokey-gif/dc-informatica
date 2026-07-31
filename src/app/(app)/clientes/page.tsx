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

      <ClientesList clientes={clientes} />
    </div>
  )
}
