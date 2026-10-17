import { headers } from "next/headers"
import { salvarCredenciaisGoogle, desconectarGoogle } from "./actions"

const MENSAGENS: Record<string, { cor: string; texto: string }> = {
  conectado: { cor: 'var(--accent-green)', texto: 'Google Drive conectado.' },
  desconectado: { cor: 'var(--text-muted)', texto: 'Google Drive desconectado.' },
  'credenciais-salvas': { cor: 'var(--accent-green)', texto: 'Credenciais salvas. Agora clique em "Conectar com o Google".' },
  'client-id-invalido': { cor: 'var(--accent-red)', texto: 'Client ID inválido: ele termina em ".apps.googleusercontent.com".' },
  'sem-credenciais': { cor: 'var(--accent-red)', texto: 'Salve o Client ID e o Client Secret antes de conectar.' },
  negado: { cor: 'var(--accent-red)', texto: 'A autorização foi cancelada na tela do Google.' },
  invalido: { cor: 'var(--accent-red)', texto: 'A autorização expirou. Clique em "Conectar" de novo.' },
  falhou: { cor: 'var(--accent-red)', texto: 'O Google não liberou o acesso. Confira o Client ID, o Client Secret e o endereço de redirecionamento cadastrados no Google Cloud.' },
}

/** Conexão com o Google Drive da conta do usuário (fotos/vídeos das OS e backup das notas). */
export default async function GoogleDriveConfig({ clientId, temSegredo, conectado, conta, situacao }: {
  clientId: string | null; temSegredo: boolean; conectado: boolean; conta: string | null; situacao?: string
}) {
  const h = await headers()
  const origem = `${h.get('x-forwarded-proto') || 'https'}://${h.get('host')}`
  const msg = situacao ? MENSAGENS[situacao] : null

  return (
    <div id="google-drive" className="card mb-4" style={{ borderLeft: '4px solid var(--primary)', scrollMarginTop: '1rem' }}>
      <h3 className="mb-4">☁️ Google Drive</h3>
      <p className="text-muted" style={{ fontSize: '0.85rem' }}>
        Guarda as fotos e vídeos das OS e o backup das notas fiscais (PDF e XML) no Google Drive da sua conta, na pasta
        &quot;Dc Informática - Sistema&quot;. O sistema só tem acesso aos arquivos que ele mesmo criou.
      </p>

      {msg && <p style={{ color: msg.cor, fontWeight: 600, fontSize: '0.9rem' }}>{msg.texto}</p>}

      <p style={{ fontSize: '0.9rem', margin: '0.75rem 0' }}>
        Situação: {conectado
          ? <strong style={{ color: 'var(--accent-green)' }}>conectado{conta ? ` (${conta})` : ''}</strong>
          : <strong style={{ color: 'var(--accent-orange)' }}>não conectado</strong>}
      </p>

      <form action={salvarCredenciaisGoogle}>
        <div className="input-group">
          <label className="input-label" htmlFor="gdriveClientId">Client ID (Google Cloud)</label>
          <input id="gdriveClientId" name="gdriveClientId" className="input-field" defaultValue={clientId || ''} placeholder="123456-abc.apps.googleusercontent.com" required />
        </div>
        <div className="input-group">
          <label className="input-label" htmlFor="gdriveClientSecret">Client Secret</label>
          <input id="gdriveClientSecret" name="gdriveClientSecret" type="password" className="input-field" autoComplete="off"
            placeholder={temSegredo ? '•••••••• (já salvo — deixe em branco para manter)' : 'GOCSPX-...'} required={!temSegredo} />
        </div>
        <div className="input-group">
          <label className="input-label">Endereço de redirecionamento (cadastre este no Google Cloud)</label>
          <input className="input-field" readOnly value={`${origem}/api/google/callback`} style={{ fontFamily: 'monospace', fontSize: '0.8rem' }} />
        </div>
        <button type="submit" className="btn btn-outline">Salvar credenciais</button>
      </form>

      <div className="flex gap-4" style={{ marginTop: '1rem', flexWrap: 'wrap' }}>
        {clientId && temSegredo && (
          <a href="/api/google/conectar" className="btn btn-primary">{conectado ? 'Conectar de novo' : 'Conectar com o Google'}</a>
        )}
        {conectado && (
          <form action={desconectarGoogle}><button type="submit" className="btn btn-outline">Desconectar</button></form>
        )}
      </div>
    </div>
  )
}
