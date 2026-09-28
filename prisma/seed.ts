// prisma/seed.ts
//
// Datos demo coherentes con cómo registra la app (modal "+"):
// - Ventas y compras de productos como Operacion + ítems + movimientos de stock con su CPP,
//   así el Estado de resultados cuadra: Ventas = ventas registradas, CMV = sus salidas × CPP.
// - Gastos en las categorías por defecto (Sueldos, Alquiler, Publicidad, Impuestos).
// - Ventas a crédito que se cobran al mes siguiente y compras a crédito que se pagan después.
// - Un cambio de caja de pesos a dólares.
// - El saldo actual de cada caja = saldo de apertura + todo lo movido.
// Cubre desde enero del año en curso hasta hoy.
import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import bcrypt from 'bcryptjs'
import * as dotenv from 'dotenv'
import { setupContableAccountsForBusiness, createContableAccountForCategory } from '../src/server/accounting/setup-contable-accounts'
import { generateJournalLines, type GenerateJournalLinesParams } from '../src/server/accounting/journal-engine'
dotenv.config()

function buildPrisma() {
  const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL
  if (url && (url.startsWith('libsql') || url.startsWith('wss') || url.startsWith('https'))) {
    const authToken = process.env.TURSO_AUTH_TOKEN
    if (!authToken) throw new Error('TURSO_AUTH_TOKEN not set')
    const adapter = new PrismaLibSql({ url, authToken })
    return new PrismaClient({ adapter } as any)
  }
  // SQLite local: Prisma 7 también requiere adapter
  const adapter = new PrismaLibSql({ url: url || 'file:./prisma/dev.db' })
  return new PrismaClient({ adapter } as any)
}

const prisma = buildPrisma()

const round2 = (v: number) => Math.round(v * 100) / 100

// PRNG determinístico: el seed da siempre los mismos datos
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20260101)
const between = (min: number, max: number) => Math.round(min + rand() * (max - min))

const NOW = new Date()
const YEAR = NOW.getFullYear()
const CURRENT_MONTH = NOW.getMonth() + 1
// Mediodía hora local: evita que un cambio de zona horaria mueva el día
const at = (month: number, day: number) => new Date(YEAR, month - 1, day, 12, 0, 0)
const isPast = (d: Date) => d.getTime() <= NOW.getTime()

async function clean() {
  await prisma.journalLine.deleteMany()
  await prisma.journalEntry.deleteMany()
  await prisma.transaction.updateMany({ data: { linkedCreditoId: null } })
  await prisma.transaction.deleteMany()
  await prisma.operacionItem.deleteMany()
  await prisma.operacion.deleteMany()
  await prisma.cashTransfer.deleteMany()
  await prisma.movimientoStock.deleteMany()
  await prisma.producto.deleteMany()
  await prisma.bienDeUso.deleteMany()
  await prisma.subcategory.deleteMany()
  await prisma.category.deleteMany()
  await prisma.contact.deleteMany()
  await prisma.empleado.deleteMany()
  await prisma.areaNegocio.deleteMany()
  await prisma.account.deleteMany()
  await prisma.businessMember.deleteMany()
  await prisma.user.updateMany({ data: { defaultBusinessId: null } })
  await prisma.business.deleteMany()
  await prisma.user.deleteMany()
}

async function main() {
  console.log('🌱 Iniciando seed...')
  await clean()
  console.log('🗑️  BD limpia')

  // ── Usuario y negocio ──────────────────────────────────────────
  const user = await prisma.user.create({
    data: { email: 'demo@finarg.com', name: 'Usuario Demo', password: await bcrypt.hash('Demo1234', 10), emailVerified: new Date() },
  })
  const business = await prisma.business.create({
    data: {
      name: 'Almacén Demo',
      currency: 'ARS',
      operatingModel: 'PRODUCTS',
      onboardingCompletedAt: new Date(),
      members: { create: { userId: user.id, role: 'ADMIN', status: 'ACTIVE', acceptedAt: new Date() } },
    },
  })
  const bid = business.id
  await prisma.user.update({ where: { id: user.id }, data: { defaultBusinessId: bid } })
  console.log(`👤 ${user.email} · 🏢 ${business.name}`)

  // ── Cajas (saldo de apertura al 1/1; se suma lo movido al final) ──
  const opening = { caja: 350000, banco: 2500000, usd: 1500 }
  const caja = await prisma.account.create({ data: { name: 'Caja', type: 'CASH', currency: 'ARS', currentBalance: opening.caja, businessId: bid } })
  const banco = await prisma.account.create({ data: { name: 'Banco Galicia', type: 'BANK', currency: 'ARS', currentBalance: opening.banco, businessId: bid } })
  const usd = await prisma.account.create({ data: { name: 'Caja USD', type: 'CASH', currency: 'USD', currentBalance: opening.usd, businessId: bid } })
  await setupContableAccountsForBusiness(bid, prisma as never)
  const system = async (subtype: string) =>
    (await prisma.account.findFirst({ where: { businessId: bid, isSystemAccount: true, subtype }, select: { id: true } }))?.id ?? null
  const cxc = await system('RECEIVABLE')
  const cxp = await system('PAYABLE')
  const inventario = await system('INVENTORY')
  const cogs = await system('COGS')

  // ── Categorías (las por defecto + las del sistema que crea la app) ──
  const categorias = new Map<string, { id: string; contable: string | null }>()
  async function categoria(name: string, type: 'INCOME' | 'EXPENSE') {
    const key = `${type}:${name}`
    const found = categorias.get(key)
    if (found) return found
    const c = await prisma.category.create({ data: { name, type, businessId: bid } })
    await createContableAccountForCategory(c.id, name, type, bid, prisma as never)
    const withContable = await prisma.category.findUniqueOrThrow({ where: { id: c.id }, select: { contableAccountId: true } })
    const entry = { id: c.id, contable: withContable.contableAccountId }
    categorias.set(key, entry)
    return entry
  }
  for (const name of ['Sueldos', 'Alquiler', 'Publicidad', 'Impuestos']) await categoria(name, 'EXPENSE')
  const catVentas = await categoria('Ventas de mercadería', 'INCOME')
  const catCompras = await categoria('Compras', 'EXPENSE')
  const catCobros = await categoria('Cobros de crédito', 'INCOME')

  // ── Contactos ──────────────────────────────────────────
  const clientes = await Promise.all(
    ['Kiosco San Martín', 'Almacén Doña Rosa', 'Bar La Esquina'].map((name) =>
      prisma.contact.create({ data: { name, type: 'CLIENT', businessId: bid } })),
  )
  const proveedor = await prisma.contact.create({ data: { name: 'Distribuidora Norte', type: 'SUPPLIER', businessId: bid } })

  // ── Productos (el stock y el costo salen de las compras) ──
  const defs = [
    { nombre: 'Yerba mate 1 kg', categoria: 'Almacén', costo: 3200, venta: 5200, ventasMes: [90, 130] },
    { nombre: 'Café en grano 1 kg', categoria: 'Almacén', costo: 14000, venta: 22500, ventasMes: [25, 45] },
    { nombre: 'Termo acero 1 L', categoria: 'Bazar', costo: 18000, venta: 32000, ventasMes: [12, 24] },
    { nombre: 'Mate de calabaza', categoria: 'Bazar', costo: 6000, venta: 11000, ventasMes: [25, 45] },
  ]
  const productos = await Promise.all(defs.map((p) =>
    prisma.producto.create({
      data: { nombre: p.nombre, categoria: p.categoria, unidad: 'unidad', precioVenta: p.venta, precioCosto: 0, stockActual: 0, alertaStock: 10, businessId: bid },
    })))
  const estado = productos.map((p, i) => ({ id: p.id, nombre: p.nombre, stock: 0, cpp: 0, def: defs[i] }))

  // ── Registro (misma lógica que createProductOperation / createTransaction) ──
  const saldo: Record<string, number> = { [caja.id]: 0, [banco.id]: 0, [usd.id]: 0 }

  async function asiento(transactionId: string, date: Date, description: string, params: Omit<GenerateJournalLinesParams, 'cxcAccountId' | 'cxpAccountId' | 'description'>) {
    const journal = generateJournalLines({ ...params, cxcAccountId: cxc, cxpAccountId: cxp, description, inventoryAccountId: inventario, cogsAccountId: cogs })
    if (!journal.ok) return
    await prisma.journalEntry.create({ data: { date, description, transactionId, businessId: bid, lines: { create: journal.lines } } })
  }

  type Pago = { accountId: string; monto: number } | { credito: true; monto: number; vence: Date }
  type Item = { i: number; cantidad: number; precio: number }

  async function operacion(tipo: 'VENTA' | 'COMPRA', date: Date, items: Item[], pagos: (total: number) => Pago[], contactId?: string) {
    const esVenta = tipo === 'VENTA'
    const total = round2(items.reduce((s, it) => s + it.cantidad * it.precio, 0))
    const listado = items.map((it) => estado[it.i].nombre)
    const description = `${esVenta ? 'Venta' : 'Compra'}: ${listado.length > 2 ? `${listado.slice(0, 2).join(', ')} y ${listado.length - 2} más` : listado.join(', ')}`
    const op = await prisma.operacion.create({ data: { tipo, date, subtotal: total, total, contactId, businessId: bid } })

    let cmv = 0
    for (const it of items) {
      const p = estado[it.i]
      await prisma.operacionItem.create({
        data: { operacionId: op.id, productoId: p.id, cantidad: it.cantidad, precioUnitario: it.precio, subtotal: round2(it.cantidad * it.precio), costoUnitario: esVenta ? p.cpp : it.precio },
      })
      if (esVenta) {
        cmv += it.cantidad * p.cpp
        p.stock -= it.cantidad
        await prisma.movimientoStock.create({ data: { tipo: 'SALIDA', cantidad: it.cantidad, precio: it.precio, costoUnitario: p.cpp, motivo: description, fecha: date, productoId: p.id } })
      } else {
        const previo = Math.max(0, p.stock)
        p.cpp = (previo * p.cpp + it.cantidad * it.precio) / (previo + it.cantidad)
        p.stock = previo + it.cantidad
        await prisma.movimientoStock.create({ data: { tipo: 'ENTRADA', cantidad: it.cantidad, precio: it.precio, motivo: description, fecha: date, productoId: p.id } })
      }
    }

    const partes = pagos(total)
    let cmvPendiente = round2(cmv)
    const creditos: string[] = []
    for (const [n, parte] of partes.entries()) {
      const esCredito = 'credito' in parte
      const accountId = esCredito ? banco.id : parte.accountId
      const tx = await prisma.transaction.create({
        data: {
          amount: parte.monto, description, type: esVenta ? 'INCOME' : 'EXPENSE', subType: esVenta ? 'SALE_PRODUCT' : 'PURCHASE_PRODUCT', date, currency: 'ARS',
          esCredito, estado: esCredito ? 'PENDIENTE' : esVenta ? 'COBRADO' : 'PAGADO', fechaVencimiento: esCredito ? parte.vence : null,
          cuotaNumero: esCredito ? 1 : null, cuotasTotal: esCredito ? 1 : null,
          accountId, businessId: bid, operacionId: op.id, categoryId: esVenta ? catVentas.id : catCompras.id, contactId,
        },
      })
      if (esCredito) creditos.push(tx.id)
      else saldo[accountId] += esVenta ? parte.monto : -parte.monto
      await asiento(tx.id, date, description, {
        amount: parte.monto, type: esVenta ? 'INCOME' : 'EXPENSE', esCredito, physicalAccountId: accountId,
        categoryContableAccountId: esVenta ? catVentas.contable : catCompras.contable,
        mode: esVenta ? (cmvPendiente > 0 && n === 0 ? 'SALE_PRODUCT' : 'STANDARD') : 'PURCHASE_PRODUCT',
        costoMercaderia: esVenta && n === 0 ? cmvPendiente : undefined,
      })
      if (esVenta && n === 0) cmvPendiente = 0
    }
    return creditos
  }

  async function movimiento(type: 'INCOME' | 'EXPENSE', categoryName: string, amount: number, accountId: string, date: Date, description: string) {
    const cat = await categoria(categoryName, type)
    const tx = await prisma.transaction.create({
      data: { amount, description, type, date, currency: 'ARS', estado: type === 'INCOME' ? 'COBRADO' : 'PAGADO', accountId, businessId: bid, categoryId: cat.id },
    })
    saldo[accountId] += type === 'INCOME' ? amount : -amount
    await asiento(tx.id, date, description, { amount, type, esCredito: false, physicalAccountId: accountId, categoryContableAccountId: cat.contable })
  }

  // Cobro (o pago) total de una cuota pendiente
  async function saldar(creditoId: string, date: Date, accountId: string) {
    const credito = await prisma.transaction.findUniqueOrThrow({ where: { id: creditoId }, include: { contact: true } })
    const esCobro = credito.type === 'INCOME'
    const description = `${esCobro ? 'Cobro' : 'Pago'} ${credito.contact?.name ?? ''} · ${credito.description}`.trim()
    const tx = await prisma.transaction.create({
      data: {
        amount: credito.amount, description, type: credito.type, subType: esCobro ? 'COBRO_CREDITO' : 'PAGO_DEUDA', date, currency: 'ARS',
        estado: esCobro ? 'COBRADO' : 'PAGADO', accountId, businessId: bid, contactId: credito.contactId, linkedCreditoId: credito.id,
        categoryId: esCobro ? catCobros.id : (await categoria('Otros egresos', 'EXPENSE')).id,
      },
    })
    await prisma.transaction.update({ where: { id: credito.id }, data: { estado: esCobro ? 'COBRADO' : 'PAGADO' } })
    saldo[accountId] += esCobro ? credito.amount : -credito.amount
    await asiento(tx.id, date, description, {
      amount: credito.amount, type: credito.type as 'INCOME' | 'EXPENSE', esCredito: false, physicalAccountId: accountId,
      categoryContableAccountId: null, mode: esCobro ? 'COBRO_CREDITO' : 'PAGO_DEUDA',
    })
  }

  // ── Mes a mes: enero → hoy ──────────────────────────────────────────
  const inflacion = (m: number) => Math.pow(1.025, m - 1)
  const pendientesCobro: { id: string; cobrar: Date }[] = []
  const pendientesPago: { id: string; pagar: Date }[] = []
  let operaciones = 0

  for (let m = 1; m <= CURRENT_MONTH; m++) {
    const f = inflacion(m)
    // Temporada: más ventas en invierno (termos, mates y yerba)
    const temporada = [0.9, 0.85, 0.95, 1, 1.1, 1.25, 1.3, 1.2, 1.05, 1, 1.05, 1.2][m - 1]
    const ventasMes = estado.map((p) => Math.round(between(p.def.ventasMes[0], p.def.ventasMes[1]) * temporada))

    // Compra de reposición el día 2: lo que se va a vender + un colchón (enero arranca de cero)
    const compraDia = at(m, 2)
    if (isPast(compraDia)) {
      const items = estado.map((p, i) => ({
        i,
        cantidad: Math.max(0, Math.ceil(ventasMes[i] * 1.15) - Math.max(0, p.stock) + (m === 1 ? 20 : 0)),
        precio: Math.round(p.def.costo * f * (0.97 + rand() * 0.06)),
      })).filter((it) => it.cantidad > 0)
      const aCredito = m % 3 === 0 // cada 3 meses, la mitad a pagar en 30 días
      const creditos = await operacion('COMPRA', compraDia, items, (total) => aCredito
        ? [{ accountId: banco.id, monto: round2(total / 2) }, { credito: true, monto: round2(total - round2(total / 2)), vence: at(m + 1, 2) }]
        : [{ accountId: banco.id, monto: total }], proveedor.id)
      creditos.forEach((id) => pendientesPago.push({ id, pagar: at(m + 1, 1) }))
      operaciones++
    }

    // Ventas: 4 por mes, repartiendo lo del mes
    const dias = [6, 13, 20, 27]
    for (const [k, dia] of dias.entries()) {
      const fecha = at(m, dia)
      if (!isPast(fecha)) continue
      const items = estado.map((p, i) => ({
        i,
        cantidad: Math.min(Math.floor(ventasMes[i] / 4) + (k === 3 ? ventasMes[i] % 4 : 0), Math.max(0, p.stock)),
        precio: Math.round(p.def.venta * f / 10) * 10,
      })).filter((it) => it.cantidad > 0)
      if (items.length === 0) continue
      const cliente = clientes[(m + k) % clientes.length]
      const creditos = await operacion('VENTA', fecha, items, (total) => {
        if (k === 0) return [{ accountId: caja.id, monto: total }]
        if (k === 1) return [{ accountId: caja.id, monto: round2(total * 0.4) }, { accountId: banco.id, monto: round2(total - round2(total * 0.4)) }]
        if (k === 2) return [{ credito: true, monto: total, vence: at(m + 1, 10) }] // a cobrar el mes que viene
        return [{ accountId: banco.id, monto: total }]
      }, k === 2 ? cliente.id : undefined)
      creditos.forEach((id) => pendientesCobro.push({ id, cobrar: at(m + 1, 10) }))
      operaciones++
    }

    // Gastos del mes
    const gastos: [number, string, number, string, string][] = [
      [5, 'Sueldos', 520000, banco.id, 'Sueldos'],
      [8, 'Alquiler', 260000, banco.id, 'Alquiler local'],
      [15, 'Publicidad', 60000, banco.id, 'Publicidad redes'],
      [22, 'Impuestos', 90000, banco.id, 'Ingresos brutos'],
    ]
    for (const [dia, cat, base, cuenta, desc] of gastos) {
      const fecha = at(m, dia)
      if (isPast(fecha)) await movimiento('EXPENSE', cat, Math.round(base * f * (0.95 + rand() * 0.1) / 100) * 100, cuenta, fecha, `${desc} ${fecha.toLocaleDateString('es-AR', { month: 'long' })}`)
    }

    // Cobros y pagos que vencen este mes
    for (const c of pendientesCobro.filter((c) => c.cobrar.getMonth() + 1 === m && c.cobrar.getFullYear() === YEAR && isPast(c.cobrar))) await saldar(c.id, c.cobrar, banco.id)
    for (const p of pendientesPago.filter((p) => p.pagar.getMonth() + 1 === m && p.pagar.getFullYear() === YEAR && isPast(p.pagar))) await saldar(p.id, p.pagar, banco.id)

    // Retiro de caja al banco a fin de mes (cambio de caja en pesos)
    const deposito = at(m, 28)
    if (isPast(deposito) && saldo[caja.id] + opening.caja > 600000) {
      const monto = Math.round((saldo[caja.id] + opening.caja - 350000) / 1000) * 1000
      await prisma.cashTransfer.create({ data: { date: deposito, description: 'Depósito de caja', fromAccountId: caja.id, toAccountId: banco.id, amountFrom: monto, amountTo: monto, businessId: bid } })
      saldo[caja.id] -= monto
      saldo[banco.id] += monto
    }
  }

  // Compra de dólares en marzo (cambio de caja entre monedas)
  if (isPast(at(3, 18))) {
    const cotizacion = 1150
    const dolares = 800
    await prisma.cashTransfer.create({
      data: { date: at(3, 18), description: 'Compra de dólares', fromAccountId: banco.id, toAccountId: usd.id, amountFrom: dolares * cotizacion, amountTo: dolares, exchangeRate: cotizacion, businessId: bid },
    })
    saldo[banco.id] -= dolares * cotizacion
    saldo[usd.id] += dolares
  }

  // ── Estado final: stock, costos y saldos ──────────────────────────────────────────
  for (const p of estado) {
    await prisma.producto.update({ where: { id: p.id }, data: { stockActual: p.stock, precioCosto: round2(p.cpp), precioVenta: Math.round(p.def.venta * inflacion(CURRENT_MONTH) / 10) * 10 } })
  }
  for (const [id, delta] of Object.entries(saldo)) {
    await prisma.account.update({ where: { id }, data: { currentBalance: { increment: round2(delta) } } })
  }

  console.log(`📦 ${operaciones} operaciones de productos, ${pendientesCobro.length} ventas a crédito, ${pendientesPago.length} compras a crédito`)
  console.log('\n✅ Seed completado exitosamente.')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
