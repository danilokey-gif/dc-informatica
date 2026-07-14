const encoder = new TextEncoder()

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

export async function signSession(userId: string) {
  const signature = await hmac(userId)
  return `${userId}.${signature}`
}

export async function verifySession(token: string | undefined): Promise<string | null> {
  if (!token) return null
  const separatorIndex = token.lastIndexOf('.')
  if (separatorIndex === -1) return null

  const userId = token.slice(0, separatorIndex)
  const signature = token.slice(separatorIndex + 1)
  const expectedSignature = await hmac(userId)

  if (signature !== expectedSignature) return null
  return userId
}
