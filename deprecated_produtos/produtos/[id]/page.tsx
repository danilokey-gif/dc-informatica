import { prisma } from "@/lib/prisma"
import { updateProduct } from "../actions"
import Link from "next/link"
import { notFound } from "next/navigation"

export default async function EditarProdutoPage({ params }: { params: { id: string } }) {
  const { id } = await params
  
  const produto = await prisma.product.findUnique({
    where: { id }
  })

  if (!produto) {
    notFound()
  }

  const updateAction = updateProduct.bind(null, id)

  return (
    <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div className="flex justify-between items-center mb-4">
        <h2>Editar Produto</h2>
        <Link href="/produtos" className="text-muted">Voltar</Link>
      </div>

      <div className="card">
        <form action={updateAction}>
          <div className="input-group">
            <label className="input-label" htmlFor="name">Nome do Produto *</label>
            <input type="text" id="name" name="name" className="input-field" required defaultValue={produto.name} />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="description">Descrição</label>
            <textarea id="description" name="description" className="input-field" rows={3} defaultValue={produto.description || ''}></textarea>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="input-group">
              <label className="input-label" htmlFor="sku">SKU</label>
              <input type="text" id="sku" name="sku" className="input-field" defaultValue={produto.sku || ''} />
            </div>

            <div className="input-group">
              <label className="input-label" htmlFor="price">Preço (R$) *</label>
              <input type="number" step="0.01" id="price" name="price" className="input-field" required defaultValue={produto.price} />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="quantity">Quantidade em Estoque</label>
            <input type="number" id="quantity" name="quantity" className="input-field" defaultValue={produto.quantity} />
          </div>

          <div style={{ marginTop: '2rem' }}>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Atualizar Produto
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
