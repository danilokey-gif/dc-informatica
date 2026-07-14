import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dc Informática - Assistência Técnica",
  description: "Sistema de gerenciamento de ordens de serviço, clientes e orçamentos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>
        <div className="flex" style={{ minHeight: '100vh', flexDirection: 'column' }}>
          {/* Cabeçalho */}
          <header className="no-print" style={{ backgroundColor: 'var(--surface)', padding: '1rem 2rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '40px', height: '40px', backgroundColor: 'var(--primary)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
                Dc
              </div>
              <h1 style={{ fontSize: '1.25rem', margin: 0, color: 'var(--primary)' }}>Dc Informática</h1>
            </div>
            <nav style={{ display: 'flex', gap: '1.5rem' }}>
              <a href="/" style={{ fontWeight: 500 }} className="text-muted">Dashboard</a>
              <a href="/clientes" style={{ fontWeight: 500 }} className="text-muted">Clientes</a>
              <a href="/os" style={{ fontWeight: 500 }} className="text-muted">Ordens de Serviço</a>
            </nav>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <span className="text-muted" style={{ alignSelf: 'center' }}>Admin</span>
              <form action={async () => {
                'use server'
                const { cookies } = await import('next/headers')
                const cookieStore = await cookies()
                cookieStore.delete('auth_token')
                const { redirect } = await import('next/navigation')
                redirect('/login')
              }}>
                <button type="submit" className="btn btn-outline" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}>Sair</button>
              </form>
            </div>
          </header>

          {/* Conteúdo Principal */}
          <main style={{ flex: 1, padding: '2rem', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
            {children}
          </main>

          {/* Rodapé */}
          <footer className="no-print" style={{ backgroundColor: 'var(--surface)', padding: '1.5rem', textAlign: 'center', borderTop: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            <p>&copy; {new Date().getFullYear()} Dc Informática. Todos os direitos reservados.</p>
            <p>Contato: (14) 99743-7540</p>
          </footer>
        </div>
      </body>
    </html>
  );
}
