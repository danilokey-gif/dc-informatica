import PDFDocument from 'pdfkit'
import { gerarCode128Buffer } from './barcode'
import { gerarQrCodeBuffer } from './qrcode-util'

function coletarBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    doc.on('data', chunk => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })
}

function formatarChave(chave: string) {
  return chave.match(/.{1,4}/g)?.join(' ') || chave
}

const REGIME_LABEL: Record<string, string> = {
  MEI: 'MEI — Microempreendedor Individual (Optante do Simples Nacional)',
  SIMPLES: 'Simples Nacional (ME/EPP)',
  NORMAL: 'Regime Normal (não optante pelo Simples Nacional)',
}

export interface DanfsePdfInput {
  ambiente: string
  numeroDps: number
  serieDps: string
  chaveAcesso: string
  dataEmissao: Date
  prestadorNome: string
  prestadorCnpj: string
  prestadorEndereco?: string | null
  tomadorNome: string
  tomadorDocumento?: string | null
  descricaoServico: string
  codigoServico?: string | null
  codigoMunicipio: string
  regimeTributario: string
  aliquotaIss?: number | null
  valorTotal: string
}

/** Layout padrão nacional do DANFSe (Sistema Nacional NFS-e), com QR Code de consulta pública. */
export async function gerarPdfDanfse(input: DanfsePdfInput): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 40 })
  const bufferPromise = coletarBuffer(doc)
  const urlConsulta = `https://www.nfse.gov.br/consultapublica/?chave=${input.chaveAcesso}`
  const qrCode = await gerarQrCodeBuffer(urlConsulta)
  const ehMei = input.regimeTributario === 'MEI'

  if (input.ambiente !== 'producao') {
    doc.rect(40, 40, doc.page.width - 80, 30).fillAndStroke('#fee2e2', '#991b1b')
    doc.fillColor('#991b1b').fontSize(11).font('Helvetica-Bold')
      .text('NFS-e EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO — SEM VALOR FISCAL', 40, 49, { width: doc.page.width - 80, align: 'center' })
    doc.moveDown(2)
  }

  doc.fillColor('black').fontSize(16).font('Helvetica-Bold').text('DANFSe', { align: 'center' })
  doc.fontSize(9).font('Helvetica').text('Documento Auxiliar da Nota Fiscal de Serviço Eletrônica', { align: 'center' })
  doc.fontSize(8).fillColor('gray').text(`Código de Verificação: ${input.chaveAcesso.slice(-9)}`, { align: 'center' })
  doc.fillColor('black')
  doc.moveDown(1)

  doc.fontSize(10).font('Helvetica-Bold').text(`Número da NFS-e: ${input.numeroDps}   Série: ${input.serieDps}   Emissão: ${input.dataEmissao.toLocaleString('pt-BR')}`)
  doc.moveDown(0.7)

  doc.font('Helvetica-Bold').text('Prestador de Serviços')
  doc.font('Helvetica').text(`${input.prestadorNome} — CNPJ: ${input.prestadorCnpj}`)
  if (input.prestadorEndereco) doc.text(input.prestadorEndereco)
  doc.moveDown(0.5)

  doc.font('Helvetica-Bold').text('Tomador de Serviços')
  doc.font('Helvetica').text(`${input.tomadorNome}${input.tomadorDocumento ? ` — Documento: ${input.tomadorDocumento}` : ''}`)
  doc.moveDown(0.5)

  doc.font('Helvetica-Bold').text('Serviço Prestado')
  doc.font('Helvetica').text(`Código de Tributação Nacional: ${input.codigoServico || '-'}`)
  doc.text(input.descricaoServico)
  doc.moveDown(0.5)

  doc.font('Helvetica-Bold').text('Valores')
  doc.font('Helvetica').text(`Valor do Serviço: ${input.valorTotal}   Alíquota ISS: ${ehMei ? 'Não se aplica (MEI)' : `${input.aliquotaIss ?? '-'}%`}   Valor Líquido: ${input.valorTotal}`)
  doc.moveDown(0.5)

  doc.font('Helvetica-Bold').text('Tributação Municipal')
  doc.font('Helvetica').text(`Município da Prestação (Cód. IBGE): ${input.codigoMunicipio}`)
  doc.text(`Regime de Tributação: ${REGIME_LABEL[input.regimeTributario] || input.regimeTributario}`)
  doc.moveDown(1)

  doc.font('Helvetica-Bold').fontSize(10).text('Consulta Pública / Autenticidade', { align: 'center' })
  const qrSize = 100
  const qrY = doc.y + 5
  doc.image(qrCode, (doc.page.width - qrSize) / 2, qrY, { width: qrSize, height: qrSize })
  doc.y = qrY + qrSize + 10
  doc.font('Courier').fontSize(10).text(formatarChave(input.chaveAcesso), { align: 'center' })
  doc.moveDown(0.3)
  doc.fontSize(8).fillColor('gray').text('Consulte a autenticidade em www.nfse.gov.br informando a chave de acesso acima.', { align: 'center' })

  doc.end()
  return bufferPromise
}

export interface DanfeItemPdf {
  codigo: string
  descricao: string
  ncm: string
  cfop: string
  quantidade: number
  valorUnitario: number
  valorTotal: number
}

export interface DanfePdfInput {
  ambiente: string
  numero: number
  serie: string
  chaveAcesso: string
  emitenteNome: string
  emitenteCnpj: string
  emitenteIe?: string | null
  destinatarioNome: string
  destinatarioDocumento?: string | null
  itens: DanfeItemPdf[]
  valorTotal: string
}

export async function gerarPdfDanfe(input: DanfePdfInput): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 40 })
  const bufferPromise = coletarBuffer(doc)
  const barcode = await gerarCode128Buffer(input.chaveAcesso)

  if (input.ambiente !== 'producao') {
    doc.rect(40, 40, doc.page.width - 80, 30).fillAndStroke('#fee2e2', '#991b1b')
    doc.fillColor('#991b1b').fontSize(11).font('Helvetica-Bold')
      .text('NF-E EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO — SEM VALOR FISCAL', 40, 49, { width: doc.page.width - 80, align: 'center' })
    doc.moveDown(2)
  }

  doc.fillColor('black').fontSize(16).font('Helvetica-Bold').text('DANFE', { align: 'center' })
  doc.fontSize(9).font('Helvetica').text('Documento Auxiliar da Nota Fiscal Eletrônica', { align: 'center' })
  doc.fontSize(10).text(`Nº ${input.numero} — Série ${input.serie}`, { align: 'center' })
  doc.moveDown(1)

  doc.font('Helvetica-Bold').fontSize(10).text('Emitente')
  doc.font('Helvetica').text(`${input.emitenteNome} — CNPJ: ${input.emitenteCnpj}${input.emitenteIe ? ` — IE: ${input.emitenteIe}` : ''}`)
  doc.moveDown(0.5)

  doc.font('Helvetica-Bold').text('Destinatário')
  doc.font('Helvetica').text(`${input.destinatarioNome}${input.destinatarioDocumento ? ` — Documento: ${input.destinatarioDocumento}` : ''}`)
  doc.moveDown(1)

  doc.font('Helvetica-Bold').fontSize(11).text('Chave de Acesso', { align: 'center' })
  doc.font('Courier').fontSize(10).text(formatarChave(input.chaveAcesso), { align: 'center' })
  doc.moveDown(0.3)
  const barcodeWidth = 280
  const barcodeHeight = 50
  const barcodeY = doc.y
  doc.image(barcode, (doc.page.width - barcodeWidth) / 2, barcodeY, { width: barcodeWidth, height: barcodeHeight })
  doc.y = barcodeY + barcodeHeight + 10

  // Tabela de itens
  const startX = 40
  let y = doc.y
  const colWidths = [70, 150, 55, 45, 40, 65, 65]
  const headers = ['Código', 'Descrição', 'NCM', 'CFOP', 'Qtd.', 'Vl. Unit.', 'Vl. Total']

  doc.fontSize(8).font('Helvetica-Bold')
  let x = startX
  headers.forEach((h, i) => {
    doc.text(h, x, y, { width: colWidths[i] })
    x += colWidths[i]
  })
  y += 15
  doc.font('Helvetica')

  for (const item of input.itens) {
    x = startX
    const linha = [
      item.codigo,
      item.descricao,
      item.ncm,
      item.cfop,
      String(item.quantidade),
      item.valorUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      item.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
    ]
    linha.forEach((val, i) => {
      doc.text(val, x, y, { width: colWidths[i] })
      x += colWidths[i]
    })
    y += 15
  }

  doc.moveDown(2)
  doc.fontSize(11).font('Helvetica-Bold').text(`Valor Total da Nota: ${input.valorTotal}`, { align: 'right' })

  doc.end()
  return bufferPromise
}
