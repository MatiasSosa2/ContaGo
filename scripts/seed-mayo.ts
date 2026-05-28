// scripts/seed-mayo.ts
// Carga movimientos de mayo 2026 para todos los tipos: COBRADO, PAGADO, PENDIENTE, VENCIDO
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

  const accounts   = await prisma.account.findMany({ where: { businessId: biz.id } })
  const contacts   = await prisma.contact.findMany({ where: { businessId: biz.id } })
  const categories = await prisma.category.findMany({ where: { businessId: biz.id } })

  const cash = accounts.find(a => a.type === 'CASH')!
  const bank = accounts.find(a => a.type === 'BANK')!
  const cxc  = accounts.find(a => a.type === 'SYSTEM' && a.name.toLowerCase().includes('cxc'))
            ?? accounts.find(a => a.type === 'SYSTEM')!
  const cxp  = accounts.find(a => a.type === 'SYSTEM' && a.name.toLowerCase().includes('cxp'))
            ?? cxc

  const catIn  = categories.find(c => c.type === 'INCOME')
  const catOut = categories.find(c => c.type === 'EXPENSE')
  const ct = (i: number) => contacts[i % contacts.length]

  // Mayo 2026 — helper de fecha
  function mayo(dia: number, hora = 10) {
    return new Date(2026, 4, dia, hora, 0, 0, 0) // mes 4 = mayo (0-indexed)
  }
  function vence(dia: number) {
    return new Date(2026, 5, dia, 23, 59, 0, 0) // vence en junio
  }
  function vencido(dia: number) {
    return new Date(2026, 4, dia, 23, 59, 0, 0) // vencido en mayo (pasado)
  }

  const movimientos = [
    // ── COBRADO — ingresos efectivizados en mayo ─────────────────────────
    { desc: 'Venta productos — Farmacia El Sol',             type: 'INCOME',  subType: 'COBRO',  amount: 320_000, date: mayo(2),  estado: 'COBRADO', esCredito: false, acc: cash, cat: catIn,  ci: 0 },
    { desc: 'Cobro servicio mensual — Servicios Tech SRL',   type: 'INCOME',  subType: 'COBRO',  amount: 185_000, date: mayo(5),  estado: 'COBRADO', esCredito: false, acc: bank, cat: catIn,  ci: 3 },
    { desc: 'Cobro factura #D-0033 — Grupo Meridian',        type: 'INCOME',  subType: 'COBRO',  amount: 540_000, date: mayo(9),  estado: 'COBRADO', esCredito: false, acc: bank, cat: catIn,  ci: 0 },
    { desc: 'Venta al contado — Constructora Del Sur',       type: 'INCOME',  subType: 'COBRO',  amount: 95_000,  date: mayo(12), estado: 'COBRADO', esCredito: false, acc: cash, cat: catIn,  ci: 1 },
    { desc: 'Cobro cuota 3/3 — Distribuidora Norte',         type: 'INCOME',  subType: 'COBRO',  amount: 260_000, date: mayo(16), estado: 'COBRADO', esCredito: false, acc: bank, cat: catIn,  ci: 4 },
    { desc: 'Ingreso por asesoría puntual',                  type: 'INCOME',  subType: 'COBRO',  amount: 72_000,  date: mayo(20), estado: 'COBRADO', esCredito: false, acc: cash, cat: catIn,  ci: 2 },
    { desc: 'Cobro anticipo proyecto octubre',               type: 'INCOME',  subType: 'COBRO',  amount: 410_000, date: mayo(23), estado: 'COBRADO', esCredito: false, acc: bank, cat: catIn,  ci: 3 },

    // ── PAGADO — egresos abonados en mayo ────────────────────────────────
    { desc: 'Pago alquiler local — mayo 2026',               type: 'EXPENSE', subType: 'PAGO',   amount: 110_000, date: mayo(1),  estado: 'PAGADO',  esCredito: false, acc: cash, cat: catOut, ci: 1 },
    { desc: 'Pago factura luz y gas',                        type: 'EXPENSE', subType: 'PAGO',   amount: 38_500,  date: mayo(4),  estado: 'PAGADO',  esCredito: false, acc: cash, cat: catOut, ci: 2 },
    { desc: 'Pago proveedor packaging — Distribuidora Norte',type: 'EXPENSE', subType: 'PAGO',   amount: 195_000, date: mayo(8),  estado: 'PAGADO',  esCredito: false, acc: bank, cat: catOut, ci: 4 },
    { desc: 'Pago sueldos personal — mayo 2026',             type: 'EXPENSE', subType: 'PAGO',   amount: 480_000, date: mayo(10), estado: 'PAGADO',  esCredito: false, acc: bank, cat: catOut, ci: 0 },
    { desc: 'Pago servicio contador — mayo',                 type: 'EXPENSE', subType: 'PAGO',   amount: 65_000,  date: mayo(15), estado: 'PAGADO',  esCredito: false, acc: cash, cat: catOut, ci: 3 },
    { desc: 'Pago publicidad digital',                       type: 'EXPENSE', subType: 'PAGO',   amount: 48_000,  date: mayo(18), estado: 'PAGADO',  esCredito: false, acc: bank, cat: catOut, ci: 1 },
    { desc: 'Compra insumos oficina',                        type: 'EXPENSE', subType: 'PAGO',   amount: 22_500,  date: mayo(22), estado: 'PAGADO',  esCredito: false, acc: cash, cat: catOut, ci: 2 },

    // ── PENDIENTE — créditos con vencimiento en junio ────────────────────
    { desc: 'Factura #E-0071 — Grupo Meridian (a cobrar)',   type: 'INCOME',  subType: 'COBRO',  amount: 620_000, date: mayo(6),  vence: vence(10), estado: 'PENDIENTE', esCredito: true, acc: cxc, cat: catIn,  ci: 0 },
    { desc: 'Saldo a cobrar — Constructora Del Sur',         type: 'INCOME',  subType: 'COBRO',  amount: 280_000, date: mayo(13), vence: vence(20), estado: 'PENDIENTE', esCredito: true, acc: cxc, cat: catIn,  ci: 1 },
    { desc: 'Honorarios pendientes — Servicios Tech SRL',    type: 'INCOME',  subType: 'COBRO',  amount: 115_000, date: mayo(19), vence: vence(5),  estado: 'PENDIENTE', esCredito: true, acc: cxc, cat: catIn,  ci: 3 },
    { desc: 'Factura proveedor — Distribuidora Norte',       type: 'EXPENSE', subType: 'PAGO',   amount: 175_000, date: mayo(7),  vence: vence(15), estado: 'PENDIENTE', esCredito: true, acc: cxp, cat: catOut, ci: 4 },
    { desc: 'Cuota maquinaria — a pagar junio',              type: 'EXPENSE', subType: 'PAGO',   amount: 230_000, date: mayo(21), vence: vence(25), estado: 'PENDIENTE', esCredito: true, acc: cxp, cat: catOut, ci: 2 },

    // ── VENCIDO — créditos vencidos dentro de mayo ───────────────────────
    { desc: 'Factura #D-0089 — Farmacia El Sol (vencida)',   type: 'INCOME',  subType: 'COBRO',  amount: 88_000,  date: mayo(3),  vence: vencido(10), estado: 'VENCIDO', esCredito: true, acc: cxc, cat: catIn,  ci: 2 },
    { desc: 'Cuota 2/2 — Grupo Meridian (vencida)',          type: 'INCOME',  subType: 'COBRO',  amount: 195_000, date: mayo(1),  vence: vencido(15), estado: 'VENCIDO', esCredito: true, acc: cxc, cat: catIn,  ci: 0 },
    { desc: 'Servicio TI sin pagar — Servicios Tech SRL',    type: 'EXPENSE', subType: 'PAGO',   amount: 54_000,  date: mayo(4),  vence: vencido(12), estado: 'VENCIDO', esCredito: true, acc: cxp, cat: catOut, ci: 3 },
  ]

  let total = 0
  const grupos: Record<string, number> = { COBRADO: 0, PAGADO: 0, PENDIENTE: 0, VENCIDO: 0 }

  console.log(`\n📌 Negocio: ${biz.name}`)
  console.log(`   Cuentas: cash=${cash?.name}, bank=${bank?.name}, cxc=${cxc?.name}, cxp=${cxp?.name}`)
  console.log(`   Insertando ${movimientos.length} movimientos de mayo 2026...\n`)

  for (const m of movimientos) {
    await prisma.transaction.create({ data: {
      description: m.desc,
      type: m.type as 'INCOME' | 'EXPENSE',
      subType: m.subType,
      amount: m.amount,
      currency: 'ARS',
      date: m.date,
      fechaVencimiento: (m as any).vence ?? null,
      estado: m.estado,
      esCredito: m.esCredito,
      businessId: biz.id,
      accountId: m.acc.id,
      categoryId: m.cat?.id,
      contactId: ct(m.ci).id,
    }})
    const icon = m.estado === 'COBRADO' ? '🟢' : m.estado === 'PAGADO' ? '🔵' : m.estado === 'PENDIENTE' ? '🟡' : '🔴'
    console.log(`  ${icon} [${m.estado}] ${m.desc.slice(0, 50)} — $${m.amount.toLocaleString('es-AR')}`)
    grupos[m.estado]++
    total++
  }

  console.log(`\n✅ Resumen:`)
  for (const [estado, n] of Object.entries(grupos)) console.log(`   ${estado}: ${n} registros`)
  console.log(`\n🎉 ${total} transacciones de mayo 2026 insertadas en "${biz.name}"`)

  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
