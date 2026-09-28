
/**
 * apply-turso-operaciones.ts
 *
 * Aplica a Turso las migraciones de septiembre 2026:
 *   20260924145227_add_subcategories
 *   20260925205132_add_cash_transfers
 *   20260925221319_add_stock_costo_unitario
 *   20260927154146_add_operaciones
 *
 * Idempotente y sin tocar datos: solo CREATE TABLE / INDEX IF NOT EXISTS y
 * ALTER TABLE ADD COLUMN. No redefine Transaction ni JournalEntry (las FKs nuevas
 * no son críticas en runtime), así no se copian tablas en producción.
 *
 * Uso: npx tsx scripts/apply-turso-operaciones.ts
 */

import { config } from 'dotenv'
config()

import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

function stripQuotes(val: string | undefined): string | undefined {
  return val?.replace(/^["']|["']$/g, '')
}

function buildClient() {
  const url = stripQuotes(process.env.TURSO_DATABASE_URL)
  const authToken = stripQuotes(process.env.TURSO_AUTH_TOKEN)
  if (!url || !authToken) throw new Error('Faltan TURSO_DATABASE_URL y TURSO_AUTH_TOKEN en .env')
  console.log(`🎯 Base: ${new URL(url.replace(/^libsql:/, 'https:')).host}\n`)
  const adapter = new PrismaLibSql({ url, authToken })
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
    if (msg.includes('already exists') || msg.includes('duplicate column') || msg.includes('already have a column')) {
      console.log(`  ⚠️  ${label} — ya existe, saltando`)
    } else {
      console.error(`  ❌ ${label} — error:`, msg)
      throw err
    }
  }
}

async function main() {
  console.log('🔄 Aplicando migraciones de operaciones a Turso...\n')

  // ── add_subcategories ──
  await exec(`CREATE TABLE IF NOT EXISTS "Subcategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subcategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Subcategory_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`, 'Tabla Subcategory')
  await exec(`CREATE INDEX IF NOT EXISTS "Subcategory_categoryId_idx" ON "Subcategory"("categoryId")`, 'Índice Subcategory.categoryId')
  await exec(`ALTER TABLE "Transaction" ADD COLUMN "subcategoryId" TEXT`, 'Transaction.subcategoryId')

  // ── add_cash_transfers ──
  await exec(`CREATE TABLE IF NOT EXISTS "CashTransfer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "fromAccountId" TEXT NOT NULL,
    "toAccountId" TEXT NOT NULL,
    "amountFrom" REAL NOT NULL,
    "amountTo" REAL NOT NULL,
    "exchangeRate" REAL,
    "businessId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CashTransfer_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CashTransfer_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CashTransfer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`, 'Tabla CashTransfer')
  await exec(`CREATE INDEX IF NOT EXISTS "CashTransfer_businessId_date_idx" ON "CashTransfer"("businessId", "date")`, 'Índice CashTransfer.businessId_date')
  await exec(`ALTER TABLE "JournalEntry" ADD COLUMN "cashTransferId" TEXT`, 'JournalEntry.cashTransferId')
  await exec(`CREATE UNIQUE INDEX IF NOT EXISTS "JournalEntry_cashTransferId_key" ON "JournalEntry"("cashTransferId")`, 'Índice único JournalEntry.cashTransferId')

  // ── add_stock_costo_unitario ──
  await exec(`ALTER TABLE "MovimientoStock" ADD COLUMN "costoUnitario" REAL`, 'MovimientoStock.costoUnitario')

  // ── add_operaciones ──
  await exec(`CREATE TABLE IF NOT EXISTS "Operacion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tipo" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "subtotal" REAL NOT NULL,
    "descuento" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL,
    "contactId" TEXT,
    "empleadoId" TEXT,
    "businessId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Operacion_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Operacion_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Operacion_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`, 'Tabla Operacion')
  await exec(`CREATE TABLE IF NOT EXISTS "OperacionItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "operacionId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" REAL NOT NULL,
    "precioUnitario" REAL NOT NULL,
    "subtotal" REAL NOT NULL,
    "costoUnitario" REAL,
    CONSTRAINT "OperacionItem_operacionId_fkey" FOREIGN KEY ("operacionId") REFERENCES "Operacion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OperacionItem_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`, 'Tabla OperacionItem')
  await exec(`CREATE INDEX IF NOT EXISTS "Operacion_businessId_date_idx" ON "Operacion"("businessId", "date")`, 'Índice Operacion.businessId_date')
  await exec(`CREATE INDEX IF NOT EXISTS "OperacionItem_operacionId_idx" ON "OperacionItem"("operacionId")`, 'Índice OperacionItem.operacionId')
  await exec(`ALTER TABLE "Transaction" ADD COLUMN "operacionId" TEXT`, 'Transaction.operacionId')
  await exec(`ALTER TABLE "Transaction" ADD COLUMN "cuotaNumero" INTEGER`, 'Transaction.cuotaNumero')
  await exec(`ALTER TABLE "Transaction" ADD COLUMN "cuotasTotal" INTEGER`, 'Transaction.cuotasTotal')

  // Verificación: consulta cada tabla/columna nueva (falla si falta algo)
  await prisma.$queryRawUnsafe(`SELECT "subcategoryId", "operacionId", "cuotaNumero", "cuotasTotal" FROM "Transaction" LIMIT 1`)
  await prisma.$queryRawUnsafe(`SELECT "cashTransferId" FROM "JournalEntry" LIMIT 1`)
  await prisma.$queryRawUnsafe(`SELECT "costoUnitario" FROM "MovimientoStock" LIMIT 1`)
  for (const t of ['Subcategory', 'CashTransfer', 'Operacion', 'OperacionItem']) {
    await prisma.$queryRawUnsafe(`SELECT COUNT(*) FROM "${t}"`)
  }
  console.log('\n✅ Migraciones aplicadas y verificadas en Turso.')
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())