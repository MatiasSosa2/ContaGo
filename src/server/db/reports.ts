/**
 * Informes: estado de resultados, estado patrimonial, serie anual, rankings y datos de reportes.
 * Las expone src/app/actions.ts (que elige entre datos reales y demo).
 */

import prisma from '@/lib/prisma'
import { unstable_cache } from 'next/cache'
import { getIncomeStatementData } from '@/server/results/income-statement'
import { getYearlySeriesData } from '@/server/reports/yearly-series'
import { getBalanceSheetData } from '@/server/balance/balance-sheet'
import { getReportInsightsData } from '@/server/reports/insights'
import { getBusinessId, type DateRange, type DashboardPeriodKey, computePeriodRange } from './shared'

export async function getReportData(range?: DateRange) {
  const businessId = await getBusinessId()
  const dateFilter = range?.from || range?.to
    ? { date: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) } }
    : {}
  const allTx = await prisma.transaction.findMany({
    where: { businessId, ...dateFilter },
    orderBy: { date: 'desc' },
    include: { category: true, subcategory: { select: { name: true } }, account: true, contact: true, areaNegocio: true },
  })

  // -- Totales por moneda --
  const totalsByCurrency: Record<string, { income: number; expense: number }> = {}
  for (const tx of allTx) {
    const cur = tx.currency || 'ARS'
    if (!totalsByCurrency[cur]) totalsByCurrency[cur] = { income: 0, expense: 0 }
    if (tx.type === 'INCOME') totalsByCurrency[cur].income += tx.amount
    else totalsByCurrency[cur].expense += tx.amount
  }

  // -- Evolución mensual últimos 12 meses por moneda --
  const monthlyMap: Record<string, Record<string, { income: number; expense: number }>> = {}
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthlyMap[key] = {}
  }
  for (const tx of allTx) {
    const d = new Date(tx.date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!monthlyMap[key]) continue
    const cur = tx.currency || 'ARS'
    if (!monthlyMap[key][cur]) monthlyMap[key][cur] = { income: 0, expense: 0 }
    if (tx.type === 'INCOME') monthlyMap[key][cur].income += tx.amount
    else monthlyMap[key][cur].expense += tx.amount
  }
  const monthlyHistory = Object.entries(monthlyMap).map(([month, byCur]) => ({ month, byCur }))

  // -- Top categorías por gasto --
  const categoryMap: Record<string, { name: string; income: number; expense: number; currency: string }> = {}
  for (const tx of allTx) {
    if (!tx.category) continue
    const id = tx.categoryId!
    if (!categoryMap[id]) categoryMap[id] = { name: tx.category.name, income: 0, expense: 0, currency: tx.currency || 'ARS' }
    if (tx.type === 'INCOME') categoryMap[id].income += tx.amount
    else categoryMap[id].expense += tx.amount
  }
  const topCategories = Object.values(categoryMap)
    .sort((a, b) => (b.income + b.expense) - (a.income + a.expense))
    .slice(0, 8)

  // -- Top contactos --
  const contactMap: Record<string, { name: string; income: number; expense: number; txCount: number }> = {}
  for (const tx of allTx) {
    if (!tx.contact) continue
    const id = tx.contactId!
    if (!contactMap[id]) contactMap[id] = { name: tx.contact.name, income: 0, expense: 0, txCount: 0 }
    if (tx.type === 'INCOME') contactMap[id].income += tx.amount
    else contactMap[id].expense += tx.amount
    contactMap[id].txCount++
  }
  const topContacts = Object.values(contactMap)
    .sort((a, b) => (b.income + b.expense) - (a.income + a.expense))
    .slice(0, 6)

  // -- Top áreas de negocio --
  const areaMap: Record<string, { nombre: string; income: number; expense: number }> = {}
  for (const tx of allTx) {
    if (!tx.areaNegocio) continue
    const id = tx.areaNegocioId!
    if (!areaMap[id]) areaMap[id] = { nombre: tx.areaNegocio.nombre, income: 0, expense: 0 }
    if (tx.type === 'INCOME') areaMap[id].income += tx.amount
    else areaMap[id].expense += tx.amount
  }
  const topAreas = Object.values(areaMap)
    .sort((a, b) => (b.income + b.expense) - (a.income + a.expense))

  // -- Balance real de cuentas (para Runway) --
  const accounts = await prisma.account.findMany({ where: { businessId } })
  const accountTotalByCurrency = accounts.reduce((acc, a) => {
    const c = a.currency || 'ARS'
    acc[c] = (acc[c] || 0) + a.currentBalance
    return acc
  }, {} as Record<string, number>)

  return { allTx, totalsByCurrency, monthlyHistory, topCategories, topContacts, topAreas, accountTotalByCurrency }
}

/** Top clientes y productos que más ganan del período (pestaña Informes). Ver src/server/reports/insights.ts */
export async function getReportInsights(
  period: DashboardPeriodKey,
  customFrom?: string,
  customTo?: string,
  selectedYear?: number,
  selectedMonth?: number,
  selectedDay?: string,
  selectedWeekStart?: string,
) {
  const businessId = await getBusinessId()
  const { from, to } = computePeriodRange(period, customFrom, customTo, selectedYear, selectedMonth, selectedDay, selectedWeekStart)
  return getReportInsightsData(businessId, from, to)
}

/**
 * Estado patrimonial al cierre del período y al cierre anterior (para comparar).
 * Ver src/server/balance/balance-sheet.ts
 */
export async function getBalanceSheet(
  period: DashboardPeriodKey,
  customFrom?: string,
  customTo?: string,
  selectedYear?: number,
  selectedMonth?: number,
  selectedDay?: string,
  selectedWeekStart?: string,
) {
  const businessId = await getBusinessId()
  const { from, to } = computePeriodRange(period, customFrom, customTo, selectedYear, selectedMonth, selectedDay, selectedWeekStart)
  const [current, previous] = await Promise.all([
    getBalanceSheetData(businessId, to),
    getBalanceSheetData(businessId, new Date(from.getTime() - 1)),
  ])
  return { current, previous }
}

/** Datos del Estado de resultados del período (ver src/server/results/income-statement.ts). */
export async function getIncomeStatement(
  period: DashboardPeriodKey,
  customFrom?: string,
  customTo?: string,
  selectedYear?: number,
  selectedMonth?: number,
  selectedDay?: string,
  selectedWeekStart?: string,
  currency = 'ARS',
) {
  const businessId = await getBusinessId()
  const { from, to } = computePeriodRange(period, customFrom, customTo, selectedYear, selectedMonth, selectedDay, selectedWeekStart)
  return getIncomeStatementData(businessId, from, to, currency)
}

/** Series mes a mes (enero → diciembre) para los gráficos de los estados. */
export async function getYearlySeries(year: number, cashCurrency = 'ARS', accountId?: string) {
  const businessId = await getBusinessId()
  // La serie de 12 meses es la consulta más pesada de Informes: queda guardada y se recalcula
  // solo cuando se registra o cambia algo del negocio (tag dashboard:<negocio>). Sin datos que
  // cambien, igual se renueva cada 10 minutos (el mes en curso avanza con los días).
  const cached = unstable_cache(
    () => getYearlySeriesData(businessId, year, cashCurrency, accountId),
    ['yearly-series', businessId, String(year), cashCurrency, accountId ?? 'todas'],
    { revalidate: 600, tags: [`dashboard:${businessId}`] },
  )
  return cached()
}

export async function getReportDataExtended(range?: DateRange) {
  const businessId = await getBusinessId()
  const base = await getReportData(range)
  
  // Estado Patrimonial: cuentas como activos, créditos PENDIENTE como pasivos
  const cuentas = await prisma.account.findMany({ where: { businessId } })
  const creditosPendientes = await prisma.transaction.findMany({
    where: { businessId, esCredito: true, estado: { in: ['PENDIENTE', 'VENCIDO'] } },
  })
  const activosPorMoneda = cuentas.reduce((acc, c) => {
    const cur = c.currency || 'ARS'
    acc[cur] = (acc[cur] || 0) + c.currentBalance
    return acc
  }, {} as Record<string, number>)
  const pasivosPorMoneda = creditosPendientes.reduce((acc, t) => {
    const cur = t.currency || 'ARS'
    // CxP (debemos pagar) = EXPENSE pendiente
    if (t.type === 'EXPENSE') acc[cur] = (acc[cur] || 0) + t.amount
    return acc
  }, {} as Record<string, number>)
  const cxcPorMoneda = creditosPendientes.reduce((acc, t) => {
    const cur = t.currency || 'ARS'
    // CxC (nos deben cobrar) = INCOME pendiente
    if (t.type === 'INCOME') acc[cur] = (acc[cur] || 0) + t.amount
    return acc
  }, {} as Record<string, number>)

  // Flujo de Fondos: clasifica por categoría en Operativo / Inversión / Financiero
  const allTx = base.allTx
  const flujo: Record<string, { operativo: number; inversion: number; financiero: number }> = {}
  const inversionKeywords = ['inversion', 'equipo', 'activo', 'infraestructura', 'maquinaria']
  const financieroKeywords = ['prestamo', 'credito', 'financiamiento', 'dividendo', 'capital']

  for (const tx of allTx) {
    const cur = tx.currency || 'ARS'
    if (!flujo[cur]) flujo[cur] = { operativo: 0, inversion: 0, financiero: 0 }
    const desc = (tx.description + ' ' + (tx.category?.name || '')).toLowerCase()
    const sign = tx.type === 'INCOME' ? 1 : -1
    const val = tx.amount * sign
    if (financieroKeywords.some(k => desc.includes(k))) flujo[cur].financiero += val
    else if (inversionKeywords.some(k => desc.includes(k))) flujo[cur].inversion += val
    else flujo[cur].operativo += val
  }

  // Resumen anual
  const anualMap: Record<string, Record<string, { income: number; expense: number }>> = {}
  const thisYear = new Date().getFullYear()
  for (let y = thisYear - 1; y <= thisYear; y++) {
    anualMap[String(y)] = {}
  }
  for (const tx of allTx) {
    const yr = String(new Date(tx.date).getFullYear())
    if (!anualMap[yr]) continue
    const cur = tx.currency || 'ARS'
    if (!anualMap[yr][cur]) anualMap[yr][cur] = { income: 0, expense: 0 }
    if (tx.type === 'INCOME') anualMap[yr][cur].income += tx.amount
    else anualMap[yr][cur].expense += tx.amount
  }

  // CMV: Costo de Mercadería Vendida = suma de salidas de stock * precio
  const salidasStock = await prisma.movimientoStock.findMany({
    where: {
      tipo: 'SALIDA',
      producto: { businessId },
      ...(range?.from || range?.to
        ? {
            fecha: {
              ...(range.from ? { gte: range.from } : {}),
              ...(range.to ? { lte: range.to } : {}),
            },
          }
        : {}),
    },
  })
  const cmvTotal = salidasStock.reduce((acc, m) => acc + m.cantidad * m.precio, 0)

  // Stock: inventario actual
  const productosActivos = await prisma.producto.findMany({ where: { businessId, activo: true } })
  const valorInventario = productosActivos.reduce((acc, p) => acc + p.stockActual * p.precioCosto, 0)
  const valorInventarioVenta = productosActivos.reduce((acc, p) => acc + p.stockActual * p.precioVenta, 0)
  const margenBrutoInventario = valorInventarioVenta - valorInventario
  // Top 5 productos por valor de stock
  const topProductosPorStock = [...productosActivos]
    .sort((a, b) => (b.stockActual * b.precioCosto) - (a.stockActual * a.precioCosto))
    .slice(0, 5)
    .map(p => ({ nombre: p.nombre, marca: p.marca, stockActual: p.stockActual, precioCosto: p.precioCosto, valorTotal: p.stockActual * p.precioCosto }))

  // Bienes de uso en el activo: valor de compra menos amortización, de los que siguen en uso
  const bienesActivos = await prisma.bienDeUso.findMany({ where: { businessId, activo: true }, select: { valorAdquisicion: true, depreciacionAcumulada: true } })
  const valorBienesUso = bienesActivos.reduce((acc, b) => acc + Math.max(0, b.valorAdquisicion - b.depreciacionAcumulada), 0)

  return { ...base, activosPorMoneda, pasivosPorMoneda, cxcPorMoneda, flujo, anualMap, cmvTotal, valorInventario, valorInventarioVenta, margenBrutoInventario, topProductosPorStock, valorBienesUso }
}

// ---- Dashboard: datos del día ----

