'use client'

import { useEffect, useMemo, useState } from 'react'
import DatePickerField from './ui/DatePickerField'
import OperationTypeSelect from './ui/OperationTypeSelect'
import ProductoServicioCombobox from './ui/ProductoServicioCombobox'
import BienDeUsoCombobox from './ui/BienDeUsoCombobox'
import CobroCreditoPanel from './CobroCreditoPanel'
import PagoDeudaPanel from './PagoDeudaPanel'

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
  tipo?: string
}
export type Empleado = { id: string; nombre: string; cargo: string | null }
export type BienDeUso = {
  id: string
  nombre: string
  categoria: string | null
  marca: string | null
  valorAdquisicion: number
  depreciacionAcumulada: number
}

type SubType =
  | 'SALE_PRODUCT' | 'SALE_SERVICE' | 'SALE_BIEN_USO' | 'COBRO_CREDITO' | 'OTHER_INCOME'
  | 'PURCHASE_PRODUCT' | 'PURCHASE_SERVICE' | 'PURCHASE_BIEN_USO' | 'PAGO_DEUDA' | 'PAGO'
type MetodoPago = 'EFECTIVO' | 'VIRTUAL' | 'CREDITO' | 'DEUDA'

const CURRENCY_SYMBOL: Record<string, string> = { ARS: '$', USD: 'US$' }

type SubmitResult = { success: boolean; error?: string; data?: { clienteSaldado?: boolean; clienteNombre?: string; proveedorSaldado?: boolean; proveedorNombre?: string } }

type Props = {
  accounts: Account[]
  categories: Category[]
  contacts: Contact[]
  areas: AreaNegocio[]
  productos?: Producto[]
  empleados?: Empleado[]
  bienesDeUso?: BienDeUso[]
  operatingModel?: 'PRODUCTS' | 'SERVICES' | 'BOTH'
  onSubmit?: (formData: FormData) => Promise<SubmitResult>
  onClienteSaldado?: (nombre: string) => void
  onProveedorSaldado?: (nombre: string) => void
  initialType?: 'INCOME' | 'EXPENSE'
  onTypeChange?: (type: 'INCOME' | 'EXPENSE') => void
}

const SELECT_CLS =
  'w-full appearance-none rounded-xl border border-black/[0.08] bg-white py-2.5 px-3 text-sm font-medium text-gray-700 outline-none transition-all focus:border-brand-military dark:border-white/10 dark:bg-zinc-900 dark:text-gray-200'

const INPUT_CLS =
  'w-full rounded-xl border border-black/[0.08] bg-white py-2.5 px-3 text-sm font-medium text-gray-700 outline-none transition-all placeholder:text-gray-300 focus:border-brand-military dark:border-white/10 dark:bg-zinc-900 dark:text-gray-200'

const LABEL_CLS = 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500'

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

export default function TransactionForm({
  accounts,
  categories: _categories,
  contacts,
  areas: _areas,
  productos = [],
  empleados = [],
  bienesDeUso = [],
  operatingModel = 'BOTH',
  onSubmit,
  onClienteSaldado,
  onProveedorSaldado,
  initialType = 'INCOME',
  onTypeChange,
}: Props) {
  void _categories
  void _areas
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>(initialType)

  const defaultSubType = (t: 'INCOME' | 'EXPENSE'): SubType => {
    if (t === 'EXPENSE') {
      if (operatingModel === 'SERVICES') return 'PURCHASE_SERVICE'
      return 'PURCHASE_PRODUCT'
    }
    if (operatingModel === 'SERVICES') return 'SALE_SERVICE'
    return 'SALE_PRODUCT'
  }

  const [subType, setSubType] = useState<SubType>(defaultSubType(initialType))
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [productoId, setProductoId] = useState('')
  const [bienDeUsoId, setBienDeUsoId] = useState('')
  const [linkedCreditoId, setLinkedCreditoId] = useState('')
  const [creditoSaldoMax, setCreditoSaldoMax] = useState(0)
  const [creditoContactId, setCreditoContactId] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [precioUnitario, setPrecioUnitario] = useState('')
  const [contactId, setContactId] = useState('')
  const [empleadoId, setEmpleadoId] = useState('')
  const [categoryId] = useState('')
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('EFECTIVO')
  const [accountId, setAccountId] = useState(accounts[0]?.id || '')
  const [fechaVencimiento, setFechaVencimiento] = useState('')
  const [description, setDescription] = useState('')
  const [montoDirecto, setMontoDirecto] = useState('')
  // Quick-create de bien de uso (compra)
  const [bienNombre, setBienNombre] = useState('')
  const [bienCategoria, setBienCategoria] = useState('')
  const [bienMarca, setBienMarca] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setType(initialType)
    setSubType(defaultSubType(initialType))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialType])

  const handleTypeChange = (newType: 'INCOME' | 'EXPENSE') => {
    setType(newType)
    setSubType(defaultSubType(newType))
    setError(null)
    if (onTypeChange) onTypeChange(newType)
  }

  const resetSubTypeFields = () => {
    setProductoId('')
    setBienDeUsoId('')
    setLinkedCreditoId('')
    setCreditoSaldoMax(0)
    setCreditoContactId('')
    setCantidad('')
    setPrecioUnitario('')
    setContactId('')
    setMontoDirecto('')
    setBienNombre('')
    setBienCategoria('')
    setBienMarca('')
    setError(null)
  }

  const handleSubTypeChange = (st: string) => {
    setSubType(st as SubType)
    resetSubTypeFields()
  }

  const isIngreso = type === 'INCOME'
  const isSaleProduct = subType === 'SALE_PRODUCT'
  const isSaleService = subType === 'SALE_SERVICE'
  const isSaleBienUso = subType === 'SALE_BIEN_USO'
  const isCobroCredito = subType === 'COBRO_CREDITO'
  const isPurchaseProduct = subType === 'PURCHASE_PRODUCT'
  const isPurchaseService = subType === 'PURCHASE_SERVICE'
  const isPurchaseBienUso = subType === 'PURCHASE_BIEN_USO'
  const isPagoDeuda = subType === 'PAGO_DEUDA'
  // Cantidad + precio + total: producto en venta o compra
  const showProductSection = isSaleProduct || isPurchaseProduct
  // Servicio: combobox + monto total directo (un solo renglón)
  const showServiceSection = isSaleService || isPurchaseService
  // Solo monto total directo
  const showMontoDirecto =
    subType === 'OTHER_INCOME' || subType === 'PAGO' ||
    isCobroCredito || isPagoDeuda ||
    isSaleBienUso || isPurchaseBienUso ||
    isSaleService || isPurchaseService

  // Cobro/Pago de crédito jamás pueden ser a crédito (es un movimiento real de caja)
  const noCreditoAllowed = isCobroCredito || isPagoDeuda

  useEffect(() => {
    if (noCreditoAllowed && (metodoPago === 'CREDITO' || metodoPago === 'DEUDA')) {
      setMetodoPago('EFECTIVO')
    }
  }, [noCreditoAllowed, metodoPago])

  const selectedCurrency = useMemo(() => {
    return accounts.find((a) => a.id === accountId)?.currency || 'ARS'
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
    if (isIngreso) return contacts.filter((c) => c.type === 'CLIENT')
    return contacts.filter((c) => c.type === 'SUPPLIER')
  }, [contacts, isIngreso])

  const selectedProducto = useMemo(() => productos.find((p) => p.id === productoId), [productos, productoId])
  useEffect(() => {
    if (selectedProducto) {
      const precio = isIngreso ? selectedProducto.precioVenta : selectedProducto.precioCosto
      if (showServiceSection) {
        if (precio > 0) setMontoDirecto(String(precio))
      } else {
        setPrecioUnitario(precio > 0 ? String(precio) : '')
      }
    }
  }, [selectedProducto, isIngreso, showServiceSection])

  const total = useMemo(() => {
    if (showProductSection) {
      const c = parseFloat(cantidad)
      const p = parseFloat(precioUnitario)
      if (!isNaN(c) && !isNaN(p) && c > 0 && p > 0) return c * p
      return null
    }
    if (showMontoDirecto) {
      const v = parseFloat(montoDirecto)
      return isNaN(v) ? null : v
    }
    return null
  }, [cantidad, precioUnitario, montoDirecto, showProductSection, showMontoDirecto])

  const productoFilterTipo: 'MERCADERIA' | 'SERVICIO' | undefined =
    (isSaleProduct || isPurchaseProduct) ? 'MERCADERIA' :
    (isSaleService || isPurchaseService) ? 'SERVICIO' :
    undefined

  const esCreditoAuto = !noCreditoAllowed && (metodoPago === 'CREDITO' || metodoPago === 'DEUDA')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const amount = total ?? 0
    if (amount <= 0) { setError('El monto debe ser mayor a 0'); setSubmitting(false); return }
    if (isCobroCredito) {
      if (!linkedCreditoId) { setError('Elegí un crédito a cobrar'); setSubmitting(false); return }
      if (amount > creditoSaldoMax + 0.001) { setError(`El monto excede el saldo pendiente ($${creditoSaldoMax.toFixed(2)})`); setSubmitting(false); return }
    }
    if (isPagoDeuda) {
      if (!linkedCreditoId) { setError('Elegí una deuda a pagar'); setSubmitting(false); return }
      if (amount > creditoSaldoMax + 0.001) { setError(`El monto excede el saldo pendiente ($${creditoSaldoMax.toFixed(2)})`); setSubmitting(false); return }
    }
    if (isSaleBienUso && !bienDeUsoId) { setError('Elegí un bien de uso'); setSubmitting(false); return }
    if (isPurchaseBienUso && !bienNombre.trim()) { setError('Indicá el nombre del bien'); setSubmitting(false); return }
    if (showProductSection && !productoId) { setError('Elegí un producto'); setSubmitting(false); return }
    if (showServiceSection && !productoId) { setError('Elegí un servicio'); setSubmitting(false); return }

    const formData = new FormData()
    formData.set('amount', String(amount))
    formData.set(
      'description',
      description || (
        isSaleProduct && selectedProducto ? `Venta: ${selectedProducto.nombre}` :
        isSaleService && selectedProducto ? `Servicio: ${selectedProducto.nombre}` :
        isPurchaseProduct && selectedProducto ? `Compra: ${selectedProducto.nombre}` :
        isPurchaseService && selectedProducto ? `Servicio contratado: ${selectedProducto.nombre}` :
        isPurchaseBienUso && bienNombre ? `Compra de ${bienNombre}` :
        isSaleBienUso ? 'Venta de bien de uso' :
        isCobroCredito ? 'Cobro de crédito' :
        isPagoDeuda ? 'Pago de deuda' :
        subType === 'OTHER_INCOME' ? 'Otros ingresos' :
        subType === 'PAGO' ? 'Otros egresos' :
        ''
      )
    )
    formData.set('type', type)
    formData.set('subType', subType)
    formData.set('accountId', accountId)
    formData.set('categoryId', categoryId)
    formData.set('contactId', isCobroCredito || isPagoDeuda ? creditoContactId : contactId)
    formData.set('empleadoId', empleadoId)
    formData.set('date', date)
    formData.set('currency', selectedCurrency)
    formData.set('esCredito', esCreditoAuto ? 'true' : 'false')
    formData.set('estado', esCreditoAuto ? 'PENDIENTE' : type === 'INCOME' ? 'COBRADO' : 'PAGADO')
    if (esCreditoAuto && fechaVencimiento) formData.set('fechaVencimiento', fechaVencimiento)
    if (showProductSection && productoId) {
      formData.set('productoId', productoId)
      formData.set('cantidad', cantidad)
      formData.set('precioUnitario', precioUnitario)
    }
    if (showServiceSection && productoId) {
      // Servicio: cantidad fija = 1, precio unitario = monto total
      formData.set('productoId', productoId)
      formData.set('cantidad', '1')
      formData.set('precioUnitario', String(amount))
    }
    if (isCobroCredito && linkedCreditoId) formData.set('linkedCreditoId', linkedCreditoId)
    if (isPagoDeuda && linkedCreditoId) formData.set('linkedCreditoId', linkedCreditoId)
    if (isSaleBienUso && bienDeUsoId) formData.set('bienDeUsoId', bienDeUsoId)
    if (isPurchaseBienUso) {
      formData.set('bienNombre', bienNombre.trim())
      if (bienCategoria.trim()) formData.set('bienCategoria', bienCategoria.trim())
      if (bienMarca.trim()) formData.set('bienMarca', bienMarca.trim())
    }

    if (onSubmit) {
      const result = await onSubmit(formData)
      setSubmitting(false)
      if (!result.success) {
        setError(result.error || 'Error desconocido')
        return
      }
      if (result.data?.clienteSaldado && result.data?.clienteNombre && onClienteSaldado) {
        onClienteSaldado(result.data.clienteNombre)
      }
      if (result.data?.proveedorSaldado && result.data?.proveedorNombre && onProveedorSaldado) {
        onProveedorSaldado(result.data.proveedorNombre)
      }
      resetSubTypeFields()
      setDescription('')
      setEmpleadoId('')
      setFechaVencimiento('')
    }
  }

  const metodoPagoOptions: { value: MetodoPago; label: string; icon: string }[] = [
    { value: 'EFECTIVO', label: 'Efectivo', icon: 'cash' },
    { value: 'VIRTUAL', label: 'Virtual', icon: 'card' },
    ...(noCreditoAllowed ? [] : [
      { value: 'CREDITO' as MetodoPago, label: 'Crédito', icon: 'credit' },
    ]),
  ]

  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col gap-0">
      {!onTypeChange && (
        <div className="mb-5 flex gap-1 rounded-2xl bg-gray-100 p-1 dark:bg-zinc-800">
          <button
            type="button"
            onClick={() => handleTypeChange('INCOME')}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all ${
              isIngreso ? 'bg-brand-military text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            Ventas
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange('EXPENSE')}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all ${
              !isIngreso ? 'bg-brand-oxide text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            Compras
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-xl border-l-4 border-red-500 bg-red-50 p-3 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-400">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="ml-3 text-red-400 hover:text-red-600">×</button>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto pr-1">
        <div>
          <label className={LABEL_CLS}>Fecha</label>
          <DatePickerField value={date} onChange={setDate} />
        </div>

        <div>
          <label className={LABEL_CLS}>Tipo de movimiento</label>
          <OperationTypeSelect
            value={subType}
            onChange={handleSubTypeChange}
            type={type}
            operatingModel={operatingModel}
          />
        </div>

        {isCobroCredito && (
          <CobroCreditoPanel
            selectedClienteId={creditoContactId}
            selectedCreditoId={linkedCreditoId}
            onSelectCliente={(id) => { setCreditoContactId(id); setLinkedCreditoId(''); setCreditoSaldoMax(0) }}
            onSelectCredito={(id, saldo, contact) => {
              setLinkedCreditoId(id)
              setCreditoSaldoMax(saldo)
              setCreditoContactId(contact)
              setMontoDirecto(saldo.toFixed(2))
            }}
          />
        )}

        {isPagoDeuda && (
          <PagoDeudaPanel
            selectedProveedorId={creditoContactId}
            selectedDeudaId={linkedCreditoId}
            onSelectProveedor={(id) => { setCreditoContactId(id); setLinkedCreditoId(''); setCreditoSaldoMax(0) }}
            onSelectDeuda={(id, saldo, contact) => {
              setLinkedCreditoId(id)
              setCreditoSaldoMax(saldo)
              setCreditoContactId(contact)
              setMontoDirecto(saldo.toFixed(2))
            }}
          />
        )}

        {showProductSection && (
          <div className="flex flex-col gap-3 rounded-2xl border border-black/[0.06] bg-gray-50/80 p-4 dark:border-white/[0.06] dark:bg-zinc-800/50">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Producto
            </p>
            <ProductoServicioCombobox
              productos={productos}
              filterTipo={productoFilterTipo}
              value={productoId}
              onChange={setProductoId}
            />

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={LABEL_CLS}>Cantidad</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  placeholder="0"
                  className={INPUT_CLS}
                  required
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Precio unit.</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{CURRENCY_SYMBOL[selectedCurrency]}</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={precioUnitario}
                    onChange={(e) => setPrecioUnitario(e.target.value)}
                    placeholder="0.00"
                    className={INPUT_CLS + ' pl-6'}
                    required
                  />
                </div>
              </div>
              <div>
                <label className={LABEL_CLS}>Total</label>
                <div className={`flex h-[42px] items-center rounded-xl border px-3 ${isIngreso ? 'border-brand-military-light bg-brand-military-light' : 'border-[#F5CFC9] bg-[#FDF2F0]'}`}>
                  <span className={`text-sm font-bold ${isIngreso ? 'text-brand-military-dark' : 'text-brand-oxide'}`}>
                    {total !== null
                      ? `${CURRENCY_SYMBOL[selectedCurrency]} ${total.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : '-'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {showServiceSection && (
          <div className="flex flex-col gap-3 rounded-2xl border border-black/[0.06] bg-gray-50/80 p-4 dark:border-white/[0.06] dark:bg-zinc-800/50">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Servicio</p>
            <ProductoServicioCombobox
              productos={productos}
              filterTipo="SERVICIO"
              value={productoId}
              onChange={setProductoId}
            />
            <div>
              <label className={LABEL_CLS}>Total</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-light text-gray-400">{CURRENCY_SYMBOL[selectedCurrency]}</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={montoDirecto}
                  onChange={(e) => setMontoDirecto(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-black/[0.08] bg-white py-3 pl-9 pr-4 font-mono text-2xl font-light text-gray-900 outline-none focus:border-brand-military dark:border-white/10 dark:bg-zinc-900 dark:text-white"
                  required
                />
              </div>
            </div>
          </div>
        )}

        {isSaleBienUso && (
          <div className="flex flex-col gap-3 rounded-2xl border border-black/[0.06] bg-gray-50/80 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Bien de uso</p>
            <BienDeUsoCombobox bienes={bienesDeUso} value={bienDeUsoId} onChange={setBienDeUsoId} />
            <div>
              <label className={LABEL_CLS}>Precio de venta</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-light text-gray-400">{CURRENCY_SYMBOL[selectedCurrency]}</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={montoDirecto}
                  onChange={(e) => setMontoDirecto(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-black/[0.08] bg-white py-3 pl-9 pr-4 font-mono text-2xl font-light text-gray-900 outline-none focus:border-brand-military"
                  required
                />
              </div>
            </div>
          </div>
        )}

        {isPurchaseBienUso && (
          <div className="flex flex-col gap-3 rounded-2xl border border-black/[0.06] bg-gray-50/80 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Bien de uso a incorporar</p>
            <div>
              <label className={LABEL_CLS}>Nombre</label>
              <input
                type="text"
                value={bienNombre}
                onChange={(e) => setBienNombre(e.target.value)}
                placeholder="Ej: Camioneta Toyota Hilux"
                className={INPUT_CLS}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLS}>Categoría</label>
                <input
                  type="text"
                  value={bienCategoria}
                  onChange={(e) => setBienCategoria(e.target.value)}
                  placeholder="Vehículo, equipo..."
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Marca</label>
                <input
                  type="text"
                  value={bienMarca}
                  onChange={(e) => setBienMarca(e.target.value)}
                  placeholder="Opcional"
                  className={INPUT_CLS}
                />
              </div>
            </div>
            <div>
              <label className={LABEL_CLS}>Valor de adquisición</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-light text-gray-400">{CURRENCY_SYMBOL[selectedCurrency]}</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={montoDirecto}
                  onChange={(e) => setMontoDirecto(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-black/[0.08] bg-white py-3 pl-9 pr-4 font-mono text-2xl font-light text-gray-900 outline-none focus:border-brand-oxide"
                  required
                />
              </div>
            </div>
          </div>
        )}

        {(subType === 'OTHER_INCOME' || subType === 'PAGO' || isCobroCredito || isPagoDeuda) && (
          <div>
            <label className={LABEL_CLS}>Monto</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-light text-gray-400">{CURRENCY_SYMBOL[selectedCurrency]}</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={montoDirecto}
                onChange={(e) => setMontoDirecto(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl border border-black/[0.08] bg-white py-3 pl-9 pr-4 font-mono text-2xl font-light text-gray-900 outline-none focus:border-brand-military dark:border-white/10 dark:bg-zinc-900 dark:text-white"
                required
              />
            </div>
            {(isCobroCredito || isPagoDeuda) && creditoSaldoMax > 0 && (
              <p className="mt-1.5 text-[11px] text-gray-400">Saldo pendiente: ${creditoSaldoMax.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
            )}
          </div>
        )}

        {!isCobroCredito && !isPagoDeuda && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLS}>{isIngreso ? 'Cliente' : 'Proveedor'}</label>
              <SelectWrapper>
                <select value={contactId} onChange={(e) => setContactId(e.target.value)} className={SELECT_CLS}>
                  <option value="">Sin {isIngreso ? 'cliente' : 'proveedor'}</option>
                  {filteredContacts.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
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
                    <option key={em.id} value={em.id}>{em.nombre}{em.cargo ? ` - ${em.cargo}` : ''}</option>
                  ))}
                </select>
              </SelectWrapper>
            </div>
          </div>
        )}

        <div>
          <label className={LABEL_CLS}>Método de pago</label>
          <div className={`grid gap-2 ${metodoPagoOptions.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {metodoPagoOptions.map((opt) => (
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

        {(metodoPago === 'EFECTIVO' || metodoPago === 'VIRTUAL') && filteredAccounts.length > 1 && (
          <div>
            <label className={LABEL_CLS}>Cuenta</label>
            <SelectWrapper>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={SELECT_CLS}>
                {filteredAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>{acc.name} ({acc.currency})</option>
                ))}
              </select>
            </SelectWrapper>
          </div>
        )}

        {esCreditoAuto && (
          <div className="rounded-2xl border border-l-4 bg-sky-50/50 p-4 dark:bg-sky-950/20" style={{ borderColor: '#e2e8f0', borderLeftColor: isIngreso ? '#3A4D39' : '#A65D57' }}>
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">
              {isIngreso ? 'Cuenta por cobrar' : 'Cuenta por pagar'}
            </p>
            <div>
              <label className={LABEL_CLS}>Vencimiento</label>
              <DatePickerField value={fechaVencimiento} onChange={setFechaVencimiento} placeholder="Sin vencimiento" />
            </div>
          </div>
        )}

        <div>
          <label className={LABEL_CLS}>Descripción (opcional)</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Anotación libre"
            className={INPUT_CLS}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className={`mt-5 w-full rounded-xl py-4 text-sm font-bold transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 ${
          isIngreso ? 'bg-brand-military text-white hover:bg-brand-military-dark' : 'bg-brand-oxide text-white hover:bg-[#8B4A3F]'
        }`}
      >
        {submitting ? 'Guardando...' : 'Registrar operación'}
      </button>
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
