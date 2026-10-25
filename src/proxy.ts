import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { apiRateLimiter, authRateLimiter, rateLimitEnabled } from '@/lib/rate-limit'

/**
 * Proxy global: aplica rate limiting por IP a rutas de API y de auth.
 *
 * - Rutas /api/auth/* y /auth/*  -> limitador estricto (anti fuerza bruta).
 * - Resto de /api/*              -> limitador general.
 * - En desarrollo sin Upstash continúa sin limitar; en producción la falta de
 *   configuración devuelve 503 en vez de desactivar silenciosamente el límite.
 *
 * El health check queda excluido para no interferir con el monitoreo externo.
 */

// El primer valor de x-forwarded-for lo controla el cliente; el último lo agrega
// el proxy de confianza. x-real-ip, cuando existe, lo fija la plataforma.
function getClientIp(req: NextRequest): string {
  const realIp = req.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp
  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    const parts = xff.split(',').map((part) => part.trim()).filter(Boolean)
    const last = parts[parts.length - 1]
    if (last) return last
  }
  return '127.0.0.1'
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Nunca limitar el health check (lo consulta el monitor de uptime).
  if (pathname === '/api/health') return NextResponse.next()

  if (process.env.NODE_ENV === 'production' && !rateLimitEnabled) {
    return NextResponse.json(
      { error: 'El servicio no está disponible temporalmente.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  // Sin credenciales de Upstash en desarrollo: no hacemos nada.
  if (!rateLimitEnabled) return NextResponse.next()

  const isAuthRoute =
    pathname.startsWith('/api/auth') || pathname.startsWith('/auth')
  const limiter = isAuthRoute ? authRateLimiter : apiRateLimiter

  if (!limiter) return NextResponse.next()

  const ip = getClientIp(req)
  const identifier = `${isAuthRoute ? 'auth' : 'api'}:${ip}`

  let limitResult: Awaited<ReturnType<typeof limiter.limit>>
  try {
    limitResult = await limiter.limit(identifier)
  } catch (error) {
    console.error('[proxy] rate limit check failed', error)
    return NextResponse.json(
      { error: 'El servicio de protección está temporalmente no disponible.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const { success, limit, remaining, reset } = limitResult

  if (!success) {
    const retryAfterSec = Math.max(1, Math.ceil((reset - Date.now()) / 1000))
    return NextResponse.json(
      { error: 'Demasiadas solicitudes. Intentá de nuevo en unos segundos.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSec),
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': String(remaining),
          'X-RateLimit-Reset': String(reset),
        },
      },
    )
  }

  const res = NextResponse.next()
  res.headers.set('X-RateLimit-Limit', String(limit))
  res.headers.set('X-RateLimit-Remaining', String(remaining))
  return res
}

export const config = {
  // Aplica a rutas de API y de autenticación. Excluye estáticos y assets.
  matcher: ['/api/:path*', '/auth/:path*'],
}
