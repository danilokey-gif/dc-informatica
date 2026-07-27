import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { prisma } from './prisma'

// Obter token de acesso para a API do Google Drive usando JWT (sem dependências externas)
async function getGoogleAccessToken(email: string, privateKey: string): Promise<string> {
  let cleanKey = privateKey.trim()
  if (cleanKey.startsWith('{')) {
    try {
      const parsed = JSON.parse(cleanKey)
      if (parsed.private_key) {
        cleanKey = parsed.private_key
      }
    } catch (e) {
      console.error('[Google Drive] Falha ao parsear chave privada como JSON:', e)
    }
  }
  cleanKey = cleanKey.replace(/\\n/g, '\n')
  
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  }
  
  const now = Math.floor(Date.now() / 1000)
  const claim = {
    iss: email,
    scope: 'https://www.googleapis.com/auth/drive.file',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  }
  
  const base64Header = Buffer.from(JSON.stringify(header)).toString('base64url')
  const base64Claim = Buffer.from(JSON.stringify(claim)).toString('base64url')
  const signatureInput = `${base64Header}.${base64Claim}`
  
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(signatureInput)
  const signature = signer.sign(cleanKey, 'base64url')
  
  const jwt = `${signatureInput}.${signature}`
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  })
  
  if (!response.ok) {
    throw new Error(`Autenticação com Google falhou: ${await response.text()}`)
  }
  
  const data = await response.json()
  return data.access_token
}

// Procurar ou criar uma pasta no Google Drive
async function findOrCreateDriveFolder(accessToken: string, folderName: string, parentId?: string): Promise<string> {
  const query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parentId ? ` and '${parentId}' in parents` : ''}`
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`
  const searchResponse = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  if (searchResponse.ok) {
    const searchData = await searchResponse.json()
    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0].id
    }
  }
  
  const createMetadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    parents: parentId ? [parentId] : undefined
  }
  const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(createMetadata)
  })
  
  if (!createResponse.ok) {
    throw new Error(`Falha ao criar pasta "${folderName}" no Google Drive: ${await createResponse.text()}`)
  }
  
  const createData = await createResponse.json()
  return createData.id
}

// Fazer upload de um arquivo para uma pasta específica do Google Drive
async function uploadToDrive(accessToken: string, fileName: string, mimeType: string, content: Buffer, folderId: string) {
  const query = `name='${fileName}' and '${folderId}' in parents and trashed=false`
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`
  const searchResponse = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  let existingFileId: string | null = null
  if (searchResponse.ok) {
    const searchData = await searchResponse.json()
    if (searchData.files && searchData.files.length > 0) {
      existingFileId = searchData.files[0].id
    }
  }

  const metadata = {
    name: fileName,
    mimeType: mimeType,
    parents: existingFileId ? undefined : [folderId]
  }

  const boundary = 'foo_bar_baz'
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
    Buffer.from(`\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    content,
    Buffer.from(`\r\n--${boundary}--`)
  ])

  let uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart'
  let method = 'POST'
  if (existingFileId) {
    uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`
    method = 'PATCH'
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  }
  if (existingFileId) {
    headers['Content-Type'] = mimeType
  } else {
    headers['Content-Type'] = `multipart/related; boundary=${boundary}`
  }

  const response = await fetch(uploadUrl, {
    method,
    headers,
    body: (existingFileId ? content : body) as any
  })

  if (!response.ok) {
    throw new Error(`Upload do arquivo falhou: ${await response.text()}`)
  }
}

export async function salvarNotaNoDrive(type: 'NFe' | 'NFSe', keyOrId: string, xmlContent: string | null, pdfBuffer: Buffer) {
  // 1. Salvar no drive local (se rodando localmente)
  try {
    const empresa = await prisma.companySettings.findUnique({ where: { id: 'main' } })
    const baseDir = empresa?.localDrivePath || 'C:\\dc-informatica-corrigido_1\\arquivos_notas'
    
    const targetFolder = path.join(baseDir, type)
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true })
    }
    
    const pdfPath = path.join(targetFolder, `${keyOrId}.pdf`)
    fs.writeFileSync(pdfPath, pdfBuffer)
    
    if (xmlContent) {
      const xmlPath = path.join(targetFolder, `${keyOrId}.xml`)
      fs.writeFileSync(xmlPath, xmlContent)
    }
    console.log(`[Drive Local] Arquivos salvos localmente em ${targetFolder}`)
  } catch (error) {
    console.warn(`[Drive Local] Ignorado ou falhou ao salvar no disco local (provavelmente rodando em nuvem/Vercel):`, error)
  }

  // 2. Enviar para o Google Drive se configurado nas preferências
  try {
    const empresa = await prisma.companySettings.findUnique({ where: { id: 'main' } })
    if (empresa?.gdriveFolderId && empresa?.gdriveEmail && empresa?.gdrivePrivateKey) {
      console.log(`[Google Drive] Iniciando envio automático para a nuvem...`)
      const token = await getGoogleAccessToken(empresa.gdriveEmail, empresa.gdrivePrivateKey)
      
      // Encontrar ou criar a pasta específica (NFe ou NFSe)
      const typeFolderId = await findOrCreateDriveFolder(token, type, empresa.gdriveFolderId)
      
      // Upload PDF
      await uploadToDrive(token, `${keyOrId}.pdf`, 'application/pdf', pdfBuffer, typeFolderId)
      
      // Upload XML
      if (xmlContent) {
        await uploadToDrive(token, `${keyOrId}.xml`, 'application/xml', Buffer.from(xmlContent), typeFolderId)
      }
      
      console.log(`[Google Drive] Notas salvas na nuvem com sucesso!`)
    }
  } catch (error) {
    console.error(`[Google Drive] Falha no upload para o Google Drive:`, error)
  }
}

export async function moverNotaNoGoogleDriveCancelada(type: 'NFe' | 'NFSe', keyOrId: string) {
  try {
    const empresa = await prisma.companySettings.findUnique({ where: { id: 'main' } })
    if (empresa?.gdriveFolderId && empresa?.gdriveEmail && empresa?.gdrivePrivateKey) {
      console.log(`[Google Drive] Processando cancelamento na nuvem...`)
      const token = await getGoogleAccessToken(empresa.gdriveEmail, empresa.gdrivePrivateKey)
      
      // Encontrar a pasta do tipo (NFe ou NFSe)
      const typeFolderId = await findOrCreateDriveFolder(token, type, empresa.gdriveFolderId)
      
      // Encontrar ou criar a pasta "Canceladas" dentro dela
      const cancelFolderId = await findOrCreateDriveFolder(token, 'Canceladas', typeFolderId)
      
      const fileNames = [`${keyOrId}.pdf`, `${keyOrId}.xml`]
      
      for (const fileName of fileNames) {
        const query = `name='${fileName}' and '${typeFolderId}' in parents and trashed=false`
        const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`
        const searchResponse = await fetch(searchUrl, {
          headers: { Authorization: `Bearer ${token}` }
        })
        
        if (searchResponse.ok) {
          const searchData = await searchResponse.json()
          if (searchData.files && searchData.files.length > 0) {
            const fileId = searchData.files[0].id
            // Mover para a pasta Canceladas e renomear adicionando [CANCELADA]
            const newName = `[CANCELADA] ${fileName}`
            await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${cancelFolderId}&removeParents=${typeFolderId}`, {
              method: 'PATCH',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ name: newName })
            })
            console.log(`[Google Drive] Nota ${fileName} movida para Canceladas e renomeada.`)
          }
        }
      }
    }
  } catch (error) {
    console.error(`[Google Drive] Falha ao processar cancelamento no Google Drive:`, error)
  }
}
