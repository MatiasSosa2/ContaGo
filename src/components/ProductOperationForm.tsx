'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createProductOperation, createProducto } from '@/app/actions'
import type { Account, Contact, Empleado, Producto } from './TransactionForm'
import type { Registrado } from '@/lib/registro'
import ContactPicker from './registro/ContactPicker'
import { PaymentSection, fmt, nextKey, num, round2, usePayments } from './registro/payment'
import { Group, IOS_FONT, MenuSelect, PrimaryButton } from './ui/ios'

type Item = { key: number; productoId: string; cantidad: string; precio: string }

// Columnas del carrito: producto | cant. | precio | total | quitar
const ITEM_GRID = 'grid grid-cols-[minmax(0,1fr)_40px_84px_84px_12px] items-center gap-2'

// Campo chico del carrito: sin caja, con línea al enfocar
const CART_INPUT_CLS =
  'ios-bare w-full border-b border-transparent bg-transparent text-right text-[12px] text-[#1C1C1E] outline-none focus:border-[var(--reg-accent,#4F8A6B)] dark:text-white tabular-nums'

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
      className="w-full border-b border-transparent text-right text-[12px] text-[#8E8E93] transition-colors hover:border-black/10 dark:hover:border-white/15">
      {money ? fmt(num(value)) : num(value).toLocaleString('es-AR')}
    </button>
  )
}

export default function ProductOperationForm({ tipo, accounts, contacts, empleados, productos, date, onDone, onContactCreated, footerSlot }: {
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
  /** Ya no se usa: el carrito va dentro de la pestaña (se deja para no romper a quien lo pasa) */
  cartSlot?: HTMLElement | null
  /** Lugar debajo de la pestaña para la tarjeta del botón */
  footerSlot?: HTMLElement | null
}) {
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
  // Buscador integrado al carrito: escribir muestra los productos; tocar uno lo agrega
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
    // Entra al carrito (en la compra el precio se carga tocando el monto)
    setItems((prev) => [...prev, { key: nextKey(), productoId: producto.id, cantidad: '1', precio: '' }])
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

  // ── Descuento (plegado: solo se abre si se toca "+ descuento") ──
  const [descuentoModo, setDescuentoModo] = useState<'$' | '%'>('$')
  const [descuentoText, setDescuentoText] = useState('')
  const [conDescuento, setConDescuento] = useState(false)

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
  /** Tocar un producto: entra con cantidad 1 y su precio; si ya está, suma 1 */
  const agregarProducto = (id: string) => {
    const p = productoById.get(id)
    if (!p) return
    const existente = items.find((i) => i.productoId === id)
    if (esVenta && disponible(id) < 1) {
      setError(disponible(id) > 0 ? `Solo quedan ${disponible(id).toLocaleString('es-AR')} en stock` : `No queda stock de ${p.nombre}`)
      return
    }
    if (existente) {
      setItems((prev) => prev.map((i) => (i.key === existente.key ? { ...i, cantidad: String(round2(num(i.cantidad) + 1)) } : i)))
    } else {
      // Venta: precio de lista. Compra: último costo (CPP)
      const precio = esVenta ? p.precioVenta : p.precioCosto
      setItems((prev) => [...prev, { key: nextKey(), productoId: id, cantidad: '1', precio: precio > 0 ? String(round2(precio)) : '' }])
    }
    // El buscador sigue enfocado (la lista no le saca el foco), así se puede seguir agregando
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

  // Resultados del buscador (debajo de la última fila del carrito, sin estirar la pestaña)
  const listaResultados = searching && (
    <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-xl bg-[#fff] shadow-[0_12px_40px_rgba(0,0,0,0.16)] ring-1 ring-black/[0.06] dark:bg-[#2C2C2E] dark:ring-white/10">
      <div className="max-h-60 overflow-y-auto py-1">
        {resultados.length === 0 ? (
          <p className="px-3 py-2.5 text-[12px] text-[#8E8E93]">Sin coincidencias</p>
        ) : resultados.map((p) => {
          // Stock que queda descontando lo que ya está en el carrito
          const stock = disponible(p.id)
          const precio = esVenta ? p.precioVenta : p.precioCosto
          return (
            <button
              key={p.id} type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => agregarProducto(p.id)}
              disabled={esVenta && stock <= 0}
              className="flex w-full items-center gap-3 px-3 py-1.5 text-left transition-colors hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/[0.06]"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] text-[#1C1C1E] dark:text-white">{p.nombre}</span>
                <span className="block truncate text-[10px] text-[#AEAEB2]">{productoDetalle(p, stock)}</span>
              </span>
              {precio > 0 && <span className="shrink-0 text-[12px] tabular-nums text-[#8E8E93]">{fmt(precio)}</span>}
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[15px] leading-none text-[var(--reg-accent,#4F8A6B)]" aria-hidden>+</span>
            </button>
          )
        })}
      </div>

      {/* Compra: alta rápida de un producto que todavía no está en Inventario */}
      {!esVenta && (nuevo === null ? (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
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
            className="ios-bare w-full border-b border-black/[0.08] bg-transparent py-1 text-[13px] text-[#1C1C1E] outline-none placeholder:text-[#C7C7CC] focus:border-[var(--reg-accent,#4F8A6B)] dark:border-white/10 dark:text-white"
          />
          <div className="mt-1 flex gap-3">
            <input
              type="number" min="0" step="0.01" value={nuevo.precioVenta} onChange={(e) => setNuevo({ ...nuevo, precioVenta: e.target.value })}
              placeholder="Precio de venta"
              className="ios-bare w-1/2 border-b border-black/[0.08] bg-transparent py-1 text-[13px] text-[#1C1C1E] outline-none placeholder:text-[#C7C7CC] focus:border-[var(--reg-accent,#4F8A6B)] dark:border-white/10 dark:text-white"
            />
            <input
              value={nuevo.categoria} onChange={(e) => setNuevo({ ...nuevo, categoria: e.target.value })}
              placeholder="Categoría (opcional)" maxLength={80}
              className="ios-bare w-1/2 border-b border-black/[0.08] bg-transparent py-1 text-[13px] text-[#1C1C1E] outline-none placeholder:text-[#C7C7CC] focus:border-[var(--reg-accent,#4F8A6B)] dark:border-white/10 dark:text-white"
            />
          </div>
          <div className="mt-2 flex justify-end gap-4 text-[12px]">
            <button type="button" onClick={() => setNuevo(null)} className="text-[#8E8E93]">Cancelar</button>
            <button type="button" onClick={crearProducto} disabled={creando} className="font-medium text-[var(--reg-accent,#4F8A6B)] disabled:opacity-50">
              {creando ? 'Guardando…' : 'Crear'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )

  // ── Carrito: encabezado, ítems, buscador (última fila) y total ──
  const carrito = (
    <div className={`rounded-xl bg-[#fff] dark:bg-[#1C1C1E] ${IOS_FONT}`}>
      <div className={`${ITEM_GRID} px-3 pb-1 pt-2.5 text-[10px] text-[#AEAEB2]`}>
        <span>Producto</span>
        <span className="text-right">Cant.</span>
        <span className="text-right">Precio</span>
        <span className="text-right">Total</span>
        <span />
      </div>

      {items.map((i) => (
        <div key={i.key} className={`${ITEM_GRID} group min-h-[32px] border-t border-black/[0.05] px-3 py-1 text-[12px] text-[#1C1C1E] dark:border-white/[0.06] dark:text-white`}>
          <span className="truncate" title={productoById.get(i.productoId)?.nombre}>{productoById.get(i.productoId)?.nombre ?? '—'}</span>
          <CartNumber value={i.cantidad} onChange={(v) => updateItem(i.key, { cantidad: v })} label="Cantidad" />
          <CartNumber value={i.precio} onChange={(v) => updateItem(i.key, { precio: v })} label="Precio" money />
          <span className="text-right tabular-nums">{fmt(num(i.cantidad) * num(i.precio))}</span>
          <button
            type="button"
            onClick={() => setItems((prev) => prev.filter((x) => x.key !== i.key))}
            className="flex justify-end text-[#D1D1D6] opacity-0 transition hover:text-[#B8664F] group-hover:opacity-100 focus:opacity-100 dark:text-[#48484A]"
            aria-label="Quitar producto"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      ))}

      {/* Última fila: buscador sutil para agregar productos */}
      <div ref={pickerRef} className="relative border-t border-black/[0.05] dark:border-white/[0.06]">
        <div className="flex min-h-[34px] items-center gap-2 px-3">
          <svg className="h-3.5 w-3.5 shrink-0 text-[#C7C7CC] dark:text-[#636366]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" /></svg>
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSearching(true) }}
            onFocus={() => setSearching(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && resultados[0]) { e.preventDefault(); agregarProducto(resultados[0].id) }
              if (e.key === 'Escape') { e.stopPropagation(); cerrarBuscador(); e.currentTarget.blur() }
            }}
            placeholder={items.length === 0 ? 'Buscar producto para agregar' : 'Agregar otro producto'}
            aria-label="Buscar producto"
            className="ios-bare min-w-0 flex-1 bg-transparent text-[12px] text-[#1C1C1E] outline-none placeholder:text-[#C7C7CC] dark:text-white dark:placeholder:text-[#636366]"
          />
        </div>
        {listaResultados}
      </div>

      {/* Total del carrito (el descuento queda plegado) */}
      <div className="border-t border-black/[0.08] px-3 dark:border-white/[0.1]">
        {conDescuento && (
          <div className="flex min-h-[30px] items-center justify-between gap-3 text-[12px] text-[#8E8E93]">
            <span>Descuento</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setDescuentoModo((m) => (m === '$' ? '%' : '$'))}
                aria-label={`Descuento en ${descuentoModo === '$' ? 'pesos' : 'porcentaje'}, tocar para cambiar`}
                className="rounded px-1 transition-colors hover:text-[#1C1C1E] dark:hover:text-white"
              >
                {descuentoModo}
              </button>
              <input
                autoFocus type="number" min="0" step="0.01" value={descuentoText} placeholder="0"
                onChange={(e) => setDescuentoText(e.target.value)}
                className="ios-bare w-16 bg-transparent text-right text-[12px] text-[#1C1C1E] outline-none placeholder:text-[#C7C7CC] tabular-nums dark:text-white" aria-label="Descuento"
              />
              <button type="button" onClick={() => { setConDescuento(false); setDescuentoText('') }} aria-label="Quitar descuento" className="ml-1 text-[#C7C7CC] hover:text-[#8E8E93]">×</button>
            </div>
          </div>
        )}
        <div className="flex min-h-[44px] items-center justify-between gap-3">
          <span className="flex items-baseline gap-2">
            <span className="text-[14px] font-medium text-[#1C1C1E] dark:text-white">Total</span>
            {!conDescuento && items.length > 0 && (
              <button type="button" onClick={() => setConDescuento(true)} className="text-[10px] text-[#C7C7CC] transition-colors hover:text-[#8E8E93] dark:text-[#636366]">
                + descuento
              </button>
            )}
          </span>
          <span className="text-[17px] font-semibold tabular-nums text-[var(--reg-accent,#4F8A6B)]">{fmt(total)}</span>
        </div>
      </div>
    </div>
  )

  return (
    <div className="mt-5 flex flex-col">
      {error && (
        <div className="mb-3 flex items-center justify-between rounded-xl bg-[#FF3B30]/10 px-4 py-2.5 text-[13px] text-[#D70015] dark:text-[#FF6961]">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Cerrar aviso" className="ml-3 opacity-60">×</button>
        </div>
      )}

      {/* ── Carrito con buscador integrado ── */}
      {carrito}


      {/* ── Cliente / proveedor y empleado: filas finas ── */}
      <Group className="mt-3">
        <div className="flex min-h-[36px] items-center justify-between gap-3 px-3">
          <span className="text-[12px] text-[#8E8E93]">{esVenta ? 'Cliente' : 'Proveedor'}</span>
          <div className="min-w-0 max-w-[65%] [&_button]:text-[12px]">
            <ContactPicker
              type={esVenta ? 'CLIENT' : 'SUPPLIER'}
              contacts={contraparte}
              value={contactId}
              onChange={(id) => { setContactId(id); if (id) { setFaltaContacto(false); setError(null) } }}
              onCreated={(c) => { setContactosNuevos((prev) => [...prev, c]); onContactCreated?.(c) }}
              invalid={faltaContacto && !contactId}
            />
          </div>
        </div>
        <div className="flex min-h-[36px] items-center justify-between gap-3 px-3">
          <span className="text-[12px] text-[#8E8E93]">Empleado</span>
          <div className="[&>div>button]:text-[12px]">
          <MenuSelect
            label="Empleado"
            tone="strong" align="right" size="sm"
            value={empleadoId}
            options={[{ value: '', label: 'Ninguno' }, ...empleados.map((em) => ({ value: em.id, label: em.nombre }))]}
            onChange={setEmpleadoId}
          />
          </div>
        </div>
      </Group>

      {/* ── Pago ── */}
      <div className="mt-3">
        <PaymentSection pay={pay} />
      </div>

      <PrimaryButton onClick={handleSubmit} disabled={submitting} color={esVenta ? 'green' : 'red'} slot={footerSlot}>
        {submitting ? 'Guardando…' : `Registrar ${esVenta ? 'venta' : 'compra'}${items.length > 0 ? ` · ${fmt(total)}` : ''}`}
      </PrimaryButton>
    </div>
  )
}
