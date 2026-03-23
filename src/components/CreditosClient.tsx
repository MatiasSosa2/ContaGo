'use client'

import { useState, useTransition } from 'react'
import { marcarEstadoCredito } from '@/app/actions'

export interface CreditoTx {
  id: string
  description: string
  amount: number
  currency: string
  type: string
  date: Date | string
  fechaVencimiento: Date | string | null
  estado: string
  contact: { id: string; name: string; type: string } | null
  category: { name: string } | null
}

export interface CreditosSummary {
  pendienteCxC: number
  pendienteCxP: number
  vencidos: number
  posicionNeta: number
  countCxC: number
  countCxP: number
}

const CURRENCY_SYMBOL: Record<string, string> = { ARS: '$', USD: 'US$' }

const ESTADO_LABELS: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  VENCIDO: 'Vencido',
  COBRADO: 'Cobrado',
  PAGADO: 'Pagado',
}

type FiltroType = 'TODOS' | 'PENDIENTE' | 'VENCIDO' | 'COBRADO' | 'PAGADO'

function fmt(v: number, cur = 'ARS') {
  return `${CURRENCY_SYMBOL[cur] || '$'}${Math.abs(v).toLocaleString('es-AR', { minimumFractionDigits: 0 })}`
}

function fmtDate(d: Date | string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function isVencido(fechaVencimiento: Date | string | null, estado: string) {
  if (!fechaVencimiento || estado === 'COBRADO' || estado === 'PAGADO') return false
  return new Date(fechaVencimiento) < new Date()
}

// ── Íconos ──
function CxCIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
    </svg>
  )
}

function CxPIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
    </svg>
  )
}

function SparkleIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09ZM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456Z" />
    </svg>
  )
}

// ── Panel CxC (cobrar) o CxP (pagar) ──
function CreditoGroupPanel({
  label,
  icon,
  items,
  filtro,
  onMarcar,
  isPending,
  aiTip,
}: {
  label: string
  icon: React.ReactNode
  items: CreditoTx[]
  filtro: FiltroType
  onMarcar: (id: string, estado: string) => void
  isPending: boolean
  aiTip: string
}) {
  const filtered = filtro === 'TODOS' ? items : items.filter(c => {
    const realEstado = isVencido(c.fechaVencimiento, c.estado) ? 'VENCIDO' : c.estado
    return realEstado === filtro
  })

  const totalPendiente = items
    .filter(c => c.estado === 'PENDIENTE' || c.estado === 'VENCIDO')
    .reduce((s, c) => s + c.amount, 0)

  const isCxC = items[0]?.type === 'INCOME' || label === 'CxC'

  return (
    <div className="flex flex-col gap-5">
      {/* Card principal */}
      <div
        className="bg-white dark:bg-[#141414] rounded-2xl border border-[#E5E7EB] dark:border-white/10 overflow-hidden"
        style={{ boxShadow: '0px 2px 8px rgba(0,0,0,0.05)' }}
      >
        {/* Header + monto total pendiente */}
        <div className="px-5 pt-5 pb-4 bg-gradient-to-b from-[#FAFBFC] to-white dark:from-[#141414] dark:to-[#141414]">
          <div className="flex items-center gap-2.5 mb-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isCxC ? 'bg-brand-military-light text-brand-military' : 'bg-brand-gold-light text-brand-gold-dark'}`}>
              {icon}
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#1F2937] dark:text-[#E8E8E8]">{label}</h2>
              <p className="text-xs text-[#9CA3AF]">{isCxC ? 'Cuentas por cobrar' : 'Cuentas por pagar'}</p>
            </div>
          </div>
          <p className={`text-3xl md:text-[32px] font-mono font-bold num-tabular leading-none ${isCxC ? 'text-brand-military-dark dark:text-[#6EBC8A]' : 'text-brand-gold-dark dark:text-[#C5A065]'}`}>
            {fmt(totalPendiente)}
          </p>
          <p className="text-xs text-[#9CA3AF] mt-1">pendiente de {isCxC ? 'cobro' : 'pago'}</p>
        </div>

        {/* Lista de items */}
        <div className="px-4 pb-2">
          {filtered.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-[#9CA3AF]">Sin registros para este filtro</p>
              <p className="text-xs text-[#D1D5DB] dark:text-[#555] mt-1">Registrá un movimiento desde el Panel Principal</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {filtered.map(tx => {
                const venc = isVencido(tx.fechaVencimiento, tx.estado)
                const realEstado = venc ? 'VENCIDO' : tx.estado
                const isPendOrVenc = tx.estado === 'PENDIENTE' || tx.estado === 'VENCIDO' || venc
                return (
                  <div
                    key={tx.id}
                    className={`flex items-center justify-between px-3.5 py-3 rounded-xl transition-all duration-150 hover:bg-[#F3F4F6] dark:hover:bg-white/5 group ${venc ? 'bg-red-50/60 dark:bg-red-950/20' : ''}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#1F2937] dark:text-[#E8E8E8] truncate">
                        {tx.description}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {tx.contact && (
                          <span className="text-xs text-[#9CA3AF] truncate">{tx.contact.name}</span>
                        )}
                        {tx.fechaVencimiento && (
                          <span className={`text-xs font-mono num-tabular ${venc ? 'text-red-500 font-semibold' : 'text-[#9CA3AF]'}`}>
                            vence {fmtDate(tx.fechaVencimiento)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0 ml-3">
                      {/* Estado badge */}
                      <span className={`hidden sm:inline-flex text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-lg border
                        ${realEstado === 'PENDIENTE' ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800' : ''}
                        ${realEstado === 'VENCIDO' ? 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800' : ''}
                        ${realEstado === 'COBRADO' || realEstado === 'PAGADO' ? 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-white/10' : ''}
                      `}>
                        {ESTADO_LABELS[realEstado] || realEstado}
                      </span>

                      {/* Monto */}
                      <p className={`text-sm font-mono font-semibold num-tabular ${isCxC ? 'text-brand-military-dark dark:text-[#6EBC8A]' : 'text-brand-gold-dark dark:text-[#C5A065]'}`}>
                        {fmt(tx.amount, tx.currency)}
                      </p>

                      {/* Botón acción */}
                      {isPendOrVenc ? (
                        <button
                          onClick={() => onMarcar(tx.id, isCxC ? 'COBRADO' : 'PAGADO')}
                          disabled={isPending}
                          className={`text-[10px] font-bold uppercase tracking-wide px-3 py-1.5 rounded-lg transition-all
                            ${isCxC
                              ? 'bg-brand-military text-white hover:bg-brand-military-dark'
                              : 'bg-brand-gold text-white hover:bg-brand-gold-dark'
                            } disabled:opacity-50`}
                        >
                          {isCxC ? 'Cobrar' : 'Pagar'}
                        </button>
                      ) : (
                        <button
                          onClick={() => onMarcar(tx.id, 'PENDIENTE')}
                          disabled={isPending}
                          className="text-[10px] font-bold uppercase tracking-wide px-3 py-1.5 rounded-lg bg-white dark:bg-white/5 text-[#6B7280] dark:text-gray-400 border border-[#E5E7EB] dark:border-white/10 hover:border-brand-military hover:text-brand-military transition-all disabled:opacity-50"
                        >
                          Reabrir
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Resumen inferior */}
        <div className="mx-4 mb-4 mt-1 rounded-xl px-4 py-3.5 bg-[#F9FAFB] dark:bg-[#0D0D0D]">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-[#374151] dark:text-[#D1D5DB]">
              Total pendiente
            </span>
            <span className={`text-sm font-mono font-bold num-tabular ${isCxC ? 'text-brand-military-dark dark:text-[#6EBC8A]' : 'text-brand-gold-dark dark:text-[#C5A065]'}`}>
              {fmt(totalPendiente)}
            </span>
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xs text-[#9CA3AF]">
              {items.filter(c => c.estado === 'PENDIENTE' || c.estado === 'VENCIDO').length} {isCxC ? 'facturas pendientes' : 'obligaciones pendientes'}
            </span>
            <span className="text-xs text-[#9CA3AF]">
              {items.filter(c => isVencido(c.fechaVencimiento, c.estado)).length > 0 && (
                <span className="text-red-500 font-semibold">
                  {items.filter(c => isVencido(c.fechaVencimiento, c.estado)).length} vencido{items.filter(c => isVencido(c.fechaVencimiento, c.estado)).length !== 1 ? 's' : ''}
                </span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Consejo IA */}
      <div>
        <div className="flex items-center gap-2 mb-2.5 px-1">
          <div className="w-6 h-6 rounded-lg bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-600">
            <SparkleIcon />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">Consejo IA</span>
        </div>
        <div
          className="bg-white dark:bg-[#141414] rounded-xl border border-[#E5E7EB] dark:border-white/10 px-4 py-3.5"
          style={{ boxShadow: '0px 1px 4px rgba(0,0,0,0.04)' }}
        >
          <p className="text-sm text-[#4B5563] dark:text-[#B0B0B0] leading-relaxed">{aiTip}</p>
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ──
export default function CreditosClient({
  creditos: initialCreditos,
}: {
  creditos: CreditoTx[]
}) {
  const [creditos, setCreditos] = useState<CreditoTx[]>(initialCreditos)
  const [filtro, setFiltro] = useState<FiltroType>('PENDIENTE')
  const [isPending, startTransition] = useTransition()

  function handleMarcar(id: string, estado: string) {
    startTransition(async () => {
      await marcarEstadoCredito(id, estado)
      // Revalidar optimistamente en cliente
      setCreditos(prev =>
        prev.map(c => c.id === id ? { ...c, estado } : c)
      )
    })
  }

  const cxc = creditos.filter(c => c.type === 'INCOME')
  const cxp = creditos.filter(c => c.type === 'EXPENSE')

  const pendienteCxC = cxc.filter(c => c.estado === 'PENDIENTE' || c.estado === 'VENCIDO').reduce((a, t) => a + t.amount, 0)
  const pendienteCxP = cxp.filter(c => c.estado === 'PENDIENTE' || c.estado === 'VENCIDO').reduce((a, t) => a + t.amount, 0)
  const vencidos = creditos.filter(c => isVencido(c.fechaVencimiento, c.estado)).length
  const posicionNeta = pendienteCxC - pendienteCxP

  // Consejos IA simples contextuales
  const aiTipCxC = vencidos > 0
    ? `Tenés ${vencidos} factura${vencidos !== 1 ? 's' : ''} vencida${vencidos !== 1 ? 's' : ''}. Contactá a tus clientes para regularizar el cobro lo antes posible.`
    : pendienteCxC > 0
      ? `Tenés $${pendienteCxC.toLocaleString('es-AR')} por cobrar. Asegurate de hacer seguimiento de las fechas de vencimiento.`
      : 'Todo al día con los cobros. ¡Excelente gestión!'

  const aiTipCxP = pendienteCxP > 0
    ? `Tenés $${pendienteCxP.toLocaleString('es-AR')} en obligaciones pendientes. Planificá los pagos según los vencimientos.`
    : 'Sin deudas pendientes. Tu flujo de pagos está en orden.'

  return (
    <div className="space-y-6">
      {/* KPIs resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-[#E5E7EB] dark:border-white/10 p-4" style={{ boxShadow: '0px 2px 8px rgba(0,0,0,0.04)' }}>
          <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-1">CxC Pendiente</p>
          <p className="text-xl font-mono font-bold text-brand-military-dark dark:text-[#6EBC8A] num-tabular">{fmt(pendienteCxC)}</p>
          <p className="text-xs text-[#9CA3AF] mt-0.5">{cxc.filter(c => c.estado === 'PENDIENTE' || c.estado === 'VENCIDO').length} facturas</p>
        </div>
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-[#E5E7EB] dark:border-white/10 p-4" style={{ boxShadow: '0px 2px 8px rgba(0,0,0,0.04)' }}>
          <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-1">CxP Pendiente</p>
          <p className="text-xl font-mono font-bold text-brand-gold-dark dark:text-[#C5A065] num-tabular">{fmt(pendienteCxP)}</p>
          <p className="text-xs text-[#9CA3AF] mt-0.5">{cxp.filter(c => c.estado === 'PENDIENTE' || c.estado === 'VENCIDO').length} obligaciones</p>
        </div>
        <div className={`rounded-2xl border p-4 ${vencidos > 0 ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900' : 'bg-white dark:bg-[#141414] border-[#E5E7EB] dark:border-white/10'}`} style={{ boxShadow: '0px 2px 8px rgba(0,0,0,0.04)' }}>
          <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${vencidos > 0 ? 'text-red-500' : 'text-[#9CA3AF]'}`}>Vencidos</p>
          <p className={`text-xl font-mono font-bold num-tabular ${vencidos > 0 ? 'text-red-600 dark:text-red-400' : 'text-[#9CA3AF]'}`}>{vencidos}</p>
          <p className={`text-xs mt-0.5 ${vencidos > 0 ? 'text-red-400' : 'text-[#9CA3AF]'}`}>{vencidos > 0 ? 'Requieren atención' : 'Sin atrasos'}</p>
        </div>
        <div className="bg-[#141414] dark:bg-[#0D0D0D] rounded-2xl border border-white/10 p-4" style={{ boxShadow: '0px 2px 8px rgba(0,0,0,0.04)' }}>
          <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-1">Posición Neta</p>
          <p className={`text-xl font-mono font-bold num-tabular ${posicionNeta >= 0 ? 'text-[#6EBC8A]' : 'text-red-400'}`}>
            {posicionNeta >= 0 ? '+' : '−'}{fmt(Math.abs(posicionNeta))}
          </p>
          <p className="text-xs text-[#555] mt-0.5">CxC − CxP</p>
        </div>
      </div>

      {/* Filtro de estado */}
      <div className="flex flex-wrap gap-2">
        {(['TODOS', 'PENDIENTE', 'VENCIDO', 'COBRADO', 'PAGADO'] as const).map(e => (
          <button
            key={e}
            onClick={() => setFiltro(e)}
            className={`text-xs font-semibold uppercase tracking-wider px-4 py-2 rounded-xl border transition-all
              ${filtro === e
                ? 'bg-brand-military text-white border-brand-military'
                : 'bg-white dark:bg-[#141414] text-[#6B7280] dark:text-gray-400 border-[#E5E7EB] dark:border-white/10 hover:border-brand-military hover:text-brand-military'
              }`}
          >
            {e === 'TODOS' ? 'Todos' : ESTADO_LABELS[e]}
          </button>
        ))}
      </div>

      {/* Dos columnas: CxC y CxP */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CreditoGroupPanel
          label="CxC — Por cobrar"
          icon={<CxCIcon />}
          items={cxc}
          filtro={filtro}
          onMarcar={handleMarcar}
          isPending={isPending}
          aiTip={aiTipCxC}
        />
        <CreditoGroupPanel
          label="CxP — Por pagar"
          icon={<CxPIcon />}
          items={cxp}
          filtro={filtro}
          onMarcar={handleMarcar}
          isPending={isPending}
          aiTip={aiTipCxP}
        />
      </div>
    </div>
  )
}
