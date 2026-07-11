import * as Sentry from '@sentry/nextjs'

/**
 * Punto de entrada de instrumentación de Next.js.
 * Carga la configuración de Sentry según el runtime activo.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config')
  }
}

// Captura errores de renderizado en servidor (App Router).
export const onRequestError = Sentry.captureRequestError
