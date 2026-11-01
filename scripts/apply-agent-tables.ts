/**
 * Additive Turso migration: agent proposals + audit log tables.
 * Run before deploying application code: pnpm exec tsx scripts/apply-agent-tables.ts
 * Idempotent: ignores "already exists" errors.
 */
import { config } from 'dotenv'
config()

import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

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

async function runStatement(sql: string) {
  try {
    await prisma.$executeRawUnsafe(sql)
    console.log(`OK: ${sql.split('\n')[0].slice(0, 60)}`)
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : ''
    if (message.includes('already exists') || message.includes('duplicate')) {
      console.log(`Ya existe: ${sql.split('\n')[0].slice(0, 60)}`)
      return
    }
    throw error
  }
}

async function main() {
  const migrationPath = join(__dirname, '..', 'prisma', 'migrations', '20261101010000_agent_proposals_and_audit', 'migration.sql')
  const statements = readFileSync(migrationPath, 'utf-8')
    .split(/;\s*$/m)
    .map((s) => s.trim())
    .filter(Boolean)

  try {
    for (const statement of statements) await runStatement(statement)
    console.log('Tablas del agente listas.')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error('Could not apply the agent tables migration.')
  console.error(error)
  process.exitCode = 1
})
