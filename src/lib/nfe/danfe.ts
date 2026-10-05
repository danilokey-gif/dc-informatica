/**
 * DANFE da NF-e (modelo 55), retrato, gerado a partir do XML da nota.
 *
 * Leiaute tradicional do Manual do DANFE (o mesmo dos DANFEs de fornecedores): canhoto, quadro do
 * emitente/DANFE/chave, cálculo do imposto num quadro só, transportador, tabela de produtos com as
 * colunas clássicas, ISSQN e dados adicionais logo abaixo dos produtos.
 *
 * A partir de 01/12/2026 (NT 2026.010, modelo da Reforma Tributária) entram sozinhos: o Código do
 * Regime Tributário e o campo reservado do regime de apuração do IBS/CBS (4.2), o quadro "Total do
 * IBS/CBS/IS" (4.1) e, em cada item, cClassTrib e bases/alíquotas/valores de IBS, CBS e IS (4.3).
 * Nada é impresso que não esteja no XML (4.4).
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
/** Data e hora no fuso do próprio XML (ex.: 2026-08-02T15:45:33-03:00). */
const data = (iso: string | null) => iso?.match(/^(\d{4})-(\d{2})-(\d{2})/)?.slice(1).reverse().join('/') ?? ''
const hora = (iso: string | null) => iso?.match(/T(\d{2}:\d{2}:\d{2})/)?.[1] ?? ''
function numero(v: string | null, casas = 2): string {
  if (v === null || v === '') return ''
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }) : v
}
/** Quantidade sem zeros inúteis (1,0000 → 1; 2,5000 → 2,5). */
function quantidade(v: string | null): string {
  if (!v) return ''
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString('pt-BR', { maximumFractionDigits: 4 }) : v
}
const numeroNota = (n: string | null) => (n || '').padStart(9, '0').replace(/^(\d{3})(\d{3})(\d{3})$/, '$1.$2.$3')

const CRT: Record<string, string> = {
  '1': '1 - SIMPLES NACIONAL',
  '2': '2 - SIMPLES NACIONAL - EXCESSO DE SUBLIMITE DE RECEITA BRUTA',
  '3': '3 - REGIME NORMAL',
  '4': '4 - SIMPLES NACIONAL - MICROEMPREENDEDOR INDIVIDUAL (MEI)',
}
const MOD_FRETE: Record<string, string> = {
  '0': 'Emitente', '1': 'Destinatário', '2': 'Terceiros', '3': 'Próprio Rem.', '4': 'Próprio Dest.', '9': 'Sem Frete',
}

// ─────────────────────────────── itens ───────────────────────────────

interface Item {
  codigo: string
  descricao: string
  ncm: string
  cst: string
  cfop: string
  unidade: string
  quantidade: string
  vUnit: string
  vTotal: string
  bcIcms: string
  vIcms: string
  vIpi: string
  aliqIcms: string
  aliqIpi: string
  /** Linha extra com IBS/CBS/IS do item (só no modelo da Reforma e quando existir no XML). */
  rtc: string | null
}

function lerItem(det: string, rtc: boolean): Item {
  const prod = bloco(det, 'prod') || ''
  const imposto = bloco(det, 'imposto') || ''
  const icms = bloco(imposto, 'ICMS') || ''
  const ipi = bloco(imposto, 'IPITrib')
  let linhaRtc: string | null = null
  if (rtc) {
    const ibscbs = bloco(imposto, 'IBSCBS')
    const g = bloco(ibscbs, 'gIBSCBS')
    const is = bloco(imposto, 'IS')
    const partes: string[] = []
    if (tag(ibscbs, 'cClassTrib')) partes.push(`cClassTrib ${tag(ibscbs, 'cClassTrib')}`)
    if (g) {
      // Com redução de alíquota (gRed) vale a alíquota efetiva; sem ela, a vigente (NT 2026.010, 4.3).
      const aliq = (grupo: string | null, nome: string) => tag(bloco(grupo, 'gRed'), 'pAliqEfet') || tag(grupo, nome)
      const gUF = bloco(g, 'gIBSUF'), gMun = bloco(g, 'gIBSMun'), gCBS = bloco(g, 'gCBS')
      partes.push(`BC IBS/CBS ${numero(tag(g, 'vBC'))}`,
        `IBS UF ${numero(aliq(gUF, 'pIBSUF'))}% ${numero(tag(gUF, 'vIBSUF'))}`,
        `IBS Mun ${numero(aliq(gMun, 'pIBSMun'))}% ${numero(tag(gMun, 'vIBSMun'))}`,
        `CBS ${numero(aliq(gCBS, 'pCBS'))}% ${numero(tag(gCBS, 'vCBS'))}`)
    }
    if (is) partes.push(`IS ${numero(tag(is, 'pIS'))}% ${numero(tag(is, 'vIS'))}`)
    linhaRtc = partes.length ? partes.join(' · ') : null
  }
  const csosn = tag(icms, 'CSOSN')
  return {
    codigo: tag(prod, 'cProd') || '',
    descricao: [tag(prod, 'xProd'), tag(det, 'infAdProd')].filter(Boolean).join(' '),
    ncm: tag(prod, 'NCM') || '',
    cst: `${tag(icms, 'orig') || ''}${csosn || tag(icms, 'CST') || ''}`,
    cfop: tag(prod, 'CFOP') || '',
    unidade: tag(prod, 'uCom') || '',
    quantidade: quantidade(tag(prod, 'qCom')),
    vUnit: numero(tag(prod, 'vUnCom')),
    vTotal: numero(tag(prod, 'vProd')),
    bcIcms: numero(tag(icms, 'vBC')),
    vIcms: numero(tag(icms, 'vICMS')),
    vIpi: numero(tag(ipi, 'vIPI')),
    aliqIcms: numero(tag(icms, 'pICMS')),
    aliqIpi: numero(tag(ipi, 'pIPI')),
    rtc: linhaRtc,
  }
}

// ──────────────────────────────── desenho ────────────────────────────────

type Doc = PDFKit.PDFDocument
const M = 17 // margem
const W = 595.28 - M * 2
const ALTURA_PAGINA = 841.89
const LIMITE = ALTURA_PAGINA - M
const COR_ROTULO = '#333333'
const H = 22 // altura padrão de campo

/** Campo com moldura arredondada: rótulo pequeno em cima, valor embaixo (cortado se não couber). */
function campo(doc: Doc, x: number, y: number, w: number, h: number, rotulo: string, valor: string, opcoes: { alinhar?: 'left' | 'right' | 'center'; tamanho?: number } = {}) {
  doc.lineWidth(0.6).strokeColor('#000000').roundedRect(x, y, w, h, 3).stroke()
  doc.font('Helvetica').fontSize(5).fillColor(COR_ROTULO).text(rotulo, x + 2.5, y + 2, { width: w - 5, height: 6, ellipsis: true, lineBreak: false })
  const tamanho = opcoes.tamanho ?? 9
  doc.font('Helvetica').fontSize(tamanho).fillColor('#000000')
    .text(valor, x + 2.5, y + h - tamanho - 2.5, { width: w - 5, height: tamanho + 2, ellipsis: true, lineBreak: false, align: opcoes.alinhar ?? 'left' })
}

/** Título de quadro: texto simples acima do quadro, como no DANFE tradicional. */
function titulo(doc: Doc, y: number, texto: string): number {
  doc.font('Helvetica').fontSize(6.5).fillColor('#000000').text(texto, M + 1, y + 2, { lineBreak: false })
  return y + 10
}

/** Linha de campos com larguras proporcionais aos pesos. */
function linha(doc: Doc, y: number, campos: [string, string, number?, ('left' | 'right' | 'center')?][], h = H): number {
  const total = campos.reduce((s, c) => s + (c[2] ?? 1), 0)
  let x = M
  for (const [rotulo, valor, peso = 1, alinhar] of campos) {
    const w = (W * peso) / total
    campo(doc, x, y, w, h, rotulo, valor, { alinhar })
    x += w
  }
  return y + h
}

interface Nota {
  rtc: boolean
  ide: string; emit: string; ender: string; dest: string | null; enderDest: string | null
  total: string; icmsTot: string; ibsTot: string | null; issqnTot: string | null
  transp: string | null; transporta: string | null; veiculo: string | null; vol: string | null
  cobr: string | null; infAdic: string | null; qrCode: string | null
  numero: string; serie: string; chave: string; protocolo: string
  itens: Item[]
  logo: Buffer | null
  codigoBarras: Buffer
}

// Colunas da tabela de produtos (pesos), na ordem do DANFE tradicional.
const COLUNAS: [string, number, 'left' | 'right' | 'center'][] = [
  ['CÓDIGO', 52, 'left'], ['DESCRIÇÃO DOS PRODUTOS / SERVIÇOS', 150, 'left'], ['NCM/SH', 36, 'center'], ['CST', 20, 'center'],
  ['CFOP', 22, 'center'], ['UNID', 20, 'center'], ['QUANT.', 26, 'right'], ['VALOR UNITÁRIO', 44, 'right'],
  ['VALOR TOTAL', 44, 'right'], ['BC.ICMS', 40, 'right'], ['V. ICMS', 32, 'right'], ['V. IPI', 28, 'right'],
  ['ALÍQ. ICMS', 24, 'right'], ['ALÍQ. IPI', 22, 'right'],
]
const LARGURAS = (() => { const t = COLUNAS.reduce((s, c) => s + c[1], 0); return COLUNAS.map(c => (W * c[1]) / t) })()

function alturaItem(doc: Doc, it: Item): number {
  doc.font('Helvetica').fontSize(6.5)
  let h = doc.heightOfString(it.descricao, { width: LARGURAS[1] - 4 })
  if (it.rtc) { doc.fontSize(5.5); h += doc.heightOfString(it.rtc, { width: LARGURAS[1] - 4 }) + 1; doc.fontSize(6.5) }
  return Math.max(h, doc.heightOfString(it.codigo, { width: LARGURAS[0] - 4 })) + 5
}

/** Canhoto + emitente/DANFE/chave + natureza/protocolo + inscrições. Usado em todas as folhas. */
async function desenharCabecalho(doc: Doc, n: Nota, folha: string, comCanhoto: boolean): Promise<number> {
  let y = M
  const emitNome = tag(n.emit, 'xNome') || ''
  if (comCanhoto) {
    const wNfe = W * 0.155
    doc.lineWidth(0.6).strokeColor('#000000').roundedRect(M, y, W - wNfe, 24, 3).stroke()
    doc.font('Helvetica').fontSize(5.5).fillColor('#000000')
      .text(`RECEBEMOS DE ${emitNome.toUpperCase()} OS PRODUTOS CONSTANTES NA NOTA FISCAL INDICADA AO LADO`, M + 3, y + 3, { width: W - wNfe - 6, height: 8, ellipsis: true })
    campo(doc, M, y + 24, (W - wNfe) * 0.2, 24, 'DATA DE RECEBIMENTO', '')
    campo(doc, M + (W - wNfe) * 0.2, y + 24, (W - wNfe) * 0.8, 24, 'IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR', '')
    doc.roundedRect(M + W - wNfe, y, wNfe, 48, 3).stroke()
    doc.font('Helvetica').fontSize(8).fillColor('#000000').text('NF-e', M + W - wNfe, y + 5, { width: wNfe, align: 'center' })
    doc.fontSize(9).text(`Nº ${n.numero}`, M + W - wNfe, y + 17, { width: wNfe, align: 'center' })
    doc.text(`SÉRIE ${n.serie}`, M + W - wNfe, y + 31, { width: wNfe, align: 'center' })
    y += 52
    doc.lineWidth(0.6).dash(3, { space: 2 }).moveTo(M, y).lineTo(M + W, y).stroke().undash()
    y += 4
  }

  // Emitente | DANFE | controle do fisco
  const h = 100
  const wEmit = W * 0.43, wDanfe = W * 0.15, wChave = W - wEmit - wDanfe
  doc.lineWidth(0.6).roundedRect(M, y, wEmit, h, 3).stroke()
  let ty = y + 14
  if (n.logo) {
    try { doc.image(n.logo, M + 6, y + 5, { fit: [wEmit - 12, 40], align: 'center' }); ty = y + 49 } catch { /* logo inválido: segue sem */ }
  }
  const ender = n.ender
  const linhasEndereco = [
    [tag(ender, 'xLgr'), tag(ender, 'nro')].filter(Boolean).join(', ') + (tag(ender, 'xCpl') ? ` ${tag(ender, 'xCpl')}` : ''),
    `${tag(ender, 'xBairro') || ''} - CEP ${cep(tag(ender, 'CEP'))}`,
    `${tag(ender, 'xMun') || ''} - ${tag(ender, 'UF') || ''}${tag(ender, 'fone') ? `  Fone: ${telefone(tag(ender, 'fone'))}` : ''}`,
  ]
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#000000').text(emitNome, M + 4, ty, { width: wEmit - 8, align: 'center', height: 24, ellipsis: true })
  doc.font('Helvetica').fontSize(7).text(linhasEndereco.join('\n'), M + 4, doc.y + 2, { width: wEmit - 8, align: 'center', height: Math.max(8, y + h - doc.y - 4), ellipsis: true })

  const xD = M + wEmit
  doc.roundedRect(xD, y, wDanfe, h, 3).stroke()
  doc.font('Helvetica-Bold').fontSize(11).text('DANFE', xD, y + 5, { width: wDanfe, align: 'center' })
  doc.font('Helvetica').fontSize(6).text('DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRÔNICA', xD + 4, y + 19, { width: wDanfe - 8, align: 'center' })
  doc.fontSize(6.5).text('0 - ENTRADA\n1 - SAÍDA', xD + 7, y + 41)
  doc.rect(xD + wDanfe - 22, y + 41, 14, 14).stroke()
  doc.fontSize(10).text(tag(n.ide, 'tpNF') || '1', xD + wDanfe - 22, y + 44, { width: 14, align: 'center' })
  doc.font('Helvetica-Bold').fontSize(8).text(`Nº ${n.numero}`, xD, y + 62, { width: wDanfe, align: 'center' })
  doc.text(`SÉRIE ${n.serie}`, xD, y + 73, { width: wDanfe, align: 'center' })
  doc.font('Helvetica').fontSize(6.5).text(`PÁGINA ${folha.replace('/', ' DE ')}`, xD, y + 86, { width: wDanfe, align: 'center' })

  const xC = xD + wDanfe
  doc.roundedRect(xC, y, wChave, h, 3).stroke()
  doc.font('Helvetica').fontSize(5).fillColor(COR_ROTULO).text('CONTROLE DO FISCO', xC + 3, y + 2)
  doc.image(n.codigoBarras, xC + 8, y + 9, { width: wChave - 16, height: 30 })
  doc.moveTo(xC, y + 43).lineTo(xC + wChave, y + 43).stroke()
  doc.fontSize(5).text('CHAVE DE ACESSO', xC + 3, y + 45)
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#000000').text(n.chave.replace(/(\d{4})(?=\d)/g, '$1 '), xC + 2, y + 53, { width: wChave - 4, align: 'center', lineBreak: false })
  doc.moveTo(xC, y + 64).lineTo(xC + wChave, y + 64).stroke()
  doc.font('Helvetica').fontSize(7).text('Consulta de autenticidade no portal nacional da NF-e www.nfe.fazenda.gov.br/portal ou no site da Sefaz Autorizadora', xC + 5, y + 70, { width: wChave - 10, align: 'center', height: 28, ellipsis: true })
  y += h

  y = linha(doc, y, [['NATUREZA DA OPERAÇÃO', tag(n.ide, 'natOp') || '', 0.58], ['PROTOCOLO DE AUTORIZAÇÃO DE USO', n.protocolo, 0.42, 'center']])
  y = linha(doc, y, [['INSCRIÇÃO ESTADUAL', tag(n.emit, 'IE') || '', 1], ['INSCRIÇÃO ESTADUAL DO SUBST. TRIBUT.', tag(n.emit, 'IEST') || '', 1], ['CNPJ', documento(tag(n.emit, 'CNPJ') || tag(n.emit, 'CPF')), 1]])
  if (n.rtc) {
    // NT 2026.010, 4.2: CRT e campo reservado do regime de apuração do IBS/CBS (sem conteúdo até sair a tag).
    const crt = tag(n.emit, 'CRT')
    y = linha(doc, y, [['CÓDIGO DO REGIME TRIBUTÁRIO', crt ? (CRT[crt] ?? crt) : '', 1], ['TIPO DE REGIME DE APURAÇÃO DO IBS E DA CBS', '', 1]])
  }
  return y
}

/** Quadros que só aparecem na primeira folha, antes dos produtos. */
function desenharQuadrosNota(doc: Doc, n: Nota, y: number): number {
  const { ide, dest, enderDest, icmsTot } = n
  y = titulo(doc, y + 2, 'DESTINATÁRIO / REMETENTE')
  y = linha(doc, y, [['NOME / RAZÃO SOCIAL', tag(dest, 'xNome') || '', 3.4], ['CNPJ / CPF', documento(tag(dest, 'CNPJ') || tag(dest, 'CPF')) || tag(dest, 'idEstrangeiro') || '', 1.2], ['DATA DA EMISSÃO', data(tag(ide, 'dhEmi')), 0.9, 'center']])
  y = linha(doc, y, [['ENDEREÇO', [tag(enderDest, 'xLgr'), tag(enderDest, 'nro')].filter(Boolean).join(', ') + (tag(enderDest, 'xCpl') ? ` ${tag(enderDest, 'xCpl')}` : ''), 2.4], ['BAIRRO / DISTRITO', tag(enderDest, 'xBairro') || '', 1.4], ['CEP', cep(tag(enderDest, 'CEP')), 0.8, 'center'], ['DATA DA SAÍDA/ENTRADA', data(tag(ide, 'dhSaiEnt')), 0.9, 'center']])
  y = linha(doc, y, [['MUNICÍPIO', tag(enderDest, 'xMun') || '', 2.1], ['FONE / FAX', telefone(tag(enderDest, 'fone')), 1], ['UF', tag(enderDest, 'UF') || '', 0.3, 'center'], ['INSCRIÇÃO ESTADUAL', tag(dest, 'IE') || '', 1.2], ['HORA DA SAÍDA/ENTRADA', hora(tag(ide, 'dhSaiEnt')), 0.9, 'center']])

  // Fatura / duplicatas (só com dados no XML)
  const dups = blocos(n.cobr, 'dup')
  if (dups.length) {
    y = titulo(doc, y + 2, 'FATURA / DUPLICATAS')
    for (let i = 0; i < dups.length; i += 4) {
      y = linha(doc, y, dups.slice(i, i + 4).map(d => [`Nº ${tag(d, 'nDup') || ''} · VENC. ${data(tag(d, 'dVenc'))}`, numero(tag(d, 'vDup')), 1, 'right'] as [string, string, number, 'right']))
    }
  }

  // Cálculo do imposto (quadro único, como no DANFE tradicional)
  y = titulo(doc, y + 2, 'CÁLCULO DO IMPOSTO')
  y = linha(doc, y, [['BASE DE CÁLCULO DO ICMS', numero(tag(icmsTot, 'vBC')), 1, 'right'], ['VALOR DO ICMS', numero(tag(icmsTot, 'vICMS')), 1, 'right'], ['BASE DE CÁLC. ICMS S.T.', numero(tag(icmsTot, 'vBCST')), 1, 'right'], ['VALOR DO ICMS SUBST.', numero(tag(icmsTot, 'vST')), 1, 'right'], ['V. TOTAL PRODUTOS', numero(tag(icmsTot, 'vProd')), 1.2, 'right']])
  y = linha(doc, y, [['VALOR DO FRETE', numero(tag(icmsTot, 'vFrete')), 1, 'right'], ['VALOR DO SEGURO', numero(tag(icmsTot, 'vSeg')), 1, 'right'], ['DESCONTO', numero(tag(icmsTot, 'vDesc')), 1, 'right'], ['OUTRAS DESPESAS', numero(tag(icmsTot, 'vOutro')), 1, 'right'], ['VALOR TOTAL IPI', numero(tag(icmsTot, 'vIPI')), 1, 'right'], ['V. TOTAL DA NOTA', numero(tag(icmsTot, 'vNF')), 1.2, 'right']])
  if (n.rtc) {
    // NT 2026.010, 4.1: quadro obrigatório; campos em branco se a nota não tiver IBS/CBS/IS.
    const gIBS = bloco(n.ibsTot, 'gIBS'), gCBS = bloco(n.ibsTot, 'gCBS')
    y = titulo(doc, y + 2, 'TOTAL DO IBS / CBS / IS')
    y = linha(doc, y, [['VALOR DA CBS', numero(tag(gCBS, 'vCBS')), 1, 'right'], ['VALOR DO IBS UF', numero(tag(bloco(gIBS, 'gIBSUF'), 'vIBSUF')), 1, 'right'], ['VALOR DO IBS MUNICÍPIO', numero(tag(bloco(gIBS, 'gIBSMun'), 'vIBSMun')), 1, 'right'], ['VALOR DO IMPOSTO SELETIVO', numero(tag(bloco(n.total, 'ISTot'), 'vIS')), 1, 'right']])
  }

  // Transportador / volumes (sempre presente no DANFE tradicional)
  const { transp, transporta, veiculo, vol } = n
  y = titulo(doc, y + 2, 'TRANSPORTADOR / VOLUMES TRANSPORTADOS')
  const modFrete = tag(transp, 'modFrete') || ''
  y = linha(doc, y, [['NOME / RAZÃO SOCIAL', tag(transporta, 'xNome') || '', 2.6], ['FRETE', modFrete ? `${modFrete} - ${MOD_FRETE[modFrete] ?? ''}` : '', 1], ['CÓDIGO ANTT', tag(veiculo, 'RNTC') || '', 0.8], ['PLACA DO VEÍCULO', tag(veiculo, 'placa') || '', 0.8], ['UF', tag(veiculo, 'UF') || '', 0.3], ['CNPJ / CPF', documento(tag(transporta, 'CNPJ') || tag(transporta, 'CPF')), 1.3]])
  y = linha(doc, y, [['ENDEREÇO', tag(transporta, 'xEnder') || '', 2.6], ['MUNICÍPIO', tag(transporta, 'xMun') || '', 2.2], ['UF', tag(transporta, 'UF') || '', 0.3], ['INSCRIÇÃO ESTADUAL', tag(transporta, 'IE') || '', 1.6]])
  y = linha(doc, y, [['QUANTIDADE', tag(vol, 'qVol') || '', 1], ['ESPÉCIE', tag(vol, 'esp') || '', 1], ['MARCA', tag(vol, 'marca') || '', 1], ['NUMERAÇÃO', tag(vol, 'nVol') || '', 1.2], ['PESO BRUTO', tag(vol, 'pesoB') ? numero(tag(vol, 'pesoB'), 3) : '', 1.1, 'right'], ['PESO LÍQUIDO', tag(vol, 'pesoL') ? numero(tag(vol, 'pesoL'), 3) : '', 1.1, 'right']])
  return y
}

/** Cabeçalho da tabela de produtos. */
function cabecalhoItens(doc: Doc, y: number): number {
  y = titulo(doc, y + 2, 'DADOS DOS PRODUTOS / SERVIÇOS')
  let x = M
  COLUNAS.forEach(([t], i) => {
    doc.lineWidth(0.6).strokeColor('#000000').rect(x, y, LARGURAS[i], 16).stroke()
    doc.font('Helvetica').fontSize(5.2).fillColor('#000000')
    const hTexto = doc.heightOfString(t, { width: LARGURAS[i] - 2 })
    doc.text(t, x + 1, y + (16 - hTexto) / 2, { width: LARGURAS[i] - 2, align: 'center' })
    x += LARGURAS[i]
  })
  return y + 16
}

function linhaItem(doc: Doc, y: number, it: Item, h: number) {
  const valores = [it.codigo, it.descricao, it.ncm, it.cst, it.cfop, it.unidade, it.quantidade, it.vUnit, it.vTotal, it.bcIcms, it.vIcms, it.vIpi, it.aliqIcms, it.aliqIpi]
  let x = M
  valores.forEach((v, i) => {
    // Só as linhas verticais e a de baixo, como na tabela tradicional.
    doc.lineWidth(0.4).strokeColor('#000000').moveTo(x, y).lineTo(x, y + h).stroke()
    doc.font('Helvetica').fontSize(6.5).fillColor('#000000').text(v, x + 2, y + 2.5, { width: LARGURAS[i] - 4, align: COLUNAS[i][2] })
    if (i === 1 && it.rtc) doc.fontSize(5.5).fillColor(COR_ROTULO).text(it.rtc, x + 2, doc.y + 1, { width: LARGURAS[i] - 4 })
    x += LARGURAS[i]
  })
  doc.moveTo(x, y).lineTo(x, y + h).stroke()
  doc.lineWidth(0.3).strokeColor('#999999').moveTo(M, y + h).lineTo(M + W, y + h).stroke().strokeColor('#000000')
}

async function desenharRodape(doc: Doc, n: Nota, y: number) {
  doc.lineWidth(0.6).moveTo(M, y).lineTo(M + W, y).stroke()
  // Cálculo do ISSQN
  y = titulo(doc, y + 2, 'CÁLCULO DO ISSQN')
  const iss = n.issqnTot
  y = linha(doc, y, [['INSCRIÇÃO MUNICIPAL', tag(n.emit, 'IM') || '', 1], ['VALOR TOTAL DOS SERVIÇOS', numero(tag(iss, 'vServ')), 1, 'right'], ['BASE DE CÁLCULO DO ISSQN', numero(tag(iss, 'vBC')), 1, 'right'], ['VALOR DO ISSQN', numero(tag(iss, 'vISS')), 1, 'right']])

  // Dados adicionais logo abaixo, como no DANFE tradicional
  y = titulo(doc, y + 2, 'DADOS ADICIONAIS')
  const h = Math.min(110, LIMITE - y)
  const wQr = n.qrCode ? 95 : 0
  const wInfo = (W - wQr) * 0.65
  doc.lineWidth(0.6).roundedRect(M, y, wInfo, h, 3).stroke().roundedRect(M + wInfo, y, W - wQr - wInfo, h, 3).stroke()
  doc.font('Helvetica').fontSize(5).fillColor(COR_ROTULO).text('INFORMAÇÕES COMPLEMENTARES', M + 2.5, y + 2, { lineBreak: false })
  doc.text('RESERVADO AO FISCO', M + wInfo + 2.5, y + 2, { lineBreak: false })
  doc.fontSize(7).fillColor('#000000').text(tag(n.infAdic, 'infCpl') || '', M + 3, y + 9, { width: wInfo - 6, height: h - 11, ellipsis: true })
  const fisco = tag(n.infAdic, 'infAdFisco')
  if (fisco) doc.text(fisco, M + wInfo + 3, y + 9, { width: W - wQr - wInfo - 6, height: h - 11, ellipsis: true })
  if (n.qrCode) {
    const xq = M + W - wQr
    doc.roundedRect(xq, y, wQr, h, 3).stroke()
    doc.image(await QRCode.toBuffer(n.qrCode, { margin: 0, width: 300 }), xq + 10, y + 10, { width: wQr - 20 })
  }
}

const ALTURA_RODAPE = 12 + H + 2 + 10 + 110

/** Gera o PDF do DANFE a partir do XML da NF-e. O protocolo pode vir no próprio nfeProc ou à parte. */
export async function gerarDanfePdf(xmlNfe: string, opcoes: { xmlProtocolo?: string | null; cancelada?: boolean; logo?: Buffer | null; dataImpressao?: Date } = {}): Promise<Buffer> {
  const rtc = (opcoes.dataImpressao ?? new Date()) >= INICIO_DANFE_RTC
  const infNFe = bloco(xmlNfe, 'infNFe') || ''
  const ide = bloco(infNFe, 'ide') || ''
  const emit = bloco(infNFe, 'emit') || ''
  const dest = bloco(infNFe, 'dest')
  const total = bloco(infNFe, 'total') || ''
  const transp = bloco(infNFe, 'transp')
  const prot = bloco(xmlNfe, 'protNFe') || bloco(opcoes.xmlProtocolo, 'protNFe') || ''
  const chave = xmlNfe.match(/Id="NFe(\d{44})"/)?.[1] || tag(prot, 'chNFe') || ''

  const n: Nota = {
    rtc, ide, emit, ender: bloco(emit, 'enderEmit') || '', dest, enderDest: bloco(dest, 'enderDest'),
    total, icmsTot: bloco(total, 'ICMSTot') || '', ibsTot: bloco(total, 'IBSCBSTot'), issqnTot: bloco(total, 'ISSQNtot'),
    transp, transporta: bloco(transp, 'transporta'), veiculo: bloco(transp, 'veicTransp'), vol: bloco(transp, 'vol'),
    cobr: bloco(infNFe, 'cobr'), infAdic: bloco(infNFe, 'infAdic'), qrCode: tag(xmlNfe, 'qrCode'),
    numero: numeroNota(tag(ide, 'nNF')),
    serie: (tag(ide, 'serie') || '').padStart(3, '0'),
    chave,
    protocolo: tag(prot, 'nProt') ? `${tag(prot, 'nProt')} - ${data(tag(prot, 'dhRecbto'))} ${hora(tag(prot, 'dhRecbto'))}` : '',
    itens: blocos(infNFe, 'det').map(d => lerItem(d, rtc)),
    logo: opcoes.logo ?? null,
    codigoBarras: await gerarCode128Buffer(chave || '0'),
  }

  // ── Paginação: pdfkit não mede sem desenhar, então os quadros da primeira folha são desenhados
  //    num documento descartável só para saber onde começa a tabela de produtos.
  const medidor = new PDFDocument({ size: 'A4', margin: 0 })
  medidor.on('data', () => {})
  const yTabelaPrimeira = desenharQuadrosNota(medidor, n, await desenharCabecalho(medidor, n, '1/1', true))
  const yTabelaDemais = await desenharCabecalho(medidor, n, '1/1', false)
  const alturas = n.itens.map(it => alturaItem(medidor, it))
  medidor.end()

  const ALTURA_CAB_TABELA = 2 + 10 + 16
  const paginas: number[][] = [[]]
  let usado = yTabelaPrimeira + ALTURA_CAB_TABELA
  n.itens.forEach((_, i) => {
    // O rodapé (ISSQN + dados adicionais) precisa caber depois do último item da última folha;
    // nas folhas intermediárias os itens vão até o fim da página.
    const reservaRodape = i === n.itens.length - 1 ? ALTURA_RODAPE : 0
    if (usado + alturas[i] + reservaRodape > LIMITE && paginas[paginas.length - 1].length > 0) {
      paginas.push([])
      usado = yTabelaDemais + ALTURA_CAB_TABELA
    }
    paginas[paginas.length - 1].push(i)
    usado += alturas[i]
  })
  if (usado + ALTURA_RODAPE > LIMITE) paginas.push([]) // rodapé numa folha própria, se não couber

  const doc = new PDFDocument({ size: 'A4', margin: 0, info: { Title: `DANFE ${n.numero}`, Creator: 'Dc Informática' } })
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
    let y = await desenharCabecalho(doc, n, folha, p === 0)
    if (p === 0) y = desenharQuadrosNota(doc, n, y)
    if (paginas[p].length) {
      y = cabecalhoItens(doc, y)
      for (const i of paginas[p]) { linhaItem(doc, y, n.itens[i], alturas[i]); y += alturas[i] }
    }
    if (p === paginas.length - 1) await desenharRodape(doc, n, y)
    else doc.lineWidth(0.6).moveTo(M, y).lineTo(M + W, y).stroke()

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
