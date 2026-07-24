import { gzipSync, gunzipSync } from 'zlib'
import { buildMtlsAgent } from './certificate'

// Fonte: swagger real das APIs (obtido em runtime via mTLS, docs públicas não expõem os paths
// diretamente): SEFIN Nacional emite a NFS-e (POST /SefinNacional/nfse), ADN só distribui/consulta
// documentos já emitidos (DFe por NSU) — são hosts e propósitos diferentes.
const SEFIN_BASE_URLS = {
  producao: 'https://sefin.nfse.gov.br/SefinNacional',
  homologacao: 'https://sefin.producaorestrita.nfse.gov.br/SefinNacional',
} as const

export type NfseAmbiente = keyof typeof SEFIN_BASE_URLS

interface NfseClientConfig {
  ambiente: NfseAmbiente
  pfxBuffer: Buffer
  certPassword: string
}

interface MensagemProcessamento {
  Codigo?: string
  Descricao?: string
  Complemento?: string
}

interface NfsePostResponseSucesso {
  chaveAcesso: string
  nfseXmlGZipB64: string
  alertas?: MensagemProcessamento[]
}

interface NfsePostResponseErro {
  erros?: MensagemProcessamento[]
}

/**
 * Cliente HTTP para a API SEFIN Nacional (emissão de NFS-e do Sistema Nacional).
 * Todas as chamadas exigem autenticação mútua (mTLS) com o certificado e-CNPJ do contribuinte.
 */
export class NfseClient {
  private baseUrl: string
  private agent: ReturnType<typeof buildMtlsAgent>

  constructor(config: NfseClientConfig) {
    this.baseUrl = SEFIN_BASE_URLS[config.ambiente]
    this.agent = buildMtlsAgent(config.pfxBuffer, config.certPassword)
  }

  private async request<T>(path: string, init?: RequestInit): Promise<{ status: number; data: T }> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      // @ts-expect-error -- `dispatcher` é uma extensão do undici para configurar TLS/mTLS, não faz parte do tipo RequestInit do fetch padrão.
      dispatcher: this.agent,
      headers: {
        Accept: 'application/json',
        ...(init?.headers || {}),
      },
    })

    const text = await res.text()
    let data: unknown = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text
    }

    return { status: res.status, data: data as T }
  }

  /** Envia a DPS (XML já assinado) compactada em gZip/base64 e recebe a NFS-e gerada (síncrono). */
  async emitirNfse(dpsXmlAssinado: string): Promise<{ chaveAcesso: string; xmlNfse: string }> {
    const dpsXmlGZipB64 = gzipSync(Buffer.from(dpsXmlAssinado, 'utf-8')).toString('base64')

    const { status, data } = await this.request<NfsePostResponseSucesso & NfsePostResponseErro>('/nfse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dpsXmlGZipB64 }),
    })

    if (status !== 201) {
      const erros = data?.erros || []
      const message = erros.length > 0
        ? erros.map(e => `[${e.Codigo}] ${e.Descricao}${e.Complemento ? ` — ${e.Complemento}` : ''}`).join('; ')
        : `Erro HTTP ${status} ao chamar a API da NFS-e`
      throw new Error(message)
    }

    const xmlNfse = gunzipSync(Buffer.from(data.nfseXmlGZipB64, 'base64')).toString('utf-8')
    return { chaveAcesso: data.chaveAcesso, xmlNfse }
  }

  /** Consulta uma NFS-e já emitida pela chave de acesso. */
  async consultarNfse(chaveAcesso: string): Promise<{ xmlNfse: string }> {
    const { status, data } = await this.request<{ nfseXmlGZipB64: string } & NfsePostResponseErro>(`/nfse/${chaveAcesso}`)

    if (status !== 200) {
      const erros = data?.erros || []
      const message = erros.length > 0
        ? erros.map(e => `[${e.Codigo}] ${e.Descricao}`).join('; ')
        : `Erro HTTP ${status} ao consultar a NFS-e`
      throw new Error(message)
    }

    const xmlNfse = gunzipSync(Buffer.from(data.nfseXmlGZipB64, 'base64')).toString('utf-8')
    return { xmlNfse }
  }
}
