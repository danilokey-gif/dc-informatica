import { prisma } from './prisma'
import { decryptSecret } from './crypto'

/**
 * Google Drive da conta do próprio usuário (OAuth 2.0). Os arquivos ficam no Drive dele e contam
 * na cota do Gmail. A conta de serviço antiga não serve para isso: o Google dá cota zero de
 * armazenamento para contas de serviço, então ela só conseguia criar pastas.
 *
 * Escopo drive.file: o sistema só enxerga os arquivos e pastas que ele mesmo criou.
 */
export const ESCOPO_DRIVE = 'https://www.googleapis.com/auth/drive.file'
export const NOME_PASTA_RAIZ = 'Dc Informática - Sistema'
const API = 'https://www.googleapis.com/drive/v3'

export function urlRedirecionamento(origem: string) {
  return `${origem}/api/google/callback`
}

export async function driveDoUsuarioConectado(): Promise<boolean> {
  const s = await prisma.companySettings.findUnique({ where: { id: 'main' }, select: { gdriveRefreshToken: true, gdriveClientId: true } })
  return !!(s?.gdriveRefreshToken && s.gdriveClientId)
}

/** Token de acesso novo a partir do refresh token guardado (válido por ~1 hora). */
export async function tokenDoUsuario(): Promise<string> {
  const s = await prisma.companySettings.findUnique({ where: { id: 'main' } })
  if (!s?.gdriveClientId || !s.gdriveClientSecret || !s.gdriveRefreshToken) {
    throw new Error('Google Drive não conectado. Vá em Configurações > Google Drive e clique em "Conectar".')
  }
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: s.gdriveClientId,
      client_secret: decryptSecret(s.gdriveClientSecret),
      refresh_token: decryptSecret(s.gdriveRefreshToken),
      grant_type: 'refresh_token',
    }),
  })
  const d = await r.json()
  if (!r.ok) {
    if (d.error === 'invalid_grant') throw new Error('A autorização do Google Drive expirou ou foi revogada. Conecte de novo em Configurações > Google Drive.')
    throw new Error(`Google recusou o acesso ao Drive: ${d.error_description || d.error || r.status}`)
  }
  return d.access_token
}

async function api(token: string, caminho: string, init: RequestInit = {}) {
  const r = await fetch(caminho.startsWith('http') ? caminho : `${API}${caminho}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) },
  })
  if (!r.ok) throw new Error(`Google Drive respondeu ${r.status}: ${(await r.text()).slice(0, 300)}`)
  return r
}

/** Pasta pelo nome dentro de outra; cria se não existir. */
export async function garantirPasta(token: string, nome: string, paiId: string): Promise<string> {
  const q = `name='${nome.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and '${paiId}' in parents and trashed=false`
  const lista = await (await api(token, `/files?q=${encodeURIComponent(q)}&fields=files(id)`)).json()
  if (lista.files?.[0]) return lista.files[0].id
  const criada = await (await api(token, '/files?fields=id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: nome, mimeType: 'application/vnd.google-apps.folder', parents: [paiId] }),
  })).json()
  return criada.id
}

/** Pasta raiz "Dc Informática - Sistema" no Meu Drive (criada na primeira conexão). */
export async function pastaRaiz(token: string): Promise<string> {
  const s = await prisma.companySettings.findUnique({ where: { id: 'main' }, select: { gdrivePastaRaizId: true } })
  if (s?.gdrivePastaRaizId) {
    const r = await fetch(`${API}/files/${s.gdrivePastaRaizId}?fields=id,trashed`, { headers: { Authorization: `Bearer ${token}` } })
    if (r.ok && !(await r.json()).trashed) return s.gdrivePastaRaizId
  }
  const id = await garantirPasta(token, NOME_PASTA_RAIZ, 'root')
  await prisma.companySettings.update({ where: { id: 'main' }, data: { gdrivePastaRaizId: id } })
  return id
}

/** Caminho de pastas a partir da raiz (ex.: ["Ordens de Serviço", "OS JPP4RE"]). */
export async function pastaPorCaminho(token: string, caminho: string[]): Promise<string> {
  let atual = await pastaRaiz(token)
  for (const nome of caminho) atual = await garantirPasta(token, nome, atual)
  return atual
}

/**
 * Abre uma sessão de upload "resumível" para o navegador enviar o arquivo direto ao Google
 * (vídeos não passam pelo servidor do sistema, que aceita no máximo 4,5 MB por requisição).
 * O Origin informado faz o Google liberar o envio vindo desse site.
 */
export async function iniciarUploadResumivel(token: string, opcoes: { nome: string; mimeType: string; tamanho: number; pastaId: string; origem: string; descricao?: string }): Promise<string> {
  const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,size,sha256Checksum,mimeType', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': opcoes.mimeType,
      'X-Upload-Content-Length': String(opcoes.tamanho),
      Origin: opcoes.origem,
    },
    body: JSON.stringify({ name: opcoes.nome, parents: [opcoes.pastaId], description: opcoes.descricao }),
  })
  if (!r.ok) throw new Error(`Google Drive recusou o envio (${r.status}): ${(await r.text()).slice(0, 300)}`)
  const url = r.headers.get('location')
  if (!url) throw new Error('Google Drive não devolveu o endereço de envio.')
  return url
}

export interface ArquivoDrive {
  id: string
  name: string
  mimeType: string
  size?: string
  sha256Checksum?: string
  parents?: string[]
  webViewLink?: string
  thumbnailLink?: string
  createdTime?: string
}

export async function dadosDoArquivo(token: string, id: string): Promise<ArquivoDrive> {
  return (await api(token, `/files/${id}?fields=id,name,mimeType,size,sha256Checksum,parents,webViewLink,thumbnailLink,createdTime`)).json()
}

/** Envio simples (arquivos pequenos gerados no servidor, como PDF e XML de nota). Substitui se já existir. */
export async function enviarArquivoPequeno(token: string, nome: string, mimeType: string, conteudo: Buffer, pastaId: string) {
  const q = `name='${nome.replace(/'/g, "\\'")}' and '${pastaId}' in parents and trashed=false`
  const existente = (await (await api(token, `/files?q=${encodeURIComponent(q)}&fields=files(id)`)).json()).files?.[0]
  if (existente) {
    await api(token, `https://www.googleapis.com/upload/drive/v3/files/${existente.id}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': mimeType }, body: conteudo as unknown as BodyInit })
    return existente.id as string
  }
  const limite = 'dcinformatica' + Date.now()
  const corpo = Buffer.concat([
    Buffer.from(`--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: nome, parents: [pastaId] })}\r\n--${limite}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    conteudo,
    Buffer.from(`\r\n--${limite}--`),
  ])
  const r = await api(token, 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${limite}` }, body: corpo as unknown as BodyInit,
  })
  return (await r.json()).id as string
}

/** Move um arquivo para outra pasta e renomeia (usado para notas canceladas). */
export async function moverArquivo(token: string, nome: string, deId: string, paraId: string, novoNome: string) {
  const q = `name='${nome.replace(/'/g, "\\'")}' and '${deId}' in parents and trashed=false`
  const arq = (await (await api(token, `/files?q=${encodeURIComponent(q)}&fields=files(id)`)).json()).files?.[0]
  if (!arq) return
  await api(token, `/files/${arq.id}?addParents=${paraId}&removeParents=${deId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: novoNome }),
  })
}
