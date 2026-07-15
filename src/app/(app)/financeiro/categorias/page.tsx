import { prisma } from "@/lib/prisma"
import { createCategory, deleteCategory } from "../actions"
import Link from "next/link"

export const dynamic = 'force-dynamic'

export default async function CategoriasPage() {
  const categorias = await prisma.financeCategory.findMany({ orderBy: { name: 'asc' } })

  return (
    <div className="animate-fade-in" style={{ maxWidth: '700px', margin: '0 auto' }}>
      <div className="flex justify-between items-center mb-4">
        <h2>Categorias Financeiras</h2>
        <Link href="/financeiro" className="text-muted">Voltar</Link>
      </div>

      <div className="card mb-4">
        <h3 className="mb-4">Nova Categoria</h3>
        <form action={createCategory} className="flex gap-4" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="input-group" style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
            <label className="input-label" htmlFor="name">Nome</label>
            <input type="text" id="name" name="name" className="input-field" required />
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" htmlFor="type">Tipo</label>
            <select id="type" name="type" className="input-field" defaultValue="DESPESA">
              <option value="RECEITA">Receita</option>
              <option value="DESPESA">Despesa</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary">Adicionar</button>
        </form>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr><th>Nome</th><th>Tipo</th><th>Ações</th></tr>
          </thead>
          <tbody>
            {categorias.length === 0 && (
              <tr><td colSpan={3} className="text-center text-muted">Nenhuma categoria cadastrada.</td></tr>
            )}
            {categorias.map(c => {
              const excluirAction = deleteCategory.bind(null, c.id)
              return (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td style={{ color: c.type === 'RECEITA' ? '#16a34a' : '#dc2626' }}>{c.type === 'RECEITA' ? 'Receita' : 'Despesa'}</td>
                  <td>
                    <form action={excluirAction}>
                      <button type="submit" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 500 }}>Excluir</button>
                    </form>
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
