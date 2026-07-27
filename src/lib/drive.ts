import fs from 'fs'
import path from 'path'
import { prisma } from './prisma'

export async function salvarNotaNoDrive(type: 'NFe' | 'NFSe', keyOrId: string, xmlContent: string | null, pdfBuffer: Buffer) {
  try {
    const empresa = await prisma.companySettings.findUnique({ where: { id: 'main' } })
    const baseDir = empresa?.localDrivePath || 'C:\\dc-informatica-corrigido_1\\arquivos_notas'
    
    // Criar as pastas do tipo específico no drive
    const targetFolder = path.join(baseDir, type)
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true })
    }
    
    // Salvar o arquivo PDF
    const pdfPath = path.join(targetFolder, `${keyOrId}.pdf`)
    fs.writeFileSync(pdfPath, pdfBuffer)
    
    // Salvar o arquivo XML se houver
    if (xmlContent) {
      const xmlPath = path.join(targetFolder, `${keyOrId}.xml`)
      fs.writeFileSync(xmlPath, xmlContent)
    }
    
    console.log(`[Drive] Salvo arquivos da nota ${keyOrId} em ${targetFolder}`)
  } catch (error) {
    console.error(`[Drive] Erro ao salvar nota no drive:`, error)
  }
}
