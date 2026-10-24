import { randomBytes } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { getSessionContext } from '@/server/auth/get-session-context'
import { buildAuthorizationUrl } from '@/server/mercadopago/client'
import { encryptSecret } from '@/server/mercadopago/crypto'
import { OAUTH_STATE_COOKIE, OAUTH_STATE_TTL_SECONDS } from '@/server/mercadopago/oauth-state'

export async function GET(req: NextRequest) {
  const session = await getSessionContext()
  if (!session?.activeBusiness || session.activeBusiness.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/auth/error?error=AccessDenied', req.url))
  }

  const nonce = randomBytes(24).toString('base64url')
  const payload = encryptSecret(
    JSON.stringify({
      nonce,
      userId: session.user.id,
      businessId: session.activeBusiness.id,
      exp: Date.now() + OAUTH_STATE_TTL_SECONDS * 1000,
    }),
  )

  const response = NextResponse.redirect(buildAuthorizationUrl(nonce))
  response.cookies.set(OAUTH_STATE_COOKIE, payload, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/mercadopago',
    maxAge: OAUTH_STATE_TTL_SECONDS,
  })
  return response
}
