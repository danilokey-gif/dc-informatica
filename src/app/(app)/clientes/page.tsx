import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { deleteCustomer } from "./actions"

export default async function ClientesPage() {
  const clientes = await prisma.customer.findMany({
    orderBy: { createdAt: 'desc' }
  })

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-4">
        <h2>Clientes</h2>
        <Link href="/clientes/novo" className="btn btn-primary">Novo Cliente</Link>
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
            {clientes.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-muted">Nenhum cliente cadastrado.</td>
              </tr>
            )}
            {clientes.map(cliente => {
              const deleteAction = deleteCustomer.bind(null, cliente.id)
              return (
                <tr key={cliente.id}>
                  <td>{cliente.name}</td>
                  <td>{cliente.phone || '-'}</td>
                  <td>{cliente.document || '-'}</td>
                  <td>
                    <div className="flex gap-4">
                      <Link href={`/clientes/${cliente.id}`} className="text-primary" style={{ fontWeight: 500 }}>Editar</Link>
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
