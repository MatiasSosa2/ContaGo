import type { CashClosingSummary } from '@/server/db/cash'

function money(value: number, currency: string) {
  const symbol = currency === 'USD' ? 'US$' : '$'
  return `${symbol}${Math.abs(value).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`
}

function dateLabel(value: Date) {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires',
  }).format(value).replace('.', '')
}

export default function CashClosingsReport({ closings }: { closings: CashClosingSummary[] }) {
  const differencesByCurrency = closings.reduce<Record<string, number>>((totals, closing) => {
    totals[closing.currency] = (totals[closing.currency] ?? 0) + closing.difference
    return totals
  }, {})

  return (
    <details className="mt-5 overflow-hidden rounded-xl border border-[var(--border-token)] bg-[var(--surface)] shadow-[var(--shadow-sm)]">
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 marker:hidden transition-colors hover:bg-[var(--surface-muted)] sm:px-5">
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-100)] text-[var(--brand-700)] dark:bg-[var(--brand-800)] dark:text-[var(--brand-300)]" aria-hidden>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-[var(--text)]">Arqueos y cierres de caja</span>
            <span className="mt-0.5 block truncate text-xs text-[var(--text-tertiary)]">Registro de los últimos cierres realizados</span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-3">
          <span className="rounded-md bg-[var(--surface-muted)] px-2 py-1 text-xs font-semibold tabular-nums text-[var(--text-secondary)]">{closings.length}</span>
          <svg className="cash-closing-chevron h-4 w-4 text-[var(--text-tertiary)] transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </summary>

      <div className="border-t border-[var(--border-token)]">
        {closings.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[var(--text-secondary)]">Todavía no hay cierres registrados. Podés iniciar un arqueo desde el botón +.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-x-6 gap-y-2 border-b border-[var(--border-token)] bg-[var(--surface-muted)] px-4 py-3 text-xs sm:px-5">
              <span className="text-[var(--text-secondary)]">Cierres consultados <strong className="ml-1 tabular-nums text-[var(--text)]">{closings.length}</strong></span>
              {Object.entries(differencesByCurrency).map(([currency, total]) => (
                <span key={currency} className="text-[var(--text-secondary)]">
                  Diferencia neta {currency} <strong className={`ml-1 tabular-nums ${total > 0 ? 'text-[var(--income)]' : total < 0 ? 'text-[var(--expense)]' : 'text-[var(--text)]'}`}>
                    {total > 0 ? '+' : total < 0 ? '−' : ''}{money(total, currency)}
                  </strong>
                </span>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[660px] text-left text-xs">
                <thead className="bg-[var(--surface)] text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                  <tr>
                    <th className="px-4 py-3 font-semibold sm:px-5">Fecha / responsable</th>
                    <th className="px-4 py-3 font-semibold">Caja</th>
                    <th className="px-4 py-3 text-right font-semibold">Esperado</th>
                    <th className="px-4 py-3 text-right font-semibold">Contado</th>
                    <th className="px-4 py-3 text-right font-semibold sm:px-5">Diferencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-token)]">
                  {closings.map((closing) => (
                    <tr key={closing.id} className="text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)]">
                      <td className="px-4 py-3 sm:px-5">
                        <span className="block font-medium text-[var(--text)]">{dateLabel(closing.date)}</span>
                        {closing.closedBy && <span className="mt-0.5 block text-[10px] text-[var(--text-tertiary)]">{closing.closedBy}</span>}
                      </td>
                      <td className="px-4 py-3 font-medium text-[var(--text)]">{closing.accountName}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">{money(closing.systemBalance, closing.currency)}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">{money(closing.countedBalance, closing.currency)}</td>
                      <td className={`px-4 py-3 text-right font-mono font-semibold tabular-nums sm:px-5 ${closing.difference > 0 ? 'text-[var(--income)]' : closing.difference < 0 ? 'text-[var(--expense)]' : 'text-[var(--text-tertiary)]'}`}>
                        {closing.difference > 0 ? '+' : closing.difference < 0 ? '−' : ''}{money(closing.difference, closing.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </details>
  )
}
