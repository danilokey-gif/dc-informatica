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
              <th>Preço</th>
              <th>Quantidade</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {produtos.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-muted">Nenhum produto cadastrado.</td>
              </tr>
            )}
            {produtos.map(produto => {
              const deleteAction = deleteProduct.bind(null, produto.id)
              return (
                <tr key={produto.id}>
                  <td>{produto.name}</td>
                  <td>{produto.sku || '-'}</td>
                  <td>R$ {produto.price.toFixed(2).replace('.', ',')}</td>
                  <td>{produto.quantity}</td>
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
