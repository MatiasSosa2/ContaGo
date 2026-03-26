// prisma/seed.ts
import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import bcrypt from 'bcryptjs'
import * as dotenv from 'dotenv'
dotenv.config()

function buildPrisma() {
  const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL
  if (url && (url.startsWith('libsql') || url.startsWith('wss') || url.startsWith('https'))) {
    const authToken = process.env.TURSO_AUTH_TOKEN
    if (!authToken) throw new Error('TURSO_AUTH_TOKEN not set')
    const adapter = new PrismaLibSql({ url, authToken })
    return new PrismaClient({ adapter } as any)
  }
  return new PrismaClient()
}

const prisma = buildPrisma()

// Genera una fecha dentro de un mes dado
function d(year: number, month: number, day: number) {
  return new Date(year, month - 1, day)
}

async function main() {
  console.log('🌱 Iniciando seed...')

  // ──────────────────────────────────────────
  // Limpiar en orden (FK constraints)
  // ──────────────────────────────────────────
  await prisma.transaction.deleteMany()
  await prisma.movimientoStock.deleteMany()
  await prisma.producto.deleteMany()
  await prisma.contact.deleteMany()
  await prisma.areaNegocio.deleteMany()
  await prisma.category.deleteMany()
  await prisma.account.deleteMany()
  await prisma.businessMember.deleteMany()
  await prisma.business.deleteMany()
  await prisma.user.deleteMany()
  console.log('🗑️  BD limpia')

  // ──────────────────────────────────────────
  // 1. Usuario
  // ──────────────────────────────────────────
  const hashedPassword = await bcrypt.hash('Demo1234', 10)
  const user = await prisma.user.create({
    data: { email: 'demo@finarg.com', name: 'Usuario Demo', password: hashedPassword }
  })
  console.log(`👤 Usuario: ${user.email}`)

  // ──────────────────────────────────────────
  // 2. Negocio
  // ──────────────────────────────────────────
  const business = await prisma.business.create({
    data: {
      name: 'FinArg Demo S.A.',
      currency: 'ARS',
      members: { create: { userId: user.id, role: 'ADMIN' } }
    }
  })
  const bid = business.id
  console.log(`🏢 Negocio: ${business.name}`)

  // ──────────────────────────────────────────
  // 3. Cuentas
  // ──────────────────────────────────────────
  const caja = await prisma.account.create({
    data: { name: 'Caja Chica', type: 'CASH', currency: 'ARS', currentBalance: 280000, businessId: bid }
  })
  const banco = await prisma.account.create({
    data: { name: 'Banco Galicia', type: 'BANK', currency: 'ARS', currentBalance: 8400000, businessId: bid }
  })
  const usd = await prisma.account.create({
    data: { name: 'Caja Ahorro USD', type: 'BANK', currency: 'USD', currentBalance: 4200, businessId: bid }
  })
  console.log('💰 Cuentas creadas')

  // ──────────────────────────────────────────
  // 4. Categorías
  // ──────────────────────────────────────────
  const catDefs = [
    { name: 'Ventas Servicios',    type: 'INCOME'  },
    { name: 'Alquileres Cobrados', type: 'INCOME'  },
    { name: 'Otros Ingresos',      type: 'INCOME'  },
    { name: 'Sueldos',             type: 'EXPENSE' },
    { name: 'Alquiler Oficina',    type: 'EXPENSE' },
    { name: 'Servicios (Luz/Gas)', type: 'EXPENSE' },
    { name: 'Publicidad',          type: 'EXPENSE' },
    { name: 'Retiros Socios',      type: 'EXPENSE' },
    { name: 'Materiales',          type: 'EXPENSE' },
    { name: 'Impuestos',           type: 'EXPENSE' },
  ]
  const cats: Record<string, string> = {}
  for (const c of catDefs) {
    const r = await prisma.category.create({ data: { ...c, businessId: bid } })
    cats[c.name] = r.id
  }
  console.log('🏷️  Categorías creadas')

  // ──────────────────────────────────────────
  // 5. Áreas de negocio
  // ──────────────────────────────────────────
  const aComercial = await prisma.areaNegocio.create({ data: { nombre: 'Comercial',     businessId: bid } })
  const aAdmin     = await prisma.areaNegocio.create({ data: { nombre: 'Administración', businessId: bid } })
  const aOps       = await prisma.areaNegocio.create({ data: { nombre: 'Operaciones',   businessId: bid } })

  // ──────────────────────────────────────────
  // 6. Contactos
  // ──────────────────────────────────────────
  const cli1 = await prisma.contact.create({ data: { name: 'Grupo Meridian S.A.',   type: 'CLIENT',   businessId: bid } })
  const cli2 = await prisma.contact.create({ data: { name: 'Constructora Del Sur',  type: 'CLIENT',   businessId: bid } })
  const cli3 = await prisma.contact.create({ data: { name: 'Farmacia El Sol',       type: 'CLIENT',   businessId: bid } })
  const prov1 = await prisma.contact.create({ data: { name: 'Servicios Tech SRL',   type: 'SUPPLIER', businessId: bid } })
  const prov2 = await prisma.contact.create({ data: { name: 'Distribuidora Norte',  type: 'SUPPLIER', businessId: bid } })
  console.log('👥 Contactos creados')

  // ──────────────────────────────────────────
  // 7. Transacciones — 6 meses (Oct 2025 → Mar 2026)
  // Cada mes: ingresos variados + gastos fijos + gastos variables
  // ──────────────────────────────────────────

  type TxDef = {
    date: Date; description: string; amount: number; currency?: string
    type: 'INCOME' | 'EXPENSE'; accountId: string; categoryId: string
    contactId?: string; areaNegocioId?: string
    esCredito?: boolean; estado?: string; fechaVencimiento?: Date
    exchangeRate?: number
  }

  const txs: TxDef[] = [

    // ── OCTUBRE 2025 ──────────────────────────────────────────
    { date: d(2025,10, 2), description: 'Servicio Consultoría — Meridian Oct',  amount: 2800000, type: 'INCOME',  accountId: banco.id, categoryId: cats['Ventas Servicios'],    contactId: cli1.id,  areaNegocioId: aComercial.id, estado: 'COBRADO' },
    { date: d(2025,10, 5), description: 'Alquiler Octubre — Local A',           amount:  480000, type: 'INCOME',  accountId: caja.id,  categoryId: cats['Alquileres Cobrados'],                        areaNegocioId: aComercial.id, estado: 'COBRADO' },
    { date: d(2025,10, 8), description: 'Sueldos Oct',                          amount: 1200000, type: 'EXPENSE', accountId: banco.id, categoryId: cats['Sueldos'],                                   areaNegocioId: aAdmin.id,     estado: 'PAGADO'  },
    { date: d(2025,10,10), description: 'Alquiler Oficina Oct',                 amount:  420000, type: 'EXPENSE', accountId: banco.id, categoryId: cats['Alquiler Oficina'],   contactId: prov1.id, areaNegocioId: aAdmin.id,     estado: 'PAGADO'  },
    { date: d(2025,10,15), description: 'Servicios básicos Oct',                amount:   95000, type: 'EXPENSE', accountId: caja.id,  categoryId: cats['Servicios (Luz/Gas)'],                       areaNegocioId: aAdmin.id,     estado: 'PAGADO'  },
    { date: d(2025,10,18), description: 'Pauta publicitaria Google',            amount:  150000, type: 'EXPENSE', accountId: banco.id, categoryId: cats['Publicidad'],                                areaNegocioId: aComercial.id, estado: 'PAGADO'  },
    { date: d(2025,10,22), description: 'Venta producto Del Sur Oct',           amount:  650000, type: 'INCOME',  accountId: banco.id, categoryId: cats['Ventas Servicios'],    contactId: cli2.id,  areaNegocioId: aOps.id,       estado: 'COBRADO' },
    { date: d(2025,10,28), description: 'Compra materiales',                    amount:  210000, type: 'EXPENSE', accountId: caja.id,  categoryId: cats['Materiales'],          contactId: prov2.id, areaNegocioId: aOps.id,       estado: 'PAGADO'  },
    { date: d(2025,10,30), description: 'Impuesto Ingresos Brutos Oct',         amount:  185000, type: 'EXPENSE', accountId: banco.id, categoryId: cats['Impuestos'],                                 areaNegocioId: aAdmin.id,     estado: 'PAGADO'  },

    // ── NOVIEMBRE 2025 ──────────────────────────────────────────
    { date: d(2025,11, 3), description: 'Servicio Consultoría — Meridian Nov',  amount: 3100000, type: 'INCOME',  accountId: banco.id, categoryId: cats['Ventas Servicios'],    contactId: cli1.id,  areaNegocioId: aComercial.id, estado: 'COBRADO' },
    { date: d(2025,11, 5), description: 'Alquiler Nov — Local A',               amount:  480000, type: 'INCOME',  accountId: caja.id,  categoryId: cats['Alquileres Cobrados'],                        areaNegocioId: aComercial.id, estado: 'COBRADO' },
    { date: d(2025,11, 8), description: 'Sueldos Nov',                          amount: 1200000, type: 'EXPENSE', accountId: banco.id, categoryId: cats['Sueldos'],                                   areaNegocioId: aAdmin.id,     estado: 'PAGADO'  },
    { date: d(2025,11,10), description: 'Alquiler Oficina Nov',                 amount:  420000, type: 'EXPENSE', accountId: banco.id, categoryId: cats['Alquiler Oficina'],   contactId: prov1.id, areaNegocioId: aAdmin.id,     estado: 'PAGADO'  },
    { date: d(2025,11,12), description: 'Servicios básicos Nov',                amount:  102000, type: 'EXPENSE', accountId: caja.id,  categoryId: cats['Servicios (Luz/Gas)'],                       areaNegocioId: aAdmin.id,     estado: 'PAGADO'  },
    { date: d(2025,11,14), description: 'Farmacia El Sol — proyecto',           amount:  920000, type: 'INCOME',  accountId: banco.id, categoryId: cats['Ventas Servicios'],    contactId: cli3.id,  areaNegocioId: aOps.id,       estado: 'COBRADO' },
    { date: d(2025,11,20), description: 'Publicidad — campaña Black Friday',    amount:  280000, type: 'EXPENSE', accountId: banco.id, categoryId: cats['Publicidad'],                                areaNegocioId: aComercial.id, estado: 'PAGADO'  },
    { date: d(2025,11,25), description: 'Compra materiales Nov',                amount:  175000, type: 'EXPENSE', accountId: caja.id,  categoryId: cats['Materiales'],          contactId: prov2.id, areaNegocioId: aOps.id,       estado: 'PAGADO'  },
    { date: d(2025,11,28), description: 'Impuesto IIBB Nov',                    amount:  200000, type: 'EXPENSE', accountId: banco.id, categoryId: cats['Impuestos'],                                 areaNegocioId: aAdmin.id,     estado: 'PAGADO'  },
    { date: d(2025,11,29), description: 'Retiro socios Nov',                    amount:  400000, type: 'EXPENSE', accountId: banco.id, categoryId: cats['Retiros Socios'],                            areaNegocioId: aAdmin.id,     estado: 'PAGADO'  },

    // ── DICIEMBRE 2025 ──────────────────────────────────────────
    { date: d(2025,12, 2), description: 'Consultoría Meridian Dic',             amount: 3400000, type: 'INCOME',  accountId: banco.id, categoryId: cats['Ventas Servicios'],    contactId: cli1.id,  areaNegocioId: aComercial.id, estado: 'COBRADO' },
    { date: d(2025,12, 5), description: 'Alquiler Dic — Local A',               amount:  480000, type: 'INCOME',  accountId: caja.id,  categoryId: cats['Alquileres Cobrados'],                        areaNegocioId: aComercial.id, estado: 'COBRADO' },
    { date: d(2025,12, 6), description: 'Bonus fin de año — Del Sur',           amount:  750000, type: 'INCOME',  accountId: banco.id, categoryId: cats['Ventas Servicios'],    contactId: cli2.id,  areaNegocioId: aComercial.id, estado: 'COBRADO' },
    { date: d(2025,12, 8), description: 'Sueldos Dic + Aguinaldo',              amount: 2400000, type: 'EXPENSE', accountId: banco.id, categoryId: cats['Sueldos'],                                   areaNegocioId: aAdmin.id,     estado: 'PAGADO'  },
    { date: d(2025,12,10), description: 'Alquiler Oficina Dic',                 amount:  420000, type: 'EXPENSE', accountId: banco.id, categoryId: cats['Alquiler Oficina'],   contactId: prov1.id, areaNegocioId: aAdmin.id,     estado: 'PAGADO'  },
    { date: d(2025,12,15), description: 'Servicios básicos Dic',                amount:  118000, type: 'EXPENSE', accountId: caja.id,  categoryId: cats['Servicios (Luz/Gas)'],                       areaNegocioId: aAdmin.id,     estado: 'PAGADO'  },
    { date: d(2025,12,20), description: 'Publicidad — campaña Navidad',         amount:  320000, type: 'EXPENSE', accountId: banco.id, categoryId: cats['Publicidad'],                                areaNegocioId: aComercial.id, estado: 'PAGADO'  },
    { date: d(2025,12,22), description: 'Compra materiales Dic',                amount:  290000, type: 'EXPENSE', accountId: caja.id,  categoryId: cats['Materiales'],          contactId: prov2.id, areaNegocioId: aOps.id,       estado: 'PAGADO'  },
    { date: d(2025,12,26), description: 'Impuesto IIBB Dic',                    amount:  210000, type: 'EXPENSE', accountId: banco.id, categoryId: cats['Impuestos'],                                 areaNegocioId: aAdmin.id,     estado: 'PAGADO'  },
    { date: d(2025,12,30), description: 'Retiro socios año nuevo',              amount:  600000, type: 'EXPENSE', accountId: banco.id, categoryId: cats['Retiros Socios'],                            areaNegocioId: aAdmin.id,     estado: 'PAGADO'  },

    // ── ENERO 2026 ──────────────────────────────────────────
    { date: d(2026, 1, 4), description: 'Servicio Consultoría — Meridian Ene',  amount: 2600000, type: 'INCOME',  accountId: banco.id, categoryId: cats['Ventas Servicios'],    contactId: cli1.id,  areaNegocioId: aComercial.id, estado: 'COBRADO' },
    { date: d(2026, 1, 6), description: 'Alquiler Ene — Local A',               amount:  520000, type: 'INCOME',  accountId: caja.id,  categoryId: cats['Alquileres Cobrados'],                        areaNegocioId: aComercial.id, estado: 'COBRADO' },
    { date: d(2026, 1, 8), description: 'Sueldos Ene',                          amount: 1350000, type: 'EXPENSE', accountId: banco.id, categoryId: cats['Sueldos'],                                   areaNegocioId: aAdmin.id,     estado: 'PAGADO'  },
    { date: d(2026, 1,10), description: 'Alquiler Oficina Ene',                 amount:  460000, type: 'EXPENSE', accountId: banco.id, categoryId: cats['Alquiler Oficina'],   contactId: prov1.id, areaNegocioId: aAdmin.id,     estado: 'PAGADO'  },
    { date: d(2026, 1,14), description: 'Servicios básicos Ene',                amount:  130000, type: 'EXPENSE', accountId: caja.id,  categoryId: cats['Servicios (Luz/Gas)'],                       areaNegocioId: aAdmin.id,     estado: 'PAGADO'  },
    { date: d(2026, 1,18), description: 'Farmacia El Sol — mantenimiento',      amount:  480000, type: 'INCOME',  accountId: banco.id, categoryId: cats['Ventas Servicios'],    contactId: cli3.id,  areaNegocioId: aOps.id,       estado: 'COBRADO' },
    { date: d(2026, 1,20), description: 'Publicidad Ene',                       amount:  160000, type: 'EXPENSE', accountId: banco.id, categoryId: cats['Publicidad'],                                areaNegocioId: aComercial.id, estado: 'PAGADO'  },
    { date: d(2026, 1,22), description: 'Compra materiales Ene',                amount:  185000, type: 'EXPENSE', accountId: caja.id,  categoryId: cats['Materiales'],          contactId: prov2.id, areaNegocioId: aOps.id,       estado: 'PAGADO'  },
    { date: d(2026, 1,28), description: 'Impuesto IIBB Ene',                    amount:  220000, type: 'EXPENSE', accountId: banco.id, categoryId: cats['Impuestos'],                                 areaNegocioId: aAdmin.id,     estado: 'PAGADO'  },
    // Crédito pendiente — aparece en el semáforo
    { date: d(2026, 1,15), description: 'Factura Del Sur pendiente cobro',      amount:  850000, type: 'INCOME',  accountId: banco.id, categoryId: cats['Ventas Servicios'],    contactId: cli2.id,  areaNegocioId: aComercial.id, esCredito: true, estado: 'PENDIENTE', fechaVencimiento: d(2026,2,15) },

    // ── FEBRERO 2026 ──────────────────────────────────────────
    { date: d(2026, 2, 3), description: 'Consultoría Meridian Feb',             amount: 3200000, type: 'INCOME',  accountId: banco.id, categoryId: cats['Ventas Servicios'],    contactId: cli1.id,  areaNegocioId: aComercial.id, estado: 'COBRADO' },
    { date: d(2026, 2, 5), description: 'Alquiler Feb — Local A',               amount:  520000, type: 'INCOME',  accountId: caja.id,  categoryId: cats['Alquileres Cobrados'],                        areaNegocioId: aComercial.id, estado: 'COBRADO' },
    { date: d(2026, 2, 8), description: 'Sueldos Feb',                          amount: 1350000, type: 'EXPENSE', accountId: banco.id, categoryId: cats['Sueldos'],                                   areaNegocioId: aAdmin.id,     estado: 'PAGADO'  },
    { date: d(2026, 2,10), description: 'Alquiler Oficina Feb',                 amount:  460000, type: 'EXPENSE', accountId: banco.id, categoryId: cats['Alquiler Oficina'],   contactId: prov1.id, areaNegocioId: aAdmin.id,     estado: 'PAGADO'  },
    { date: d(2026, 2,12), description: 'Servicios básicos Feb',                amount:  140000, type: 'EXPENSE', accountId: caja.id,  categoryId: cats['Servicios (Luz/Gas)'],                       areaNegocioId: aAdmin.id,     estado: 'PAGADO'  },
    { date: d(2026, 2,15), description: 'Publicidad Feb',                       amount:  175000, type: 'EXPENSE', accountId: banco.id, categoryId: cats['Publicidad'],                                areaNegocioId: aComercial.id, estado: 'PAGADO'  },
    { date: d(2026, 2,18), description: 'Farmacia El Sol — feb',                amount:  560000, type: 'INCOME',  accountId: banco.id, categoryId: cats['Ventas Servicios'],    contactId: cli3.id,  areaNegocioId: aOps.id,       estado: 'COBRADO' },
    { date: d(2026, 2,20), description: 'Compra materiales Feb',                amount:  240000, type: 'EXPENSE', accountId: caja.id,  categoryId: cats['Materiales'],          contactId: prov2.id, areaNegocioId: aOps.id,       estado: 'PAGADO'  },
    { date: d(2026, 2,25), description: 'Impuesto IIBB Feb',                    amount:  230000, type: 'EXPENSE', accountId: banco.id, categoryId: cats['Impuestos'],                                 areaNegocioId: aAdmin.id,     estado: 'PAGADO'  },
    { date: d(2026, 2,28), description: 'Retiro socios Feb',                    amount:  500000, type: 'EXPENSE', accountId: banco.id, categoryId: cats['Retiros Socios'],                            areaNegocioId: aAdmin.id,     estado: 'PAGADO'  },
    // Crédito vencido — aparece en rojo en el semáforo
    { date: d(2026, 1,20), description: 'Deuda proveedor Norte (vencida)',      amount:  320000, type: 'EXPENSE', accountId: banco.id, categoryId: cats['Materiales'],          contactId: prov2.id, areaNegocioId: aOps.id,       esCredito: true, estado: 'VENCIDO',  fechaVencimiento: d(2026,2, 1) },

    // ── MARZO 2026 (mes actual, parcial) ──────────────────────────────────────────
    { date: d(2026, 3, 2), description: 'Consultoría Meridian Mar',             amount: 3500000, type: 'INCOME',  accountId: banco.id, categoryId: cats['Ventas Servicios'],    contactId: cli1.id,  areaNegocioId: aComercial.id, estado: 'COBRADO' },
    { date: d(2026, 3, 4), description: 'Alquiler Mar — Local A',               amount:  520000, type: 'INCOME',  accountId: caja.id,  categoryId: cats['Alquileres Cobrados'],                        areaNegocioId: aComercial.id, estado: 'COBRADO' },
    { date: d(2026, 3, 6), description: 'Sueldos Mar',                          amount: 1350000, type: 'EXPENSE', accountId: banco.id, categoryId: cats['Sueldos'],                                   areaNegocioId: aAdmin.id,     estado: 'PAGADO'  },
    { date: d(2026, 3, 8), description: 'Alquiler Oficina Mar',                 amount:  460000, type: 'EXPENSE', accountId: banco.id, categoryId: cats['Alquiler Oficina'],   contactId: prov1.id, areaNegocioId: aAdmin.id,     estado: 'PAGADO'  },
    { date: d(2026, 3,10), description: 'Servicios básicos Mar',                amount:  145000, type: 'EXPENSE', accountId: caja.id,  categoryId: cats['Servicios (Luz/Gas)'],                       areaNegocioId: aAdmin.id,     estado: 'PAGADO'  },
    { date: d(2026, 3,12), description: 'Del Sur — proyecto Marzo',             amount: 1100000, type: 'INCOME',  accountId: banco.id, categoryId: cats['Ventas Servicios'],    contactId: cli2.id,  areaNegocioId: aComercial.id, estado: 'COBRADO' },
    { date: d(2026, 3,13), description: 'Publicidad Mar',                       amount:  190000, type: 'EXPENSE', accountId: banco.id, categoryId: cats['Publicidad'],                                areaNegocioId: aComercial.id, estado: 'PAGADO'  },
    { date: d(2026, 3,14), description: 'Farmacia El Sol — marzo',              amount:  680000, type: 'INCOME',  accountId: banco.id, categoryId: cats['Ventas Servicios'],    contactId: cli3.id,  areaNegocioId: aOps.id,       estado: 'COBRADO' },
    { date: d(2026, 3,14), description: 'Compra materiales Mar',                amount:  210000, type: 'EXPENSE', accountId: caja.id,  categoryId: cats['Materiales'],          contactId: prov2.id, areaNegocioId: aOps.id,       estado: 'PAGADO'  },
    // Crédito pendiente actual
    { date: d(2026, 3,10), description: 'Factura Meridian — cobro pendiente',   amount: 1200000, type: 'INCOME',  accountId: banco.id, categoryId: cats['Ventas Servicios'],    contactId: cli1.id,  areaNegocioId: aComercial.id, esCredito: true, estado: 'PENDIENTE', fechaVencimiento: d(2026,3,31) },
  ]

  let count = 0
  for (const tx of txs) {
    await prisma.transaction.create({ data: { ...tx, currency: tx.currency ?? 'ARS', businessId: bid } })
    count++
  }
  console.log(`📊 ${count} transacciones creadas`)

  // ──────────────────────────────────────────
  // 8. Productos con movimientos de stock
  // ──────────────────────────────────────────
  const prod1 = await prisma.producto.create({
    data: { nombre: 'Consultoría por Hora', categoria: 'Servicios', precioVenta: 55000, precioCosto: 20000, unidad: 'hora', stockActual: 120, businessId: bid }
  })
  const prod2 = await prisma.producto.create({
    data: { nombre: 'Licencia Software Anual', categoria: 'Software', precioVenta: 480000, precioCosto: 150000, unidad: 'licencia', stockActual: 15, businessId: bid }
  })
  const prod3 = await prisma.producto.create({
    data: { nombre: 'Kit Materiales', categoria: 'Insumos', precioVenta: 85000, precioCosto: 42000, unidad: 'kit', stockActual: 40, businessId: bid }
  })

  await prisma.movimientoStock.createMany({ data: [
    { tipo: 'ENTRADA', cantidad: 50,  precio: 20000, motivo: 'Compra inicial', productoId: prod1.id },
    { tipo: 'SALIDA',  cantidad: 20,  precio: 55000, motivo: 'Venta Mar',      productoId: prod1.id },
    { tipo: 'ENTRADA', cantidad: 20,  precio: 150000,motivo: 'Compra stock',   productoId: prod2.id },
    { tipo: 'SALIDA',  cantidad:  5,  precio: 480000,motivo: 'Venta Ene',      productoId: prod2.id },
    { tipo: 'ENTRADA', cantidad: 60,  precio:  42000,motivo: 'Reposición',     productoId: prod3.id },
    { tipo: 'SALIDA',  cantidad: 20,  precio:  85000,motivo: 'Venta Feb-Mar',  productoId: prod3.id },
  ]})
  console.log('📦 Productos y stock creados')

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