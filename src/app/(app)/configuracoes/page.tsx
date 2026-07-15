import { getCompanySettings, getNfseConfig } from "@/lib/settings"
import { updateSettings, updateNfseConfig } from "./actions"
import { decryptSecret } from "@/lib/crypto"
import { extractCertMaterial } from "@/lib/nfse/certificate"

export const dynamic = 'force-dynamic'

function getCertificadoInfo(certificado: string | null, certificadoSenha: string | null) {
  if (!certificado || !certificadoSenha) return null
  try {
    const buffer = Buffer.from(certificado, 'base64')
    const senha = decryptSecret(certificadoSenha)
    const material = extractCertMaterial(buffer, senha)
    return { valido: true as const, validTo: material.validTo, commonName: material.commonName }
  } catch {
    return { valido: false as const }
  }
}

export default async function ConfiguracoesPage() {
  const settings = await getCompanySettings()
  const nfseConfig = await getNfseConfig()
  const certInfo = getCertificadoInfo(nfseConfig.certificado, nfseConfig.certificadoSenha)
  const certVencendoLogo = certInfo?.valido && certInfo.validTo.getTime() - Date.now() < 1000 * 60 * 60 * 24 * 30

  return (
    <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div className="flex justify-between items-center mb-4">
        <h2>Configurações</h2>
      </div>

      <div className="card mb-4">
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
            <label className="input-label" htmlFor="pixKey">Chave Pix (para gerar cobranças)</label>
            <input type="text" id="pixKey" name="pixKey" className="input-field" defaultValue={settings.pixKey || ''} placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória" />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="pixCity">Cidade (para o QR code Pix)</label>
            <input type="text" id="pixCity" name="pixCity" className="input-field" defaultValue={settings.pixCity || ''} placeholder="Ex: Sao Paulo" />
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
              Salvar Dados da Empresa
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h3 className="mb-4">Nota Fiscal de Serviço (NFS-e Nacional)</h3>
        <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
          Emissão automática via API do Sistema Nacional NFS-e. Exige certificado digital e-CNPJ (A1).
        </p>

        {nfseConfig.certificadoNome && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: certInfo?.valido ? 'var(--surface-hover)' : '#fef2f2', border: '1px solid var(--border)', fontSize: '0.875rem' }}>
            {certInfo?.valido ? (
              <>
                <strong>Certificado ativo:</strong> {nfseConfig.certificadoNome}
                <br />
                <span className={certVencendoLogo ? undefined : 'text-muted'} style={certVencendoLogo ? { color: '#b91c1c', fontWeight: 600 } : undefined}>
                  Válido até {certInfo.validTo.toLocaleDateString('pt-BR')}
                  {certVencendoLogo && ' — vencendo em breve, providencie a renovação'}
                </span>
              </>
            ) : (
              <span style={{ color: '#b91c1c' }}>Não foi possível validar o certificado salvo ({nfseConfig.certificadoNome}). Envie o arquivo novamente.</span>
            )}
          </div>
        )}

        <form action={updateNfseConfig}>
          <div className="input-group">
            <label className="input-label" htmlFor="ambiente">Ambiente</label>
            <select id="ambiente" name="ambiente" className="input-field" defaultValue={nfseConfig.ambiente}>
              <option value="homologacao">Homologação (testes, sem valor fiscal)</option>
              <option value="producao">Produção (notas reais)</option>
            </select>
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="codigoMunicipio">Código IBGE do Município *</label>
            <input type="text" id="codigoMunicipio" name="codigoMunicipio" className="input-field" defaultValue={nfseConfig.codigoMunicipio || ''} placeholder="Ex: 3550308 (São Paulo)" />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="codigoServico">Código de Tributação Nacional do Serviço *</label>
            <input type="text" id="codigoServico" name="codigoServico" className="input-field" defaultValue={nfseConfig.codigoServico || ''} placeholder="6 dígitos, ex: 010901" />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="cnae">CNAE</label>
            <input type="text" id="cnae" name="cnae" className="input-field" defaultValue={nfseConfig.cnae || ''} />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="aliquotaIss">Alíquota de ISS (%) *</label>
            <input type="number" step="0.01" min="0" max="100" id="aliquotaIss" name="aliquotaIss" className="input-field" defaultValue={nfseConfig.aliquotaIss ?? ''} />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="serieDps">Série da DPS</label>
            <input type="text" id="serieDps" name="serieDps" className="input-field" defaultValue={nfseConfig.serieDps} />
          </div>

          {nfseConfig.certificadoNome && (
            <div className="input-group">
              <label className="flex items-center gap-4" style={{ fontSize: '0.875rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <input type="checkbox" name="removeCertificado" value="1" />
                Remover certificado atual
              </label>
            </div>
          )}

          <div className="input-group">
            <label className="input-label" htmlFor="certificado">Certificado Digital e-CNPJ (.pfx / .p12)</label>
            <input type="file" id="certificado" name="certificado" accept=".pfx,.p12" className="input-field" />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="certificadoSenha">Senha do Certificado</label>
            <input type="password" id="certificadoSenha" name="certificadoSenha" className="input-field" autoComplete="new-password" />
          </div>

          <div style={{ marginTop: '2rem' }}>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Salvar Configuração Fiscal
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
