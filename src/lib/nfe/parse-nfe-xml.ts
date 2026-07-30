export interface NfeItemParseado {
  codigo: string
  descricao: string
  ncm: string
  cfop: string
  unidade: string
  quantidade: number
  valorUnitario: number
  valorTotal: number
}

export interface NfeXmlParseado {
  chaveAcesso: string
  numero: string
  serie: string
  dhEmi: string | null
  natOp: string | null
  emitCnpj: string | null
  emitNome: string | null
  emitLogradouro: string | null
  emitNumero: string | null
  emitBairro: string | null
  emitCep: string | null
  emitMunicipio: string | null
  emitUf: string | null
  emitIe: string | null
  destDocumento: string | null
  destNome: string | null
  destLogradouro: string | null
  destNumero: string | null
  destBairro: string | null
  destCep: string | null
  destMunicipio: string | null
  destUf: string | null
  itens: NfeItemParseado[]
  vProd: number | null
  vNF: number | null
  formaPagamento: string | null
  nProt: string | null
}

function tag(xml: string, nome: string): string | null {
  return xml.match(new RegExp(`<${nome}>([^<]*)</${nome}>`))?.[1] || null
}

function bloco(xml: string, nome: string): string | null {
  return xml.match(new RegExp(`<${nome}[^>]*>([\\s\\S]*?)</${nome}>`))?.[1] || null
}

const TPAG_LABEL: Record<string, string> = {
  '01': 'Dinheiro', '02': 'Cheque', '03': 'Cartão de Crédito', '04': 'Cartão de Débito',
  '05': 'Crédito Loja', '10': 'Vale Alimentação', '11': 'Vale Refeição', '12': 'Vale Presente',
  '13': 'Vale Combustível', '15': 'Boleto Bancário', '17': 'Pagamento Instantâneo (PIX)',
  '90': 'Sem Pagamento', '99': 'Outros',
}

/** Extrai os campos necessários pro DANFE direto do XML real da NF-e (o que o Sefaz devolve/assina). */
export function parseNfeXml(xmlOriginal: string, xmlProtocoloExtra?: string | null): NfeXmlParseado {
  const xml = xmlOriginal
  const chaveAcesso = xml.match(/Id="NFe(\d{44})"/)?.[1] || xml.match(/<chNFe>(\d{44})<\/chNFe>/)?.[1] || ''

  const ide = bloco(xml, 'ide') || ''
  const numero = tag(ide, 'nNF') || ''
  const serie = tag(ide, 'serie') || ''
  const dhEmi = tag(ide, 'dhEmi')
  const natOp = tag(ide, 'natOp')

  const emit = bloco(xml, 'emit') || ''
  const enderEmit = bloco(emit, 'enderEmit') || ''
  const emitCnpj = tag(emit, 'CNPJ')
  const emitNome = tag(emit, 'xNome')
  const emitIe = tag(emit, 'IE')
  const emitLogradouro = tag(enderEmit, 'xLgr')
  const emitNumero = tag(enderEmit, 'nro')
  const emitBairro = tag(enderEmit, 'xBairro')
  const emitCep = tag(enderEmit, 'CEP')
  const emitMunicipio = tag(enderEmit, 'xMun')
  const emitUf = tag(enderEmit, 'UF')

  const dest = bloco(xml, 'dest') || ''
  const enderDest = bloco(dest, 'enderDest') || ''
  const destDocumento = tag(dest, 'CNPJ') || tag(dest, 'CPF')
  const destNome = tag(dest, 'xNome')
  const destLogradouro = tag(enderDest, 'xLgr')
  const destNumero = tag(enderDest, 'nro')
  const destBairro = tag(enderDest, 'xBairro')
  const destCep = tag(enderDest, 'CEP')
  const destMunicipio = tag(enderDest, 'xMun')
  const destUf = tag(enderDest, 'UF')

  const itens: NfeItemParseado[] = []
  const detRegex = /<det[^>]*>([\s\S]*?)<\/det>/g
  let m: RegExpExecArray | null
  while ((m = detRegex.exec(xml)) !== null) {
    const det = m[1]
    const prod = bloco(det, 'prod') || ''
    itens.push({
      codigo: tag(prod, 'cProd') || '-',
      descricao: tag(prod, 'xProd') || '-',
      ncm: tag(prod, 'NCM') || '-',
      cfop: tag(prod, 'CFOP') || '-',
      unidade: tag(prod, 'uCom') || 'UN',
      quantidade: parseFloat(tag(prod, 'qCom') || '0'),
      valorUnitario: parseFloat(tag(prod, 'vUnCom') || '0'),
      valorTotal: parseFloat(tag(prod, 'vProd') || '0'),
    })
  }

  const total = bloco(xml, 'ICMSTot') || ''
  const vProd = total ? parseFloat(tag(total, 'vProd') || '0') : null
  const vNF = total ? parseFloat(tag(total, 'vNF') || '0') : null

  const detPag = bloco(xml, 'detPag') || ''
  const tPag = tag(detPag, 'tPag')
  const formaPagamento = tPag ? (TPAG_LABEL[tPag] || tPag) : null

  const nProt = tag(xml, 'nProt') || (xmlProtocoloExtra ? tag(xmlProtocoloExtra, 'nProt') : null)

  return {
    chaveAcesso,
    numero,
    serie,
    dhEmi,
    natOp,
    emitCnpj,
    emitNome,
    emitLogradouro,
    emitNumero,
    emitBairro,
    emitCep,
    emitMunicipio,
    emitUf,
    emitIe,
    destDocumento,
    destNome,
    destLogradouro,
    destNumero,
    destBairro,
    destCep,
    destMunicipio,
    destUf,
    itens,
    vProd,
    vNF,
    formaPagamento,
    nProt,
  }
}
