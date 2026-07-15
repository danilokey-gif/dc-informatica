import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { deleteSupplier } from "./actions"

export const dynamic = 'force-dynamic'

export default async function FornecedoresPage() {
  const fornecedores = await prisma.supplier.findMany({
    orderBy: { createdAt: 'desc' }
  })

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-4">
        <h2>Fornecedores</h2>
        <Link href="/fornecedores/novo" className="btn btn-primary">Novo Fornecedor</Link>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Telefone</th>
              <th>Documento</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {fornecedores.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-muted">Nenhum fornecedor cadastrado.</td>
              </tr>
            )}
            {fornecedores.map(fornecedor => {
              const deleteAction = deleteSupplier.bind(null, fornecedor.id)
              return (
                <tr key={fornecedor.id}>
                  <td>{fornecedor.name}</td>
                  <td>{fornecedor.phone || '-'}</td>
                  <td>{fornecedor.document || '-'}</td>
                  <td>
                    <div className="flex gap-4">
                      <Link href={`/fornecedores/${fornecedor.id}`} className="text-primary" style={{ fontWeight: 500 }}>Editar</Link>
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
