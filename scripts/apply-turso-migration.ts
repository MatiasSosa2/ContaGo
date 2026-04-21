/**
 * apply-turso-migration.ts
 *
 * Aplica los cambios de schema de doble partida directamente a Turso
 * usando ALTER TABLE (compatible con SQLite/libSQL remoto, sin PRAGMA).
 *
 * Idempotente: ignora errores de "column/table already exists".
 *
 * Uso:
 *   npx tsx scripts/apply-turso-migration.ts
 */

import { config } from 'dotenv'
config()

import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

function stripQuotes(val: string | undefined): string | undefined {
  return val?.replace(/^["']|["']$/g, '')
}

function buildClient() {
  const url = stripQuotes(process.env.TURSO_DATABASE_URL) || stripQuotes(process.env.DATABASE_URL)
  const authToken = stripQuotes(process.env.TURSO_AUTH_TOKEN)
  if (!url) throw new Error('No se encontró TURSO_DATABASE_URL ni DATABASE_URL en .env')
  const adapter = new PrismaLibSql(authToken ? { url, authToken } : { url })
  return new PrismaClient({ adapter } as any)
}

const prisma = buildClient()

async function exec(sql: string, label: string) {
  try {
    await prisma.$executeRawUnsafe(sql)
    console.log(`  ✅ ${label}`)
  } catch (err: any) {
    const msg: string = err?.cause?.message ?? err?.message ?? ''
    if (
      msg.includes('already exists') ||
      msg.includes('duplicate column') ||
      msg.includes('already have a column')
    ) {
      console.log(`  ⚠️  ${label} — ya existe, saltando`)
    } else {
      console.error(`  ❌ ${label} — error:`, msg)
      throw err
    }
  }
}

async function main() {
  console.log('🔄 Aplicando migración de doble partida a Turso...\n')

  // ── 1. Nuevas columnas en Account ──────────────────────────────────────────
  await exec(
    `ALTER TABLE "Account" ADD COLUMN "contableType" TEXT`,
    'Account.contableType',
  )
  await exec(
    `ALTER TABLE "Account" ADD COLUMN "subtype" TEXT`,
    'Account.subtype',
  )
  await exec(
    `ALTER TABLE "Account" ADD COLUMN "isSystemAccount" INTEGER NOT NULL DEFAULT 0`,
    'Account.isSystemAccount',
  )

  // ── 2. Nueva columna en Category ──────────────────────────────────────────
  await exec(
    `ALTER TABLE "Category" ADD COLUMN "contableAccountId" TEXT`,
    'Category.contableAccountId',
  )

  // ── 3. Crear tabla JournalEntry ────────────────────────────────────────────
  await exec(
    `CREATE TABLE "JournalEntry" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "description" TEXT,
      "transactionId" TEXT,
      "businessId" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "JournalEntry_transactionId_fkey"
        FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "JournalEntry_businessId_fkey"
        FOREIGN KEY ("businessId") REFERENCES "Business" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    'CREATE TABLE JournalEntry',
  )

  // ── 4. Crear tabla JournalLine ─────────────────────────────────────────────
  await exec(
    `CREATE TABLE "JournalLine" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "journalEntryId" TEXT NOT NULL,
      "accountId" TEXT NOT NULL,
      "debit" REAL NOT NULL DEFAULT 0,
      "credit" REAL NOT NULL DEFAULT 0,
      "description" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "JournalLine_journalEntryId_fkey"
        FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "JournalLine_accountId_fkey"
        FOREIGN KEY ("accountId") REFERENCES "Account" ("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
    )`,
    'CREATE TABLE JournalLine',
  )

  // ── 5. Índices ─────────────────────────────────────────────────────────────
  await exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS "JournalEntry_transactionId_key" ON "JournalEntry"("transactionId")`,
    'INDEX JournalEntry_transactionId_key',
  )
  await exec(
    `CREATE INDEX IF NOT EXISTS "JournalEntry_businessId_date_idx" ON "JournalEntry"("businessId", "date")`,
    'INDEX JournalEntry_businessId_date_idx',
  )
  await exec(
    `CREATE INDEX IF NOT EXISTS "JournalEntry_transactionId_idx" ON "JournalEntry"("transactionId")`,
    'INDEX JournalEntry_transactionId_idx',
  )
  await exec(
    `CREATE INDEX IF NOT EXISTS "JournalLine_accountId_idx" ON "JournalLine"("accountId")`,
    'INDEX JournalLine_accountId_idx',
  )
  await exec(
    `CREATE INDEX IF NOT EXISTS "JournalLine_journalEntryId_idx" ON "JournalLine"("journalEntryId")`,
    'INDEX JournalLine_journalEntryId_idx',
  )
  await exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS "Category_contableAccountId_key" ON "Category"("contableAccountId")`,
    'INDEX Category_contableAccountId_key',
  )

  console.log('\n✅ Migración aplicada a Turso.')
}

main()
  .catch((e) => {
    console.error('\nError fatal:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
