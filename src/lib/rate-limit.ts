import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

/**
 * Rate limiting basado en Upstash Redis (free tier).
 *
 * Si las variables de entorno de Upstash no están configuradas, el limitador
 * se desactiva en desarrollo. En producción, la configuración se valida al
 * iniciar y el proxy devuelve 503 si el servicio falta. Configurá:
 *   - UPSTASH_REDIS_REST_URL
 *   - UPSTASH_REDIS_REST_TOKEN
 */

const redisUrl = process.env.UPSTASH_REDIS_REST_URL
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

const isConfigured = Boolean(redisUrl && redisToken)

const redis = isConfigured
  ? new Redis({ url: redisUrl!, token: redisToken! })
  : null

/**
 * Limitador general de la API: 100 requests por minuto por IP.
 * Sliding window para suavizar picos.
 */
export const apiRateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, '60 s'),
      analytics: true,
      prefix: 'contago:rl:api',
    })
  : null

/**
 * Limitador estricto para rutas sensibles de autenticación:
 * 10 intentos por minuto por IP (login, verificación de código, etc.).
 */
export const authRateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '60 s'),
      analytics: true,
      prefix: 'contago:rl:auth',
    })
  : null

export const rateLimitEnabled = isConfigured
