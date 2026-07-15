import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { deleteOS } from "./actions"

export const dynamic = 'force-dynamic'

export default async function OSPage() {
  const ordens = await prisma.serviceOrder.findMany({
    include: { customer: true },
    orderBy: { createdAt: 'desc' }
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'BUDGET': return '#f59e0b';
      case 'APPROVED': return '#3b82f6';
      case 'IN_PROGRESS': return '#8b5cf6';
      case 'COMPLETED': return '#10b981';
      case 'DELIVERED': return '#6b7280';
      default: return '#6b7280';
    }
  }

  const getStatusName = (status: string) => {
    switch (status) {
      case 'BUDGET': return 'Orçamento';
      case 'APPROVED': return 'Aprovado';
      case 'IN_PROGRESS': return 'Em Andamento';
      case 'COMPLETED': return 'Concluído';
      case 'DELIVERED': return 'Entregue';
      default: return status;
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-4">
        <h2>Ordens de Serviço</h2>
        <Link href="/os/novo" className="btn btn-primary">Nova OS</Link>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>OS #</th>
              <th>Cliente</th>
              <th>Aparelho</th>
              <th>Status</th>
              <th>Data</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {ordens.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-muted">Nenhuma ordem de serviço cadastrada.</td>
              </tr>
            )}
            {ordens.map(os => {
              const deleteAction = deleteOS.bind(null, os.id)
              return (
                <tr key={os.id}>
                  <td style={{ fontWeight: 'bold' }}>{os.id.slice(-6).toUpperCase()}</td>
                  <td>{os.customer.name}</td>
                  <td>{os.device}</td>
                  <td>
                    <span style={{ 
                      backgroundColor: getStatusColor(os.status), 
                      color: 'white', 
                      padding: '0.25rem 0.75rem', 
                      borderRadius: 'var(--radius-full)', 
                      fontSize: '0.75rem', 
                      fontWeight: 600 
                    }}>
                      {getStatusName(os.status)}
                    </span>
                  </td>
                  <td>{new Date(os.createdAt).toLocaleDateString('pt-BR')}</td>
                  <td>
                    <div className="flex gap-4">
                      <Link href={`/os/${os.id}`} className="text-primary" style={{ fontWeight: 500 }}>Abrir</Link>
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
