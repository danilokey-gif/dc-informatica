import { buildMtlsAgent } from './certificate'

// Fonte: "Manual dos Contribuintes - Guia para utilização das API's do ADN" (gov.br/nfse).
// URL e formato de resposta confirmados em chamada real de produção em 2026-07-30
// (StatusProcessamento: "DOCUMENTOS_LOCALIZADOS", com LoteDFe[].ArquivoXml).
const ADN_BASE_URLS = {
  producao: 'https://adn.nfse.gov.br/contribuintes',
  homologacao: 'https://adn.producaorestrita.nfse.gov.br/contribuintes',
} as const

export type AdnAmbiente = keyof typeof ADN_BASE_URLS

interface AdnClientConfig {
  ambiente: AdnAmbiente
  pfxBuffer: Buffer
  certPassword: string
}

export interface DocumentoLoteDFe {
  NSU: number
  ChaveAcesso: string
  TipoDocumento: string
  ArquivoXml: string
}

export interface RespostaConsultaDFe {
  StatusProcessamento: string
  LoteDFe: DocumentoLoteDFe[]
  Alertas?: unknown[]
  Erros?: { Codigo?: string; Descricao?: string }[]
}

/**
 * Cliente REST para as APIs do ADN (Ambiente de Dados Nacional) da NFS-e, usadas para consultar
 * documentos fiscais de serviço já emitidos (inclusive fora do nosso sistema) por NSU.
 * Autenticação via mTLS com o certificado do contribuinte (mesmo usado para emitir a NFS-e).
 */
export class AdnClient {
  private baseUrl: string
  private agent: ReturnType<typeof buildMtlsAgent>

  constructor(config: AdnClientConfig) {
    this.baseUrl = ADN_BASE_URLS[config.ambiente]
    this.agent = buildMtlsAgent(config.pfxBuffer, config.certPassword)
  }

  /**
   * Consulta o documento fiscal de serviço associado a um NSU (Número Sequencial Único).
   * Retorna `null` quando não há documento nesse NSU (fim da lista / NSU ainda não usado).
   */
  async consultarDFePorNsu(nsu: string): Promise<RespostaConsultaDFe | null> {
    const res = await fetch(`${this.baseUrl}/DFe/${nsu}`, {
      // @ts-expect-error -- dispatcher é extensão do undici para mTLS
      dispatcher: this.agent,
      headers: { Accept: 'application/json' },
    })

    if (res.status === 404 || res.status === 204) return null
    if (!res.ok) {
      throw new Error(`Erro HTTP ${res.status} ao consultar DFe por NSU ${nsu}: ${await res.text()}`)
    }

    const text = await res.text()
    if (!text) return null
    const json = JSON.parse(text) as RespostaConsultaDFe
    if (json.StatusProcessamento !== 'DOCUMENTOS_LOCALIZADOS' || !json.LoteDFe?.length) return null
    return json
  }
}
