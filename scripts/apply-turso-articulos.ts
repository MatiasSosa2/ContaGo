/**
 * apply-turso-articulos.ts
 *
 * Aplica a Turso la migración 20261002191059_add_articulos_variantes (artículos con variantes:
 * talle, color, tamaño…, foto y precio propio por variante).
 *
 * Idempotente y sin tocar datos: solo CREATE TABLE / INDEX IF NOT EXISTS y ALTER TABLE ADD
 * COLUMN. No redefine Producto (la FK Producto.articuloId no es crítica en runtime), así no se
 * copian tablas en producción. Los productos existentes quedan como están (sin artículo).
 *
 * Uso: npx tsx scripts/apply-turso-articulos.ts
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
  console.log('🔄 Aplicando artículos con variantes a Turso...\n')

  await exec(`CREATE TABLE IF NOT EXISTS "Articulo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'MERCADERIA',
    "categoria" TEXT,
    "subcategoria" TEXT,
    "marca" TEXT,
    "unidad" TEXT NOT NULL DEFAULT 'unidad',
    "precioVenta" REAL NOT NULL DEFAULT 0,
    "atributos" TEXT,
    "foto" TEXT,
    "fotoAt" DATETIME,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "businessId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Articulo_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`, 'Tabla Articulo')
  await exec(`CREATE INDEX IF NOT EXISTS "Articulo_businessId_idx" ON "Articulo"("businessId")`, 'Índice Articulo.businessId')
  await exec(`ALTER TABLE "Producto" ADD COLUMN "articuloId" TEXT`, 'Producto.articuloId')
  await exec(`ALTER TABLE "Producto" ADD COLUMN "atributos" TEXT`, 'Producto.atributos')
  await exec(`ALTER TABLE "Producto" ADD COLUMN "precioPropio" BOOLEAN NOT NULL DEFAULT false`, 'Producto.precioPropio')
  await exec(`ALTER TABLE "Producto" ADD COLUMN "codigoBarras" TEXT`, 'Producto.codigoBarras')

  // Verificación: consulta cada tabla/columna nueva (falla si falta algo)
  await prisma.$queryRawUnsafe(`SELECT "articuloId", "atributos", "precioPropio", "codigoBarras" FROM "Producto" LIMIT 1`)
  await prisma.$queryRawUnsafe(`SELECT COUNT(*) FROM "Articulo"`)
  console.log('\n✅ Migración aplicada y verificada en Turso.')
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
