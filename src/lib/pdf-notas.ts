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

interface PdfField {
  label: string
  value: string | number | null | undefined
  flex?: number
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const arrayBuffer = await res.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (e) {
    return null
  }
}

/** Layout do DANFSe oficial padrão nacional (grades e blocos) com logotipos e maior tamanho de página */
export async function gerarPdfDanfse(input: DanfsePdfInput): Promise<Buffer> {
  // A4 dimensions: 595.28 x 841.89 points
  // Margins: 35 points (giving 525.28 points printable width)
  const doc = new PDFDocument({ size: 'A4', margin: 35 })
  const bufferPromise = coletarBuffer(doc)

  const [qrCode, logoNfse, logoMarilia] = await Promise.all([
    gerarQrCodeBuffer(input.chaveAcesso),
    fetchImageBuffer('https://sefin.nfse.gov.br/SefinNacional/img/logo_nfse_vertical.png'),
    fetchImageBuffer('https://upload.wikimedia.org/wikipedia/commons/e/e0/Bras%C3%A3o_de_Mar%C3%ADlia.png')
  ])

  const ehMei = input.regimeTributario === 'MEI'

  let currentY = 35
  const startX = 35
  const totalWidth = 525

  // 1. Homologation header if applicable
  if (input.ambiente !== 'producao') {
    doc.rect(startX, currentY, totalWidth, 20).fillAndStroke('#fee2e2', '#991b1b')
    doc.fillColor('#991b1b').fontSize(7.5).font('Helvetica-Bold')
      .text('NFS-e EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO — SEM VALOR FISCAL', startX, currentY + 6.5, { width: totalWidth, align: 'center' })
    currentY += 24
  }

  // 2. Main Header (divided into 3 columns)
  const headerHeight = 55
  doc.strokeColor('#000000').lineWidth(0.5)

  // Col 1: NFSe Logo & Title
  doc.rect(startX, currentY, 155, headerHeight).stroke()
  if (logoNfse) {
    try {
      doc.image(logoNfse, startX + 8, currentY + 7, { height: 40 })
    } catch (e) {}
  }
  doc.fillColor('#000000').font('Helvetica-Bold').fontSize(10).text('NFS-e', startX + 50, currentY + 14)
  doc.font('Helvetica').fontSize(6.5).text('Nota Fiscal de Serviço eletrônica', startX + 50, currentY + 26, { width: 100 })

  // Col 2: DANFSe Documento Auxiliar
  doc.rect(startX + 155, currentY, 215, headerHeight).stroke()
  doc.fillColor('#000000').font('Helvetica-Bold').fontSize(11).text('DANFSe', startX + 155, currentY + 15, { align: 'center', width: 215 })
  doc.font('Helvetica').fontSize(8).text('Documento Auxiliar da NFS-e', startX + 155, currentY + 28, { align: 'center', width: 215 })

  // Col 3: Prefeitura de Marília Logo & Title
  doc.rect(startX + 370, currentY, 155, headerHeight).stroke()
  if (logoMarilia) {
    try {
      doc.image(logoMarilia, startX + 370 + 8, currentY + 7, { height: 40 })
    } catch (e) {}
  }
  doc.fillColor('#4b5563').font('Helvetica-Bold').fontSize(5.5).text('MUNICÍPIO DE', startX + 370 + 52, currentY + 15, { width: 100 })
  doc.fillColor('#000000').font('Helvetica-Bold').fontSize(8.5).text('MARÍLIA - SP', startX + 370 + 52, currentY + 24, { width: 100 })

  currentY += headerHeight + 5

  // 3. Access Key & QR Code Row
  const accessRowHeight = 65
  doc.rect(startX, currentY, 450, accessRowHeight).stroke()
  doc.fillColor('#4b5563').font('Helvetica-Bold').fontSize(6).text('CHAVE DE ACESSO DA NFS-e', startX + 5, currentY + 5)
  const formattedKey = input.chaveAcesso.match(/.{1,4}/g)?.join(' ') || input.chaveAcesso
  doc.fillColor('#000000').font('Courier-Bold').fontSize(9).text(formattedKey, startX + 5, currentY + 16, { width: 440 })
  doc.fillColor('#4b5563').font('Helvetica-Bold').fontSize(5.5).text('CONSULTA DE AUTENTICIDADE', startX + 5, currentY + 36)
  doc.font('Helvetica').fontSize(6.5).fillColor('#6b7280').text('Consulte a autenticidade deste documento em www.nfse.gov.br/consultapublica', startX + 5, currentY + 45)

  doc.rect(startX + 450, currentY, 75, accessRowHeight).stroke()
  try {
    doc.image(qrCode, startX + 450 + 10, currentY + 5, { width: 55, height: 55 })
  } catch (e) {}

  currentY += accessRowHeight + 5

  // Helper to draw a bordered section
  function drawSection(title: string, rows: PdfField[][]) {
    // 1. Draw Title
    doc.fillColor('#f3f4f6').rect(startX, currentY, totalWidth, 14).fill()
    doc.strokeColor('#000000').lineWidth(0.5).rect(startX, currentY, totalWidth, 14).stroke()
    doc.fillColor('#1f2937').font('Helvetica-Bold').fontSize(6.5).text(title.toUpperCase(), startX + 5, currentY + 4)
    currentY += 14

    // 2. Draw Rows
    for (const row of rows) {
      const totalFlex = row.reduce((sum, field) => sum + (field.flex || 1), 0)
      
      // Calculate row height
      let maxRowHeight = 26 // minimum height
      if (title.toUpperCase().includes('SERVIÇO PRESTADO') && row.some(f => f.label.toUpperCase().includes('DESCRIÇÃO'))) {
        maxRowHeight = 110 // larger space for service description
      } else {
        for (const field of row) {
          const fieldWidth = ((field.flex || 1) / totalFlex) * totalWidth
          const valStr = String(field.value ?? '-')
          doc.font('Helvetica').fontSize(8.5)
          const textHeight = doc.heightOfString(valStr, { width: fieldWidth - 8 })
          const fieldHeight = textHeight + 13 // spacing for label and padding
          if (fieldHeight > maxRowHeight) {
            maxRowHeight = fieldHeight
          }
        }
      }

      // Draw fields
      let tempX = startX
      for (const field of row) {
        const fieldWidth = ((field.flex || 1) / totalFlex) * totalWidth
        
        doc.strokeColor('#000000').lineWidth(0.5).rect(tempX, currentY, fieldWidth, maxRowHeight).stroke()
        doc.fillColor('#4b5563').font('Helvetica-Bold').fontSize(5.5).text(field.label.toUpperCase(), tempX + 4, currentY + 3.5, { width: fieldWidth - 8 })
        doc.fillColor('#000000').font('Helvetica').fontSize(8.5).text(String(field.value ?? '-'), tempX + 4, currentY + 11.5, { width: fieldWidth - 8 })
        
        tempX += fieldWidth
      }
      currentY += maxRowHeight
    }
    currentY += 5
  }

  // 4. Identificação da NFS-e / DPS
  drawSection('Identificação da NFS-e / DPS', [
    [
      { label: 'Número da NFS-e', value: input.numeroNfse },
      { label: 'Competência da NFS-e', value: input.dataEmissao.toLocaleDateString('pt-BR') },
      { label: 'Data e Hora da emissão da NFS-e', value: input.dataEmissao.toLocaleString('pt-BR') },
    ],
    [
      { label: 'Número da DPS', value: input.numeroDps },
      { label: 'Série da DPS', value: input.serieDps },
      { label: 'Data e Hora da emissão da DPS', value: input.dataEmissao.toLocaleString('pt-BR') },
    ]
  ])

  // 5. Emitente
  const simplesLabel = SIMPLES_LABEL[input.regimeTributario] || input.regimeTributario
  const regimeAp = ehMei ? '-' : (input.regimeTributario === 'SIMPLES' ? 'Regime de apuração dos tributos federais e SN' : '-')
  drawSection('Emitente da NFS-e — Prestador do Serviço', [
    [
      { label: 'CNPJ / CPF / NIF', value: input.prestadorCnpj },
      { label: 'Inscrição Municipal', value: '-' },
      { label: 'Telefone', value: input.prestadorTelefone },
      { label: 'E-mail', value: input.prestadorEmail },
    ],
    [
      { label: 'Nome / Nome Empresarial', value: input.prestadorNome, flex: 2 },
      { label: 'Endereço', value: input.prestadorEndereco, flex: 2 },
    ],
    [
      { label: 'Município', value: input.municipioLabel, flex: 2 },
      { label: 'CEP', value: input.prestadorCep, flex: 1 },
    ],
    [
      { label: 'Simples Nacional na Data de Competência', value: simplesLabel, flex: 2 },
      { label: 'Regime de Apuração Tributária pelo SN', value: regimeAp, flex: 2 }
    ]
  ])

  // 6. Tomador
  drawSection('Tomador do Serviço', [
    [
      { label: 'CNPJ / CPF / NIF', value: input.tomadorDocumento },
      { label: 'Inscrição Municipal', value: '-' },
      { label: 'Telefone', value: input.tomadorTelefone },
      { label: 'E-mail', value: input.tomadorEmail },
    ],
    [
      { label: 'Nome / Nome Empresarial', value: input.tomadorNome, flex: 2 },
      { label: 'Endereço', value: input.tomadorEndereco, flex: 2 },
    ]
  ])

  // 7. Intermediário
  drawSection('Intermediário do Serviço', [
    [
      { label: 'Identificação do Intermediário', value: 'Intermediário do serviço não identificado na NFS-e' }
    ]
  ])

  // 8. Serviço Prestado
  const codigoServicoFormatado = `${input.codigoServico || '-'}${input.descricaoCodServico ? ` - ${input.descricaoCodServico}` : ''}`
  drawSection('Serviço Prestado', [
    [
      { label: 'Código de Tributação Nacional', value: codigoServicoFormatado, flex: 2 },
      { label: 'Local da Prestação', value: input.municipioLabel },
      { label: 'País da Prestação', value: 'Brasil' },
    ],
    [
      { label: 'Descrição do Serviço', value: input.descricaoServico }
    ]
  ])

  // 9. Tributação Municipal
  drawSection('Tributação Municipal', [
    [
      { label: 'Tributação do ISSQN', value: 'Operação Tributável' },
      { label: 'Município de Incidência do ISSQN', value: input.municipioLabel },
      { label: 'Regime Especial de Tributação', value: 'Nenhum' },
      { label: 'Suspensão da Exigibilidade do ISSQN', value: 'Não' },
    ],
    [
      { label: 'Valor do Serviço', value: input.valorTotal },
      { label: 'BC ISSQN', value: ehMei ? '-' : input.valorTotal },
      { label: 'Alíquota Aplicada', value: ehMei ? 'Não se aplica (MEI)' : `${input.aliquotaIss ?? '-'}%` },
      { label: 'Retenção do ISSQN', value: 'Não Retido' },
    ]
  ])

  // 10. Tributação Federal
  drawSection('Tributação Federal', [
    [
      { label: 'IRRF', value: '-' },
      { label: 'Contribuição Previdenciária - Retida', value: '-' },
      { label: 'Contribuições Sociais - Retidas', value: '-' },
      { label: 'PIS/COFINS - Débito Apuração Própria', value: '-' },
    ]
  ])

  // 11. Valores Totais
  drawSection('Valores Totais da NFS-e', [
    [
      { label: 'Valor do Serviço', value: input.valorTotal },
      { label: 'Descontos', value: '-' },
      { label: 'ISSQN Retido', value: '-' },
      { label: 'Valor Líquido da NFS-e', value: input.valorTotal },
    ]
  ])

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
