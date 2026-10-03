/**
 * DANFE da NF-e (modelo 55), retrato, gerado a partir do XML da nota.
 *
 * Segue o modelo de referência da Nota Técnica 2026.010 v1.00 (Reforma Tributária, publicada em
 * 01/10/2026 no portal nacional da NF-e), que mantém a estrutura do DANFE atual e acrescenta:
 * o Código do Regime Tributário e o campo reservado do regime de apuração do IBS/CBS no quadro do
 * emitente (4.2), o bloco "Total do IBS/CBS/IS" (4.1) e as bases, alíquotas e valores de IBS, CBS
 * e IS em cada item (4.3). Esses acréscimos passam a ser impressos em 01/12/2026, data de início
 * do novo modelo em produção; antes disso o DANFE sai sem eles.
 *
 * Como a NT determina (4.4), nada é impresso se não estiver no XML: quadros facultativos
 * (canhoto, fatura, FCP/DIFAL/monofásico, ISSQN, transportador, QR Code) só aparecem quando há
 * dado, e campos sem informação ficam em branco.
 */
import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'
import { gerarCode128Buffer } from '@/lib/barcode'

/** Início do modelo de DANFE da Reforma Tributária em produção (NT 2026.010). */
export const INICIO_DANFE_RTC = new Date('2026-12-01T03:00:00Z') // 00:00 de Brasília

// ───────────────────────────── leitura do XML ─────────────────────────────

function bloco(xml: string | null | undefined, nome: string): string | null {
  if (!xml) return null
  return xml.match(new RegExp(`<${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</${nome}>`))?.[1] ?? null
}

function blocos(xml: string | null | undefined, nome: string): string[] {
  if (!xml) return []
  return [...xml.matchAll(new RegExp(`<${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</${nome}>`, 'g'))].map(m => m[1])
}

function tag(xml: string | null | undefined, nome: string): string | null {
  if (!xml) return null
  const v = xml.match(new RegExp(`<${nome}(?:\\s[^>]*)?>([^<]*)</${nome}>`))?.[1]
  return v === undefined ? null : v.trim().replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
}

// ─────────────────────────────── formatação ───────────────────────────────

function documento(d: string | null): string {
  if (!d) return ''
  if (/^\d{14}$/.test(d)) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  if (/^\d{11}$/.test(d)) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  return d
}
const cep = (c: string | null) => (c && /^\d{8}$/.test(c) ? c.replace(/^(\d{5})(\d{3})$/, '$1-$2') : c || '')
function telefone(f: string | null): string {
  const d = (f || '').replace(/\D/g, '')
  if (d.length === 10) return d.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3')
  if (d.length === 11) return d.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3')
  return f || ''
}
/** Data no fuso do próprio XML (ex.: 2026-08-02T15:45:33-03:00 → 02/08/2026). */
const data = (iso: string | null) => iso?.match(/^(\d{4})-(\d{2})-(\d{2})/)?.slice(1).reverse().join('/') ?? ''
const hora = (iso: string | null) => iso?.match(/T(\d{2}:\d{2}:\d{2})/)?.[1] ?? ''
function numero(v: string | null, casas = 2): string {
  if (v === null || v === '') return ''
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }) : v
}
const percentual = (v: string | null) => (v ? `${numero(v)}%` : '')
const numeroNota = (n: string | null) => (n || '').padStart(9, '0').replace(/^(\d{3})(\d{3})(\d{3})$/, '$1.$2.$3')

const CRT: Record<string, string> = {
  '1': '1 - SIMPLES NACIONAL',
  '2': '2 - SIMPLES NACIONAL - EXCESSO DE SUBLIMITE DE RECEITA BRUTA',
  '3': '3 - REGIME NORMAL',
  '4': '4 - SIMPLES NACIONAL - MICROEMPREENDEDOR INDIVIDUAL (MEI)',
}
const MOD_FRETE: Record<string, string> = {
  '0': '0 - Remetente', '1': '1 - Destinatário', '2': '2 - Terceiros',
  '3': '3 - Próprio Remetente', '4': '4 - Próprio Destinatário', '9': '9 - Sem Frete',
}

// ─────────────────────────────── dados ───────────────────────────────

interface Item {
  descricao: string
  infAdProd: string | null
  ncmClass: string
  cstCfop: [string, string]
  qtdUn: [string, string]
  vUnit: string
  vTotal: string
  bases: string[]
  aliquotas: string[]
  valores: string[]
}

function lerItem(det: string, rtc: boolean): Item {
  const prod = bloco(det, 'prod') || ''
  const imposto = bloco(det, 'imposto') || ''
  const icmsGrupo = bloco(imposto, 'ICMS') || ''
  const orig = tag(icmsGrupo, 'orig') || ''
  const cst = tag(icmsGrupo, 'CST')
  const csosn = tag(icmsGrupo, 'CSOSN')
  const ipi = bloco(imposto, 'IPITrib')
  const ibscbs = bloco(imposto, 'IBSCBS')
  const g = bloco(ibscbs, 'gIBSCBS')
  const gUF = bloco(g, 'gIBSUF'), gMun = bloco(g, 'gIBSMun'), gCBS = bloco(g, 'gCBS')
  const is = bloco(imposto, 'IS')

  // Linhas de tributo: só as que existem no XML (NT 2026.010, item 4.4).
  const bases: string[] = [], aliquotas: string[] = [], valores: string[] = []
  const vBCICMS = tag(icmsGrupo, 'vBC')
  if (vBCICMS) {
    bases.push(`ICMS ${numero(vBCICMS)}`)
    aliquotas.push(`ICMS ${percentual(tag(icmsGrupo, 'pICMS'))}`)
    valores.push(`ICMS ${numero(tag(icmsGrupo, 'vICMS'))}`)
  }
  if (rtc && g) {
    // Com redução de alíquota (gRed) vale a alíquota efetiva; sem ela, a alíquota vigente.
    const aliq = (grupo: string | null, nome: string) => tag(bloco(grupo, 'gRed'), 'pAliqEfet') || tag(grupo, nome)
    bases.push(`IBS / CBS ${numero(tag(g, 'vBC'))}`)
    aliquotas.push(`CBS ${percentual(aliq(gCBS, 'pCBS'))}`, `IBS UF ${percentual(aliq(gUF, 'pIBSUF'))}`, `IBS MUN ${percentual(aliq(gMun, 'pIBSMun'))}`)
    valores.push(`CBS ${numero(tag(gCBS, 'vCBS'))}`, `IBS UF ${numero(tag(gUF, 'vIBSUF'))}`, `IBS MUN ${numero(tag(gMun, 'vIBSMun'))}`)
  }
  if (rtc && is) {
    bases.push(`IS ${numero(tag(is, 'vBCIS'))}`)
    aliquotas.push(`IS ${percentual(tag(is, 'pIS'))}`)
    valores.push(`IS ${numero(tag(is, 'vIS'))}`)
  }
  if (ipi && tag(ipi, 'vBC')) {
    bases.push(`IPI ${numero(tag(ipi, 'vBC'))}`)
    aliquotas.push(`IPI ${percentual(tag(ipi, 'pIPI'))}`)
    valores.push(`IPI ${numero(tag(ipi, 'vIPI'))}`)
  }

  const cClassTrib = rtc ? tag(ibscbs, 'cClassTrib') : null
  return {
    descricao: tag(prod, 'xProd') || '',
    infAdProd: tag(det, 'infAdProd'),
    ncmClass: `[NCM ${tag(prod, 'NCM') || ''}]${cClassTrib ? ` [cClassTrib ${cClassTrib}]` : ''}`,
    cstCfop: [csosn ? `CSOSN ${orig}${csosn}` : `CST ${orig}${cst || ''}`, `CFOP ${tag(prod, 'CFOP') || ''}`],
    qtdUn: [numero(tag(prod, 'qCom'), 4), tag(prod, 'uCom') || ''],
    vUnit: numero(tag(prod, 'vUnCom'), 4),
    vTotal: numero(tag(prod, 'vProd')),
    bases, aliquotas, valores,
  }
}

// ──────────────────────────────── desenho ────────────────────────────────

const MARGEM = 18
const LARGURA = 595.28 - MARGEM * 2
const ALTURA_PAGINA = 841.89
const LIMITE = ALTURA_PAGINA - MARGEM
const COR_ROTULO = '#555555'
const CINZA_TITULO = '#EFEFEF'

type Doc = PDFKit.PDFDocument

/** Célula com rótulo pequeno em cima e conteúdo embaixo, cortado com reticências se não couber. */
function celula(doc: Doc, x: number, y: number, w: number, h: number, rotulo: string, valor: string, opcoes: { alinhar?: 'left' | 'right' | 'center'; tamanho?: number; negrito?: boolean } = {}) {
  doc.lineWidth(0.5).strokeColor('#000000').rect(x, y, w, h).stroke()
  doc.font('Helvetica').fontSize(5.5).fillColor(COR_ROTULO).text(rotulo, x + 2, y + 2, { width: w - 4, height: 7, ellipsis: true, lineBreak: false })
  const tamanho = opcoes.tamanho ?? 8
  doc.font(opcoes.negrito ? 'Helvetica-Bold' : 'Helvetica').fontSize(tamanho).fillColor('#000000')
    .text(valor, x + 2, y + h - tamanho - 3, { width: w - 4, height: tamanho + 2, ellipsis: true, lineBreak: false, align: opcoes.alinhar ?? 'left' })
}

function tituloQuadro(doc: Doc, y: number, titulo: string): number {
  doc.rect(MARGEM, y, LARGURA, 11).fillAndStroke(CINZA_TITULO, '#000000')
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#000000').text(titulo, MARGEM + 3, y + 2.5, { lineBreak: false })
  return y + 11
}

/** Linha de células com larguras proporcionais. */
function linha(doc: Doc, y: number, h: number, celulas: [string, string, number?, ('left' | 'right' | 'center')?][]): number {
  const total = celulas.reduce((s, c) => s + (c[2] ?? 1), 0)
  let x = MARGEM
  for (const [rotulo, valor, peso = 1, alinhar] of celulas) {
    const w = (LARGURA * peso) / total
    celula(doc, x, y, w, h, rotulo, valor, { alinhar })
    x += w
  }
  return y + h
}

interface Cabecalho {
  emitNome: string; emitEndereco: string[]; tpNF: string; numero: string; serie: string
  chave: string; natOp: string; protocolo: string; ie: string; iest: string; cnpj: string; crt: string | null
}

async function desenharCabecalho(doc: Doc, y: number, c: Cabecalho, folha: string, codigoBarras: Buffer, logo: Buffer | null, rtc: boolean): Promise<number> {
  const h = 92
  const wEmit = LARGURA * 0.37, wDanfe = LARGURA * 0.205, wChave = LARGURA - wEmit - wDanfe
  // Emitente
  doc.lineWidth(0.5).rect(MARGEM, y, wEmit, h).stroke()
  let ty = y + 8
  if (logo) {
    try { doc.image(logo, MARGEM + 4, y + 6, { fit: [wEmit - 8, 30], align: 'center' }); ty = y + 40 } catch { /* logo inválido: segue sem */ }
  }
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#000000').text(c.emitNome, MARGEM + 4, ty, { width: wEmit - 8, align: 'center', height: 24, ellipsis: true })
  doc.font('Helvetica').fontSize(7).text(c.emitEndereco.join('\n'), MARGEM + 4, doc.y + 2, { width: wEmit - 8, align: 'center', height: y + h - doc.y - 4, ellipsis: true })
  // DANFE
  const xD = MARGEM + wEmit
  doc.rect(xD, y, wDanfe, h).stroke()
  doc.font('Helvetica-Bold').fontSize(12).text('DANFE', xD, y + 5, { width: wDanfe, align: 'center' })
  doc.font('Helvetica').fontSize(5.5).text('DOCUMENTO AUXILIAR DA\nNOTA FISCAL ELETRÔNICA', xD, y + 20, { width: wDanfe, align: 'center' })
  doc.fontSize(7).text('0 - ENTRADA\n1 - SAÍDA', xD + 8, y + 40)
  doc.rect(xD + wDanfe - 26, y + 40, 16, 16).stroke()
  doc.font('Helvetica-Bold').fontSize(11).text(c.tpNF, xD + wDanfe - 26, y + 43, { width: 16, align: 'center' })
  doc.font('Helvetica-Bold').fontSize(8).text(`Nº ${c.numero}`, xD, y + 62, { width: wDanfe, align: 'center' })
  doc.font('Helvetica').fontSize(7.5).text(`SÉRIE ${c.serie}   FOLHA ${folha}`, xD, y + 73, { width: wDanfe, align: 'center' })
  // Chave de acesso
  const xC = xD + wDanfe
  doc.rect(xC, y, wChave, h).stroke()
  doc.image(codigoBarras, xC + 8, y + 4, { width: wChave - 16, height: 30 })
  doc.moveTo(xC, y + 38).lineTo(xC + wChave, y + 38).stroke()
  doc.font('Helvetica').fontSize(5.5).fillColor(COR_ROTULO).text('CHAVE DE ACESSO', xC + 3, y + 40)
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#000000').text(c.chave.replace(/(\d{4})(?=\d)/g, '$1 '), xC, y + 50, { width: wChave, align: 'center' })
  doc.moveTo(xC, y + 64).lineTo(xC + wChave, y + 64).stroke()
  doc.font('Helvetica').fontSize(6.5).text('Consulte a autenticidade no portal nacional da NF-e www.nfe.fazenda.gov.br/portal ou no site da SEFAZ autorizadora', xC + 4, y + 69, { width: wChave - 8, align: 'center' })
  y += h

  // Natureza / protocolo / inscrições
  y = linha(doc, y, 20, [['NATUREZA DA OPERAÇÃO', c.natOp, 1], ['PROTOCOLO DE AUTORIZAÇÃO DE USO', c.protocolo, 1, 'right']])
  y = linha(doc, y, 20, [['INSCRIÇÃO ESTADUAL', c.ie, 1], ['INSCRIÇÃO ESTADUAL DO SUBSTITUTO TRIBUTÁRIO', c.iest, 1.2], ['CNPJ / CPF', c.cnpj, 0.9, 'right']])
  if (rtc) {
    // NT 2026.010, 4.2: CRT e campo reservado do regime de apuração do IBS/CBS (não preencher
    // enquanto não houver tag publicada).
    y = linha(doc, y, 20, [['CÓDIGO DO REGIME TRIBUTÁRIO', c.crt ? (CRT[c.crt] ?? c.crt) : '', 1], ['TIPO DE REGIME DE APURAÇÃO DO IBS E DA CBS', '', 1]])
  }
  return y
}

/** Tudo o que o desenho precisa, já lido do XML. */
interface Nota {
  rtc: boolean
  cab: Cabecalho
  ide: string; emit: string; dest: string | null; enderDest: string | null
  total: string; icmsTot: string; ibsTot: string | null; issqnTot: string | null
  transp: string | null; transporta: string | null; veiculo: string | null; vol: string | null
  cobr: string | null; infAdic: string | null; qrCode: string | null
  itens: Item[]
  logo: Buffer | null
  codigoBarras: Buffer
}

const COLUNAS = [0.28, 0.08, 0.08, 0.08, 0.085, 0.14, 0.12, 0.135].map(p => p * LARGURA)
const ALTURA_TITULO_ITENS = 3 + 11 + 16
const ALTURA_DADOS_ADICIONAIS = 110

function alturaItem(doc: Doc, it: Item): number {
  doc.font('Helvetica').fontSize(6.5)
  const desc = doc.heightOfString([it.descricao, it.infAdProd].filter(Boolean).join('\n'), { width: COLUNAS[0] - 4 }) + 9 // + linha do NCM
  const tributos = Math.max(it.bases.length, it.aliquotas.length, it.valores.length, 2) * 8
  return Math.max(desc, tributos) + 6
}

/** Quadros fixos da primeira folha (canhoto até transportador). Devolve onde começam os itens. */
async function desenharQuadrosPrimeiraFolha(doc: Doc, n: Nota, folha: string): Promise<number> {
  const { cab, ide, dest, enderDest, icmsTot, ibsTot, issqnTot, total, emit, transp, transporta, veiculo, vol, cobr, rtc } = n
  let y = MARGEM
  // Canhoto (facultativo pela NT 2026.010; mantido, como no DANFE atual)
  const wNfe = LARGURA * 0.18
  doc.lineWidth(0.5).strokeColor('#000000').rect(MARGEM, y, LARGURA - wNfe, 18).stroke()
  doc.font('Helvetica-Bold').fontSize(6).fillColor('#000000')
    .text(`RECEBEMOS DE ${cab.emitNome.toUpperCase()} OS PRODUTOS/SERVIÇOS CONSTANTES DA NOTA FISCAL ELETRÔNICA INDICADA AO LADO`, MARGEM + 3, y + 5, { width: LARGURA - wNfe - 6, height: 12, ellipsis: true })
  celula(doc, MARGEM, y + 18, (LARGURA - wNfe) * 0.3, 20, 'DATA DE RECEBIMENTO', '')
  celula(doc, MARGEM + (LARGURA - wNfe) * 0.3, y + 18, (LARGURA - wNfe) * 0.7, 20, 'IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR', '')
  doc.rect(MARGEM + LARGURA - wNfe, y, wNfe, 38).stroke()
  doc.font('Helvetica-Bold').fontSize(11).text('NF-e', MARGEM + LARGURA - wNfe, y + 5, { width: wNfe, align: 'center' })
  doc.font('Helvetica').fontSize(7.5).text(`Nº ${cab.numero}\nSÉRIE ${cab.serie}`, MARGEM + LARGURA - wNfe, y + 19, { width: wNfe, align: 'center' })
  y += 38
  doc.dash(2, { space: 2 }).moveTo(MARGEM, y + 4).lineTo(MARGEM + LARGURA, y + 4).stroke().undash()
  y += 8

  y = await desenharCabecalho(doc, y, cab, folha, n.codigoBarras, n.logo, rtc)

  // Destinatário / remetente
  y = tituloQuadro(doc, y + 3, 'DESTINATÁRIO / REMETENTE')
  y = linha(doc, y, 20, [['NOME / RAZÃO SOCIAL', tag(dest, 'xNome') || '', 2.6], ['CNPJ / CPF', documento(tag(dest, 'CNPJ') || tag(dest, 'CPF')) || tag(dest, 'idEstrangeiro') || '', 1.1], ['DATA DE EMISSÃO', data(tag(ide, 'dhEmi')), 0.8]])
  y = linha(doc, y, 20, [['ENDEREÇO', [tag(enderDest, 'xLgr'), tag(enderDest, 'nro'), tag(enderDest, 'xCpl')].filter(Boolean).join(', '), 2], ['BAIRRO / DISTRITO', tag(enderDest, 'xBairro') || '', 1.1], ['CEP', cep(tag(enderDest, 'CEP')), 0.6], ['DATA DE ENTRADA / SAÍDA', data(tag(ide, 'dhSaiEnt')), 0.8]])
  y = linha(doc, y, 20, [['MUNICÍPIO', tag(enderDest, 'xMun') || '', 1.4], ['FONE / FAX', telefone(tag(enderDest, 'fone')), 0.9], ['UF', tag(enderDest, 'UF') || '', 0.3], ['INSCRIÇÃO ESTADUAL', tag(dest, 'IE') || '', 1.1], ['HORA DE SAÍDA', hora(tag(ide, 'dhSaiEnt')), 0.8]])

  // Fatura / duplicatas (facultativo: só com dados no XML)
  const dups = blocos(cobr, 'dup')
  if (dups.length) {
    y = tituloQuadro(doc, y + 3, 'FATURA / DUPLICATAS')
    for (let i = 0; i < dups.length; i += 3) {
      y = linha(doc, y, 20, dups.slice(i, i + 3).flatMap(d => [
        ['FATURA/DUPLICATA', tag(d, 'nDup') || '', 1] as [string, string, number],
        ['VENCIMENTO', data(tag(d, 'dVenc')), 0.8] as [string, string, number],
        ['VALOR', numero(tag(d, 'vDup')), 0.8, 'right'] as [string, string, number, 'right'],
      ]))
    }
  }

  // Totais
  y = tituloQuadro(doc, y + 3, 'TOTAL DOS PRODUTOS E TOTAL DA NOTA')
  y = linha(doc, y, 20, [['VALOR TOTAL DOS PRODUTOS', numero(tag(icmsTot, 'vProd')), 1, 'right'], ['VALOR DO FRETE', numero(tag(icmsTot, 'vFrete')), 1, 'right'], ['VALOR DO SEGURO', numero(tag(icmsTot, 'vSeg')), 1, 'right'], ['DESCONTO', numero(tag(icmsTot, 'vDesc')), 1, 'right'], ['OUTRAS DESPESAS', numero(tag(icmsTot, 'vOutro')), 1, 'right'], ['VALOR TOTAL DA NOTA', numero(tag(icmsTot, 'vNF')), 1.1, 'right']])
  y = tituloQuadro(doc, y + 3, 'TOTAL DO ICMS / IPI')
  y = linha(doc, y, 20, [['BASE DE CÁLCULO DO ICMS', numero(tag(icmsTot, 'vBC')), 1, 'right'], ['VALOR DO ICMS', numero(tag(icmsTot, 'vICMS')), 1, 'right'], ['BASE DE CÁLCULO DO ICMS ST', numero(tag(icmsTot, 'vBCST')), 1, 'right'], ['VALOR DO ICMS ST', numero(tag(icmsTot, 'vST')), 1, 'right'], ['VALOR DO IPI', numero(tag(icmsTot, 'vIPI')), 1, 'right']])
  // Linhas condicionadas (FCP, DIFAL, monofásico): só quando houver valor no XML
  const temValor = (campo: string) => Number(tag(icmsTot, campo) || 0) > 0
  if (['vFCP', 'vFCPST', 'vICMSUFDest', 'vFCPUFDest'].some(temValor)) {
    y = linha(doc, y, 20, [['VALOR DO FCP', numero(tag(icmsTot, 'vFCP')), 1, 'right'], ['VALOR DO FCP RETIDO POR ST', numero(tag(icmsTot, 'vFCPST')), 1, 'right'], ['VALOR DO DIFAL NA UF DE DESTINO', numero(tag(icmsTot, 'vICMSUFDest')), 1, 'right'], ['VALOR DO FCP NA UF DE DESTINO', numero(tag(icmsTot, 'vFCPUFDest')), 1, 'right']])
  }
  if (['qBCMono', 'vICMSMono', 'qBCMonoReten', 'vICMSMonoReten'].some(temValor)) {
    y = linha(doc, y, 20, [['BC DO ICMS MONOFÁSICO', numero(tag(icmsTot, 'qBCMono')), 1, 'right'], ['VALOR DO ICMS MONOFÁSICO', numero(tag(icmsTot, 'vICMSMono')), 1, 'right'], ['BC DO ICMS MONOFÁSICO POR RETENÇÃO', numero(tag(icmsTot, 'qBCMonoReten')), 1, 'right'], ['VALOR DO ICMS MONOFÁSICO POR RETENÇÃO', numero(tag(icmsTot, 'vICMSMonoReten')), 1, 'right']])
  }
  if (rtc) {
    // NT 2026.010, 4.1: bloco obrigatório; campos em branco se a nota não tiver IBS/CBS/IS.
    const gIBS = bloco(ibsTot, 'gIBS'), gCBS = bloco(ibsTot, 'gCBS'), gMono = bloco(ibsTot, 'gMono')
    y = tituloQuadro(doc, y + 3, 'TOTAL DO IBS / CBS / IS')
    y = linha(doc, y, 20, [['VALOR DA CBS', numero(tag(gCBS, 'vCBS')), 1, 'right'], ['VALOR DO IBS UF', numero(tag(bloco(gIBS, 'gIBSUF'), 'vIBSUF')), 1, 'right'], ['VALOR DO IBS MUNICÍPIO', numero(tag(bloco(gIBS, 'gIBSMun'), 'vIBSMun')), 1, 'right'], ['VALOR DO IMPOSTO SELETIVO', numero(tag(bloco(total, 'ISTot'), 'vIS')), 1, 'right']])
    if (gMono) {
      y = linha(doc, y, 20, [['VALOR DO IBS MONOFÁSICO', numero(tag(gMono, 'vIBSMono')), 1, 'right'], ['VALOR DA CBS MONOFÁSICA', numero(tag(gMono, 'vCBSMono')), 1, 'right'], ['VALOR DO IBS MONOFÁSICO POR RETENÇÃO', numero(tag(gMono, 'vIBSMonoReten')), 1, 'right'], ['VALOR DA CBS MONOFÁSICA POR RETENÇÃO', numero(tag(gMono, 'vCBSMonoReten')), 1, 'right']])
    }
  }
  // ISSQN (facultativo)
  if (issqnTot && Number(tag(issqnTot, 'vServ') || 0) > 0) {
    y = tituloQuadro(doc, y + 3, 'CÁLCULO DO ISSQN')
    y = linha(doc, y, 20, [['INSCRIÇÃO MUNICIPAL', tag(emit, 'IM') || '', 1], ['VALOR TOTAL DOS SERVIÇOS', numero(tag(issqnTot, 'vServ')), 1, 'right'], ['BASE DE CÁLCULO DO ISSQN', numero(tag(issqnTot, 'vBC')), 1, 'right'], ['VALOR DO ISSQN', numero(tag(issqnTot, 'vISS')), 1, 'right']])
  }
  // Transportador (facultativo: só com transportadora, veículo ou volumes)
  if (transporta || veiculo || vol) {
    y = tituloQuadro(doc, y + 3, 'TRANSPORTADOR / VOLUMES TRANSPORTADOS')
    y = linha(doc, y, 20, [['RAZÃO SOCIAL', tag(transporta, 'xNome') || '', 2], ['FRETE POR CONTA', MOD_FRETE[tag(transp, 'modFrete') || ''] || '', 1], ['CÓDIGO ANTT', tag(veiculo, 'RNTC') || '', 0.8], ['PLACA DO VEÍCULO', tag(veiculo, 'placa') || '', 0.8], ['UF', tag(veiculo, 'UF') || '', 0.3], ['CNPJ / CPF', documento(tag(transporta, 'CNPJ') || tag(transporta, 'CPF')), 1.2]])
    y = linha(doc, y, 20, [['ENDEREÇO', tag(transporta, 'xEnder') || '', 2], ['MUNICÍPIO', tag(transporta, 'xMun') || '', 1.2], ['UF', tag(transporta, 'UF') || '', 0.3], ['INSCRIÇÃO ESTADUAL', tag(transporta, 'IE') || '', 1]])
    y = linha(doc, y, 20, [['QUANTIDADE', tag(vol, 'qVol') || '', 0.8], ['ESPÉCIE', tag(vol, 'esp') || '', 1], ['MARCA', tag(vol, 'marca') || '', 1], ['NUMERAÇÃO', tag(vol, 'nVol') || '', 1], ['PESO BRUTO', tag(vol, 'pesoB') ? `${numero(tag(vol, 'pesoB'), 3)} kg` : '', 1, 'right'], ['PESO LÍQUIDO', tag(vol, 'pesoL') ? `${numero(tag(vol, 'pesoL'), 3)} kg` : '', 1, 'right']])
  }
  return y
}

function desenharTabelaItens(doc: Doc, n: Nota, y: number, indices: number[], alturas: number[]): number {
  y = tituloQuadro(doc, y + 3, 'DADOS DOS PRODUTOS / SERVIÇOS')
  const titulos = ['DESCRIÇÃO DO PRODUTO / SERVIÇO', 'CST / CFOP', 'QTD / UN', 'VLR UNIT', 'VLR TOTAL', 'BASES DE CÁLCULO', 'ALÍQUOTAS', 'VALOR DOS TRIBUTOS']
  let x = MARGEM
  titulos.forEach((t, i) => {
    doc.lineWidth(0.5).strokeColor('#000000').rect(x, y, COLUNAS[i], 16).stroke()
    doc.font('Helvetica-Bold').fontSize(5.8).fillColor('#000000').text(t, x + 1, y + 3, { width: COLUNAS[i] - 2, align: 'center', height: 12 })
    x += COLUNAS[i]
  })
  y += 16
  for (const indice of indices) {
    const it = n.itens[indice], h = alturas[indice]
    const textos: [string, 'left' | 'right' | 'center'][] = [
      [[it.descricao, it.infAdProd].filter(Boolean).join('\n'), 'left'],
      [it.cstCfop.join('\n'), 'left'],
      [it.qtdUn.join('\n'), 'center'],
      [it.vUnit, 'right'],
      [it.vTotal, 'right'],
      [it.bases.join('\n'), 'right'],
      [it.aliquotas.join('\n'), 'right'],
      [it.valores.join('\n'), 'right'],
    ]
    let xx = MARGEM
    textos.forEach(([texto, alinhar], i) => {
      doc.lineWidth(0.5).rect(xx, y, COLUNAS[i], h).stroke()
      doc.font('Helvetica').fontSize(6.5).fillColor('#000000').text(texto, xx + 2, y + 3, { width: COLUNAS[i] - 4, align: alinhar })
      if (i === 0) doc.fontSize(6).fillColor(COR_ROTULO).text(it.ncmClass, xx + 2, y + h - 9, { width: COLUNAS[0] - 4, align: 'right', lineBreak: false })
      xx += COLUNAS[i]
    })
    y += h
  }
  return y
}

async function desenharDadosAdicionais(doc: Doc, n: Nota) {
  let y = LIMITE - ALTURA_DADOS_ADICIONAIS - 14
  y = tituloQuadro(doc, y + 3, 'DADOS ADICIONAIS')
  const h = LIMITE - y
  const wQr = n.qrCode ? 105 : 0 // QR Code: facultativo, só quando existir no XML
  const wInfo = (LARGURA - wQr) * 0.62
  doc.lineWidth(0.5).strokeColor('#000000').rect(MARGEM, y, wInfo, h).stroke().rect(MARGEM + wInfo, y, LARGURA - wQr - wInfo, h).stroke()
  doc.font('Helvetica').fontSize(5.5).fillColor(COR_ROTULO).text('INFORMAÇÕES COMPLEMENTARES', MARGEM + 2, y + 2, { lineBreak: false })
  doc.text('RESERVADO AO FISCO', MARGEM + wInfo + 2, y + 2, { lineBreak: false })
  doc.fontSize(7).fillColor('#000000').text(tag(n.infAdic, 'infCpl') || '', MARGEM + 2, y + 10, { width: wInfo - 4, height: h - 12, ellipsis: true })
  const fisco = tag(n.infAdic, 'infAdFisco')
  if (fisco) doc.text(fisco, MARGEM + wInfo + 2, y + 10, { width: LARGURA - wQr - wInfo - 4, height: h - 12, ellipsis: true })
  if (n.qrCode) {
    const xq = MARGEM + LARGURA - wQr
    doc.rect(xq, y, wQr, h).stroke()
    doc.font('Helvetica-Bold').fontSize(7).text('QR CODE', xq, y + 3, { width: wQr, align: 'center' })
    doc.image(await QRCode.toBuffer(n.qrCode, { margin: 0, width: 300 }), xq + 12, y + 14, { width: wQr - 24 })
  }
}

/** Gera o PDF do DANFE a partir do XML da NF-e. O protocolo pode vir no próprio nfeProc ou à parte. */
export async function gerarDanfePdf(xmlNfe: string, opcoes: { xmlProtocolo?: string | null; cancelada?: boolean; logo?: Buffer | null; dataImpressao?: Date } = {}): Promise<Buffer> {
  const rtc = (opcoes.dataImpressao ?? new Date()) >= INICIO_DANFE_RTC
  const infNFe = bloco(xmlNfe, 'infNFe') || ''
  const ide = bloco(infNFe, 'ide') || ''
  const emit = bloco(infNFe, 'emit') || ''
  const ender = bloco(emit, 'enderEmit') || ''
  const dest = bloco(infNFe, 'dest')
  const total = bloco(infNFe, 'total') || ''
  const transp = bloco(infNFe, 'transp')
  const prot = bloco(xmlNfe, 'protNFe') || bloco(opcoes.xmlProtocolo, 'protNFe') || ''
  const chave = xmlNfe.match(/Id="NFe(\d{44})"/)?.[1] || tag(prot, 'chNFe') || ''

  const n: Nota = {
    rtc,
    cab: {
      emitNome: tag(emit, 'xNome') || '',
      emitEndereco: [
        [tag(ender, 'xLgr'), tag(ender, 'nro'), tag(ender, 'xCpl')].filter(Boolean).join(', ') + (tag(ender, 'xBairro') ? ` – ${tag(ender, 'xBairro')}` : ''),
        `${tag(ender, 'xMun') || ''}/${tag(ender, 'UF') || ''} – CEP ${cep(tag(ender, 'CEP'))}`,
        tag(ender, 'fone') ? `Fone: ${telefone(tag(ender, 'fone'))}` : '',
      ].filter(Boolean),
      tpNF: tag(ide, 'tpNF') || '1',
      numero: numeroNota(tag(ide, 'nNF')),
      serie: (tag(ide, 'serie') || '').padStart(3, '0'),
      chave,
      natOp: tag(ide, 'natOp') || '',
      protocolo: tag(prot, 'nProt') ? `${tag(prot, 'nProt')} – ${data(tag(prot, 'dhRecbto'))} ${hora(tag(prot, 'dhRecbto'))}` : '',
      ie: tag(emit, 'IE') || '',
      iest: tag(emit, 'IEST') || '',
      cnpj: documento(tag(emit, 'CNPJ') || tag(emit, 'CPF')),
      crt: tag(emit, 'CRT'),
    },
    ide, emit, dest, enderDest: bloco(dest, 'enderDest'),
    total, icmsTot: bloco(total, 'ICMSTot') || '', ibsTot: bloco(total, 'IBSCBSTot'), issqnTot: bloco(total, 'ISSQNtot'),
    transp, transporta: bloco(transp, 'transporta'), veiculo: bloco(transp, 'veicTransp'), vol: bloco(transp, 'vol'),
    cobr: bloco(infNFe, 'cobr'), infAdic: bloco(infNFe, 'infAdic'), qrCode: tag(xmlNfe, 'qrCode'),
    itens: blocos(infNFe, 'det').map(d => lerItem(d, rtc)),
    logo: opcoes.logo ?? null,
    codigoBarras: await gerarCode128Buffer(chave || '0'),
  }

  // ── Paginação. pdfkit não mede sem desenhar, então os quadros fixos da primeira folha são
  //    desenhados uma vez num documento descartável só para saber onde começam os itens.
  const medidor = new PDFDocument({ size: 'A4', margin: 0 })
  medidor.on('data', () => {})
  const yItensPrimeira = await desenharQuadrosPrimeiraFolha(medidor, n, '1/1')
  const alturas = n.itens.map(it => alturaItem(medidor, it))
  medidor.end()

  const limitePrimeira = LIMITE - ALTURA_DADOS_ADICIONAIS - 17
  const yItensDemais = MARGEM + 92 + 40 + (rtc ? 20 : 0)
  const paginas: number[][] = [[]]
  let usado = yItensPrimeira + ALTURA_TITULO_ITENS
  n.itens.forEach((_, i) => {
    const limite = paginas.length === 1 ? limitePrimeira : LIMITE
    if (usado + alturas[i] > limite && paginas[paginas.length - 1].length > 0) {
      paginas.push([])
      usado = yItensDemais + ALTURA_TITULO_ITENS
    }
    paginas[paginas.length - 1].push(i)
    usado += alturas[i]
  })

  const doc = new PDFDocument({ size: 'A4', margin: 0, info: { Title: `DANFE ${n.cab.numero}`, Creator: 'Dc Informática' } })
  const partes: Buffer[] = []
  const pronto = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', p => partes.push(p))
    doc.on('end', () => resolve(Buffer.concat(partes)))
    doc.on('error', reject)
  })

  const marca = opcoes.cancelada ? 'CANCELADA' : tag(ide, 'tpAmb') === '2' ? 'SEM VALOR FISCAL' : null
  for (let p = 0; p < paginas.length; p++) {
    if (p > 0) doc.addPage({ size: 'A4', margin: 0 })
    const folha = `${p + 1}/${paginas.length}`
    const y = p === 0
      ? await desenharQuadrosPrimeiraFolha(doc, n, folha)
      : await desenharCabecalho(doc, MARGEM, n.cab, folha, n.codigoBarras, n.logo, rtc)
    desenharTabelaItens(doc, n, y, paginas[p], alturas)
    if (p === 0) await desenharDadosAdicionais(doc, n)

    // Marca d'água: nota cancelada, ou emitida em homologação (sem valor fiscal).
    if (marca) {
      doc.save().rotate(-50, { origin: [297, 421] })
      doc.font('Helvetica-Bold').fontSize(marca === 'CANCELADA' ? 90 : 60).fillColor('#A6A6A6').fillOpacity(0.45)
        .text(marca, -100, 400, { width: 795, align: 'center', lineBreak: false })
      doc.restore()
    }
  }

  doc.end()
  return pronto
}

/** Logo da empresa guardado como data URL (Configurações) → imagem para o quadro do emitente. */
export function logoDeDataUrl(dataUrl: string | null | undefined): Buffer | null {
  const m = dataUrl?.match(/^data:image\/(png|jpe?g);base64,(.+)$/)
  return m ? Buffer.from(m[2], 'base64') : null
}
