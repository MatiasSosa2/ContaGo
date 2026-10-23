/**
 * apply-turso-costos.ts
 *
 * Aplica a Turso la migración 20261021184911_add_costo_fijo_diferencias (costo unitario fijo por
 * producto y diferencias de inventario).
 *
 * Idempotente y sin tocar datos: solo ALTER TABLE ADD COLUMN. Los productos siguen con el
 * costo promedio hasta que alguien fije uno a mano.
 *
 * Uso: npx tsx scripts/apply-turso-costos.ts
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
  console.log('🔄 Aplicando costo fijo y diferencias de inventario a Turso...\n')

  await exec(`ALTER TABLE "MovimientoStock" ADD COLUMN "concepto" TEXT`, 'MovimientoStock.concepto')
  await exec(`ALTER TABLE "Producto" ADD COLUMN "costoFijo" REAL`, 'Producto.costoFijo')

  // Verificación: consulta cada columna nueva (falla si falta algo)
  await prisma.$queryRawUnsafe(`SELECT "concepto" FROM "MovimientoStock" LIMIT 1`)
  await prisma.$queryRawUnsafe(`SELECT "costoFijo" FROM "Producto" LIMIT 1`)
  console.log('\n✅ Migración aplicada y verificada en Turso.')
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
