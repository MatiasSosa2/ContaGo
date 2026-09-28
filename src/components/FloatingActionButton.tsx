'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { usePathname } from 'next/navigation'
import TransactionForm from './TransactionForm'
import CashTransferForm from './CashTransferForm'
import CashAdjustmentForm from './CashAdjustmentForm'
import DeudaSaldadaModal from './DeudaSaldadaModal'
import DatePickerField from './ui/DatePickerField'
import { getModalCatalogs, createTransaction, createCategoryWithContable, deleteCategory, createSubcategory, deleteSubcategory } from '@/app/actions'
import type { Account, Category, Subcategory, Contact, AreaNegocio, Producto, Empleado, BienDeUso } from './TransactionForm'

type CatalogsData = {
  accounts: Account[]
  categories: Category[]
  subcategories: Subcategory[]
  contacts: Contact[]
  areas: AreaNegocio[]
  productos: Producto[]
  empleados: Empleado[]
  bienesDeUso: BienDeUso[]
  operatingModel: 'PRODUCTS' | 'SERVICES' | 'BOTH'
}

type Mode = 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'ADJUST'

const MODE_TITLE: Record<Mode, { label: string; cls: string }> = {
  INCOME: { label: 'Ingreso', cls: 'text-brand-military' },
  EXPENSE: { label: 'Egreso', cls: 'text-brand-oxide' },
  TRANSFER: { label: 'Cambio de caja', cls: 'text-zinc-700 dark:text-zinc-300' },
  ADJUST: { label: 'Diferencia de caja', cls: 'text-zinc-700 dark:text-zinc-300' },
}

// Pastillas principales del abanico: Ingresos arriba del "+", Egresos a su izquierda.
// `pos` las ubica abiertas; `from` es el desplazamiento hacia el "+" cuando están cerradas.
const FAN_ITEMS = [
  { type: 'INCOME' as const, label: 'Ingresos', bg: 'bg-brand-military', pos: 'bottom-[68px] right-0', from: 'translate(0, 44px)' },
  { type: 'EXPENSE' as const, label: 'Egresos', bg: 'bg-brand-oxide', pos: 'right-[68px] top-2', from: 'translate(44px, 0)' },
]

// Opciones secundarias: fila de chips grises debajo del "+" (el "+" sube para hacerles lugar)
const SECONDARY_ITEMS = [
  { type: 'TRANSFER' as const, label: 'Cambio caja' },
  { type: 'ADJUST' as const, label: 'Diferencia de caja' },
]
const FAB_LIFT = 'translateY(-48px)'
const SPRING = 'cubic-bezier(.3,1.35,.5,1)'

// Fecha local (no UTC: de noche en Argentina toISOString ya da el día siguiente)
function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function FloatingActionButton() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  // Menú del "+" con las cuatro opciones
  const [menuOpen, setMenuOpen] = useState(false)
  // Opción elegida: late un instante antes de abrir la pestaña
  const [picked, setPicked] = useState<Mode | null>(null)
  const [activeTab, setActiveTab] = useState<Mode>('INCOME')
  const [date, setDate] = useState(todayIso)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<CatalogsData | null>(null)
  // Panel al costado de la pestaña donde la venta dibuja el carrito
  const [cartSlot, setCartSlot] = useState<HTMLDivElement | null>(null)
  // Tarjeta debajo de la pestaña con el botón "Registrar…"
  const [footerSlot, setFooterSlot] = useState<HTMLDivElement | null>(null)
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
        subcategories: raw.subcategories ?? [],
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

  const handleOpen = (type: Mode) => {
    setMenuOpen(false)
    setActiveTab(type)
    setOpen(true)
    if (!data) {
      setLoading(true)
      fetchData().finally(() => setLoading(false))
    }
  }

  const pickFromMenu = (type: Mode) => {
    if (picked) return
    setPicked(type)
    setTimeout(() => {
      handleOpen(type)
      setPicked(null)
    }, 180)
  }

  const handleClose = () => {
    setOpen(false)
    setActiveTab('INCOME')
    setDate(todayIso())
    setInitialSubType(undefined)
    setCreditoPreset(null)
  }

  useEffect(() => {
    if (!open && !menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (open) handleClose()
      else setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, menuOpen])

  const handleAddCategory = async (name: string, type: 'INCOME' | 'EXPENSE') => {
    const fd = new FormData()
    fd.set('name', name)
    fd.set('type', type)
    const result = await createCategoryWithContable(fd)
    if (!result.success) return result.error
    if (!result.data) return 'No se pudo crear la categoría'
    const created = { id: result.data.id, name: result.data.name, type }
    setData((d) => (d ? { ...d, categories: [...d.categories, created] } : d))
    return null
  }

  const handleDeleteCategory = async (id: string) => {
    // Sus subcategorías se borran en cascada
    setData((d) => (d ? {
      ...d,
      categories: d.categories.filter((c) => c.id !== id),
      subcategories: d.subcategories.filter((s) => s.categoryId !== id),
    } : d))
    await deleteCategory(id)
  }

  const handleAddSubcategory = async (categoryId: string, name: string): Promise<{ id: string } | { error: string }> => {
    const fd = new FormData()
    fd.set('name', name)
    fd.set('categoryId', categoryId)
    const result = await createSubcategory(fd)
    if (!result.success) return { error: result.error }
    if (!result.data) return { error: 'No se pudo crear la subcategoría' }
    const created = result.data
    setData((d) => (d ? { ...d, subcategories: [...d.subcategories, created] } : d))
    return { id: created.id }
  }

  const handleDeleteSubcategory = async (id: string) => {
    setData((d) => (d ? { ...d, subcategories: d.subcategories.filter((s) => s.id !== id) } : d))
    await deleteSubcategory(id)
  }

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
      {/* Menú del "+" en abanico: dos burbujas que salen en arco */}
      <div
        className={`fixed inset-0 z-40 bg-black/25 transition-opacity duration-200 ${menuOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={() => setMenuOpen(false)}
        aria-hidden
      />
      <div
        className="pointer-events-none fixed bottom-20 right-4 z-50 h-14 w-14 md:bottom-6 md:right-6"
        style={{ transform: menuOpen ? FAB_LIFT : 'none', transition: `transform 380ms ${SPRING}` }}
      >
        {/* Secundarias: chips grises en fila, debajo del "+" */}
        <div className="absolute right-0 top-full mt-2 flex gap-2">
          {SECONDARY_ITEMS.map((item, idx) => {
            const isPicked = picked === item.type
            const hidden = !menuOpen || (picked !== null && !isPicked)
            return (
              <button
                key={item.type}
                onClick={() => pickFromMenu(item.type)}
                tabIndex={menuOpen ? 0 : -1}
                aria-hidden={!menuOpen}
                className={`h-8 whitespace-nowrap rounded-full bg-zinc-700 px-3.5 text-xs font-semibold text-white shadow-md ${hidden ? 'opacity-0' : 'pointer-events-auto opacity-100'}`}
                style={{
                  transform: menuOpen ? `scale(${isPicked ? 1.08 : 1})` : 'translateY(-24px) scale(0.6)',
                  transition: `transform 380ms ${SPRING}, opacity 200ms ease`,
                  // Salen después que las principales
                  transitionDelay: menuOpen && picked === null ? `${90 + idx * 40}ms` : '0ms',
                }}
              >
                {item.label}
              </button>
            )
          })}
        </div>

        {FAN_ITEMS.map((item, idx) => {
          const isPicked = picked === item.type
          const hidden = !menuOpen || (picked !== null && !isPicked)
          return (
            <button
              key={item.type}
              onClick={() => pickFromMenu(item.type)}
              tabIndex={menuOpen ? 0 : -1}
              aria-hidden={!menuOpen}
              aria-label={item.label}
              className={`absolute ${item.pos} h-10 whitespace-nowrap rounded-full px-5 text-sm font-semibold text-white shadow-md ${item.bg} ${hidden ? 'opacity-0' : 'pointer-events-auto opacity-100'}`}
              style={{
                transform: menuOpen ? `scale(${isPicked ? 1.08 : 1})` : `${item.from} scale(0.6)`,
                transition: `transform 380ms ${SPRING}, opacity 200ms ease`,
                transitionDelay: menuOpen && picked === null ? `${idx * 40}ms` : '0ms',
              }}
            >
              {item.label}
            </button>
          )
        })}
      </div>

      {/* Botón flotante */}
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className="fixed bottom-20 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-200 hover:scale-110 hover:shadow-xl active:scale-95 md:bottom-6 md:right-6"
        style={{
          // Dorado de la marca: no se confunde con Ingresos (verde), Egresos (rojo) ni las grises
          background: 'linear-gradient(135deg, #C5A065 0%, #A8864E 100%)',
          // Sube junto con el abanico para dejar la fila secundaria abajo
          translate: menuOpen ? '0 -48px' : '0 0',
          transition: `translate 380ms ${SPRING}, scale 200ms ease, box-shadow 200ms ease`,
        }}
        aria-label="Registrar operación"
        aria-expanded={menuOpen}
      >
        <svg className={`h-7 w-7 text-white transition-transform duration-300 ${menuOpen ? 'rotate-45' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>

      {/* Modal overlay */}
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center md:items-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

          {/* Pestañas en una fila y, debajo, la tarjeta del botón a todo el ancho */}
          <div className="relative flex w-full max-w-lg flex-col gap-3 md:mx-4 md:w-auto md:max-w-none">
          {/* Cerrar: afuera del panel, sin fondo */}
          <button
            onClick={handleClose}
            className="absolute -top-11 right-3 z-10 rounded-full p-1.5 text-white/80 transition-colors hover:text-white md:-right-11 md:top-0"
            aria-label="Cerrar"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="flex w-full items-start gap-4">
          {/* Panel */}
          <div className="relative flex max-h-[calc(88vh-80px)] w-full shrink-0 flex-col overflow-hidden rounded-3xl md:w-[32rem] bg-[#F2F2F7] shadow-2xl animate-in slide-in-from-bottom duration-300 dark:bg-black md:max-h-[calc(92vh-80px)]">
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between px-5 pt-5 pb-3">
              <h2 className={`text-[17px] font-semibold ${MODE_TITLE[activeTab].cls}`}>
                {MODE_TITLE[activeTab].label}
              </h2>
              <DatePickerField variant="icon" value={date} onChange={setDate} />
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 pb-6">
              {loading || !data ? (
                <div className="flex items-center justify-center py-14">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-military border-t-transparent" />
                </div>
              ) : activeTab === 'TRANSFER' ? (
                <CashTransferForm accounts={data.accounts} date={date} onDone={handleClose} footerSlot={footerSlot} />
              ) : activeTab === 'ADJUST' ? (
                <CashAdjustmentForm accounts={data.accounts} date={date} onDone={handleClose} footerSlot={footerSlot} />
              ) : (
                <TransactionForm
                  accounts={data.accounts}
                  categories={data.categories}
                  subcategories={data.subcategories}
                  contacts={data.contacts}
                  areas={data.areas}
                  productos={data.productos}
                  empleados={data.empleados}
                  bienesDeUso={data.bienesDeUso}
                  onSubmit={handleCreate}
                  onClienteSaldado={handleClienteSaldado}
                  onProveedorSaldado={handleProveedorSaldado}
                  initialType={activeTab}
                  initialSubType={initialSubType}
                  initialCreditoPreset={creditoPreset}
                  onTypeChange={setActiveTab}
                  date={date}
                  onDateChange={setDate}
                  onAddCategory={handleAddCategory}
                  onDeleteCategory={handleDeleteCategory}
                  onAddSubcategory={handleAddSubcategory}
                  onDeleteSubcategory={handleDeleteSubcategory}
                  onSaleDone={handleClose}
                  cartSlot={cartSlot}
                  footerSlot={footerSlot}
                />
              )}
            </div>
          </div>

          {/* Carrito y pago (solo con una venta/compra en curso y en pantallas anchas) */}
          <div
            ref={setCartSlot}
            className="hidden max-h-[calc(92vh-80px)] w-[26rem] shrink-0 flex-col gap-4 overflow-y-auto animate-in fade-in duration-300 md:[&:not(:empty)]:flex"
          />
          </div>

          {/* Tarjeta del botón "Registrar…": ocupa el ancho de todas las pestañas */}
          <div ref={setFooterSlot} className="empty:hidden" />
          </div>
        </div>
      )}
      <DeudaSaldadaModal open={saldadaOpen} clienteNombre={saldadaNombre} tipo={saldadaTipo} onClose={() => setSaldadaOpen(false)} />
    </>
  )
}

