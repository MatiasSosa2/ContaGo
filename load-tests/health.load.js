import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'

/**
 * Load test con k6 contra el health check y rutas públicas.
 *
 * Instalar k6 (gratis): https://k6.io/docs/get-started/installation/
 *   Windows:  winget install k6 --source winget
 *
 * Uso:
 *   k6 run --env BASE_URL=http://localhost:3000 load-tests/health.load.js
 *   k6 run --env BASE_URL=https://tu-app.vercel.app load-tests/health.load.js
 *
 * Simula una rampa de carga y valida SLOs (latencia p95 y tasa de error).
 */

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'

const errorRate = new Rate('errores')
const healthLatency = new Trend('health_latencia_ms')

export const options = {
  stages: [
    { duration: '30s', target: 20 },  // rampa a 20 usuarios virtuales
    { duration: '1m', target: 20 },   // sostener
    { duration: '30s', target: 50 },  // pico
    { duration: '1m', target: 50 },   // sostener pico
    { duration: '30s', target: 0 },   // enfriar
  ],
  thresholds: {
    // SLOs profesionales: 95% de requests bajo 800ms, menos de 1% de errores.
    http_req_duration: ['p(95)<800'],
    errores: ['rate<0.01'],
    http_req_failed: ['rate<0.01'],
  },
}

export default function () {
  const res = http.get(`${BASE_URL}/api/health`)

  const ok = check(res, {
    'status 200': (r) => r.status === 200,
    'body status ok': (r) => {
      try {
        return JSON.parse(r.body).status === 'ok'
      } catch {
        return false
      }
    },
    'db conectada': (r) => {
      try {
        return JSON.parse(r.body).checks.database.ok === true
      } catch {
        return false
      }
    },
  })

  errorRate.add(!ok)
  healthLatency.add(res.timings.duration)

  sleep(1)
}
