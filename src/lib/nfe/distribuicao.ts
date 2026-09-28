import { gunzipSync } from 'zlib'

/**
 * Dados de uma NF-e extraídos do XML. Serve tanto para o resumo (resNFe) que a Distribuição DF-e
 * devolve quanto para a nota completa (nfeProc), venha ela da Sefaz ou de um arquivo importado.
 */
export interface DadosNfe {
  chaveAcesso: string
  emitenteCnpj: string | null
  emitenteNome: string | null
  emitenteIe: string | null
  destinatarioDocumento: string | null
  destinatarioNome: string | null
  numero: number | null
  serie: string | null
  valorTotal: number | null
  dataEmissao: Date | null
  /** 1 = autorizada, 2 = denegada, 3 = cancelada */
  situacao: string
  /** tpAmb do XML: '1' produção, '2' homologação */
  ambiente: string | null
  /** Número do protocolo de autorização, quando o XML traz o protNFe. */
  protocolo: string | null
  completa: boolean
}

export type DocumentoDistribuido =
  | ({ tipo: 'nfe'; nsu: string; schema: string; xml: string } & DadosNfe)
  | { tipo: 'evento'; nsu: string; schema: string; xml: string; chaveAcesso: string; tpEvento: string }

export interface RetDistDFeInt {
  cStat: string
  xMotivo: string
  ultNSU: string
  maxNSU: string
  documentos: DocumentoDistribuido[]
}

// Evento de cancelamento de NF-e (o emitente cancelou a nota depois de emitir).
export const TP_EVENTO_CANCELAMENTO = '110111'

function tag(xml: string, nome: string): string | null {
  const m = xml.match(new RegExp(`<${nome}(?:\\s[^>]*)?>([^<]*)</${nome}>`))
  return m ? m[1] : null
}

function bloco(xml: string, nome: string): string | null {
  // Dentro de template string, "\s" sozinho vira só "s": as barras precisam ser duplas.
  const m = xml.match(new RegExp(`<${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</${nome}>`))
  return m ? m[1] : null
}

function data(valor: string | null): Date | null {
  if (!valor) return null
  const d = new Date(valor)
  return isNaN(d.getTime()) ? null : d
}

function numero(valor: string | null): number | null {
  if (!valor) return null
  const n = parseFloat(valor)
  return isNaN(n) ? null : n
}

/**
 * Lê uma NF-e completa (nfeProc, ou NFe sem protocolo). Os dados do emitente saem do grupo <emit>
 * e os do destinatário do <dest> — pegar o primeiro <xNome> do documento, como era feito antes,
 * devolve sempre o EMITENTE, e foi assim que uma compra acabou registrada como venda.
 */
export function extrairDadosNfeCompleta(xml: string): DadosNfe | null {
  const chaveAcesso = xml.match(/Id="NFe(\d{44})"/)?.[1] || tag(xml, 'chNFe')
  if (!chaveAcesso || chaveAcesso.length !== 44) return null

  const emit = bloco(xml, 'emit') || ''
  const dest = bloco(xml, 'dest') || ''
  const ide = bloco(xml, 'ide') || ''
  const total = bloco(xml, 'ICMSTot') || ''
  const prot = bloco(xml, 'protNFe') || ''
  const cStatProt = prot ? tag(prot, 'cStat') : null

  return {
    chaveAcesso,
    emitenteCnpj: tag(emit, 'CNPJ') || tag(emit, 'CPF'),
    emitenteNome: tag(emit, 'xNome'),
    emitenteIe: tag(emit, 'IE'),
    destinatarioDocumento: tag(dest, 'CNPJ') || tag(dest, 'CPF'),
    destinatarioNome: tag(dest, 'xNome'),
    numero: numero(tag(ide, 'nNF')),
    serie: tag(ide, 'serie'),
    valorTotal: numero(tag(total, 'vNF')),
    dataEmissao: data(tag(ide, 'dhEmi') || tag(ide, 'dEmi')),
    // 110/301/302 = uso denegado; 100/150 = autorizada.
    situacao: cStatProt && ['110', '301', '302'].includes(cStatProt) ? '2' : '1',
    ambiente: tag(ide, 'tpAmb'),
    protocolo: prot ? tag(prot, 'nProt') : null,
    completa: true,
  }
}

/** Lê o resumo (resNFe) que a Sefaz manda antes do destinatário manifestar ciência. */
export function extrairDadosResumo(xml: string): DadosNfe | null {
  const chaveAcesso = tag(xml, 'chNFe')
  if (!chaveAcesso || chaveAcesso.length !== 44) return null
  return {
    chaveAcesso,
    // No resNFe, CNPJ/CPF, xNome e IE são do EMITENTE (quem vendeu pra nós).
    emitenteCnpj: tag(xml, 'CNPJ') || tag(xml, 'CPF'),
    emitenteNome: tag(xml, 'xNome'),
    emitenteIe: tag(xml, 'IE'),
    destinatarioDocumento: null,
    destinatarioNome: null,
    numero: parseInt(chaveAcesso.slice(25, 34), 10) || null,
    serie: String(parseInt(chaveAcesso.slice(22, 25), 10)),
    valorTotal: numero(tag(xml, 'vNF')),
    dataEmissao: data(tag(xml, 'dhEmi')),
    situacao: tag(xml, 'cSitNFe') || '1',
    ambiente: null,
    protocolo: tag(xml, 'nProt'),
    completa: false,
  }
}

/** Lê qualquer XML de NF-e, seja o resumo (resNFe) ou a nota completa (nfeProc / NFe). */
export function extrairDadosNfe(xml: string): DadosNfe | null {
  return /<resNFe[\s>]/.test(xml) ? extrairDadosResumo(xml) : extrairDadosNfeCompleta(xml)
}

/**
 * Faz o parse da resposta SOAP do serviço de Distribuição de DF-e: extrai cStat/xMotivo/ultNSU/maxNSU
 * e descompacta cada docZip (gzip + base64), separando notas (resumo ou completas) de eventos.
 */
export function parseRetDistDFeInt(soapXml: string): RetDistDFeInt {
  const cStat = tag(soapXml, 'cStat') || ''
  const xMotivo = tag(soapXml, 'xMotivo') || ''
  const ultNSU = tag(soapXml, 'ultNSU') || '000000000000000'
  const maxNSU = tag(soapXml, 'maxNSU') || '000000000000000'

  const documentos: DocumentoDistribuido[] = []
  const docZipRegex = /<docZip NSU="(\d+)" schema="([^"]+)">([^<]+)<\/docZip>/g
  let m: RegExpExecArray | null
  while ((m = docZipRegex.exec(soapXml)) !== null) {
    const [, nsu, schema, base64Content] = m
    const xml = gunzipSync(Buffer.from(base64Content, 'base64')).toString('utf-8')

    if (schema.startsWith('procNFe') || schema.startsWith('resNFe')) {
      const dados = schema.startsWith('procNFe') ? extrairDadosNfeCompleta(xml) : extrairDadosResumo(xml)
      if (dados) documentos.push({ tipo: 'nfe', nsu, schema, xml, ...dados })
    } else if (schema.startsWith('procEventoNFe') || schema.startsWith('resEvento')) {
      const chaveAcesso = tag(xml, 'chNFe')
      const tpEvento = tag(xml, 'tpEvento')
      if (chaveAcesso && tpEvento) documentos.push({ tipo: 'evento', nsu, schema, xml, chaveAcesso, tpEvento })
    }
  }

  return { cStat, xMotivo, ultNSU, maxNSU, documentos }
}
