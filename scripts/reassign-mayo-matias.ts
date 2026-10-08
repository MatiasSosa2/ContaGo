// scripts/reassign-mayo-matias.ts
// Crea contacto "Matias" si no existe y reasigna todas las transacciones de mayo 2026
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
import { requireTargetBusinessId } from './target-business'
dotenv.config()

async function main() {
  const adapter = new PrismaLibSql({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  })
  const prisma = new PrismaClient({ adapter } as any)

  if (process.env.ALLOW_DATA_REASSIGNMENT !== 'true') {
    throw new Error('Definí ALLOW_DATA_REASSIGNMENT=true para confirmar esta reasignación.')
  }
  const targetBusinessId = requireTargetBusinessId()
  const biz = await prisma.business.findUnique({ where: { id: targetBusinessId } })
  if (!biz) throw new Error(`No existe el negocio ${targetBusinessId}`)

  // Rango de mayo 2026
  const desde = new Date(2026, 4, 1, 0, 0, 0)
  const hasta = new Date(2026, 4, 31, 23, 59, 59)

  const result = await prisma.$transaction(async (tx) => {
    let matias = await tx.contact.findFirst({
      where: { businessId: biz.id, name: { contains: 'Matias' } },
    })

    if (!matias) {
      matias = await tx.contact.create({
        data: { name: 'Matias', type: 'PERSON', businessId: biz.id },
      })
    }

    const updated = await tx.transaction.updateMany({
      where: { businessId: biz.id, date: { gte: desde, lte: hasta } },
      data: { contactId: matias.id },
    })
    return { contact: matias, count: updated.count }
  })

  console.log(`\n🎉 ${result.count} transacciones de mayo 2026 reasignadas a "${result.contact.name}"`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
