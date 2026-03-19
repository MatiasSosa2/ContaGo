'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import TransactionForm from './TransactionForm'
import { getAccounts, getCategories, getContacts, getAreasNegocio, createTransaction } from '@/app/actions'
import type { Account, Category, Contact, AreaNegocio } from './TransactionForm'

export default function FloatingActionButton() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'INCOME' | 'EXPENSE'>('INCOME')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<{
    accounts: Account[]
    categories: Category[]
    contacts: Contact[]
    areas: AreaNegocio[]
  } | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [accounts, categories, contacts, areas] = await Promise.all([
      getAccounts(),
      getCategories(),
      getContacts(),
      getAreasNegocio(),
    ])
    setData({ accounts, categories, contacts, areas })
    setLoading(false)
  }, [])

  const handleOpen = () => {
    setOpen(true)
    fetchData()
  }

  const handleClose = () => {
    setOpen(false)
    setActiveTab('INCOME')
  }

  // Cerrar con Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Bloquear scroll del body
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (pathname.startsWith('/auth') || pathname.startsWith('/select-business')) {
    return null
  }

  const headerBg = activeTab === 'INCOME' ? 'bg-brand-military' : 'bg-[#1A1A1A]'

  const handleCreate = async (formData: FormData) => {
    const result = await createTransaction(formData)
    if (result.success) handleClose()
    return result
  }

  return (
    <>
      {/* Botón flotante */}
      <button
        onClick={handleOpen}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-110 hover:shadow-xl active:scale-95"
        style={{ background: 'linear-gradient(135deg, #2D6A4F 0%, #1B4332 100%)' }}
        aria-label="Registrar movimiento"
      >
        <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>

      {/* Modal overlay */}
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

          {/* Panel */}
          <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col bg-white rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300 md:mx-4">
            {/* Header */}
            <div className={`px-5 py-4 flex justify-between items-center shrink-0 ${headerBg} transition-colors duration-200`}>
              <div>
                <h2 className="text-[10px] font-black text-white uppercase tracking-widest">
                  {activeTab === 'INCOME' ? 'Registrar Ingreso' : 'Registrar Gasto'}
                </h2>
                <p className="text-[9px] text-white/50 font-medium mt-0.5 uppercase tracking-wider">
                  {activeTab === 'INCOME' ? 'Entrada de dinero' : 'Salida de dinero'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex border-2 border-white/20 overflow-hidden">
                  <button
                    onClick={() => setActiveTab('INCOME')}
                    className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'INCOME' ? 'bg-white text-brand-military' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
                  >
                    Ingreso
                  </button>
                  <button
                    onClick={() => setActiveTab('EXPENSE')}
                    className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all border-l-2 border-white/20 ${activeTab === 'EXPENSE' ? 'bg-white text-gray-900' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
                  >
                    Gasto
                  </button>
                </div>
                <button onClick={handleClose} className="text-white/60 hover:text-white transition-colors" aria-label="Cerrar">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-5 flex-1 bg-gray-100/80 overflow-y-auto">
              {loading || !data ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-brand-military border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <TransactionForm
                  accounts={data.accounts}
                  categories={data.categories}
                  contacts={data.contacts}
                  areas={data.areas}
                  onSubmit={handleCreate}
                  initialType={activeTab}
                  onTypeChange={setActiveTab}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
