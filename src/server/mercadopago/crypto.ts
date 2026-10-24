import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'

function getKey(): Buffer {
  const secret = process.env.MP_TOKEN_ENCRYPTION_KEY
  if (!secret) throw new Error('Falta MP_TOKEN_ENCRYPTION_KEY en las variables del entorno')
  return createHash('sha256').update(secret).digest()
}

/** Cifra con AES-256-GCM. Formato: iv:tag:ciphertext (base64). */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv, tag, data].map((part) => part.toString('base64')).join(':')
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(':')
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Token cifrado inválido')
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  const data = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()])
  return data.toString('utf8')
}
