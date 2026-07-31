import Link from "next/link"
import { createProduct } from "../actions"

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
            <label className="input-label" htmlFor="name">Nome do Produto *</label>
            <input type="text" id="name" name="name" className="input-field" required />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="description">Descrição</label>
            <textarea id="description" name="description" className="input-field" rows={3}></textarea>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="input-group">
              <label className="input-label" htmlFor="sku">SKU</label>
              <input type="text" id="sku" name="sku" className="input-field" />
            </div>

            <div className="input-group">
              <label className="input-label" htmlFor="price">Preço (R$) *</label>
              <input type="number" step="0.01" id="price" name="price" className="input-field" required />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="quantity">Quantidade em Estoque</label>
            <input type="number" id="quantity" name="quantity" className="input-field" defaultValue="0" />
          </div>

          <div style={{ marginTop: '2rem' }}>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Criar Produto
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
