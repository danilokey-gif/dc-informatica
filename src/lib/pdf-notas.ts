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

interface PdfField {
  label: string
  value: string | number | null | undefined
  flex?: number
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
  emitenteMunicipio?: string | null
  emitenteUf?: string | null
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
  /** Numero do protocolo de autorizacao (tag nProt do XML de protocolo da Sefaz). */
  protocolo?: string | null
  /** Data real de emissao (tag dhEmi). Sem ela o PDF nao inventa uma data. */
  dataEmissao?: Date | null
  naturezaOperacao?: string | null
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
  doc.font('Helvetica').fontSize(5.5).text(`CNPJ: ${input.emitenteCnpj}\nIE: ${input.emitenteIe || '-'}\n${input.emitenteEndereco || ''}\n${input.emitenteMunicipio || '-'} - ${input.emitenteUf || '-'} - Fone: ${input.emitenteTelefone || '-'}`, textX, currentY + 18, { width: textWidth })

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
    doc.image(barcode, startX + 340 + 15, currentY + 3, { width: 165, height: 18 })
  } catch (e) {}
  
  // Divider line 1: under barcode
  doc.strokeColor('#000000').lineWidth(0.5).moveTo(startX + 340, currentY + 23).lineTo(startX + 340 + 195, currentY + 23).stroke()
  
  doc.fillColor('#4b5563').font('Helvetica-Bold').fontSize(4.5).text('CHAVE DE ACESSO', startX + 340 + 5, currentY + 26, { width: 185, align: 'center' })
  const formattedKey = input.chaveAcesso.match(/.{1,4}/g)?.join(' ') || input.chaveAcesso
  doc.fillColor('#000000').font('Courier-Bold').fontSize(6.5).text(formattedKey, startX + 340 + 5, currentY + 31.5, { width: 185, align: 'center' })
  
  // Divider line 2: between key and authenticity notice
  doc.strokeColor('#000000').lineWidth(0.5).moveTo(startX + 340, currentY + 41).lineTo(startX + 340 + 195, currentY + 41).stroke()
  
  doc.font('Helvetica').fontSize(4.3).fillColor('#4b5563').text("Consulta de autenticidade no portal nacional da NF-e\nwww.nfe.fazenda.gov.br/portal ou no site da Sefaz Autorizada", startX + 340 + 5, currentY + 44, { width: 185, align: 'center', lineGap: 0.5 })

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
      { label: 'Natureza da Operação', value: input.naturezaOperacao || 'Venda de Mercadoria', flex: 2.5 },
      { label: 'Protocolo de Autorização de Uso', value: input.protocolo || '-', flex: 1.5 }
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
      { label: 'Data Emissão', value: input.dataEmissao ? input.dataEmissao.toLocaleDateString('pt-BR') : '-', flex: 1 }
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

  let totalRowHeight = 0
  doc.font('Helvetica').fontSize(6.5).fillColor('#000000')
  for (const item of input.itens) {
    const descHeight = doc.heightOfString(item.descricao.toUpperCase(), { width: colWidths[1] - 4 })
    const rowHeight = Math.max(14, descHeight + 4)
    totalRowHeight += rowHeight
    
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

  // Desenha um grid em branco complementar para preencher a página A4 (mínimo de 20pt)
  const targetHeight = 180
  const remainingHeight = Math.max(20, targetHeight - totalRowHeight)
  tempX = startX
  colWidths.forEach((width, i) => {
    doc.strokeColor('#000000').lineWidth(0.5).rect(tempX, currentY, width, remainingHeight).stroke()
    tempX += width
  })
  currentY += remainingHeight
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
