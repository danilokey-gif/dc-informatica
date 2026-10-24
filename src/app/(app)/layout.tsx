import { getCompanySettingsLeve } from "@/lib/settings";
import { getCurrentUser } from "@/lib/auth";
import Sidebar from "./Sidebar";
import RastreadorNavegacao from "@/components/RastreadorNavegacao";
import MenuTopo from "./MenuTopo";
import SeletorAparencia from "@/components/SeletorAparencia";
import { cookies } from "next/headers";
import { COOKIE_LAYOUT, COOKIE_TEMA, lerLayout, lerTema } from "@/lib/aparencia";

export const dynamic = 'force-dynamic'

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [settings, user, cookieStore] = await Promise.all([
    getCompanySettingsLeve(),
    getCurrentUser(),
    cookies(),
  ]);
  const tema = lerTema(cookieStore.get(COOKIE_TEMA)?.value)
  const layout = lerLayout(cookieStore.get(COOKIE_LAYOUT)?.value)

  if (!user) {
    return (
      <div className="app-shell" style={{ backgroundColor: '#f3f4f6' }}>
        <main className="main-area" style={{ marginLeft: 0, width: '100vw', minHeight: '100vh', padding: '1rem' }}>
          {children}
        </main>
      </div>
    )
  }

  const companyName = settings.nomeFantasia || settings.name
  const logo = settings.temLogo ? `/logo?v=${settings.updatedAt.getTime()}` : null
  const direita = (
    <div className="flex gap-4" style={{ alignItems: 'center', gap: '0.75rem' }}>
      <SeletorAparencia tema={tema} layout={layout} />
      <span className="text-muted usuario-nome" style={{ fontWeight: 500 }}>{user.name}</span>
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
  )

  return (
    <div className={`app-shell${layout === 'lateral' ? '' : ' app-shell-topo'}`}>
      <RastreadorNavegacao />
      {layout === 'lateral' && <Sidebar companyName={companyName} logo={logo} role={user.role} />}
      {layout !== 'lateral' && <MenuTopo companyName={companyName} logo={logo} role={user.role} layout={layout} direita={direita} />}

      <div className="app-content">
        {layout === 'lateral' && (
          <header className="no-print topbar">
            <div className="topbar-spacer" />
            {direita}
          </header>
        )}

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
