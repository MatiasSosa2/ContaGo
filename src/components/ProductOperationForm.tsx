'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { createProductOperation, createProducto } from '@/app/actions'
import type { Account, Contact, Empleado, Producto } from './TransactionForm'
import type { Registrado } from '@/lib/registro'
import ContactPicker from './registro/ContactPicker'
import { MoneyField, PaymentSection, fmt, nextKey, num, round2, usePayments } from './registro/payment'
import { Caption, Chevron, Group, IOS_FONT, MenuSelect, MiniCard, PrimaryButton } from './ui/ios'

type Item = { key: number; productoId: string; cantidad: string; precio: string }

// Columnas del carrito: producto | cant. | precio | total | quitar
const ITEM_GRID = 'grid grid-cols-[minmax(0,1fr)_36px_80px_84px_12px] items-center gap-2'

// Fila de carga: producto | cant. | precio | total
const ENTRY_GRID = 'grid grid-cols-[minmax(0,1fr)_44px_88px_88px] items-center gap-2'

// Campo chico del carrito: sin caja, con línea al enfocar
const CART_INPUT_CLS =
  'ios-bare w-full border-b border-transparent bg-transparent text-right text-[13px] text-[#1C1C1E] outline-none focus:border-[var(--reg-accent,#34C759)] dark:text-white tabular-nums'

// Pestaña flotante de la columna derecha (carrito, pago)
const SIDE_CARD_CLS = 'shrink-0 rounded-3xl bg-[#F2F2F7] p-4 shadow-2xl dark:bg-black'

// Pantalla ancha (md): el carrito va al costado de la pestaña
const WIDE_QUERY = '(min-width: 768px)'
const subscribeWide = (cb: () => void) => {
  const mq = window.matchMedia(WIDE_QUERY)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
const getWide = () => window.matchMedia(WIDE_QUERY).matches

/** "Stock 37 · Marca · Categoría" */
function productoDetalle(p: Producto, stock: number) {
  return [stock > 0 ? `Stock ${stock.toLocaleString('es-AR')}` : 'Sin stock', p.marca, p.categoria].filter(Boolean).join(' · ')
}

/** Número del carrito: se ve formateado ("$480.000") y se edita al tocarlo */
function CartNumber({ value, onChange, money, label }: { value: string; onChange: (v: string) => void; money?: boolean; label: string }) {
  const [editing, setEditing] = useState(false)
  if (editing) {
    return (
      <input
        autoFocus type="number" min="0" step="0.01" value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => { if (e.key === 'Enter') setEditing(false) }}
        className={CART_INPUT_CLS} aria-label={label}
      />
    )
  }
  return (
    <button type="button" onClick={() => setEditing(true)} aria-label={`Editar ${label.toLowerCase()}`}
      className="w-full border-b border-transparent text-right text-[13px] text-[#8E8E93] transition-colors hover:border-black/10 dark:hover:border-white/15">
      {money ? fmt(num(value)) : num(value).toLocaleString('es-AR')}
    </button>
  )
}

export default function ProductOperationForm({ tipo, accounts, contacts, empleados, productos, date, onDone, onContactCreated, cartSlot, footerSlot }: {
  /** VENTA: sale stock, precio de venta, cliente. COMPRA: entra stock, precio de costo, proveedor */
  tipo: 'VENTA' | 'COMPRA'
  accounts: Account[]
  contacts: Contact[]
  empleados: Empleado[]
  productos: Producto[]
  date: string
  onDone: (registrado?: Registrado) => void
  /** Cliente/proveedor agregado desde el selector: el modal lo suma a su catálogo */
  onContactCreated?: (contact: Contact) => void
  /** Lugar al costado de la pestaña donde se dibuja el carrito (pantallas anchas) */
  cartSlot?: HTMLElement | null
  /** Lugar debajo de la pestaña para la tarjeta del botón */
  footerSlot?: HTMLElement | null
}) {
  const isWide = useSyncExternalStore(subscribeWide, getWide, () => false)
  const esVenta = tipo === 'VENTA'
  // Venta: clientes. Compra: proveedores (más los agregados recién desde el selector)
  const [contactosNuevos, setContactosNuevos] = useState<Contact[]>([])
  const contraparte = useMemo(
    () => [...contacts, ...contactosNuevos.filter((n) => !contacts.some((c) => c.id === n.id))]
      .filter((c) => c.type === (esVenta ? 'CLIENT' : 'SUPPLIER')),
    [contacts, contactosNuevos, esVenta],
  )
  // Venta/compra a crédito sin cliente/proveedor: se marca el campo
  const [faltaContacto, setFaltaContacto] = useState(false)
  // Productos creados desde la compra (alta rápida), además de los del catálogo
  const [creados, setCreados] = useState<Producto[]>([])
  const todos = useMemo(() => [...productos, ...creados], [productos, creados])
  const mercaderia = useMemo(() => todos.filter((p) => (p.tipo ?? 'MERCADERIA') === 'MERCADERIA'), [todos])
  const productoById = useMemo(() => new Map(todos.map((p) => [p.id, p])), [todos])

  // ── Ítems ──
  const [items, setItems] = useState<Item[]>([])
  // Producto que se está cargando (va al carrito con "Agregar")
  const [draft, setDraft] = useState<{ productoId: string; cantidad: string; precio: string }>({ productoId: '', cantidad: '', precio: '' })
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const pickerRef = useRef<HTMLDivElement>(null)
  const cerrarBuscador = () => { setSearching(false); setQuery(''); setNuevo(null) }

  // Alta rápida (compra): mini formulario al final de la lista
  const [nuevo, setNuevo] = useState<{ nombre: string; precioVenta: string; categoria: string } | null>(null)
  const [creando, setCreando] = useState(false)
  const crearProducto = async () => {
    if (!nuevo || !nuevo.nombre.trim()) { setError('Indicá el nombre del producto'); return }
    const fd = new FormData()
    fd.set('nombre', nuevo.nombre.trim())
    fd.set('tipo', 'MERCADERIA')
    fd.set('precioVenta', String(num(nuevo.precioVenta)))
    if (nuevo.categoria.trim()) fd.set('categoria', nuevo.categoria.trim())
    setCreando(true)
    const res = await createProducto(fd)
    setCreando(false)
    if (!res.success || !res.data) { setError((!res.success && res.error) || 'No se pudo crear el producto'); return }
    const producto: Producto = {
      id: res.data.id,
      nombre: nuevo.nombre.trim(),
      categoria: nuevo.categoria.trim() || null,
      marca: null,
      precioVenta: num(nuevo.precioVenta),
      precioCosto: 0,
      stockActual: 0,
      tipo: 'MERCADERIA',
    }
    setCreados((prev) => [...prev, producto])
    setNuevo(null)
    // Queda elegido para cargar cantidad y precio de compra
    setDraft({ productoId: producto.id, cantidad: '1', precio: '' })
    setSearching(false)
    setQuery('')
    setError(null)
  }

  // La lista flotante se cierra al tocar afuera
  useEffect(() => {
    if (!searching) return
    const onDown = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) { setSearching(false); setQuery(''); setNuevo(null) }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [searching])

  // ── Descuento ──
  const [descuentoModo, setDescuentoModo] = useState<'$' | '%'>('$')
  const [descuentoText, setDescuentoText] = useState('')

  // ── Más datos ──
  const [contactId, setContactId] = useState('')
  const [empleadoId, setEmpleadoId] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // ── Totales ──
  const subtotal = round2(items.reduce((s, i) => s + num(i.cantidad) * num(i.precio), 0))
  const descuento = round2(Math.min(subtotal, Math.max(0,
    descuentoModo === '%' ? subtotal * num(descuentoText) / 100 : num(descuentoText),
  )))
  const total = round2(subtotal - descuento)
  // Pago: Efectivo | Virtual | Crédito, cuotas y medios combinados
  const pay = usePayments({ total, accounts, date })

  const resultados = useMemo(() => {
    const q = query.trim().toLowerCase()
    return mercaderia
      .filter((p) => !q || p.nombre.toLowerCase().includes(q) || (p.marca ?? '').toLowerCase().includes(q))
      .slice(0, 8)
  }, [mercaderia, query])

  // ── Ítems ──
  const elegirProducto = (id: string) => {
    const p = productoById.get(id)
    // Venta: precio de lista. Compra: último costo (CPP)
    const precio = p ? (esVenta ? p.precioVenta : p.precioCosto) : 0
    setDraft({ productoId: id, cantidad: '1', precio: precio > 0 ? String(round2(precio)) : '' })
    setSearching(false)
    setQuery('')
    setError(null)
  }

  /**
   * Stock contando lo que ya está en el carrito (sin el ítem `exceptKey`):
   * venta lo descuenta (lo que queda), compra lo suma (cómo va a quedar).
   */
  const disponible = (productoId: string, exceptKey?: number) => {
    const stock = productoById.get(productoId)?.stockActual ?? 0
    const enCarrito = items.reduce((s, i) => (i.productoId === productoId && i.key !== exceptKey ? s + num(i.cantidad) : s), 0)
    return round2(esVenta ? stock - enCarrito : stock + enCarrito)
  }

  const draftTotal = num(draft.cantidad) * num(draft.precio)
  const draftProducto = draft.productoId ? productoById.get(draft.productoId) : undefined

  // Aviso sutil fuera de la pestaña ("Kit Materiales agregado al carrito")
  const [aviso, setAviso] = useState<{ id: number; text: string } | null>(null)
  const avisar = (text: string) => {
    const id = nextKey()
    setAviso({ id, text })
    setTimeout(() => setAviso((a) => (a?.id === id ? null : a)), 2200)
  }

  const agregarAlCarrito = () => {
    if (!draft.productoId) { setError('Elegí un producto'); return }
    if (num(draft.cantidad) <= 0) { setError('La cantidad debe ser mayor a 0'); return }
    if (draft.precio === '' || num(draft.precio) < 0) { setError('Indicá el precio'); return }
    const disp = disponible(draft.productoId)
    if (esVenta && num(draft.cantidad) > disp) {
      setError(disp > 0 ? `Solo quedan ${disp.toLocaleString('es-AR')} en stock` : 'No queda stock de este producto')
      return
    }
    setItems((prev) => [...prev, { key: nextKey(), ...draft }])
    avisar(`${draftProducto?.nombre ?? 'Producto'} agregado al carrito`)
    setDraft({ productoId: '', cantidad: '', precio: '' })
    setError(null)
  }
  const updateItem = (key: number, patch: Partial<Item>) => {
    // Venta: la cantidad del carrito no puede superar el stock del producto
    if (esVenta && patch.cantidad !== undefined) {
      const item = items.find((i) => i.key === key)
      if (item) {
        const max = disponible(item.productoId, key)
        if (num(patch.cantidad) > max) {
          setError(`Solo hay ${max.toLocaleString('es-AR')} en stock`)
          patch = { ...patch, cantidad: String(max) }
        }
      }
    }
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)))
  }

  // ── Enviar ──
  const handleSubmit = async () => {
    setError(null)
    if (items.length === 0) { setError('Agregá al menos un producto'); return }
    if (items.some((i) => num(i.cantidad) <= 0)) { setError('Revisá las cantidades'); return }
    if (total <= 0) { setError('El total debe ser mayor a 0'); return }
    const pagosRes = pay.buildPayload()
    if (!pagosRes.ok) { setError(pagosRes.error); return }
    // A crédito tiene que haber a quién cobrarle / pagarle (si no, en Créditos queda de "nadie")
    if (!contactId && pagosRes.pagos.some((p) => p.metodo === 'CREDITO')) {
      setFaltaContacto(true)
      setError(esVenta ? 'Elegí el cliente para vender a crédito' : 'Elegí el proveedor para comprar a crédito')
      return
    }

    const fd = new FormData()
    fd.set('payload', JSON.stringify({
      tipo,
      date,
      contactId: contactId || undefined,
      empleadoId: empleadoId || undefined,
      items: items.map((i) => ({ productoId: i.productoId, cantidad: num(i.cantidad), precioUnitario: num(i.precio) })),
      descuento,
      pagos: pagosRes.pagos,
    }))

    setSubmitting(true)
    const result = await createProductOperation(fd)
    setSubmitting(false)
    if (!result.success) { setError(result.error || `No se pudo registrar la ${esVenta ? 'venta' : 'compra'}`); return }
    onDone({ titulo: `${esVenta ? 'Venta' : 'Compra'} registrada`, monto: total, undo: result.data?.undo })
  }

  // ── Carrito: lista fija editable + subtotal, descuento y total ──
  const carrito = (
    <div className={`flex flex-col ${IOS_FONT}`}>
      <div className="mb-1.5 flex items-baseline justify-between px-4">
        <p className="text-[13px] text-[#8E8E93]">Carrito</p>
        {items.length > 0 && <p className="text-[12px] text-[#8E8E93]">{items.length} producto{items.length !== 1 ? 's' : ''}</p>}
      </div>
      <Group>
        {items.length === 0 ? (
          <p className="px-4 py-6 text-center text-[13px] text-[#8E8E93]">Todavía no agregaste productos</p>
        ) : (
          <>
            <div className={`${ITEM_GRID} px-3 pb-1.5 pt-2.5 text-[11px] text-[#8E8E93]`}>
              <span>Producto</span>
              <span className="text-right">Cant.</span>
              <span className="text-right">Precio</span>
              <span className="text-right">Total</span>
              <span />
            </div>
            {items.map((i) => (
              <div key={i.key} className={`${ITEM_GRID} min-h-[38px] px-3 py-1.5 text-[13px] text-[#1C1C1E] dark:text-white`}>
                <span className="truncate" title={productoById.get(i.productoId)?.nombre}>{productoById.get(i.productoId)?.nombre ?? '—'}</span>
                <CartNumber value={i.cantidad} onChange={(v) => updateItem(i.key, { cantidad: v })} label="Cantidad" />
                <CartNumber value={i.precio} onChange={(v) => updateItem(i.key, { precio: v })} label="Precio" money />
                <span className="text-right">{fmt(num(i.cantidad) * num(i.precio))}</span>
                <button
                  type="button"
                  onClick={() => setItems((prev) => prev.filter((x) => x.key !== i.key))}
                  className="flex justify-end text-[#C7C7CC] transition-colors hover:text-[#FF3B30]"
                  aria-label="Quitar producto"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
          </>
        )}
      </Group>

      <Group className="mt-3">
        {/* Subtotal y descuento más chicos para que resalte el total */}
        <div className="flex min-h-[36px] items-center justify-between px-4 text-[13px]">
          <span className="text-[#8E8E93]">Subtotal</span>
          <span className="text-[#8E8E93]">{fmt(subtotal)}</span>
        </div>
        {/* Descuento: fila mínima; tocar "$" / "%" alterna el tipo */}
        <div className="flex min-h-[30px] items-center justify-between gap-3 px-4 text-[12px] text-[#AEAEB2]">
          <span>Descuento</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setDescuentoModo((m) => (m === '$' ? '%' : '$'))}
              aria-label={`Descuento en ${descuentoModo === '$' ? 'pesos' : 'porcentaje'}, tocar para cambiar`}
              className="rounded px-1 transition-colors hover:text-[#8E8E93]"
            >
              {descuentoModo}
            </button>
            <input
              type="number" min="0" step="0.01" value={descuentoText} placeholder="0"
              onChange={(e) => setDescuentoText(e.target.value)}
              className="ios-bare w-16 bg-transparent text-right text-[12px] text-[#8E8E93] outline-none placeholder:text-[#C7C7CC] tabular-nums" aria-label="Descuento"
            />
          </div>
        </div>
        <div className="flex min-h-[52px] items-center justify-between px-4">
          <span className="text-[15px] font-medium text-[#1C1C1E] dark:text-white">Total</span>
          <span className="text-[20px] font-semibold text-[var(--reg-accent,#34C759)]">{fmt(total)}</span>
        </div>
      </Group>
    </div>
  )

  // ── Pago: al costado (debajo del carrito) en pantallas grandes ──
  const pagoSection = <PaymentSection pay={pay} />

  return (
    <div className="mt-5 flex flex-col">
      {error && (
        <div className="mb-3 flex items-center justify-between rounded-xl bg-[#FF3B30]/10 px-4 py-2.5 text-[13px] text-[#D70015] dark:text-[#FF6961]">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Cerrar aviso" className="ml-3 opacity-60">×</button>
        </div>
      )}

      {/* ── Cargar producto ── */}
      <Caption>Producto</Caption>
      <div ref={pickerRef} className="relative">
        <Group>
          {/* Producto | Cant. | Precio | Total en una sola fila */}
          <div>
            <div className={`${ENTRY_GRID} px-4 pt-2 text-[11px] text-[#8E8E93]`}>
              <span>Producto</span>
              <span className="text-right">Cant.</span>
              <span className="text-right">Precio</span>
              <span className="text-right">Total</span>
            </div>
            <div className={`${ENTRY_GRID} px-4 pb-2.5 pt-0.5 text-[13px]`}>
              <button
                type="button"
                onClick={() => setSearching((v) => !v)}
                className="flex min-w-0 items-center gap-1 border-b border-transparent text-left transition-colors hover:border-black/10 dark:hover:border-white/15"
                aria-label="Elegir producto"
              >
                <span className={`truncate ${draftProducto ? 'text-[#1C1C1E] dark:text-white' : 'text-[#C7C7CC]'}`}>
                  {draftProducto ? draftProducto.nombre : 'Elegir producto'}
                </span>
                <Chevron open={searching} />
              </button>
              <input
                type="number" min="0.01" step="0.01" value={draft.cantidad}
                onChange={(e) => setDraft((d) => ({ ...d, cantidad: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') agregarAlCarrito() }}
                className="ios-bare w-full border-b border-transparent bg-transparent text-right text-[13px] text-[#1C1C1E] outline-none focus:border-[var(--reg-accent,#34C759)] dark:text-white tabular-nums"
                aria-label="Cantidad"
              />
              <MoneyField
                align="right"
                value={draft.precio}
                onChange={(v) => setDraft((d) => ({ ...d, precio: v }))}
                onEnter={agregarAlCarrito}
                label="Precio"
              />
              <span className="text-right text-[#1C1C1E] dark:text-white">{fmt(draftTotal)}</span>
            </div>
          </div>
          <div className="flex justify-center py-2">
            <button
              type="button"
              onClick={agregarAlCarrito}
              className="text-[13px] font-medium text-[var(--reg-accent,#34C759)] transition-opacity active:opacity-60"
            >
              Agregar al carrito
            </button>
          </div>
        </Group>

        {/* Lista flotante: se abre sobre la pestaña, no la estira */}
        {searching && (
          <div className="absolute inset-x-0 top-[62px] z-30 overflow-hidden rounded-xl bg-[#fff] shadow-[0_12px_40px_rgba(0,0,0,0.18)] ring-1 ring-black/[0.06] dark:bg-[#2C2C2E] dark:ring-white/10">
            <div className="flex items-center gap-2 border-b border-black/[0.08] px-3 py-2 dark:border-white/[0.08]">
              <svg className="h-3.5 w-3.5 shrink-0 text-[#8E8E93]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" /></svg>
              <input
                autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && resultados[0]) elegirProducto(resultados[0].id)
                  if (e.key === 'Escape') { e.stopPropagation(); cerrarBuscador() }
                }}
                placeholder="Buscar"
                className="ios-bare flex-1 bg-transparent text-[13px] text-[#1C1C1E] outline-none placeholder:text-[#C7C7CC] dark:text-white"
              />
            </div>
            <div className="max-h-64 overflow-y-auto">
              {resultados.length === 0 ? (
                <p className="px-3 py-3 text-[13px] text-[#8E8E93]">Sin coincidencias</p>
              ) : resultados.map((p) => {
                // Stock que queda descontando lo que ya está en el carrito
                const stock = disponible(p.id)
                return (
                  <button
                    key={p.id} type="button" onClick={() => elegirProducto(p.id)}
                    disabled={esVenta && stock <= 0}
                    className={`block w-full px-3 py-2 text-left transition-colors hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/[0.06] ${p.id === draft.productoId ? 'bg-brand-military/[0.06]' : ''}`}
                  >
                    <span className="block truncate text-[13px] text-[#1C1C1E] dark:text-white">{p.nombre}</span>
                    <span className="block truncate text-[11px] text-[#8E8E93]">{productoDetalle(p, stock)}</span>
                  </button>
                )
              })}
            </div>

            {/* Compra: alta rápida de un producto que todavía no está en Inventario */}
            {!esVenta && (nuevo === null ? (
              <button
                type="button"
                onClick={() => setNuevo({ nombre: query.trim(), precioVenta: '', categoria: '' })}
                className="block w-full border-t border-black/[0.06] px-3 py-2 text-left text-[11px] text-[#AEAEB2] transition-colors hover:text-[#8E8E93] dark:border-white/[0.08]"
              >
                + Nuevo producto
              </button>
            ) : (
              <div className="border-t border-black/[0.06] px-3 py-2 dark:border-white/[0.08]">
                <p className="mb-1 text-[11px] text-[#8E8E93]">Nuevo producto</p>
                <input
                  autoFocus value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
                  placeholder="Nombre" maxLength={100}
                  className="ios-bare w-full border-b border-black/[0.08] bg-transparent py-1 text-[13px] text-[#1C1C1E] outline-none placeholder:text-[#C7C7CC] focus:border-[var(--reg-accent,#34C759)] dark:border-white/10 dark:text-white"
                />
                <div className="mt-1 flex gap-3">
                  <input
                    type="number" min="0" step="0.01" value={nuevo.precioVenta} onChange={(e) => setNuevo({ ...nuevo, precioVenta: e.target.value })}
                    placeholder="Precio de venta"
                    className="ios-bare w-1/2 border-b border-black/[0.08] bg-transparent py-1 text-[13px] text-[#1C1C1E] outline-none placeholder:text-[#C7C7CC] focus:border-[var(--reg-accent,#34C759)] dark:border-white/10 dark:text-white"
                  />
                  <input
                    value={nuevo.categoria} onChange={(e) => setNuevo({ ...nuevo, categoria: e.target.value })}
                    placeholder="Categoría (opcional)" maxLength={80}
                    className="ios-bare w-1/2 border-b border-black/[0.08] bg-transparent py-1 text-[13px] text-[#1C1C1E] outline-none placeholder:text-[#C7C7CC] focus:border-[var(--reg-accent,#34C759)] dark:border-white/10 dark:text-white"
                  />
                </div>
                <div className="mt-2 flex justify-end gap-4 text-[12px]">
                  <button type="button" onClick={() => setNuevo(null)} className="text-[#8E8E93]">Cancelar</button>
                  <button type="button" onClick={crearProducto} disabled={creando} className="font-medium text-[var(--reg-accent,#34C759)] disabled:opacity-50">
                    {creando ? 'Guardando…' : 'Crear'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {aviso && createPortal(
        <div key={aviso.id} role="status" className={`pointer-events-none fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 rounded-full bg-black/75 px-4 py-2 text-[13px] text-white shadow-lg backdrop-blur animate-in fade-in slide-in-from-bottom-2 duration-200 dark:bg-white/85 dark:text-black ${IOS_FONT}`}>
          {aviso.text}
        </div>,
        document.body,
      )}

      {/* Carrito: al costado en pantallas grandes, acá en el celular */}
      {cartSlot && isWide
        // Carrito y pago como dos pestañas separadas en la columna derecha
        ? (items.length > 0 && createPortal(<><div className={SIDE_CARD_CLS}>{carrito}</div><div className={SIDE_CARD_CLS}>{pagoSection}</div></>, cartSlot))
        : (items.length > 0 && <><div className="mt-5">{carrito}</div><div className="mt-5">{pagoSection}</div></>)}

      {/* ── Más datos: dos tarjetitas en una fila ── */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <MiniCard label={esVenta ? 'Cliente' : 'Proveedor'}>
          <ContactPicker
            type={esVenta ? 'CLIENT' : 'SUPPLIER'}
            contacts={contraparte}
            value={contactId}
            onChange={(id) => { setContactId(id); if (id) { setFaltaContacto(false); setError(null) } }}
            onCreated={(c) => { setContactosNuevos((prev) => [...prev, c]); onContactCreated?.(c) }}
            invalid={faltaContacto && !contactId}
          />
        </MiniCard>
        <MiniCard label="Empleado">
          <MenuSelect
            label="Empleado"
            tone="strong" align="left" size="sm"
            value={empleadoId}
            options={[{ value: '', label: 'Ninguno' }, ...empleados.map((em) => ({ value: em.id, label: em.nombre }))]}
            onChange={setEmpleadoId}
          />
        </MiniCard>
      </div>

      <PrimaryButton onClick={handleSubmit} disabled={submitting} color={esVenta ? 'green' : 'red'} slot={footerSlot}>
        {submitting ? 'Guardando…' : `Registrar ${esVenta ? 'venta' : 'compra'}${items.length > 0 ? ` · ${fmt(total)}` : ''}`}
      </PrimaryButton>
    </div>
  )
}
