'use client'

import { useState, useMemo } from 'react'

export type Account = { id: string, name: string, currency: string }
export type Category = { id: string, name: string }
export type Contact = { id: string, name: string }
export type AreaNegocio = { id: string, nombre: string }

const CURRENCY_SYMBOL: Record<string, string> = { ARS: '$', USD: 'US$' }

type Props = {
  accounts: Account[]
  categories: Category[]
  contacts: Contact[]
  areas: AreaNegocio[]
  onSubmit?: (formData: FormData) => Promise<{ success: boolean; error?: string }>
  initialType?: 'INCOME' | 'EXPENSE'
  onTypeChange?: (type: 'INCOME' | 'EXPENSE') => void
}

export default function TransactionForm({ accounts, categories, contacts, areas, onSubmit, initialType = 'INCOME', onTypeChange }: Props) {
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  // Initialize with prop to prevent hydration mismatch for now, but really controlled by parent or local
  const [type, setType] = useState(initialType)
  
  // Sync internal state if prop changes
  useMemo(() => {
     setType(initialType)
  }, [initialType])

  const [accountId, setAccountId] = useState(accounts[0]?.id || '')
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '')
  const [contactId, setContactId] = useState('')
  const [areaNegocioId, setAreaNegocioId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [esCredito, setEsCredito] = useState(false)
  const [estadoCredito, setEstadoCredito] = useState('PENDIENTE')
  const [fechaVencimiento, setFechaVencimiento] = useState('')
  // Bien de Uso
  const [esBienDeUso, setEsBienDeUso] = useState(false)
  const [bienCategoria, setBienCategoria] = useState('TECNOLOGIA')
  const [bienVidaUtil, setBienVidaUtil] = useState(60)
  const [bienValorResidual, setBienValorResidual] = useState('')

  const BIEN_CATEGORIAS = [
    { value: 'TECNOLOGIA', label: 'Tecnología', icon: '💻' },
    { value: 'MOBILIARIO', label: 'Mobiliario', icon: '🪑' },
    { value: 'VEHICULO', label: 'Vehículo', icon: '🚗' },
    { value: 'HERRAMIENTA', label: 'Herramienta', icon: '🔧' },
    { value: 'INMUEBLE', label: 'Inmueble', icon: '🏢' },
    { value: 'OTRO', label: 'Otro', icon: '📦' },
  ]

  const handleTypeChange = (newType: 'INCOME' | 'EXPENSE') => {
      setType(newType)
      setError(null)
      if(onTypeChange) onTypeChange(newType)
  }

  const selectedCurrency = useMemo(() => {
    const account = accounts.find(a => a.id === accountId)
    return account?.currency || 'ARS'
  }, [accountId, accounts])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    
    // Ensure all fields are present
    if (!accountId) formData.set('accountId', accounts[0]?.id || '')
    if (!categoryId && categories.length > 0) formData.set('categoryId', categories[0]?.id || '')
    
    // Explicitly set type from state to ensure consistency
    formData.set('type', type)

    if (onSubmit) {
      const result = await onSubmit(formData)
      setSubmitting(false)
      if (!result.success) {
        setError(result.error || 'Error desconocido')
        return
      }
      setAmount('')
      setDescription('')
      // Don't reset everything, keep context
    }
  }

  return (
    <form onSubmit={handleSubmit} className="h-full flex flex-col">
      {error && (
        <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-red-400 hover:text-red-900 ml-3">&times;</button>
        </div>
      )}

      {/* Type Selector */}
      {!onTypeChange && (
        <div className="flex mb-5 bg-gray-100 rounded-xl p-1 gap-1">
          <button type="button" onClick={() => handleTypeChange('INCOME')}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
              type === 'INCOME'
                ? 'bg-brand-military text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}>
            Ingreso
          </button>
          <button type="button" onClick={() => handleTypeChange('EXPENSE')}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
              type === 'EXPENSE'
                ? 'bg-[#1A1A1A] text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}>
            Gasto
          </button>
        </div>
      )}

      <div className="flex-1 flex flex-col gap-3">

        {/* ── IMPORTE ── */}
        <div>
          <p className="text-xs font-medium text-gray-400 mb-3">Importe</p>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1.5">Monto *</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg font-light">{CURRENCY_SYMBOL[selectedCurrency]}</span>
                <input
                  type="number" step="0.01" name="amount" value={amount}
                  onChange={e => setAmount(e.target.value)} placeholder="0.00"
                  className="w-full pl-9 pr-4 py-3 text-3xl font-mono font-light text-gray-900 bg-white border border-black/[0.08] rounded-xl outline-none focus:border-brand-military transition-all placeholder:text-gray-300"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1.5">Descripción *</label>
              <input
                type="text" name="description" value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="¿De qué se trata este movimiento?"
                className="w-full text-sm font-medium text-gray-800 placeholder:text-gray-300 border border-black/[0.08] bg-white py-3 px-4 rounded-xl focus:outline-none focus:border-brand-military transition-colors"
                required
              />
            </div>
          </div>
        </div>

        {/* ── CLASIFICACIÓN ── */}
        <div>
          <p className="text-xs font-medium text-gray-400 mb-3">Clasificación</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1.5">Cuenta</label>
              <div className="relative">
                <select name="accountId" value={accountId} onChange={e => setAccountId(e.target.value)}
                  className="w-full border border-black/[0.08] bg-white py-2.5 px-3 rounded-xl outline-none appearance-none text-sm font-medium text-gray-700 focus:border-brand-military transition-all">
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name} ({acc.currency})</option>
                  ))}
                </select>
                <div className="absolute right-3 top-3 pointer-events-none">
                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1.5">Categoría</label>
              <div className="relative">
                <select name="categoryId" value={categoryId} onChange={e => setCategoryId(e.target.value)}
                  className="w-full border border-black/[0.08] bg-white py-2.5 px-3 rounded-xl outline-none appearance-none text-sm font-medium text-gray-700 focus:border-brand-military transition-all">
                  <option value="">Sin categoría</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-3 pointer-events-none">
                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── DETALLES ── */}
        <div>
          <p className="text-xs font-medium text-gray-400 mb-3">Detalles</p>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1.5">Fecha</label>
                <input type="date" name="date" value={date} onChange={e => setDate(e.target.value)}
                  className="w-full border border-black/[0.08] bg-white py-2.5 px-3 rounded-xl outline-none text-sm font-medium text-gray-700 focus:border-brand-military transition-all font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1.5">Contacto</label>
                <div className="relative">
                  <select value={contactId} onChange={e => setContactId(e.target.value)}
                    className="w-full border border-black/[0.08] bg-white py-2.5 px-3 rounded-xl outline-none appearance-none text-sm font-medium text-gray-700 focus:border-brand-military transition-all">
                    <option value="">Sin contacto</option>
                    {contacts.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-3 pointer-events-none">
                    <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </div>
            </div>

            {areas.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1.5">Área de negocio</label>
                <div className="relative">
                  <select value={areaNegocioId} onChange={e => setAreaNegocioId(e.target.value)}
                    className="w-full border border-black/[0.08] bg-white py-2.5 px-3 rounded-xl outline-none appearance-none text-sm font-medium text-gray-700 focus:border-brand-military transition-all">
                    <option value="">Sin área asignada</option>
                    {areas.map(a => (
                      <option key={a.id} value={a.id}>{a.nombre}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-3 pointer-events-none">
                    <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </div>
            )}

            {/* Crédito / Deuda toggle */}
            <div className="border-t border-black/[0.05] pt-3">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={esCredito}
                  onChange={e => setEsCredito(e.target.checked)}
                  className="w-4 h-4 accent-brand-military cursor-pointer"
                />
                <span className="text-sm font-medium text-gray-500 group-hover:text-brand-military transition">
                  {type === 'INCOME' ? 'Es una cuenta por cobrar' : 'Es una cuenta por pagar'}
                </span>
              </label>

              {esCredito && (
                <div className="mt-3 grid grid-cols-2 gap-3 pl-6 border-l-2 border-brand-military/30">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1.5">Vencimiento</label>
                    <input type="date" value={fechaVencimiento} onChange={e => setFechaVencimiento(e.target.value)}
                      className="w-full border border-black/[0.08] bg-white py-2 px-3 rounded-xl outline-none text-sm font-medium text-gray-700 focus:border-brand-military transition font-mono" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1.5">Estado</label>
                    <div className="relative">
                      <select value={estadoCredito} onChange={e => setEstadoCredito(e.target.value)}
                        className="w-full border border-black/[0.08] bg-white py-2 px-3 rounded-xl outline-none appearance-none text-sm font-medium text-gray-700 focus:border-brand-military transition">
                        <option value="PENDIENTE">Pendiente</option>
                        <option value="VENCIDO">Vencido</option>
                        <option value="COBRADO">Cobrado</option>
                        <option value="PAGADO">Pagado</option>
                      </select>
                      <div className="absolute right-3 top-2.5 pointer-events-none">
                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bien de Uso toggle — solo para gastos */}
            {type === 'EXPENSE' && (
              <div className="border-t border-black/[0.05] pt-3">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={esBienDeUso}
                    onChange={e => { setEsBienDeUso(e.target.checked); if (esCredito) setEsCredito(false) }}
                    className="w-4 h-4 cursor-pointer"
                    style={{ accentColor: '#1B4332' }}
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-500 group-hover:text-[#1B4332] transition">
                      Es un bien de uso
                    </span>
                    <span className="ml-2 text-xs text-gray-400">PC, mueble, vehículo...</span>
                  </div>
                </label>

                {esBienDeUso && (
                  <div className="mt-3 pl-6 border-l-2 space-y-3" style={{ borderColor: '#2D6A4F' }}>
                    <p className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-2.5 py-1.5">
                      ✓ El gasto se registra normalmente <strong>y</strong> el bien queda en seguimiento con depreciación automática
                    </p>

                    {/* Categoría del bien */}
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Categoría del bien</label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {BIEN_CATEGORIAS.map(c => (
                          <button
                            key={c.value}
                            type="button"
                            onClick={() => setBienCategoria(c.value)}
                            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs font-medium transition-all"
                            style={
                              bienCategoria === c.value
                                ? { background: '#D8F3DC', borderColor: '#2D6A4F', color: '#1B4332' }
                                : { borderColor: '#e5e7eb', color: '#6b7280' }
                            }
                          >
                            <span>{c.icon}</span> {c.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Vida útil */}
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1.5">Vida útil estimada</label>
                      <div className="flex gap-1.5">
                        {[{ m: 24, l: '2 años' }, { m: 36, l: '3 años' }, { m: 60, l: '5 años' }, { m: 120, l: '10 años' }].map(({ m, l }) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setBienVidaUtil(m)}
                            className="flex-1 py-1.5 rounded-lg border text-xs font-medium transition-all"
                            style={
                              bienVidaUtil === m
                                ? { background: '#1B4332', color: 'white', borderColor: '#1B4332' }
                                : { borderColor: '#e5e7eb', color: '#6b7280' }
                            }
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Valor residual */}
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1.5">
                        Valor residual
                        <span className="font-normal text-gray-400 ml-1">(opcional, lo que vale al final)</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={bienValorResidual}
                        onChange={e => setBienValorResidual(e.target.value)}
                        placeholder="0"
                        className="w-full border border-black/[0.08] bg-white py-2 px-3 rounded-xl outline-none text-sm font-medium text-gray-700 focus:border-[#2D6A4F] transition"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Botón submit */}
      <button
        type="submit"
        disabled={submitting}
        className={`mt-4 w-full py-4 px-6 text-sm font-medium rounded-xl transition-all active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed text-white ${
          type === 'INCOME'
            ? 'bg-brand-military hover:bg-brand-military-dark'
            : 'bg-[#1A1A1A] hover:bg-[#2a2a2a]'
        }`}
      >
        {submitting ? 'Guardando...' : type === 'INCOME' ? '↑ Registrar ingreso' : '↓ Registrar gasto'}
      </button>

      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="categoryId" value={categoryId} />
      <input type="hidden" name="contactId" value={contactId} />
      <input type="hidden" name="areaNegocioId" value={areaNegocioId} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="currency" value={selectedCurrency} />
      <input type="hidden" name="esCredito" value={esCredito ? 'true' : 'false'} />
      <input type="hidden" name="estado" value={esCredito ? estadoCredito : (type === 'INCOME' ? 'COBRADO' : 'PAGADO')} />
      {esCredito && fechaVencimiento && <input type="hidden" name="fechaVencimiento" value={fechaVencimiento} />}
      <input type="hidden" name="esBienDeUso" value={type === 'EXPENSE' && esBienDeUso ? 'true' : 'false'} />
      {type === 'EXPENSE' && esBienDeUso && (
        <>
          <input type="hidden" name="bienCategoria" value={bienCategoria} />
          <input type="hidden" name="bienVidaUtil" value={bienVidaUtil} />
          <input type="hidden" name="bienValorResidual" value={bienValorResidual || '0'} />
        </>
      )}
    </form>
  )
}
