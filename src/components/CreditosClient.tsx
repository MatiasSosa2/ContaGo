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

function sortByLatest(items: CreditoTx[]) {
  return [...items].sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
}

function getPendingItems(items: CreditoTx[]) {
  return items.filter(item => {
    const realEstado = isVencido(item.fechaVencimiento, item.estado) ? 'VENCIDO' : item.estado
    return realEstado === 'PENDIENTE' || realEstado === 'VENCIDO'
  })
}

function getPendingTotal(items: CreditoTx[]) {
  return getPendingItems(items).reduce((sum, item) => sum + item.amount, 0)
}

function SummarySplitCard({
  porCobrar,
  porPagar,
  diferencia,
}: {
  porCobrar: number
  porPagar: number
  diferencia: number
}) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_240px] xl:items-center">
      <div
        className="relative w-full min-h-[92px] overflow-hidden border border-[#E7E5E4] px-4 py-3 shadow-[0_8px_20px_rgba(0,0,0,0.05)] backdrop-blur-[6px] dark:border-[#3A3A3A]"
      >
        <svg className="pointer-events-none absolute inset-0 h-full w-full dark:hidden" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="balance-left-fill-light" x1="0" y1="0" x2="68" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#D7EEE4" />
              <stop offset="100%" stopColor="#C6E3D6" />
            </linearGradient>
            <linearGradient id="balance-right-fill-light" x1="48" y1="0" x2="100" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#F0D8B7" />
              <stop offset="100%" stopColor="#E3C08F" />
            </linearGradient>
            <linearGradient id="balance-line-light" x1="16" y1="0" x2="68" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#C6E3D6" />
              <stop offset="48%" stopColor="#C6E3D6" />
              <stop offset="52%" stopColor="#EACCA3" />
              <stop offset="100%" stopColor="#EACCA3" />
            </linearGradient>
          </defs>

          <path d="M0 0 H68 L48 42 H24 L16 98 H0 Z" fill="url(#balance-left-fill-light)" />
          <path d="M68 0 H100 V100 H16 L24 42 H48 Z" fill="url(#balance-right-fill-light)" />
          <path
            d="M68 0 L48 42 L24 42 L16 98"
            fill="none"
            stroke="url(#balance-line-light)"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <svg className="pointer-events-none absolute inset-0 hidden h-full w-full dark:block" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="balance-left-fill-dark" x1="0" y1="0" x2="68" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#26483B" />
              <stop offset="100%" stopColor="#1F3A31" />
            </linearGradient>
            <linearGradient id="balance-right-fill-dark" x1="48" y1="0" x2="100" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#6B4D2D" />
              <stop offset="100%" stopColor="#533A20" />
            </linearGradient>
            <linearGradient id="balance-line-dark" x1="16" y1="0" x2="68" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#1F3A31" />
              <stop offset="48%" stopColor="#1F3A31" />
              <stop offset="52%" stopColor="#6B4D2D" />
              <stop offset="100%" stopColor="#6B4D2D" />
            </linearGradient>
          </defs>

          <path d="M0 0 H68 L48 42 H24 L16 98 H0 Z" fill="url(#balance-left-fill-dark)" />
          <path d="M68 0 H100 V100 H16 L24 42 H48 Z" fill="url(#balance-right-fill-dark)" />
          <path
            d="M68 0 L48 42 L24 42 L16 98"
            fill="none"
            stroke="url(#balance-line-dark)"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <div
          className="pointer-events-none absolute inset-0 opacity-80 dark:opacity-40"
          style={{
            background: 'linear-gradient(90deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 50%, rgba(255,255,255,0.08) 100%)',
          }}
        />

        <div className="relative flex items-center justify-between gap-4">
          <div className="z-[2] flex min-w-0 flex-col items-start">
            <span className="text-[24px] font-mono font-bold leading-none text-[#1A1A1A] num-tabular dark:text-[#F4FFF8]">
              {fmt(porCobrar)}
            </span>
            <span className="mt-0.5 text-[11px] text-[#666666] dark:text-[#D6D3D1]">Por cobrar</span>
          </div>

          <div className="z-[2] flex min-w-0 flex-col items-end">
            <span className="text-[24px] font-mono font-bold leading-none text-[#1A1A1A] num-tabular dark:text-[#FFF7EA]">
              {fmt(porPagar)}
            </span>
            <span className="mt-0.5 text-[11px] text-[#666666] dark:text-[#D6D3D1]">Pendiente de pago</span>
          </div>
        </div>
      </div>

      <div className="flex min-h-[92px] flex-col justify-center border border-[#E7E5E4] bg-white px-5 py-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] dark:border-[#3A3A3A] dark:bg-[#181818]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400 dark:text-[#9F9F9F]">Balance neto</p>
        <p className={`mt-2 text-[30px] font-mono font-bold leading-none num-tabular ${diferencia >= 0 ? 'text-brand-military-dark dark:text-[#6EBC8A]' : 'text-[#9A3412] dark:text-[#F59E0B]'}`}>
          {diferencia >= 0 ? '' : '-'}{fmt(Math.abs(diferencia))}
        </p>
      </div>
    </div>
  )
}

function CreditoListRow({
  tx,
  isCxC,
  onMarcar,
  isPending,
}: {
  tx: CreditoTx
  isCxC: boolean
  onMarcar: (id: string, estado: string) => void
  isPending: boolean
}) {
  const venc = isVencido(tx.fechaVencimiento, tx.estado)
  const realEstado = venc ? 'VENCIDO' : tx.estado
  const isPendOrVenc = tx.estado === 'PENDIENTE' || tx.estado === 'VENCIDO' || venc
  const principalName = tx.contact?.name || tx.description

  return (
    <div
      className={`flex items-center justify-between border border-[#ECE7E1] px-3.5 py-3 transition-all duration-150 hover:bg-[#F3F4F6] dark:border-[#2F2F2F] dark:hover:bg-white/5 group ${venc ? 'bg-red-50/60 dark:bg-red-950/20' : ''}`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[#1F2937] dark:text-[#E8E8E8] truncate">
          {principalName}
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
          {tx.contact?.name && tx.description !== tx.contact.name && (
            <span className="text-xs text-[#6B7280] dark:text-[#A3A3A3] truncate">{tx.description}</span>
          )}
          {tx.category && (
            <span className="text-xs text-[#9CA3AF] truncate">{tx.category.name}</span>
          )}
          {tx.fechaVencimiento && (
            <span className={`text-xs font-mono num-tabular ${venc ? 'text-red-500 font-semibold' : 'text-[#9CA3AF]'}`}>
              vence {fmtDate(tx.fechaVencimiento)}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0 ml-3">
        <div className="flex flex-col items-end gap-1">
          <p className={`text-sm font-mono font-semibold num-tabular ${isCxC ? 'text-brand-military-dark dark:text-[#6EBC8A]' : 'text-brand-gold-dark dark:text-[#C5A065]'}`}>
            {fmt(tx.amount, tx.currency)}
          </p>
          <span className={`inline-flex text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 border
            ${realEstado === 'PENDIENTE' ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800' : ''}
            ${realEstado === 'VENCIDO' ? 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800' : ''}
            ${realEstado === 'COBRADO' || realEstado === 'PAGADO' ? 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-white/10' : ''}
          `}>
            {ESTADO_LABELS[realEstado] || realEstado}
          </span>
        </div>

        {isPendOrVenc ? (
          <button
            onClick={() => onMarcar(tx.id, isCxC ? 'COBRADO' : 'PAGADO')}
            disabled={isPending}
            className={`text-[10px] font-bold uppercase tracking-wide px-3 py-1.5 transition-all
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
            className="text-[10px] font-bold uppercase tracking-wide px-3 py-1.5 bg-white dark:bg-white/5 text-[#6B7280] dark:text-gray-400 border border-[#E5E7EB] dark:border-white/10 hover:border-brand-military hover:text-brand-military transition-all disabled:opacity-50"
          >
            Reabrir
          </button>
        )}
      </div>
    </div>
  )
}

function CreditosListModal({
  open,
  onClose,
  title,
  items,
  isCxC,
  onMarcar,
  isPending,
}: {
  open: boolean
  onClose: () => void
  title: string
  items: CreditoTx[]
  isCxC: boolean
  onMarcar: (id: string, estado: string) => void
  isPending: boolean
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5 sm:p-6">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />

      <div className="relative my-4 flex max-h-[calc(100vh-56px)] w-full max-w-[920px] flex-col overflow-hidden border border-stone-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.18)] sm:max-h-[calc(100vh-72px)] dark:border-white/10 dark:bg-[#141414]">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center border border-stone-200 bg-white/95 text-stone-500 shadow-sm transition-colors hover:text-stone-700 dark:border-white/10 dark:bg-[#1B1B1B] dark:text-stone-300"
          aria-label="Cerrar modal"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="border-b border-stone-100 px-5 py-4 pr-14 dark:border-white/10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">Detalle completo</p>
          <h3 className="mt-0.5 text-base font-semibold text-stone-900 dark:text-[#E8E8E8]">{title}</h3>
          <p className="mt-0.5 text-sm text-stone-500 dark:text-[#A3A3A3]">Mostrando {items.length} registro{items.length !== 1 ? 's' : ''}.</p>
        </div>

        <div className="overflow-y-auto px-4 py-4">
          {items.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-[#9CA3AF]">No hay registros para mostrar.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {items.map(tx => (
                <CreditoListRow
                  key={tx.id}
                  tx={tx}
                  isCxC={isCxC}
                  onMarcar={onMarcar}
                  isPending={isPending}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
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
}: {
  label: string
  icon: React.ReactNode
  items: CreditoTx[]
  filtro: FiltroType
  onMarcar: (id: string, estado: string) => void
  isPending: boolean
}) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const filtered = filtro === 'TODOS' ? items : items.filter(c => {
    const realEstado = isVencido(c.fechaVencimiento, c.estado) ? 'VENCIDO' : c.estado
    return realEstado === filtro
  })
  const orderedFiltered = sortByLatest(filtered)
  const previewItems = orderedFiltered.slice(0, 3)

  const totalPendiente = getPendingTotal(items)

  const isCxC = items[0]?.type === 'INCOME' || label === 'CxC'

  return (
    <div
      className="bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-white/10 overflow-hidden"
      style={{ boxShadow: '0px 2px 8px rgba(0,0,0,0.05)' }}
    >
        {/* Header + monto total pendiente */}
        <div className="px-5 pt-5 pb-4 bg-gradient-to-b from-[#FAFBFC] to-white dark:from-[#141414] dark:to-[#141414]">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className={`w-9 h-9 flex items-center justify-center ${isCxC ? 'bg-brand-military-light text-brand-military' : 'bg-brand-gold-light text-brand-gold-dark'}`}>
                {icon}
              </div>
              <div>
                <h2 className="text-base font-semibold text-[#1F2937] dark:text-[#E8E8E8]">{label}</h2>
                <p className="text-xs text-[#9CA3AF]">{isCxC ? 'Cuentas por cobrar' : 'Cuentas por pagar'}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="border border-[#D6D3D1] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#57534E] transition-colors hover:border-[#A8A29E] hover:text-[#1F2937] dark:border-white/10 dark:bg-white/5 dark:text-[#D6D3D1]"
            >
              Ver todos
            </button>
          </div>
          <p className={`text-3xl md:text-[32px] font-mono font-bold num-tabular leading-none ${isCxC ? 'text-brand-military-dark dark:text-[#6EBC8A]' : 'text-brand-gold-dark dark:text-[#C5A065]'}`}>
            {fmt(totalPendiente)}
          </p>
          <p className="text-xs text-[#9CA3AF] mt-1">pendiente de {isCxC ? 'cobro' : 'pago'}</p>
        </div>

        {/* Lista de items */}
        <div className="px-4 pb-2">
          {orderedFiltered.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-[#9CA3AF]">Sin registros para este filtro</p>
              <p className="text-xs text-[#D1D5DB] dark:text-[#555] mt-1">Registrá un movimiento desde el Panel Principal</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {previewItems.map(tx => (
                <CreditoListRow
                  key={tx.id}
                  tx={tx}
                  isCxC={isCxC}
                  onMarcar={onMarcar}
                  isPending={isPending}
                />
              ))}
            </div>
          )}
        </div>

        <CreditosListModal
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={label}
          items={orderedFiltered}
          isCxC={isCxC}
          onMarcar={onMarcar}
          isPending={isPending}
        />
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
  const totalPorCobrar = getPendingTotal(cxc)
  const totalPorPagar = getPendingTotal(cxp)
  const diferenciaNeta = totalPorCobrar - totalPorPagar

  return (
    <div className="space-y-6">
      {/* Filtro de estado */}
      <div className="flex flex-wrap gap-2">
        {(['TODOS', 'PENDIENTE', 'VENCIDO', 'COBRADO', 'PAGADO'] as const).map(e => (
          <button
            key={e}
            onClick={() => setFiltro(e)}
            className={`text-xs font-semibold uppercase tracking-wider px-4 py-2 border transition-all
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
        />
        <CreditoGroupPanel
          label="CxP — Por pagar"
          icon={<CxPIcon />}
          items={cxp}
          filtro={filtro}
          onMarcar={handleMarcar}
          isPending={isPending}
        />
      </div>

      <SummarySplitCard
        porCobrar={totalPorCobrar}
        porPagar={totalPorPagar}
        diferencia={diferenciaNeta}
      />
    </div>
  )
}
