/**
 * Leitura da NF-e original para montar a nota de devolução: itens, valores e a outra parte
 * (fornecedor, na devolução de compra; cliente, na devolução de venda).
 */
import type { NfeDestinatario } from './xml'

export interface ItemOriginal {
  nItem: number
  codigo: string
  gtin: string | null
  descricao: string
  ncm: string
  unidade: string
  quantidade: number
  /** Valor unitário líquido de desconto, como ficou na nota original. */
  valorUnitario: number
}

export interface NotaOriginal {
  chave: string
  numero: string
  dataEmissao: string | null
  itens: ItemOriginal[]
  /** Quem recebe a nota de devolução. */
  parte: NfeDestinatario
  /** CPF/CNPJ do emitente e do destinatário da nota original (para conferir se é da empresa). */
  documentoEmitente: string
  documentoDestinatario: string
}

function bloco(xml: string, nome: string): string {
  return xml.match(new RegExp(`<${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</${nome}>`))?.[1] ?? ''
}
function blocos(xml: string, nome: string): string[] {
  return [...xml.matchAll(new RegExp(`<${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</${nome}>`, 'g'))].map(m => m[1])
}
function tag(xml: string, nome: string): string {
  return bloco(xml, nome).trim()
}
const num = (v: string) => Number(v || 0)
const gtinValido = (g: string) => /^\d{8}$|^\d{12,14}$/.test(g)

/**
 * Lê a NF-e original. `tipo` diz quem é a outra parte: na devolução de compra é o emitente da
 * nota (fornecedor); na devolução de venda é o destinatário (cliente).
 */
export function lerNotaOriginal(xml: string, tipo: 'compra' | 'venda'): NotaOriginal {
  const inf = bloco(xml, 'infNFe')
  const chave = xml.match(/Id="NFe(\d{44})"/)?.[1]
  if (!inf || !chave) throw new Error('XML da nota original incompleto (sem a chave de acesso ou os itens).')
  const ide = bloco(inf, 'ide')

  const itens = [...inf.matchAll(/<det nItem="(\d+)"[^>]*>([\s\S]*?)<\/det>/g)].map(m => {
    const prod = bloco(m[2], 'prod')
    const q = num(tag(prod, 'qCom'))
    const liquido = num(tag(prod, 'vProd')) - num(tag(prod, 'vDesc'))
    const gtin = [tag(prod, 'cEAN'), tag(prod, 'cEANTrib')].find(gtinValido) || null
    return {
      nItem: Number(m[1]),
      codigo: tag(prod, 'cProd'),
      gtin,
      descricao: tag(prod, 'xProd'),
      ncm: tag(prod, 'NCM'),
      unidade: tag(prod, 'uCom') || 'UN',
      quantidade: q,
      valorUnitario: q > 0 ? Math.round((liquido / q) * 1e10) / 1e10 : num(tag(prod, 'vUnCom')),
    }
  })

  const grupo = tipo === 'compra' ? bloco(inf, 'emit') : bloco(inf, 'dest')
  const end = bloco(grupo, tipo === 'compra' ? 'enderEmit' : 'enderDest')
  const parte: NfeDestinatario = {
    documento: tag(grupo, 'CNPJ') || tag(grupo, 'CPF') || undefined,
    nome: tag(grupo, 'xNome'),
    inscricaoEstadual: tag(grupo, 'IE') || null,
    endereco: end ? {
      logradouro: tag(end, 'xLgr'),
      numero: tag(end, 'nro') || 'S/N',
      bairro: tag(end, 'xBairro'),
      codigoMunicipio: tag(end, 'cMun'),
      nomeMunicipio: tag(end, 'xMun'),
      uf: tag(end, 'UF'),
      cep: tag(end, 'CEP'),
    } : undefined,
  }

  const emit = bloco(inf, 'emit'), dest = bloco(inf, 'dest')
  return {
    chave, numero: tag(ide, 'nNF'), dataEmissao: tag(ide, 'dhEmi') || null, itens, parte,
    documentoEmitente: tag(emit, 'CNPJ') || tag(emit, 'CPF'),
    documentoDestinatario: tag(dest, 'CNPJ') || tag(dest, 'CPF'),
  }
}

/** A nota original é da empresa? Compra: destinatário = CNPJ da empresa. Venda: emitente = CNPJ da empresa. */
export function notaEhDaEmpresa(original: NotaOriginal, tipo: 'compra' | 'venda', cnpjEmpresa: string): boolean {
  const cnpj = cnpjEmpresa.replace(/[^0-9]/g, '')
  return (tipo === 'compra' ? original.documentoDestinatario : original.documentoEmitente) === cnpj
}

/** Quantidade já devolvida de cada item (pelo código do produto) nas devoluções anteriores. */
export function quantidadesDevolvidas(xmlsDevolucoes: (string | null)[]): Map<string, number> {
  const total = new Map<string, number>()
  for (const xml of xmlsDevolucoes) {
    if (!xml) continue
    for (const det of blocos(xml, 'det')) {
      const prod = bloco(det, 'prod')
      const cod = tag(prod, 'cProd')
      total.set(cod, (total.get(cod) ?? 0) + num(tag(prod, 'qCom')))
    }
  }
  return total
}
