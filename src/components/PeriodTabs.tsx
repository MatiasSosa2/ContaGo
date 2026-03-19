'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTransition, useState } from 'react'
import DateRangeModal from './DateRangeModal'

export const PERIODS = [
  { key: 'diario',    label: 'Diario' },
  { key: 'semanal',   label: 'Semanal' },
  { key: 'mensual',   label: 'Mensual' },
  { key: 'semestral', label: 'Semestral' },
  { key: 'anual',     label: 'Anual' },
  { key: 'custom',    label: 'Seleccionar período' },
] as const

export type PeriodKey = typeof PERIODS[number]['key']

interface PeriodTabsProps {
  active: PeriodKey
  customFrom?: string
  customTo?: string
}

export default function PeriodTabs({ active, customFrom, customTo }: PeriodTabsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [modalOpen, setModalOpen] = useState(false)

  function select(key: PeriodKey) {
    if (key === 'custom') {
      setModalOpen(true)
      return
    }
    const params = new URLSearchParams(searchParams.toString())
    params.set('periodo', key)
    params.delete('from')
    params.delete('to')
    startTransition(() => router.replace(`${pathname}?${params.toString()}`))
  }

  function handleRangeConfirm(from: string, to: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('periodo', 'custom')
    params.set('from', from)
    params.set('to', to)
    setModalOpen(false)
    startTransition(() => router.replace(`${pathname}?${params.toString()}`))
  }

  // Format custom label when active
  function getCustomLabel(): string {
    if (active !== 'custom' || !customFrom || !customTo) return 'Seleccionar período'
    const fmtDate = (s: string) => {
      const d = new Date(s + 'T12:00:00')
      return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
    }
    return `${fmtDate(customFrom)} – ${fmtDate(customTo)}`
  }

  return (
    <>
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide pb-0.5">
        {PERIODS.map(p => {
          const isActive = p.key === active
          const label = p.key === 'custom' ? getCustomLabel() : p.label
          return (
            <button
              key={p.key}
              onClick={() => select(p.key)}
              disabled={pending}
              className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 whitespace-nowrap"
              style={
                isActive
                  ? { background: '#1B4332', color: '#6EE7B7' }
                  : { background: 'rgba(0,0,0,0.05)', color: '#6b7280' }
              }
            >
              {p.key === 'custom' && !isActive && (
                <svg className="w-3 h-3 inline-block mr-1 -mt-px" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
              {label}
            </button>
          )
        })}
      </div>
      <DateRangeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={handleRangeConfirm}
        initialFrom={customFrom}
        initialTo={customTo}
      />
    </>
  )
}
