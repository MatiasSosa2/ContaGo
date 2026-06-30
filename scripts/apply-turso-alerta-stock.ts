/**
 * apply-turso-alerta-stock.ts
 *
 * Aplica la migración 20260630010208_add_producto_alerta_stock a Turso:
 *   ALTER TABLE "Producto" ADD COLUMN "alertaStock" REAL;
 *
 * Idempotente: si la columna ya existe, lo informa y termina OK.
 *
 * Uso:
 *   npx tsx scripts/apply-turso-alerta-stock.ts
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
  } catch (err: unknown) {
    const e = err as { cause?: { message?: string }; message?: string }
    const msg = e?.cause?.message ?? e?.message ?? ''
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
  console.log('🔄 Aplicando alertaStock a Producto en Turso...\n')
  await exec(
    `ALTER TABLE "Producto" ADD COLUMN "alertaStock" REAL`,
    'Producto.alertaStock',
  )
  console.log('\n✅ Listo.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
