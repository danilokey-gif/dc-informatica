import { prisma } from "@/lib/prisma"
import EntradaClient from "./EntradaClient"

export const dynamic = 'force-dynamic'

export default async function EntradaDeComprasPage() {
  const suppliers = await prisma.supplier.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' }
  })

  const products = await prisma.product.findMany({
    select: { id: true, name: true, stockQty: true },
    orderBy: { name: 'asc' }
  })

  return <EntradaClient suppliers={suppliers} products={products} />
}
