// scripts/fix-bienes-schema.ts
// Dropa la tabla BienDeUso con schema viejo (fechaCompra) y la recrea con fechaAdquisicion
import { config } from 'dotenv'
config()
import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

function stripQuotes(v: string | undefined) { return v?.replace(/^["']|["']$/g, '') }

async function main() {
  const url = stripQuotes(process.env.TURSO_DATABASE_URL)!
  const authToken = stripQuotes(process.env.TURSO_AUTH_TOKEN)!
  const adapter = new PrismaLibSql({ url, authToken })
  const prisma = new PrismaClient({ adapter } as any)

  // Inspeccionar columnas actuales
  const cols = await prisma.$queryRawUnsafe('PRAGMA table_info("BienDeUso")') as any[]
  console.log('Columnas actuales:', cols.map((c: any) => c.name).join(', '))

  if (cols.some((c: any) => c.name === 'fechaCompra')) {
    console.log('\n⚠️  Schema viejo detectado (fechaCompra). Recreando tabla...')
    await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS "BienDeUso"')
    console.log('✅ Tabla vieja eliminada')
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "BienDeUso" (
      "id"                    TEXT    NOT NULL PRIMARY KEY,
      "nombre"                TEXT    NOT NULL,
      "descripcion"           TEXT,
      "categoria"             TEXT,
      "marca"                 TEXT,
      "valorAdquisicion"      REAL    NOT NULL DEFAULT 0,
      "valorResidual"         REAL    NOT NULL DEFAULT 0,
      "fechaAdquisicion"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "vidaUtilMeses"         INTEGER,
      "depreciacionAcumulada" REAL    NOT NULL DEFAULT 0,
      "activo"                INTEGER NOT NULL DEFAULT 1,
      "businessId"            TEXT    NOT NULL,
      "createdAt"             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "BienDeUso_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `)
  console.log('✅ Tabla BienDeUso recreada con fechaAdquisicion')

  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "BienDeUso_businessId_activo_idx" ON "BienDeUso"("businessId", "activo")`
  )
  console.log('✅ Índice creado')

  const colsNew = await prisma.$queryRawUnsafe('PRAGMA table_info("BienDeUso")') as any[]
  console.log('Columnas nuevas:', colsNew.map((c: any) => c.name).join(', '))

  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
