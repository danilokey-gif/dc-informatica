import { getCompanySettings } from "@/lib/settings";
import { getCurrentUser } from "@/lib/auth";
import Sidebar from "./Sidebar";

export const dynamic = 'force-dynamic'

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [settings, user] = await Promise.all([
    getCompanySettings(),
    getCurrentUser(),
  ]);

  return (
    <div className="app-shell">
      <Sidebar companyName={settings.name} logo={settings.logo} role={user?.role || 'TECNICO'} />

      <div className="app-content">
        <header className="no-print topbar">
          <div className="topbar-spacer" />
          <div className="flex gap-4" style={{ alignItems: 'center' }}>
            <span className="text-muted" style={{ fontWeight: 500 }}>{user?.name || 'Usuário'}</span>
            <form action={async () => {
              'use server'
              const { cookies } = await import('next/headers')
              const cookieStore = await cookies()
              cookieStore.delete('auth_token')
              const { redirect } = await import('next/navigation')
              redirect('/login')
            }}>
              <button type="submit" className="btn btn-outline" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}>Sair</button>
            </form>
          </div>
        </header>

        <main className="main-area">
          {children}
        </main>

        <footer className="no-print app-footer">
          <p>&copy; {new Date().getFullYear()} {settings.name}. Todos os direitos reservados.</p>
          {settings.phone && <p>Contato: {settings.phone}</p>}
        </footer>
      </div>
    </div>
  );
}
