/**
 * Additive Turso migration for the second and third concurrent user sessions.
 * Run before deploying application code: pnpm exec tsx scripts/apply-three-device-sessions.ts
 */
import { config } from 'dotenv'
config()

import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

function stripQuotes(value: string | undefined): string | undefined {
  return value?.replace(/^["']|["']$/g, '')
}

function buildClient() {
  const url = stripQuotes(process.env.TURSO_DATABASE_URL) || stripQuotes(process.env.DATABASE_URL)
  const authToken = stripQuotes(process.env.TURSO_AUTH_TOKEN)
  if (!url) throw new Error('Configura TURSO_DATABASE_URL o DATABASE_URL antes de aplicar la migración.')
  if (/^https:/i.test(url) && !authToken) {
    throw new Error('Configura TURSO_AUTH_TOKEN para aplicar la migración en Turso.')
  }
  const adapter = new PrismaLibSql({ url, ...(authToken ? { authToken } : {}) })
  return new PrismaClient({ adapter })
}

const prisma = buildClient()
const columns = [
  ['activeSessionId2', 'TEXT'],
  ['activeSessionExpiresAt2', 'DATETIME'],
  ['activeSessionId3', 'TEXT'],
  ['activeSessionExpiresAt3', 'DATETIME'],
] as const

async function addColumn(name: string, type: string) {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "${name}" ${type}`)
    console.log(`Added User.${name}`)
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : ''
    if (message.includes('duplicate column') || message.includes('already exists')) {
      console.log(`User.${name} already exists`)
      return
    }
    throw error
  }
}

async function main() {
  try {
    await prisma.$queryRaw`SELECT 1 FROM "User" LIMIT 1`
    for (const [name, type] of columns) await addColumn(name, type)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error('Could not apply the three-device session migration.')
  console.error(error)
  process.exitCode = 1
})
