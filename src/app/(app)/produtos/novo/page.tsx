import { createProduct } from "../actions"
import Link from "next/link"

export default function NovoProdutoPage() {
  return (
    <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div className="flex justify-between items-center mb-4">
        <h2>Novo Produto</h2>
        <Link href="/produtos" className="text-muted">Voltar</Link>
      </div>

      <div className="card">
        <form action={createProduct}>
          <div className="input-group">
            <label className="input-label" htmlFor="name">Nome *</label>
            <input type="text" id="name" name="name" className="input-field" required />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="sku">SKU / Código</label>
            <input type="text" id="sku" name="sku" className="input-field" />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="category">Categoria</label>
            <input type="text" id="category" name="category" className="input-field" />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="description">Descrição</label>
            <input type="text" id="description" name="description" className="input-field" />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="costPrice">Preço de Custo (R$)</label>
            <input type="number" step="0.01" min="0" id="costPrice" name="costPrice" className="input-field" defaultValue="0" />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="salePrice">Preço de Venda (R$)</label>
            <input type="number" step="0.01" min="0" id="salePrice" name="salePrice" className="input-field" defaultValue="0" />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="stockQty">Quantidade em Estoque</label>
            <input type="number" step="1" min="0" id="stockQty" name="stockQty" className="input-field" defaultValue="0" />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="minStockAlert">Alerta de Estoque Mínimo</label>
            <input type="number" step="1" min="0" id="minStockAlert" name="minStockAlert" className="input-field" defaultValue="0" />
          </div>

          <div style={{ marginTop: '2rem' }}>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Salvar Produto
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
