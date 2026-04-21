'use client'

import { useState, useTransition } from 'react'
import {
  getProductos, createProducto, updateProducto, deleteProducto, addMovimientoStock, getMovimientosStock,
} from '@/app/actions'

type Producto = {
  id: string; nombre: string; descripcion: string | null; categoria: string | null
  marca: string | null; unidad: string; metodoCosteo: string; enTransito: number
  precioVenta: number; precioCosto: number; stockActual: number
}

type Movimiento = {
  id: string
  fecha: Date | string
  tipo: 'ENTRADA' | 'SALIDA' | 'AJUSTE'
  cantidad: number
  motivo: string | null
}

function fmt(v: number | null | undefined) { return (v ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2 }) }
function fmtUnits(v: number | null | undefined) { return (v ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) }
function fmtDate(d: Date | string) { return new Date(d).toLocaleDateString('es-AR') }

const TIPO_COLORS = {
  ENTRADA: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900',
  SALIDA: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900',
  AJUSTE: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900',
} as const

function InputField({ label, name, type = 'text', step, defaultValue, required }: {
  label: string; name: string; type?: string; step?: string; defaultValue?: string | number; required?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">{label}</label>
      <input
        name={name} type={type} step={step} defaultValue={defaultValue} required={required}
        className="border border-[#E5E7EB] dark:border-white/10 bg-[#F9FAFB] dark:bg-[#1F1F1F] rounded-xl px-3 py-2 text-sm font-mono text-[#1F2937] dark:text-[#E8E8E8] focus:outline-none focus:border-brand-military transition"
      />
    </div>
  )
}

// ── Ícono inventario ──
function BoxIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  )
}

export default function StockClient({ initialProductos }: { initialProductos: Producto[] }) {
  const [productos, setProductos] = useState<Producto[]>(initialProductos)
  const [showForm, setShowForm] = useState(false)
  const [showCategoriasModal, setShowCategoriasModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedProductoId, setSelectedProductoId] = useState<string | null>(null)
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [showMovForm, setShowMovForm] = useState(false)
  const [showMovimientosModal, setShowMovimientosModal] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState('')
  const [movError, setMovError] = useState('')

  async function reload() {
    const data = await getProductos()
    setProductos(data as Producto[])
  }

  function handleCreateOrUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = editingId ? await updateProducto(editingId, fd) : await createProducto(fd)
      if (!res.success) { setFormError(res.error); return }
      setFormError(''); setShowForm(false); setEditingId(null); await reload()
    })
  }

  function handleDelete(id: string) {
    if (!confirm('¿Desactivar este producto?')) return
    startTransition(async () => { await deleteProducto(id); await reload() })
  }

  async function loadMovimientos(productId: string) {
    const data = await getMovimientosStock(productId)
    setMovimientos((data || []) as Movimiento[])
  }

  function handleSelectProducto(id: string) {
    if (selectedProductoId === id) {
      setSelectedProductoId(null)
      setShowMovForm(false)
      return
    }
    setSelectedProductoId(id)
    setShowMovForm(false)
    void loadMovimientos(id)
  }

  function handleOpenMovimientos(id: string) {
    setSelectedProductoId(id)
    setShowMovimientosModal(true)
    setShowMovForm(false)
    void loadMovimientos(id)
  }

  function handleAgregarMov(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!selectedProductoId) return
    const fd = new FormData(e.currentTarget)
    fd.set('productoId', selectedProductoId)
    startTransition(async () => {
      const res = await addMovimientoStock(fd)
      if (!res.success) { setMovError(res.error); return }
      setMovError('')
      setShowMovForm(false)
      await reload()
      await loadMovimientos(selectedProductoId)
    })
  }

  const filtrados = productos.filter(prod =>
    [prod.nombre, prod.marca || '', prod.categoria || ''].some(x => x.toLowerCase().includes(busqueda.toLowerCase())),
  )

  const resumenGeneral = productos.reduce((acc, producto) => {
    const valorCosto = producto.stockActual * producto.precioCosto
    const valorVenta = producto.stockActual * producto.precioVenta
    const gananciaPotencialProducto = producto.stockActual * (producto.precioVenta - producto.precioCosto)

    acc.unidades += producto.stockActual
    acc.valorCosto += valorCosto
    acc.valorVenta += valorVenta
    acc.gananciaPotencial += gananciaPotencialProducto

    return acc
  }, {
    unidades: 0,
    valorCosto: 0,
    valorVenta: 0,
    gananciaPotencial: 0,
  })

  const resumenCategoriasMap = productos.reduce((map, producto) => {
    const categoria = producto.categoria?.trim() || 'Sin categoría'
    const actual = map.get(categoria) || {
      categoria,
      productos: 0,
      unidades: 0,
      valorCosto: 0,
      valorVenta: 0,
      gananciaPotencial: 0,
    }

    actual.productos += 1
    actual.unidades += producto.stockActual ?? 0
    actual.valorCosto += (producto.stockActual ?? 0) * (producto.precioCosto ?? 0)
    actual.valorVenta += (producto.stockActual ?? 0) * (producto.precioVenta ?? 0)
    actual.gananciaPotencial += (producto.stockActual ?? 0) * ((producto.precioVenta ?? 0) - (producto.precioCosto ?? 0))

    map.set(categoria, actual)
    return map
  }, new Map<string, {
    categoria: string
    productos: number
    unidades: number
    valorCosto: number
    valorVenta: number
    gananciaPotencial: number
  }>())

  const resumenCategorias = Array.from(resumenCategoriasMap.values()).sort((a, b) => b.valorCosto - a.valorCosto)

  const totalUnidades = resumenGeneral.unidades
  const totalStockValue = resumenGeneral.valorCosto
  const valorVentaTotal = resumenGeneral.valorVenta
  const gananciaPotencial = resumenGeneral.gananciaPotencial
  const sinStock = productos.filter(p => p.stockActual <= 0).length
  const bajoStock = productos.filter(p => p.stockActual > 0 && p.stockActual < 5).length
  const editingProd = editingId ? productos.find(p => p.id === editingId) : null
  const selectedProducto = selectedProductoId ? productos.find(p => p.id === selectedProductoId) : null

  function handleExportar() {
    const rows = filtrados.map(prod => [
      prod.nombre,
      prod.marca || '',
      prod.categoria || '',
      fmtUnits(prod.stockActual),
      prod.unidad,
      fmt(prod.precioCosto),
      fmt(prod.precioVenta),
      fmt(prod.stockActual * prod.precioCosto),
    ])

    const csv = [
      ['Producto', 'Marca', 'Categoria', 'Stock', 'Unidad', 'Precio costo', 'Precio venta', 'Valor inventario'].join(','),
      ...rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'inventario.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="border border-[#E5E7EB] bg-white px-5 py-4 dark:border-white/10 dark:bg-[#141414]" style={{ boxShadow: '0px 2px 8px rgba(0,0,0,0.04)' }}>
          <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-1">Cantidad en stock</p>
          <p className="text-[28px] font-mono font-bold text-brand-military-dark dark:text-[#6EBC8A] num-tabular">{fmtUnits(totalUnidades)}</p>
          <p className="text-xs text-[#9CA3AF] mt-0.5">total de unidades disponibles</p>
        </div>
        <div className="border border-[#E5E7EB] bg-white px-5 py-4 dark:border-white/10 dark:bg-[#141414]" style={{ boxShadow: '0px 2px 8px rgba(0,0,0,0.04)' }}>
          <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-1">Stock valorizado costo</p>
          <p className="text-[28px] font-mono font-bold text-brand-military-dark dark:text-[#6EBC8A] num-tabular">${fmt(totalStockValue)}</p>
          <p className="text-xs text-[#9CA3AF] mt-0.5">cantidades por costo unitario</p>
        </div>
        <div className="border border-[#E5E7EB] bg-white px-5 py-4 dark:border-white/10 dark:bg-[#141414]" style={{ boxShadow: '0px 2px 8px rgba(0,0,0,0.04)' }}>
          <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-1">Stock valorizado venta</p>
          <p className="text-[28px] font-mono font-bold text-[#1F2937] dark:text-[#E8E8E8] num-tabular">${fmt(valorVentaTotal)}</p>
          <p className="text-xs text-[#9CA3AF] mt-0.5">cantidades por precio de venta</p>
        </div>
        <div className="border border-[#E5E7EB] bg-white px-5 py-4 dark:border-white/10 dark:bg-[#141414]" style={{ boxShadow: '0px 2px 8px rgba(0,0,0,0.04)' }}>
          <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-1">Ganancia potencial</p>
          <p className="text-[28px] font-mono font-bold text-brand-gold-dark dark:text-[#E0B36A] num-tabular">${fmt(gananciaPotencial)}</p>
          <p className="text-xs text-[#9CA3AF] mt-0.5">sobre stock actual</p>
        </div>
      </div>

      <div className="border border-[#E5E7EB] bg-white dark:border-white/10 dark:bg-[#141414] overflow-hidden" style={{ boxShadow: '0px 2px 8px rgba(0,0,0,0.05)' }}>
        <div className="border-b border-[#E5E7EB] bg-[#FCFDFC] px-5 py-4 dark:border-white/10 dark:bg-[#141414]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center bg-brand-military-light text-brand-military">
                <BoxIcon />
              </div>
              <div>
                <h2 className="text-base font-semibold text-[#1F2937] dark:text-[#E8E8E8]">Productos en inventario</h2>
                <p className="text-xs text-[#9CA3AF]">Gestioná y controlá tu stock</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowCategoriasModal(true)}
                className="flex items-center gap-1.5 border border-[#D1D5DB] px-3 py-2 text-xs font-semibold text-[#4B5563] transition hover:border-brand-military hover:text-brand-military dark:border-white/10 dark:text-[#D1D5DB]"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
                </svg>
                Subtotales por categoría
              </button>
              <button
                onClick={() => { setShowForm(true); setEditingId(null); setFormError('') }}
                className="flex items-center gap-1.5 bg-brand-military px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-brand-military-dark"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Nuevo producto
              </button>
              <button
                onClick={handleExportar}
                className="flex items-center gap-1.5 border border-[#D1D5DB] px-3 py-2 text-xs font-semibold text-[#4B5563] transition hover:border-brand-military hover:text-brand-military dark:border-white/10 dark:text-[#D1D5DB]"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l4-4m-4 4l-4-4M4 17v1a2 2 0 002 2h12a2 2 0 002-2v-1" />
                </svg>
                Exportar
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-xl">
              <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" />
              </svg>
              <input
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar producto, marca o categoría"
                className="w-full border border-[#E5E7EB] bg-[#F9FAFB] py-2 pl-10 pr-3 text-sm text-[#374151] placeholder:text-[#9CA3AF] focus:border-brand-military focus:outline-none dark:border-white/10 dark:bg-[#1F1F1F] dark:text-[#D1D5DB]"
              />
            </div>

            <div className="text-xs text-[#9CA3AF]">
              {selectedProducto
                ? `Producto seleccionado: ${selectedProducto.nombre}`
                : `${filtrados.length} producto${filtrados.length !== 1 ? 's' : ''} en pantalla`}
            </div>
          </div>

        </div>

        {filtrados.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center border border-[#E5E7EB] text-[#9CA3AF] dark:border-white/10">
              <BoxIcon />
            </div>
            <p className="text-sm text-[#9CA3AF]">Sin productos{busqueda ? ' para esa búsqueda' : ''}</p>
            <p className="mt-1 text-xs text-[#C1C7D0] dark:text-[#666]">Usá Nuevo producto para cargar inventario.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1280px] text-xs">
              <thead>
                <tr className="border-y border-[#E5E7EB] bg-[#244C3A] text-[10px] font-semibold uppercase tracking-wider text-white dark:border-white/10 dark:bg-[#1D3A2F]">
                  <th className="px-4 py-3 text-left">Producto</th>
                  <th className="px-4 py-3 text-left">Marca</th>
                  <th className="px-4 py-3 text-left">Categoría</th>
                  <th className="px-4 py-3 text-center">Stock</th>
                  <th className="px-4 py-3 text-right">Precio costo</th>
                  <th className="px-4 py-3 text-right">Precio venta</th>
                  <th className="px-4 py-3 text-right">Ganancia unitaria</th>
                  <th className="px-4 py-3 text-right">Valor a costo</th>
                  <th className="px-4 py-3 text-right">Valor a venta</th>
                  <th className="px-4 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(prod => {
                  const isLow = prod.stockActual > 0 && prod.stockActual < 5
                  const isOut = prod.stockActual <= 0
                  return (
                    <tr
                      key={prod.id}
                      onClick={() => handleSelectProducto(prod.id)}
                      className="border-b border-[#E5E7EB] transition-colors hover:bg-[#F8FAFC] dark:border-white/5 dark:hover:bg-white/5"
                    >
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-[#1F2937] dark:text-[#E8E8E8]">{prod.nombre}</div>
                        {prod.descripcion && <div className="mt-0.5 text-[10px] text-[#9CA3AF] truncate max-w-[220px]">{prod.descripcion}</div>}
                      </td>
                      <td className="px-4 py-3.5 text-[#6B7280] dark:text-[#C9CDD3]">{prod.marca || '—'}</td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex border border-[#E5E7EB] bg-[#F9FAFB] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#6B7280] dark:border-white/10 dark:bg-white/5 dark:text-[#D1D5DB]">
                          {prod.categoria || 'Sin categoría'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <div className={`font-mono font-bold num-tabular ${isOut ? 'text-red-500' : isLow ? 'text-amber-600 dark:text-amber-400' : 'text-[#1F2937] dark:text-[#E8E8E8]'}`}>
                          {fmtUnits(prod.stockActual)}
                        </div>
                        <div className="mt-0.5 text-[10px] text-[#9CA3AF]">{prod.unidad}</div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-[#6B7280] dark:text-[#C9CDD3] num-tabular">${fmt(prod.precioCosto)}</td>
                      <td className="px-4 py-3.5 text-right font-mono font-semibold text-[#1F2937] dark:text-[#E8E8E8] num-tabular">${fmt(prod.precioVenta)}</td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-brand-gold-dark dark:text-[#E0B36A] num-tabular">${fmt(prod.precioVenta - prod.precioCosto)}</td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-brand-military-dark dark:text-[#6EBC8A] num-tabular">${fmt(prod.stockActual * prod.precioCosto)}</td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-[#1F2937] dark:text-[#E8E8E8] num-tabular">${fmt(prod.stockActual * prod.precioVenta)}</td>
                      <td className="px-4 py-3.5 text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenMovimientos(prod.id)}
                            className="border border-[#E5E7EB] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-brand-military transition hover:border-brand-military hover:bg-brand-military hover:text-white dark:border-white/10"
                          >Movs.</button>
                          <button
                            onClick={() => { setEditingId(prod.id); setShowForm(true); setFormError('') }}
                            className="border border-[#E5E7EB] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#6B7280] transition hover:border-brand-military hover:text-brand-military dark:border-white/10 dark:text-[#D1D5DB]"
                          >Editar</button>
                          <button
                            onClick={() => handleDelete(prod.id)}
                            className="border border-[#E5E7EB] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF] transition hover:border-red-300 hover:text-red-500 dark:border-white/10"
                          >Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-[#E5E7EB] bg-[#FCFCFB] px-5 py-3 text-xs text-[#9CA3AF] dark:border-white/10 dark:bg-[#101010]">
          <span>Mostrando {filtrados.length} producto{filtrados.length !== 1 ? 's' : ''}</span>
          <span>{sinStock} sin stock · {bajoStock} con stock bajo</span>
        </div>
      </div>

      {/* ── Modal crear/editar producto ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#141414] rounded-2xl shadow-2xl w-full max-w-lg border border-[#E5E7EB] dark:border-white/10">
            <div className="px-5 pt-5 pb-4 bg-gradient-to-b from-brand-military to-brand-military-dark rounded-t-2xl flex justify-between items-center">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
                {editingId ? 'Editar Producto' : 'Nuevo Producto'}
              </h3>
              <button onClick={() => { setShowForm(false); setEditingId(null) }} className="text-white/60 hover:text-white text-lg leading-none">✕</button>
            </div>
            <form onSubmit={handleCreateOrUpdate} className="p-5 grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <InputField label="Nombre del Producto *" name="nombre" required defaultValue={editingProd?.nombre} />
              </div>
              <InputField label="Marca" name="marca" defaultValue={editingProd?.marca || ''} />
              <InputField label="Categoría" name="categoria" defaultValue={editingProd?.categoria || ''} />
              <InputField label="Unidad de Medida" name="unidad" defaultValue={editingProd?.unidad || 'unidad'} />
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">Método de Costeo</label>
                <select
                  name="metodoCosteo"
                  defaultValue={editingProd?.metodoCosteo || 'PROMEDIO'}
                  className="border border-[#E5E7EB] dark:border-white/10 bg-[#F9FAFB] dark:bg-[#1F1F1F] rounded-xl px-3 py-2 text-sm text-[#1F2937] dark:text-[#E8E8E8] focus:outline-none focus:border-brand-military transition"
                >
                  <option value="PROMEDIO">Promedio Ponderado</option>
                  <option value="FIFO">FIFO</option>
                  <option value="LIFO">LIFO</option>
                </select>
              </div>
              <InputField label="Precio de Costo" name="precioCosto" type="number" step="0.01" defaultValue={editingProd?.precioCosto ?? 0} />
              <InputField label="Precio de Venta" name="precioVenta" type="number" step="0.01" defaultValue={editingProd?.precioVenta ?? 0} />
              <InputField label="Stock Inicial" name="stockActual" type="number" step="0.01" defaultValue={editingProd?.stockActual ?? 0} />
              <InputField label="En Tránsito" name="enTransito" type="number" step="0.01" defaultValue={editingProd?.enTransito ?? 0} />
              <div className="col-span-2">
                <InputField label="Descripción" name="descripcion" defaultValue={editingProd?.descripcion || ''} />
              </div>
              {formError && <div className="col-span-2 text-xs text-red-600 font-semibold bg-red-50 dark:bg-red-950/30 px-3 py-2 border border-red-200 dark:border-red-900 rounded-xl">{formError}</div>}
              <div className="col-span-2 flex gap-3 justify-end pt-2 border-t border-[#E5E7EB] dark:border-white/10">
                <button type="button" onClick={() => { setShowForm(false); setEditingId(null) }} className="text-xs font-semibold uppercase tracking-wide px-4 py-2.5 border border-[#E5E7EB] dark:border-white/10 text-[#6B7280] dark:text-gray-400 hover:border-gray-400 rounded-xl">Cancelar</button>
                <button type="submit" disabled={isPending} className="text-xs font-bold uppercase tracking-wide px-4 py-2.5 bg-brand-military text-white rounded-xl hover:bg-brand-military-dark transition disabled:opacity-50">
                  {editingId ? 'Guardar Cambios' : 'Crear Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCategoriasModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-5xl overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-2xl dark:border-white/10 dark:bg-[#141414]">
            <div className="flex items-center justify-between bg-gradient-to-b from-brand-military to-brand-military-dark px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-white">Subtotales por categoría</h3>
                <p className="mt-1 text-xs text-white/70">Cantidad, valorización y ganancia agrupadas por categoría.</p>
              </div>
              <button
                onClick={() => setShowCategoriasModal(false)}
                className="text-lg leading-none text-white/60 hover:text-white"
              >✕</button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto">
              {resumenCategorias.length === 0 ? (
                <div className="px-5 py-10 text-sm text-[#9CA3AF]">Todavía no hay productos cargados.</div>
              ) : (
                <div className="divide-y divide-[#E5E7EB] dark:divide-white/10">
                  {resumenCategorias.map(categoria => (
                    <div key={categoria.categoria} className="grid gap-3 px-5 py-4 md:grid-cols-[1.15fr_repeat(4,minmax(0,1fr))]">
                      <div>
                        <p className="text-sm font-semibold text-[#1F2937] dark:text-[#E8E8E8]">{categoria.categoria}</p>
                        <p className="mt-1 text-[11px] uppercase tracking-wide text-[#9CA3AF]">{categoria.productos} producto{categoria.productos !== 1 ? 's' : ''}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-[#9CA3AF]">Unidades</p>
                        <p className="mt-1 font-mono text-sm font-bold text-[#1F2937] dark:text-[#E8E8E8]">{fmtUnits(categoria.unidades)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-[#9CA3AF]">Valor costo</p>
                        <p className="mt-1 font-mono text-sm font-bold text-brand-military-dark dark:text-[#6EBC8A]">${fmt(categoria.valorCosto)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-[#9CA3AF]">Valor venta</p>
                        <p className="mt-1 font-mono text-sm font-bold text-[#1F2937] dark:text-[#E8E8E8]">${fmt(categoria.valorVenta)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-[#9CA3AF]">Ganancia</p>
                        <p className="mt-1 font-mono text-sm font-bold text-brand-gold-dark dark:text-[#E0B36A]">${fmt(categoria.gananciaPotencial)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showMovimientosModal && selectedProducto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-2xl dark:border-white/10 dark:bg-[#141414]">
            <div className="flex items-center justify-between bg-gradient-to-b from-brand-military to-brand-military-dark px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-white">Movimientos de stock</h3>
                <p className="mt-1 text-xs text-white/70">{selectedProducto.nombre}</p>
              </div>
              <button
                onClick={() => { setShowMovimientosModal(false); setShowMovForm(false); setMovError('') }}
                className="text-lg leading-none text-white/60 hover:text-white"
              >✕</button>
            </div>

            <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="border-b border-[#E5E7EB] p-5 dark:border-white/10 lg:border-b-0 lg:border-r">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">Historial</p>
                    <p className="mt-1 text-sm text-[#4B5563] dark:text-[#C9CDD3]">Entradas, salidas y ajustes registrados para este producto.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setShowMovForm(value => !value); setMovError('') }}
                    className="border border-[#D1D5DB] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#57534E] transition hover:border-brand-military hover:text-brand-military dark:border-white/10 dark:text-[#D1D5DB]"
                  >
                    {showMovForm ? 'Ocultar formulario' : 'Registrar movimiento'}
                  </button>
                </div>

                <div className="space-y-2">
                  {movimientos.length === 0 ? (
                    <div className="border border-dashed border-[#D1D5DB] px-4 py-8 text-center text-sm text-[#9CA3AF] dark:border-white/10">
                      Sin movimientos registrados para este producto.
                    </div>
                  ) : (
                    movimientos.map(mov => (
                      <div
                        key={mov.id}
                        className="flex items-start justify-between gap-3 border border-[#E5E7EB] bg-[#FCFCFB] px-4 py-3 dark:border-white/10 dark:bg-[#101010]"
                      >
                        <div className="space-y-1">
                          <div className={`inline-flex border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${TIPO_COLORS[mov.tipo]}`}>
                            {mov.tipo}
                          </div>
                          <p className="text-sm font-medium text-[#1F2937] dark:text-[#E8E8E8]">{mov.motivo || 'Sin detalle cargado'}</p>
                          <p className="text-[11px] text-[#9CA3AF]">{fmtDate(mov.fecha)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-sm font-bold text-[#1F2937] dark:text-[#E8E8E8] num-tabular">{fmtUnits(mov.cantidad)}</p>
                          <p className="text-[11px] text-[#9CA3AF]">unidades</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="p-5">
                <div className="mb-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">Resumen del producto</p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="border border-[#E5E7EB] bg-[#FCFCFB] px-3 py-3 dark:border-white/10 dark:bg-[#101010]">
                      <p className="text-[11px] uppercase tracking-wide text-[#9CA3AF]">Stock actual</p>
                      <p className="mt-1 font-mono text-lg font-bold text-[#1F2937] dark:text-[#E8E8E8]">{fmtUnits(selectedProducto.stockActual)}</p>
                    </div>
                    <div className="border border-[#E5E7EB] bg-[#FCFCFB] px-3 py-3 dark:border-white/10 dark:bg-[#101010]">
                      <p className="text-[11px] uppercase tracking-wide text-[#9CA3AF]">En tránsito</p>
                      <p className="mt-1 font-mono text-lg font-bold text-brand-military-dark dark:text-[#6EBC8A]">{fmtUnits(selectedProducto.enTransito)}</p>
                    </div>
                  </div>
                </div>

                {showMovForm ? (
                  <form onSubmit={handleAgregarMov} className="space-y-3 border border-[#E5E7EB] bg-[#FCFCFB] p-4 dark:border-white/10 dark:bg-[#101010]">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">Tipo</label>
                      <select
                        name="tipo"
                        defaultValue="ENTRADA"
                        className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 text-sm text-[#1F2937] focus:border-brand-military focus:outline-none dark:border-white/10 dark:bg-[#1F1F1F] dark:text-[#E8E8E8]"
                      >
                        <option value="ENTRADA">Entrada</option>
                        <option value="SALIDA">Salida</option>
                        <option value="AJUSTE">Ajuste</option>
                      </select>
                    </div>
                    <InputField label="Cantidad" name="cantidad" type="number" step="0.01" required defaultValue={1} />
                    <InputField label="Motivo" name="motivo" defaultValue="" />
                    {movError && (
                      <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 dark:border-red-900 dark:bg-red-950/30">
                        {movError}
                      </div>
                    )}
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => { setShowMovForm(false); setMovError('') }}
                        className="rounded-xl border border-[#E5E7EB] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[#6B7280] hover:border-gray-400 dark:border-white/10 dark:text-gray-400"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={isPending}
                        className="rounded-xl bg-brand-military px-4 py-2 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-brand-military-dark disabled:opacity-50"
                      >
                        Guardar movimiento
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="border border-dashed border-[#D1D5DB] px-4 py-10 text-center text-sm text-[#9CA3AF] dark:border-white/10">
                    Usá Registrar movimiento para cargar una entrada, salida o ajuste.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
