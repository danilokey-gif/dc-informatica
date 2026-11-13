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

interface NfseRespostaEvento {
  eventoXmlGZipB64?: string
  erro?: MensagemProcessamento[]
  erros?: MensagemProcessamento[]
}

/** Texto do erro de um evento: mensagens da Sefin (se vierem) e, sempre, o status HTTP e o corpo recebido. */
export function mensagemDeErroEvento(status: number, data: unknown): string {
  const obj = typeof data === 'object' && data ? (data as NfseRespostaEvento) : null
  const lista = [...(obj?.erros || []), ...(obj?.erro || [])]
  const mensagens = lista.map(e => {
    const m = e as MensagemProcessamento & { codigo?: string; descricao?: string; complemento?: string }
    const codigo = e.Codigo ?? m.codigo, descricao = e.Descricao ?? m.descricao, complemento = e.Complemento ?? m.complemento
    return `[${codigo}] ${descricao}${complemento ? ` — ${complemento}` : ''}`
  })
  if (mensagens.length > 0) return mensagens.join('; ')
  const corpo = (typeof data === 'string' ? data : data ? JSON.stringify(data) : '').replace(/\s+/g, ' ').trim().slice(0, 300)
  return `Erro HTTP ${status} ao registrar evento da NFS-e${corpo ? ` (resposta do governo: ${corpo})` : ' (o governo não explicou o motivo)'}`
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

  /**
   * Envia o Pedido de Registro de Evento (ex.: cancelamento) compactado em gZip/base64 para
   * POST /nfse/{chaveAcesso}/eventos. O campo do corpo é `pedidoRegistroEventoXmlGZipB64` (o da emissão
   * é `dpsXmlGZipB64`). Um nome de campo errado faz a Sefin responder HTTP 500 sem explicação.
   * Quando a resposta é de erro, a mensagem traz o que o governo devolveu, para a falha ser diagnosticável.
   */
  async registrarEvento(chaveAcesso: string, pedRegEventoXmlAssinado: string): Promise<{ xmlEvento: string }> {
    const pedidoRegistroEventoXmlGZipB64 = gzipSync(Buffer.from(pedRegEventoXmlAssinado, 'utf-8')).toString('base64')

    const { status, data } = await this.request<NfseRespostaEvento>(`/nfse/${chaveAcesso}/eventos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pedidoRegistroEventoXmlGZipB64 }),
    })

    if (status !== 200 && status !== 201) throw new Error(mensagemDeErroEvento(status, data))

    // Guarda o XML do evento quando a Sefin o devolve; se vier em outro formato, guarda a resposta crua
    // (o pedido já foi aceito: não pode virar erro só porque a resposta tem outro formato).
    const xmlGz = typeof data === 'object' && data ? data.eventoXmlGZipB64 : undefined
    const xmlEvento = xmlGz ? gunzipSync(Buffer.from(xmlGz, 'base64')).toString('utf-8') : (typeof data === 'string' ? data : JSON.stringify(data))
    return { xmlEvento }
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
