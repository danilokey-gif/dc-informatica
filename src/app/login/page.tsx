import { loginAction } from "./actions"
import { getCompanySettings } from "@/lib/settings"

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  const settings = await getCompanySettings()

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: 'var(--bg-color)' }}>
      <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          {settings.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logo} alt={settings.name} style={{ height: '60px', width: '60px', objectFit: 'contain', borderRadius: 'var(--radius-md)', margin: '0 auto 1rem', backgroundColor: 'white', border: '1px solid var(--border)' }} />
          ) : (
            <div style={{ width: '60px', height: '60px', backgroundColor: 'var(--primary)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '1.5rem', margin: '0 auto 1rem' }}>
              {settings.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <h2 style={{ color: 'var(--primary)' }}>{settings.name}</h2>
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
            <input type="email" id="email" name="email" className="input-field" required autoComplete="username" />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="password">Senha</label>
            <input type="password" id="password" name="password" className="input-field" required autoComplete="current-password" />
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
