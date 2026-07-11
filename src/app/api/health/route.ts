import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Health check endpoint para monitoreo externo (UptimeRobot / Better Stack).
 * Devuelve 200 si la app y la base de datos responden, 503 si la DB falla.
 *
 * GET /api/health
 */
export async function GET() {
  const startedAt = Date.now()

  let dbOk = false
  let dbLatencyMs: number | null = null
  let dbError: string | null = null

  try {
    const dbStart = Date.now()
    // Query mínima para verificar conectividad real con la base.
    await prisma.$queryRaw`SELECT 1`
    dbLatencyMs = Date.now() - dbStart
    dbOk = true
  } catch (err) {
    dbError = err instanceof Error ? err.message : 'unknown database error'
  }

  const body = {
    status: dbOk ? ('ok' as const) : ('degraded' as const),
    timestamp: new Date().toISOString(),
    uptimeMs: Math.round(process.uptime() * 1000),
    responseMs: Date.now() - startedAt,
    checks: {
      database: {
        ok: dbOk,
        latencyMs: dbLatencyMs,
        error: dbError,
      },
    },
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev',
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
  }

  return NextResponse.json(body, {
    status: dbOk ? 200 : 503,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  })
}
