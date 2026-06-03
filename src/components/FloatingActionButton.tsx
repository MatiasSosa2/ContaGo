'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { usePathname } from 'next/navigation'
import TransactionForm from './TransactionForm'
import DeudaSaldadaModal from './DeudaSaldadaModal'
import { getModalCatalogs, createTransaction } from '@/app/actions'
import type { Account, Category, Contact, AreaNegocio, Producto, Empleado, BienDeUso } from './TransactionForm'

type CatalogsData = {
  accounts: Account[]
  categories: Category[]
  contacts: Contact[]
  areas: AreaNegocio[]
  productos: Producto[]
  empleados: Empleado[]
  bienesDeUso: BienDeUso[]
  operatingModel: 'PRODUCTS' | 'SERVICES' | 'BOTH'
}

export default function FloatingActionButton() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'INCOME' | 'EXPENSE'>('INCOME')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<CatalogsData | null>(null)
  const [saldadaOpen, setSaldadaOpen] = useState(false)
  const [saldadaNombre, setSaldadaNombre] = useState('')
  const [saldadaTipo, setSaldadaTipo] = useState<'cliente' | 'proveedor'>('cliente')
  const [initialSubType, setInitialSubType] = useState<'COBRO_CREDITO' | 'PAGO_DEUDA' | undefined>(undefined)
  const [creditoPreset, setCreditoPreset] = useState<{ linkedCreditoId: string; contactId: string; saldoMax: number } | null>(null)
  const fetchPromiseRef = useRef<Promise<CatalogsData> | null>(null)

  const isAuthRoute = pathname.startsWith('/auth') || pathname.startsWith('/select-business')

  const fetchData = useCallback(() => {
    if (fetchPromiseRef.current) return fetchPromiseRef.current
    const promise = (async () => {
      const raw = await getModalCatalogs()
      const productos: Producto[] = raw.productos.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        categoria: p.categoria ?? null,
        marca: p.marca ?? null,
        precioVenta: p.precioVenta,
        precioCosto: p.precioCosto,
        stockActual: p.stockActual,
        tipo: ('tipo' in p && typeof p.tipo === 'string') ? p.tipo : 'MERCADERIA',
      }))
      const empleados: Empleado[] = raw.empleados.map((e) => ({
        id: e.id,
        nombre: e.nombre,
        cargo: e.cargo ?? null,
      }))
      const bienesDeUso: BienDeUso[] = (raw.bienesDeUso ?? []).map((b) => ({
        id: b.id,
        nombre: b.nombre,
        categoria: b.categoria ?? null,
        marca: b.marca ?? null,
        valorAdquisicion: b.valorAdquisicion,
        depreciacionAcumulada: b.depreciacionAcumulada,
      }))
      const mappedAccounts: Account[] = raw.accounts.map((a) => ({
        id: a.id,
        name: a.name,
        currency: a.currency,
        type: a.type,
      }))
      const mappedCategories: Category[] = raw.categories.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
      }))
      const mappedContacts: Contact[] = raw.contacts.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
      }))
      const catalogs: CatalogsData = {
        accounts: mappedAccounts,
        categories: mappedCategories,
        contacts: mappedContacts,
        areas: raw.areas,
        productos,
        empleados,
        bienesDeUso,
        operatingModel: (raw.operatingModel as CatalogsData['operatingModel']) ?? 'BOTH',
      }
      setData(catalogs)
      return catalogs
    })()
    fetchPromiseRef.current = promise
    promise.catch(() => { fetchPromiseRef.current = null })
    return promise
  }, [])

  // Prefetch silencioso al montar (solo en rutas protegidas) para que el modal abra instantáneo.
  useEffect(() => {
    if (isAuthRoute) return
    if (data || fetchPromiseRef.current) return
    fetchData()
  }, [isAuthRoute, data, fetchData])

  const handleOpen = () => {
    setOpen(true)
    if (!data) {
      setLoading(true)
      fetchData().finally(() => setLoading(false))
    }
  }

  const handleClose = () => {
    setOpen(false)
    setActiveTab('INCOME')
    setInitialSubType(undefined)
    setCreditoPreset(null)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Listener para abrir el modal con preset (desde Créditos, Cajas, etc.)
  useEffect(() => {
    if (isAuthRoute) return
    const onOpenWithPreset = (e: Event) => {
      const detail = (e as CustomEvent<{
        type: 'INCOME' | 'EXPENSE'
        subType: 'COBRO_CREDITO' | 'PAGO_DEUDA'
        linkedCreditoId: string
        contactId: string
        saldoMax: number
      }>).detail
      if (!detail) return
      setActiveTab(detail.type)
      setInitialSubType(detail.subType)
      setCreditoPreset({
        linkedCreditoId: detail.linkedCreditoId,
        contactId: detail.contactId,
        saldoMax: detail.saldoMax,
      })
      setOpen(true)
      if (!data) {
        setLoading(true)
        fetchData().finally(() => setLoading(false))
      }
    }
    window.addEventListener('contago:open-credito-action', onOpenWithPreset as EventListener)
    return () => window.removeEventListener('contago:open-credito-action', onOpenWithPreset as EventListener)
  }, [isAuthRoute, data, fetchData])

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (isAuthRoute) {
    return null
  }

  const handleCreate = async (formData: FormData) => {
    const result = await createTransaction(formData)
    if (result.success) {
      // Cerrar modal solo si no hay deuda saldada — para que el usuario vea el aviso.
      if (!result.data?.clienteSaldado && !result.data?.proveedorSaldado) handleClose()
    }
    return result
  }

  const handleClienteSaldado = (nombre: string) => {
    setSaldadaTipo('cliente')
    setSaldadaNombre(nombre)
    setSaldadaOpen(true)
    handleClose()
  }

  const handleProveedorSaldado = (nombre: string) => {
    setSaldadaTipo('proveedor')
    setSaldadaNombre(nombre)
    setSaldadaOpen(true)
    handleClose()
  }

  return (
    <>
      {/* Botón flotante */}
      <button
        onClick={handleOpen}
        className="fixed bottom-20 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-200 hover:scale-110 hover:shadow-xl active:scale-95 md:bottom-6 md:right-6"
        style={{ background: 'linear-gradient(135deg, #3A4D39 0%, #2A3D29 100%)' }}
        aria-label="Registrar operación"
      >
        <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>

      {/* Modal overlay */}
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center md:items-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

          {/* Panel */}
          <div className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl animate-in slide-in-from-bottom duration-300 dark:bg-zinc-950 md:mx-4 md:rounded-3xl">
            {/* Header */}
            <div className="flex shrink-0 items-start justify-between px-6 pt-5 pb-4">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">Registrar operación</h2>
              </div>
              <div className="flex items-center gap-3">
                {/* Toggle Ingresos / Egresos */}
                <div className="flex overflow-hidden rounded-xl border border-black/[0.08] bg-gray-100 p-0.5 dark:border-white/10 dark:bg-zinc-800">
                  <button
                    onClick={() => setActiveTab('INCOME')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                      activeTab === 'INCOME'
                        ? 'bg-brand-military text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                    }`}
                  >
                    Ventas
                  </button>
                  <button
                    onClick={() => setActiveTab('EXPENSE')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                      activeTab === 'EXPENSE'
                        ? 'bg-brand-oxide text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                    }`}
                  >
                    Compras
                  </button>
                </div>
                <button onClick={handleClose} className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-zinc-800" aria-label="Cerrar">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 pb-6">
              {loading || !data ? (
                <div className="flex items-center justify-center py-14">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-military border-t-transparent" />
                </div>
              ) : (
                <TransactionForm
                  accounts={data.accounts}
                  categories={data.categories}
                  contacts={data.contacts}
                  areas={data.areas}
                  productos={data.productos}
                  empleados={data.empleados}
                  bienesDeUso={data.bienesDeUso}
                  operatingModel={data.operatingModel}
                  onSubmit={handleCreate}
                  onClienteSaldado={handleClienteSaldado}
                  onProveedorSaldado={handleProveedorSaldado}
                  initialType={activeTab}
                  initialSubType={initialSubType}
                  initialCreditoPreset={creditoPreset}
                  onTypeChange={setActiveTab}
                />
              )}
            </div>
          </div>
        </div>
      )}
      <DeudaSaldadaModal open={saldadaOpen} clienteNombre={saldadaNombre} tipo={saldadaTipo} onClose={() => setSaldadaOpen(false)} />
    </>
  )
}

