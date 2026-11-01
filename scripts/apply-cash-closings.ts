/**
 * Additive Turso migration: daily cash closings.
 * Run with: pnpm exec tsx scripts/apply-cash-closings.ts
 * Idempotent: existing tables and indexes are left intact.
 */
import { config } from 'dotenv'
config()

import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function stripQuotes(value: string | undefined): string | undefined {
  return value?.replace(/^['"]|['"]$/g, '')
}

function buildClient() {
  const url = stripQuotes(process.env.TURSO_DATABASE_URL) || stripQuotes(process.env.DATABASE_URL)
  const authToken = stripQuotes(process.env.TURSO_AUTH_TOKEN)
  if (!url) throw new Error('Configurá TURSO_DATABASE_URL o DATABASE_URL antes de aplicar la migración.')
  if (/^https:/i.test(url) && !authToken) throw new Error('Configurá TURSO_AUTH_TOKEN para conectarte a Turso.')
  return new PrismaClient({ adapter: new PrismaLibSql({ url, ...(authToken ? { authToken } : {}) }) })
}

const prisma = buildClient()

async function runStatement(sql: string) {
  try {
    await prisma.$executeRawUnsafe(sql)
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : ''
    if (message.includes('already exists') || message.includes('duplicate')) return
    throw error
  }
}

async function main() {
  const migrationPath = join(__dirname, '..', 'prisma', 'migrations', '20261101074314_cash_closings', 'migration.sql')
  const statements = readFileSync(migrationPath, 'utf8')
    .split(/;\s*$/m)
    .map((statement) => statement.trim())
    .filter(Boolean)

  try {
    for (const statement of statements) await runStatement(statement)
    const tables = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'CashClosing'
    `
    if (tables.length !== 1) throw new Error('No se pudo verificar la tabla CashClosing.')
    console.log('Migración de cierres de caja aplicada y verificada en Turso.')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error('No se pudo aplicar la migración de cierres de caja en Turso.')
  console.error(error)
  process.exitCode = 1
})
