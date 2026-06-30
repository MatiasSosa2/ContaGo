'use client'

import { useState, useTransition } from 'react'
import {
  getProductos, createProducto, updateProducto, deleteProducto, addMovimientoStock, getMovimientosStock,
} from '@/app/actions'

type Producto = {
  id: string; nombre: string; descripcion: string | null; categoria: string | null
  marca: string | null; unidad: string; metodoCosteo: string; enTransito: number
  precioVenta: number; precioCosto: number; stockActual: number
  alertaStock?: number | null
  tipo?: 'MERCADERIA' | 'SERVICIO'
  stockInicialPeriodo?: number
  entradasPeriodo?: number
  salidasPeriodo?: number
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

const LABEL_CLS = 'text-[11px] font-semibold uppercase tracking-[0.12em] text-[#4B5563] dark:text-[#9CA3AF]'
const FIELD_CLS = 'h-9 rounded-md border border-[#D1D5DB] bg-white px-3 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-brand-military/25 focus:border-brand-military transition dark:border-white/15 dark:bg-[#161616] dark:text-[#E8E8E8] dark:placeholder:text-[#6B7280]'
const SELECT_CLS = FIELD_CLS
const TEXTAREA_CLS = 'rounded-md border border-[#D1D5DB] bg-white px-3 py-2 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-brand-military/25 focus:border-brand-military transition dark:border-white/15 dark:bg-[#161616] dark:text-[#E8E8E8] dark:placeholder:text-[#6B7280] resize-none'
const SECTION_HEADING_CLS = 'mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6B7280] dark:text-[#9CA3AF]'

const TIPO_COLORS = {
  ENTRADA: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900',
  SALIDA: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900',
  AJUSTE: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900',
} as const

function InputField({ label, name, type = 'text', step, defaultValue, required }: {
  label: string; name: string; type?: string; step?: string; defaultValue?: string | number; required?: boolean
}) {
  const isNumeric = type === 'number'
  return (
    <div className="flex flex-col gap-1">
      <label className={LABEL_CLS}>{label}</label>
      <input
        name={name} type={type} step={step} defaultValue={defaultValue} required={required}
        className={`${FIELD_CLS} ${isNumeric ? 'font-mono tabular-nums' : ''}`}
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

function ProductoFormBody({
  editingProd,
  editingId,
  categoriasExistentes,
  marcasPorCategoria,
  isPending,
  formError,
  onSubmit,
  onCancel,
}: {
  editingProd: Producto | null
  editingId: string | null
  categoriasExistentes: string[]
  marcasPorCategoria: Record<string, string[]>
  isPending: boolean
  formError: string
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  onCancel: () => void
}) {
  const initialCat = editingProd?.categoria?.trim() || ''
  const initialCatExists = !!initialCat && categoriasExistentes.includes(initialCat)
  const [catMode, setCatMode] = useState<'pick' | 'new'>(initialCat && !initialCatExists ? 'new' : 'pick')
  const [catPick, setCatPick] = useState(initialCatExists ? initialCat : '')
  const [catNew, setCatNew] = useState(initialCatExists ? '' : initialCat)
  const categoriaValue = (catMode === 'pick' ? catPick : catNew).trim()

  const initialMarca = editingProd?.marca?.trim() || ''
  const marcasDisponibles = categoriaValue ? (marcasPorCategoria[categoriaValue] || []) : []
  const initialMarcaExists = !!initialMarca && marcasDisponibles.includes(initialMarca)
  const [marcaMode, setMarcaMode] = useState<'pick' | 'new'>(initialMarca && !initialMarcaExists ? 'new' : 'pick')
  const [marcaPick, setMarcaPick] = useState(initialMarcaExists ? initialMarca : '')
  const [marcaNew, setMarcaNew] = useState(initialMarcaExists ? '' : initialMarca)
  const marcaValue = categoriaValue ? (marcaMode === 'pick' ? marcaPick : marcaNew).trim() : ''

  function handleCategoriaChange(value: string) {
    if (value === '__new__') {
      setCatMode('new')
    } else {
      setCatMode('pick')
      setCatPick(value)
    }
    // Reset marca cuando cambia la categoría
    setMarcaMode('pick')
    setMarcaPick('')
    setMarcaNew('')
  }

  return (
    <form onSubmit={onSubmit} className="bg-white dark:bg-[#0F0F0F]">
      <section className="px-5 py-4">
        <h4 className={SECTION_HEADING_CLS}>Datos generales</h4>
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-8">
            <InputField label="Nombre del producto *" name="nombre" required defaultValue={editingProd?.nombre} />
          </div>
          <div className="col-span-4 flex flex-col gap-1">
            <label className={LABEL_CLS}>Tipo</label>
            <select name="tipo" defaultValue={editingProd?.tipo || 'MERCADERIA'} className={SELECT_CLS}>
              <option value="MERCADERIA">Mercadería</option>
              <option value="SERVICIO">Servicio</option>
            </select>
          </div>

          <div className="col-span-4 flex flex-col gap-1">
            <label className={LABEL_CLS}>Categoría</label>
            <select
              value={catMode === 'pick' ? catPick : '__new__'}
              onChange={(e) => handleCategoriaChange(e.target.value)}
              className={SELECT_CLS}
            >
              <option value="">— Sin categoría —</option>
              {categoriasExistentes.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value="__new__">+ Nueva categoría…</option>
            </select>
            {catMode === 'new' && (
              <input
                type="text"
                value={catNew}
                onChange={(e) => setCatNew(e.target.value)}
                placeholder="Escribí la nueva categoría"
                className={FIELD_CLS}
              />
            )}
            <input type="hidden" name="categoria" value={categoriaValue} />
          </div>
          <div className="col-span-4 flex flex-col gap-1">
            <label className={LABEL_CLS}>Marca</label>
            {categoriaValue ? (
              <>
                <select
                  value={marcaMode === 'pick' ? marcaPick : '__new__'}
                  onChange={(e) => {
                    if (e.target.value === '__new__') {
                      setMarcaMode('new')
                    } else {
                      setMarcaMode('pick')
                      setMarcaPick(e.target.value)
                    }
                  }}
                  className={SELECT_CLS}
                >
                  <option value="">— Sin marca —</option>
                  {marcasDisponibles.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                  <option value="__new__">+ Nueva marca…</option>
                </select>
                {marcaMode === 'new' && (
                  <input
                    type="text"
                    value={marcaNew}
                    onChange={(e) => setMarcaNew(e.target.value)}
                    placeholder="Escribí la nueva marca"
                    className={FIELD_CLS}
                  />
                )}
              </>
            ) : (
              <div className={`${FIELD_CLS} flex items-center text-[#9CA3AF] dark:text-[#6B7280] italic`}>
                Elegí categoría
              </div>
            )}
            <input type="hidden" name="marca" value={marcaValue} />
          </div>
          <div className="col-span-4">
            <InputField label="Unidad" name="unidad" defaultValue={editingProd?.unidad || 'unidad'} />
          </div>
        </div>
      </section>

      <section className="border-t border-[#E5E7EB] px-5 py-4 dark:border-white/10">
        <h4 className={SECTION_HEADING_CLS}>Inventario y precios</h4>
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-4 flex flex-col gap-1">
            <label className={LABEL_CLS}>Método de costeo</label>
            <select name="metodoCosteo" defaultValue="PROMEDIO" className={SELECT_CLS}>
              <option value="PROMEDIO">Promedio Ponderado</option>
            </select>
          </div>
          <div className="col-span-3">
            <InputField label="Stock inicial" name="stockActual" type="number" step="0.01" defaultValue={editingProd?.stockActual ?? 0} />
          </div>
          <div className="col-span-3">
            <InputField label="Costo unitario" name="precioCosto" type="number" step="0.01" defaultValue={editingProd?.precioCosto ?? 0} />
          </div>
          <div className="col-span-3">
            <InputField label="Precio de Venta" name="precioVenta" type="number" step="0.01" defaultValue={editingProd?.precioVenta ?? 0} />
          </div>
          <div className="col-span-3 flex flex-col gap-1">
            <label className={`${LABEL_CLS} flex items-center gap-1.5`}>
              <span>Alerta de Bajo Stock</span>
              <span
                className="inline-flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full border border-amber-400 bg-amber-50 text-[9px] font-bold text-amber-700 dark:border-amber-500 dark:bg-amber-950/40 dark:text-amber-300"
                title="Cuando el stock de este producto baje hasta este valor, se mostrará una alerta avisando que está por agotarse. Dejalo vacío para desactivar la alerta."
                aria-label="Información sobre la alerta de bajo stock"
              >
                !
              </span>
            </label>
            <input
              name="alertaStock"
              type="number"
              step="0.01"
              min="0"
              placeholder="Sin alerta"
              defaultValue={editingProd?.alertaStock ?? ''}
              className={`${FIELD_CLS} font-mono tabular-nums`}
            />
          </div>
          <input type="hidden" name="enTransito" value={editingProd?.enTransito ?? 0} />
        </div>
      </section>

      <section className="border-t border-[#E5E7EB] px-5 py-4 dark:border-white/10">
        <div className="flex flex-col gap-1">
          <label className={LABEL_CLS}>Descripción</label>
          <textarea
            name="descripcion"
            rows={2}
            defaultValue={editingProd?.descripcion || ''}
            placeholder="Opcional"
            className={TEXTAREA_CLS}
          />
        </div>
      </section>

      {formError && (
        <div className="mx-5 mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {formError}
        </div>
      )}

      <div className="flex justify-end gap-3 border-t border-[#E5E7EB] bg-[#FAFAF9] px-5 py-3 dark:border-white/10 dark:bg-[#0B0B0B]">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-[#D1D5DB] px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#4B5563] transition hover:border-gray-400 hover:text-[#1F2937] dark:border-white/10 dark:text-gray-300 dark:hover:border-white/20 dark:hover:text-white"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-brand-military px-5 py-2 text-[11px] font-bold uppercase tracking-wide text-white transition hover:bg-brand-military-dark disabled:opacity-50"
        >
          {editingId ? 'Guardar cambios' : 'Crear producto'}
        </button>
      </div>
    </form>
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
  const [vistaInventario, setVistaInventario] = useState<'UNIDADES' | 'PESOS'>('PESOS')
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

  // Flujo de inventario del período (valorizado al costo)
  const flujoPeriodo = productos.reduce((acc, p) => {
    const costo = p.precioCosto ?? 0
    const inicial = p.stockInicialPeriodo ?? 0
    const entradas = p.entradasPeriodo ?? 0
    const salidas = p.salidasPeriodo ?? 0
    acc.inventarioInicial += inicial * costo
    acc.inventarioComprado += entradas * costo
    acc.inventarioVendido += salidas * costo
    acc.inicialUnidades += inicial
    acc.compradoUnidades += entradas
    acc.vendidoUnidades += salidas
    return acc
  }, { inventarioInicial: 0, inventarioComprado: 0, inventarioVendido: 0, inicialUnidades: 0, compradoUnidades: 0, vendidoUnidades: 0 })
  const inventarioInicial = flujoPeriodo.inventarioInicial
  const inventarioVendido = flujoPeriodo.inventarioVendido
  const inventarioComprado = flujoPeriodo.inventarioComprado
  const stockFinalPeriodo = inventarioInicial - inventarioVendido + inventarioComprado
  const inicialUnidades = flujoPeriodo.inicialUnidades
  const vendidoUnidades = flujoPeriodo.vendidoUnidades
  const compradoUnidades = flujoPeriodo.compradoUnidades
  const stockFinalUnidades = inicialUnidades - vendidoUnidades + compradoUnidades
  const enUnidades = vistaInventario === 'UNIDADES'
  const formatCard = (valor: number) => enUnidades ? `${fmtUnits(valor)} u` : `$${fmt(valor)}`
  const sobreVendiendo = inventarioVendido > inventarioComprado
  const sobreStockeando = inventarioComprado > inventarioVendido
  const sinStock = productos.filter(p => p.stockActual <= 0).length
  const bajoStock = productos.filter(p => {
    if (p.stockActual <= 0) return false
    const umbral = p.alertaStock ?? 5
    return p.stockActual <= umbral
  }).length
  const editingProd = editingId ? productos.find(p => p.id === editingId) : null
  const selectedProducto = selectedProductoId ? productos.find(p => p.id === selectedProductoId) : null
  const categoriasExistentes = Array.from(
    new Set(
      productos
        .map(p => p.categoria?.trim())
        .filter((c): c is string => !!c)
    )
  ).sort((a, b) => a.localeCompare(b, 'es'))
  const marcasPorCategoria = productos.reduce<Record<string, string[]>>((acc, p) => {
    const cat = p.categoria?.trim()
    const marca = p.marca?.trim()
    if (!cat || !marca) return acc
    if (!acc[cat]) acc[cat] = []
    if (!acc[cat].includes(marca)) acc[cat].push(marca)
    return acc
  }, {})
  Object.keys(marcasPorCategoria).forEach((k) => {
    marcasPorCategoria[k].sort((a, b) => a.localeCompare(b, 'es'))
  })

  function handleExportar() {
    const rows = filtrados.map(prod => [
      prod.nombre,
      prod.categoria || '',
      prod.marca || '',
      fmtUnits(prod.stockActual),
      prod.unidad,
      fmt(prod.precioCosto),
      fmt(prod.precioVenta),
      fmt(prod.stockActual * prod.precioCosto),
    ])

    const csv = [
      ['Producto', 'Categoria', 'Marca', 'Stock', 'Unidad', 'Precio costo', 'Precio venta', 'Valor inventario'].join(','),
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

  // ── Diagnóstico inteligente del inventario ──
  const diagnostico = (() => {
    const totalMovido = vendidoUnidades + compradoUnidades
    if (totalMovido === 0 && inicialUnidades === 0) {
      return { tono: 'neutral' as const, titulo: 'Sin actividad', mensaje: 'No hay movimientos ni stock en el período seleccionado.' }
    }
    if (stockFinalUnidades <= 0 && vendidoUnidades > 0) {
      return { tono: 'critico' as const, titulo: 'Stock agotado', mensaje: 'Vendiste todo el stock disponible. Reponé urgente para no perder ventas.' }
    }
    if (vendidoUnidades > 0 && compradoUnidades === 0 && stockFinalUnidades < inicialUnidades * 0.3) {
      return { tono: 'alerta' as const, titulo: 'Sobrevendido', mensaje: 'Tus ventas redujeron el stock más del 70% y no hubo reposición. Conviene comprar pronto.' }
    }
    if (vendidoUnidades > compradoUnidades * 1.8 && compradoUnidades > 0) {
      return { tono: 'alerta' as const, titulo: 'Rotación alta', mensaje: 'Vendiste casi el doble de lo que compraste. Aumentá las compras para sostener el ritmo.' }
    }
    if (compradoUnidades > vendidoUnidades * 2.5 && vendidoUnidades > 0) {
      return { tono: 'alerta' as const, titulo: 'Sobrecomprado', mensaje: 'Compraste mucho más de lo que vendiste. Revisá si hay capital inmovilizado innecesario.' }
    }
    if (vendidoUnidades === 0 && inicialUnidades > 0) {
      return { tono: 'alerta' as const, titulo: 'Sin ventas', mensaje: 'No hubo salidas en el período. Evaluá estrategia comercial o estacionalidad.' }
    }
    if (compradoUnidades > 0 && vendidoUnidades === 0) {
      return { tono: 'neutral' as const, titulo: 'Stock en reposición', mensaje: 'Compraste sin vender. Esperable si recién arrancás el período.' }
    }
    if (stockFinalUnidades > inicialUnidades * 2 && compradoUnidades > vendidoUnidades) {
      return { tono: 'alerta' as const, titulo: 'Stock excesivo', mensaje: 'Tu stock final duplica el inicial. Hay capital inmovilizado.' }
    }
    return { tono: 'ok' as const, titulo: 'Inventario equilibrado', mensaje: 'Compras y ventas mantienen un flujo saludable en el período.' }
  })()

  const diagnosticoStyles = {
    ok:       { border: 'border-[#E5E7EB] dark:border-white/10', bg: 'bg-white dark:bg-[#141414]', text: 'text-[#374151] dark:text-[#D1D5DB]', accent: 'text-[#16A34A] dark:text-[#6EE7B7]', dot: 'bg-[#22C55E]' },
    neutral:  { border: 'border-[#E5E7EB] dark:border-white/10', bg: 'bg-white dark:bg-[#141414]', text: 'text-[#374151] dark:text-[#D1D5DB]', accent: 'text-[#6B7280] dark:text-[#9CA3AF]', dot: 'bg-[#9CA3AF]' },
    alerta:   { border: 'border-[#E5E7EB] dark:border-white/10', bg: 'bg-white dark:bg-[#141414]', text: 'text-[#374151] dark:text-[#D1D5DB]', accent: 'text-[#B45309] dark:text-[#F59E0B]', dot: 'bg-[#F59E0B]' },
    critico:  { border: 'border-[#E5E7EB] dark:border-white/10', bg: 'bg-white dark:bg-[#141414]', text: 'text-[#374151] dark:text-[#D1D5DB]', accent: 'text-[#B91C1C] dark:text-[#FCA5A5]', dot: 'bg-[#EF4444]' },
  }[diagnostico.tono]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-stretch">
        <div className="inline-flex items-stretch border border-[#E5E7EB] bg-white dark:border-white/10 dark:bg-[#141414]" style={{ boxShadow: '0px 2px 8px rgba(0,0,0,0.04)' }}>
          <button
            type="button"
            role="tab"
            aria-selected={enUnidades}
            onClick={() => setVistaInventario('UNIDADES')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${enUnidades ? 'bg-brand-military text-white' : 'text-[#6B7280] hover:text-brand-military dark:text-[#9CA3AF] dark:hover:text-white'}`}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            Unidades
          </button>
          <div className="w-px bg-[#E5E7EB] dark:bg-white/10" aria-hidden />
          <button
            type="button"
            role="tab"
            aria-selected={!enUnidades}
            onClick={() => setVistaInventario('PESOS')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${!enUnidades ? 'bg-brand-military text-white' : 'text-[#6B7280] hover:text-brand-military dark:text-[#9CA3AF] dark:hover:text-white'}`}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Valorizado
          </button>
        </div>

        <div className={`flex items-center gap-2.5 border px-3.5 py-1.5 ${diagnosticoStyles.border} ${diagnosticoStyles.bg}`} style={{ boxShadow: '0px 2px 8px rgba(0,0,0,0.04)' }}>
          <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${diagnosticoStyles.dot}`} aria-hidden />
          <div className="min-w-0 flex-1 flex flex-wrap items-baseline gap-x-2">
            <p className={`text-[11px] font-semibold tracking-wide whitespace-nowrap ${diagnosticoStyles.accent}`}>{diagnostico.titulo}</p>
            <p className={`truncate text-xs ${diagnosticoStyles.text}`}>{diagnostico.mensaje}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="border border-[#E5E7EB] bg-white px-5 py-4 dark:border-white/10 dark:bg-[#141414]" style={{ boxShadow: '0px 2px 8px rgba(0,0,0,0.04)' }}>
          <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-1">Inventario inicial</p>
          <p className="text-[28px] font-mono font-bold text-black dark:text-white num-tabular">{formatCard(enUnidades ? inicialUnidades : inventarioInicial)}</p>
        </div>
        <div className={`border px-5 py-4 ${sobreVendiendo ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30' : 'border-[#E5E7EB] bg-white dark:border-white/10 dark:bg-[#141414]'}`} style={{ boxShadow: '0px 2px 8px rgba(0,0,0,0.04)' }}>
          <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${sobreVendiendo ? 'text-emerald-700' : 'text-[#9CA3AF]'}`}>Inventario vendido</p>
          {sobreVendiendo && <p className="mt-0.5 text-sm font-medium text-emerald-700 dark:text-emerald-300">Estás sobrevendiendo — vendiste más de lo que compraste.</p>}
          <p className={`text-[28px] font-mono font-bold num-tabular ${sobreVendiendo ? 'text-emerald-700 dark:text-emerald-300' : 'text-brand-military-dark dark:text-[#6EBC8A]'}`}>{formatCard(enUnidades ? vendidoUnidades : inventarioVendido)}</p>
        </div>
        <div className={`border px-5 py-4 ${sobreStockeando ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30' : 'border-[#E5E7EB] bg-white dark:border-white/10 dark:bg-[#141414]'}`} style={{ boxShadow: '0px 2px 8px rgba(0,0,0,0.04)' }}>
          <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${sobreStockeando ? 'text-emerald-700' : 'text-[#9CA3AF]'}`}>Inventario comprado</p>
          {sobreStockeando && <p className="mt-0.5 text-sm font-medium text-emerald-700 dark:text-emerald-300">Estás sobrestockeando — compraste más de lo que vendiste.</p>}
          <p className={`text-[28px] font-mono font-bold num-tabular ${sobreStockeando ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-600 dark:text-red-400'}`}>{formatCard(enUnidades ? compradoUnidades : inventarioComprado)}</p>
        </div>
        <div className="border border-[#E5E7EB] bg-white px-5 py-4 dark:border-white/10 dark:bg-[#141414]" style={{ boxShadow: '0px 2px 8px rgba(0,0,0,0.04)' }}>
          <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-1">Stock final</p>
          <p className="text-[28px] font-mono font-bold text-black dark:text-white num-tabular">{formatCard(enUnidades ? stockFinalUnidades : stockFinalPeriodo)}</p>
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
                placeholder="Buscar producto, categoría o marca"
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
                  <th className="px-4 py-3 text-left">Categoría</th>
                  <th className="px-4 py-3 text-left">Marca</th>
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
                      <td className="px-4 py-3.5">
                        <span className="inline-flex border border-[#E5E7EB] bg-[#F9FAFB] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#6B7280] dark:border-white/10 dark:bg-white/5 dark:text-[#D1D5DB]">
                          {prod.categoria || 'Sin categoría'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-[#6B7280] dark:text-[#C9CDD3]">{prod.marca || '—'}</td>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl overflow-hidden rounded-md border border-[#D1D5DB] bg-white shadow-2xl dark:border-white/10 dark:bg-[#0F0F0F]">
            <div className="flex items-start justify-between border-b border-black/10 bg-[#1B2E25] px-5 py-3 dark:border-white/10">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/55">Inventario · Productos</p>
                <h3 className="mt-1 text-base font-semibold text-white">
                  {editingId ? 'Editar producto' : 'Nuevo producto'}
                </h3>
              </div>
              <button
                onClick={() => { setShowForm(false); setEditingId(null); setFormError('') }}
                className="text-xl leading-none text-white/60 transition hover:text-white"
                aria-label="Cerrar"
              >✕</button>
            </div>
            <ProductoFormBody
              key={editingId ?? 'new'}
              editingProd={editingProd ?? null}
              editingId={editingId}
              categoriasExistentes={categoriasExistentes}
              marcasPorCategoria={marcasPorCategoria}
              isPending={isPending}
              formError={formError}
              onSubmit={handleCreateOrUpdate}
              onCancel={() => { setShowForm(false); setEditingId(null); setFormError('') }}
            />
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
                  <form onSubmit={handleAgregarMov} className="space-y-4 rounded-md border border-[#D1D5DB] bg-[#FAFAF9] p-4 dark:border-white/10 dark:bg-[#0F0F0F]">
                    <h4 className={SECTION_HEADING_CLS}>Registrar movimiento</h4>
                    <div className="flex flex-col gap-1.5">
                      <label className={LABEL_CLS}>Tipo</label>
                      <select
                        name="tipo"
                        defaultValue="ENTRADA"
                        className={SELECT_CLS}
                      >
                        <option value="ENTRADA">Entrada</option>
                        <option value="SALIDA">Salida</option>
                        <option value="AJUSTE">Ajuste</option>
                      </select>
                    </div>
                    <InputField label="Cantidad" name="cantidad" type="number" step="0.01" required defaultValue={1} />
                    <InputField label="Motivo" name="motivo" defaultValue="" />
                    {movError && (
                      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                        {movError}
                      </div>
                    )}
                    <div className="flex justify-end gap-2 border-t border-[#E5E7EB] pt-3 dark:border-white/10">
                      <button
                        type="button"
                        onClick={() => { setShowMovForm(false); setMovError('') }}
                        className="rounded-md border border-[#D1D5DB] px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#4B5563] transition hover:border-gray-400 hover:text-[#1F2937] dark:border-white/10 dark:text-gray-300 dark:hover:border-white/20 dark:hover:text-white"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={isPending}
                        className="rounded-md bg-brand-military px-5 py-2 text-[11px] font-bold uppercase tracking-wide text-white transition hover:bg-brand-military-dark disabled:opacity-50"
                      >
                        Guardar movimiento
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="rounded-md border border-dashed border-[#D1D5DB] px-4 py-10 text-center text-sm text-[#9CA3AF] dark:border-white/10">
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
