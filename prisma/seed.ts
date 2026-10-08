// prisma/seed.ts
//
// Datos demo de un corralón / ferretería, cargados igual que los registra la app (modal "+"):
// - Solo las categorías del sistema (productos, cobros/pagos de deuda, bienes de uso,
//   cambio y diferencia de caja) + las 4 de gastos por defecto (Sueldos, Alquiler,
//   Publicidad, Impuestos), con subcategorías.
// - Ventas y compras de productos como Operacion + ítems + stock con su CPP; descuentos y
//   pagos combinados (efectivo + transferencia / Mercado Pago).
// - Créditos variados: ventas en 3 cuotas, cobro parcial, cuota vencida sin cobrar, deuda con
//   proveedor pagada en dos partes, cliente saldado.
// - Bienes de uso: camioneta comprada con anticipo + 6 cuotas; venta de una heladera vieja.
// - Cajas: efectivo, banco, Mercado Pago y dólares; depósitos, compra de dólares, un
//   sobrante y un faltante de caja.
// Cubre desde julio del año pasado hasta hoy. El saldo actual de cada caja = apertura + lo movido.
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
    // El seed BORRA todo: nunca contra una base remota (producción)
    throw new Error('El seed solo corre contra la base local (SQLite). Comentá TURSO_DATABASE_URL en .env.')
  }
  const adapter = new PrismaLibSql({ url: url || 'file:./prisma/dev.db' })
  return new PrismaClient({ adapter } as never)
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
const rand = mulberry32(20250701)
const between = (min: number, max: number) => Math.round(min + rand() * (max - min))

const NOW = new Date()
const START_YEAR = NOW.getFullYear() - 1
const START_MONTH = 7 // julio del año pasado
// Fecha a mediodía (evita que la zona horaria corra el día). Meses > 12 pasan al año siguiente.
const at = (year: number, month: number, day: number) => new Date(year, month - 1, day, 12, 0, 0)
const isPast = (d: Date) => d.getTime() <= NOW.getTime()
// Escala de ventas del mes (unidades por producto × VOLUMEN)
const VOLUMEN = 2.4
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12, 0, 0)

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
  if (process.env.NODE_ENV === 'production' || process.env.ALLOW_DATABASE_RESET !== 'true') {
    throw new Error('Este seed elimina todos los datos locales. Para ejecutarlo, confirma con ALLOW_DATABASE_RESET=true fuera de producción.')
  }

  console.log('🌱 Iniciando seed (corralón demo)...')
  await clean()

  // ── Usuario y negocio ──────────────────────────────────────────
  const user = await prisma.user.create({
    data: { email: 'demo@finarg.com', name: 'Usuario Demo', password: await bcrypt.hash('Demo1234', 10), emailVerified: new Date() },
  })
  const business = await prisma.business.create({
    data: {
      name: 'Corralón Demo', currency: 'ARS', operatingModel: 'PRODUCTS', onboardingCompletedAt: new Date(),
      members: { create: { userId: user.id, role: 'ADMIN', status: 'ACTIVE', acceptedAt: new Date() } },
    },
  })
  const bid = business.id
  await prisma.user.update({ where: { id: user.id }, data: { defaultBusinessId: bid } })

  // ── Cajas (saldo de apertura; se suma lo movido al final) ──
  const opening = { efectivo: 1_500_000, banco: 40_000_000, mp: 500_000, usd: 3_000 }
  const efectivo = await prisma.account.create({ data: { name: 'Efectivo', type: 'CASH', currency: 'ARS', currentBalance: opening.efectivo, businessId: bid } })
  const banco = await prisma.account.create({ data: { name: 'Banco Galicia', type: 'BANK', currency: 'ARS', currentBalance: opening.banco, businessId: bid } })
  const mp = await prisma.account.create({ data: { name: 'Mercado Pago', type: 'WALLET', currency: 'ARS', currentBalance: opening.mp, businessId: bid } })
  const usd = await prisma.account.create({ data: { name: 'Caja USD', type: 'CASH', currency: 'USD', currentBalance: opening.usd, businessId: bid } })
  await setupContableAccountsForBusiness(bid, prisma as never)
  const system = async (subtype: string) =>
    (await prisma.account.findFirst({ where: { businessId: bid, isSystemAccount: true, subtype }, select: { id: true } }))?.id ?? null
  const cxc = await system('RECEIVABLE')
  const cxp = await system('PAYABLE')
  const inventario = await system('INVENTORY')
  const cogs = await system('COGS')
  const bienesCuenta = await system('FIXED_ASSET')

  // ── Categorías: las 4 por defecto (con subcategorías) + las del sistema que crea la app ──
  const categorias = new Map<string, { id: string; contable: string | null }>()
  async function categoria(name: string, type: 'INCOME' | 'EXPENSE') {
    const key = `${type}:${name}`
    const found = categorias.get(key)
    if (found) return found
    const c = await prisma.category.create({ data: { name, type, businessId: bid } })
    await createContableAccountForCategory(c.id, name, type, bid, prisma as never)
    const { contableAccountId } = await prisma.category.findUniqueOrThrow({ where: { id: c.id }, select: { contableAccountId: true } })
    const entry = { id: c.id, contable: contableAccountId }
    categorias.set(key, entry)
    return entry
  }
  for (const name of ['Sueldos', 'Alquiler', 'Publicidad', 'Impuestos']) await categoria(name, 'EXPENSE')
  const subcats = new Map<string, string>()
  const subcategoria = async (cat: string, name: string) => {
    const s = await prisma.subcategory.create({ data: { name, categoryId: (await categoria(cat, 'EXPENSE')).id, businessId: bid } })
    subcats.set(`${cat}:${name}`, s.id)
  }
  const empleados = ['Martín (mostrador)', 'Lucía (administración)', 'Carlos (depósito)']
  for (const e of empleados) await subcategoria('Sueldos', e)
  await subcategoria('Impuestos', 'IIBB')
  await subcategoria('Impuestos', 'Tasa municipal')
  const catVentas = await categoria('Ventas de mercadería', 'INCOME')
  const catCompras = await categoria('Compras', 'EXPENSE')

  // ── Contactos ──────────────────────────────────────────
  const contacto = async (name: string, type: 'CLIENT' | 'SUPPLIER') => (await prisma.contact.create({ data: { name, type, businessId: bid } })).id
  const cli = {
    delSur: await contacto('Constructora Del Sur', 'CLIENT'),
    martinez: await contacto('Arq. Paula Martínez', 'CLIENT'),
    obrasNorte: await contacto('Obras Norte SRL', 'CLIENT'),
    perez: await contacto('Juan Pérez', 'CLIENT'),
  }
  const prov = {
    lomaNegra: await contacto('Distribuidora Loma Negra', 'SUPPLIER'),
    mayorista: await contacto('Corralón Mayorista Oeste', 'SUPPLIER'),
    sinteplast: await contacto('Sinteplast Distribuidora', 'SUPPLIER'),
    ferremax: await contacto('Ferremax', 'SUPPLIER'),
    automotores: await contacto('Automotores del Oeste', 'SUPPLIER'),
  }

  // ── Productos (stock y costo salen de las compras) ──
  const defs = [
    { nombre: 'Cemento Loma Negra 50 kg', categoria: 'Obra gruesa', unidad: 'bolsa', costo: 7500, venta: 10500, mes: [180, 260], prov: prov.lomaNegra },
    { nombre: 'Cal hidratada 25 kg', categoria: 'Obra gruesa', unidad: 'bolsa', costo: 4200, venta: 6200, mes: [80, 130], prov: prov.lomaNegra },
    { nombre: 'Arena gruesa', categoria: 'Áridos', unidad: 'm³', costo: 28000, venta: 40000, mes: [18, 30], prov: prov.mayorista },
    { nombre: 'Ladrillo hueco 12x18x33', categoria: 'Obra gruesa', unidad: 'unidad', costo: 450, venta: 700, mes: [1800, 3000], prov: prov.mayorista },
    { nombre: 'Hierro 8 mm x 12 m', categoria: 'Hierros', unidad: 'barra', costo: 6500, venta: 9500, mes: [90, 150], prov: prov.mayorista },
    { nombre: 'Pintura látex 20 L', categoria: 'Pinturería', unidad: 'balde', costo: 65000, venta: 95000, mes: [10, 20], prov: prov.sinteplast },
    { nombre: 'Tornillos 8x1 (caja x100)', categoria: 'Ferretería', unidad: 'caja', costo: 3500, venta: 6000, mes: [30, 55], prov: prov.ferremax },
    { nombre: 'Taladro percutor 750 W', categoria: 'Herramientas', unidad: 'unidad', costo: 70000, venta: 115000, mes: [3, 7], prov: prov.ferremax },
    { nombre: 'Cable 2,5 mm (rollo 100 m)', categoria: 'Electricidad', unidad: 'rollo', costo: 45000, venta: 72000, mes: [6, 12], prov: prov.ferremax },
    { nombre: 'Caño PVC 110 mm x 4 m', categoria: 'Sanitarios', unidad: 'unidad', costo: 12000, venta: 19000, mes: [25, 45], prov: prov.ferremax },
  ]
  const productos = await Promise.all(defs.map((p) =>
    prisma.producto.create({
      data: { nombre: p.nombre, categoria: p.categoria, unidad: p.unidad, precioVenta: p.venta, precioCosto: 0, stockActual: 0, alertaStock: Math.ceil(p.mes[0] / 4), businessId: bid },
    })))
  const estado = productos.map((p, i) => ({ id: p.id, nombre: p.nombre, stock: 0, cpp: 0, def: defs[i] }))

  // ── Registro: misma lógica que createProductOperation / createConceptOperation ──
  const saldo: Record<string, number> = { [efectivo.id]: 0, [banco.id]: 0, [mp.id]: 0, [usd.id]: 0 }

  async function asiento(transactionId: string, date: Date, description: string, params: Omit<GenerateJournalLinesParams, 'cxcAccountId' | 'cxpAccountId' | 'description'>) {
    const journal = generateJournalLines({
      ...params, cxcAccountId: cxc, cxpAccountId: cxp, description,
      inventoryAccountId: inventario, cogsAccountId: cogs, fixedAssetAccountId: bienesCuenta,
    })
    if (!journal.ok) return
    await prisma.journalEntry.create({ data: { date, description, transactionId, businessId: bid, lines: { create: journal.lines } } })
  }

  type Pago = { accountId: string; monto: number } | { cuotas: { monto: number; vence: Date }[] }
  type Item = { i: number; cantidad: number; precio: number }
  // Cuotas creadas, para cobrarlas/pagarlas después
  type Cuota = { id: string; saldo: number }

  /** Venta o compra de productos (carrito, descuento, pago combinado, cuotas) */
  async function operacion(tipo: 'VENTA' | 'COMPRA', date: Date, items: Item[], descuento: number, pagos: (total: number) => Pago[], contactId?: string): Promise<Cuota[]> {
    const esVenta = tipo === 'VENTA'
    const subtotal = round2(items.reduce((s, it) => s + it.cantidad * it.precio, 0))
    const total = round2(subtotal - descuento)
    const factorNeto = subtotal > 0 ? total / subtotal : 1
    const nombres = items.map((it) => estado[it.i].nombre)
    const description = `${esVenta ? 'Venta' : 'Compra'}: ${nombres.length > 2 ? `${nombres.slice(0, 2).join(', ')} y ${nombres.length - 2} más` : nombres.join(', ')}`
    const op = await prisma.operacion.create({ data: { tipo, date, subtotal, descuento, total, contactId, businessId: bid } })

    let cmv = 0
    for (const it of items) {
      const p = estado[it.i]
      const costoNeto = round2(it.precio * factorNeto)
      await prisma.operacionItem.create({
        data: { operacionId: op.id, productoId: p.id, cantidad: it.cantidad, precioUnitario: it.precio, subtotal: round2(it.cantidad * it.precio), costoUnitario: esVenta ? p.cpp : costoNeto },
      })
      if (esVenta) {
        cmv += it.cantidad * p.cpp
        p.stock -= it.cantidad
        await prisma.movimientoStock.create({ data: { tipo: 'SALIDA', cantidad: it.cantidad, precio: it.precio, costoUnitario: p.cpp, motivo: description, fecha: date, productoId: p.id } })
      } else {
        const previo = Math.max(0, p.stock)
        p.cpp = (previo * p.cpp + it.cantidad * costoNeto) / (previo + it.cantidad)
        p.stock = previo + it.cantidad
        await prisma.movimientoStock.create({ data: { tipo: 'ENTRADA', cantidad: it.cantidad, precio: costoNeto, motivo: description, fecha: date, productoId: p.id } })
      }
    }

    const partes = pagos(total).flatMap((p) => ('cuotas' in p
      ? p.cuotas.map((c, n) => ({ accountId: banco.id, monto: c.monto, esCredito: true, vence: c.vence, cuota: [n + 1, p.cuotas.length] as [number, number] }))
      : [{ accountId: p.accountId, monto: p.monto, esCredito: false, vence: null as Date | null, cuota: null as [number, number] | null }]))
    let cmvPendiente = round2(cmv)
    const cuotas: Cuota[] = []
    for (const parte of partes) {
      const desc = parte.cuota ? `${description} · cuota ${parte.cuota[0]}/${parte.cuota[1]}` : description
      const tx = await prisma.transaction.create({
        data: {
          amount: parte.monto, description: desc, type: esVenta ? 'INCOME' : 'EXPENSE', subType: esVenta ? 'SALE_PRODUCT' : 'PURCHASE_PRODUCT', date, currency: 'ARS',
          esCredito: parte.esCredito, estado: parte.esCredito ? 'PENDIENTE' : esVenta ? 'COBRADO' : 'PAGADO', fechaVencimiento: parte.vence,
          cuotaNumero: parte.cuota?.[0] ?? null, cuotasTotal: parte.cuota?.[1] ?? null,
          accountId: parte.accountId, businessId: bid, operacionId: op.id, categoryId: esVenta ? catVentas.id : catCompras.id, contactId,
        },
      })
      if (parte.esCredito) cuotas.push({ id: tx.id, saldo: parte.monto })
      else saldo[parte.accountId] += esVenta ? parte.monto : -parte.monto
      await asiento(tx.id, date, desc, {
        amount: parte.monto, type: esVenta ? 'INCOME' : 'EXPENSE', esCredito: parte.esCredito, physicalAccountId: parte.accountId,
        categoryContableAccountId: esVenta ? catVentas.contable : catCompras.contable,
        mode: esVenta ? (cmvPendiente > 0 ? 'SALE_PRODUCT' : 'STANDARD') : 'PURCHASE_PRODUCT',
        costoMercaderia: esVenta && cmvPendiente > 0 ? cmvPendiente : undefined,
      })
      if (esVenta) cmvPendiente = 0
    }
    return cuotas
  }

  /** Gasto de una categoría propia (Sueldos, Alquiler...), con subcategoría opcional */
  async function gasto(cat: string, sub: string | null, amount: number, accountId: string, date: Date, description: string) {
    const c = await categoria(cat, 'EXPENSE')
    const tx = await prisma.transaction.create({
      data: {
        amount, description, type: 'EXPENSE', subType: 'PAGO', date, currency: 'ARS', estado: 'PAGADO', accountId, businessId: bid,
        categoryId: c.id, subcategoryId: sub ? subcats.get(`${cat}:${sub}`) : null,
      },
    })
    saldo[accountId] -= amount
    await asiento(tx.id, date, description, { amount, type: 'EXPENSE', esCredito: false, physicalAccountId: accountId, categoryContableAccountId: c.contable })
  }

  /** Cobro o pago de cuotas: aplica el monto a las cuotas en orden (puede quedar parcial) */
  async function saldar(cuotas: Cuota[], monto: number, date: Date, accountId: string) {
    const primera = await prisma.transaction.findUniqueOrThrow({ where: { id: cuotas[0].id }, include: { contact: true } })
    const esCobro = primera.type === 'INCOME'
    const description = `${esCobro ? 'Cobro' : 'Pago'} ${primera.contact?.name ?? ''}`.trim()
    let resto = round2(monto)
    for (const c of cuotas) {
      if (resto <= 0.001) break
      const aplicar = round2(Math.min(resto, c.saldo))
      if (aplicar <= 0) continue
      const tx = await prisma.transaction.create({
        data: {
          amount: aplicar, description, type: primera.type, subType: esCobro ? 'COBRO_CREDITO' : 'PAGO_DEUDA', date, currency: 'ARS',
          estado: esCobro ? 'COBRADO' : 'PAGADO', accountId, businessId: bid, contactId: primera.contactId, linkedCreditoId: c.id,
        },
      })
      c.saldo = round2(c.saldo - aplicar)
      resto = round2(resto - aplicar)
      await prisma.transaction.update({ where: { id: c.id }, data: { estado: c.saldo <= 0.001 ? (esCobro ? 'COBRADO' : 'PAGADO') : 'PARCIAL' } })
      saldo[accountId] += esCobro ? aplicar : -aplicar
      await asiento(tx.id, date, description, {
        amount: aplicar, type: primera.type as 'INCOME' | 'EXPENSE', esCredito: false, physicalAccountId: accountId,
        categoryContableAccountId: null, mode: esCobro ? 'COBRO_CREDITO' : 'PAGO_DEUDA',
      })
    }
  }

  async function cambioDeCaja(date: Date, from: string, to: string, amountFrom: number, amountTo: number, description: string, exchangeRate?: number) {
    await prisma.cashTransfer.create({ data: { date, description, fromAccountId: from, toAccountId: to, amountFrom, amountTo, exchangeRate, businessId: bid } })
    saldo[from] -= amountFrom
    saldo[to] += amountTo
  }

  async function diferenciaDeCaja(date: Date, accountId: string, diferencia: number) {
    const type = diferencia > 0 ? 'INCOME' : 'EXPENSE'
    const c = await categoria('Diferencias de caja', type)
    const description = diferencia > 0 ? 'Sobrante de caja' : 'Faltante de caja'
    const tx = await prisma.transaction.create({
      data: { amount: Math.abs(diferencia), description, type, subType: 'DIFERENCIA_CAJA', date, currency: 'ARS', estado: diferencia > 0 ? 'COBRADO' : 'PAGADO', accountId, businessId: bid, categoryId: c.id },
    })
    saldo[accountId] += diferencia
    await asiento(tx.id, date, description, { amount: Math.abs(diferencia), type, esCredito: false, physicalAccountId: accountId, categoryContableAccountId: c.contable })
  }

  // ── Bienes de uso ──
  // Heladera exhibidora comprada antes del período demo: se vende en junio
  const heladera = await prisma.bienDeUso.create({
    data: { nombre: 'Heladera exhibidora', categoria: 'Muebles y equipos', valorAdquisicion: 900_000, fechaAdquisicion: at(START_YEAR - 2, 3, 1), businessId: bid },
  })
  async function compraCamioneta(date: Date): Promise<Cuota[]> {
    const total = 18_000_000
    const anticipo = 5_400_000
    const cuotaMonto = round2((total - anticipo) / 6)
    const bien = await prisma.bienDeUso.create({
      data: { nombre: 'Camioneta Toyota Hilux', categoria: 'Rodados', marca: 'Toyota', valorAdquisicion: total, vidaUtilMeses: 60, fechaAdquisicion: date, businessId: bid },
    })
    const cat = await categoria('Otros egresos', 'EXPENSE')
    const op = await prisma.operacion.create({ data: { tipo: 'COMPRA_BIEN', date, subtotal: total, total, contactId: prov.automotores, businessId: bid } })
    const partes = [
      { monto: anticipo, esCredito: false, vence: null as Date | null, cuota: null as [number, number] | null },
      ...Array.from({ length: 6 }, (_, n) => ({ monto: cuotaMonto, esCredito: true, vence: addDays(date, 30 * (n + 1)), cuota: [n + 1, 6] as [number, number] })),
    ]
    const cuotas: Cuota[] = []
    for (const p of partes) {
      const description = `Compra de bien de uso: Camioneta Toyota Hilux${p.cuota ? ` · cuota ${p.cuota[0]}/${p.cuota[1]}` : ''}`
      const tx = await prisma.transaction.create({
        data: {
          amount: p.monto, description, type: 'EXPENSE', subType: 'PURCHASE_BIEN_USO', date, currency: 'ARS',
          esCredito: p.esCredito, estado: p.esCredito ? 'PENDIENTE' : 'PAGADO', fechaVencimiento: p.vence,
          cuotaNumero: p.cuota?.[0] ?? null, cuotasTotal: p.cuota?.[1] ?? null,
          accountId: banco.id, businessId: bid, operacionId: op.id, categoryId: cat.id, bienDeUsoId: bien.id, contactId: prov.automotores,
        },
      })
      if (p.esCredito) cuotas.push({ id: tx.id, saldo: p.monto })
      else saldo[banco.id] -= p.monto
      await asiento(tx.id, date, description, { amount: p.monto, type: 'EXPENSE', esCredito: p.esCredito, physicalAccountId: banco.id, categoryContableAccountId: cat.contable, mode: 'PURCHASE_BIEN_USO' })
    }
    return cuotas
  }
  async function ventaHeladera(date: Date) {
    const monto = 450_000
    const cat = await categoria('Resultado por venta de bienes de uso', 'INCOME')
    await prisma.bienDeUso.update({ where: { id: heladera.id }, data: { activo: false } })
    const description = 'Venta de bien de uso: Heladera exhibidora'
    const tx = await prisma.transaction.create({
      data: { amount: monto, description, type: 'INCOME', subType: 'SALE_BIEN_USO', date, currency: 'ARS', estado: 'COBRADO', accountId: efectivo.id, businessId: bid, categoryId: cat.id, bienDeUsoId: heladera.id },
    })
    saldo[efectivo.id] += monto
    await asiento(tx.id, date, description, { amount: monto, type: 'INCOME', esCredito: false, physicalAccountId: efectivo.id, categoryContableAccountId: cat.contable, mode: 'SALE_BIEN_USO', bienValorNetoEnLibros: 900_000 })
  }

  // ── Mes a mes: julio del año pasado → hoy ──────────────────────────────────────────
  type Pendiente = { cuotas: Cuota[]; cuando: Date; monto?: number; accountId: string }
  const cobros: Pendiente[] = []
  const pagosProv: Pendiente[] = []
  let camionetaCuotas: Cuota[] = []
  let operaciones = 0
  const inflacion = (k: number) => Math.pow(1.022, k)
  const retail = [efectivo.id, mp.id, banco.id]

  for (let k = 0; ; k++) {
    const y = START_YEAR + Math.floor((START_MONTH - 1 + k) / 12)
    const m = ((START_MONTH - 1 + k) % 12) + 1
    if (at(y, m, 1) > NOW) break
    const f = inflacion(k)
    // Temporada de obra: más ventas en primavera/verano
    const temporada = [0.95, 0.9, 1.0, 1.05, 1.1, 1.0, 0.85, 0.9, 1.0, 1.1, 1.15, 1.1][m - 1]
    const ventasMes = estado.map((p) => Math.round(between(p.def.mes[0], p.def.mes[1]) * temporada * VOLUMEN))

    // Compras de reposición el día 2, una por proveedor
    const compraDia = at(y, m, 2)
    if (isPast(compraDia)) {
      const porProveedor = new Map<string, Item[]>()
      estado.forEach((p, i) => {
        const cantidad = Math.max(0, Math.ceil(ventasMes[i] * 1.12) - Math.max(0, p.stock) + (k === 0 ? Math.ceil(p.def.mes[1] * 0.3) : 0))
        if (cantidad <= 0) return
        const items = porProveedor.get(p.def.prov) ?? []
        items.push({ i, cantidad, precio: Math.round(p.def.costo * f * (0.97 + rand() * 0.06)) })
        porProveedor.set(p.def.prov, items)
      })
      for (const [proveedor, items] of porProveedor) {
        const aCredito = proveedor === prov.mayorista && k % 2 === 0 // cada 2 meses a 30/60 días
        const enDosPartes = proveedor === prov.sinteplast && k === 8 // deuda pagada en dos partes
        const cuotas = await operacion('COMPRA', compraDia, items, 0, (total) => {
          if (enDosPartes) return [{ cuotas: [{ monto: total, vence: addDays(compraDia, 30) }] }]
          if (aCredito) return [{ cuotas: [{ monto: round2(total / 2), vence: addDays(compraDia, 30) }, { monto: round2(total - round2(total / 2)), vence: addDays(compraDia, 60) }] }]
          return [{ accountId: banco.id, monto: total }]
        }, proveedor)
        if (enDosPartes) {
          const total = cuotas[0].saldo
          pagosProv.push({ cuotas, cuando: addDays(compraDia, 15), monto: round2(total / 2), accountId: banco.id })
          pagosProv.push({ cuotas, cuando: addDays(compraDia, 40), accountId: banco.id })
        } else if (aCredito) {
          pagosProv.push({ cuotas: [cuotas[0]], cuando: addDays(compraDia, 30), accountId: banco.id })
          pagosProv.push({ cuotas: [cuotas[1]], cuando: addDays(compraDia, 60), accountId: banco.id })
        }
        operaciones++
      }
    }

    // Ventas de mostrador: 8 por mes, repartiendo lo del mes; algunas con descuento o pago combinado
    const dias = [3, 6, 9, 12, 16, 19, 23, 27]
    for (const [n, dia] of dias.entries()) {
      const fecha = at(y, m, dia)
      if (!isPast(fecha)) continue
      const items = estado.map((p, i) => ({
        i,
        cantidad: Math.min(Math.floor(ventasMes[i] / dias.length) + (n === dias.length - 1 ? ventasMes[i] % dias.length : 0), Math.max(0, p.stock)),
        precio: Math.round(p.def.venta * f / 10) * 10,
      })).filter((it) => it.cantidad > 0 && rand() > 0.25)
      if (items.length === 0) continue
      const subtotal = items.reduce((s, it) => s + it.cantidad * it.precio, 0)
      const descuento = n % 4 === 1 ? Math.round(subtotal * 0.05) : 0 // 5% por pago contado
      const combinado = n % 3 === 2
      await operacion('VENTA', fecha, items, descuento, (total) => combinado
        ? [{ accountId: efectivo.id, monto: round2(total * 0.4) }, { accountId: mp.id, monto: round2(total - round2(total * 0.4)) }]
        : [{ accountId: retail[n % retail.length], monto: total }])
      operaciones++
    }

    // Ventas a crédito a clientes
    const ventaCredito = async (dia: number, contactId: string, share: number, cuotasN: number) => {
      const fecha = at(y, m, dia)
      if (!isPast(fecha)) return null
      const items = estado.slice(0, 5).map((p, i) => ({ i, cantidad: Math.min(Math.round(p.def.mes[1] * share), Math.max(0, p.stock)), precio: Math.round(p.def.venta * f / 10) * 10 }))
        .filter((it) => it.cantidad > 0)
      if (items.length === 0) return null
      operaciones++
      return operacion('VENTA', fecha, items, 0, (total) => [{
        cuotas: Array.from({ length: cuotasN }, (_, c) => ({ monto: c === cuotasN - 1 ? round2(total - round2(total / cuotasN) * (cuotasN - 1)) : round2(total / cuotasN), vence: addDays(fecha, 30 * (c + 1)) })),
      }], contactId)
    }
    // Constructora Del Sur: cada 3 meses, 3 cuotas, cobradas en fecha
    if (k % 3 === 0) {
      const cuotas = await ventaCredito(14, cli.delSur, 0.25, 3)
      cuotas?.forEach((c, n) => cobros.push({ cuotas: [c], cuando: addDays(at(y, m, 14), 30 * (n + 1) + 2), accountId: banco.id }))
    }
    // Arq. Martínez: cada 4 meses, 2 cuotas; en la de diciembre (k = 5) la 2ª cuota se cobra solo a medias
    if (k % 4 === 1) {
      const cuotas = await ventaCredito(20, cli.martinez, 0.08, 2)
      if (cuotas) {
        cobros.push({ cuotas: [cuotas[0]], cuando: addDays(at(y, m, 20), 32), accountId: mp.id })
        cobros.push({ cuotas: [cuotas[1]], cuando: addDays(at(y, m, 20), 62), monto: k === 5 ? round2(cuotas[1].saldo / 2) : undefined, accountId: mp.id })
      }
    }
    // Juan Pérez: una compra a 30 días, cobrada → cliente saldado
    if (k === 3) {
      const cuotas = await ventaCredito(8, cli.perez, 0.02, 1)
      if (cuotas) cobros.push({ cuotas, cuando: addDays(at(y, m, 8), 28), accountId: efectivo.id })
    }
    // Obras Norte SRL: hace 2 meses, 2 cuotas; la primera ya venció y no se cobró
    if (at(y, m + 2, 1) > NOW && at(y, m + 1, 1) <= NOW) await ventaCredito(5, cli.obrasNorte, 0.1, 2)

    // Gastos del mes: sueldos por empleado, alquiler, publicidad e impuestos
    const gastos: [number, string, string | null, number, string, string][] = [
      [5, 'Sueldos', empleados[0], 1_150_000, banco.id, 'Sueldo Martín'],
      [5, 'Sueldos', empleados[1], 1_050_000, banco.id, 'Sueldo Lucía'],
      [5, 'Sueldos', empleados[2], 980_000, banco.id, 'Sueldo Carlos'],
      [10, 'Alquiler', null, 1_300_000, banco.id, 'Alquiler galpón'],
      [15, 'Publicidad', null, 180_000, mp.id, 'Publicidad Instagram'],
      [20, 'Impuestos', 'IIBB', 420_000, banco.id, 'Ingresos brutos'],
      [20, 'Impuestos', 'Tasa municipal', 95_000, efectivo.id, 'Tasa de seguridad e higiene'],
    ]
    for (const [dia, cat, sub, base, cuenta, desc] of gastos) {
      const fecha = at(y, m, dia)
      if (isPast(fecha)) await gasto(cat, sub, Math.round(base * f * (0.97 + rand() * 0.06) / 100) * 100, cuenta, fecha, desc)
    }

    // Bienes de uso: camioneta en enero (anticipo + 6 cuotas), heladera vendida en junio
    if (m === 1 && isPast(at(y, 1, 15))) {
      camionetaCuotas = await compraCamioneta(at(y, 1, 15))
      camionetaCuotas.forEach((c, n) => pagosProv.push({ cuotas: [c], cuando: addDays(at(y, 1, 15), 30 * (n + 1)), accountId: banco.id }))
    }
    if (m === 6 && isPast(at(y, 6, 18))) await ventaHeladera(at(y, 6, 18))

    // Cajas: compra de dólares (octubre y marzo), faltante (noviembre) y sobrante (abril)
    if ((m === 10 || m === 3) && isPast(at(y, m, 17))) {
      const cotizacion = m === 10 ? 1450 : 1190
      await cambioDeCaja(at(y, m, 17), banco.id, usd.id, 1000 * cotizacion, 1000, 'Compra de dólares', cotizacion)
    }
    if (m === 11 && isPast(at(y, 11, 29))) await diferenciaDeCaja(at(y, 11, 29), efectivo.id, -15_000)
    if (m === 4 && isPast(at(y, 4, 30))) await diferenciaDeCaja(at(y, 4, 30), efectivo.id, 8_500)

    // Depósitos de fin de mes: efectivo y Mercado Pago al banco, dejando un fondo
    const deposito = at(y, m, 28)
    if (isPast(deposito)) {
      for (const [cuenta, fondo, base] of [[efectivo.id, 800_000, opening.efectivo], [mp.id, 300_000, opening.mp]] as const) {
        const disponible = saldo[cuenta] + base - fondo
        if (disponible > 200_000) await cambioDeCaja(deposito, cuenta, banco.id, Math.round(disponible / 1000) * 1000, Math.round(disponible / 1000) * 1000, 'Depósito en banco')
      }
    }
  }

  // Cobros y pagos pendientes cuya fecha ya pasó (en orden)
  for (const c of [...cobros, ...pagosProv].sort((a, b) => a.cuando.getTime() - b.cuando.getTime())) {
    if (!isPast(c.cuando)) continue
    const monto = c.monto ?? c.cuotas.reduce((s, q) => s + q.saldo, 0)
    if (monto > 0) await saldar(c.cuotas, monto, c.cuando, c.accountId)
  }

  // ── Estado final: stock, costos y saldos ──────────────────────────────────────────
  const kFinal = (NOW.getFullYear() - START_YEAR) * 12 + NOW.getMonth() + 1 - START_MONTH
  for (const p of estado) {
    await prisma.producto.update({ where: { id: p.id }, data: { stockActual: p.stock, precioCosto: round2(p.cpp), precioVenta: Math.round(p.def.venta * inflacion(kFinal) / 10) * 10 } })
  }
  for (const [id, delta] of Object.entries(saldo)) {
    await prisma.account.update({ where: { id }, data: { currentBalance: { increment: round2(delta) } } })
  }

  console.log(`📦 ${operaciones} operaciones de productos · ${cobros.length} cobros y ${pagosProv.length} pagos programados`)
  console.log('✅ Seed completado. Usuario: demo@finarg.com')
}

main()
  .then(async () => { await prisma.$disconnect() })
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
