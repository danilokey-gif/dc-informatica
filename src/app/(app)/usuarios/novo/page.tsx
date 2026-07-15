import { createUser } from "../actions"
import Link from "next/link"

export default function NovoUsuarioPage() {
  return (
    <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div className="flex justify-between items-center mb-4">
        <h2>Novo Usuário</h2>
        <Link href="/usuarios" className="text-muted">Voltar</Link>
      </div>

      <div className="card">
        <form action={createUser}>
          <div className="input-group">
            <label className="input-label" htmlFor="name">Nome *</label>
            <input type="text" id="name" name="name" className="input-field" required />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="email">E-mail *</label>
            <input type="email" id="email" name="email" className="input-field" required autoComplete="off" />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="password">Senha *</label>
            <input type="password" id="password" name="password" className="input-field" required minLength={6} autoComplete="new-password" />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="role">Papel *</label>
            <select id="role" name="role" className="input-field" required defaultValue="TECNICO">
              <option value="TECNICO">Técnico (sem acesso a financeiro/configurações)</option>
              <option value="ADMIN">Administrador (acesso total)</option>
            </select>
          </div>

          <div style={{ marginTop: '2rem' }}>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Salvar Usuário
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
