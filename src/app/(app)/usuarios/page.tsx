import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { deleteUser } from "./actions"
import { getCurrentUser } from "@/lib/auth"

export const dynamic = 'force-dynamic'

export default async function UsuariosPage() {
  const [usuarios, usuarioAtual] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: 'asc' } }),
    getCurrentUser(),
  ])

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-4">
        <h2>Usuários</h2>
        <Link href="/usuarios/novo" className="btn btn-primary">Novo Usuário</Link>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>E-mail</th>
              <th>Papel</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map(usuario => {
              const deleteAction = deleteUser.bind(null, usuario.id)
              const isVoceMesmo = usuario.id === usuarioAtual?.id
              return (
                <tr key={usuario.id}>
                  <td>{usuario.name} {isVoceMesmo && <span className="text-muted" style={{ fontSize: '0.75rem' }}>(você)</span>}</td>
                  <td>{usuario.email}</td>
                  <td>{usuario.role === 'ADMIN' ? 'Administrador' : 'Técnico'}</td>
                  <td>
                    <div className="flex gap-4">
                      <Link href={`/usuarios/${usuario.id}`} className="text-primary" style={{ fontWeight: 500 }}>Editar</Link>
                      {!isVoceMesmo && (
                        <form action={deleteAction}>
                          <button type="submit" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 500 }}>
                            Excluir
                          </button>
                        </form>
                      )}
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
