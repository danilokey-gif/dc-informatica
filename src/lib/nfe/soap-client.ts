import { Agent, fetch as undiciFetch } from 'undici'
import path from 'path'
import fs from 'fs'
import tls from 'tls'
import { extractCertMaterial } from '../nfse/certificate'

// A Sefaz-SP usa certificado TLS ICP-Brasil (AC SOLUTI, raiz "Autoridade Certificadora Raiz
// Brasileira v10") que nao esta na lista de CAs confiaveis padrao do Node — so funciona em
// navegadores porque o Windows ja tem essa raiz instalada no repositorio do sistema.
const caIcpBrasil = fs.readFileSync(path.join(process.cwd(), 'src/lib/nfe/ca-icp-brasil.pem'), 'utf-8')

// Passar `ca` no tls.connect SUBSTITUI a lista padrão de raízes confiáveis do Node (não soma) —
// por isso hosts com certificado normal (assinado por CA pública padrão), como o da Distribuição
// DFe nacional, davam "unable to get local issuer certificate" com só a raiz ICP-Brasil na lista.
// Combinando as raízes padrão do Node com a raiz ICP-Brasil, os dois tipos de host validam.
const caCombinada = [...tls.rootCertificates, caIcpBrasil]

const BASE_URLS = {
  producao: {
    autorizacao: 'https://nfe.fazenda.sp.gov.br/ws/NFeAutorizacao4.asmx',
    retAutorizacao: 'https://nfe.fazenda.sp.gov.br/ws/NFeRetAutorizacao4.asmx',
    statusServico: 'https://nfe.fazenda.sp.gov.br/ws/NFeStatusServico4.asmx',
    consultaProtocolo: 'https://nfe.fazenda.sp.gov.br/ws/NFeConsultaProtocolo4.asmx',
    // Eventos da própria nota (cancelamento) vão para a Sefaz que autorizou — SP.
    recepcaoEvento: 'https://nfe.fazenda.sp.gov.br/ws/nferecepcaoevento4.asmx',
    // Serviço nacional (SVAN), único endpoint pra todo o país, diferente dos serviços acima que são da Sefaz-SP.
    distribuicaoDFe: 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
    // Eventos do Ambiente Nacional (manifestação do destinatário). Também nacional, não da Sefaz-SP.
    recepcaoEventoAN: 'https://www.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
  },
  homologacao: {
    autorizacao: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/NFeAutorizacao4.asmx',
    retAutorizacao: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/NFeRetAutorizacao4.asmx',
    statusServico: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/NFeStatusServico4.asmx',
    consultaProtocolo: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/NFeConsultaProtocolo4.asmx',
    recepcaoEvento: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nferecepcaoevento4.asmx',
    distribuicaoDFe: 'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
    recepcaoEventoAN: 'https://hom1.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
  },
} as const

export type NfeAmbiente = keyof typeof BASE_URLS

interface NfeUrls {
  autorizacao: string
  retAutorizacao: string
  statusServico: string
  consultaProtocolo: string
  recepcaoEvento: string
  distribuicaoDFe: string
  recepcaoEventoAN: string
}

// Código da UF (IBGE) usado em cUFAutor — só SP é usado aqui.
const CODIGO_UF: Record<string, string> = { SP: '35' }

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
      connect: { key: privateKeyPem, cert: certificatePem, ca: caCombinada },
    })
  }

  /**
   * Envia uma requisição SOAP 1.2 e retorna o XML de resposta como texto.
   * O ASP.NET dessas web services exige o parâmetro `action` no Content-Type (equivalente ao
   * SOAPAction do SOAP 1.1) pra rotear pro método certo — sem isso ele responde 400 vazio.
   */
  private async soapRequest(url: string, servico: string, metodo: string, corpo: string, wrapperTag = 'nfeDadosMsg'): Promise<string> {
    const envelope =
      `<?xml version="1.0" encoding="utf-8"?>` +
      `<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">` +
        `<soap12:Body>` +
          `<${wrapperTag} xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/${servico}">${corpo}</${wrapperTag}>` +
        `</soap12:Body>` +
      `</soap12:Envelope>`

    const action = `http://www.portalfiscal.inf.br/nfe/wsdl/${servico}/${metodo}`

    const res = await undiciFetch(url, {
      method: 'POST',
      dispatcher: this.agent,
      headers: { 'Content-Type': `application/soap+xml; charset=utf-8; action="${action}"` },
      body: envelope,
    })

    const texto = await res.text()
    // A Sefaz responde 403 (página HTML, sem XML fiscal) quando recusa o certificado na conexão:
    // vencido, revogado ou de outro CNPJ. Nesse caso nada foi processado e nenhuma nota existe.
    if (res.status === 401 || res.status === 403) {
      throw new Error(`A Sefaz recusou a conexão do certificado digital (HTTP ${res.status}). Confira em Configurações se o certificado está dentro da validade e é o e-CNPJ da empresa. Nenhuma nota foi emitida.`)
    }
    if (!res.ok && !texto.includes('Fault')) {
      throw new Error(`A Sefaz respondeu HTTP ${res.status} sem retorno fiscal (serviço fora do ar?). Nenhuma nota foi emitida; tente de novo mais tarde.`)
    }
    if (texto.includes('soap:Fault') || texto.includes('soap12:Fault')) {
      throw new Error(`Rejeição SOAP (HTTP ${res.status}). Enviado: ${envelope} | Recebido: ${texto}`)
    }
    return texto
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

  /**
   * Consulta o serviço nacional de Distribuição de DF-e: traz os documentos que OUTROS geraram
   * contra o CNPJ informado (notas em que ele é destinatário, transportador ou autorizado no
   * autXML). As NF-e que o próprio CNPJ emitiu NÃO vêm por aqui (NT 2014.002). Pagina pelo NSU —
   * cada chamada
   * retorna até 50 documentos a partir de `ultNsuConsultado`; repita usando o `ultNSU` retornado
   * até que ele seja igual ao `maxNSU` (não há mais documentos novos).
   */
  async consultarDistribuicaoDFe(cnpj: string, uf: string, tpAmb: '1' | '2', ultNsuConsultado: string): Promise<string> {
    const cUFAutor = CODIGO_UF[uf] || '35'
    const wsdlNs = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe'
    const distDFeInt =
      `<distDFeInt xmlns="${NFE_NS}" versao="1.01">` +
        `<tpAmb>${tpAmb}</tpAmb>` +
        `<cUFAutor>${cUFAutor}</cUFAutor>` +
        `<CNPJ>${cnpj}</CNPJ>` +
        `<distNSU><ultNSU>${ultNsuConsultado.padStart(15, '0')}</ultNSU></distNSU>` +
      `</distDFeInt>`
    // Confirmado contra a lib de referência nfephp-org/sped-nfe (Tools::sefazDistDFe): este
    // serviço tem um nível de aninhamento a mais que os outros — o conteúdo vai dentro de
    // <nfeDadosMsg>, que por sua vez vai dentro de <nfeDistDFeInteresse>. Nos demais serviços
    // (NFeAutorizacao4 etc) o <nfeDadosMsg> é o próprio wrapper do Body, sem esse nível extra.
    // Sem o <nfeDadosMsg> no meio, o servidor não encontra o parâmetro e devolve
    // "Object reference not set to an instance of an object" (NullReferenceException).
    const corpo = `<nfeDadosMsg xmlns="${wsdlNs}">${distDFeInt}</nfeDadosMsg>`
    return this.soapRequest(this.urls.distribuicaoDFe, 'NFeDistribuicaoDFe', 'nfeDistDFeInteresse', corpo, 'nfeDistDFeInteresse')
  }

  /**
   * Envia um lote de eventos já assinados (o schema aceita até 20 por lote). Aqui o <nfeDadosMsg>
   * é o próprio wrapper do Body, como nos serviços de autorização (sem o nível extra da Distribuição).
   */
  private async enviarLoteEventos(url: string, idLote: string, eventosAssinados: string[]): Promise<string> {
    if (eventosAssinados.length === 0 || eventosAssinados.length > 20) {
      throw new Error(`Um lote de eventos precisa ter de 1 a 20 eventos (recebeu ${eventosAssinados.length}).`)
    }
    const corpo =
      `<envEvento xmlns="${NFE_NS}" versao="1.00">` +
        `<idLote>${idLote}</idLote>` +
        eventosAssinados.join('') +
      `</envEvento>`
    return this.soapRequest(url, 'NFeRecepcaoEvento4', 'nfeRecepcaoEvento', corpo)
  }

  /** Manifestação do destinatário: vai para o Ambiente Nacional. */
  async enviarEventosAN(idLote: string, eventosAssinados: string[]): Promise<string> {
    return this.enviarLoteEventos(this.urls.recepcaoEventoAN, idLote, eventosAssinados)
  }

  /** Eventos do emitente sobre a própria nota (cancelamento): vão para a Sefaz-SP. */
  async enviarEventoSefaz(idLote: string, eventoAssinado: string): Promise<string> {
    return this.enviarLoteEventos(this.urls.recepcaoEvento, idLote, [eventoAssinado])
  }
}
