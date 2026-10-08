/**
 * Balance General (inicio): estadísticas del período, gráfico de evolución y foto de activos.
 * Las expone src/app/actions.ts (que elige entre datos reales y demo).
 */

import prisma from '@/lib/prisma'
import { unstable_cache } from 'next/cache'
import { CASH_ACCOUNT_TYPES } from '@/server/cash/cash-flow'
import { getBusinessId, type DashboardPeriodKey, computePeriodRange } from './shared'

const DASHBOARD_MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

/** Movimiento de caja del período, para filtrar el gráfico por categoría y ver el detalle de cada barra */
export interface DashboardChartTx {
  id: string
  type: string
  amount: number
  date: Date
  description: string
  /** Categoría legible (tipo del sistema o categoría propia) */
  category: string
  /** Subcategoría (si la tiene), para filtrar más fino en el gráfico */
  subcategory: string | null
  account: string | null
  /** Cliente / proveedor (para el detalle de cobros y pagos) */
  contact: string | null
  /** Ventas / compras de productos: lo que le toca de cada producto a este movimiento */
  items: { nombre: string; monto: number }[] | null
}

export interface DashboardStatsResult {
  kpis: { income: number; expense: number; gain: number; marginPct: number }
  prevKpis: { income: number; expense: number; gain: number; marginPct: number }
  /** txIdx: posiciones en chartTx de los movimientos de cada barra */
  chartData: { label: string; income: number; expense: number; net: number; txIdx: number[] }[]
  chartTx: DashboardChartTx[]
  categoryBreakdown: { name: string; value: number; color: string }[]
  incomeCategoryBreakdown: { name: string; value: number; color: string }[]
  recentTx: {
    id: string; description: string; amount: number; currency: string; type: string;
    date: Date; category?: { name: string } | null; account?: { name: string } | null;
  }[]
  sparklines: { income: number[]; expense: number[]; balance: number[] }
  debtStatus: {
    vencidos: { count: number; total: number }
    en48hs: { count: number; total: number }
    futuros: { count: number; total: number }
    totalPendiente: number
    creditosDeudas: { amount: number; estado: string; fechaVencimiento: Date | null }[]
  }
  alerts: { severity: 'danger' | 'warning'; icon: 'runway' | 'margin' | 'spike'; title: string; message: string }[]
  periodLabel: string
}

export interface DashboardMonthOption {
  year: number
  month: number
  label: string
  shortYear: string
  key: string
}

export interface DashboardPresetSummary {
  period: Exclude<DashboardPeriodKey, 'custom'>
  periodLabel: string
  income: number
  expense: number
  gain: number
  incomeChangePct: number | null
  expenseChangePct: number | null
  gainChangePct: number | null
}

export async function getDailyStats() {
  const businessId = await getBusinessId()
  const now = new Date()
  const inicioHoy = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
  const finHoy = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
  const txHoy = await prisma.transaction.findMany({
    where: { businessId, date: { gte: inicioHoy, lte: finHoy } },
    include: { category: true, account: true },
    orderBy: { date: 'desc' },
  })
  const byCurrency: Record<string, { income: number; expense: number; count: number }> = {}
  for (const tx of txHoy) {
    const currency = tx.currency || 'ARS'
    if (!byCurrency[currency]) byCurrency[currency] = { income: 0, expense: 0, count: 0 }
    if (tx.type === 'INCOME') byCurrency[currency].income += tx.amount
    else byCurrency[currency].expense += tx.amount
    byCurrency[currency].count++
  }
  return { txHoy, byCurrency }
}

function groupTransactions(
  txs: { date: Date; type: string; amount: number }[],
  period: DashboardPeriodKey,
  from: Date,
  to: Date
): { label: string; income: number; expense: number; net: number; txIdx: number[] }[] {
  const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

  // Decide grouping based on period or range duration
  const durationDays = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
  let mode: 'hour' | 'day' | 'month'
  if (period === 'diario') mode = 'hour'
  else if (period === 'semanal') mode = 'day'
  else if (period === 'mensual') mode = 'day'
  else if (period === 'anual') mode = 'month'
  else {
    // custom
    if (durationDays <= 2) mode = 'hour'
    else if (durationDays <= 62) mode = 'day'
    else mode = 'month'
  }

  // txIdx: posiciones de los movimientos de cada barra (para filtrar por categoría y ver el detalle)
  const buckets: Record<string, { label: string; income: number; expense: number; order: number; txIdx: number[] }> = {}

  if (mode === 'hour') {
    for (let h = 0; h < 24; h++) {
      const key = String(h)
      buckets[key] = { label: `${h}:00`, income: 0, expense: 0, order: h, txIdx: [] }
    }
    for (const [i, tx] of txs.entries()) {
      const d = new Date(tx.date)
      const key = String(d.getHours())
      if (buckets[key]) {
        buckets[key].txIdx.push(i)
        if (tx.type === 'INCOME') buckets[key].income += tx.amount
        else buckets[key].expense += tx.amount
      }
    }
  } else if (mode === 'day') {
    // Generate day buckets from `from` to `to`
    const cursor = new Date(from)
    let order = 0
    while (cursor <= to) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
      const lbl = period === 'semanal'
        ? DAY_LABELS[cursor.getDay()]
        : `${cursor.getDate()}/${cursor.getMonth() + 1}`
      buckets[key] = { label: lbl, income: 0, expense: 0, order: order++, txIdx: [] }
      cursor.setDate(cursor.getDate() + 1)
    }
    for (const [i, tx] of txs.entries()) {
      const d = new Date(tx.date)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      if (buckets[key]) {
        buckets[key].txIdx.push(i)
        if (tx.type === 'INCOME') buckets[key].income += tx.amount
        else buckets[key].expense += tx.amount
      }
    }
  } else {
    // month mode
    const cursor = new Date(from.getFullYear(), from.getMonth(), 1)
    const endMonth = new Date(to.getFullYear(), to.getMonth(), 1)
    let order = 0
    while (cursor <= endMonth) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
      buckets[key] = { label: MONTH_LABELS[cursor.getMonth()], income: 0, expense: 0, order: order++, txIdx: [] }
      cursor.setMonth(cursor.getMonth() + 1)
    }
    for (const [i, tx] of txs.entries()) {
      const d = new Date(tx.date)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (buckets[key]) {
        buckets[key].txIdx.push(i)
        if (tx.type === 'INCOME') buckets[key].income += tx.amount
        else buckets[key].expense += tx.amount
      }
    }
  }

  return Object.values(buckets)
    .sort((a, b) => a.order - b.order)
    .map(b => ({ label: b.label, income: b.income, expense: b.expense, net: b.income - b.expense, txIdx: b.txIdx }))
}

function computeSparklines(
  txs: { date: Date; type: string; amount: number }[],
  period: DashboardPeriodKey,
  from: Date,
  to: Date
): { income: number[]; expense: number[]; balance: number[] } {
  // For sparklines we want 6 subdivisions of the period
  const NUM_POINTS = 6
  const totalMs = to.getTime() - from.getTime()
  const sliceMs = totalMs / NUM_POINTS

  const income: number[] = []
  const expense: number[] = []
  const balance: number[] = []

  for (let i = 0; i < NUM_POINTS; i++) {
    const sliceStart = from.getTime() + sliceMs * i
    const sliceEnd = from.getTime() + sliceMs * (i + 1)
    let inc = 0, exp = 0
    for (const tx of txs) {
      const t = new Date(tx.date).getTime()
      if (t >= sliceStart && t < sliceEnd) {
        if (tx.type === 'INCOME') inc += tx.amount
        else exp += tx.amount
      }
    }
    income.push(inc)
    expense.push(exp)
    balance.push(inc - exp)
  }

  return { income, expense, balance }
}

export async function getDashboardStats(
  period: DashboardPeriodKey,
  customFrom?: string,
  customTo?: string,
  selectedYear?: number,
  selectedMonth?: number,
  selectedDay?: string,
  selectedWeekStart?: string,
): Promise<DashboardStatsResult> {
  const businessId = await getBusinessId()

  // Cache key includes businessId + period params → safe per-tenant isolation.
  // Revalidates every 15 s so rapid tab switches hit memory, not Turso.
  const cacheKey = `dashboard:${businessId}:${period}:${customFrom ?? ''}:${customTo ?? ''}:${selectedYear ?? ''}:${selectedMonth ?? ''}:${selectedDay ?? ''}:${selectedWeekStart ?? ''}`
  const cached = unstable_cache(
    async () => _fetchDashboardStats(businessId, period, customFrom, customTo, selectedYear, selectedMonth, selectedDay, selectedWeekStart),
    [cacheKey],
    { revalidate: 15, tags: [`dashboard:${businessId}`] },
  )
  return cached()
}

// Nombres de las categorías del sistema en el gráfico del Balance general
const CHART_CATEGORY_BY_SUBTYPE: Record<string, string> = {
  SALE_PRODUCT: 'Venta de productos',
  SALE: 'Venta de productos',
  COBRO_CREDITO: 'Cobro de créditos',
  SALE_BIEN_USO: 'Venta de bienes de uso',
  PURCHASE_PRODUCT: 'Compra de productos',
  PURCHASE: 'Compra de productos',
  PAGO_DEUDA: 'Pago de deudas',
  PURCHASE_BIEN_USO: 'Compra de bienes de uso',
  DIFERENCIA_CAJA: 'Diferencia de caja',
}

async function _fetchDashboardStats(
  businessId: string,
  period: DashboardPeriodKey,
  customFrom?: string,
  customTo?: string,
  selectedYear?: number,
  selectedMonth?: number,
  selectedDay?: string,
  selectedWeekStart?: string,
): Promise<DashboardStatsResult> {
  const now = new Date()
  const { from, to, prevFrom, prevTo, label: periodLabel } = computePeriodRange(period, customFrom, customTo, selectedYear, selectedMonth, selectedDay, selectedWeekStart)

  // Solo lo que movió caja en pesos (mismo criterio que el Estado de flujo de efectivo):
  // sin ventas/compras a crédito hasta que se cobran/pagan, sin cuentas del sistema.
  const cashOnly = {
    esCredito: false,
    account: { isSystemAccount: false, type: { in: [...CASH_ACCOUNT_TYPES] }, currency: 'ARS' },
  }

  // ── Fetch current + previous period transactions in parallel ──
  // prevTxs only needs aggregates; creditosDeudas only needs amounts + status
  const [currentTxs, prevTxs, creditosDeudas] = await Promise.all([
    prisma.transaction.findMany({
      where: { businessId, date: { gte: from, lte: to }, ...cashOnly },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true, description: true, amount: true, currency: true,
        type: true, date: true, createdAt: true, subType: true,
        category: { select: { name: true } },
        subcategory: { select: { name: true } },
        account: { select: { name: true } },
        contact: { select: { name: true } },
        operacion: { select: { items: { select: { subtotal: true, producto: { select: { nombre: true } } } } } },
      },
    }),
    prisma.transaction.findMany({
      where: { businessId, date: { gte: prevFrom, lte: prevTo }, ...cashOnly },
      select: { amount: true, type: true },
    }),
    prisma.transaction.findMany({
      where: { businessId, esCredito: true, estado: { in: ['PENDIENTE', 'PARCIAL', 'VENCIDO'] } },
      select: {
        amount: true,
        estado: true,
        fechaVencimiento: true,
        cobrosAplicados: { where: { businessId }, select: { amount: true } },
      },
    }),
  ])

  // ── KPIs current period ──
  let curIncome = 0, curExpense = 0
  for (const tx of currentTxs) {
    if (tx.type === 'INCOME') curIncome += tx.amount
    else curExpense += tx.amount
  }
  const curGain = curIncome - curExpense
  const curMargin = curIncome > 0 ? (curGain / curIncome) * 100 : 0

  // ── KPIs previous period ──
  let prevIncome = 0, prevExpense = 0
  for (const tx of prevTxs) {
    if (tx.type === 'INCOME') prevIncome += tx.amount
    else prevExpense += tx.amount
  }
  const prevGain = prevIncome - prevExpense
  const prevMargin = prevIncome > 0 ? (prevGain / prevIncome) * 100 : 0

  // ── Chart data (grouped dynamically) ──
  const chartData = groupTransactions(currentTxs, period, from, to)
  const chartTx: DashboardChartTx[] = currentTxs.map((tx) => ({
    id: tx.id,
    type: tx.type,
    amount: tx.amount,
    date: tx.date,
    description: tx.description,
    category: CHART_CATEGORY_BY_SUBTYPE[tx.subType ?? ''] ?? tx.category?.name ?? (tx.type === 'INCOME' ? 'Otros ingresos' : 'Otros egresos'),
    subcategory: tx.subcategory?.name ?? null,
    account: tx.account?.name ?? null,
    contact: tx.contact?.name ?? null,
    // Una operación puede cobrarse en varias partes: cada parte se lleva su proporción de cada producto
    items: (() => {
      const items = tx.operacion?.items ?? []
      const suma = items.reduce((t, i) => t + i.subtotal, 0)
      if (items.length === 0 || suma <= 0) return null
      return items.map((i) => ({ nombre: i.producto.nombre, monto: (i.subtotal / suma) * tx.amount }))
    })(),
  }))

  // ── Sparklines ──
  const sparklines = computeSparklines(currentTxs, period, from, to)

  // ── Category breakdown (period) ──
  const CAT_COLORS = ['#3A4D39', '#C5A065', '#5A7A57', '#d4ae84', '#6b8f65', '#c49a6c']
  const catMap: Record<string, { name: string; value: number }> = {}
  for (const tx of currentTxs) {
    if (tx.type !== 'EXPENSE') continue
    const catName = tx.category?.name || 'Sin categoría'
    if (!catMap[catName]) catMap[catName] = { name: catName, value: 0 }
    catMap[catName].value += tx.amount
  }
  const categoryBreakdown = Object.values(catMap)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)
    .map((c, i) => ({ ...c, color: CAT_COLORS[i % CAT_COLORS.length] }))

  // ── Income category breakdown (period) ──
  const incCatMap: Record<string, { name: string; value: number }> = {}
  for (const tx of currentTxs) {
    if (tx.type !== 'INCOME') continue
    const catName = tx.category?.name || 'Sin categoría'
    if (!incCatMap[catName]) incCatMap[catName] = { name: catName, value: 0 }
    incCatMap[catName].value += tx.amount
  }
  const INCOME_COLORS = ['#2D6A4F', '#5A7A57', '#6b8f65', '#81a87e', '#a3c49e', '#c5dfb8']
  const incomeCategoryBreakdown = Object.values(incCatMap)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)
    .map((c, i) => ({ ...c, color: INCOME_COLORS[i % INCOME_COLORS.length] }))

  // ── Recent transactions (last 7 in period) ──
  const recentTx = currentTxs.slice(0, 7).map(tx => ({
    id: tx.id,
    description: tx.description,
    amount: tx.amount,
    currency: tx.currency,
    type: tx.type,
    date: tx.date,
    category: tx.category ? { name: tx.category.name } : null,
    account: tx.account ? { name: tx.account.name } : null,
  }))

  // ── Debt status (independent of period) ──
  const now48h = new Date(now.getTime() + 48 * 60 * 60 * 1000)
  const vencidos = creditosDeudas.filter(c =>
    c.estado === 'VENCIDO' || (c.fechaVencimiento && new Date(c.fechaVencimiento) < now && (c.estado === 'PENDIENTE' || c.estado === 'PARCIAL'))
  )
  const en48hs = creditosDeudas.filter(c =>
    (c.estado === 'PENDIENTE' || c.estado === 'PARCIAL') && c.fechaVencimiento && new Date(c.fechaVencimiento) >= now && new Date(c.fechaVencimiento) <= now48h
  )
  const futuros = creditosDeudas.filter(c =>
    (c.estado === 'PENDIENTE' || c.estado === 'PARCIAL') && (!c.fechaVencimiento || new Date(c.fechaVencimiento) > now48h)
  )
  const saldoDeuda = (credit: (typeof creditosDeudas)[number]) =>
    Math.max(0, credit.amount - credit.cobrosAplicados.reduce((sum, payment) => sum + payment.amount, 0))
  const debtStatus = {
    vencidos: { count: vencidos.length, total: vencidos.reduce((s, c) => s + saldoDeuda(c), 0) },
    en48hs: { count: en48hs.length, total: en48hs.reduce((s, c) => s + saldoDeuda(c), 0) },
    futuros: { count: futuros.length, total: futuros.reduce((s, c) => s + saldoDeuda(c), 0) },
    totalPendiente: creditosDeudas.reduce((sum, credit) => sum + saldoDeuda(credit), 0),
    creditosDeudas,
  }

  // Alerts deshabilitadas a pedido (no se muestran en el Balance General)
  const alerts: DashboardStatsResult['alerts'] = []

  return {
    kpis: { income: curIncome, expense: curExpense, gain: curGain, marginPct: curMargin },
    prevKpis: { income: prevIncome, expense: prevExpense, gain: prevGain, marginPct: prevMargin },
    chartData,
    chartTx,
    categoryBreakdown,
    incomeCategoryBreakdown,
    recentTx,
    sparklines,
    debtStatus,
    alerts,
    periodLabel,
  }
}

// ---- Cajas: datos completos para la pestaña Cajas ----

// Snapshot acumulado de activos al cierre del período seleccionado
export interface AssetSnapshot {
  cajaTotal: number
  totalACobrar: number
  totalAPagar: number
  stockTotal: number
  bienesTotal: number
  cmvPeriod: number
  prev: {
    cajaTotal: number
    totalACobrar: number
    totalAPagar: number
    stockTotal: number
    bienesTotal: number
    cmvPeriod: number
  }
}

export async function getAssetSnapshotAsOf(
  period: DashboardPeriodKey,
  customFrom?: string,
  customTo?: string,
  selectedYear?: number,
  selectedMonth?: number,
  selectedDay?: string,
  selectedWeekStart?: string,
): Promise<AssetSnapshot> {
  const businessId = await getBusinessId()
  const { from: periodStart, to: periodEnd, prevFrom, prevTo } = computePeriodRange(period, customFrom, customTo, selectedYear, selectedMonth, selectedDay, selectedWeekStart)

  // Helper interno: computa un snapshot para (start, end) con queries en paralelo
  async function computeSnapshot(start: Date, end: Date) {
    const [txAggregates, creditosAbiertos, productos, bienesAggregate, salidasPeriodo] = await Promise.all([
      prisma.transaction.groupBy({
        by: ['type'],
        where: { businessId, date: { lte: end } },
        _sum: { amount: true },
      }),
      prisma.transaction.findMany({
        where: { businessId, esCredito: true, date: { lte: end } },
        select: { id: true, amount: true, type: true },
      }),
      prisma.producto.findMany({
        where: { businessId, activo: true, tipo: 'MERCADERIA' },
        select: { id: true, stockActual: true, precioCosto: true },
      }),
      prisma.bienDeUso.aggregate({
        where: { businessId, activo: true, fechaAdquisicion: { lte: end } },
        _sum: { valorAdquisicion: true },
      }),
      prisma.movimientoStock.findMany({
        where: {
          tipo: 'SALIDA',
          producto: { businessId },
          fecha: { gte: start, lte: end },
        },
        select: { cantidad: true, precio: true },
      }),
    ])

    let cajaTotal = 0
    for (const row of txAggregates) {
      const sum = row._sum.amount ?? 0
      if (row.type === 'INCOME') cajaTotal += sum
      else if (row.type === 'EXPENSE') cajaTotal -= sum
    }

    const creditoIds = creditosAbiertos.map(c => c.id)
    const productoIds = productos.map(p => p.id)
    const [cobrosPagos, movimientosPost] = await Promise.all([
      creditoIds.length
        ? prisma.transaction.groupBy({
            by: ['linkedCreditoId'],
            where: { businessId, linkedCreditoId: { in: creditoIds }, date: { lte: end } },
            _sum: { amount: true },
          })
        : Promise.resolve([] as Array<{ linkedCreditoId: string | null; _sum: { amount: number | null } }>),
      productoIds.length
        ? prisma.movimientoStock.findMany({
            where: { productoId: { in: productoIds }, fecha: { gt: end } },
            select: { productoId: true, tipo: true, cantidad: true },
          })
        : Promise.resolve([] as Array<{ productoId: string; tipo: string; cantidad: number }>),
    ])

    const aplicadoPorCredito = new Map<string, number>()
    for (const row of cobrosPagos) {
      if (row.linkedCreditoId) aplicadoPorCredito.set(row.linkedCreditoId, row._sum.amount ?? 0)
    }
    let totalACobrar = 0
    let totalAPagar = 0
    for (const c of creditosAbiertos) {
      const aplicado = aplicadoPorCredito.get(c.id) ?? 0
      const pendiente = Math.max(0, c.amount - aplicado)
      if (c.type === 'INCOME') totalACobrar += pendiente
      else if (c.type === 'EXPENSE') totalAPagar += pendiente
    }

    const deltaPostPorProducto = new Map<string, number>()
    for (const m of movimientosPost) {
      const delta = m.tipo === 'ENTRADA' ? m.cantidad : m.tipo === 'SALIDA' ? -m.cantidad : 0
      deltaPostPorProducto.set(m.productoId, (deltaPostPorProducto.get(m.productoId) ?? 0) + delta)
    }
    let stockTotal = 0
    for (const p of productos) {
      const stockAt = p.stockActual - (deltaPostPorProducto.get(p.id) ?? 0)
      stockTotal += stockAt * p.precioCosto
    }

    const bienesTotal = bienesAggregate._sum.valorAdquisicion ?? 0
    const cmvPeriod = salidasPeriodo.reduce((acc, m) => acc + m.cantidad * m.precio, 0)

    return { cajaTotal, totalACobrar, totalAPagar, stockTotal, bienesTotal, cmvPeriod }
  }

  const [current, prev] = await Promise.all([
    computeSnapshot(periodStart, periodEnd),
    computeSnapshot(prevFrom, prevTo),
  ])

  return { ...current, prev }
}


export async function getDashboardPresetSummaries(): Promise<DashboardPresetSummary[]> {
  const periods: Array<Exclude<DashboardPeriodKey, 'custom'>> = [
    'diario',
    'semanal',
    'mensual',
    'anual',
  ]

  const entries = await Promise.all(
    periods.map(async (period) => {
      const stats = await getDashboardStats(period)

      return {
        period,
        periodLabel: stats.periodLabel,
        income: stats.kpis.income,
        expense: stats.kpis.expense,
        gain: stats.kpis.gain,
        incomeChangePct: stats.prevKpis.income > 0 ? ((stats.kpis.income - stats.prevKpis.income) / stats.prevKpis.income) * 100 : null,
        expenseChangePct: stats.prevKpis.expense > 0 ? ((stats.kpis.expense - stats.prevKpis.expense) / stats.prevKpis.expense) * 100 : null,
        gainChangePct: stats.prevKpis.gain !== 0 ? ((stats.kpis.gain - stats.prevKpis.gain) / Math.abs(stats.prevKpis.gain)) * 100 : null,
      } satisfies DashboardPresetSummary
    }),
  )

  return entries
}


export async function getAvailableDashboardMonths(): Promise<DashboardMonthOption[]> {
  const businessId = await getBusinessId()
  const txs = await prisma.transaction.findMany({
    where: { businessId },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    select: { date: true },
    take: 2000,
  })

  const seen = new Set<string>()
  const months: DashboardMonthOption[] = []

  for (const tx of txs) {
    const date = new Date(tx.date)
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const key = `${year}-${String(month).padStart(2, '0')}`

    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    months.push({
      year,
      month,
      key,
      label: DASHBOARD_MONTH_LABELS[month - 1],
      shortYear: String(year).slice(2),
    })

  }

  if (months.length === 0) {
    const now = new Date()
    months.push({
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      key: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      label: DASHBOARD_MONTH_LABELS[now.getMonth()],
      shortYear: String(now.getFullYear()).slice(2),
    })
  }

  while (months.length < 4) {
    const first = months[0]
    const previousDate = new Date(first.year, first.month - 2, 1)
    const year = previousDate.getFullYear()
    const month = previousDate.getMonth() + 1
    const key = `${year}-${String(month).padStart(2, '0')}`

    if (!seen.has(key)) {
      seen.add(key)
      months.unshift({
        year,
        month,
        key,
        label: DASHBOARD_MONTH_LABELS[month - 1],
        shortYear: String(year).slice(2),
      })
    }
  }

  return months.slice(-24)
}


export async function getMonthlyDashboardStats(): Promise<DashboardStatsResult> {
  return getDashboardStats('mensual')
}
