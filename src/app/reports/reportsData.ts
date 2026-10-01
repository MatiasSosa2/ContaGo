import { getReportDataExtended, getCashFlowByCurrency, getIncomeStatement, getCashAccountsSnapshot, getCashTransfers, getBalanceSheet } from '@/app/actions'
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
  /** Moneda del flujo de efectivo: ARS (por defecto) o USD */
  moneda?: string
  /** Flujo de efectivo de una sola caja (id de la cuenta) */
  caja?: string
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

  if (/diferencias? de caja/.test(text)) return 'Diferencias de caja'
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

type StatementItem = { label: string; amount: number; sub?: string | null }
type GroupedLine = { label: string; amount: number; pct: number; children?: GroupedLine[] }

function groupStatementLines(items: StatementItem[], baseAmount: number): GroupedLine[] {
  const map = new Map<string, { amount: number; subs: Map<string, number>; hasSub: boolean }>()

  for (const item of items) {
    const entry = map.get(item.label) ?? { amount: 0, subs: new Map(), hasSub: false }
    entry.amount += item.amount
    const subLabel = item.sub?.trim() || 'Sin subcategoría'
    if (item.sub) entry.hasSub = true
    entry.subs.set(subLabel, (entry.subs.get(subLabel) || 0) + item.amount)
    map.set(item.label, entry)
  }

  return Array.from(map.entries())
    .map(([label, { amount, subs, hasSub }]) => ({
      label,
      amount,
      pct: pctOf(amount, baseAmount),
      // Desglose solo si algún movimiento de la línea tiene subcategoría
      children: hasSub
        ? Array.from(subs.entries())
            .map(([subLabel, subAmount]) => ({ label: subLabel, amount: subAmount, pct: pctOf(subAmount, baseAmount) }))
            .sort((left, right) => right.amount - left.amount)
        : undefined,
    }))
    .sort((left, right) => right.amount - left.amount)
}

function getTransactionLabel(tx: { category?: { name?: string | null } | null; description?: string | null }) {
  return tx.category?.name?.trim() || tx.description?.trim() || 'Otros'
}

function getSubcategoryLabel(tx: { subcategory?: { name?: string | null } | null }) {
  return tx.subcategory?.name?.trim() || null
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

  const { allTx } = await getReportDataExtended(range)
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

  // ── Estado de resultados: ventas y CMV de Inventario, el resto de lo registrado ──
  // (reglas en src/server/results/income-statement.ts)
  const er = await getIncomeStatement(
    periodo, params?.from, params?.to, selectedYear, selectedMonth, selectedDay, selectedWeekStart, cur,
  )
  const otherIncomeLines = groupStatementLines(er.otherIncomeItems, er.ventas)
  const otherIncomeTotal = er.otherIncomeItems.reduce((sum, item) => sum + item.amount, 0)
  const totalIncome = er.ventas + otherIncomeTotal
  const grossProfit = er.ventas - er.cmv

  const operatingExpenseLines = groupStatementLines(er.expenseItems, totalIncome)
  const operatingExpensesTotal = er.expenseItems.reduce((sum, item) => sum + item.amount, 0)
  const netProfit = grossProfit + otherIncomeTotal - operatingExpensesTotal

  // ── Flujo de efectivo: mismos números que la pantalla de Cajas (src/server/cash/cash-flow.ts) ──
  const cashCur = params?.moneda === 'USD' ? 'USD' : 'ARS'
  const cashFlowByCurrency = await getCashFlowByCurrency(
    periodo, params?.from, params?.to, selectedYear, selectedMonth, selectedDay, selectedWeekStart,
  )
  const flow = cashFlowByCurrency[cashCur]
  const flowFrom = new Date(cashFlowByCurrency.from).getTime()
  const flowTo = new Date(cashFlowByCurrency.to).getTime()

  // Desglose de egresos: los mismos movimientos que suman "Egresos" en Cajas
  const cashExpenseLines = groupStatementLines(
    allTx
      .filter((tx) => {
        const t = new Date(tx.date).getTime()
        return tx.type === 'EXPENSE' && !tx.esCredito && (tx.currency || 'ARS') === cashCur && t >= flowFrom && t <= flowTo
      })
      .map((tx) =>
        // Pagos de deudas a proveedores: un solo renglón, con cada proveedor como detalle
        tx.subType === 'PAGO_DEUDA'
          ? { label: 'Pagos a proveedores', amount: tx.amount, sub: tx.contact?.name?.trim() || null }
          : {
              label: resolveExpenseLabel(getTransactionLabel(tx), true) || 'Otros egresos',
              amount: tx.amount,
              sub: getSubcategoryLabel(tx),
            },
      ),
    flow.egresos > 0 ? flow.egresos : 1,
  )

  // Ingresos cobrados por categoría: los mismos movimientos que suman "Ingresos" en Cajas
  const INCOME_LABEL: Record<string, string> = {
    SALE_PRODUCT: 'Ventas cobradas', SALE: 'Ventas cobradas', COBRO_CREDITO: 'Cobros de créditos',
    SALE_BIEN_USO: 'Venta de bienes de uso', DIFERENCIA_CAJA: 'Sobrantes de caja',
  }
  const cashIncomeLines = groupStatementLines(
    allTx
      .filter((tx) => {
        const t = new Date(tx.date).getTime()
        return tx.type === 'INCOME' && !tx.esCredito && (tx.currency || 'ARS') === cashCur && t >= flowFrom && t <= flowTo
      })
      .map((tx) => ({ label: INCOME_LABEL[tx.subType ?? ''] ?? getTransactionLabel(tx), amount: tx.amount })),
    flow.ingresos > 0 ? flow.ingresos : 1,
  )

  // Saldo de cada caja al inicio y al cierre, y detalle de los cambios de moneda
  const periodArgs = [periodo, params?.from, params?.to, selectedYear, selectedMonth, selectedDay, selectedWeekStart] as const
  const [cashAccountsSnapshot, transfers] = await Promise.all([
    getCashAccountsSnapshot(...periodArgs, cashCur),
    getCashTransfers(...periodArgs),
  ])
  const fmtUsd = (v: number) => `US$${Math.round(v).toLocaleString('es-AR')}`
  const exchangeNotes = transfers
    .filter((t) => t.fromAccount.currency !== t.toAccount.currency && (t.fromAccount.currency === cashCur || t.toAccount.currency === cashCur))
    .map((t) => {
      const compra = t.toAccount.currency === 'USD'
      const dolares = compra ? t.amountTo : t.amountFrom
      const cotizacion = t.exchangeRate ? ` a $${Math.round(t.exchangeRate).toLocaleString('es-AR')}` : ''
      return `${compra ? 'Compra' : 'Venta'} de ${fmtUsd(dolares)}${cotizacion}`
    })

  // Patrimonio: mismo cálculo que el Estado patrimonial (todo al cierre del período)
  const { current: balance } = await getBalanceSheet(
    periodo, params?.from, params?.to, selectedYear, selectedMonth, selectedDay, selectedWeekStart,
  )
  const totalAssets = balance.totalActivo
  const totalLiabilities = balance.totalPasivo
  const assetLines = groupStatementLines(
    balance.activo.filter((r) => r.amount > 0).map((r) => ({ label: r.label, amount: r.amount })),
    totalAssets || 1,
  )
  const liabilityLines = groupStatementLines(
    balance.pasivo.flatMap((r) => r.items.map((i) => ({ label: i.label, amount: i.amount }))),
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

  // Año de los gráficos (enero a diciembre): el del período elegido
  const seriesYear = (range?.to ?? range?.from ?? now).getFullYear()
  // Mes resaltado en los gráficos cuando se mira un mes puntual
  const seriesActiveMonth = periodo === 'mensual' && selectedMonth ? selectedMonth - 1 : undefined

  return {
    seriesYear,
    seriesActiveMonth,
    cashCurrency: cashCur,
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
      income: totalIncome,
      sales: er.ventas,
      otherIncome: otherIncomeLines,
      otherIncomeTotal,
      cogs: er.cmv,
      grossProfit,
      grossMargin: pctOf(grossProfit, er.ventas),
      operatingExpenses: operatingExpenseLines,
      operatingExpensesTotal,
      operatingExpensePct: pctOf(operatingExpensesTotal, totalIncome),
      netProfit,
      netMargin: pctOf(netProfit, totalIncome),
    },
    cashFlow: {
      currency: cashCur,
      openingBalance: flow.saldoInicial,
      collectedIncome: flow.ingresos,
      incomeLines: cashIncomeLines,
      expenseLines: cashExpenseLines,
      totalExpenses: flow.egresos,
      currencyExchange: flow.cambioMoneda,
      netVariation: flow.ingresos - flow.egresos + flow.cambioMoneda,
      closingBalance: flow.saldoFinal,
      accounts: cashAccountsSnapshot,
      exchangeNotes,
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

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/**
 * Período anterior para las comparaciones de las tarjetas (mes o año anterior).
 * Si el período elegido está en curso, el anterior se corta en el mismo día, así la
 * comparación es justa (medio mes contra medio mes). Null en día / semana / personalizado.
 */
export function previousPeriodArgs(periodo: string, selectedYear?: number, selectedMonth?: number) {
  if (!selectedYear || (periodo === 'mensual' && !selectedMonth) || (periodo !== 'mensual' && periodo !== 'anual')) return null
  const mensual = periodo === 'mensual'
  const prevYear = mensual ? (selectedMonth === 1 ? selectedYear - 1 : selectedYear) : selectedYear - 1
  const prevMonth = mensual ? (selectedMonth === 1 ? 12 : selectedMonth! - 1) : undefined
  const label = prevMonth ? MESES_CORTOS[prevMonth - 1] : String(prevYear)

  const hoy = new Date()
  const enCurso = mensual
    ? selectedYear === hoy.getFullYear() && selectedMonth === hoy.getMonth() + 1
    : selectedYear === hoy.getFullYear()
  if (!enCurso) {
    return { label, period: periodo as PeriodKey, from: undefined, to: undefined, year: prevYear, month: prevMonth }
  }
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const desde = new Date(prevYear, (prevMonth ?? 1) - 1, 1)
  const hasta = mensual
    ? new Date(prevYear, prevMonth! - 1, Math.min(hoy.getDate(), new Date(prevYear, prevMonth!, 0).getDate()))
    : new Date(prevYear, hoy.getMonth(), hoy.getDate())
  return { label, period: 'custom' as PeriodKey, from: iso(desde), to: iso(hasta), year: undefined, month: undefined }
}
