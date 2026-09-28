import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { deleteCustomer } from "./actions"

export const dynamic = 'force-dynamic'

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams

  const clientes = await prisma.customer.findMany({
    where: q ? {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { document: { contains: q } }
      ]
    } : undefined,
    orderBy: { createdAt: 'desc' }
  })

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-4" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <h2>Clientes</h2>
        
        <form method="get" className="flex gap-2" style={{ flex: '1 1 auto', maxWidth: '400px' }}>
          <input 
            type="text" 
            name="q" 
            defaultValue={q} 
            placeholder="Buscar por nome ou documento..." 
            className="input-field" 
            style={{ marginBottom: 0 }}
          />
          <button type="submit" className="btn btn-outline">Buscar</button>
        </form>

        <Link href="/clientes/novo" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>Novo Cliente</Link>
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
                <td colSpan={4} className="text-center text-muted" style={{ padding: '2rem' }}>
                  {q ? (
                    <div className="flex flex-col items-center gap-4">
                      <p>Nenhum cliente encontrado para "{q}".</p>
                      <Link href={`/clientes/novo?nome=${encodeURIComponent(q)}`} className="btn btn-primary">
                        Cadastrar "{q}"
                      </Link>
                    </div>
                  ) : (
                    "Nenhum cliente cadastrado."
                  )}
                </td>
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
