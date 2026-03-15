'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

export const PERIODS = [
  { key: 'semanal',    label: 'Semanal' },
  { key: 'mensual',    label: 'Mensual' },
  { key: 'trimestral', label: 'Trimestral' },
  { key: 'semestral',  label: 'Semestral' },
  { key: '12meses',    label: '12 meses' },
] as const

export type PeriodKey = typeof PERIODS[number]['key']

export default function PeriodTabs({ active }: { active: PeriodKey }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  function select(key: PeriodKey) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('periodo', key)
    startTransition(() => router.replace(`${pathname}?${params.toString()}`))
  }

  return (
    <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide pb-0.5">
      {PERIODS.map(p => {
        const isActive = p.key === active
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
            {p.label}
          </button>
        )
      })}
    </div>
  )
}
