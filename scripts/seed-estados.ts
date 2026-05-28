// scripts/seed-estados.ts
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

  const accounts   = await prisma.account.findMany({ where: { businessId: biz.id } })
  const contacts   = await prisma.contact.findMany({ where: { businessId: biz.id } })
  const categories = await prisma.category.findMany({ where: { businessId: biz.id } })

  const cashAcc = accounts.find(a => a.type === 'CASH') ?? accounts[0]
  const bankAcc = accounts.find(a => a.type === 'BANK') ?? accounts[0]
  const cxcAcc  = accounts.find(a => a.type === 'SYSTEM' && a.name.toLowerCase().includes('cxc'))
               ?? accounts.find(a => a.type === 'SYSTEM')!
  const cxpAcc  = accounts.find(a => a.type === 'SYSTEM' && a.name.toLowerCase().includes('cxp'))
               ?? cxcAcc

  const catIn  = categories.find(c => c.type === 'INCOME')
  const catOut = categories.find(c => c.type === 'EXPENSE')
  const ct = (i: number) => contacts[i % contacts.length]

  function mesesAtras(m: number, dia = 10) {
    const d = new Date(); d.setMonth(d.getMonth() - m); d.setDate(dia); d.setHours(10, 0, 0, 0); return d
  }
  function daysFromNow(n: number) {
    const d = new Date(); d.setDate(d.getDate() + n); d.setHours(23, 59, 0, 0); return d
  }
  function daysAgo(n: number) {
    const d = new Date(); d.setDate(d.getDate() - n); d.setHours(23, 59, 0, 0); return d
  }

  console.log(`\n📌 Negocio: ${biz.name}`)

  // ── PENDIENTE (esCredito: true, vencimiento futuro)
  const pendientes = [
    { desc: 'Factura #A-0045 — Consultoría estratégica',      type: 'INCOME',  amount: 520_000, date: mesesAtras(1, 5),  vence: daysFromNow(15), acc: cxcAcc, cat: catIn },
    { desc: 'Honorarios diseño web — Servicios Tech SRL',      type: 'INCOME',  amount: 85_000,  date: mesesAtras(1, 18), vence: daysFromNow(8),  acc: cxcAcc, cat: catIn },
    { desc: 'Cuota 2/3 — Constructora Del Sur',                type: 'INCOME',  amount: 210_000, date: mesesAtras(2, 3),  vence: daysFromNow(22), acc: cxcAcc, cat: catIn },
    { desc: 'Factura proveedor insumos — Distribuidora Norte', type: 'EXPENSE', amount: 140_000, date: mesesAtras(1, 12), vence: daysFromNow(5),  acc: cxpAcc, cat: catOut },
    { desc: 'Alquiler oficina — anticipo',                     type: 'EXPENSE', amount: 95_000,  date: mesesAtras(1, 25), vence: daysFromNow(30), acc: cxpAcc, cat: catOut },
  ]

  // ── VENCIDO (esCredito: true, vencimiento pasado)
  const vencidos = [
    { desc: 'Factura #B-0012 — Grupo Meridian (vencida)',     type: 'INCOME',  amount: 380_000, date: mesesAtras(3, 8),  vence: daysAgo(20), acc: cxcAcc, cat: catIn },
    { desc: 'Saldo pendiente — Farmacia El Sol (mora)',       type: 'INCOME',  amount: 62_500,  date: mesesAtras(4, 14), vence: daysAgo(45), acc: cxcAcc, cat: catIn },
    { desc: 'Cuota 1/2 — Constructora Del Sur (vencida)',     type: 'INCOME',  amount: 175_000, date: mesesAtras(2, 20), vence: daysAgo(10), acc: cxcAcc, cat: catIn },
    { desc: 'Factura insumos — Distribuidora Norte',          type: 'EXPENSE', amount: 58_000,  date: mesesAtras(3, 5),  vence: daysAgo(30), acc: cxpAcc, cat: catOut },
    { desc: 'Cuota leasing maquinaria (vencida)',             type: 'EXPENSE', amount: 220_000, date: mesesAtras(2, 1),  vence: daysAgo(15), acc: cxpAcc, cat: catOut },
  ]

  // ── COBRADO (esCredito: false, INCOME ya efectivizado)
  const cobrados = [
    { desc: 'Cobro factura #C-0088 — Grupo Meridian',         amount: 480_000, date: mesesAtras(1, 7),  acc: cashAcc, cat: catIn },
    { desc: 'Cobro honorarios — Servicios Tech SRL',          amount: 120_000, date: mesesAtras(2, 15), acc: bankAcc, cat: catIn },
    { desc: 'Cobro venta mercadería — Farmacia El Sol',       amount: 95_000,  date: mesesAtras(3, 22), acc: cashAcc, cat: catIn },
    { desc: 'Cobro mantenimiento — Constructora Del Sur',     amount: 68_000,  date: mesesAtras(4, 9),  acc: bankAcc, cat: catIn },
    { desc: 'Cobro anticipo proyecto — Distribuidora Norte',  amount: 250_000, date: mesesAtras(5, 18), acc: cashAcc, cat: catIn },
  ]

  // ── PAGADO (esCredito: false, EXPENSE ya abonado)
  const pagados = [
    { desc: 'Pago materiales — Distribuidora Norte',          amount: 185_000, date: mesesAtras(1, 10), acc: bankAcc, cat: catOut },
    { desc: 'Pago alquiler oficina',                          amount: 95_000,  date: mesesAtras(2, 5),  acc: cashAcc, cat: catOut },
    { desc: 'Pago servicio internet + teléfono',              amount: 28_500,  date: mesesAtras(3, 3),  acc: cashAcc, cat: catOut },
    { desc: 'Pago cuota seguro comercial',                    amount: 42_000,  date: mesesAtras(4, 20), acc: bankAcc, cat: catOut },
    { desc: 'Pago honorarios contador externo',               amount: 75_000,  date: mesesAtras(5, 12), acc: bankAcc, cat: catOut },
  ]

  let total = 0

  console.log('\n🟡 PENDIENTE')
  for (let i = 0; i < pendientes.length; i++) {
    const t = pendientes[i]
    await prisma.transaction.create({ data: {
      description: t.desc, type: t.type as 'INCOME' | 'EXPENSE',
      subType: t.type === 'INCOME' ? 'COBRO' : 'PAGO',
      amount: t.amount, currency: 'ARS', date: t.date,
      fechaVencimiento: t.vence, estado: 'PENDIENTE', esCredito: true,
      businessId: biz.id, accountId: t.acc.id,
      categoryId: t.cat?.id, contactId: ct(i).id,
    }})
    console.log(`  ✅ ${t.desc.slice(0, 55)} — $${t.amount.toLocaleString('es-AR')}`)
    total++
  }

  console.log('\n🔴 VENCIDO')
  for (let i = 0; i < vencidos.length; i++) {
    const t = vencidos[i]
    await prisma.transaction.create({ data: {
      description: t.desc, type: t.type as 'INCOME' | 'EXPENSE',
      subType: t.type === 'INCOME' ? 'COBRO' : 'PAGO',
      amount: t.amount, currency: 'ARS', date: t.date,
      fechaVencimiento: t.vence, estado: 'VENCIDO', esCredito: true,
      businessId: biz.id, accountId: t.acc.id,
      categoryId: t.cat?.id, contactId: ct(i).id,
    }})
    console.log(`  ✅ ${t.desc.slice(0, 55)} — $${t.amount.toLocaleString('es-AR')}`)
    total++
  }

  console.log('\n🟢 COBRADO')
  for (let i = 0; i < cobrados.length; i++) {
    const t = cobrados[i]
    await prisma.transaction.create({ data: {
      description: t.desc, type: 'INCOME', subType: 'COBRO',
      amount: t.amount, currency: 'ARS', date: t.date,
      estado: 'COBRADO', esCredito: false,
      businessId: biz.id, accountId: t.acc.id,
      categoryId: t.cat?.id, contactId: ct(i).id,
    }})
    console.log(`  ✅ ${t.desc.slice(0, 55)} — $${t.amount.toLocaleString('es-AR')}`)
    total++
  }

  console.log('\n🔵 PAGADO')
  for (let i = 0; i < pagados.length; i++) {
    const t = pagados[i]
    await prisma.transaction.create({ data: {
      description: t.desc, type: 'EXPENSE', subType: 'PAGO',
      amount: t.amount, currency: 'ARS', date: t.date,
      estado: 'PAGADO', esCredito: false,
      businessId: biz.id, accountId: t.acc.id,
      categoryId: t.cat?.id, contactId: ct(i).id,
    }})
    console.log(`  ✅ ${t.desc.slice(0, 55)} — $${t.amount.toLocaleString('es-AR')}`)
    total++
  }

  console.log(`\n🎉 ${total} transacciones insertadas en "${biz.name}"`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
