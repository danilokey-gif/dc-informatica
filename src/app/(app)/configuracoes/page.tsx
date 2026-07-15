import { getCompanySettings } from "@/lib/settings"
import { updateSettings } from "./actions"

export default async function ConfiguracoesPage() {
  const settings = await getCompanySettings()

  return (
    <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div className="flex justify-between items-center mb-4">
        <h2>Configurações</h2>
      </div>

      <div className="card">
        <h3 className="mb-4">Dados da Empresa</h3>
        <form action={updateSettings}>
          <div className="input-group">
            <label className="input-label" htmlFor="name">Nome da Empresa *</label>
            <input type="text" id="name" name="name" className="input-field" required defaultValue={settings.name} />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="document">CNPJ / CPF</label>
            <input type="text" id="document" name="document" className="input-field" defaultValue={settings.document || ''} />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="phone">Telefone / WhatsApp</label>
            <input type="text" id="phone" name="phone" className="input-field" defaultValue={settings.phone || ''} />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="email">E-mail</label>
            <input type="email" id="email" name="email" className="input-field" defaultValue={settings.email || ''} />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="address">Endereço</label>
            <input type="text" id="address" name="address" className="input-field" defaultValue={settings.address || ''} />
          </div>

          <div className="input-group">
            <label className="input-label">Logo Atual</label>
            {settings.logo ? (
              <div className="flex items-center gap-4" style={{ marginBottom: '0.75rem' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={settings.logo} alt="Logo atual" style={{ height: '60px', width: '60px', objectFit: 'contain', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', backgroundColor: 'white' }} />
                <label className="flex items-center gap-4" style={{ fontSize: '0.875rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <input type="checkbox" name="removeLogo" value="1" />
                  Remover logo atual
                </label>
              </div>
            ) : (
              <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.75rem' }}>Nenhuma logo cadastrada ainda.</p>
            )}
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="logo">Enviar Nova Logo (PNG/JPG, até 1.5MB)</label>
            <input type="file" id="logo" name="logo" accept="image/*" className="input-field" />
          </div>

          <div style={{ marginTop: '2rem' }}>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Salvar Configurações
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
