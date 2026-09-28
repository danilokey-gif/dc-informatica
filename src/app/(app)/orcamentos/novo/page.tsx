import { prisma } from '@/lib/prisma'
import QuoteForm from './QuoteForm'

export default async function NovoOrcamentoPage() {
  const produtos = await prisma.product.findMany({ orderBy: { name: 'asc' } })
  const clientes = await prisma.customer.findMany({ orderBy: { name: 'asc' } })

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Novo Orçamento</h1>
      <QuoteForm produtos={produtos} clientes={clientes} />
    </div>
  )
}
