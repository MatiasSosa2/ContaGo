import { getAccounts, getCategories, getTransactions, getMonthlyStats, getDailyStats, getContacts, getAreasNegocio, getCreditosDeudas } from '@/app/actions'
import AccountManager from '@/components/AccountManager'
import ContactManager from '@/components/ContactManager'
import AreaNegocioManager from '@/components/AreaNegocioManager'
import TransactionFormCard from '@/components/TransactionFormCard'
import { KpiSparkline, MarginGauge, FinancialOverviewChart, ExpenseCategoryDonut, DebtStatusBar } from '@/components/DashboardCharts'
import AlertsBanner from '@/components/AlertsBanner'
import type { AlertItem } from '@/components/AlertsBanner'
import PeriodTabs from '@/components/PeriodTabs'
import type { PeriodKey } from '@/components/PeriodTabs'
import { requirePageSession } from '@/server/auth/require-page-session'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>
}) {
  await requirePageSession()
  const sp = await searchParams
  const periodo = (sp.periodo ?? 'mensual') as PeriodKey
  const accounts = await getAccounts()
  const categories = await getCategories()
  const transactions = await getTransactions()
  const monthlyStats = await getMonthlyStats()
  const dailyStats = await getDailyStats()
  const contacts = await getContacts()
  const areas = await getAreasNegocio()
  const creditosDeudas = await getCreditosDeudas()

  // ── Rango de fechas según período seleccionado ──────────────────────────
  const nowDate = new Date()
  function getPeriodStart(p: PeriodKey): Date {
    const d = new Date(nowDate)
    if (p === 'semanal')    { d.setDate(d.getDate() - 7);        return d }
    if (p === 'mensual')    { d.setDate(1); d.setHours(0,0,0,0); return d }
    if (p === 'trimestral') { d.setMonth(d.getMonth() - 3);      return d }
    if (p === 'semestral')  { d.setMonth(d.getMonth() - 6);      return d }
    /* 12meses */             d.setFullYear(d.getFullYear() - 1); return d
  }
  const periodoStart = getPeriodStart(periodo)

  // Transacciones dentro del período
  const txPeriodo = transactions.filter(tx => new Date(tx.date) >= periodoStart)

  // KPIs del período
  const periodoIncome  = txPeriodo.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0)
  const periodoExpense = txPeriodo.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0)
  const periodoGain    = periodoIncome - periodoExpense
  const mesActual = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}`
  const categoryExpMap: Record<string, { name: string; value: number }> = {}
  for (const tx of transactions) {
    const txMes = `${new Date(tx.date).getFullYear()}-${String(new Date(tx.date).getMonth() + 1).padStart(2, '0')}`
    if (txMes !== mesActual || tx.type !== 'EXPENSE') continue
    const catName = (tx as { category?: { name: string } }).category?.name || 'Sin categoría'
    if (!categoryExpMap[catName]) categoryExpMap[catName] = { name: catName, value: 0 }
    categoryExpMap[catName].value += tx.amount
  }
  const CAT_COLORS = ['#3A4D39', '#C5A065', '#5A7A57', '#d4ae84', '#6b8f65', '#c49a6c']
  const categorySlices = Object.values(categoryExpMap)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)
    .map((c, i) => ({ ...c, color: CAT_COLORS[i % CAT_COLORS.length] }))

  const balanceByCurrency: Record<string, number> = {}
  accounts.forEach(acc => {
    const cur = acc.currency || 'ARS'
    balanceByCurrency[cur] = (balanceByCurrency[cur] || 0) + acc.currentBalance
  })

  // --- Alertas automáticas ---
  const monthlyAgg: Record<string, { income: number; expense: number }> = {}
  for (const tx of transactions) {
    const d = new Date(tx.date)
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!monthlyAgg[k]) monthlyAgg[k] = { income: 0, expense: 0 }
    if (tx.type === 'INCOME') monthlyAgg[k].income += tx.amount
    else monthlyAgg[k].expense += tx.amount
  }
  const tKey = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}`
  const lDate = new Date(nowDate.getFullYear(), nowDate.getMonth() - 1, 1)
  const lKey = `${lDate.getFullYear()}-${String(lDate.getMonth() + 1).padStart(2, '0')}`
  const thisMth = monthlyAgg[tKey] || { income: 0, expense: 0 }
  const lastMth = monthlyAgg[lKey] || { income: 0, expense: 0 }

  // Sparklines — últimos 6 meses
  const last6Keys = Array.from({ length: 6 }, (_, idx) => {
    const d = new Date(nowDate.getFullYear(), nowDate.getMonth() - (5 - idx), 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const incomeSpark = last6Keys.map(k => monthlyAgg[k]?.income || 0)
  const expenseSpark = last6Keys.map(k => monthlyAgg[k]?.expense || 0)
  const balanceSpark = last6Keys.map(k => (monthlyAgg[k]?.income || 0) - (monthlyAgg[k]?.expense || 0))

  // Pulse KPIs — mes actual ARS
  const arsMonthly = monthlyStats.find(s => s.currency === 'ARS') || { income: 0, expense: 0, balance: 0, currency: 'ARS' }
  const incomeGrowth = lastMth.income > 0 ? ((arsMonthly.income - lastMth.income) / lastMth.income) * 100 : null
  const expenseGrowth = lastMth.expense > 0 ? ((arsMonthly.expense - lastMth.expense) / lastMth.expense) * 100 : null
  const marginPct = arsMonthly.income > 0 ? ((arsMonthly.income - arsMonthly.expense) / arsMonthly.income) * 100 : 0

  const arsBalance = balanceByCurrency['ARS'] || 0
  const last3Keys = [1, 2, 3].map(i => {
    const d = new Date(nowDate.getFullYear(), nowDate.getMonth() - i, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const avgExp3m = last3Keys.reduce((s, k) => s + (monthlyAgg[k]?.expense || 0), 0) / 3
  const runwayMths = avgExp3m > 0 ? arsBalance / avgExp3m : null
  const marginPctAlert = thisMth.income > 0
    ? ((thisMth.income - thisMth.expense) / thisMth.income) * 100
    : null

  const alerts: AlertItem[] = []
  if (runwayMths !== null && runwayMths < 3) {
    alerts.push({
      severity: runwayMths < 1.5 ? 'danger' : 'warning',
      icon: 'runway',
      title: 'Runway bajo',
      message: `Con el ritmo actual de gastos, el saldo ARS cubre solo ${runwayMths.toFixed(1)} meses. Revisá la liquidez.`,
    })
  }
  if (marginPctAlert !== null && marginPctAlert < 20) {
    alerts.push({
      severity: marginPctAlert < 0 ? 'danger' : 'warning',
      icon: 'margin',
      title: 'Margen reducido',
      message: `El margen del mes es ${marginPctAlert.toFixed(1)}%. Analizá costos en Reportes.`,
    })
  }
  if (lastMth.expense > 0 && thisMth.expense > lastMth.expense * 1.2) {
    const spikePct = ((thisMth.expense - lastMth.expense) / lastMth.expense) * 100
    alerts.push({
      severity: spikePct > 50 ? 'danger' : 'warning',
      icon: 'spike',
      title: 'Gastos en alza',
      message: `Los gastos subieron un ${spikePct.toFixed(0)}% respecto al mes anterior.`,
    })
  }

  // ── Semáforo de créditos ──
  const now48h = new Date(nowDate.getTime() + 48 * 60 * 60 * 1000)
  const credVencidos = creditosDeudas.filter(c => c.estado === 'VENCIDO' || (c.fechaVencimiento && new Date(c.fechaVencimiento) < nowDate && c.estado === 'PENDIENTE'))
  const cred48h = creditosDeudas.filter(c => c.estado === 'PENDIENTE' && c.fechaVencimiento && new Date(c.fechaVencimiento) >= nowDate && new Date(c.fechaVencimiento) <= now48h)
  const credFuturos = creditosDeudas.filter(c => c.estado === 'PENDIENTE' && (!c.fechaVencimiento || new Date(c.fechaVencimiento) > now48h))
  const totalVencido = credVencidos.reduce((s, c) => s + c.amount, 0)
  const total48h = cred48h.reduce((s, c) => s + c.amount, 0)
  const totalFuturo = credFuturos.reduce((s, c) => s + c.amount, 0)
  const totalDeudaPendiente = creditosDeudas.filter(c => c.estado === 'PENDIENTE' || c.estado === 'VENCIDO').reduce((s, c) => s + c.amount, 0)

  // ── Gráfico principal — últimos 6 meses (ingresos / egresos / neto) ──
  const MONTH_LABELS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  const financialOverviewData = last6Keys.map(k => {
    const d = new Date(k + '-01')
    const income  = monthlyAgg[k]?.income  ?? 0
    const expense = monthlyAgg[k]?.expense ?? 0
    return { label: MONTH_LABELS[d.getMonth()], income, expense, net: income - expense }
  })

  // ── Donut — datos para ECharts (usa los colores ya asignados en categorySlices) ──
  const expenseCategoryChartData = categorySlices.map(s => ({
    name: s.name,
    value: s.value,
    itemStyle: { color: s.color },
  }))

  // ── Barra apilada — semáforo de deuda ──
  const debtStatusChartData = [
    { name: 'Vencidos', value: totalVencido, color: '#EF4444' },
    { name: '< 48 hs',  value: total48h,    color: '#F59E0B' },
    { name: 'Futuros',  value: totalFuturo,  color: '#10B981' },
  ]

  // ── Helpers de formato ──
  const fmtARS = (v: number) => '$' + Math.abs(v).toLocaleString('es-AR', { minimumFractionDigits: 0 })

  return (
    <div className="p-3 sm:p-5 lg:p-6 max-w-[1920px] mx-auto font-sans text-gray-800 min-h-screen bg-gray-50">

      {/* ══ FILA 0 — HEADER EJECUTIVO ════════════════════════════════════════ */}
      <header className="mb-4 md:mb-6">
        <h1 className="text-base md:text-xl font-semibold tracking-tight text-gray-900" style={{ fontFamily: 'var(--font-archivo), Archivo, system-ui' }}>
          Panel de Control
        </h1>
        <p className="text-xs md:text-sm text-gray-400 mt-0.5">
          Visión financiera consolidada &middot; {nowDate.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
        </p>
      </header>

      {/* FILTRO DE PERÍODO */}
      <div className="mb-3 md:mb-4 flex items-center justify-between gap-3">
        <Suspense fallback={null}>
          <PeriodTabs active={periodo} />
        </Suspense>
      </div>

      {/* ALERTAS */}
      <AlertsBanner alerts={alerts} />

      {/* ══ FILA 1 — 4 KPI CARDS PROTAGONISTAS ══════════════════════════════ */}
      <section className="mb-4 md:mb-5 grid grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-3 md:gap-4">

        {/* Card 1 — Ingresos del período */}
        <div className="rounded-2xl p-3 sm:p-5 flex flex-col gap-2" style={{ background: 'linear-gradient(135deg, #2D6A4F 0%, #1B4332 100%)' }}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-emerald-200">Ingresos</p>
            {incomeGrowth !== null && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/15 text-white">
                {incomeGrowth >= 0 ? '▲' : '▼'} {Math.abs(incomeGrowth).toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-lg sm:text-2xl md:text-3xl font-mono font-normal text-white num-tabular leading-none">
            {fmtARS(periodoIncome)}
          </p>
          <p className="text-xs text-emerald-300">Período seleccionado · ARS</p>
          <div className="mt-1">
            <KpiSparkline data={incomeSpark} color="#6ee7b7" height={40} />
          </div>
        </div>

        {/* Card 2 — Egresos del período */}
        <div className="executive-card p-3 sm:p-5 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-400">Egresos</p>
            {expenseGrowth !== null && (
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${expenseGrowth <= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                {expenseGrowth >= 0 ? '+' : ''}{expenseGrowth.toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-lg sm:text-2xl md:text-3xl font-mono font-normal text-gray-700 num-tabular leading-none">
            {fmtARS(periodoExpense)}
          </p>
          <p className="text-xs text-gray-400">Período seleccionado · ARS</p>
          <div className="mt-1">
            <KpiSparkline data={expenseSpark} color="#6b7280" height={40} />
          </div>
        </div>

        {/* Card 3 — Ganancia del período */}
        <div className="executive-card p-3 sm:p-5 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-400">Ganancia</p>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${periodoGain >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
              {periodoGain >= 0 ? 'Positiva' : 'Negativa'}
            </span>
          </div>
          <p className={`text-lg sm:text-2xl md:text-3xl font-mono font-normal num-tabular leading-none ${periodoGain >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
            {periodoGain >= 0 ? '' : '−'}{fmtARS(periodoGain)}
          </p>
          <p className="text-xs text-gray-400">Ingresos − Egresos · ARS</p>
          <div className="mt-1">
            <KpiSparkline data={balanceSpark} color={periodoGain >= 0 ? '#2D6A4F' : '#ef4444'} height={40} />
          </div>
        </div>

        {/* Card 4 — Margen / Rentabilidad */}
        <div className="executive-card p-3 sm:p-5 flex flex-col">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-gray-400">Rentabilidad</p>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${marginPct >= 20 ? 'bg-emerald-50 text-emerald-700' : marginPct >= 0 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'}`}>
              {marginPct >= 0 ? 'Positivo' : 'Negativo'}
            </span>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center">
            <MarginGauge value={marginPct} height={120} />
          </div>
          <p className="text-xs text-gray-400 text-center -mt-1">
            Balance: <span className={`font-mono font-medium ${arsMonthly.balance >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
              {arsMonthly.balance >= 0 ? '+' : '−'}{fmtARS(arsMonthly.balance)}
            </span>
          </p>
        </div>

      </section>

      {/* ══ FILA 2 — GRÁFICO PRINCIPAL + DONUT DE GASTOS ════════════════════ */}
      <div className="mb-4 md:mb-5 grid grid-cols-1 lg:grid-cols-[7fr_3fr] gap-3 md:gap-4">

        {/* Panel principal — Resumen financiero */}
        <div className="executive-card flex flex-col overflow-hidden">
          <div className="px-5 py-3.5 border-b border-black/[0.05] flex justify-between items-center flex-wrap gap-2">
            <div>
              <h2 className="text-sm font-semibold text-gray-700">Resumen financiero</h2>
              <p className="text-xs text-gray-400">Ingresos · Egresos · Neto — últimos 6 meses</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#2D6A4F] inline-block" />Ingresos
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#d1d5db] inline-block" />Egresos
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-1 rounded-full bg-[#C5A065] inline-block" />Neto
              </span>
            </div>
          </div>
          <div className="p-4 flex-1">
            {financialOverviewData.some(d => d.income > 0 || d.expense > 0) ? (
              <FinancialOverviewChart data={financialOverviewData} height={250} />
            ) : (
              <div className="h-[250px] flex items-center justify-center">
                <p className="text-sm text-gray-300">Sin datos históricos aún</p>
              </div>
            )}
          </div>
        </div>

        {/* Donut — distribución gastos del mes */}
        <div className="executive-card flex flex-col overflow-hidden">
          <div className="px-5 py-3.5 border-b border-black/[0.05] flex justify-between items-center">
            <h2 className="text-sm font-semibold text-gray-700">Distribución de gastos</h2>
            <p className="text-xs text-gray-400">Este mes</p>
          </div>
          {expenseCategoryChartData.length > 0 ? (
            <div className="p-4 flex flex-col gap-3 flex-1">
              <ExpenseCategoryDonut
                data={expenseCategoryChartData}
                totalLabel="Gastos del mes"
                height={200}
              />
              <div className="flex flex-col gap-1.5 mt-1">
                {expenseCategoryChartData.map((s) => {
                  const totalGastos = expenseCategoryChartData.reduce((acc, x) => acc + x.value, 0)
                  const pct = totalGastos > 0 ? ((s.value / totalGastos) * 100).toFixed(0) : '0'
                  return (
                    <div key={s.name} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: s.itemStyle.color }} />
                        <span className="text-xs text-gray-600 truncate max-w-[110px]">{s.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-gray-400">{pct}%</span>
                        <span className="text-xs font-mono text-gray-700 num-tabular">${s.value.toLocaleString('es-AR', { minimumFractionDigits: 0 })}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-3">
              <svg className="w-10 h-10 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
              </svg>
              <p className="text-sm text-gray-400">Sin gastos categorizados este mes</p>
            </div>
          )}
        </div>

      </div>

      {/* ══ FILA 3 — MOVIMIENTOS RECIENTES + SEMÁFORO DE VENCIMIENTOS ════════ */}
      <div className="mb-4 md:mb-5 grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">

        {/* Últimos movimientos */}
        <div className="executive-card flex flex-col overflow-hidden">
          <div className="px-5 py-3.5 border-b border-black/[0.05] flex justify-between items-center">
            <div>
              <h2 className="text-sm font-semibold text-gray-700">Movimientos recientes</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {dailyStats.txHoy.length > 0 ? `${dailyStats.txHoy.length} operaci${dailyStats.txHoy.length !== 1 ? 'ones' : 'ón'} hoy` : 'Sin movimientos hoy'}
              </p>
            </div>
            <a href="#" className="text-xs font-medium text-emerald-700 hover:underline shrink-0">Ver todos →</a>
          </div>
          {transactions.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-3">
              <svg className="w-10 h-10 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <p className="text-sm text-gray-400">Aún no hay movimientos.</p>
              <p className="text-xs text-gray-300">¡Registrá tu primera operación!</p>
            </div>
          ) : (
            <div className="divide-y divide-black/[0.04]">
              {transactions.slice(0, 7).map((tx, i) => {
                const isIncome = tx.type === 'INCOME'
                const catName = (tx as { category?: { name: string } }).category?.name
                return (
                  <div key={i} className="px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50/60 transition-colors">
                    {/* Ícono circular */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isIncome ? 'bg-emerald-50' : 'bg-gray-100'}`}>
                      {isIncome ? (
                        <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
                        </svg>
                      )}
                    </div>
                    {/* Descripción + detalle */}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">{tx.description}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(tx.date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                        {catName && <span className="before:content-['·'] before:mx-1">{catName}</span>}
                      </p>
                    </div>
                    {/* Monto */}
                    <p className={`text-sm font-mono font-normal num-tabular shrink-0 ${isIncome ? 'text-emerald-700' : 'text-gray-500'}`}>
                      {isIncome ? '+' : '−'}${tx.amount.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Semáforo de vencimientos */}
        <div className="executive-card flex flex-col overflow-hidden">
          <div className="px-5 py-3.5 border-b border-black/[0.05] flex justify-between items-center">
            <div>
              <h2 className="text-sm font-semibold text-gray-700">Estado de vencimientos</h2>
              <p className="text-xs text-gray-400 mt-0.5">Créditos y deudas pendientes</p>
            </div>
            <a href="/creditos" className="text-xs font-medium text-emerald-700 hover:underline shrink-0">Ver todos →</a>
          </div>
          <div className="p-5 flex flex-col gap-4 flex-1">
            {creditosDeudas.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-2">
                <svg className="w-8 h-8 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-gray-400">Sin créditos pendientes</p>
              </div>
            ) : (
              <>
                {/* Barra proporcional apilada */}
                {(totalVencido + total48h + totalFuturo) > 0 && (
                  <div>
                    <DebtStatusBar data={debtStatusChartData} height={18} />
                    <div className="flex justify-between mt-1.5 text-[10px] text-gray-400">
                      <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />Vencidos</span>
                      <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />48hs</span>
                      <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />Futuros</span>
                    </div>
                  </div>
                )}

                {/* Tres bloques de estado */}
                <div className="grid grid-cols-3 gap-3">
                  {/* ROJO — Vencidos */}
                  <div className={`rounded-xl p-3 text-center ${credVencidos.length > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                    <div className={`w-2.5 h-2.5 rounded-full mx-auto mb-2 ${credVencidos.length > 0 ? 'bg-red-500' : 'bg-gray-200'}`} />
                    <p className="text-[10px] font-semibold text-gray-600 mb-1">Vencidos</p>
                    <p className={`text-sm font-mono font-medium num-tabular leading-tight ${credVencidos.length > 0 ? 'text-red-600' : 'text-gray-300'}`}>
                      ${totalVencido.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{credVencidos.length} reg.</p>
                  </div>
                  {/* AMARILLO — Vencen en 48hs */}
                  <div className={`rounded-xl p-3 text-center ${cred48h.length > 0 ? 'bg-amber-50' : 'bg-gray-50'}`}>
                    <div className={`w-2.5 h-2.5 rounded-full mx-auto mb-2 ${cred48h.length > 0 ? 'bg-amber-400' : 'bg-gray-200'}`} />
                    <p className="text-[10px] font-semibold text-gray-600 mb-1">En 48hs</p>
                    <p className={`text-sm font-mono font-medium num-tabular leading-tight ${cred48h.length > 0 ? 'text-amber-600' : 'text-gray-300'}`}>
                      ${total48h.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{cred48h.length} reg.</p>
                  </div>
                  {/* VERDE — Futuros */}
                  <div className={`rounded-xl p-3 text-center ${credFuturos.length > 0 ? 'bg-emerald-50' : 'bg-gray-50'}`}>
                    <div className={`w-2.5 h-2.5 rounded-full mx-auto mb-2 ${credFuturos.length > 0 ? 'bg-emerald-500' : 'bg-gray-200'}`} />
                    <p className="text-[10px] font-semibold text-gray-600 mb-1">Futuros</p>
                    <p className={`text-sm font-mono font-medium num-tabular leading-tight ${credFuturos.length > 0 ? 'text-emerald-700' : 'text-gray-300'}`}>
                      ${totalFuturo.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{credFuturos.length} reg.</p>
                  </div>
                </div>

                {/* Total deuda pendiente */}
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl mt-auto">
                  <p className="text-xs font-medium text-gray-500">Total pendiente</p>
                  <p className={`text-base font-mono num-tabular ${totalDeudaPendiente > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                    ${totalDeudaPendiente.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

      </div>

      {/* ══ FILA 4 — CUENTAS (ancho completo) ═══════════════════════════════ */}
      <div className="mb-4 md:mb-5 executive-card">
        <div className="px-5 py-3.5 border-b border-black/[0.05] flex justify-between items-center">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Cuentas</h3>
            <p className="text-xs text-gray-400 mt-0.5">{accounts.length} cuenta{accounts.length !== 1 ? 's' : ''} registrada{accounts.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="p-5">
          <AccountManager accounts={accounts} />
        </div>
      </div>

      {/* ══ FILA 5 — FORMULARIO + DIRECTORIO ════════════════════════════════ */}
      <div className="mb-4 md:mb-5 grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
        <TransactionFormCard accounts={accounts} categories={categories} contacts={contacts} areas={areas} />
        <div className="executive-card flex flex-col overflow-hidden">
          <div className="px-5 py-3.5 border-b border-black/[0.05]">
            <h3 className="text-sm font-semibold text-gray-700">Directorio de contactos</h3>
          </div>
          <div className="flex-1 overflow-y-auto">
            <ContactManager contacts={contacts} />
          </div>
        </div>
      </div>

      {/* ══ FILA 6 — ÁREAS DE NEGOCIO ════════════════════════════════════════ */}
      <div className="executive-card flex flex-col overflow-hidden">
        <div className="px-5 py-3.5 border-b border-black/[0.05]">
          <h3 className="text-sm font-semibold text-gray-700">Áreas de negocio</h3>
        </div>
        <div className="p-4">
          <AreaNegocioManager areas={areas} />
        </div>
      </div>

    </div>
  )
}
