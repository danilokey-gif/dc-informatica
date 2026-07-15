import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { deleteProduct } from "./actions"

export default async function ProdutosPage() {
  const produtos = await prisma.product.findMany({
    orderBy: { createdAt: 'desc' }
  })

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-4">
        <h2>Produtos</h2>
        <Link href="/produtos/novo" className="btn btn-primary">Novo Produto</Link>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>SKU</th>
              <th>Categoria</th>
              <th>Preço de Venda</th>
              <th>Estoque</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {produtos.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-muted">Nenhum produto cadastrado.</td>
              </tr>
            )}
            {produtos.map(produto => {
              const deleteAction = deleteProduct.bind(null, produto.id)
              const estoqueBaixo = produto.stockQty <= produto.minStockAlert
              return (
                <tr key={produto.id}>
                  <td>{produto.name}</td>
                  <td>{produto.sku || '-'}</td>
                  <td>{produto.category || '-'}</td>
                  <td>{produto.salePrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  <td>
                    {produto.stockQty}
                    {estoqueBaixo && (
                      <span style={{ marginLeft: '0.5rem', backgroundColor: '#fef2f2', color: '#b91c1c', padding: '0.125rem 0.5rem', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 500 }}>
                        Estoque baixo
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="flex gap-4">
                      <Link href={`/produtos/${produto.id}`} className="text-primary" style={{ fontWeight: 500 }}>Editar</Link>
                      <form action={deleteAction}>
                        <button type="submit" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 500 }}>
                          Excluir
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
