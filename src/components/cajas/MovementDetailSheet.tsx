'use client'

import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { MovementRow, CajasMovementItem } from '../CajasClient'

const SYMBOL: Record<string, string> = { ARS: '$', USD: 'US$' }
const fmt = (v: number, currency = 'ARS') => `${SYMBOL[currency] ?? '$'}${Math.round(Math.abs(v)).toLocaleString('es-AR')}`
const fechaLarga = (d: string | Date) =>
  new Date(d).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const fechaCorta = (d: string | Date) => new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '')

const ESTADO: Record<string, string> = { COBRADO: 'Cobrado', PAGADO: 'Pagado', PENDIENTE: 'Pendiente', PARCIAL: 'Parcial', VENCIDO: 'Vencido' }

function Grupo({ titulo, children }: { titulo?: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      {titulo && <p className="mb-1.5 px-4 text-[13px] text-[#8E8E93]">{titulo}</p>}
      <div className="divide-y divide-black/[0.06] overflow-hidden rounded-xl bg-white dark:divide-white/[0.08] dark:bg-[#1C1C1E]">{children}</div>
    </section>
  )
}

function Fila({ label, value, sub, strong = false }: { label: ReactNode; value?: ReactNode; sub?: ReactNode; strong?: boolean }) {
  return (
    <div className="flex min-h-[44px] items-center justify-between gap-4 px-4 py-2.5 text-[15px]">
      <div className="min-w-0">
        <p className={`truncate ${strong ? 'font-semibold' : ''} text-[#1C1C1E] dark:text-white`}>{label}</p>
        {sub && <p className="truncate text-[13px] text-[#8E8E93]">{sub}</p>}
      </div>
      {value !== undefined && <div className={`shrink-0 tabular-nums ${strong ? 'font-semibold text-[#1C1C1E] dark:text-white' : 'text-[#8E8E93]'}`}>{value}</div>}
    </div>
  )
}

/**
 * Detalle de un movimiento de Cajas, en una hoja estilo iOS (solo lectura): datos, productos,
 * formas de pago y cuotas.
 */
export default function MovementDetailSheet({ mov, titulo, onClose }: {
  mov: MovementRow
  /** "Venta de productos", "Cambio de caja", etc. (lo calcula la tabla) */
  titulo: string
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  const ingreso = mov.type === 'INCOME'
  const partes: CajasMovementItem[] = mov.parts ?? [mov]
  const contado = partes.filter((p) => !p.esCredito)
  const cuotas = partes.filter((p) => p.esCredito).sort((a, b) => (a.cuotaNumero ?? 0) - (b.cuotaNumero ?? 0))
  const items = mov.operacion?.items ?? []
  const color = mov.isTransfer ? 'text-[#1C1C1E] dark:text-white' : ingreso ? 'text-[#248A3D] dark:text-[#30D158]' : 'text-[#D70015] dark:text-[#FF453A]'

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="reg-backdrop absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="reg-sheet relative flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-[#F2F2F7] shadow-2xl dark:bg-black md:rounded-3xl"
        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif' }}
      >
        <div className="flex justify-center pt-2 md:hidden" aria-hidden>
          <span className="h-[5px] w-9 rounded-full bg-black/15 dark:bg-white/20" />
        </div>
        {/* Encabezado: tipo, importe grande y fecha */}
        <div className="relative px-5 pb-1 pt-4 text-center">
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="absolute right-4 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-black/[0.06] text-[#8E8E93] transition active:scale-90 dark:bg-white/10"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
          <p className="text-[13px] text-[#8E8E93]">{titulo}</p>
          <p className={`mt-1 text-[34px] font-semibold tracking-tight tabular-nums ${color}`}>
            {mov.isTransfer ? '' : ingreso ? '+' : '−'}{fmt(mov.amount, mov.currency)}
          </p>
          <p className="text-[13px] capitalize text-[#8E8E93]">{fechaLarga(mov.date)}</p>
        </div>

        <div className="overflow-y-auto px-4 pb-8">
          {/* Datos generales */}
          <Grupo>
            {mov.isTransfer && mov.transferLabel && <Fila label="Movimiento" value={mov.transferLabel} />}
            {mov.category && <Fila label="Categoría" value={`${mov.category.name}${mov.subcategory ? ` › ${mov.subcategory.name}` : ''}`} />}
            {!mov.isTransfer && <Fila label={ingreso ? 'Cliente' : 'Proveedor'} value={mov.contact?.name ?? (ingreso ? 'Consumidor final' : '—')} />}
            {mov.description && <Fila label="Descripción" sub={mov.description} />}
          </Grupo>

          {/* Productos de la operación */}
          {items.length > 0 && (
            <Grupo titulo="Productos">
              {items.map((it, i) => (
                <Fila
                  key={i}
                  label={it.producto.nombre}
                  sub={it.precioUnitario !== undefined ? `${it.cantidad.toLocaleString('es-AR')} × ${fmt(it.precioUnitario, mov.currency)}` : `${it.cantidad.toLocaleString('es-AR')} u.`}
                  value={it.subtotal !== undefined ? fmt(it.subtotal, mov.currency) : undefined}
                />
              ))}
              {(mov.operacion?.descuento ?? 0) > 0 && <Fila label="Descuento" value={`−${fmt(mov.operacion!.descuento, mov.currency)}`} />}
              <Fila label="Total" value={fmt(mov.operacion?.total ?? mov.amount, mov.currency)} strong />
            </Grupo>
          )}

          {/* Cómo se cobró / pagó */}
          {!mov.isTransfer && contado.length > 0 && (
            <Grupo titulo={ingreso ? 'Cobrado en' : 'Pagado con'}>
              {contado.map((p) => (
                <Fila key={p.id} label={p.account?.name ?? '—'} sub={p.account?.type === 'CASH' ? 'Efectivo' : 'Virtual'} value={fmt(p.amount, p.currency)} />
              ))}
            </Grupo>
          )}
          {mov.isTransfer && mov.account && (
            <Grupo titulo="Caja">
              <Fila label={mov.account.name} sub={ingreso ? 'Entró' : 'Salió'} value={fmt(mov.amount, mov.currency)} />
            </Grupo>
          )}

          {/* Cuotas a crédito */}
          {cuotas.length > 0 && (
            <Grupo titulo={ingreso ? 'A cobrar en cuotas' : 'A pagar en cuotas'}>
              {cuotas.map((c) => (
                <Fila
                  key={c.id}
                  label={c.cuotasTotal ? `Cuota ${c.cuotaNumero}/${c.cuotasTotal}` : 'A crédito'}
                  sub={[c.fechaVencimiento ? `Vence ${fechaCorta(c.fechaVencimiento)}` : null, c.estado ? ESTADO[c.estado] ?? c.estado : null].filter(Boolean).join(' · ')}
                  value={fmt(c.amount, c.currency)}
                />
              ))}
            </Grupo>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
