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

const SIMPLES_LABEL: Record<string, string> = {
  MEI: 'Optante - Microempreendedor Individual (MEI)',
  SIMPLES: 'Optante - Simples Nacional (ME/EPP)',
  NORMAL: 'Não Optante',
}

export interface DanfsePdfInput {
  ambiente: string
  numeroNfse: string | number
  numeroDps: number
  serieDps: string
  chaveAcesso: string
  dataEmissao: Date
  prestadorNome: string
  prestadorCnpj: string
  prestadorTelefone?: string | null
  prestadorEmail?: string | null
  prestadorEndereco?: string | null
  prestadorCep?: string | null
  tomadorNome: string
  tomadorDocumento?: string | null
  tomadorTelefone?: string | null
  tomadorEmail?: string | null
  tomadorEndereco?: string | null
  descricaoServico: string
  codigoServico?: string | null
  descricaoCodServico?: string | null
  municipioLabel: string
  regimeTributario: string
  aliquotaIss?: number | null
  valorTotal: string
}

/** Layout do DANFSe seguindo o modelo padrão nacional (blocos e ordem dos campos conferidos
 * contra uma NFS-e real emitida pelo portal do governo), com QR Code de consulta pública. */
export async function gerarPdfDanfse(input: DanfsePdfInput): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 40 })
  const bufferPromise = coletarBuffer(doc)
  // O portal de consulta (nfse.gov.br/consultapublica) é um formulário, sem parâmetro de URL
  // documentado pra pré-preencher a chave — por isso o QR traz a própria chave em texto.
  const qrCode = await gerarQrCodeBuffer(input.chaveAcesso)
  const ehMei = input.regimeTributario === 'MEI'

  if (input.ambiente !== 'producao') {
    doc.rect(40, 40, doc.page.width - 80, 30).fillAndStroke('#fee2e2', '#991b1b')
    doc.fillColor('#991b1b').fontSize(11).font('Helvetica-Bold')
      .text('NFS-e EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO — SEM VALOR FISCAL', 40, 49, { width: doc.page.width - 80, align: 'center' })
    doc.moveDown(2)
  }

  doc.fillColor('black').fontSize(16).font('Helvetica-Bold').text('DANFSe v1.0', { align: 'center' })
  doc.fontSize(9).font('Helvetica').text('Documento Auxiliar da NFS-e', { align: 'center' })
  doc.moveDown(0.5)

  doc.fontSize(8).font('Helvetica-Bold').text('Chave de Acesso da NFS-e')
  doc.font('Courier').fontSize(9).text(input.chaveAcesso)
  doc.moveDown(0.4)

  // Mede a altura de verdade do texto (em vez de "moveDown" com valor fixo) pra não
  // desalinhar quando um campo quebra em mais de uma linha (ex: endereço longo).
  function alturaMaxima(textos: string[], largura: number, font: string, size: number) {
    doc.font(font).fontSize(size)
    return Math.max(...textos.map(t => doc.heightOfString(t, { width: largura - 5 })))
  }

  function linhaCampos(campos: [string, string | number | null | undefined][]) {
    const largura = (doc.page.width - 80) / campos.length
    const labels = campos.map(c => c[0])
    const valores = campos.map(c => String(c[1] ?? '-'))
    const alturaLabels = alturaMaxima(labels, largura, 'Helvetica-Bold', 8)
    const alturaValores = alturaMaxima(valores, largura, 'Helvetica', 9)
    const alturaTotal = alturaLabels + alturaValores + 14

    if (doc.y + alturaTotal > doc.page.height - doc.page.margins.bottom) {
      doc.addPage()
    }

    doc.font('Helvetica-Bold').fontSize(8)
    const y = doc.y
    labels.forEach((label, i) => doc.text(label, 40 + i * largura, y, { width: largura - 5 }))
    doc.y = y + alturaLabels + 2

    doc.font('Helvetica').fontSize(9)
    const y2 = doc.y
    valores.forEach((value, i) => doc.text(value, 40 + i * largura, y2, { width: largura - 5 }))
    doc.y = y2 + alturaValores + 8
  }

  function tituloSecao(texto: string) {
    if (doc.y + 24 > doc.page.height - doc.page.margins.bottom) {
      doc.addPage()
    }
    doc.moveDown(0.3)
    doc.rect(40, doc.y, doc.page.width - 80, 16).fill('#e8e8e8')
    doc.fillColor('black').font('Helvetica-Bold').fontSize(8).text(texto, 45, doc.y + 4)
    doc.y += 20
  }

  linhaCampos([
    ['Número da NFS-e', input.numeroNfse],
    ['Competência da NFS-e', input.dataEmissao.toLocaleDateString('pt-BR')],
    ['Data e Hora da emissão da NFS-e', input.dataEmissao.toLocaleString('pt-BR')],
  ])
  linhaCampos([
    ['Número da DPS', input.numeroDps],
    ['Série da DPS', input.serieDps],
    ['Data e Hora da emissão da DPS', input.dataEmissao.toLocaleString('pt-BR')],
  ])

  tituloSecao('EMITENTE DA NFS-e — Prestador do Serviço')
  linhaCampos([
    ['CNPJ / CPF / NIF', input.prestadorCnpj],
    ['Inscrição Municipal', null],
    ['Telefone', input.prestadorTelefone],
  ])
  linhaCampos([
    ['Nome / Nome Empresarial', input.prestadorNome],
    ['E-mail', input.prestadorEmail],
  ])
  linhaCampos([
    ['Endereço', input.prestadorEndereco],
    ['Município', input.municipioLabel],
    ['CEP', input.prestadorCep],
  ])
  linhaCampos([
    ['Simples Nacional na Data de Competência', SIMPLES_LABEL[input.regimeTributario] || input.regimeTributario],
    ['Regime de Apuração Tributária pelo SN', null],
  ])

  tituloSecao('TOMADOR DO SERVIÇO')
  linhaCampos([
    ['CNPJ / CPF / NIF', input.tomadorDocumento],
    ['Inscrição Municipal', null],
    ['Telefone', input.tomadorTelefone],
  ])
  linhaCampos([
    ['Nome / Nome Empresarial', input.tomadorNome],
    ['E-mail', input.tomadorEmail],
  ])
  linhaCampos([
    ['Endereço', input.tomadorEndereco],
    ['Município', input.municipioLabel],
    ['CEP', null],
  ])

  tituloSecao('SERVIÇO PRESTADO')
  linhaCampos([
    ['Código de Tributação Nacional', `${input.codigoServico || '-'}${input.descricaoCodServico ? ` - ${input.descricaoCodServico}` : ''}`],
  ])
  linhaCampos([
    ['Descrição do Serviço', input.descricaoServico],
  ])

  tituloSecao('TRIBUTAÇÃO MUNICIPAL')
  linhaCampos([
    ['Tributação do ISSQN', 'Operação Tributável'],
    ['Município de Incidência do ISSQN', input.municipioLabel],
    ['Regime Especial de Tributação', 'Nenhum'],
  ])
  linhaCampos([
    ['Valor do Serviço', input.valorTotal],
    ['Alíquota Aplicada', ehMei ? 'Não se aplica (MEI)' : `${input.aliquotaIss ?? '-'}%`],
    ['Retenção do ISSQN', 'Não Retido'],
  ])

  tituloSecao('VALOR TOTAL DA NFS-E')
  linhaCampos([
    ['Valor do Serviço', input.valorTotal],
    ['ISSQN Retido', null],
    ['Valor Líquido da NFS-e', input.valorTotal],
  ])

  if (doc.y + 130 > doc.page.height - doc.page.margins.bottom) {
    doc.addPage()
  }
  doc.moveDown(0.5)
  doc.font('Helvetica-Bold').fontSize(9).text('Consulta Pública / Autenticidade', { align: 'center' })
  const qrSize = 90
  const qrY = doc.y + 5
  doc.image(qrCode, (doc.page.width - qrSize) / 2, qrY, { width: qrSize, height: qrSize })
  doc.y = qrY + qrSize + 8
  doc.fontSize(8).fillColor('gray').text('Escaneie o QR Code (ou copie a chave acima) e cole em www.nfse.gov.br/consultapublica para validar esta nota.', { align: 'center' })

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
