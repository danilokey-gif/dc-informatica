import { prisma } from "@/lib/prisma"
import Link from "next/link"
import OSForm from "./OSForm"

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
        <OSForm clientes={clientes} tecnicos={tecnicos} />
      </div>
    </div>
  )
}
