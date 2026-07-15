import { prisma } from "@/lib/prisma"
import Link from "next/link"
import VendaForm from "./VendaForm"

export const dynamic = 'force-dynamic'

export default async function NovaVendaPage() {
  const [produtos, clientes] = await Promise.all([
    prisma.product.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, salePrice: true, stockQty: true } }),
    prisma.customer.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } })
  ])

  return (
    <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="flex justify-between items-center mb-4">
        <h2>Nova Venda</h2>
        <Link href="/vendas" className="text-muted">Voltar</Link>
      </div>

      {produtos.length === 0 ? (
        <div className="card text-center">
          <p className="text-muted">Nenhum produto cadastrado ainda. Cadastre produtos antes de registrar uma venda.</p>
          <Link href="/produtos/novo" className="btn btn-primary" style={{ marginTop: '1rem', display: 'inline-block' }}>Cadastrar Produto</Link>
        </div>
      ) : (
        <VendaForm produtos={produtos} clientes={clientes} />
      )}
    </div>
  )
}
