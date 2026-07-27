import PDFDocument from 'pdfkit'
import { gerarCode128Buffer } from './barcode'
import { gerarQrCodeBuffer } from './qrcode-util'
import fs from 'fs'
import path from 'path'

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

/** Layout do DANFSe oficial padrão nacional (grades e blocos) com logotipos e maior compactação para caber sempre em 1 página */
export async function gerarPdfDanfse(input: DanfsePdfInput): Promise<Buffer> {
  // A4 dimensions: 595.28 x 841.89 points
  // Margins: 35 points (giving 525.28 points printable width)
  const doc = new PDFDocument({ size: 'A4', margin: 35 })
  const bufferPromise = coletarBuffer(doc)

  // Load logos locally from the filesystem
  let logoNfse: Buffer | null = null
  let logoMarilia: Buffer | null = null

  try {
    const rootDir = process.cwd()
    logoNfse = fs.readFileSync(path.join(rootDir, 'public', 'logo-nfse.png'))
  } catch (e) {}

  try {
    const rootDir = process.cwd()
    logoMarilia = fs.readFileSync(path.join(rootDir, 'public', 'logo-marilia.jpg'))
  } catch (e) {}

  const qrCode = await gerarQrCodeBuffer(input.chaveAcesso)
  const ehMei = input.regimeTributario === 'MEI'

  let currentY = 35
  const startX = 35
  const totalWidth = 525

  // 1. Homologation header if applicable
  if (input.ambiente !== 'producao') {
    doc.rect(startX, currentY, totalWidth, 18).fillAndStroke('#fee2e2', '#991b1b')
    doc.fillColor('#991b1b').fontSize(7.5).font('Helvetica-Bold')
      .text('NFS-e EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO — SEM VALOR FISCAL', startX, currentY + 5.5, { width: totalWidth, align: 'center' })
    currentY += 22
  }

  // 2. Main Header (divided into 3 columns)
  const headerHeight = 50
  doc.strokeColor('#000000').lineWidth(0.5)

  // Col 1: NFSe Logo & Title
  doc.rect(startX, currentY, 155, headerHeight).stroke()
  if (logoNfse) {
    try {
      doc.image(logoNfse, startX + 8, currentY + 5, { height: 38 })
    } catch (e) {}
  }
  doc.fillColor('#000000').font('Helvetica-Bold').fontSize(9.5).text('NFS-e', startX + 48, currentY + 12)
  doc.font('Helvetica').fontSize(6).text('Nota Fiscal de Serviço eletrônica', startX + 48, currentY + 23, { width: 100 })

  // Col 2: DANFSe Documento Auxiliar
  doc.rect(startX + 155, currentY, 215, headerHeight).stroke()
  doc.fillColor('#000000').font('Helvetica-Bold').fontSize(10.5).text('DANFSe', startX + 155, currentY + 13, { align: 'center', width: 215 })
  doc.font('Helvetica').fontSize(7.5).text('Documento Auxiliar da NFS-e', startX + 155, currentY + 25, { align: 'center', width: 215 })

  // Col 3: Prefeitura de Marília Logo & Title
  doc.rect(startX + 370, currentY, 155, headerHeight).stroke()
  if (logoMarilia) {
    try {
      doc.image(logoMarilia, startX + 370 + 8, currentY + 5, { height: 38 })
    } catch (e) {}
  }
  doc.fillColor('#4b5563').font('Helvetica-Bold').fontSize(5).text('MUNICÍPIO DE', startX + 370 + 50, currentY + 13, { width: 100 })
  doc.fillColor('#000000').font('Helvetica-Bold').fontSize(8).text('MARÍLIA - SP', startX + 370 + 50, currentY + 22, { width: 100 })

  currentY += headerHeight + 4

  // 3. Access Key & QR Code Row
  const accessRowHeight = 60
  doc.rect(startX, currentY, 450, accessRowHeight).stroke()
  doc.fillColor('#4b5563').font('Helvetica-Bold').fontSize(5.5).text('CHAVE DE ACESSO DA NFS-e', startX + 5, currentY + 4)
  const formattedKey = input.chaveAcesso.match(/.{1,4}/g)?.join(' ') || input.chaveAcesso
  doc.fillColor('#000000').font('Courier-Bold').fontSize(8.5).text(formattedKey, startX + 5, currentY + 14, { width: 440 })
  doc.fillColor('#4b5563').font('Helvetica-Bold').fontSize(5.5).text('CONSULTA DE AUTENTICIDADE', startX + 5, currentY + 33)
  doc.font('Helvetica').fontSize(6).fillColor('#6b7280').text('Consulte a autenticidade deste documento em www.nfse.gov.br/consultapublica', startX + 5, currentY + 41)

  doc.rect(startX + 450, currentY, 75, accessRowHeight).stroke()
  try {
    doc.image(qrCode, startX + 450 + 12, currentY + 5, { width: 50, height: 50 })
  } catch (e) {}

  currentY += accessRowHeight + 4

  // Helper to draw a bordered section
  function drawSection(title: string, rows: PdfField[][]) {
    // 1. Draw Title
    doc.fillColor('#f3f4f6').rect(startX, currentY, totalWidth, 12).fill()
    doc.strokeColor('#000000').lineWidth(0.5).rect(startX, currentY, totalWidth, 12).stroke()
    doc.fillColor('#1f2937').font('Helvetica-Bold').fontSize(6).text(title.toUpperCase(), startX + 5, currentY + 3.5)
    currentY += 12

    // 2. Draw Rows
    for (const row of rows) {
      const totalFlex = row.reduce((sum, field) => sum + (field.flex || 1), 0)
      
      // Calculate row height
      let maxRowHeight = 24 // minimum height
      if (title.toUpperCase().includes('SERVIÇO PRESTADO') && row.some(f => f.label.toUpperCase().includes('DESCRIÇÃO'))) {
        maxRowHeight = 90 // larger space for service description
      } else {
        for (const field of row) {
          const fieldWidth = ((field.flex || 1) / totalFlex) * totalWidth
          const valStr = String(field.value ?? '-')
          doc.font('Helvetica').fontSize(8)
          const textHeight = doc.heightOfString(valStr, { width: fieldWidth - 8 })
          const fieldHeight = textHeight + 11 // spacing for label and padding
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
        doc.fillColor('#4b5563').font('Helvetica-Bold').fontSize(5.5).text(field.label.toUpperCase(), tempX + 4, currentY + 3, { width: fieldWidth - 8 })
        doc.fillColor('#000000').font('Helvetica').fontSize(8).text(String(field.value ?? '-'), tempX + 4, currentY + 11, { width: fieldWidth - 8 })
        
        tempX += fieldWidth
      }
      currentY += maxRowHeight
    }
    currentY += 4
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
  emitenteLogo?: string | null
  emitenteTelefone?: string | null
  emitenteEmail?: string | null
  emitenteEndereco?: string | null
  emitenteCep?: string | null
  destinatarioNome: string
  destinatarioDocumento?: string | null
  destinatarioEndereco?: string | null
  destinatarioBairro?: string | null
  destinatarioCep?: string | null
  destinatarioMunicipio?: string | null
  destinatarioUf?: string | null
  destinatarioTelefone?: string | null
  itens: DanfeItemPdf[]
  valorTotal: string
}

export async function gerarPdfDanfe(input: DanfePdfInput): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 30 })
  const bufferPromise = coletarBuffer(doc)
  const barcode = await gerarCode128Buffer(input.chaveAcesso)

  let logoBuffer: Buffer | null = null
  if (input.emitenteLogo) {
    const match = input.emitenteLogo.match(/^data:image\/[a-z+]+;base64,(.+)$/)
    if (match) {
      try {
        logoBuffer = Buffer.from(match[1], 'base64')
      } catch (e) {}
    }
  }

  let currentY = 30
  const startX = 30
  const totalWidth = 535

  // 1. CANHOTO (RECEBIMENTO)
  const canhotoHeight = 35
  doc.strokeColor('#000000').lineWidth(0.5)
  doc.rect(startX, currentY, totalWidth, canhotoHeight).stroke()

  // Vertical dividers for canhoto
  doc.moveTo(startX + 340, currentY).lineTo(startX + 340, currentY + canhotoHeight).stroke()
  doc.moveTo(startX + 415, currentY).lineTo(startX + 415, currentY + canhotoHeight).stroke()
  doc.moveTo(startX + 480, currentY).lineTo(startX + 480, currentY + canhotoHeight).stroke()

  // Texts for canhoto
  doc.fillColor('#000000').font('Helvetica').fontSize(5.5)
    .text(`RECEBEMOS DE ${input.emitenteNome.toUpperCase()} OS PRODUTOS E SERVIÇOS CONSTANTES NA NOTA FISCAL INDICADA AO LADO`, startX + 4, currentY + 12, { width: 330 })
  
  doc.font('Helvetica-Bold').fontSize(5).fillColor('#374151')
    .text('DATA DE RECEBIMENTO', startX + 340 + 4, currentY + 3)
  
  doc.text('IDENTIFICAÇÃO DE ASSINATURA DO RECEBEDOR', startX + 415 + 4, currentY + 3, { width: 60 })

  doc.font('Helvetica-Bold').fontSize(8).fillColor('#000000')
    .text('NF-e', startX + 480, currentY + 4, { align: 'center', width: 55 })
  doc.fontSize(7).text(`Nº ${input.numero}`, startX + 480, currentY + 14, { align: 'center', width: 55 })
  doc.fontSize(5.5).text(`SÉRIE ${input.serie}`, startX + 480, currentY + 23, { align: 'center', width: 55 })

  currentY += canhotoHeight + 6

  // Dashed divider line
  doc.strokeColor('#000000').lineWidth(0.5).dash(2, { space: 2 }).moveTo(startX, currentY - 3).lineTo(startX + totalWidth, currentY - 3).stroke().undash()

  // 1.5. Homologation header if applicable
  if (input.ambiente !== 'producao') {
    doc.rect(startX, currentY, totalWidth, 14).fillAndStroke('#fee2e2', '#991b1b')
    doc.fillColor('#991b1b').fontSize(7.5).font('Helvetica-Bold')
      .text('NF-E EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO — SEM VALOR FISCAL', startX, currentY + 3.5, { width: totalWidth, align: 'center' })
    currentY += 18
  }

  // 2. Main Header (divided into 3 columns)
  const headerHeight = 55
  doc.strokeColor('#000000').lineWidth(0.5)

  // Col 1: Emitente Info (Logo + Details)
  doc.rect(startX, currentY, 200, headerHeight).stroke()
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, startX + 5, currentY + 6, { width: 42, height: 42, fit: [42, 42] })
    } catch (e) {}
  }
  const textX = logoBuffer ? startX + 52 : startX + 6
  const textWidth = logoBuffer ? 142 : 188
  doc.fillColor('#000000').font('Helvetica-Bold').fontSize(7.5).text(input.emitenteNome.toUpperCase(), textX, currentY + 8, { width: textWidth })
  doc.font('Helvetica').fontSize(5.5).text(`CNPJ: ${input.emitenteCnpj}\nIE: ${input.emitenteIe || '-'}\n${input.emitenteEndereco || ''}\nMARILIA - SP - Fone: ${input.emitenteTelefone || '-'}`, textX, currentY + 18, { width: textWidth })

  // Col 2: DANFE Identification
  doc.rect(startX + 200, currentY, 140, headerHeight).stroke()
  doc.fillColor('#000000').font('Helvetica-Bold').fontSize(8.5).text('DANFE', startX + 200, currentY + 6, { align: 'center', width: 140 })
  doc.font('Helvetica').fontSize(6.2).text('DOCUMENTO AUXILIAR\nDA NOTA FISCAL\nELETRÔNICA\n\n0 - ENTRADA\n1 - SAÍDA', startX + 200, currentY + 15, { align: 'center', width: 140 })
  // Draw a checkbox for "Saída" (value 1)
  doc.rect(startX + 298, currentY + 27, 8, 8).stroke()
  doc.fillColor('#000000').font('Helvetica-Bold').fontSize(6.5).text('1', startX + 300, currentY + 28.5)
  
  doc.font('Helvetica-Bold').fontSize(7.2).text(`Nº ${input.numero}`, startX + 200, currentY + 38, { align: 'center', width: 140 })
  doc.text(`SÉRIE: ${input.serie}`, startX + 200, currentY + 45, { align: 'center', width: 140 })
  doc.fontSize(5.5).text('PÁGINA 1 DE 1', startX + 200, currentY + 51, { align: 'center', width: 140 })

  // Col 3: Controle do Fisco (Barcode & Key)
  doc.rect(startX + 340, currentY, 195, headerHeight).stroke()
  try {
    doc.image(barcode, startX + 340 + 15, currentY + 5, { width: 165, height: 24 })
  } catch (e) {}
  
  doc.fillColor('#4b5563').font('Helvetica-Bold').fontSize(4.5).text('CHAVE DE ACESSO DA NF-e', startX + 340 + 5, currentY + 31)
  const formattedKey = input.chaveAcesso.match(/.{1,4}/g)?.join(' ') || input.chaveAcesso
  doc.fillColor('#000000').font('Courier-Bold').fontSize(6.8).text(formattedKey, startX + 340 + 5, currentY + 37, { width: 185 })
  doc.font('Helvetica').fontSize(5.5).fillColor('#6b7280').text('Consulte a autenticidade em www.nfe.fazenda.gov.br', startX + 340 + 5, currentY + 46, { width: 185 })

  currentY += headerHeight + 4

  // Helper to draw a bordered section for NFe
  function drawSection(title: string, rows: PdfField[][]) {
    // 1. Draw Title
    doc.fillColor('#f3f4f6').rect(startX, currentY, totalWidth, 12).fill()
    doc.strokeColor('#000000').lineWidth(0.5).rect(startX, currentY, totalWidth, 12).stroke()
    doc.fillColor('#1f2937').font('Helvetica-Bold').fontSize(6).text(title.toUpperCase(), startX + 5, currentY + 3.5)
    currentY += 12

    // 2. Draw Rows
    for (const row of rows) {
      const totalFlex = row.reduce((sum, field) => sum + (field.flex || 1), 0)
      
      // Calculate row height
      let maxRowHeight = 22 // minimum height
      for (const field of row) {
        const fieldWidth = ((field.flex || 1) / totalFlex) * totalWidth
        const valStr = String(field.value ?? '-')
        doc.font('Helvetica').fontSize(8)
        const textHeight = doc.heightOfString(valStr, { width: fieldWidth - 8 })
        const fieldHeight = textHeight + 11
        if (fieldHeight > maxRowHeight) {
          maxRowHeight = fieldHeight
        }
      }

      // Draw fields
      let tempX = startX
      for (const field of row) {
        const fieldWidth = ((field.flex || 1) / totalFlex) * totalWidth
        
        doc.strokeColor('#000000').lineWidth(0.5).rect(tempX, currentY, fieldWidth, maxRowHeight).stroke()
        doc.fillColor('#4b5563').font('Helvetica-Bold').fontSize(5.5).text(field.label.toUpperCase(), tempX + 4, currentY + 3, { width: fieldWidth - 8 })
        doc.fillColor('#000000').font('Helvetica').fontSize(7.5).text(String(field.value ?? '-'), tempX + 4, currentY + 11.5, { width: fieldWidth - 8 })
        
        tempX += fieldWidth
      }
      currentY += maxRowHeight
    }
    currentY += 4
  }

  // 3. Natureza da Operação
  drawSection('Natureza da Operação', [
    [
      { label: 'Natureza da Operação', value: 'Venda Dentro do Estado', flex: 2.5 },
      { label: 'Protocolo de Autorização de Uso', value: '135262944542482', flex: 1.5 }
    ],
    [
      { label: 'Inscrição Estadual', value: input.emitenteIe || '-' },
      { label: 'Inscrição Estadual do Subst. Trib.', value: '-' },
      { label: 'CNPJ', value: input.emitenteCnpj }
    ]
  ])

  // 4. Destinatário / Remetente
  drawSection('Destinatário / Remetente', [
    [
      { label: 'Nome / Razão Social', value: input.destinatarioNome.toUpperCase(), flex: 2.5 },
      { label: 'CNPJ / CPF', value: input.destinatarioDocumento || '-', flex: 1 },
      { label: 'Data Emissão', value: new Date().toLocaleDateString('pt-BR'), flex: 1 }
    ],
    [
      { label: 'Endereço', value: (input.destinatarioEndereco || '-').toUpperCase(), flex: 2.5 },
      { label: 'Bairro / Distrito', value: (input.destinatarioBairro || '-').toUpperCase(), flex: 1 },
      { label: 'CEP', value: input.destinatarioCep || '-', flex: 1 },
      { label: 'Data Entrada / Saída', value: new Date().toLocaleDateString('pt-BR'), flex: 1 }
    ],
    [
      { label: 'Município', value: (input.destinatarioMunicipio || '-').toUpperCase(), flex: 2.2 },
      { label: 'Fone / Fax', value: input.destinatarioTelefone || '-' },
      { label: 'UF', value: (input.destinatarioUf || '-').toUpperCase() },
      { label: 'Inscrição Estadual', value: '-' },
      { label: 'Hora Entrada / Saída', value: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }
    ]
  ])

  // 5. Fatura
  drawSection('Fatura', [
    [
      { label: 'Fatura', value: 'Pagamento à Vista' }
    ]
  ])

  // 6. Cálculo do Imposto
  drawSection('Cálculo do Imposto', [
    [
      { label: 'Base de Calc. do ICMS', value: '0,00' },
      { label: 'Valor do ICMS', value: '0,00' },
      { label: 'Base de Calc. do ICMS ST', value: '0,00' },
      { label: 'Valor do ICMS ST', value: '0,00' },
      { label: 'V. Imp. Importação', value: '0,00' },
      { label: 'V. ICMS UF Remet.', value: '0,00' },
      { label: 'Valor do FCP', value: '0,00' },
      { label: 'Valor do PIS', value: '0,00' },
      { label: 'V. Total de Produtos', value: input.valorTotal }
    ],
    [
      { label: 'Valor do Frete', value: '0,00' },
      { label: 'Valor do Seguro', value: '0,00' },
      { label: 'Desconto', value: '0,00' },
      { label: 'Outras Desp.', value: '0,00' },
      { label: 'Valor do IPI', value: '0,00' },
      { label: 'V. ICMS UF Dest.', value: '0,00' },
      { label: 'V. Aprox. do Tributo', value: '0,00' },
      { label: 'Valor da Cofins', value: '0,00' },
      { label: 'Valor Total da Nota', value: input.valorTotal }
    ]
  ])

  // 7. Transportador / Volumes
  drawSection('Transportador / Volumes Transportados', [
    [
      { label: 'Razão Social', value: 'Sem frete', flex: 2.2 },
      { label: 'Frete por Conta', value: '9 - Sem frete' },
      { label: 'Código ANTT', value: '-' },
      { label: 'Placa', value: '-' },
      { label: 'UF', value: '-' },
      { label: 'CNPJ / CPF', value: '-' }
    ],
    [
      { label: 'Endereço', value: '-', flex: 2.5 },
      { label: 'Município', value: '-', flex: 1.5 },
      { label: 'UF', value: '-' },
      { label: 'Insc. Estadual', value: '-' }
    ],
    [
      { label: 'Quantidade', value: '-' },
      { label: 'Espécie', value: '-' },
      { label: 'Marca', value: '-' },
      { label: 'Numeração', value: '-' },
      { label: 'Peso Bruto', value: '-' },
      { label: 'Peso Líquido', value: '-' }
    ]
  ])

  // 8. Dados do Produto/Serviço (Itens)
  doc.fillColor('#f3f4f6').rect(startX, currentY, totalWidth, 12).fill()
  doc.strokeColor('#000000').lineWidth(0.5).rect(startX, currentY, totalWidth, 12).stroke()
  doc.fillColor('#1f2937').font('Helvetica-Bold').fontSize(6).text('DADOS DO PRODUTO/SERVIÇO', startX + 5, currentY + 3.5)
  currentY += 12

  const colWidths = [45, 170, 35, 20, 20, 15, 20, 35, 35, 30, 30, 30, 25, 25]
  const itemHeaders = ['CÓDIGO', 'DESCRIÇÃO DO PRODUTO/SERVIÇO', 'NCM/SH', 'CST', 'CFOP', 'UN', 'QTD.', 'VLR. UNIT', 'VLR. TOTAL', 'BC ICMS', 'VLR. ICMS', 'VLR. IPI', 'ALIQ. ICMS', 'ALIQ. IPI']
  let tempX = startX
  doc.fontSize(5.0).font('Helvetica-Bold').fillColor('#4b5563')
  itemHeaders.forEach((h, i) => {
    doc.strokeColor('#000000').lineWidth(0.5).rect(tempX, currentY, colWidths[i], 12).stroke()
    doc.text(h, tempX + 2, currentY + 3.5, { width: colWidths[i] - 4 })
    tempX += colWidths[i]
  })
  currentY += 12

  doc.font('Helvetica').fontSize(6.5).fillColor('#000000')
  for (const item of input.itens) {
    const descHeight = doc.heightOfString(item.descricao.toUpperCase(), { width: colWidths[1] - 4 })
    const rowHeight = Math.max(14, descHeight + 4)
    
    tempX = startX
    const cells = [
      item.codigo,
      item.descricao.toUpperCase(),
      item.ncm,
      '0102',
      item.cfop,
      'UN',
      item.quantidade.toFixed(3),
      item.valorUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      item.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      '0,00',
      '0,00',
      '0,00',
      '0,00',
      '0,00',
    ]
    
    cells.forEach((val, i) => {
      doc.strokeColor('#000000').lineWidth(0.5).rect(tempX, currentY, colWidths[i], rowHeight).stroke()
      const textY = currentY + (rowHeight - doc.heightOfString(val, { width: colWidths[i] - 4 })) / 2
      const isRightAligned = [7, 8, 9, 10, 11, 12, 13].includes(i)
      doc.text(val, tempX + 2, textY, { width: colWidths[i] - 4, align: isRightAligned ? 'right' : 'left' })
      tempX += colWidths[i]
    })
    currentY += rowHeight
  }
  currentY += 4

  // 9. Cálculo do ISSQN
  drawSection('Cálculo do ISSQN', [
    [
      { label: 'Inscrição Municipal', value: '-' },
      { label: 'Valor Total dos Serviços', value: '0,00' },
      { label: 'Base de Cálculo do ISSQN', value: '0,00' },
      { label: 'Valor do ISSQN', value: '0,00' }
    ]
  ])

  // 10. Dados Adicionais
  doc.fillColor('#f3f4f6').rect(startX, currentY, totalWidth, 12).fill()
  doc.strokeColor('#000000').lineWidth(0.5).rect(startX, currentY, totalWidth, 12).stroke()
  doc.fillColor('#1f2937').font('Helvetica-Bold').fontSize(6).text('DADOS ADICIONAIS', startX + 5, currentY + 3.5)
  currentY += 12

  const boxHeight = 45
  doc.strokeColor('#000000').lineWidth(0.5).rect(startX, currentY, 375, boxHeight).stroke()
  doc.fillColor('#4b5563').font('Helvetica-Bold').fontSize(5.5).text('INFORMAÇÕES COMPLEMENTARES', startX + 4, currentY + 3)
  doc.fillColor('#000000').font('Helvetica').fontSize(6.5).text("DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL. NAO GERA DIREITO A\nCREDITO FISCAL DE ICMS, ISS E IPI", startX + 4, currentY + 11, { width: 367 })

  doc.strokeColor('#000000').lineWidth(0.5).rect(startX + 375, currentY, 160, boxHeight).stroke()
  doc.fillColor('#4b5563').font('Helvetica-Bold').fontSize(5.5).text('RESERVA AO FISCO', startX + 375 + 4, currentY + 3)

  doc.end()
  return bufferPromise
}
