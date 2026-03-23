'use client'

import { useState, useMemo } from 'react'

type Tx = {
  id: string
  description: string
  amount: number
  currency: string
  date: Date
  type: string
  account: { name: string }
  category: { name: string } | null
  contact: { name: string } | null
}

const CURRENCY_SYMBOL: Record<string, string> = { ARS: '$', USD: 'US$' }
const PAGE_SIZE = 20

function exportCSV(transactions: Tx[]) {
  const header = 'Fecha,Tipo,Descripción,Categoría,Contacto,Cuenta,Moneda,Monto\n'
  const rows = transactions.map(tx =>
    [
      new Date(tx.date).toLocaleDateString('es-AR'),
      tx.type === 'INCOME' ? 'Ingreso' : 'Gasto',
      `"${tx.description}"`,
      tx.category?.name || '-',
      tx.contact?.name || '-',
      tx.account.name,
      tx.currency,
      (tx.type === 'INCOME' ? tx.amount : -tx.amount).toFixed(2),
    ].join(',')
  ).join('\n')

  const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `movimientos_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function ReportTable({ transactions }: { transactions: Tx[] }) {
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL')
  const [filterCurrency, setFilterCurrency] = useState('ALL')
  const [page, setPage] = useState(1)

  const currencies = useMemo(() => ['ALL', ...Array.from(new Set(transactions.map(t => t.currency)))], [transactions])

  const filtered = useMemo(() => {
    return transactions.filter(tx => {
      if (filterType !== 'ALL' && tx.type !== filterType) return false
      if (filterCurrency !== 'ALL' && tx.currency !== filterCurrency) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        return (
          tx.description.toLowerCase().includes(q) ||
          tx.account.name.toLowerCase().includes(q) ||
          tx.category?.name.toLowerCase().includes(q) ||
          tx.contact?.name.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [transactions, filterType, filterCurrency, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const filteredIncome = filtered.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0)
  const filteredExpense = filtered.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0)

  return (
    <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.02)' }}>
      {/* Toolbar */}
      <div className="bg-[#1A1A1A] px-5 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-sm font-medium text-white">Registro completo</h2>
        <button
          onClick={() => exportCSV(filtered)}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-military text-white text-sm font-medium hover:bg-brand-military-dark transition-colors rounded-xl"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Exportar CSV
        </button>
      </div>

      {/* Filtros */}
      <div className="px-4 py-4 flex flex-wrap gap-3 items-center bg-gray-50">
        <div className="relative flex-1 min-w-[180px]">
          <svg className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Buscar descripción, cuenta, categoría..."
            className="w-full pl-9 pr-4 py-2.5 text-sm font-medium border border-black/[0.08] focus:border-brand-military outline-none bg-white transition-all placeholder:text-gray-400 text-gray-700 rounded-xl"
          />
        </div>

        <div className="flex p-1 bg-white rounded-xl shrink-0">
          {(['ALL', 'INCOME', 'EXPENSE'] as const).map(f => (
            <button key={f} onClick={() => { setFilterType(f); setPage(1) }}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${filterType === f ? 'bg-brand-military text-white' : 'text-gray-500 hover:text-gray-800'}`}
            >
              {f === 'ALL' ? 'Todos' : f === 'INCOME' ? 'Ingresos' : 'Egresos'}
            </button>
          ))}
        </div>

        {currencies.length > 2 && (
          <div className="flex p-1 bg-white rounded-xl shrink-0">
            {currencies.map(c => (
              <button key={c} onClick={() => { setFilterCurrency(c); setPage(1) }}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${filterCurrency === c ? 'bg-[#3A4D39] text-white' : 'text-gray-500 hover:text-gray-800'}`}
              >
                {c === 'ALL' ? 'Todas' : c}
              </button>
            ))}
          </div>
        )}

        <div className="ml-auto flex gap-6 text-xs font-medium shrink-0">
          <span className="text-brand-military-dark">↑ ${filteredIncome.toLocaleString('es-AR', { minimumFractionDigits: 0 })}</span>
          <span className="text-gray-500">↓ ${filteredExpense.toLocaleString('es-AR', { minimumFractionDigits: 0 })}</span>
          <span className="text-gray-400">{filtered.length} registros</span>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-[90px]">Fecha</th>
              <th className="px-3 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Descripción</th>
              <th className="px-3 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-[130px]">Categoría</th>
              <th className="px-3 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-[120px]">Contacto</th>
              <th className="px-3 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-[120px]">Cuenta</th>
              <th className="px-3 py-3 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-[120px]">Monto</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-50">
            {paged.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-400 font-medium">Sin resultados</td></tr>
            ) : paged.map(tx => (
              <tr key={tx.id} className="hover:bg-gray-50/70 transition-colors">
                <td className="px-3 py-3 text-[10px] font-mono text-gray-500 whitespace-nowrap">
                  {new Date(tx.date).toLocaleDateString('es-AR')}
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${tx.type === 'INCOME' ? 'bg-brand-military' : 'bg-gray-400'}`}></div>
                    <span className="text-sm font-medium text-gray-800 truncate max-w-[280px]">{tx.description}</span>
                  </div>
                </td>
                <td className="px-3 py-3">
                  {tx.category ? (
                    <span className="text-xs font-medium px-2.5 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                      {tx.category.name}
                    </span>
                  ) : <span className="text-[10px] text-gray-400">—</span>}
                </td>
                <td className="px-3 py-3 text-xs font-medium text-gray-500">
                  {tx.contact?.name || <span className="text-gray-400">—</span>}
                </td>
                <td className="px-3 py-3 text-xs font-medium text-gray-500">
                  {tx.account.name}
                </td>
                <td className="px-3 py-3 text-right whitespace-nowrap">
                  <span className={`text-sm font-normal font-mono num-tabular ${tx.type === 'INCOME' ? 'text-brand-military-dark' : 'text-gray-500'}`}>
                    {tx.type === 'INCOME' ? '+' : '-'}{CURRENCY_SYMBOL[tx.currency] || '$'}{Math.abs(tx.amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="px-3 py-3 flex items-center justify-between bg-gray-50">
          <span className="text-xs font-medium text-gray-400">
            Pág {currentPage} / {totalPages}
          </span>
          <div className="flex gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}
              className="px-3 py-1.5 text-xs font-medium bg-white rounded-lg hover:text-brand-military disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-gray-500">
              Anterior
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}
              className="px-3 py-1.5 text-xs font-medium bg-white rounded-lg hover:text-brand-military disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-gray-500">
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
