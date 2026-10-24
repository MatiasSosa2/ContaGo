export const OAUTH_STATE_COOKIE = 'mp_oauth_state'
export const OAUTH_STATE_TTL_SECONDS = 600

export type OAuthStatePayload = {
  nonce: string
  userId: string
  businessId: string
  exp: number
}

/** Valida la forma del payload guardado en la cookie (ya descifrado). */
export function parseOAuthState(raw: string): OAuthStatePayload {
  const data = JSON.parse(raw) as Partial<OAuthStatePayload>
  if (
    typeof data.nonce !== 'string' ||
    typeof data.userId !== 'string' ||
    typeof data.businessId !== 'string' ||
    typeof data.exp !== 'number'
  ) {
    throw new Error('State inválido')
  }
  return data as OAuthStatePayload
}
