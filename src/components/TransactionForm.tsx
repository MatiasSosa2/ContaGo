'use client'

import { useState, useMemo, useEffect } from 'react'

export type Account = { id: string; name: string; currency: string; type: string }
export type Category = { id: string; name: string; type: string }
export type Contact = { id: string; name: string; type: string }
export type AreaNegocio = { id: string; nombre: string }
export type Producto = {
  id: string
  nombre: string
  categoria: string | null
  marca: string | null
  precioVenta: number
  precioCosto: number
  stockActual: number
}
export type Empleado = { id: string; nombre: string; cargo: string | null }

type SubType = 'SALE' | 'COBRO' | 'PURCHASE' | 'PAGO'
type MetodoPago = 'EFECTIVO' | 'VIRTUAL' | 'CREDITO' | 'DEUDA'

const CURRENCY_SYMBOL: Record<string, string> = { ARS: '$', USD: 'US$' }

type Props = {
  accounts: Account[]
  categories: Category[]
  contacts: Contact[]
  areas: AreaNegocio[]
  productos?: Producto[]
  empleados?: Empleado[]
  onSubmit?: (formData: FormData) => Promise<{ success: boolean; error?: string }>
  initialType?: 'INCOME' | 'EXPENSE'
  onTypeChange?: (type: 'INCOME' | 'EXPENSE') => void
}

function SelectWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  )
}

const SELECT_CLS =
  'w-full appearance-none rounded-xl border border-black/[0.08] bg-white py-2.5 px-3 text-sm font-medium text-gray-700 outline-none transition-all focus:border-brand-military dark:border-white/10 dark:bg-zinc-900 dark:text-gray-200'

const INPUT_CLS =
  'w-full rounded-xl border border-black/[0.08] bg-white py-2.5 px-3 text-sm font-medium text-gray-700 outline-none transition-all placeholder:text-gray-300 focus:border-brand-military dark:border-white/10 dark:bg-zinc-900 dark:text-gray-200'

const LABEL_CLS = 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500'

const SECTION_CLS = 'overflow-hidden transition-all duration-300 ease-in-out'

export default function TransactionForm({
  accounts,
  categories,
  contacts,
  areas,
  productos = [],
  empleados = [],
  onSubmit,
  initialType = 'INCOME',
  onTypeChange,
}: Props) {
  'use no memo'
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>(initialType)
  const [subType, setSubType] = useState<SubType>(initialType === 'INCOME' ? 'SALE' : 'PURCHASE')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [categoriaFiltro, setCategoriaFiltro] = useState('')
  const [marcaFiltro, setMarcaFiltro] = useState('')
  const [productoId, setProductoId] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [precioUnitario, setPrecioUnitario] = useState('')
  const [contactId, setContactId] = useState('')
  const [empleadoId, setEmpleadoId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('EFECTIVO')
  const [accountId, setAccountId] = useState(accounts[0]?.id || '')
  const [estadoCredito, setEstadoCredito] = useState('PENDIENTE')
  const [fechaVencimiento, setFechaVencimiento] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setType(initialType)
    setSubType(initialType === 'INCOME' ? 'SALE' : 'PURCHASE')
  }, [initialType])

  const handleTypeChange = (newType: 'INCOME' | 'EXPENSE') => {
    setType(newType)
    setSubType(newType === 'INCOME' ? 'SALE' : 'PURCHASE')
    setError(null)
    if (onTypeChange) onTypeChange(newType)
  }

  const handleSubTypeChange = (st: SubType) => {
    setSubType(st)
    setProductoId('')
    setCantidad('')
    setPrecioUnitario('')
    setContactId('')
    setError(null)
    if (st === 'COBRO' || st === 'PAGO') {
      if (metodoPago === 'CREDITO' || metodoPago === 'DEUDA') {
        setMetodoPago('EFECTIVO')
      }
    }
  }

  const isIngreso = type === 'INCOME'
  const isProductSubType = subType === 'SALE' || subType === 'PURCHASE'
  const isCobroPago = subType === 'COBRO' || subType === 'PAGO'
  const esCreditoAuto = metodoPago === 'CREDITO' || metodoPago === 'DEUDA'

  const selectedCurrency = useMemo(() => {
    const acc = accounts.find((a) => a.id === accountId)
    return acc?.currency || 'ARS'
  }, [accountId, accounts])

  const filteredAccounts = useMemo(() => {
    if (metodoPago === 'EFECTIVO') return accounts.filter((a) => a.type === 'CASH')
    if (metodoPago === 'VIRTUAL') return accounts.filter((a) => a.type === 'BANK' || a.type === 'WALLET')
    return accounts
  }, [accounts, metodoPago])

  useEffect(() => {
    if (filteredAccounts.length > 0 && !filteredAccounts.find((a) => a.id === accountId)) {
      setAccountId(filteredAccounts[0].id)
    }
  }, [filteredAccounts, accountId])

  const filteredContacts = useMemo(() => {
    if (subType === 'SALE' || subType === 'COBRO') return contacts.filter((c) => c.type === 'CLIENT')
    if (subType === 'PURCHASE' || subType === 'PAGO') return contacts.filter((c) => c.type === 'SUPPLIER')
    return contacts
  }, [contacts, subType])

  const filteredCategories = useMemo(() => {
    return categories.filter((c) => c.type === type)
  }, [categories, type])

  const catalogCategorias = useMemo(
    () => [...new Set(productos.map((p) => p.categoria).filter(Boolean) as string[])],
    [productos]
  )
  const catalogMarcas = useMemo(() => {
    const base = productos.filter((p) => !categoriaFiltro || p.categoria === categoriaFiltro)
    return [...new Set(base.map((p) => p.marca).filter(Boolean) as string[])]
  }, [productos, categoriaFiltro])
  const catalogProductos = useMemo(() => {
    return productos.filter((p) => {
      if (categoriaFiltro && p.categoria !== categoriaFiltro) return false
      if (marcaFiltro && p.marca !== marcaFiltro) return false
      return true
    })
  }, [productos, categoriaFiltro, marcaFiltro])

  const selectedProducto = useMemo(() => productos.find((p) => p.id === productoId), [productos, productoId])
  useEffect(() => {
    if (selectedProducto) {
      const precio = subType === 'SALE' ? selectedProducto.precioVenta : selectedProducto.precioCosto
      setPrecioUnitario(precio > 0 ? String(precio) : '')
    }
  }, [selectedProducto, subType])

  const total = useMemo(() => {
    const c = parseFloat(cantidad)
    const p = parseFloat(precioUnitario)
    if (!isNaN(c) && !isNaN(p) && c > 0 && p > 0) return c * p
    return null
  }, [cantidad, precioUnitario])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const formData = new FormData()
    const amountDirect = e.currentTarget.querySelector<HTMLInputElement>('[name="amountDirect"]')?.value
    const amount =
      isProductSubType && total !== null ? total : parseFloat(amountDirect || '0')

    formData.set('amount', String(amount))
    formData.set(
      'description',
      description ||
        (isProductSubType && selectedProducto
          ? `${subType === 'SALE' ? 'Venta' : 'Compra'}: ${selectedProducto.nombre}`
          : subType === 'COBRO' ? 'Otros Ingresos'
          : subType === 'PAGO' ? 'Otros Egresos'
          : subType)
    )
    formData.set('type', type)
    formData.set('subType', subType)
    formData.set('accountId', accountId)
    formData.set('categoryId', categoryId)
    formData.set('contactId', contactId)
    formData.set('empleadoId', empleadoId)
    formData.set('date', date)
    formData.set('currency', selectedCurrency)
    formData.set('esCredito', esCreditoAuto ? 'true' : 'false')
    formData.set('estado', esCreditoAuto ? estadoCredito : type === 'INCOME' ? 'COBRADO' : 'PAGADO')
    if (esCreditoAuto && fechaVencimiento) formData.set('fechaVencimiento', fechaVencimiento)
    if (isProductSubType && productoId) {
      formData.set('productoId', productoId)
      formData.set('cantidad', cantidad)
      formData.set('precioUnitario', precioUnitario)
    }

    if (onSubmit) {
      const result = await onSubmit(formData)
      setSubmitting(false)
      if (!result.success) {
        setError(result.error || 'Error desconocido')
        return
      }
      setCantidad('')
      setContactId('')
      setEmpleadoId('')
      setDescription('')
      setFechaVencimiento('')
    }
  }

  const subTypeOptions: { value: SubType; label: string }[] = isIngreso
    ? [
        { value: 'SALE', label: 'Venta' },
        { value: 'COBRO', label: 'Otros Ingresos' },
      ]
    : [
        { value: 'PURCHASE', label: 'Compra' },
        { value: 'PAGO', label: 'Otros Egresos' },
      ]

  const metodoPagoOptions: { value: MetodoPago; label: string; icon: string; onlyFor?: SubType[] }[] = [
    { value: 'EFECTIVO', label: 'Efectivo', icon: 'cash' },
    { value: 'VIRTUAL', label: 'Virtual', icon: 'card' },
    { value: 'CREDITO', label: 'Credito', icon: 'credit', onlyFor: ['SALE', 'COBRO'] },
    { value: 'DEUDA', label: 'Deuda', icon: 'debt', onlyFor: ['PURCHASE', 'PAGO'] },
  ]

  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col gap-0">
      {!onTypeChange && (
        <div className="mb-5 flex gap-1 rounded-2xl bg-gray-100 p-1 dark:bg-zinc-800">
          <button
            type="button"
            onClick={() => handleTypeChange('INCOME')}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all ${
              isIngreso
                ? 'bg-brand-military text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            Ingresos
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange('EXPENSE')}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all ${
              !isIngreso
                ? 'bg-brand-oxide text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            Egresos
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-xl border-l-4 border-red-500 bg-red-50 p-3 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-400">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="ml-3 text-red-400 hover:text-red-600">
            x
          </button>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto pr-1">
        {/* Fecha */}
        <div>
          <label className={LABEL_CLS}>Fecha</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={INPUT_CLS + ' font-mono'}
          />
        </div>

        {/* Tipo de movimiento */}
        <div>
          <label className={LABEL_CLS}>Tipo de movimiento</label>
          <div className="grid grid-cols-2 gap-2">
            {subTypeOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSubTypeChange(opt.value)}
                className={`rounded-xl border py-2.5 text-sm font-semibold transition-all ${
                  subType === opt.value
                    ? isIngreso
                      ? 'border-brand-military bg-brand-military-light text-brand-military-dark'
                      : 'border-brand-oxide bg-[#F9EDE9] text-[#7A3025]'
                    : 'border-black/[0.08] bg-white text-gray-500 hover:border-gray-300 dark:border-white/10 dark:bg-zinc-900 dark:text-gray-400'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Seccion Producto */}
        <div
          className={SECTION_CLS}
          style={{
            maxHeight: isProductSubType ? '600px' : '0',
            opacity: isProductSubType ? 1 : 0,
            marginBottom: isProductSubType ? undefined : '-20px',
          }}
        >
          {isProductSubType && (
            <div className="flex flex-col gap-3 rounded-2xl border border-black/[0.06] bg-gray-50/80 p-4 dark:border-white/[0.06] dark:bg-zinc-800/50">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Datos del producto
              </p>

              {catalogCategorias.length > 0 && (
                <div>
                  <label className={LABEL_CLS}>Categoria</label>
                  <SelectWrapper>
                    <select
                      value={categoriaFiltro}
                      onChange={(e) => {
                        setCategoriaFiltro(e.target.value)
                        setMarcaFiltro('')
                        setProductoId('')
                      }}
                      className={SELECT_CLS}
                    >
                      <option value="">Todas las categorias</option>
                      {catalogCategorias.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </SelectWrapper>
                </div>
              )}

              {catalogMarcas.length > 0 && (
                <div>
                  <label className={LABEL_CLS}>Marca</label>
                  <SelectWrapper>
                    <select
                      value={marcaFiltro}
                      onChange={(e) => {
                        setMarcaFiltro(e.target.value)
                        setProductoId('')
                      }}
                      className={SELECT_CLS}
                    >
                      <option value="">Todas las marcas</option>
                      {catalogMarcas.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </SelectWrapper>
                </div>
              )}

              <div>
                <label className={LABEL_CLS}>Producto</label>
                <SelectWrapper>
                  <select
                    value={productoId}
                    onChange={(e) => setProductoId(e.target.value)}
                    className={SELECT_CLS}
                    required={isProductSubType}
                  >
                    <option value="">Seleccionar producto</option>
                    {catalogProductos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} (stock: {p.stockActual})
                      </option>
                    ))}
                  </select>
                </SelectWrapper>
              </div>

              <p className="mt-1 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Datos comerciales
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={LABEL_CLS}>Cantidad</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={cantidad}
                    onChange={(e) => setCantidad(String(Math.floor(Number(e.target.value))))}
                    placeholder="0"
                    className={INPUT_CLS}
                    required={isProductSubType}
                  />
                </div>
                <div>
                  <label className={LABEL_CLS}>Precio unit.</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                      {CURRENCY_SYMBOL[selectedCurrency]}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={precioUnitario}
                      onChange={(e) => setPrecioUnitario(e.target.value)}
                      placeholder="0.00"
                      className={INPUT_CLS + ' pl-6'}
                      required={isProductSubType}
                    />
                  </div>
                </div>
                <div>
                  <label className={LABEL_CLS}>Total</label>
                  <div className={`flex h-[42px] items-center rounded-xl border px-3 ${isIngreso ? 'border-brand-military-light bg-brand-military-light' : 'border-[#F5CFC9] bg-[#FDF2F0]'}`}>
                    <span className={`text-sm font-bold ${isIngreso ? 'text-brand-military-dark' : 'text-brand-oxide'}`}>
                      {total !== null
                        ? `${CURRENCY_SYMBOL[selectedCurrency]} ${total.toLocaleString('es-AR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`
                        : '-'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Seccion Cobro / Pago */}
        <div
          className={SECTION_CLS}
          style={{
            maxHeight: isCobroPago ? '300px' : '0',
            opacity: isCobroPago ? 1 : 0,
            marginBottom: isCobroPago ? undefined : '-20px',
          }}
        >
          {isCobroPago && (
            <div className="flex flex-col gap-3 rounded-2xl border border-black/[0.06] bg-gray-50/80 p-4 dark:border-white/[0.06] dark:bg-zinc-800/50">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Categoria
              </p>
              <SelectWrapper>
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={SELECT_CLS}>
                  <option value="">Sin categoria</option>
                  {filteredCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </SelectWrapper>

              <div>
                <label className={LABEL_CLS}>Monto</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-light text-gray-400">
                    {CURRENCY_SYMBOL[selectedCurrency]}
                  </span>
                  <input
                    type="number"
                    name="amountDirect"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    className="w-full rounded-xl border border-black/[0.08] bg-white py-3 pl-9 pr-4 font-mono text-2xl font-light text-gray-900 outline-none placeholder:text-gray-300 focus:border-brand-military dark:border-white/10 dark:bg-zinc-900 dark:text-white"
                    required={isCobroPago}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Relaciones */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLS}>{isIngreso ? 'Cliente' : 'Proveedor'}</label>
            <SelectWrapper>
              <select value={contactId} onChange={(e) => setContactId(e.target.value)} className={SELECT_CLS}>
                <option value="">Sin {isIngreso ? 'cliente' : 'proveedor'}</option>
                {filteredContacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </SelectWrapper>
          </div>
          <div>
            <label className={LABEL_CLS}>Empleado</label>
            <SelectWrapper>
              <select value={empleadoId} onChange={(e) => setEmpleadoId(e.target.value)} className={SELECT_CLS}>
                <option value="">Ninguno</option>
                {empleados.map((em) => (
                  <option key={em.id} value={em.id}>
                    {em.nombre}
                    {em.cargo ? ` - ${em.cargo}` : ''}
                  </option>
                ))}
              </select>
            </SelectWrapper>
          </div>
        </div>

        {/* Metodo de pago */}
        <div>
          <label className={LABEL_CLS}>Metodo de pago</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {metodoPagoOptions
              .filter((m) => !m.onlyFor || m.onlyFor.includes(subType as SubType))
              .map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setMetodoPago(opt.value)}
                  className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-semibold transition-all ${
                    metodoPago === opt.value
                      ? isIngreso
                        ? 'border-brand-military bg-brand-military-light text-brand-military-dark'
                        : 'border-brand-oxide bg-[#F9EDE9] text-[#7A3025]'
                      : 'border-black/[0.08] bg-white text-gray-500 hover:border-gray-300 dark:border-white/10 dark:bg-zinc-900 dark:text-gray-400'
                  }`}
                >
                  <MetodoPagoIcon icon={opt.icon} />
                  {opt.label}
                </button>
              ))}
          </div>
        </div>

        {/* Subcuentas */}
        {(metodoPago === 'EFECTIVO' || metodoPago === 'VIRTUAL') && filteredAccounts.length > 0 && (
          <div>
            <label className={LABEL_CLS}>Cuenta</label>
            <SelectWrapper>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={SELECT_CLS}>
                {filteredAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.currency})
                  </option>
                ))}
              </select>
            </SelectWrapper>
          </div>
        )}

        {/* Credito / Deuda */}
        {esCreditoAuto && (
          <div
            className="rounded-2xl border border-l-4 bg-sky-50/50 p-4 dark:bg-sky-950/20"
            style={{ borderColor: '#e2e8f0', borderLeftColor: isIngreso ? '#3A4D39' : '#A65D57' }}
          >
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">
              {isIngreso ? 'Cuenta por cobrar' : 'Cuenta por pagar'}
            </p>
            <SelectWrapper>
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className={SELECT_CLS + ' mb-3'}
              >
                <option value="">Seleccionar {isIngreso ? 'cliente' : 'proveedor'}</option>
                {filteredContacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </SelectWrapper>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLS}>Vencimiento</label>
                <input
                  type="date"
                  value={fechaVencimiento}
                  onChange={(e) => setFechaVencimiento(e.target.value)}
                  className={INPUT_CLS + ' font-mono'}
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Estado</label>
                <SelectWrapper>
                  <select
                    value={estadoCredito}
                    onChange={(e) => setEstadoCredito(e.target.value)}
                    className={SELECT_CLS}
                  >
                    <option value="PENDIENTE">Pendiente</option>
                    <option value="COBRADO">Cobrado</option>
                    <option value="PAGADO">Pagado</option>
                    <option value="VENCIDO">Vencido</option>
                  </select>
                </SelectWrapper>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className={`mt-5 w-full rounded-xl py-4 text-sm font-bold transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 ${
          isIngreso
            ? 'bg-brand-military text-white hover:bg-brand-military-dark'
            : 'bg-brand-oxide text-white hover:bg-[#8B4A3F]'
        }`}
      >
        {submitting ? 'Guardando...' : isIngreso ? 'Registrar ingreso' : 'Registrar egreso'}
      </button>

      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="subType" value={subType} />
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="contactId" value={contactId} />
      <input type="hidden" name="empleadoId" value={empleadoId} />
      <input type="hidden" name="categoryId" value={categoryId} />
      <input type="hidden" name="currency" value={selectedCurrency} />
      <input type="hidden" name="esCredito" value={esCreditoAuto ? 'true' : 'false'} />
      <input type="hidden" name="estado" value={esCreditoAuto ? estadoCredito : type === 'INCOME' ? 'COBRADO' : 'PAGADO'} />
      {esCreditoAuto && fechaVencimiento && (
        <input type="hidden" name="fechaVencimiento" value={fechaVencimiento} />
      )}
    </form>
  )
}

function MetodoPagoIcon({ icon }: { icon: string }) {
  if (icon === 'cash')
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    )
  if (icon === 'card')
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
      </svg>
    )
  if (icon === 'credit')
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185z" />
    </svg>
  )
}
