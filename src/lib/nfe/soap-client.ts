import { Agent } from 'undici'
import path from 'path'
import fs from 'fs'
import { extractCertMaterial } from '../nfse/certificate'

// A Sefaz-SP usa certificado TLS ICP-Brasil (AC SOLUTI, raiz "Autoridade Certificadora Raiz
// Brasileira v10") que nao esta na lista de CAs confiaveis padrao do Node — so funciona em
// navegadores porque o Windows ja tem essa raiz instalada no repositorio do sistema.
const caIcpBrasil = fs.readFileSync(path.join(process.cwd(), 'src/lib/nfe/ca-icp-brasil.pem'), 'utf-8')

const BASE_URLS = {
  producao: {
    autorizacao: 'https://nfe.fazenda.sp.gov.br/ws/NFeAutorizacao4.asmx',
    retAutorizacao: 'https://nfe.fazenda.sp.gov.br/ws/NFeRetAutorizacao4.asmx',
    statusServico: 'https://nfe.fazenda.sp.gov.br/ws/NFeStatusServico4.asmx',
    consultaProtocolo: 'https://nfe.fazenda.sp.gov.br/ws/NFeConsultaProtocolo4.asmx',
  },
  homologacao: {
    autorizacao: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/NFeAutorizacao4.asmx',
    retAutorizacao: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/NFeRetAutorizacao4.asmx',
    statusServico: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/NFeStatusServico4.asmx',
    consultaProtocolo: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/NFeConsultaProtocolo4.asmx',
  },
} as const

export type NfeAmbiente = keyof typeof BASE_URLS

interface NfeUrls {
  autorizacao: string
  retAutorizacao: string
  statusServico: string
  consultaProtocolo: string
}

interface NfeSoapClientConfig {
  ambiente: NfeAmbiente
  pfxBuffer: Buffer
  certPassword: string
}

const NFE_NS = 'http://www.portalfiscal.inf.br/nfe'

export class NfeSoapClient {
  private urls: NfeUrls
  private agent: Agent

  constructor(config: NfeSoapClientConfig) {
    this.urls = BASE_URLS[config.ambiente]
    const { privateKeyPem, certificatePem } = extractCertMaterial(config.pfxBuffer, config.certPassword)
    this.agent = new Agent({
      connect: { key: privateKeyPem, cert: certificatePem, ca: caIcpBrasil },
    })
  }

  /**
   * Envia uma requisição SOAP 1.2 e retorna o XML de resposta como texto.
   * O ASP.NET dessas web services exige o parâmetro `action` no Content-Type (equivalente ao
   * SOAPAction do SOAP 1.1) pra rotear pro método certo — sem isso ele responde 400 vazio.
   */
  private async soapRequest(url: string, servico: string, metodo: string, corpo: string): Promise<string> {
    const envelope =
      `<?xml version="1.0" encoding="utf-8"?>` +
      `<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">` +
        `<soap12:Body>` +
          `<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/${servico}">${corpo}</nfeDadosMsg>` +
        `</soap12:Body>` +
      `</soap12:Envelope>`

    const action = `http://www.portalfiscal.inf.br/nfe/wsdl/${servico}/${metodo}`

    const res = await fetch(url, {
      method: 'POST',
      // @ts-expect-error -- dispatcher e extensao do undici para mTLS
      dispatcher: this.agent,
      headers: { 'Content-Type': `application/soap+xml; charset=utf-8; action="${action}"` },
      body: envelope,
    })

    return res.text()
  }

  /** Consulta o status do serviço da Sefaz-SP (chamada simples, sem XML de NF-e). */
  async consultarStatusServico(cUF: string, tpAmb: '1' | '2'): Promise<string> {
    const corpo =
      `<consStatServ xmlns="${NFE_NS}" versao="4.00">` +
        `<tpAmb>${tpAmb}</tpAmb>` +
        `<cUF>${cUF}</cUF>` +
        `<xServ>STATUS</xServ>` +
      `</consStatServ>`
    return this.soapRequest(this.urls.statusServico, 'NFeStatusServico4', 'nfeStatusServicoNF', corpo)
  }

  /** Envia o lote com a NF-e assinada (envio síncrono, indSinc=1). */
  async autorizarNfe(idLote: string, xmlNfeAssinado: string): Promise<string> {
    const corpo =
      `<enviNFe xmlns="${NFE_NS}" versao="4.00">` +
        `<idLote>${idLote}</idLote>` +
        `<indSinc>1</indSinc>` +
        xmlNfeAssinado +
      `</enviNFe>`
    return this.soapRequest(this.urls.autorizacao, 'NFeAutorizacao4', 'nfeAutorizacaoLote', corpo)
  }

  /** Consulta o protocolo de autorização de uma NF-e pela chave de acesso. */
  async consultarProtocolo(chaveAcesso: string, cUF: string, tpAmb: '1' | '2'): Promise<string> {
    const corpo =
      `<consSitNFe xmlns="${NFE_NS}" versao="4.00">` +
        `<tpAmb>${tpAmb}</tpAmb>` +
        `<xServ>CONSULTAR</xServ>` +
        `<chNFe>${chaveAcesso}</chNFe>` +
      `</consSitNFe>`
    return this.soapRequest(this.urls.consultaProtocolo, 'NFeConsultaProtocolo4', 'nfeConsultaNF', corpo)
  }
}
