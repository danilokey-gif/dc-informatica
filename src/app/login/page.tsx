import { loginAction } from "./actions"

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: 'var(--bg-color)' }}>
      <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ width: '60px', height: '60px', backgroundColor: 'var(--primary)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '1.5rem', margin: '0 auto 1rem' }}>
            Dc
          </div>
          <h2 style={{ color: 'var(--primary)' }}>Dc Informática</h2>
          <p className="text-muted">Acesso ao Sistema</p>
        </div>

        {error && (
          <div style={{ backgroundColor: '#fef2f2', color: '#b91c1c', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1.5rem', fontSize: '0.875rem', textAlign: 'center' }}>
            E-mail ou senha incorretos.
          </div>
        )}

        <form action={loginAction}>
          <div className="input-group">
            <label className="input-label" htmlFor="email">E-mail</label>
            <input type="email" id="email" name="email" className="input-field" required defaultValue="admin@dcinformatica.com" />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="password">Senha</label>
            <input type="password" id="password" name="password" className="input-field" required defaultValue="admin123" />
          </div>

          <div style={{ marginTop: '2rem' }}>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.75rem' }}>
              Entrar no Sistema
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
