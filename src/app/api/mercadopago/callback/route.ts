import { NextResponse, type NextRequest } from 'next/server'
import { getSessionContext } from '@/server/auth/get-session-context'
import { exchangeAuthorizationCode, MercadoPagoError } from '@/server/mercadopago/client'
import { saveConnection } from '@/server/mercadopago/connection'
import { decryptSecret } from '@/server/mercadopago/crypto'
import { OAUTH_STATE_COOKIE, parseOAuthState } from '@/server/mercadopago/oauth-state'

const PAGE = '/mercadopago'

function finish(req: NextRequest, status: string) {
  const response = NextResponse.redirect(new URL(`${PAGE}?mp=${status}`, req.url))
  response.cookies.delete({ name: OAUTH_STATE_COOKIE, path: '/api/mercadopago' })
  return response
}

export async function GET(req: NextRequest) {
  const session = await getSessionContext()
  if (!session?.activeBusiness || session.activeBusiness.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/auth/error?error=AccessDenied', req.url))
  }

  const params = req.nextUrl.searchParams
  if (params.get('error')) return finish(req, 'denied')

  const code = params.get('code')
  const state = params.get('state')
  const cookieValue = req.cookies.get(OAUTH_STATE_COOKIE)?.value
  if (!code || !state || !cookieValue) return finish(req, 'error')

  let expected
  try {
    expected = parseOAuthState(decryptSecret(cookieValue))
  } catch {
    return finish(req, 'error')
  }

  // El state debe coincidir y pertenecer a este mismo usuario y negocio activo.
  if (
    expected.nonce !== state ||
    expected.userId !== session.user.id ||
    expected.businessId !== session.activeBusiness.id ||
    expected.exp < Date.now()
  ) {
    return finish(req, 'error')
  }

  try {
    const tokens = await exchangeAuthorizationCode(code)
    await saveConnection(session.activeBusiness.id, session.user.id, tokens)
    return finish(req, 'connected')
  } catch (error) {
    if (!(error instanceof MercadoPagoError)) console.error('Error en callback de Mercado Pago')
    return finish(req, 'error')
  }
}
