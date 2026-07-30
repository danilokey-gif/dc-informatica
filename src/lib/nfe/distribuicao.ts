import { gunzipSync } from 'zlib'

export interface DocumentoImportado {
  nsu: string
  schema: string
  chaveAcesso: string
  xml: string
  valorTotal: number | null
  destinatarioNome: string | null
  destinatarioDocumento: string | null
  emitenteCnpj: string | null
}

export interface RetDistDFeInt {
  cStat: string
  xMotivo: string
  ultNSU: string
  maxNSU: string
  documentos: DocumentoImportado[]
}

function extrairTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))
  return match ? match[1] : null
}

/**
 * Faz o parse da resposta SOAP do serviço de Distribuição de DF-e: extrai cStat/xMotivo/ultNSU/maxNSU
 * e descompacta cada `docZip` (gzip+base64) do lote, um por NF-e ou evento retornado.
 * Só processa `docZip` com schema `procNFe` (NF-e completa + protocolo) ou `resNFe` (resumo) —
 * outros tipos (eventos) são ignorados por enquanto.
 */
export function parseRetDistDFeInt(soapXml: string): RetDistDFeInt {
  const cStat = extrairTag(soapXml, 'cStat') || ''
  const xMotivo = extrairTag(soapXml, 'xMotivo') || ''
  const ultNSU = extrairTag(soapXml, 'ultNSU') || '000000000000000'
  const maxNSU = extrairTag(soapXml, 'maxNSU') || '000000000000000'

  const documentos: DocumentoImportado[] = []
  const docZipRegex = /<docZip NSU="(\d+)" schema="([^"]+)">([^<]+)<\/docZip>/g
  let m: RegExpExecArray | null
  while ((m = docZipRegex.exec(soapXml)) !== null) {
    const [, nsu, schema, base64Content] = m
    if (!schema.startsWith('procNFe') && !schema.startsWith('resNFe')) continue

    const xml = gunzipSync(Buffer.from(base64Content, 'base64')).toString('utf-8')
    const chaveAcesso = xml.match(/Id="NFe(\d{44})"/)?.[1] || xml.match(/<chNFe>(\d{44})<\/chNFe>/)?.[1] || ''
    if (!chaveAcesso) continue

    const valorTotalStr = extrairTag(xml, 'vNF')
    const destNome = extrairTag(xml, 'xNome')
    const destCnpj = extrairTag(xml, 'CNPJ')
    const destCpf = extrairTag(xml, 'CPF')
    const emitCnpj = xml.match(/<emit>[\s\S]*?<CNPJ>(\d+)<\/CNPJ>/)?.[1] || null

    documentos.push({
      nsu,
      schema,
      chaveAcesso,
      xml,
      valorTotal: valorTotalStr ? parseFloat(valorTotalStr) : null,
      destinatarioNome: destNome,
      destinatarioDocumento: destCnpj || destCpf,
      emitenteCnpj: emitCnpj,
    })
  }

  return { cStat, xMotivo, ultNSU, maxNSU, documentos }
}
