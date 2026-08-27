import { getReportDataExtended } from '@/app/actions'
import type { DateRange } from '@/lib/validations'
import type { PeriodKey } from '@/components/PeriodSelector'
import { requireBusinessContext } from '@/server/auth/require-business-context'

export type ReportsSearchParams = {
  periodo?: string
  preset?: string
  from?: string
  to?: string
  year?: string
  month?: string
  day?: string
  weekStart?: string
}

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function pctOf(amount: number, base: number) {
  return base > 0 ? (amount / base) * 100 : 0
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function titleCase(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function resolveExpenseLabel(rawLabel: string, includeInventoryPurchases: boolean) {
  const text = normalizeText(rawLabel)

  if (/sueldo|salario|nomina|emplead/.test(text)) return 'Sueldos'
  if (/alquiler|renta|local/.test(text)) return 'Alquiler'
  if (/luz|agua|gas|internet|telefono|servicio/.test(text)) return 'Servicios'
  if (/impuesto|iva|afip|monotributo|ingresos brutos/.test(text)) return 'Impuestos'
  if (/marketing|publicidad|anuncio|ads/.test(text)) return 'Marketing'
  if (/prestamo|credito|financiacion|financiamiento|cuota/.test(text)) return 'Financiacion'
  if (/mercader|mercaderia|mercadoria|stock|inventario|insumo|proveedor|compra/.test(text)) {
    return includeInventoryPurchases ? 'Compras de mercaderia' : null
  }

  const cleaned = titleCase(rawLabel.trim())
  return cleaned || 'Otros gastos'
}

function resolveLiabilityLabel(rawLabel: string) {
  const text = normalizeText(rawLabel)

  if (/prestamo|credito|financiacion|financiamiento|cuota/.test(text)) return 'Prestamos'
  if (/impuesto|iva|afip|monotributo|ingresos brutos/.test(text)) return 'Impuestos a pagar'
  if (/proveedor|mercader|mercaderia|mercadoria|compra|stock|inventario|insumo/.test(text)) return 'Proveedores'

  return 'Otras deudas'
}

function groupStatementLines(items: Array<{ label: string; amount: number }>, baseAmount: number) {
  const map = new Map<string, number>()

  for (const item of items) {
    map.set(item.label, (map.get(item.label) || 0) + item.amount)
  }

  return Array.from(map.entries())
    .map(([label, amount]) => ({ label, amount, pct: pctOf(amount, baseAmount) }))
    .sort((left, right) => right.amount - left.amount)
}

function getTransactionLabel(tx: { category?: { name?: string | null } | null; description?: string | null }) {
  return tx.category?.name?.trim() || tx.description?.trim() || 'Otros'
}

function isPendingCredit(tx: { esCredito?: boolean | null; estado?: string | null }) {
  const status = (tx.estado || '').toUpperCase()
  return Boolean(tx.esCredito) && (status === 'PENDIENTE' || status === 'VENCIDO')
}

function isSettledForCashFlow(tx: { esCredito?: boolean | null; estado?: string | null }) {
  return !isPendingCredit(tx)
}

function buildQueryString(fields: Record<string, string | number | undefined>) {
  const sp = new URLSearchParams()
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== '') sp.set(key, String(value))
  }
  return sp.toString()
}

export async function getReportsViewData(searchParams?: Promise<ReportsSearchParams>) {
  const sessionContext = await requireBusinessContext()
  const params = await searchParams
  const now = new Date()
  const periodo = (params?.periodo ?? 'mensual') as PeriodKey
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const selectedYear = params?.year
    ? Number.parseInt(params.year, 10)
    : (periodo === 'mensual' || periodo === 'anual' ? currentYear : undefined)
  const selectedMonth = params?.month
    ? Number.parseInt(params.month, 10)
    : (periodo === 'mensual' ? currentMonth : undefined)
  const selectedDay = params?.day
  const selectedWeekStart = params?.weekStart

  // ── Resolve date range based on selected period ────────────────────────────
  let range: DateRange | undefined
  let periodLabel: string

  if (periodo === 'diario') {
    const target = selectedDay ? new Date(selectedDay + 'T12:00:00') : now
    range = {
      from: new Date(target.getFullYear(), target.getMonth(), target.getDate(), 0, 0, 0),
      to: new Date(target.getFullYear(), target.getMonth(), target.getDate(), 23, 59, 59),
    }
    periodLabel = target.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
  } else if (periodo === 'semanal') {
    let monday: Date
    if (selectedWeekStart) {
      monday = new Date(selectedWeekStart + 'T12:00:00')
      monday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 0, 0, 0)
    } else {
      const dow = now.getDay()
      const offset = dow === 0 ? -6 : 1 - dow
      monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, 0, 0, 0)
    }
    const sunday = new Date(monday); sunday.setDate(sunday.getDate() + 6); sunday.setHours(23, 59, 59)
    range = { from: monday, to: sunday }
    const fmt = (d: Date) => d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
    periodLabel = `${fmt(monday)} - ${fmt(sunday)}`
  } else if (periodo === 'anual') {
    const y = selectedYear ?? currentYear
    const isCurrent = y === currentYear
    range = {
      from: new Date(y, 0, 1, 0, 0, 0),
      to: isCurrent
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
        : new Date(y, 11, 31, 23, 59, 59),
    }
    periodLabel = `Año ${y}`
  } else if (periodo === 'custom' && (params?.from || params?.to)) {
    range = {
      from: params?.from ? new Date(params.from + 'T00:00:00') : undefined,
      to: params?.to ? new Date(params.to + 'T23:59:59') : undefined,
    }
    periodLabel = 'Periodo personalizado'
  } else {
    // mensual (default)
    const y = selectedYear ?? currentYear
    const m = selectedMonth ?? currentMonth
    const isCurrent = y === currentYear && m === currentMonth
    range = {
      from: new Date(y, m - 1, 1, 0, 0, 0),
      to: isCurrent
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
        : new Date(y, m, 0, 23, 59, 59),
    }
    periodLabel = `${MONTH_NAMES[m - 1]} ${y}`
  }

  const {
    allTx,
    totalsByCurrency,
    accountTotalByCurrency,
    activosPorMoneda,
    pasivosPorMoneda,
    cxcPorMoneda,
    cmvTotal,
    valorInventario,
  } = await getReportDataExtended(range)
  const cur = 'ARS'

  // Evolución mensual: siempre últimos 6 meses reales, independiente del período elegido arriba.
  const { monthlyHistory } = await getReportDataExtended()
  const monthlyEvolution = monthlyHistory.slice(-6).map(({ month, byCur }: { month: string; byCur: Record<string, { income: number; expense: number }> }) => {
    const data = byCur[cur] || { income: 0, expense: 0 }
    const [y, m] = month.split('-')
    return {
      label: `${MONTH_NAMES[Number.parseInt(m, 10) - 1]} ${y.slice(2)}`,
      net: data.income - data.expense,
    }
  })

  const totals = totalsByCurrency[cur] || { income: 0, expense: 0 }
  const txByCurrency = allTx.filter((tx) => (tx.currency || 'ARS') === cur)

  const grossProfit = totals.income - (cmvTotal || 0)

  const operatingExpenseLines = groupStatementLines(
    txByCurrency
      .filter((tx) => tx.type === 'EXPENSE')
      .map((tx) => ({
        label: resolveExpenseLabel(getTransactionLabel(tx), false),
        amount: tx.amount,
      }))
      .filter((line): line is { label: string; amount: number } => Boolean(line.label)),
    totals.income,
  )

  const operatingExpensesTotal = operatingExpenseLines.reduce((sum, line) => sum + line.amount, 0)
  const netProfit = grossProfit - operatingExpensesTotal

  const collectedIncome = txByCurrency
    .filter((tx) => tx.type === 'INCOME' && isSettledForCashFlow(tx))
    .reduce((sum, tx) => sum + tx.amount, 0)

  const cashExpenseLines = groupStatementLines(
    txByCurrency
      .filter((tx) => tx.type === 'EXPENSE' && isSettledForCashFlow(tx))
      .map((tx) => ({
        label: resolveExpenseLabel(getTransactionLabel(tx), true) || 'Otros egresos',
        amount: tx.amount,
      })),
    totals.income > 0 ? totals.income : 1,
  )

  const totalCashExpenses = cashExpenseLines.reduce((sum, line) => sum + line.amount, 0)
  const closingBalance = accountTotalByCurrency[cur] || 0
  const netVariation = collectedIncome - totalCashExpenses
  const openingBalance = closingBalance - netVariation

  const totalAssets = (activosPorMoneda[cur] || 0) + (valorInventario || 0) + (cxcPorMoneda[cur] || 0)
  const totalLiabilities = pasivosPorMoneda[cur] || 0
  const assetLines = groupStatementLines(
    [
      { label: 'Caja y bancos', amount: activosPorMoneda[cur] || 0 },
      { label: 'Mercaderia', amount: valorInventario || 0 },
      { label: 'Creditos a cobrar', amount: cxcPorMoneda[cur] || 0 },
    ].filter((line) => line.amount > 0),
    totalAssets || 1,
  )

  const pendingLiabilityLines = groupStatementLines(
    txByCurrency
      .filter((tx) => tx.type === 'EXPENSE' && isPendingCredit(tx))
      .map((tx) => ({ label: resolveLiabilityLabel(getTransactionLabel(tx)), amount: tx.amount })),
    totalLiabilities || 1,
  )

  const groupedLiabilityTotal = pendingLiabilityLines.reduce((sum, line) => sum + line.amount, 0)
  const residualLiabilities = Math.max(0, totalLiabilities - groupedLiabilityTotal)
  const liabilityLines = groupStatementLines(
    [
      ...pendingLiabilityLines.map((line) => ({ label: line.label, amount: line.amount })),
      ...(residualLiabilities > 0 ? [{ label: 'Otras deudas', amount: residualLiabilities }] : []),
    ],
    totalLiabilities || 1,
  )

  const queryString = buildQueryString({
    periodo,
    day: selectedDay,
    weekStart: selectedWeekStart,
    year: selectedYear,
    month: selectedMonth,
    from: params?.from,
    to: params?.to,
  })

  return {
    sessionContext,
    periodo,
    params,
    selectedYear,
    selectedMonth,
    selectedDay,
    selectedWeekStart,
    periodLabel,
    queryString,
    monthlyEvolution,
    results: {
      currency: cur,
      income: totals.income,
      cogs: cmvTotal || 0,
      grossProfit,
      grossMargin: pctOf(grossProfit, totals.income),
      operatingExpenses: operatingExpenseLines,
      operatingExpensesTotal,
      operatingExpensePct: pctOf(operatingExpensesTotal, totals.income),
      netProfit,
      netMargin: pctOf(netProfit, totals.income),
    },
    cashFlow: {
      currency: cur,
      openingBalance,
      collectedIncome,
      expenseLines: cashExpenseLines,
      totalExpenses: totalCashExpenses,
      netVariation,
      closingBalance,
    },
    balanceSheet: {
      currency: cur,
      assets: assetLines,
      totalAssets,
      liabilities: liabilityLines,
      totalLiabilities,
      equity: totalAssets - totalLiabilities,
    },
  }
}
