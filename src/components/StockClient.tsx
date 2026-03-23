'use client'

import { useState, useTransition } from 'react'
import {
  getProductos, createProducto, updateProducto, deleteProducto,
  addMovimientoStock, getMovimientosStock,
} from '@/app/actions'

type Movimiento = {
  id: string; tipo: string; cantidad: number; precio: number; motivo: string | null; fecha: Date | string
}
type Producto = {
  id: string; nombre: string; descripcion: string | null; categoria: string | null
  marca: string | null; unidad: string; metodoCosteo: string; enTransito: number
  precioVenta: number; precioCosto: number; stockActual: number
  movimientos: Movimiento[]
}

const TIPO_COLORS: Record<string, string> = {
  ENTRADA: 'bg-brand-military-light text-brand-military-dark border-brand-military/20',
  SALIDA:  'bg-brand-gold-light text-brand-gold-dark border-brand-gold/30',
  AJUSTE:  'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-white/10',
}

function fmt(v: number) { return v.toLocaleString('es-AR', { minimumFractionDigits: 2 }) }
function fmtDate(d: Date | string) { return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) }

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

function SparkleIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09ZM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456Z" />
    </svg>
  )
}

export default function StockClient({ initialProductos }: { initialProductos: Producto[] }) {
  const [productos, setProductos] = useState<Producto[]>(initialProductos)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedProductoId, setSelectedProductoId] = useState<string | null>(null)
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [showMovForm, setShowMovForm] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState('')
  const [movError, setMovError] = useState('')

  async function reload() {
    const data = await getProductos()
    setProductos(data as Producto[])
  }

  async function loadMovimientos(id: string) {
    const data = await getMovimientosStock(id)
    setMovimientos(data as Movimiento[])
  }

  function handleSelectProducto(id: string) {
    if (selectedProductoId === id) { setSelectedProductoId(null); setMovimientos([]) }
    else { setSelectedProductoId(id); loadMovimientos(id) }
    setShowMovForm(false)
  }

  function handleAgregarMov(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('productoId', selectedProductoId!)
    startTransition(async () => {
      const res = await addMovimientoStock(fd)
      if (!res.success) { setMovError(res.error); return }
      setMovError(''); setShowMovForm(false)
      await reload(); await loadMovimientos(selectedProductoId!)
    })
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

  const filtrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.categoria || '').toLowerCase().includes(busqueda.toLowerCase())
  )

  const selectedProd = productos.find(p => p.id === selectedProductoId)
  const totalStockValue = productos.reduce((sum, p) => sum + p.stockActual * p.precioCosto, 0)
  const sinStock = productos.filter(p => p.stockActual <= 0).length
  const bajoStock = productos.filter(p => p.stockActual > 0 && p.stockActual < 5).length
  const editingProd = editingId ? productos.find(p => p.id === editingId) : null

  // Consejo IA
  const aiTip = sinStock > 0
    ? `Tenés ${sinStock} producto${sinStock !== 1 ? 's' : ''} sin stock. Planificá la reposición para evitar rupturas de inventario.`
    : bajoStock > 0
      ? `${bajoStock} producto${bajoStock !== 1 ? 's' : ''} con stock bajo (menos de 5 unidades). Revisá los pedidos pendientes.`
      : `Tu inventario está en buen estado. Valor total en stock: $${fmt(totalStockValue)}.`

  return (
    <div className="space-y-6">

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-[#E5E7EB] dark:border-white/10 p-4" style={{ boxShadow: '0px 2px 8px rgba(0,0,0,0.04)' }}>
          <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-1">Productos Activos</p>
          <p className="text-xl font-mono font-bold text-brand-military-dark dark:text-[#6EBC8A] num-tabular">{productos.length}</p>
          <p className="text-xs text-[#9CA3AF] mt-0.5">en inventario</p>
        </div>
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-[#E5E7EB] dark:border-white/10 p-4" style={{ boxShadow: '0px 2px 8px rgba(0,0,0,0.04)' }}>
          <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-1">Valor en Stock</p>
          <p className="text-xl font-mono font-bold text-brand-gold-dark dark:text-[#C5A065] num-tabular">${fmt(totalStockValue)}</p>
          <p className="text-xs text-[#9CA3AF] mt-0.5">a precio de costo</p>
        </div>
        <div className={`rounded-2xl border p-4 ${bajoStock > 0 ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900' : 'bg-white dark:bg-[#141414] border-[#E5E7EB] dark:border-white/10'}`} style={{ boxShadow: '0px 2px 8px rgba(0,0,0,0.04)' }}>
          <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${bajoStock > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-[#9CA3AF]'}`}>Stock Bajo</p>
          <p className={`text-xl font-mono font-bold num-tabular ${bajoStock > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-[#9CA3AF]'}`}>{bajoStock}</p>
          <p className={`text-xs mt-0.5 ${bajoStock > 0 ? 'text-amber-500' : 'text-[#9CA3AF]'}`}>Menos de 5 u.</p>
        </div>
        <div className={`rounded-2xl border p-4 ${sinStock > 0 ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900' : 'bg-white dark:bg-[#141414] border-[#E5E7EB] dark:border-white/10'}`} style={{ boxShadow: '0px 2px 8px rgba(0,0,0,0.04)' }}>
          <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${sinStock > 0 ? 'text-red-500' : 'text-[#9CA3AF]'}`}>Sin Stock</p>
          <p className={`text-xl font-mono font-bold num-tabular ${sinStock > 0 ? 'text-red-600 dark:text-red-400' : 'text-[#9CA3AF]'}`}>{sinStock}</p>
          <p className={`text-xs mt-0.5 ${sinStock > 0 ? 'text-red-400' : 'text-[#9CA3AF]'}`}>{sinStock > 0 ? 'Requieren reposición' : 'Todo abastecido'}</p>
        </div>
      </div>

      {/* Layout: lista + panel lateral */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* ── Columna izquierda: lista de productos ── */}
        <div className="xl:col-span-2 flex flex-col gap-5">

          {/* Card tabla de productos */}
          <div className="bg-white dark:bg-[#141414] rounded-2xl border border-[#E5E7EB] dark:border-white/10 overflow-hidden" style={{ boxShadow: '0px 2px 8px rgba(0,0,0,0.05)' }}>

            {/* Header */}
            <div className="px-5 pt-5 pb-4 bg-gradient-to-b from-[#FAFBFC] to-white dark:from-[#141414] dark:to-[#141414] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-brand-military-light flex items-center justify-center text-brand-military">
                  <BoxIcon />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-[#1F2937] dark:text-[#E8E8E8]">Inventario</h2>
                  <p className="text-xs text-[#9CA3AF]">{productos.length} productos activos</p>
                </div>
              </div>
              <button
                onClick={() => { setShowForm(true); setEditingId(null); setFormError('') }}
                className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide px-3.5 py-2 bg-brand-military text-white rounded-xl hover:bg-brand-military-dark transition"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                Nuevo
              </button>
            </div>

            {/* Búsqueda */}
            <div className="px-5 pb-3">
              <input
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar producto o categoría…"
                className="w-full border border-[#E5E7EB] dark:border-white/10 bg-[#F9FAFB] dark:bg-[#1F1F1F] rounded-xl px-3.5 py-2 text-sm text-[#374151] dark:text-[#D1D5DB] placeholder:text-[#9CA3AF] focus:outline-none focus:border-brand-military transition"
              />
            </div>

            {/* Tabla */}
            {filtrados.length === 0 ? (
              <div className="py-12 text-center px-4">
                <BoxIcon />
                <p className="text-sm text-[#9CA3AF] mt-3">Sin productos{busqueda ? ' para esa búsqueda' : ''}</p>
                <p className="text-xs text-[#D1D5DB] dark:text-[#555] mt-1">Usá el botón "Nuevo" para agregar tu inventario</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#F9FAFB] dark:bg-[#0D0D0D] border-y border-[#E5E7EB] dark:border-white/10 text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
                      <th className="px-4 py-3 text-left">Producto</th>
                      <th className="px-4 py-3 text-center">Stock</th>
                      <th className="px-4 py-3 text-right">P. Costo</th>
                      <th className="px-4 py-3 text-right">P. Venta</th>
                      <th className="px-4 py-3 text-right">Valor</th>
                      <th className="px-4 py-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtrados.map(prod => {
                      const isSelected = selectedProductoId === prod.id
                      const isLow = prod.stockActual > 0 && prod.stockActual < 5
                      const isOut = prod.stockActual <= 0
                      return (
                        <tr
                          key={prod.id}
                          onClick={() => handleSelectProducto(prod.id)}
                          className={`border-b border-[#E5E7EB] dark:border-white/5 cursor-pointer transition-all duration-150
                            ${isSelected ? 'bg-brand-military-light dark:bg-brand-military/10' : 'hover:bg-[#F3F4F6] dark:hover:bg-white/5'}
                            ${isOut ? 'opacity-60' : ''}`}
                        >
                          <td className="px-4 py-3">
                            <div className="font-semibold text-[#1F2937] dark:text-[#E8E8E8]">{prod.nombre}</div>
                            {prod.marca && <div className="text-[10px] text-brand-gold-dark font-semibold uppercase tracking-wide mt-0.5">{prod.marca}</div>}
                            {prod.categoria && <div className="text-[10px] text-[#9CA3AF] uppercase tracking-wide mt-0.5">{prod.categoria}</div>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`font-bold font-mono num-tabular ${isOut ? 'text-red-500' : isLow ? 'text-amber-600 dark:text-amber-400' : 'text-[#1F2937] dark:text-[#E8E8E8]'}`}>
                              {fmt(prod.stockActual)}
                            </span>
                            <span className="text-[10px] text-[#9CA3AF] ml-1">{prod.unidad}</span>
                            {isOut && <div className="text-[9px] text-red-500 font-semibold uppercase mt-0.5">Sin stock</div>}
                            {isLow && <div className="text-[9px] text-amber-500 font-semibold uppercase mt-0.5">Stock bajo</div>}
                            {prod.enTransito > 0 && <div className="text-[9px] text-blue-500 font-semibold uppercase mt-0.5">+{fmt(prod.enTransito)} en tránsito</div>}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-[#9CA3AF] num-tabular">${fmt(prod.precioCosto)}</td>
                          <td className="px-4 py-3 text-right font-mono font-semibold text-[#1F2937] dark:text-[#E8E8E8] num-tabular">${fmt(prod.precioVenta)}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-brand-military-dark dark:text-[#6EBC8A] num-tabular">${fmt(prod.stockActual * prod.precioCosto)}</td>
                          <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-center gap-1">
                              <button
                                onClick={() => { setEditingId(prod.id); setShowForm(true); setFormError('') }}
                                className="text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-lg border border-[#E5E7EB] dark:border-white/10 text-[#6B7280] dark:text-gray-400 hover:border-brand-military hover:text-brand-military transition"
                              >Editar</button>
                              <button
                                onClick={() => handleDelete(prod.id)}
                                className="text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-lg border border-[#E5E7EB] dark:border-white/10 text-[#9CA3AF] hover:border-red-300 hover:text-red-500 transition"
                              >✕</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer resumen */}
            {filtrados.length > 0 && (
              <div className="mx-4 mb-4 mt-1 rounded-xl px-4 py-3.5 bg-[#F9FAFB] dark:bg-[#0D0D0D]">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#374151] dark:text-[#D1D5DB]">Valor total en stock</span>
                  <span className="text-sm font-mono font-bold text-brand-military-dark dark:text-[#6EBC8A] num-tabular">${fmt(totalStockValue)}</span>
                </div>
                <p className="text-xs text-[#9CA3AF] mt-0.5">{productos.length} productos · {sinStock} sin stock · {bajoStock} con stock bajo</p>
              </div>
            )}
          </div>

          {/* Consejo IA */}
          <div>
            <div className="flex items-center gap-2 mb-2.5 px-1">
              <div className="w-6 h-6 rounded-lg bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-600">
                <SparkleIcon />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">Consejo IA</span>
            </div>
            <div className="bg-white dark:bg-[#141414] rounded-xl border border-[#E5E7EB] dark:border-white/10 px-4 py-3.5" style={{ boxShadow: '0px 1px 4px rgba(0,0,0,0.04)' }}>
              <p className="text-sm text-[#4B5563] dark:text-[#B0B0B0] leading-relaxed">{aiTip}</p>
            </div>
          </div>
        </div>

        {/* ── Panel lateral: movimientos ── */}
        <div className="flex flex-col gap-5">
          <div className="bg-white dark:bg-[#141414] rounded-2xl border border-[#E5E7EB] dark:border-white/10 overflow-hidden flex flex-col" style={{ boxShadow: '0px 2px 8px rgba(0,0,0,0.05)' }}>

            {/* Header panel */}
            <div className="px-5 pt-5 pb-4 bg-gradient-to-b from-[#FAFBFC] to-white dark:from-[#141414] dark:to-[#141414]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-brand-military flex items-center justify-center text-white">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-semibold text-[#1F2937] dark:text-[#E8E8E8]">
                    {selectedProd ? selectedProd.nombre : 'Movimientos'}
                  </h2>
                  <p className="text-xs text-[#9CA3AF]">
                    {selectedProd ? 'historial de movimientos' : 'seleccioná un producto'}
                  </p>
                </div>
              </div>
            </div>

            {!selectedProd ? (
              <div className="py-12 text-center px-4 flex-1">
                <svg className="w-8 h-8 text-[#D1D5DB] dark:text-[#333] mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <p className="text-sm text-[#9CA3AF]">Hacé clic en un producto</p>
                <p className="text-xs text-[#D1D5DB] dark:text-[#555] mt-1">para ver sus movimientos</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col">
                {/* Info del producto */}
                <div className="mx-4 mb-3 mt-1 rounded-xl px-4 py-3 bg-[#F9FAFB] dark:bg-[#0D0D0D]">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF] mb-0.5">Stock</p>
                      <p className={`text-lg font-mono font-bold num-tabular ${selectedProd.stockActual <= 0 ? 'text-red-500' : selectedProd.stockActual < 5 ? 'text-amber-500' : 'text-brand-military-dark dark:text-[#6EBC8A]'}`}>
                        {fmt(selectedProd.stockActual)}
                      </p>
                    </div>
                    <div className="border-x border-[#E5E7EB] dark:border-white/10">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF] mb-0.5">Costo</p>
                      <p className="text-lg font-mono font-bold text-[#6B7280] dark:text-[#B0B0B0] num-tabular">${fmt(selectedProd.precioCosto)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF] mb-0.5">Venta</p>
                      <p className="text-lg font-mono font-bold text-[#1F2937] dark:text-[#E8E8E8] num-tabular">${fmt(selectedProd.precioVenta)}</p>
                    </div>
                  </div>
                </div>

                {/* Botón registrar movimiento */}
                <div className="px-4 pb-3">
                  <button
                    onClick={() => setShowMovForm(!showMovForm)}
                    className="w-full text-xs font-semibold uppercase tracking-wide py-2.5 border-2 border-dashed border-brand-military text-brand-military hover:bg-brand-military-light dark:hover:bg-brand-military/10 transition rounded-xl"
                  >
                    {showMovForm ? 'Cancelar' : '+ Registrar Movimiento'}
                  </button>
                </div>

                {/* Formulario de movimiento */}
                {showMovForm && (
                  <form onSubmit={handleAgregarMov} className="mx-4 mb-3 rounded-xl px-4 py-4 bg-brand-military-light/40 dark:bg-brand-military/10 border border-brand-military/20 dark:border-brand-military/30 flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">Tipo</label>
                      <select name="tipo" className="border border-[#E5E7EB] dark:border-white/10 bg-white dark:bg-[#1F1F1F] rounded-xl px-3 py-2 text-sm text-[#374151] dark:text-[#D1D5DB] focus:outline-none focus:border-brand-military transition">
                        <option value="ENTRADA">Entrada</option>
                        <option value="SALIDA">Salida</option>
                        <option value="AJUSTE">Ajuste de inventario</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <InputField label="Cantidad" name="cantidad" type="number" step="0.01" required />
                      <InputField label="Precio Unit." name="precio" type="number" step="0.01" defaultValue="0" />
                    </div>
                    <InputField label="Motivo" name="motivo" />
                    {movError && <div className="text-xs text-red-600 font-semibold bg-red-50 dark:bg-red-950/30 px-3 py-2 border border-red-200 dark:border-red-900 rounded-xl">{movError}</div>}
                    <button type="submit" disabled={isPending} className="text-xs font-bold uppercase tracking-wide py-2.5 bg-brand-military text-white rounded-xl hover:bg-brand-military-dark transition disabled:opacity-50">
                      Registrar
                    </button>
                  </form>
                )}

                {/* Lista movimientos */}
                <div className="px-4 pb-4 flex flex-col gap-1 max-h-80 overflow-y-auto">
                  {movimientos.length === 0 ? (
                    <div className="py-6 text-center text-sm text-[#9CA3AF]">Sin movimientos registrados</div>
                  ) : movimientos.map(m => (
                    <div key={m.id} className="flex items-center justify-between px-3.5 py-3 rounded-xl hover:bg-[#F3F4F6] dark:hover:bg-white/5 transition">
                      <div>
                        <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-lg border ${TIPO_COLORS[m.tipo] || ''}`}>
                          {m.tipo}
                        </span>
                        <p className="text-xs text-[#9CA3AF] mt-1">{m.motivo || '—'}</p>
                        <p className="text-[10px] text-[#D1D5DB] dark:text-[#555] mt-0.5">{fmtDate(m.fecha)}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold font-mono text-sm num-tabular ${m.tipo === 'ENTRADA' ? 'text-brand-military-dark dark:text-[#6EBC8A]' : m.tipo === 'SALIDA' ? 'text-brand-gold-dark dark:text-[#C5A065]' : 'text-[#6B7280] dark:text-gray-400'}`}>
                          {m.tipo === 'SALIDA' ? '−' : m.tipo === 'AJUSTE' ? '=' : '+'}{fmt(m.cantidad)}
                        </p>
                        {m.precio > 0 && <p className="text-[10px] text-[#9CA3AF] font-mono mt-0.5">${fmt(m.precio)}/u</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
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
    </div>
  )
}
