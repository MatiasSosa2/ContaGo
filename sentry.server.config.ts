import * as Sentry from '@sentry/nextjs'

/**
 * Configuración de Sentry para el runtime de servidor (Node.js).
 * Si no hay DSN configurado, Sentry queda inactivo (no rompe nada).
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  // Muestreo de trazas: 10% en prod para no agotar el free tier.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  // No enviar PII por defecto (datos contables sensibles).
  sendDefaultPii: false,
})
