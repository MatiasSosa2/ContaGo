/**
 * apply-turso-sales-refactor.ts
 *
 * Aplica la migración 20260428120000_sales_refactor a Turso.
 * Idempotente: solo ALTER TABLE ADD COLUMN + CREATE TABLE IF NOT EXISTS.
 * No redefine Transaction (las FKs nuevas no son críticas en runtime).
 *
 * Uso: npx tsx scripts/apply-turso-sales-refactor.ts
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new PrismaClient({ adapter } as any)
}

const prisma = buildClient()

async function exec(sql: string, label: string) {
  try {
    await prisma.$executeRawUnsafe(sql)
    console.log(`  ✅ ${label}`)
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const msg: string = (err as any)?.cause?.message ?? (err as Error)?.message ?? ''
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
  console.log('🔄 Aplicando sales_refactor a Turso...\n')

  await exec(
    `ALTER TABLE "Producto" ADD COLUMN "tipo" TEXT NOT NULL DEFAULT 'MERCADERIA'`,
    'Producto.tipo',
  )

  await exec(
    `ALTER TABLE "Transaction" ADD COLUMN "bienDeUsoId" TEXT`,
    'Transaction.bienDeUsoId',
  )

  await exec(
    `ALTER TABLE "Transaction" ADD COLUMN "linkedCreditoId" TEXT`,
    'Transaction.linkedCreditoId',
  )

  await exec(
    `CREATE TABLE IF NOT EXISTS "BienDeUso" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "nombre" TEXT NOT NULL,
      "descripcion" TEXT,
      "categoria" TEXT,
      "marca" TEXT,
      "valorAdquisicion" REAL NOT NULL DEFAULT 0,
      "valorResidual" REAL NOT NULL DEFAULT 0,
      "fechaAdquisicion" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "vidaUtilMeses" INTEGER,
      "depreciacionAcumulada" REAL NOT NULL DEFAULT 0,
      "activo" INTEGER NOT NULL DEFAULT 1,
      "businessId" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "BienDeUso_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    'CREATE TABLE BienDeUso',
  )

  await exec(
    `CREATE INDEX IF NOT EXISTS "BienDeUso_businessId_activo_idx" ON "BienDeUso"("businessId", "activo")`,
    'INDEX BienDeUso_businessId_activo',
  )

  await exec(
    `CREATE INDEX IF NOT EXISTS "Transaction_bienDeUsoId_idx" ON "Transaction"("bienDeUsoId")`,
    'INDEX Transaction.bienDeUsoId',
  )

  await exec(
    `CREATE INDEX IF NOT EXISTS "Transaction_linkedCreditoId_idx" ON "Transaction"("linkedCreditoId")`,
    'INDEX Transaction.linkedCreditoId',
  )

  console.log('\n✅ Migración aplicada.')
  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
