// scripts/reassign-mayo-matias.ts
// Crea contacto "Matias" si no existe y reasigna todas las transacciones de mayo 2026
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
dotenv.config()

async function main() {
  const adapter = new PrismaLibSql({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  })
  const prisma = new PrismaClient({ adapter } as any)

  const biz = await prisma.business.findFirst()
  if (!biz) throw new Error('No hay negocio')

  // Buscar o crear contacto "Matias"
  let matias = await prisma.contact.findFirst({
    where: { businessId: biz.id, name: { contains: 'Matias' } },
  })

  if (!matias) {
    matias = await prisma.contact.create({
      data: {
        name: 'Matias',
        type: 'PERSON',
        businessId: biz.id,
      },
    })
    console.log(`✅ Contacto "Matias" creado (id: ${matias.id})`)
  } else {
    console.log(`ℹ️  Contacto encontrado: "${matias.name}" (id: ${matias.id})`)
  }

  // Rango de mayo 2026
  const desde = new Date(2026, 4, 1, 0, 0, 0)
  const hasta = new Date(2026, 4, 31, 23, 59, 59)

  const { count } = await prisma.transaction.updateMany({
    where: {
      businessId: biz.id,
      date: { gte: desde, lte: hasta },
    },
    data: { contactId: matias.id },
  })

  console.log(`\n🎉 ${count} transacciones de mayo 2026 reasignadas a "${matias.name}"`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
