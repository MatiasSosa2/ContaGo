'use client'

import { useState } from 'react'

interface CajasAccountItem {
  id: string
  name: string
  type: string
  currency: string
  currentBalance: number
  recentMovements: number
  todayVariation: number
}

interface CajasGroupData {
  accounts: CajasAccountItem[]
  total: number
  todayVariation: number
}

interface CajasData {
  efectivo: CajasGroupData
  virtual: CajasGroupData
  summaryMessage: string
  aiTipEfectivo: string
  aiTipVirtual: string
}

const CURRENCY_SYMBOL: Record<string, string> = { ARS: '$', USD: 'US$' }

function fmtMoney(v: number, currency = 'ARS') {
  const sym = CURRENCY_SYMBOL[currency] || '$'
  return `${sym}${Math.abs(v).toLocaleString('es-AR', { minimumFractionDigits: 0 })}`
}

// ── Ícono Efectivo ──
function CashIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
    </svg>
  )
}

// ── Ícono Virtual ──
function VirtualIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
    </svg>
  )
}

// ── Ícono IA ──
function SparkleIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09ZM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456Z" />
    </svg>
  )
}

// ── Columna de grupo (Efectivo o Virtual) ──
function CajaGroupColumn({
  label,
  icon,
  group,
  aiTip,
  variant = 'military',
}: {
  label: string
  icon: React.ReactNode
  group: CajasGroupData
  aiTip: string
  variant?: 'military' | 'gold'
}) {
  // Agrupar cuentas por moneda para dropdowns
  const currencies = [...new Set(group.accounts.map(a => a.currency))]
  const [selectedCurrency, setSelectedCurrency] = useState(currencies[0] || 'ARS')
  const filtered = group.accounts.filter(a => a.currency === selectedCurrency)
  const filteredTotal = filtered.reduce((s, a) => s + a.currentBalance, 0)
  const filteredTodayVar = filtered.reduce((s, a) => s + a.todayVariation, 0)

  return (
    <div className="flex flex-col gap-5">
      {/* Card principal */}
      <div className="bg-white dark:bg-[#141414] rounded-2xl border border-[#E5E7EB] dark:border-white/10 overflow-hidden" style={{ boxShadow: '0px 2px 8px rgba(0,0,0,0.05)' }}>

        {/* Header + monto total */}
        <div className={`px-5 pt-5 pb-4 border-b ${
          variant === 'gold'
            ? 'bg-[#FBF8F2] dark:bg-[#1C1812] border-[#E8DFC6] dark:border-white/[0.07]'
            : 'bg-[#F0F4EF] dark:bg-[#0D1F14] border-[#D8E2D6] dark:border-white/[0.07]'
        }`}>
          <div className="flex items-center gap-2.5 mb-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              variant === 'gold'
                ? 'bg-brand-gold/15 text-brand-gold'
                : 'bg-brand-military-light text-brand-military'
            }`}>
              {icon}
            </div>
            <h2 className="text-base font-semibold text-[#1F2937] dark:text-[#E8E8E8]">{label}</h2>
          </div>
          <p className="text-3xl md:text-[32px] font-mono font-bold text-[#1F2937] dark:text-[#E8E8E8] num-tabular leading-none">
            {CURRENCY_SYMBOL[selectedCurrency]}{filteredTotal.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
          </p>
        </div>

        {/* Dropdown selector de moneda */}
        {currencies.length > 1 && (
          <div className="px-5 pb-3">
            <div className="relative inline-block">
              <select
                value={selectedCurrency}
                onChange={e => setSelectedCurrency(e.target.value)}
                className="appearance-none bg-white dark:bg-[#1F1F1F] border border-[#E5E7EB] dark:border-white/10 text-sm font-medium text-[#374151] dark:text-[#D1D5DB] rounded-lg px-3 py-2 pr-8 outline-none focus:border-brand-military transition-colors cursor-pointer"
              >
                {currencies.map(c => (
                  <option key={c} value={c}>
                    {c === 'ARS' ? 'Pesos argentinos (ARS)' : c === 'USD' ? 'Dólares (USD)' : c}
                  </option>
                ))}
              </select>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="w-3.5 h-3.5 text-[#9CA3AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
          </div>
        )}

        {/* Lista de sub-cajas */}
        <div className="px-4 pb-2">
          {filtered.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-[#9CA3AF]">No hay cuentas en esta categoría</p>
              <p className="text-xs text-[#D1D5DB] mt-1">Creá una desde el botón +</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map(acc => (
                <div
                  key={acc.id}
                  className="flex items-center justify-between px-3.5 py-3 rounded-xl cursor-pointer transition-all duration-150 hover:bg-[#F3F4F6] dark:hover:bg-white/5 group"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#1F2937] dark:text-[#E8E8E8] group-hover:text-brand-military transition-colors truncate">
                      {acc.name}
                    </p>
                    <p className="text-xs text-[#9CA3AF] mt-0.5">
                      {acc.recentMovements > 0
                        ? `${acc.recentMovements} movimiento${acc.recentMovements !== 1 ? 's' : ''} esta semana`
                        : 'Sin movimientos recientes'}
                    </p>
                  </div>
                  <p className="text-sm font-mono font-semibold text-[#1F2937] dark:text-[#E8E8E8] num-tabular shrink-0 ml-3">
                    {fmtMoney(acc.currentBalance, acc.currency)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Card resumen inferior */}
          <div className="mx-4 mb-4 mt-1 rounded-xl px-4 py-3.5 bg-[#1A1A1A]" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-stone-400">
                Total {label.toLowerCase()}
              </span>
              <span className="text-sm font-mono font-bold text-white num-tabular">
                {fmtMoney(filteredTotal, selectedCurrency)}
              </span>
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className={`text-xs font-medium ${filteredTodayVar >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {filteredTodayVar >= 0 ? '+' : '−'}{fmtMoney(filteredTodayVar, selectedCurrency)} hoy
              </span>
              <button className="text-xs font-medium text-stone-500 hover:text-brand-gold transition-colors">
            </button>
          </div>
        </div>

      </div>

      {/* Consejos de la IA */}
      <div>
        <div className="flex items-center gap-2 mb-2.5 px-1">
          <div className="w-6 h-6 rounded-lg bg-brand-gold/15 flex items-center justify-center text-brand-gold">
            <SparkleIcon />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">Consejos de la IA</span>
        </div>
        <div className="rounded-xl border border-white/[0.07] px-4 py-4 relative overflow-hidden bg-[#1A1A1A]" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.25)' }}>
          <div className="absolute inset-y-0 left-0 w-[3px] bg-brand-gold rounded-l-xl" />
          <p className="text-sm text-stone-300 leading-relaxed pl-1">{aiTip}</p>
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ──
export default function CajasClient({ data }: { data: CajasData }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <CajaGroupColumn
        label="Efectivo"
        icon={<CashIcon />}
        group={data.efectivo}
        aiTip={data.aiTipEfectivo}
        variant="military"
      />
      <CajaGroupColumn
        label="Virtual"
        icon={<VirtualIcon />}
        group={data.virtual}
        aiTip={data.aiTipVirtual}
        variant="gold"
      />
    </div>
  )
}
