import { buildMtlsAgent } from './certificate'

// Fontes: manual "API - Manual de Contribuintes - Emissor Público" e
// https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/apis-prod-restrita-e-producao
const BASE_URLS = {
  producao: 'https://adn.nfse.gov.br',
  homologacao: 'https://adn.producaorestrita.nfse.gov.br',
} as const

export type NfseAmbiente = keyof typeof BASE_URLS

interface NfseClientConfig {
  ambiente: NfseAmbiente
  pfxBuffer: Buffer
  certPassword: string
}

/**
 * Cliente HTTP para a API do Sistema Nacional NFS-e (ADN).
 * Todas as chamadas exigem autenticação mútua (mTLS) com o certificado e-CNPJ do contribuinte.
 *
 * IMPORTANTE: o prefixo de rota "/contribuintes" usado aqui foi inferido da URL de
 * documentação (".../contribuintes/docs/index.html"). Confirmar o path exato no Swagger
 * do ambiente de homologação (buildMtlsAgent + GET {baseUrl}/contribuintes/docs) antes da
 * primeira emissão real.
 */
export class NfseClient {
  private baseUrl: string
  private agent: ReturnType<typeof buildMtlsAgent>

  constructor(config: NfseClientConfig) {
    this.baseUrl = `${BASE_URLS[config.ambiente]}/contribuintes`
    this.agent = buildMtlsAgent(config.pfxBuffer, config.certPassword)
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      // @ts-expect-error -- `agent` é uma extensão do runtime Node (undici/https) para mTLS, não faz parte do tipo RequestInit do fetch padrão.
      agent: this.agent,
      headers: {
        Accept: 'application/json',
        ...(init?.headers || {}),
      },
    })

    const text = await res.text()
    let data: unknown
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text
    }

    if (!res.ok) {
      const message = typeof data === 'object' && data && 'mensagem' in data
        ? String((data as { mensagem: unknown }).mensagem)
        : `Erro HTTP ${res.status} ao chamar a API da NFS-e`
      throw new Error(message)
    }

    return data as T
  }

  /** Consulta os parâmetros de convênio de um município (se ele participa do Sistema Nacional). */
  getConvenioMunicipal(codigoMunicipio: string) {
    return this.request(`/parametros_municipais/${codigoMunicipio}/convenio`)
  }

  /** Consulta alíquotas e regras de tributação de um serviço num município. */
  getParametrosServico(codigoMunicipio: string, codigoServico: string) {
    return this.request(`/parametros_municipais/${codigoMunicipio}/${codigoServico}`)
  }

  /** Envia a DPS (XML assinado) e recebe a NFS-e gerada, ou um erro de validação. */
  emitirNfse(dpsXmlAssinado: string) {
    return this.request<{ xmlNfse?: string; mensagem?: string }>('/nfse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml' },
      body: dpsXmlAssinado,
    })
  }

  /** Consulta uma NFS-e já emitida pela chave de acesso. */
  consultarNfse(chaveAcesso: string) {
    return this.request(`/nfse/${chaveAcesso}`)
  }
}
