// scripts/seed-recent-movements.ts
// Inserta ~10 movimientos recientes reales sobre los datos existentes de la BD
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

  // ─── Leer datos existentes ───────────────────────────────────────────────
  const biz = await prisma.business.findFirst()
  if (!biz) throw new Error('No hay ningún negocio en la BD')

  const accounts  = await prisma.account.findMany({ where: { businessId: biz.id } })
  const categories = await prisma.category.findMany({ where: { businessId: biz.id } })
  const contacts  = await prisma.contact.findMany({ where: { businessId: biz.id } })

  console.log(`Negocio: ${biz.name}`)
  console.log(`Cuentas (${accounts.length}):`, accounts.map(a => `${a.name} [${a.type}/${a.currency}]`).join(', '))
  console.log(`Categorías (${categories.length}):`, categories.map(c => `${c.name}/${c.type}`).join(', '))
  console.log(`Contactos (${contacts.length}):`, contacts.map(c => c.name).join(', '))

  if (accounts.length === 0) throw new Error('No hay cuentas — ejecutá el seed principal primero')

  // ─── Helpers ─────────────────────────────────────────────────────────────
  const cash    = accounts.find(a => a.type === 'CASH' && a.currency === 'ARS') ?? accounts[0]
  const bank    = accounts.find(a => a.type === 'BANK' && a.currency === 'ARS') ?? accounts[0]
  const usdAcc  = accounts.find(a => a.currency === 'USD')

  const catIncome  = (name: string) =>
    categories.find(c => c.type === 'INCOME' && c.name.toLowerCase().includes(name.toLowerCase()))
    ?? categories.find(c => c.type === 'INCOME')
    ?? null
  const catExpense = (name: string) =>
    categories.find(c => c.type === 'EXPENSE' && c.name.toLowerCase().includes(name.toLowerCase()))
    ?? categories.find(c => c.type === 'EXPENSE')
    ?? null

  const contact = (name: string) =>
    contacts.find(c => c.name.toLowerCase().includes(name.toLowerCase()))
    ?? contacts[0]
    ?? null

  function daysAgo(n: number) {
    const d = new Date()
    d.setDate(d.getDate() - n)
    d.setHours(10 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 60), 0, 0)
    return d
  }

  // ─── Definición de los 10 movimientos ────────────────────────────────────
  const movements = [
    {
      description: 'Cobro de venta — cliente mayorista',
      type: 'INCOME' as const,
      subType: 'SALE',
      amount: 285_000,
      currency: 'ARS',
      date: daysAgo(1),
      accountId: bank.id,
      categoryId: catIncome('venta')?.id ?? catIncome('')?.id ?? null,
      contactId: contact('')?.id ?? null,
    },
    {
      description: 'Pago proveedor materiales',
      type: 'EXPENSE' as const,
      subType: 'PURCHASE',
      amount: 142_500,
      currency: 'ARS',
      date: daysAgo(1),
      accountId: bank.id,
      categoryId: catExpense('proveedor')?.id ?? catExpense('')?.id ?? null,
      contactId: contact('')?.id ?? null,
    },
    {
      description: 'Ingreso efectivo — cobro contado',
      type: 'INCOME' as const,
      subType: 'COBRO',
      amount: 52_000,
      currency: 'ARS',
      date: daysAgo(2),
      accountId: cash.id,
      categoryId: catIncome('')?.id ?? null,
      contactId: null,
    },
    {
      description: 'Pago alquiler oficina',
      type: 'EXPENSE' as const,
      subType: 'PAGO',
      amount: 180_000,
      currency: 'ARS',
      date: daysAgo(3),
      accountId: bank.id,
      categoryId: catExpense('alquiler')?.id ?? catExpense('')?.id ?? null,
      contactId: null,
    },
    {
      description: 'Venta al por menor — mostrador',
      type: 'INCOME' as const,
      subType: 'SALE',
      amount: 34_700,
      currency: 'ARS',
      date: daysAgo(3),
      accountId: cash.id,
      categoryId: catIncome('venta')?.id ?? catIncome('')?.id ?? null,
      contactId: null,
    },
    {
      description: 'Compra insumos de oficina',
      type: 'EXPENSE' as const,
      subType: 'PURCHASE',
      amount: 28_900,
      currency: 'ARS',
      date: daysAgo(4),
      accountId: cash.id,
      categoryId: catExpense('insumo')?.id ?? catExpense('')?.id ?? null,
      contactId: null,
    },
    {
      description: 'Servicio de consultoría facturado',
      type: 'INCOME' as const,
      subType: 'COBRO',
      amount: 320_000,
      currency: 'ARS',
      date: daysAgo(5),
      accountId: bank.id,
      categoryId: catIncome('servicio')?.id ?? catIncome('')?.id ?? null,
      contactId: contact('')?.id ?? null,
    },
    {
      description: 'Pago sueldos personal',
      type: 'EXPENSE' as const,
      subType: 'PAGO',
      amount: 650_000,
      currency: 'ARS',
      date: daysAgo(6),
      accountId: bank.id,
      categoryId: catExpense('sueldo')?.id ?? catExpense('')?.id ?? null,
      contactId: null,
    },
    {
      description: 'Cobro exportación',
      type: 'INCOME' as const,
      subType: 'COBRO',
      amount: 1_800,
      currency: usdAcc ? 'USD' : 'ARS',
      date: daysAgo(7),
      accountId: usdAcc?.id ?? bank.id,
      categoryId: catIncome('')?.id ?? null,
      contactId: contact('')?.id ?? null,
    },
    {
      description: 'Gastos bancarios y comisiones',
      type: 'EXPENSE' as const,
      subType: 'PAGO',
      amount: 8_750,
      currency: 'ARS',
      date: daysAgo(7),
      accountId: bank.id,
      categoryId: catExpense('banco')?.id ?? catExpense('')?.id ?? null,
      contactId: null,
    },
  ]

  // ─── Insertar ─────────────────────────────────────────────────────────────
  let inserted = 0
  for (const mov of movements) {
    await prisma.transaction.create({
      data: {
        description: mov.description,
        type: mov.type,
        subType: mov.subType,
        amount: mov.amount,
        currency: mov.currency,
        date: mov.date,
        businessId: biz.id,
        accountId: mov.accountId,
        categoryId: mov.categoryId ?? undefined,
        contactId: mov.contactId ?? undefined,
        estado: 'COBRADO',
      },
    })
    inserted++
    console.log(`  ✅ [${mov.type}] ${mov.description} — ${mov.currency === 'USD' ? 'US$' : '$'}${mov.amount.toLocaleString('es-AR')}`)
  }

  console.log(`\n🎉 ${inserted} movimientos insertados en "${biz.name}"`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
