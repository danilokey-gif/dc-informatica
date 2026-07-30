import { buildMtlsAgent } from './certificate'

// Fonte: "Manual dos Contribuintes - Guia para utilização das API's do ADN" (gov.br/nfse),
// que documenta apenas o endpoint de produção restrita para testes. A URL de produção segue
// o mesmo padrão de host usado pela SEFIN Nacional (sefin.nfse.gov.br / sefin.producaorestrita
// .nfse.gov.br) — não confirmada ainda em uma chamada real, ajustar se retornar 404.
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
   * Formato exato do corpo da resposta não confirmado em chamada real ainda (o manual não
   * documenta o schema, só aponta pro Swagger) — retorna o JSON bruto pra quem chamar decidir
   * como interpretar, com fallback pros nomes de campo mais prováveis.
   */
  async consultarDFePorNsu(nsu: string): Promise<Record<string, unknown> | null> {
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
    return JSON.parse(text)
  }
}
