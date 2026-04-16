import { getAvailableDashboardMonths, getReportDataExtended } from '@/app/actions'
import FinancialStatementsPanel from '@/components/FinancialStatementsPanel'
import type { DateRange } from '@/lib/validations'
import PrintButton from '@/components/PrintButton'
import PeriodFilter from '@/components/PeriodFilter'
import { requireBusinessContext } from '@/server/auth/require-business-context'
import AppHeader from '@/components/AppHeader'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

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

export default async function ReportsPage({
  searchParams,
}: {
  searchParams?: Promise<{ preset?: string; from?: string; to?: string; year?: string; month?: string }>
}) {
  const sessionContext = await requireBusinessContext()
  const params = await searchParams
  const now = new Date()
  const selectedYear = params?.year ? Number.parseInt(params.year, 10) : now.getFullYear()
  const selectedMonth = params?.month ? Number.parseInt(params.month, 10) : now.getMonth() + 1
  const range: DateRange | undefined =
    params?.year && params?.month
      ? {
          from: new Date(selectedYear, selectedMonth - 1, 1, 0, 0, 0),
          to: new Date(selectedYear, selectedMonth, 0, 23, 59, 59),
        }
      : params?.from || params?.to
      ? {
          from: params.from ? new Date(params.from + 'T00:00:00') : undefined,
          to:   params.to   ? new Date(params.to   + 'T23:59:59') : undefined,
        }
      : undefined

  const availableMonths = await getAvailableDashboardMonths(sessionContext.activeBusiness.id)

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

  const periodLabel = params?.year && params?.month
    ? `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`
    : params?.from && params?.to
    ? 'Periodo personalizado'
    : `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1920px] mx-auto font-sans text-[#1F2937] dark:text-gray-100 min-h-screen bg-[#F7F9FB] dark:bg-black">

      <AppHeader
        title="Informes"
        showRoleBadge={false}
        sessionContext={sessionContext}
        icon={
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
          </svg>
        }
        actions={
          <>
            <PrintButton />
          </>
        }
      />

      <div className="mb-5 flex items-center justify-between gap-3 md:mb-6">
        <Suspense fallback={null}>
          <PeriodFilter
            availableMonths={availableMonths}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
          />
        </Suspense>
      </div>

      <FinancialStatementsPanel
        periodLabel={periodLabel}
        results={{
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
        }}
        cashFlow={{
          currency: cur,
          openingBalance,
          collectedIncome,
          expenseLines: cashExpenseLines,
          totalExpenses: totalCashExpenses,
          netVariation,
          closingBalance,
        }}
        balanceSheet={{
          currency: cur,
          assets: assetLines,
          totalAssets,
          liabilities: liabilityLines,
          totalLiabilities,
          equity: totalAssets - totalLiabilities,
        }}
      />

    </div>
  )
}
