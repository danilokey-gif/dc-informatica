import PDFDocument from 'pdfkit'
import { gerarCode128Buffer } from './barcode'

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
  codigoMunicipio: string
  regimeTributario: string
  valorTotal: string
}

export async function gerarPdfDanfse(input: DanfsePdfInput): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 40 })
  const bufferPromise = coletarBuffer(doc)
  const barcode = await gerarCode128Buffer(input.chaveAcesso)

  if (input.ambiente !== 'producao') {
    doc.rect(40, 40, doc.page.width - 80, 30).fillAndStroke('#fee2e2', '#991b1b')
    doc.fillColor('#991b1b').fontSize(11).font('Helvetica-Bold')
      .text('NFS-e EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO — SEM VALOR FISCAL', 40, 49, { width: doc.page.width - 80, align: 'center' })
    doc.moveDown(2)
  }

  doc.fillColor('black').fontSize(16).font('Helvetica-Bold').text('DANFSe', { align: 'center' })
  doc.fontSize(9).font('Helvetica').text('Documento Auxiliar da Nota Fiscal de Serviço Eletrônica', { align: 'center' })
  doc.moveDown(1)

  doc.fontSize(10).font('Helvetica-Bold').text('Prestador')
  doc.font('Helvetica').text(`${input.prestadorNome} — CNPJ: ${input.prestadorCnpj}`)
  if (input.prestadorEndereco) doc.text(input.prestadorEndereco)
  doc.moveDown(0.5)

  doc.font('Helvetica-Bold').text('Tomador')
  doc.font('Helvetica').text(`${input.tomadorNome}${input.tomadorDocumento ? ` — Documento: ${input.tomadorDocumento}` : ''}`)
  doc.moveDown(0.5)

  doc.font('Helvetica-Bold').text(`Número DPS: ${input.numeroDps}   Série: ${input.serieDps}   Data: ${input.dataEmissao.toLocaleDateString('pt-BR')}`)
  doc.moveDown(0.5)

  doc.font('Helvetica-Bold').text('Discriminação do Serviço')
  doc.font('Helvetica').text(input.descricaoServico)
  doc.moveDown(0.5)

  doc.font('Helvetica-Bold').text(`Município (Cód. IBGE): ${input.codigoMunicipio}   Regime: ${input.regimeTributario}   Valor Total: ${input.valorTotal}`)
  doc.moveDown(1)

  doc.font('Helvetica-Bold').fontSize(11).text('Chave de Acesso', { align: 'center' })
  doc.font('Courier').fontSize(10).text(formatarChave(input.chaveAcesso), { align: 'center' })
  doc.moveDown(0.3)
  const barcodeWidth = 280
  const barcodeHeight = 50
  const barcodeY = doc.y
  doc.image(barcode, (doc.page.width - barcodeWidth) / 2, barcodeY, { width: barcodeWidth, height: barcodeHeight })
  doc.y = barcodeY + barcodeHeight + 10
  doc.fontSize(8).fillColor('gray').text('Consulte a autenticidade em www.nfse.gov.br', { align: 'center' })

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
