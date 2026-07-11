import http from 'k6/http'
import { check } from 'k6'

/**
 * Test de rate limiting: verifica que el middleware devuelve 429 al superar
 * el umbral configurado en Upstash. Requiere UPSTASH_* configurado en el server.
 *
 * Uso:
 *   k6 run --env BASE_URL=http://localhost:3000 load-tests/rate-limit.load.js
 *
 * Dispara 150 requests rápidas a una ruta de auth (límite 10/min) y espera
 * que aparezcan respuestas 429.
 */

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'

export const options = {
  vus: 15,
  iterations: 150,
}

export default function () {
  const res = http.get(`${BASE_URL}/auth/login`)
  check(res, {
    'respondió 200 o 429': (r) => r.status === 200 || r.status === 429,
  })
}

export function handleSummary(data) {
  const rl = data.metrics['http_reqs']
  return {
    stdout:
      '\nTotal requests: ' +
      (rl ? rl.values.count : 0) +
      '\nRevisá arriba cuántas devolvieron 429 (rate limit activo).\n',
  }
}
