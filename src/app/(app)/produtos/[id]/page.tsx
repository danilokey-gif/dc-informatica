import { prisma } from "@/lib/prisma"
import { updateProduct } from "../actions"
import Link from "next/link"
import { notFound } from "next/navigation"

export default async function EditarProdutoPage({ params }: { params: Promise<{ id: string }> }) {
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
            <label className="input-label" htmlFor="name">Nome *</label>
            <input type="text" id="name" name="name" className="input-field" required defaultValue={produto.name} />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="sku">SKU / Código</label>
            <input type="text" id="sku" name="sku" className="input-field" defaultValue={produto.sku || ''} />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="category">Categoria</label>
            <input type="text" id="category" name="category" className="input-field" defaultValue={produto.category || ''} />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="description">Descrição</label>
            <input type="text" id="description" name="description" className="input-field" defaultValue={produto.description || ''} />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="costPrice">Preço de Custo (R$)</label>
            <input type="number" step="0.01" min="0" id="costPrice" name="costPrice" className="input-field" defaultValue={produto.costPrice} />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="salePrice">Preço de Venda (R$)</label>
            <input type="number" step="0.01" min="0" id="salePrice" name="salePrice" className="input-field" defaultValue={produto.salePrice} />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="stockQty">Quantidade em Estoque</label>
            <input type="number" step="1" min="0" id="stockQty" name="stockQty" className="input-field" defaultValue={produto.stockQty} />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="minStockAlert">Alerta de Estoque Mínimo</label>
            <input type="number" step="1" min="0" id="minStockAlert" name="minStockAlert" className="input-field" defaultValue={produto.minStockAlert} />
          </div>

          <div className="flex gap-4" style={{ flexWrap: 'wrap' }}>
            <div className="input-group" style={{ flex: 1, minWidth: '150px' }}>
              <label className="input-label" htmlFor="ncm">NCM (para NF-e)</label>
              <input type="text" id="ncm" name="ncm" className="input-field" defaultValue={produto.ncm || ''} placeholder="8 dígitos, ex: 84733090" />
            </div>
            <div className="input-group" style={{ flex: 1, minWidth: '150px' }}>
              <label className="input-label" htmlFor="cfop">CFOP (para NF-e)</label>
              <input type="text" id="cfop" name="cfop" className="input-field" defaultValue={produto.cfop || ''} placeholder="Deixe em branco p/ usar o padrão" />
            </div>
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
