'use client'

import React, { useState, useTransition } from 'react'
import {
  getProductos, createProducto, updateProducto, deleteProducto, getMovimientosStock,
} from '@/app/actions'
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import {
  FiPackage,
  FiDollarSign,
  FiTag,
  FiTrendingUp,
} from 'react-icons/fi'

type Producto = {
  id: string; nombre: string; descripcion: string | null; categoria: string | null
  marca: string | null; unidad: string; metodoCosteo: string; enTransito: number
  precioVenta: number; precioCosto: number; stockActual: number
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
  precio: number
  motivo: string | null
}

// Formateadores deterministas (evitan mismatch de hidratación entre Node ICU y el navegador).
function formatNumberAR(value: number, minFrac: number, maxFrac: number): string {
  const n = Number.isFinite(value) ? value : 0
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  const factor = Math.pow(10, maxFrac)
  const rounded = Math.round(abs * factor) / factor
  const [intPart, decPartRaw = ''] = rounded.toFixed(maxFrac).split('.')
  const intWithSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  let decPart = decPartRaw
  // Recortar ceros extra hasta minFrac.
  while (decPart.length > minFrac && decPart.endsWith('0')) decPart = decPart.slice(0, -1)
  return decPart ? `${sign}${intWithSep},${decPart}` : `${sign}${intWithSep}`
}
function fmt(v: number | null | undefined) { return formatNumberAR(v ?? 0, 2, 2) }
function fmtUnits(v: number | null | undefined) { return formatNumberAR(v ?? 0, 0, 2) }
function fmtDate(d: Date | string) {
  const date = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(date.getTime())) return ''
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function tipoLabel(tipo?: 'MERCADERIA' | 'SERVICIO') {
  return tipo === 'SERVICIO' ? 'Servicio' : 'Producto'
}

function metodoCosteoLabel(metodo: string | null | undefined) {
  if (metodo === 'FIFO') return 'FIFO'
  if (metodo === 'LIFO') return 'LIFO'
  return 'Promedio'
}

const LABEL_CLS = 'text-[11px] font-semibold uppercase tracking-[0.2em] text-[#374151] dark:text-[#E7F0E5]'
const FIELD_CLS = 'h-9 rounded-md border border-[#D1D5DB] bg-white px-3 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-brand-military/25 focus:border-brand-military transition dark:border-white/15 dark:bg-[#1B1B1B] dark:text-[#F8FAFC] dark:placeholder:text-[#8B938B]'
const SELECT_CLS = FIELD_CLS
const TEXTAREA_CLS = 'rounded-md border border-[#D1D5DB] bg-white px-3 py-2 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-brand-military/25 focus:border-brand-military transition dark:border-white/15 dark:bg-[#1B1B1B] dark:text-[#F8FAFC] dark:placeholder:text-[#8B938B] resize-none'
const SECTION_HEADING_CLS = 'mb-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#6B7280] dark:text-[#D9E7D7]'
const META_LABEL_CLS = 'text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6B7280] dark:text-[#C7D2C1]'
const META_VALUE_CLS = 'text-[11px] text-[#6B7280] dark:text-[#C7D2C1]'

const TIPO_COLORS = {
  ENTRADA: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900',
  SALIDA: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900',
  AJUSTE: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900',
} as const

const STOCK_CHART_COLORS = {
  unidades: '#0F766E',
  grid: '#E5E7EB',
  axis: '#9CA3AF',
} as const

type MovimientoChartPoint = {
  id: string
  label: string
  idx: number
  tipo: Movimiento['tipo']
  unidades: number
}

function InputField({
  label,
  name,
  type = 'text',
  step,
  defaultValue,
  required,
  helperText,
  helperPosition = 'above',
  singleLineLabel = false,
  containerClassName = '',
  inputClassName = '',
}: {
  label: string
  name: string
  type?: string
  step?: string
  defaultValue?: string | number
  required?: boolean
  helperText?: string
  helperPosition?: 'above' | 'below'
  singleLineLabel?: boolean
  containerClassName?: string
  inputClassName?: string
}) {
  const isNumeric = type === 'number'
  const labelClass = `${LABEL_CLS} ${singleLineLabel ? 'whitespace-nowrap' : ''}`

  return (
    <div className={`flex flex-col gap-1 ${containerClassName}`}>
      {helperPosition === 'above' && (
        helperText ? (
          <div className="flex items-center justify-between gap-2">
            <label className={labelClass}>{label}</label>
            <span className="text-[9px] font-medium uppercase tracking-[0.12em] text-[#6B7280] dark:text-[#B7C3B0]">
              {helperText}
            </span>
          </div>
        ) : (
          <label className={labelClass}>{label}</label>
        )
      )}

      {helperPosition === 'below' && <label className={labelClass}>{label}</label>}

      <input
        name={name}
        type={type}
        step={step}
        defaultValue={defaultValue}
        required={required}
        className={`${FIELD_CLS} ${isNumeric ? 'font-sans tabular-nums' : ''} ${inputClassName}`}
      />

      {helperPosition === 'below' && helperText && (
        <span className="text-[9px] font-medium uppercase tracking-[0.12em] text-[#6B7280] dark:text-[#B7C3B0] leading-none">
          {helperText}
        </span>
      )}
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
  isPending,
  formError,
  onSubmit,
  onCancel,
}: {
  editingProd: Producto | null
  editingId: string | null
  categoriasExistentes: string[]
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

  const unidadOptions = ['unidad', 'kg', 'gr', 'lt', 'ml', 'm', 'cm', 'caja', 'pack', 'bulto', 'rollo', 'docena']
  const unidadInicial = (editingProd?.unidad || 'unidad').trim()
  const unidadInicialEsLista = unidadOptions.includes(unidadInicial.toLowerCase())
  const [unidadMode, setUnidadMode] = useState<'pick' | 'custom'>(unidadInicialEsLista ? 'pick' : 'custom')
  const [unidadPick, setUnidadPick] = useState(unidadInicialEsLista ? unidadInicial.toLowerCase() : 'unidad')
  const [unidadCustom, setUnidadCustom] = useState(unidadInicialEsLista ? '' : unidadInicial)
  const unidadValue = (unidadMode === 'pick' ? unidadPick : unidadCustom).trim() || 'unidad'

  const costoUnitarioHelper = (() => {
    const base = unidadValue.toLowerCase()
    if (base === 'kg' || base === 'gr') return 'por kg'
    if (base === 'lt' || base === 'ml' || base === 'l') return 'por litro'
    if (base === 'm' || base === 'cm') return 'por metro'
    if (base === 'unidad' || base === 'u') return 'por unidad'
    return `por ${base || 'unidad'}`
  })()

  return (
    <form onSubmit={onSubmit} className="bg-white dark:bg-[#0F0F0F]">
      {editingProd && (
        <section className="border-b border-[#E5E7EB] bg-[#F8FAFC] px-5 py-4 dark:border-white/10 dark:bg-[#111827]">
          <h4 className={SECTION_HEADING_CLS}>Información actual del producto</h4>
          <div className="grid grid-cols-2 gap-2 text-[11px] text-[#374151] dark:text-[#D1D5DB] sm:grid-cols-3">
            <p>Tipo: <span className="font-semibold">{tipoLabel(editingProd.tipo)}</span></p>
            <p>Categoría: <span className="font-semibold">{editingProd.categoria?.trim() || 'Sin categoría'}</span></p>
            <p>Marca: <span className="font-semibold">{editingProd.marca?.trim() || 'Sin marca'}</span></p>
            <p>Unidad: <span className="font-semibold">{editingProd.unidad || 'unidad'}</span></p>
            <p>Costeo: <span className="font-semibold">{metodoCosteoLabel(editingProd.metodoCosteo)}</span></p>
            <p>Stock actual: <span className="font-mono font-semibold">{fmtUnits(editingProd.stockActual)}</span></p>
            <p>Precio costo: <span className="font-mono font-semibold">${fmt(editingProd.precioCosto)}</span></p>
            <p>Precio venta: <span className="font-mono font-semibold">${fmt(editingProd.precioVenta)}</span></p>
          </div>
        </section>
      )}

      <section className="px-5 py-4">
        <h4 className={SECTION_HEADING_CLS}>Datos generales</h4>
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-8">
            <InputField label="Nombre del producto *" name="nombre" required defaultValue={editingProd?.nombre} />
          </div>
          <div className="col-span-4 flex flex-col gap-1">
            <label className={LABEL_CLS}>Tipo</label>
            <select name="tipo" defaultValue={editingProd?.tipo || 'MERCADERIA'} className={SELECT_CLS}>
              <option value="MERCADERIA">Producto</option>
              <option value="SERVICIO">Servicio</option>
            </select>
          </div>

          <div className="col-span-4 flex flex-col gap-1">
            <label className={LABEL_CLS}>Categoría</label>
            <select
              value={catMode === 'pick' ? catPick : '__new__'}
              onChange={(e) => {
                if (e.target.value === '__new__') {
                  setCatMode('new')
                } else {
                  setCatMode('pick')
                  setCatPick(e.target.value)
                }
              }}
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
          <div className="col-span-4">
            <InputField label="Marca" name="marca" defaultValue={editingProd?.marca || ''} />
          </div>
          <div className="col-span-4 flex flex-col gap-1">
            <label className={LABEL_CLS}>Unidad</label>
            <select
              value={unidadMode === 'pick' ? unidadPick : '__custom__'}
              onChange={(e) => {
                if (e.target.value === '__custom__') {
                  setUnidadMode('custom')
                } else {
                  setUnidadMode('pick')
                  setUnidadPick(e.target.value)
                }
              }}
              className={SELECT_CLS}
            >
              {unidadOptions.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
              <option value="__custom__">Otro +</option>
            </select>
            {unidadMode === 'custom' && (
              <input
                type="text"
                value={unidadCustom}
                onChange={(e) => setUnidadCustom(e.target.value)}
                placeholder="Ingresá la unidad"
                className={FIELD_CLS}
              />
            )}
            <input type="hidden" name="unidad" value={unidadValue} />
          </div>
        </div>
      </section>

      <section className="border-t border-[#E5E7EB] px-5 py-4 dark:border-white/10">
        <h4 className={SECTION_HEADING_CLS}>Inventario y precios</h4>

        <div className="mb-4 flex flex-col gap-1">
          <label className={LABEL_CLS}>Método de costeo</label>
          <div className="flex h-12 items-center rounded-md border border-[#D1D5DB] bg-[#F3F4F6] px-3 text-sm text-[#111827] dark:border-white/10 dark:bg-[#161616] dark:text-[#F3F4F6]">
            Promedio ponderado
          </div>
          <input type="hidden" name="metodoCosteo" value="PROMEDIO" />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <InputField
            label="Stock inicial"
            name="stockActual"
            type="number"
            step="0.01"
            defaultValue={editingProd?.stockActual ?? 0}
            containerClassName="min-w-0"
            inputClassName="h-12 text-base px-4"
          />
          <InputField
            label="Costo unitario"
            name="precioCosto"
            type="number"
            step="0.01"
            defaultValue={editingProd?.precioCosto ?? 0}
            helperText={costoUnitarioHelper}
            helperPosition="below"
            singleLineLabel
            containerClassName="min-w-0"
            inputClassName="h-12 text-base px-4"
          />
          <InputField
            label="Precio venta"
            name="precioVenta"
            type="number"
            step="0.01"
            defaultValue={editingProd?.precioVenta ?? 0}
            containerClassName="min-w-0"
            inputClassName="h-12 text-base px-4"
          />
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
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedProductoId, setSelectedProductoId] = useState<string | null>(null)
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [showMovimientosModal, setShowMovimientosModal] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [vistaInventario, setVistaInventario] = useState<'UNIDADES' | 'PESOS'>('PESOS')
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState('')

  async function reload() {
    const data = await getProductos()
    setProductos(data as Producto[])
  }

  function handleCreateOrUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('metodoCosteo', 'PROMEDIO')
    fd.set('unidad', (fd.get('unidad') as string | null)?.trim() || 'unidad')
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
      return
    }
    setSelectedProductoId(id)
    void loadMovimientos(id)
  }

  function handleOpenMovimientos(id: string) {
    setSelectedProductoId(id)
    setShowMovimientosModal(true)
    void loadMovimientos(id)
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
  const bajoStock = productos.filter(p => p.stockActual > 0 && p.stockActual < 5).length
  const editingProd = editingId ? productos.find(p => p.id === editingId) : null
  const selectedProducto = selectedProductoId ? productos.find(p => p.id === selectedProductoId) : null
  const stockInsights = (() => {
    if (!selectedProducto) {
      return {
        points: [] as MovimientoChartPoint[],
      }
    }

    const orderedAsc = [...movimientos].sort((a, b) => {
      const da = new Date(a.fecha).getTime()
      const db = new Date(b.fecha).getTime()
      return da - db
    })

    let stockAfter = selectedProducto.stockActual
    const pointsReverse: MovimientoChartPoint[] = []
    for (let i = orderedAsc.length - 1; i >= 0; i -= 1) {
      const mov = orderedAsc[i]
      const unidades = mov.tipo === 'AJUSTE' ? mov.cantidad : stockAfter
      pointsReverse.push({
        id: mov.id,
        label: fmtDate(mov.fecha),
        idx: i + 1,
        tipo: mov.tipo,
        unidades,
      })
      stockAfter = mov.tipo === 'ENTRADA'
        ? unidades - mov.cantidad
        : mov.tipo === 'SALIDA'
          ? unidades + mov.cantidad
          : mov.cantidad
    }
    let points: MovimientoChartPoint[] = pointsReverse.reverse().map((point, i) => ({
      ...point,
      idx: i + 1,
    }))

    if (points.length === 0) {
      points = [
        { id: 'unidades-base-1', label: 'Inicio', idx: 1, tipo: 'AJUSTE', unidades: selectedProducto.stockActual },
        { id: 'unidades-base-2', label: 'Actual', idx: 2, tipo: 'AJUSTE', unidades: selectedProducto.stockActual },
      ]
    } else if (points.length === 1) {
      points = [
        points[0],
        { ...points[0], id: `${points[0].id}-actual`, label: 'Actual', idx: 2, unidades: selectedProducto.stockActual },
      ]
    }

    return { points }
  })()
  const categoriasExistentes = Array.from(
    new Set(
      productos
        .map(p => p.categoria?.trim())
        .filter((c): c is string => !!c)
    )
  ).sort((a, b) => a.localeCompare(b, 'es'))

  // ── Agrupar productos por categoría (para tabla + exportar) ──
  type GrupoInventario = {
    categoria: string
    productos: Producto[]
    unidades: number
    valorizado: number
    ingresos: number
    ganancia: number
  }
  const gruposInventario: GrupoInventario[] = (() => {
    const map = new Map<string, GrupoInventario>()
    for (const p of filtrados) {
      const key = (p.categoria?.trim() || 'Sin categoría')
      const g = map.get(key) ?? { categoria: key, productos: [], unidades: 0, valorizado: 0, ingresos: 0, ganancia: 0 }
      g.productos.push(p)
      g.unidades += p.stockActual
      g.valorizado += p.stockActual * p.precioCosto
      g.ingresos += p.stockActual * p.precioVenta
      g.ganancia += p.stockActual * (p.precioVenta - p.precioCosto)
      map.set(key, g)
    }
    return Array.from(map.values()).sort((a, b) => a.categoria.localeCompare(b.categoria, 'es'))
  })()
  const totalGeneral = gruposInventario.reduce(
    (acc, g) => ({
      unidades: acc.unidades + g.unidades,
      valorizado: acc.valorizado + g.valorizado,
      ingresos: acc.ingresos + g.ingresos,
      ganancia: acc.ganancia + g.ganancia,
    }),
    { unidades: 0, valorizado: 0, ingresos: 0, ganancia: 0 }
  )
  const pctMargen = (ganancia: number, ingresos: number) =>
    ingresos > 0 ? (ganancia / ingresos) * 100 : 0

  function handleImprimir() {
    document.body.classList.add('printing-inventario')
    // Damos un tick para que el navegador aplique el CSS antes del diálogo
    setTimeout(() => {
      window.print()
      document.body.classList.remove('printing-inventario')
    }, 50)
  }

  function handleExportar() {
    const esc = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`
    const money = (value: number) => value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const pct = (value: number) => `${value.toFixed(2).replace('.', ',')}%`

    const lines: string[] = []
    lines.push(['Producto', 'Categoría', 'Unidades', 'Valorizado', 'Ingresos', 'Ganancias', '% Margen'].map(esc).join(','))

    for (const g of gruposInventario) {
      lines.push([g.categoria.toUpperCase(), '', `${g.productos.length} productos`, `${g.unidades} unidades`, '', '', ''].map(esc).join(','))
      for (const p of g.productos) {
        const gan = p.stockActual * (p.precioVenta - p.precioCosto)
        const ing = p.stockActual * p.precioVenta
        lines.push([
          p.nombre,
          g.categoria,
          fmtUnits(p.stockActual),
          money(p.stockActual * p.precioCosto),
          money(ing),
          money(gan),
          pct(pctMargen(gan, ing)),
        ].map(esc).join(','))
      }
      lines.push([
        `Subtotal ${g.categoria}`,
        '',
        fmtUnits(g.unidades),
        money(g.valorizado),
        money(g.ingresos),
        money(g.ganancia),
        pct(pctMargen(g.ganancia, g.ingresos)),
      ].map(esc).join(','))
      lines.push('')
    }

    lines.push([
      'TOTAL GENERAL',
      '',
      fmtUnits(totalGeneral.unidades),
      money(totalGeneral.valorizado),
      money(totalGeneral.ingresos),
      money(totalGeneral.ganancia),
      pct(pctMargen(totalGeneral.ganancia, totalGeneral.ingresos)),
    ].map(esc).join(','))

    const csv = lines.join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
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
    alerta:   { border: 'border-[#E5E7EB] dark:border-white/10', bg: 'bg-white dark:bg-[#141414]', text: 'text-[#374151] dark:text-[#D1D5DB]', accent: 'text-[#4B5563] dark:text-[#E5E7EB]', dot: 'bg-[#6B7280]' },
    critico:  { border: 'border-[#E5E7EB] dark:border-white/10', bg: 'bg-white dark:bg-[#141414]', text: 'text-[#374151] dark:text-[#D1D5DB]', accent: 'text-[#B91C1C] dark:text-[#FCA5A5]', dot: 'bg-[#EF4444]' },
  }[diagnostico.tono]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-stretch">
        <div className="executive-panel inline-flex items-stretch overflow-hidden">
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

        <div className={`executive-panel flex items-center gap-2.5 px-3.5 py-1.5 ${diagnosticoStyles.border} ${diagnosticoStyles.bg}`}>
          <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${diagnosticoStyles.dot}`} aria-hidden />
          <div className="min-w-0 flex-1 flex flex-wrap items-baseline gap-x-2">
            <p className={`text-[11px] font-semibold tracking-wide whitespace-nowrap ${diagnosticoStyles.accent}`}>{diagnostico.titulo}</p>
            <p className={`truncate text-xs ${diagnosticoStyles.text}`}>{diagnostico.mensaje}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="executive-metric px-5 py-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">Inventario inicial</p>
          <p className="text-[28px] font-mono font-bold text-[#111827] dark:text-white num-tabular">{formatCard(enUnidades ? inicialUnidades : inventarioInicial)}</p>
        </div>
        <div className={`executive-metric px-5 py-4 ${sobreVendiendo ? 'border-l-4 border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/20' : ''}`}>
          <p className={`mb-1 text-xs font-semibold uppercase tracking-wider ${sobreVendiendo ? 'text-emerald-700 dark:text-emerald-300' : 'text-[#9CA3AF]'}`}>Inventario vendido</p>
          {sobreVendiendo && <p className="mt-0.5 text-sm font-medium text-emerald-700 dark:text-emerald-300">Estás sobrevendiendo — vendiste más de lo que compraste.</p>}
          <p className={`text-[28px] font-mono font-bold num-tabular ${sobreVendiendo ? 'text-emerald-700 dark:text-emerald-300' : 'text-brand-military-dark dark:text-[#6EBC8A]'}`}>{formatCard(enUnidades ? vendidoUnidades : inventarioVendido)}</p>
        </div>
        <div className={`executive-metric px-5 py-4 ${sobreStockeando ? 'border-l-4 border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/20' : ''}`}>
          <p className={`mb-1 text-xs font-semibold uppercase tracking-wider ${sobreStockeando ? 'text-emerald-700 dark:text-emerald-300' : 'text-[#9CA3AF]'}`}>Inventario comprado</p>
          {sobreStockeando && <p className="mt-0.5 text-sm font-medium text-emerald-700 dark:text-emerald-300">Estás sobrestockeando — compraste más de lo que vendiste.</p>}
          <p className={`text-[28px] font-mono font-bold num-tabular ${sobreStockeando ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-600 dark:text-red-400'}`}>{formatCard(enUnidades ? compradoUnidades : inventarioComprado)}</p>
        </div>
        <div className="executive-metric px-5 py-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">Stock final</p>
          <p className="text-[28px] font-mono font-bold text-[#111827] dark:text-white num-tabular">{formatCard(enUnidades ? stockFinalUnidades : stockFinalPeriodo)}</p>
        </div>
      </div>

      <div className="executive-panel overflow-hidden">
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
                onClick={() => { setShowForm(true); setEditingId(null); setFormError('') }}
                className="flex items-center gap-1.5 rounded-xl bg-brand-military px-3.5 py-2.5 text-xs font-semibold text-white transition hover:bg-brand-military-dark"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Nuevo producto
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(v => !v)}
                  className="flex items-center gap-1.5 rounded-xl border border-[#D1D5DB] px-3 py-2.5 text-xs font-semibold text-[#4B5563] transition hover:border-brand-military hover:text-brand-military dark:border-white/10 dark:text-[#D1D5DB]"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l4-4m-4 4l-4-4M4 17v1a2 2 0 002 2h12a2 2 0 002-2v-1" />
                  </svg>
                  Exportar
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showExportMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} aria-hidden />
                    <div className="absolute right-0 top-full z-20 mt-1 min-w-[160px] border border-[#D1D5DB] bg-white shadow-lg dark:border-white/10 dark:bg-[#1A1A1A]">
                      <button
                        onClick={() => { setShowExportMenu(false); handleExportar() }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[#374151] hover:bg-[#F3F4F6] dark:text-[#D1D5DB] dark:hover:bg-white/5"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-6 4h6M9 9h1M5 21h14a2 2 0 002-2V7l-5-5H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        Descargar Excel
                      </button>
                      <button
                        onClick={() => { setShowExportMenu(false); handleImprimir() }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[#374151] hover:bg-[#F3F4F6] dark:text-[#D1D5DB] dark:hover:bg-white/5"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        Imprimir
                      </button>
                    </div>
                  </>
                )}
              </div>
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
                className="w-full rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] py-2.5 pl-10 pr-3 text-sm text-[#374151] placeholder:text-[#9CA3AF] focus:border-brand-military focus:outline-none dark:border-white/10 dark:bg-[#1F1F1F] dark:text-[#D1D5DB]"
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
          <div id="inventario-tabla" className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-xs">
              <thead>
                <tr className="border-b border-white/10 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9CA3AF]">
                  <th className="px-5 py-3 text-left w-[38%]">Producto</th>
                  <th className="px-4 py-3 text-right">Unidades</th>
                  <th className="px-4 py-3 text-right">Valorizado</th>
                  <th className="px-4 py-3 text-right">Ingresos</th>
                  <th className="px-4 py-3 text-right">Ganancias</th>
                  <th className="px-4 py-3 text-right w-[80px] print-hide" aria-label="Acciones"></th>
                </tr>
              </thead>
              <tbody>
                {gruposInventario.map((grupo, gIdx) => {
                  const marginGrupo = pctMargen(grupo.ganancia, grupo.ingresos)
                  return (
                    <React.Fragment key={grupo.categoria}>
                      {/* Header de grupo */}
                      <tr className="bg-[#F4F2EB] group-header dark:bg-[#17191C]">
                        <td className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#111827] dark:text-[#F8FAFC]">
                          {grupo.categoria}
                        </td>
                        <td colSpan={5} className="px-4 py-2.5 text-right text-[11px] font-medium text-[#4B5563] dark:text-[#C7D2C1]">
                          {grupo.productos.length} producto{grupo.productos.length !== 1 ? 's' : ''} · {fmtUnits(grupo.unidades)} unidades
                        </td>
                      </tr>

                      {/* Filas de producto */}
                      {grupo.productos.map(prod => {
                        const valorizado = prod.stockActual * prod.precioCosto
                        const ingresos = prod.stockActual * prod.precioVenta
                        const ganancia = prod.stockActual * (prod.precioVenta - prod.precioCosto)
                        const margen = pctMargen(ganancia, ingresos)
                        return (
                          <tr
                            key={prod.id}
                            onClick={() => handleOpenMovimientos(prod.id)}
                            className="border-b border-white/5 transition-colors hover:bg-white/[0.03] cursor-pointer"
                          >
                            <td className="px-5 py-3">
                              <div className="text-sm font-semibold text-[#111827] dark:text-[#F8FAFC]">{prod.nombre}</div>
                              {prod.descripcion && (
                                <div className="mt-0.5 max-w-[280px] truncate text-[11px] text-[#6B7280] dark:text-[#C7D2C1]">{prod.descripcion}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-[#111827] dark:text-[#F8FAFC] num-tabular">
                              {fmtUnits(prod.stockActual)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-[#374151] dark:text-[#E7F0E5] num-tabular">
                              ${fmt(valorizado)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-400 num-tabular">
                              ${fmt(ingresos)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono num-tabular">
                              <span className="font-semibold text-sky-400">${fmt(ganancia)}</span>
                              <span className="ml-1.5 text-[11px] font-medium text-[#6B7280]">{margen.toFixed(1).replace('.', ',')}%</span>
                            </td>
                            <td className="px-4 py-3 text-right print-hide" onClick={e => e.stopPropagation()}>
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={() => { setEditingId(prod.id); setShowForm(true); setFormError('') }}
                                  aria-label="Editar producto"
                                  title="Editar"
                                  className="p-1 text-[#9CA3AF] transition hover:text-white"
                                >
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5m-1.5-9.5a2.121 2.121 0 1 1 3 3L12 21l-4 1 1-4 10.5-10.5Z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDelete(prod.id)}
                                  aria-label="Eliminar producto"
                                  title="Eliminar"
                                  className="p-1 text-red-400 transition hover:text-red-300"
                                >
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}

                      {/* Subtotal del grupo */}
                      <tr className="border-b border-white/10 subtotal-row">
                        <td className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6B7280]">Subtotal</td>
                        <td className="px-4 py-2.5 text-right font-mono text-[#9CA3AF] num-tabular">{fmtUnits(grupo.unidades)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-[#9CA3AF] num-tabular">${fmt(grupo.valorizado)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-[#9CA3AF] num-tabular">${fmt(grupo.ingresos)}</td>
                        <td className="px-4 py-2.5 text-right font-mono num-tabular">
                          <span className="text-[#9CA3AF]">${fmt(grupo.ganancia)}</span>
                          <span className="ml-1.5 text-[11px] text-[#6B7280]">{marginGrupo.toFixed(1).replace('.', ',')}%</span>
                        </td>
                        <td className="px-4 py-2.5 print-hide"></td>
                      </tr>

                      {/* Separador entre grupos */}
                      {gIdx < gruposInventario.length - 1 && (
                        <tr aria-hidden><td colSpan={6} className="h-2"></td></tr>
                      )}
                    </React.Fragment>
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

      <section className="executive-panel overflow-hidden" aria-label="Totales de inventario">
        <div className="overflow-x-auto">
          <div className="min-w-[820px] border-t border-[#D1D5DB] bg-gradient-to-r from-[#F8F7F2] via-[#FCFCFA] to-[#F8F7F2] dark:border-white/10 dark:from-[#121212] dark:via-[#151515] dark:to-[#121212]">
            <div className="grid grid-cols-[38%_repeat(4,minmax(0,1fr))_80px] items-center">
              <p className="px-5 py-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[#111827] dark:text-[#F8FAFC]">Total general</p>
              <p className="px-4 py-3 text-right font-mono text-sm font-bold text-[#111827] dark:text-[#F8FAFC] num-tabular">{fmtUnits(totalGeneral.unidades)}</p>
              <p className="px-4 py-3 text-right font-mono text-sm font-bold text-[#111827] dark:text-[#F8FAFC] num-tabular">${fmt(totalGeneral.valorizado)}</p>
              <p className="px-4 py-3 text-right font-mono text-sm font-bold text-emerald-700 dark:text-emerald-300 num-tabular">${fmt(totalGeneral.ingresos)}</p>
              <p className="px-4 py-3 text-right font-mono text-sm font-bold num-tabular">
                <span className="text-sky-700 dark:text-sky-300">${fmt(totalGeneral.ganancia)}</span>
                <span className="ml-1.5 text-[11px] font-semibold text-[#6B7280] dark:text-[#B8C3B1]">{pctMargen(totalGeneral.ganancia, totalGeneral.ingresos).toFixed(1).replace('.', ',')}%</span>
              </p>
              <span className="px-4 py-3 print-hide" aria-hidden></span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Modal crear/editar producto ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl max-h-[92vh] overflow-hidden border border-[#D1D5DB] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.22)] dark:border-white/10 dark:bg-[#0B0F14]">
            <div className="flex items-start justify-between border-b border-[#E5E7EB] bg-[#111827] px-5 py-4 dark:border-white/10 dark:bg-[#0B0F14]">
              <h3 className="flex items-center gap-2.5 text-base font-semibold text-slate-100">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center border border-white/20 bg-white/10 text-sm leading-none" aria-hidden>📦</span>
                {editingId ? 'Editar producto' : 'Nuevo producto'}
              </h3>
              <button
                onClick={() => { setShowForm(false); setEditingId(null); setFormError('') }}
                className="border border-white/20 bg-white/10 px-2.5 py-1.5 text-lg leading-none text-slate-200 transition hover:bg-white/20 hover:text-white"
                aria-label="Cerrar"
              >✕</button>
            </div>
            <div className="max-h-[calc(92vh-74px)] overflow-y-auto">
              <ProductoFormBody
                key={editingId ?? 'new'}
                editingProd={editingProd ?? null}
                editingId={editingId}
                categoriasExistentes={categoriasExistentes}
                isPending={isPending}
                formError={formError}
                onSubmit={handleCreateOrUpdate}
                onCancel={() => { setShowForm(false); setEditingId(null); setFormError('') }}
              />
            </div>
          </div>
        </div>
      )}

      {showMovimientosModal && selectedProducto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl max-h-[92vh] overflow-hidden border border-[#D1D5DB] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.24)] dark:border-white/10 dark:bg-[#0B0F14]">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] bg-[#111827] px-5 py-4 dark:border-white/10 dark:bg-[#0B0F14]">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center border border-white/20 bg-white/10 text-sm leading-none" aria-hidden>📦</span>
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-white">Movimientos de stock</h3>
                  <p className="mt-1 text-xs text-white/70">{selectedProducto.nombre}</p>
                </div>
              </div>
              <button
                onClick={() => { setShowMovimientosModal(false) }}
                className="border border-white/20 bg-white/10 px-2.5 py-1.5 text-lg leading-none text-slate-200 transition hover:bg-white/20 hover:text-white"
              >✕</button>
            </div>

            <div className="grid max-h-[calc(92vh-74px)] gap-0 overflow-y-auto lg:grid-cols-[1fr_1fr]">
              <div className="border-b border-[#E5E7EB] p-5 dark:border-white/10 lg:border-b-0 lg:border-r lg:p-6">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6B7280] dark:text-[#C7D2C1]">Historial de unidades (tiempo/stock)</p>
                  <p className="text-[11px] text-[#9CA3AF]">Últimos {movimientos.length} registros</p>
                </div>

                <div className="rounded-xl border border-[#E5E7EB] bg-gradient-to-b from-[#FFFFFF] to-[#FAFAF8] p-4 shadow-sm dark:border-white/10 dark:from-[#141414] dark:to-[#101010]">
                  {stockInsights.points.length === 0 ? (
                    <div className="rounded-md border border-dashed border-[#D1D5DB] px-4 py-12 text-center text-xs text-[#9CA3AF] dark:border-white/10">
                      Cargá movimientos para visualizar la serie de unidades.
                    </div>
                  ) : (
                    <div className="h-[420px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={stockInsights.points} margin={{ top: 8, right: 12, left: -8, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" opacity={0.7} vertical={false} />
                          <XAxis
                            dataKey="label"
                            stroke="#94A3B8"
                            tick={{ fontSize: 10, fill: '#64748B' }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            yAxisId="unidades"
                            stroke="#94A3B8"
                            tick={{ fontSize: 10, fill: '#64748B' }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => fmtUnits(Number(value))}
                          />
                          <Tooltip
                            cursor={{ stroke: '#475569', strokeWidth: 1, strokeDasharray: '4 4' }}
                            contentStyle={{
                              border: '1px solid #E2E8F0',
                              borderRadius: 10,
                              background: '#0F172A',
                              color: '#E2E8F0',
                              boxShadow: '0 8px 18px rgba(15, 23, 42, 0.12)',
                            }}
                            labelFormatter={(value) => {
                              const point = stockInsights.points.find(p => p.label === String(value))
                              return point ? `${point.label} · ${point.tipo}` : String(value)
                            }}
                            formatter={(value, name) => {
                              if (name === 'Unidades') return [`${fmtUnits(Number(value))} ${selectedProducto.unidad}`, 'Unidades']
                              return [String(value), String(name)]
                            }}
                          />
                          <Line
                            yAxisId="unidades"
                            type="monotone"
                            dataKey="unidades"
                            name="Unidades"
                            stroke={STOCK_CHART_COLORS.unidades}
                            strokeWidth={3}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            dot={(props: { cx?: number; cy?: number; payload?: { id?: string } }) => {
                              const { cx, cy, payload } = props
                              if (typeof cx !== 'number' || typeof cy !== 'number') return null
                              return (
                                <circle
                                  key={payload?.id ?? `${cx}-${cy}`}
                                  cx={cx}
                                  cy={cy}
                                  r={4.5}
                                  fill="#F8FAFC"
                                  stroke={STOCK_CHART_COLORS.unidades}
                                  strokeWidth={2.5}
                                />
                              )
                            }}
                            activeDot={{ r: 6, fill: STOCK_CHART_COLORS.unidades, stroke: '#FFF', strokeWidth: 2 }}
                            connectNulls
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-5 lg:p-6">
                <div className="mb-5 border border-[#E5E7EB] bg-[#F9FAFB] p-3 dark:border-white/10 dark:bg-[#111111]">
                  <div className="mb-3 flex items-center justify-between gap-3 border-b border-[#E5E7EB] pb-2 dark:border-white/10">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6B7280] dark:text-[#CBD5E1]">Resumen de Producto</p>
                    <span className="text-[10px] text-[#9CA3AF] dark:text-[#94A3B8]">{selectedProducto.unidad}</span>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex items-start gap-3 border border-[#E5E7EB] bg-white p-3 dark:border-[#1E293B] dark:bg-[#111827]">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-[#F3F4F6] text-[#374151] dark:bg-[#1E293B] dark:text-[#E2E8F0]">
                        <FiPackage className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6B7280] dark:text-[#CBD5E1]">Nombre</p>
                        <h4 className="mt-1 text-base font-semibold leading-tight text-[#111827] dark:text-[#F8FAFC]">{selectedProducto.nombre}</h4>
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-[#6B7280] dark:text-[#C7D2C1]">
                          {selectedProducto.categoria && (
                            <span className="border border-[#E5E7EB] bg-[#F9FAFB] px-2 py-0.5 dark:border-[#334155] dark:bg-[#0B1220]">{selectedProducto.categoria}</span>
                          )}
                          {selectedProducto.marca && (
                            <span className="border border-[#E5E7EB] bg-[#F9FAFB] px-2 py-0.5 dark:border-[#334155] dark:bg-[#0B1220]">{selectedProducto.marca}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 border border-[#E5E7EB] bg-white p-3 dark:border-[#1E293B] dark:bg-[#111827]">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-[#F3F4F6] text-[#374151] dark:bg-[#1E293B] dark:text-[#E2E8F0]">
                          <FiDollarSign className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6B7280] dark:text-[#CBD5E1]">Precio unitario</p>
                          <p className="mt-1 font-sans text-base font-semibold text-[#111827] dark:text-[#F8FAFC]">${fmt(selectedProducto.precioVenta)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 border border-[#E5E7EB] bg-white p-3 dark:border-[#1E293B] dark:bg-[#111827]">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-[#F3F4F6] text-[#374151] dark:bg-[#1E293B] dark:text-[#E2E8F0]">
                          <FiTag className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6B7280] dark:text-[#CBD5E1]">Costo unitario</p>
                          <p className="mt-1 font-sans text-base font-semibold text-[#111827] dark:text-[#F8FAFC]">${fmt(selectedProducto.precioCosto)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 border border-[#E5E7EB] bg-white p-3 dark:border-[#1E293B] dark:bg-[#111827]">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-[#F3F4F6] text-[#374151] dark:bg-[#1E293B] dark:text-[#E2E8F0]">
                          <FiTrendingUp className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6B7280] dark:text-[#CBD5E1]">Ganancia unitaria</p>
                          <p className={`mt-1 font-sans text-base font-semibold ${(selectedProducto.precioVenta - selectedProducto.precioCosto) >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                            ${(selectedProducto.precioVenta - selectedProducto.precioCosto) >= 0 ? '+' : ''}{fmt(selectedProducto.precioVenta - selectedProducto.precioCosto)}
                          </p>
                        </div>
                      </div>

                      <div className={`flex h-8 min-w-[64px] items-center justify-center border px-2 text-[10px] font-bold uppercase tracking-[0.18em] ${(selectedProducto.precioVenta - selectedProducto.precioCosto) >= 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200' : 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200'}`}>
                        {selectedProducto.precioCosto > 0
                          ? `${(((selectedProducto.precioVenta - selectedProducto.precioCosto) / selectedProducto.precioCosto) * 100) >= 0 ? '+' : ''}${fmt(((((selectedProducto.precioVenta - selectedProducto.precioCosto) / selectedProducto.precioCosto) * 100)))}%`
                          : '0%'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Estilos print-friendly para inventario ── */}
      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 14mm; }
          body.printing-inventario {
            background: #ffffff !important;
            color: #111111 !important;
          }
          /* Ocultar todo menos la tabla del inventario */
          body.printing-inventario * { visibility: hidden !important; }
          body.printing-inventario #inventario-tabla,
          body.printing-inventario #inventario-tabla * { visibility: visible !important; }
          body.printing-inventario #inventario-tabla {
            position: absolute !important;
            top: 0; left: 0; right: 0;
            width: 100% !important;
          }
          body.printing-inventario .print-hide { display: none !important; }

          /* Reset colores para papel */
          body.printing-inventario #inventario-tabla,
          body.printing-inventario #inventario-tabla table,
          body.printing-inventario #inventario-tabla thead,
          body.printing-inventario #inventario-tabla tbody,
          body.printing-inventario #inventario-tabla tr,
          body.printing-inventario #inventario-tabla td,
          body.printing-inventario #inventario-tabla th {
            background: #ffffff !important;
            color: #111111 !important;
            border-color: #d1d5db !important;
            box-shadow: none !important;
          }
          body.printing-inventario #inventario-tabla table {
            min-width: 0 !important;
            width: 100% !important;
            font-size: 11px !important;
          }
          body.printing-inventario #inventario-tabla thead tr {
            border-bottom: 2px solid #111 !important;
          }
          body.printing-inventario #inventario-tabla thead th {
            color: #111 !important;
            font-weight: 700 !important;
          }
          body.printing-inventario #inventario-tabla .group-header td {
            background: #f3f4f6 !important;
            font-weight: 700 !important;
            border-top: 1px solid #111 !important;
          }
          body.printing-inventario #inventario-tabla .subtotal-row td {
            background: #fafafa !important;
            font-style: italic !important;
            border-top: 1px dashed #9ca3af !important;
          }
          body.printing-inventario #inventario-tabla .total-general-row td {
            background: #ffffff !important;
            font-weight: 800 !important;
            border-top: 2px solid #111 !important;
            border-bottom: 2px solid #111 !important;
          }
          body.printing-inventario #inventario-tabla .text-emerald-400,
          body.printing-inventario #inventario-tabla .text-sky-400 {
            color: #111 !important;
          }
          body.printing-inventario tr { page-break-inside: avoid !important; }
        }
      `}</style>
    </div>
  )
}