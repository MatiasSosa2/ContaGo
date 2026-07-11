import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { apiRateLimiter, authRateLimiter, rateLimitEnabled } from '@/lib/rate-limit'

/**
 * Middleware global: aplica rate limiting por IP a rutas de API y de auth.
 *
 * - Rutas /api/auth/* y /auth/*  -> limitador estricto (anti fuerza bruta).
 * - Resto de /api/*              -> limitador general.
 * - Si Upstash no está configurado, no bloquea nada (fail-open).
 *
 * El health check queda excluido para no interferir con el monitoreo externo.
 */

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]!.trim()
  return req.headers.get('x-real-ip')?.trim() ?? '127.0.0.1'
}

export async function middleware(req: NextRequest) {
  // Sin credenciales de Upstash: no hacemos nada.
  if (!rateLimitEnabled) return NextResponse.next()

  const { pathname } = req.nextUrl

  // Nunca limitar el health check (lo consulta el monitor de uptime).
  if (pathname === '/api/health') return NextResponse.next()

  const isAuthRoute =
    pathname.startsWith('/api/auth') || pathname.startsWith('/auth')
  const limiter = isAuthRoute ? authRateLimiter : apiRateLimiter

  if (!limiter) return NextResponse.next()

  const ip = getClientIp(req)
  const identifier = `${isAuthRoute ? 'auth' : 'api'}:${ip}`

  const { success, limit, remaining, reset } = await limiter.limit(identifier)

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
