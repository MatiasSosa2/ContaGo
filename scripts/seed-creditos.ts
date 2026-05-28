// scripts/seed-creditos.ts
// Inserta créditos (CxC) y deudas (CxP) pendientes para la sección Créditos
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
  if (!biz) throw new Error('No hay negocio en la BD')

  const accounts  = await prisma.account.findMany({ where: { businessId: biz.id } })
  const contacts  = await prisma.contact.findMany({ where: { businessId: biz.id } })
  const categories = await prisma.category.findMany({ where: { businessId: biz.id } })

  // Cuentas SYSTEM para CxC y CxP
  const cxcAccount = accounts.find(a => a.type === 'SYSTEM' && a.name.toLowerCase().includes('cxc'))
    ?? accounts.find(a => a.type === 'SYSTEM' && a.name.toLowerCase().includes('cliente'))
    ?? accounts.find(a => a.type === 'SYSTEM')
  const cxpAccount = accounts.find(a => a.type === 'SYSTEM' && a.name.toLowerCase().includes('cxp'))
    ?? accounts.find(a => a.type === 'SYSTEM' && a.name.toLowerCase().includes('proveedor'))
    ?? cxcAccount

  if (!cxcAccount || !cxpAccount) throw new Error('No se encontraron cuentas SYSTEM para CxC/CxP')

  console.log(`Negocio: ${biz.name}`)
  console.log(`Cuenta CxC: ${cxcAccount.name}`)
  console.log(`Cuenta CxP: ${cxpAccount.name}`)
  console.log(`Contactos: ${contacts.map(c => c.name).join(', ')}`)

  const catIncome  = categories.find(c => c.type === 'INCOME') ?? null
  const catExpense = categories.find(c => c.type === 'EXPENSE') ?? null

  function daysAgo(n: number) {
    const d = new Date()
    d.setDate(d.getDate() - n)
    d.setHours(9, 0, 0, 0)
    return d
  }
  function daysFromNow(n: number) {
    const d = new Date()
    d.setDate(d.getDate() + n)
    d.setHours(23, 59, 59, 0)
    return d
  }

  const c = (i: number) => contacts[i % contacts.length]

  const creditos = [
    // ── CxC (por cobrar — INCOME, esCredito: true) ───────────────────────
    {
      description: 'Factura #0001-00004521 — Grupo Meridian S.A.',
      type: 'INCOME' as const,
      subType: 'COBRO',
      amount: 480_000,
      currency: 'ARS',
      date: daysAgo(8),
      fechaVencimiento: daysFromNow(7),
      estado: 'PENDIENTE',
      esCredito: true,
      accountId: cxcAccount.id,
      categoryId: catIncome?.id,
      contactId: c(0).id,
    },
    {
      description: 'Saldo pendiente — Constructora Del Sur',
      type: 'INCOME' as const,
      subType: 'COBRO',
      amount: 215_000,
      currency: 'ARS',
      date: daysAgo(15),
      fechaVencimiento: daysFromNow(3),
      estado: 'PENDIENTE',
      esCredito: true,
      accountId: cxcAccount.id,
      categoryId: catIncome?.id,
      contactId: c(1).id,
    },
    {
      description: 'Honorarios servicio mensual — Servicios Tech SRL',
      type: 'INCOME' as const,
      subType: 'COBRO',
      amount: 95_000,
      currency: 'ARS',
      date: daysAgo(5),
      fechaVencimiento: daysFromNow(20),
      estado: 'PENDIENTE',
      esCredito: true,
      accountId: cxcAccount.id,
      categoryId: catIncome?.id,
      contactId: c(3).id,
    },
    {
      description: 'Cuota vencida — Farmacia El Sol',
      type: 'INCOME' as const,
      subType: 'COBRO',
      amount: 62_500,
      currency: 'ARS',
      date: daysAgo(20),
      fechaVencimiento: daysAgo(5), // ya vencida
      estado: 'PENDIENTE',
      esCredito: true,
      accountId: cxcAccount.id,
      categoryId: catIncome?.id,
      contactId: c(2).id,
    },
    {
      description: 'Anticipo de obra — Distribuidora Norte',
      type: 'INCOME' as const,
      subType: 'COBRO',
      amount: 340_000,
      currency: 'ARS',
      date: daysAgo(3),
      fechaVencimiento: daysFromNow(30),
      estado: 'PENDIENTE',
      esCredito: true,
      accountId: cxcAccount.id,
      categoryId: catIncome?.id,
      contactId: c(4).id,
    },
    // ── CxP (por pagar — EXPENSE, esCredito: true) ───────────────────────
    {
      description: 'Factura materiales — Distribuidora Norte',
      type: 'EXPENSE' as const,
      subType: 'PAGO',
      amount: 185_000,
      currency: 'ARS',
      date: daysAgo(10),
      fechaVencimiento: daysFromNow(5),
      estado: 'PENDIENTE',
      esCredito: true,
      accountId: cxpAccount.id,
      categoryId: catExpense?.id,
      contactId: c(4).id,
    },
    {
      description: 'Alquiler depósito — Grupo Meridian S.A.',
      type: 'EXPENSE' as const,
      subType: 'PAGO',
      amount: 95_000,
      currency: 'ARS',
      date: daysAgo(12),
      fechaVencimiento: daysAgo(2), // ya vencida
      estado: 'PENDIENTE',
      esCredito: true,
      accountId: cxpAccount.id,
      categoryId: catExpense?.id,
      contactId: c(0).id,
    },
    {
      description: 'Servicio de mantenimiento — Servicios Tech SRL',
      type: 'EXPENSE' as const,
      subType: 'PAGO',
      amount: 48_000,
      currency: 'ARS',
      date: daysAgo(4),
      fechaVencimiento: daysFromNow(15),
      estado: 'PENDIENTE',
      esCredito: true,
      accountId: cxpAccount.id,
      categoryId: catExpense?.id,
      contactId: c(3).id,
    },
    {
      description: 'Cuota maquinaria — Constructora Del Sur',
      type: 'EXPENSE' as const,
      subType: 'PAGO',
      amount: 270_000,
      currency: 'ARS',
      date: daysAgo(6),
      fechaVencimiento: daysFromNow(10),
      estado: 'PENDIENTE',
      esCredito: true,
      accountId: cxpAccount.id,
      categoryId: catExpense?.id,
      contactId: c(1).id,
    },
    {
      description: 'Comisión agente comercial',
      type: 'EXPENSE' as const,
      subType: 'PAGO',
      amount: 32_500,
      currency: 'ARS',
      date: daysAgo(2),
      fechaVencimiento: daysFromNow(25),
      estado: 'PENDIENTE',
      esCredito: true,
      accountId: cxpAccount.id,
      categoryId: catExpense?.id,
      contactId: c(2).id,
    },
  ]

  let inserted = 0
  for (const mov of creditos) {
    await prisma.transaction.create({
      data: {
        description: mov.description,
        type: mov.type,
        subType: mov.subType,
        amount: mov.amount,
        currency: mov.currency,
        date: mov.date,
        fechaVencimiento: mov.fechaVencimiento,
        estado: mov.estado,
        esCredito: mov.esCredito,
        businessId: biz.id,
        accountId: mov.accountId,
        categoryId: mov.categoryId ?? undefined,
        contactId: mov.contactId ?? undefined,
      },
    })
    inserted++
    const tag = mov.type === 'INCOME' ? '📥 CxC' : '📤 CxP'
    console.log(`  ✅ ${tag} ${mov.description} — $${mov.amount.toLocaleString('es-AR')}`)
  }

  console.log(`\n🎉 ${inserted} créditos/deudas insertados en "${biz.name}"`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
