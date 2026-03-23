'use client'

import { deleteTransaction } from '@/app/actions'
import { useState, useMemo } from 'react'

type Transaction = {
  id: string
  description: string
  amount: number
  currency: string
  date: Date
  type: string
  account: { name: string }
  category: { name: string } | null
  contact: { name: string } | null
  areaNegocio: { nombre: string } | null
}

const CURRENCY_SYMBOL: Record<string, string> = { ARS: '$', USD: 'US$' }
const PAGE_SIZE = 15

export default function TransactionList({ transactions, onDelete }: { transactions: Transaction[], onDelete?: (id: string) => Promise<void> }) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL')
  const [filterArea, setFilterArea] = useState<string>('ALL')
  const [page, setPage] = useState(1)

  async function handleDelete(id: string) {
    if(!confirm('¿Estás seguro de eliminar este movimiento?')) return
    setDeletingId(id)
    if (onDelete) {
      await onDelete(id)
    } else {
      await deleteTransaction(id)
    }
    setDeletingId(null)
  }

  const todasLasAreas = useMemo(() => {
    const nombres = [...new Set(transactions.map(t => t.areaNegocio?.nombre).filter(Boolean))] as string[]
    return nombres.sort()
  }, [transactions])

  const filtered = useMemo(() => {
    let result = transactions
    if (filterType !== 'ALL') {
      result = result.filter(t => t.type === filterType)
    }
    if (filterArea !== 'ALL') {
      result = result.filter(t => t.areaNegocio?.nombre === filterArea)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(t =>
        t.description.toLowerCase().includes(q) ||
        t.account.name.toLowerCase().includes(q) ||
        t.category?.name.toLowerCase().includes(q) ||
        t.contact?.name.toLowerCase().includes(q) ||
        t.areaNegocio?.nombre.toLowerCase().includes(q)
      )
    }
    return result
  }, [transactions, filterType, filterArea, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  if (transactions.length === 0) {
     return (
        <div className="p-12 text-center text-gray-400 flex flex-col items-center">
          <svg className="w-12 h-12 mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          <p className="text-xs font-bold uppercase tracking-widest">No hay movimientos registrados.</p>
        </div>
     )
  }

  return (
    <div>
      {/* Search & Filter Bar */}
      <div className="px-4 py-3 border-b border-black/[0.05] flex flex-col sm:flex-row gap-3 items-center bg-gray-50/50">
        <div className="relative flex-1 w-full">
          <svg className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Buscar por descripción, cuenta, categoría..."
            className="w-full pl-10 pr-4 py-2 text-sm border border-black/[0.08] rounded-xl focus:border-brand-military outline-none bg-white transition-all placeholder:text-gray-400 text-gray-700"
          />
        </div>
        <div className="flex gap-2 items-center shrink-0">
          {todasLasAreas.length > 0 && (
            <div className="relative">
              <select
                value={filterArea}
                onChange={e => { setFilterArea(e.target.value); setPage(1) }}
                className={`text-sm font-medium border py-2 pl-3 pr-7 appearance-none outline-none transition-all rounded-xl ${
                  filterArea !== 'ALL'
                    ? 'border-brand-military bg-brand-military-light text-brand-military-dark'
                    : 'border-black/[0.08] bg-white text-gray-500'
                }`}
              >
                <option value="ALL">Todas las áreas</option>
                {todasLasAreas.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
              <div className="absolute right-2 top-2.5 pointer-events-none">
                <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
          )}
          <div className="flex p-1 bg-gray-100 rounded-xl gap-1">
            {(['ALL', 'INCOME', 'EXPENSE'] as const).map(f => (
              <button
                key={f}
                type="button"
                onClick={() => { setFilterType(f); setPage(1) }}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                  filterType === f
                    ? 'bg-brand-military text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {f === 'ALL' ? 'Todos' : f === 'INCOME' ? 'Ingresos' : 'Egresos'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-8 text-center text-slate-400 text-xs font-bold uppercase tracking-wider">
          No se encontraron resultados para &quot;{search}&quot;
        </div>
      ) : (
      <>
      <div className="overflow-hidden">
      <table className="w-full">
        <thead>
        <tr className="bg-[#F0F4EF] border-b border-[#D8E2D6]">
            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#4A6741]">Descripción</th>
            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#4A6741] w-44">Entidad</th>
            <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-[#4A6741] w-32">Importe</th>
            <th className="px-4 py-3 w-10"></th>
          </tr>
        </thead>
        <tbody>
        {paged.map((tx, i) => (
          <tr key={tx.id} className={`group hover:bg-gray-50/50 transition-colors border-b border-black/[0.04] ${
            i === paged.length - 1 ? 'border-b-0' : ''
          }`}>
            <td className={`px-4 py-4 ${
              tx.type === 'INCOME'
                ? 'border-l-[3px] border-l-emerald-500/60'
                : 'border-l-[3px] border-l-stone-300/70'
            }`}>
              <div className="flex items-center gap-3">
                 <div className="overflow-hidden">
                    <p className="text-sm font-medium text-slate-800 truncate" title={tx.description}>{tx.description}</p>
                    <p className="text-xs text-slate-400 mt-0.5 font-mono">{new Date(tx.date).toLocaleDateString('es-AR')}</p>
                 </div>
              </div>
            </td>
            
            <td className="px-4 py-4">
               <div className="flex flex-col gap-1.5 items-start">
                  <span className="text-sm font-medium text-slate-600 truncate max-w-full">{tx.account.name}</span>
                  <div className="flex flex-wrap gap-1">
                     {tx.category && (
                     <span className="text-[11px] px-2 py-0.5 bg-[#F0F4EF] text-[#3A4D39] rounded-sm font-medium">
                       {tx.category.name}
                     </span>
                     )}
                     {tx.contact && (
                       <span className="text-[11px] px-2 py-0.5 bg-stone-100 text-stone-500 border border-stone-200 rounded-sm">
                         {tx.contact.name}
                       </span>
                     )}
                     {tx.areaNegocio && (
                       <span className="text-[11px] px-2 py-0.5 bg-[#1A1A1A] text-stone-300 rounded-sm font-medium">
                         {tx.areaNegocio.nombre}
                       </span>
                     )}
                  </div>
               </div>
            </td>

            <td className="px-4 py-4 whitespace-nowrap text-right">
               <span className={`text-base font-mono font-normal num-tabular tracking-tight ${
                  tx.type === 'INCOME' ? 'text-brand-military-dark' : 'text-gray-600'
               }`}>
                  {tx.type === 'INCOME' ? '+' : '−'}{CURRENCY_SYMBOL[tx.currency] || '$'}{Math.abs(tx.amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
               </span>
            </td>

            <td className="px-4 py-4 whitespace-nowrap text-right">
               <button 
                  onClick={() => handleDelete(tx.id)}
                  disabled={deletingId === tx.id}
                  className="text-slate-300 hover:text-red-500 transition-colors p-1.5 rounded-lg"
               >
                  {deletingId === tx.id ? (
                      <span className="animate-spin h-4 w-4 block border-2 border-current border-t-transparent rounded-full"></span>
                  ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  )}
               </button>
            </td>
          </tr>
        ))}
        </tbody>
      </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-5 py-4 border-t border-black/[0.05] flex items-center justify-between bg-gray-50/50">
          <span className="text-sm text-gray-400">
            {filtered.length} registro{filtered.length !== 1 ? 's' : ''} — pág. {currentPage} de {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="px-4 py-2 text-sm font-medium border border-black/[0.08] rounded-xl bg-white hover:border-brand-military hover:text-brand-military-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-gray-600"
            >
              ← Anterior
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="px-4 py-2 text-sm font-medium border border-black/[0.08] rounded-xl bg-white hover:border-brand-military hover:text-brand-military-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-gray-600"
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  )
}
