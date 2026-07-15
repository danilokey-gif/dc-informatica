const encoder = new TextEncoder()

export interface Session {
  userId: string
  role: string
}

function getSecret() {
  const secret = process.env.AUTH_SECRET
  if (!secret) {
    throw new Error('AUTH_SECRET não configurado')
  }
  return secret
}

async function hmac(data: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data))
  return Buffer.from(signature).toString('base64url')
}

export async function signSession(userId: string, role: string) {
  const payload = `${userId}.${role}`
  const signature = await hmac(payload)
  return `${payload}.${signature}`
}

export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null
  const separatorIndex = token.lastIndexOf('.')
  if (separatorIndex === -1) return null

  const payload = token.slice(0, separatorIndex)
  const signature = token.slice(separatorIndex + 1)
  const expectedSignature = await hmac(payload)

  if (signature !== expectedSignature) return null

  const dotIndex = payload.indexOf('.')
  if (dotIndex === -1) return null

  const userId = payload.slice(0, dotIndex)
  const role = payload.slice(dotIndex + 1)
  return { userId, role }
}
