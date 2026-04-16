'use client'

import { useState } from 'react'
import TransactionForm from './TransactionForm'
import { createTransaction } from '@/app/actions'
import type { Account, Category, Contact, AreaNegocio } from './TransactionForm'

export default function TransactionFormCard({
  accounts,
  categories,
  contacts,
  areas,
}: {
  accounts: Account[]
  categories: Category[]
  contacts: Contact[]
  areas: AreaNegocio[]
}) {
  const [activeTab, setActiveTab] = useState<'INCOME' | 'EXPENSE'>('INCOME')

  const handleCreate = async (formData: FormData) => {
    return await createTransaction(formData)
  }

  const headerBg = activeTab === 'INCOME' ? 'bg-brand-military' : 'bg-brand-oxide'

  return (
    <div className="bg-white/90 backdrop-blur-sm border border-gray-200/80 shadow-lg rounded-sm flex flex-col h-full overflow-hidden">
      {/* Header dinámico según tipo activo */}
      <div className={`px-5 py-4 flex justify-between items-center shrink-0 ${headerBg}`}>
        <div>
          <h2 className="text-[10px] font-black text-white uppercase tracking-widest">
            {activeTab === 'INCOME' ? 'Registrar Ingreso' : 'Registrar Gasto'}
          </h2>
          <p className="text-[9px] text-white/50 font-medium mt-0.5 uppercase tracking-wider">
            {activeTab === 'INCOME' ? 'Entrada de dinero' : 'Salida de dinero'}
          </p>
        </div>
        <div className="flex border-2 border-white/20 overflow-hidden">
          <button
            onClick={() => setActiveTab('INCOME')}
            className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'INCOME' ? 'bg-white text-brand-military' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
          >
            Ingreso
          </button>
          <button
            onClick={() => setActiveTab('EXPENSE')}
            className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all border-l-2 border-white/20 ${activeTab === 'EXPENSE' ? 'bg-white text-brand-oxide' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
          >
            Gasto
          </button>
        </div>
      </div>

      {/* Cuerpo del formulario sobre fondo gris claro para que los bloques blancos resalten */}
      <div className="p-5 flex-1 bg-gray-100/80 overflow-y-auto">
        <TransactionForm
          accounts={accounts}
          categories={categories}
          contacts={contacts}
          areas={areas}
          onSubmit={handleCreate}
          initialType={activeTab}
          onTypeChange={setActiveTab}
        />
      </div>
    </div>
  )
}
