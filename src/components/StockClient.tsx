'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  deleteProducto, deleteArticulo, getMovimientosStock,
} from '@/app/actions'
import ProductoSheet, { type MovimientoFicha } from './stock/ProductoSheet'
import ProductoForm, { type ArticuloEditable } from './stock/ProductoForm'
import PreciosMasivoSheet from './stock/PreciosMasivoSheet'
import StockGrid from './stock/StockGrid'
import Foto, { fotoUrl } from './stock/Foto'
import type { ArticuloVista } from './stock/tipos'
import { claveVariante, etiquetaVariante, parseAtributos, parseValores, resumenAtributos } from '@/lib/variantes'
import AnimatedNumber from './financial-statements/AnimatedNumber'
import SubtotalesSheet from './stock/SubtotalesSheet'
import { unidadDe } from '@/lib/unidades'

type Producto = {
  id: string; nombre: string; descripcion: string | null; categoria: string | null
  marca: string | null; unidad: string; metodoCosteo: string; enTransito: number
  precioVenta: number; precioCosto: number; stockActual: number
  tipo?: 'MERCADERIA' | 'SERVICIO' | string
  alertaStock?: number | null
  /** Variante de un artículo (null = producto suelto) */
  articuloId?: string | null
  atributos?: string | null
  precioPropio?: boolean
  articulo?: { id: string; nombre: string; subcategoria: string | null; atributos: string | null; precioVenta: number; fotoAt: Date | string | null } | null
  stockInicialPeriodo?: number
  entradasPeriodo?: number
  salidasPeriodo?: number
  /** Costo de lo vendido en el período: cada salida a su CPP del momento */
  cmvPeriodo?: number
  /** Valor al costo al inicio del período, de lo comprado en el período y al cierre */
  valorInicialPeriodo?: number
  valorCompradoPeriodo?: number
  valorFinalPeriodo?: number
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
function fmtUnits(v: number | null | undefined) { return formatNumberAR(v ?? 0, 0, 2) }
function fmtEntero(v: number | null | undefined) { return formatNumberAR(Math.round(v ?? 0), 0, 0) }


export default function StockClient({ initialProductos, ventasPeriodo = 0 }: { initialProductos: Producto[]; ventasPeriodo?: number }) {
  // Vienen del servidor con el flujo del período; después de un cambio se piden de nuevo (router.refresh)
  const productos = initialProductos
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showSubtotales, setShowSubtotales] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedProductoId, setSelectedProductoId] = useState<string | null>(null)
  const [movimientos, setMovimientos] = useState<MovimientoFicha[]>([])
  const [varianteInicial, setVarianteInicial] = useState<string | null>(null)
  const [showPrecios, setShowPrecios] = useState(false)
  // Artículos con variantes abiertos en la tabla
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set())
  const [aviso, setAviso] = useState<string | null>(null)
  const [showMovimientosModal, setShowMovimientosModal] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [vistaInventario, setVistaInventario] = useState<'UNIDADES' | 'PESOS'>('PESOS')
  const [, startTransition] = useTransition()

  async function reload() {
    // Vuelve a pedir la página: así las tarjetas del período no se pierden
    router.refresh()
  }

  function handleDelete(a: ArticuloVista) {
    const variantes = a.variantes.length > 1 ? ` y sus ${a.variantes.length} variantes` : ''
    if (!confirm(`¿Eliminar «${a.nombre}»${variantes}? Las ventas y movimientos se conservan.`)) return
    startTransition(async () => {
      if (a.articuloId) await deleteArticulo(a.articuloId)
      else await deleteProducto(a.variantes[0].id)
      setShowMovimientosModal(false)
      await reload()
    })
  }

  function mostrarAviso(txt: string) {
    setAviso(txt)
    setTimeout(() => setAviso(null), 2600)
  }

  // Categorías plegadas y orden de la tabla (tocar un encabezado)
  const [plegadas, setPlegadas] = useState<Set<string>>(new Set())
  const togglePlegada = (cat: string) => setPlegadas((prev) => {
    const next = new Set(prev)
    if (next.has(cat)) next.delete(cat)
    else next.add(cat)
    return next
  })
  type OrdenCol = 'nombre' | 'unidades' | 'valorizado' | 'proyeccion'
  const [orden, setOrden] = useState<OrdenCol>('nombre')
  const ordenarPor = (col: OrdenCol) => setOrden((prev) => (prev === col ? 'nombre' : col))

  async function loadMovimientos(ids: string[]) {
    const data = await getMovimientosStock(ids)
    setMovimientos((data || []) as MovimientoFicha[])
  }

  function abrirFicha(a: ArticuloVista, varianteId: string | null = null) {
    setSelectedProductoId(a.key)
    setVarianteInicial(varianteId)
    setMovimientos([])
    setShowMovimientosModal(true)
    void loadMovimientos(a.variantes.map((v) => v.id))
  }

  const toggleAbierto = (key: string) => setAbiertos((prev) => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })

  // ── Artículos: agrupa las variantes (productos con el mismo artículo) ──
  const articulos: ArticuloVista[] = (() => {
    const map = new Map<string, ArticuloVista>()
    for (const p of productos) {
      const art = p.articuloId ? p.articulo : null
      const key = art?.id ?? p.id
      let a = map.get(key)
      const defs = parseAtributos(art?.atributos)
      if (!a) {
        a = {
          key,
          articuloId: art?.id ?? null,
          nombre: art?.nombre ?? p.nombre,
          marca: p.marca,
          categoria: p.categoria,
          subcategoria: art?.subcategoria ?? null,
          unidad: p.unidad,
          tipo: p.tipo === 'SERVICIO' ? 'SERVICIO' : 'MERCADERIA',
          precioBase: art?.precioVenta ?? p.precioVenta,
          atributos: defs,
          fotoSrc: fotoUrl(art?.id, art?.fotoAt),
          variantes: [],
        }
        map.set(key, a)
      }
      const valores = parseValores(p.atributos)
      a.variantes.push({
        id: p.id,
        nombre: p.nombre,
        etiqueta: etiquetaVariante(valores, defs),
        valores,
        stockActual: p.stockActual,
        precioVenta: p.precioVenta,
        precioCosto: p.precioCosto,
        precioPropio: !!p.precioPropio,
        alertaStock: p.alertaStock ?? null,
      })
    }
    // Variantes en el orden de los atributos (S, M, L…)
    for (const a of map.values()) {
      const rango = (v: ArticuloVista['variantes'][number]) =>
        a.atributos.reduce((acc, d) => acc * 100 + Math.max(0, d.valores.indexOf(v.valores?.[d.nombre] ?? '')), 0)
      a.variantes.sort((x, y) => rango(x) - rango(y))
    }
    return Array.from(map.values())
  })()
  const sumaDe = (a: ArticuloVista) => a.variantes.reduce((acc, v) => ({
    unidades: acc.unidades + v.stockActual,
    valorizado: acc.valorizado + v.stockActual * v.precioCosto,
    ingresos: acc.ingresos + v.stockActual * v.precioVenta,
  }), { unidades: 0, valorizado: 0, ingresos: 0 })

  const q = busqueda.toLowerCase().trim()
  const articulosFiltrados = articulos.filter((a) =>
    !q || [a.nombre, a.marca || '', a.categoria || '', a.subcategoria || '', ...a.variantes.map((v) => v.etiqueta)].some((x) => x.toLowerCase().includes(q)),
  )
  const idsFiltrados = new Set(articulosFiltrados.flatMap((a) => a.variantes.map((v) => v.id)))
  const filtrados = productos.filter((p) => idsFiltrados.has(p.id))


  // Flujo de inventario del período, valorizado a lo que costó cada unidad
  // (el servidor reproduce los movimientos: Inicial + Comprado − Vendido = Final)
  const flujoPeriodo = productos.reduce((acc, p) => {
    const inicial = p.stockInicialPeriodo ?? 0
    const entradas = p.entradasPeriodo ?? 0
    const salidas = p.salidasPeriodo ?? 0
    acc.inventarioInicial += p.valorInicialPeriodo ?? 0
    acc.inventarioComprado += p.valorCompradoPeriodo ?? 0
    // Mismo CMV que el Estado de resultados
    acc.inventarioVendido += p.cmvPeriodo ?? 0
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
  const formatCard = (valor: number) => enUnidades ? `${fmtUnits(valor)} u.` : `$${fmtEntero(valor)}`
  const sinStock = productos.filter(p => p.stockActual <= 0).length
  const bajoStock = productos.filter(p => p.stockActual > 0 && p.stockActual <= (p.alertaStock ?? 2)).length
  const editingArt = editingId ? articulos.find((a) => a.key === editingId) ?? null : null
  const selectedArticulo = selectedProductoId ? articulos.find((a) => a.key === selectedProductoId) ?? null : null
  // Para el formulario: subcategorías por categoría, marcas y valores de atributos ya usados
  const subcategoriasPorCat: Record<string, string[]> = {}
  const valoresUsados: Record<string, string[]> = {}
  for (const a of articulos) {
    const cat = a.categoria?.trim() ?? ''
    if (a.subcategoria?.trim()) subcategoriasPorCat[cat] = Array.from(new Set([...(subcategoriasPorCat[cat] ?? []), a.subcategoria.trim()])).sort((x, y) => x.localeCompare(y, 'es'))
    for (const d of a.atributos) {
      const k = d.nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
      valoresUsados[k] = Array.from(new Set([...(valoresUsados[k] ?? []), ...d.valores]))
    }
  }
  const marcasExistentes = Array.from(new Set(productos.map((p) => p.marca?.trim()).filter((m): m is string => !!m))).sort((a, b) => a.localeCompare(b, 'es'))
  const aEditable = (a: ArticuloVista): ArticuloEditable => ({
    articuloId: a.articuloId,
    productoId: a.articuloId ? null : a.variantes[0]?.id ?? null,
    nombre: a.nombre,
    tipo: a.tipo,
    categoria: a.categoria,
    subcategoria: a.subcategoria,
    marca: a.marca,
    unidad: a.unidad,
    precioVenta: a.precioBase,
    atributos: a.atributos,
    variantes: a.variantes.map((v) => ({
      clave: claveVariante(v.valores), etiqueta: v.etiqueta, precioPropio: v.precioPropio,
      precioVenta: v.precioVenta, stock: v.stockActual, costo: v.precioCosto,
    })),
    fotoSrc: a.fotoSrc,
  })
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
    articulos: ArticuloVista[]
    unidades: number
    valorizado: number
    ingresos: number
    ganancia: number
  }
  const gruposInventario: GrupoInventario[] = (() => {
    const map = new Map<string, GrupoInventario>()
    for (const p of filtrados) {
      const key = (p.categoria?.trim() || 'Sin categoría')
      const g = map.get(key) ?? { categoria: key, productos: [], articulos: [], unidades: 0, valorizado: 0, ingresos: 0, ganancia: 0 }
      g.productos.push(p)
      g.unidades += p.stockActual
      g.valorizado += p.stockActual * p.precioCosto
      g.ingresos += p.stockActual * p.precioVenta
      g.ganancia += p.stockActual * (p.precioVenta - p.precioCosto)
      map.set(key, g)
    }
    for (const a of articulosFiltrados) {
      const g = map.get(a.categoria?.trim() || 'Sin categoría')
      if (g) g.articulos.push(a)
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

  return (
    <div className="space-y-6">
      {/* Segmentado iOS: unidades o valorizado */}
      <div className="inline-flex rounded-lg bg-black/[0.06] p-0.5 dark:bg-white/[0.1]" role="tablist" aria-label="Ver inventario en">
        {([['UNIDADES', 'Unidades'], ['PESOS', 'Valorizado']] as const).map(([valor, label]) => (
          <button
            key={valor}
            type="button"
            role="tab"
            aria-selected={vistaInventario === valor}
            onClick={() => setVistaInventario(valor)}
            className={`rounded-md px-3.5 py-1 text-[13px] transition ${vistaInventario === valor ? 'bg-white font-medium text-[#1C1C1E] shadow-[0_1px_3px_rgba(0,0,0,0.12)] dark:bg-[#636366] dark:text-white' : 'text-[#3C3C43] dark:text-[#EBEBF5]/70'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {([
          ['Inventario inicial', enUnidades ? inicialUnidades : inventarioInicial, 'text-[#1C1C1E] dark:text-white', null],
          ['Inventario vendido', enUnidades ? vendidoUnidades : inventarioVendido, 'text-[#B8664F] dark:text-[#E3A592]', '↓'],
          ['Inventario comprado', enUnidades ? compradoUnidades : inventarioComprado, 'text-[#4F8A6B] dark:text-[#8FC0A4]', '↑'],
          ['Stock final', enUnidades ? stockFinalUnidades : stockFinalPeriodo, 'text-[#1C1C1E] dark:text-white', null],
        ] as const).map(([titulo, valor, tono, flecha]) => (
          <div key={titulo} className="rounded-2xl bg-white px-4 py-3.5 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-[#1C1C1E] dark:shadow-none">
            <p className="text-[12px] text-[#8E8E93]">
              {titulo}
              {/* Sale stock / entra stock */}
              {flecha && <span className={`ml-1 text-[11px] ${tono}`} aria-hidden>{flecha}</span>}
            </p>
            <p className={`mt-0.5 text-[22px] font-semibold tracking-tight tabular-nums ${tono}`}>
              <AnimatedNumber key={vistaInventario} value={valor} desde={0} format={(v) => formatCard(v === valor ? v : Math.round(v))} />
            </p>
          </div>
        ))}
      </div>

      {/* Lo vendido a precio de venta (Estado de resultados) contra su costo: la ganancia bruta del período */}
      {ventasPeriodo > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-5 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-[#1C1C1E] dark:shadow-none">
          <div className="text-center">
            <p className="text-[11px] text-[#8E8E93]">Ventas</p>
            <p className="text-[15px] font-semibold tabular-nums text-[#1C1C1E] dark:text-white">${fmtEntero(ventasPeriodo)}</p>
          </div>
          <span className="text-[15px] text-[#C7C7CC]" aria-hidden>−</span>
          <div className="text-center">
            <p className="text-[11px] text-[#8E8E93]">Costo vendido</p>
            <p className="text-[15px] font-semibold tabular-nums text-[#1C1C1E] dark:text-white">${fmtEntero(inventarioVendido)}</p>
          </div>
          <span className="text-[15px] text-[#C7C7CC]" aria-hidden>=</span>
          <div className="text-center">
            <p className="text-[11px] text-[#8E8E93]">Ganancia bruta</p>
            <p className="text-[15px] font-semibold tabular-nums text-[#1C1C1E] dark:text-white">
              ${fmtEntero(ventasPeriodo - inventarioVendido)}
              <span className="ml-1 text-[10px] font-normal text-[#AEAEB2] dark:text-[#636366]">{Math.round(pctMargen(ventasPeriodo - inventarioVendido, ventasPeriodo))}%</span>
            </p>
          </div>
        </div>
      )}

      <div className="executive-panel overflow-clip">
        <div className="px-5 pb-1 pt-4">
          <div className="flex items-center gap-2">
            {/* Buscador estilo iOS */}
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-black/[0.05] px-3 py-2 dark:bg-white/[0.08]">
              <svg className="h-4 w-4 shrink-0 text-[#8E8E93]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" />
              </svg>
              <input
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar producto, categoría o marca"
                aria-label="Buscar producto"
                className="ios-bare w-full bg-transparent text-[14px] text-[#1C1C1E] outline-none placeholder:text-[#8E8E93] dark:text-white"
              />
              {busqueda && (
                <button type="button" onClick={() => setBusqueda('')} aria-label="Borrar búsqueda" className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#AEAEB2] text-white dark:bg-[#636366]">
                  <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setShowExportMenu(v => !v)}
                aria-label="Más opciones"
                title="Precios, subtotales, exportar o imprimir"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.05] text-[#3C3C43] transition active:scale-95 dark:bg-white/10 dark:text-white"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
              </button>
              {showExportMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} aria-hidden />
                  <div className="absolute right-0 top-full z-20 mt-1.5 min-w-[210px] overflow-hidden rounded-xl bg-white/95 py-1 shadow-[0_12px_40px_rgba(0,0,0,0.18)] ring-1 ring-black/[0.06] backdrop-blur-xl dark:bg-[#2C2C2E]/95 dark:ring-white/10">
                    <button type="button" onClick={() => { setShowExportMenu(false); setShowPrecios(true) }} className="flex w-full px-3.5 py-2 text-left text-[14px] text-[#1C1C1E] hover:bg-black/[0.05] dark:text-white dark:hover:bg-white/[0.08]">Actualizar precios</button>
                    <button type="button" onClick={() => { setShowExportMenu(false); setShowSubtotales(true) }} className="flex w-full px-3.5 py-2 text-left text-[14px] text-[#1C1C1E] hover:bg-black/[0.05] dark:text-white dark:hover:bg-white/[0.08]">Subtotales por categoría</button>
                    <div className="mx-3.5 my-1 h-px bg-black/[0.06] dark:bg-white/[0.08]" aria-hidden />
                    <button type="button" onClick={() => { setShowExportMenu(false); handleExportar() }} className="flex w-full px-3.5 py-2 text-left text-[14px] text-[#1C1C1E] hover:bg-black/[0.05] dark:text-white dark:hover:bg-white/[0.08]">Descargar Excel</button>
                    <button type="button" onClick={() => { setShowExportMenu(false); handleImprimir() }} className="flex w-full px-3.5 py-2 text-left text-[14px] text-[#1C1C1E] hover:bg-black/[0.05] dark:text-white dark:hover:bg-white/[0.08]">Imprimir</button>
                  </div>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => { setShowForm(true); setEditingId(null) }}
              aria-label="Nuevo producto"
              title="Nuevo producto"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#007AFF] text-white transition active:scale-95 dark:bg-[#0A84FF]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m7-7H5" /></svg>
            </button>
          </div>
        </div>

        {filtrados.length === 0 ? (
          // Vacío: sin productos todavía, o la búsqueda no encontró nada
          <div className="flex flex-col items-center px-4 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/[0.04] text-[#AEAEB2] dark:bg-white/[0.06]">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.4} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </span>
            {busqueda ? (
              <>
                <p className="mt-3 text-[15px] font-medium text-[#1C1C1E] dark:text-white">Sin resultados para “{busqueda}”</p>
                <button type="button" onClick={() => setBusqueda('')} className="mt-1 text-[14px] text-[#007AFF] dark:text-[#0A84FF]">Ver todos los productos</button>
              </>
            ) : (
              <>
                <p className="mt-3 text-[15px] font-medium text-[#1C1C1E] dark:text-white">Cargá tu primer producto</p>
                <p className="mt-0.5 text-[13px] text-[#8E8E93]">Vas a ver acá su stock, lo que vale y lo que ganarías.</p>
                <button
                  type="button"
                  onClick={() => { setShowForm(true); setEditingId(null) }}
                  className="mt-4 rounded-full bg-[#007AFF] px-4 py-2 text-[14px] font-medium text-white transition active:scale-95 dark:bg-[#0A84FF]"
                >
                  Nuevo producto
                </button>
              </>
            )}
          </div>
        ) : (
          <div id="inventario-tabla" className="overflow-x-auto lg:overflow-x-visible">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead>
                <tr className="text-[12px] text-[#8E8E93]">
                  {([
                    ['nombre', 'Producto', 'text-left w-[44%] px-5'],
                    ['unidades', 'Unidades', 'text-right px-4'],
                    ['valorizado', 'Valorizado', 'text-right px-4'],
                    ['proyeccion', 'Proyección del inventario', 'text-right pl-4 pr-10'],
                  ] as const).map(([col, label, cls]) => (
                    // Encabezado fijo al scrollear
                    <th key={col} className={`sticky top-0 z-10 border-b border-black/[0.06] bg-[var(--card)] py-2.5 font-medium dark:border-white/[0.08] dark:bg-[#111315] ${cls}`}>
                      <button
                        type="button"
                        onClick={() => ordenarPor(col)}
                        className={`inline-flex items-center gap-1 transition-colors hover:text-[#1C1C1E] dark:hover:text-white ${orden === col ? 'text-[#1C1C1E] dark:text-white' : ''}`}
                      >
                        {label}
                        {orden === col && col !== 'nombre' && <span aria-hidden>↓</span>}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              {/* key={orden}: al reordenar, las filas aparecen de nuevo con una transición suave */}
              <tbody key={orden}>
                {gruposInventario.map((grupo) => {
                  const cerrada = plegadas.has(grupo.categoria)
                  const valorDe = (a: ArticuloVista) => {
                    const t = sumaDe(a)
                    return orden === 'unidades' ? t.unidades : orden === 'valorizado' ? t.valorizado : orden === 'proyeccion' ? t.ingresos : 0
                  }
                  // Por nombre: agrupados por subcategoría; por valor: de mayor a menor
                  const articulosOrden = orden === 'nombre'
                    ? [...grupo.articulos].sort((a, b) => (a.subcategoria ?? '').localeCompare(b.subcategoria ?? '', 'es') || a.nombre.localeCompare(b.nombre, 'es'))
                    : [...grupo.articulos].sort((a, b) => valorDe(b) - valorDe(a))
                  return (
                    <React.Fragment key={grupo.categoria}>
                      {/* Categoría como título de sección (estilo Ajustes de iOS): se pliega al tocarla */}
                      <tr className="group-header cursor-pointer" onClick={() => togglePlegada(grupo.categoria)}>
                        <td className="px-5 pb-1.5 pt-5 text-[12px] font-medium text-[#8E8E93]">
                          <span className="inline-flex items-center gap-1.5">
                            <svg className={`h-3 w-3 transition-transform ${cerrada ? '' : 'rotate-90'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                            {grupo.categoria}
                          </span>
                        </td>
                        <td colSpan={3} />
                      </tr>

                      {!cerrada && articulosOrden.map((art, idx) => {
                        const t = sumaDe(art)
                        const ganancia = t.ingresos - t.valorizado
                        const multi = art.variantes.length > 1
                        const abierto = multi && abiertos.has(art.key)
                        // Subcategoría: subtítulo chico cuando cambia (solo ordenando por nombre)
                        const sub = orden === 'nombre' && art.subcategoria && art.subcategoria !== articulosOrden[idx - 1]?.subcategoria ? art.subcategoria : null
                        // Separador fino que no llega al borde izquierdo (no va en el último de la sección)
                        const sep = idx < articulosOrden.length - 1 && !abierto
                        const borde = sep ? 'border-b border-black/[0.05] dark:border-white/[0.06]' : ''
                        return (
                          <React.Fragment key={art.key}>
                            {sub && (
                              <tr>
                                <td colSpan={4} className="px-5 pb-0.5 pt-2 text-[11px] text-[#AEAEB2] dark:text-[#636366]">{sub}</td>
                              </tr>
                            )}
                            <tr
                              onClick={() => (multi ? toggleAbierto(art.key) : abrirFicha(art))}
                              aria-expanded={multi ? abierto : undefined}
                              className="group animate-[reg-fade-in_240ms_ease-out] cursor-pointer transition-colors hover:bg-black/[0.025] dark:hover:bg-white/[0.035]"
                            >
                              <td className="relative py-1.5 pl-5 pr-4">
                                <div className="flex items-center gap-2.5">
                                  <Foto src={art.fotoSrc} alt="" className="h-7 w-7 rounded-[7px]" />
                                  <div className="min-w-0">
                                    <div className="truncate text-[13px] text-[#1C1C1E] dark:text-white">
                                      {art.nombre}
                                      {art.marca?.trim() && <span className="ml-1.5 text-[11px] text-[#AEAEB2] dark:text-[#636366]">{art.marca.trim()}</span>}
                                    </div>
                                    {multi && <div className="truncate text-[11px] leading-tight text-[#AEAEB2] dark:text-[#636366]">{resumenAtributos(art.atributos)}</div>}
                                  </div>
                                </div>
                                {sep && <span aria-hidden className="absolute bottom-0 left-[60px] right-0 h-px bg-black/[0.05] dark:bg-white/[0.06]" />}
                              </td>
                              <td className={`px-4 py-1.5 text-right text-[13px] font-semibold tabular-nums text-[#1C1C1E] dark:text-white ${borde}`}>
                                {fmtUnits(t.unidades)} <span className="text-[12px] font-normal text-[#8E8E93]">{unidadDe(art.unidad, t.unidades)}</span>
                              </td>
                              <td className={`px-4 py-1.5 text-right text-[13px] font-semibold tabular-nums text-[#1C1C1E] dark:text-white ${borde}`}>
                                ${fmtEntero(t.valorizado)}
                              </td>
                              <td className={`relative py-1.5 pl-4 pr-10 text-right ${borde}`}>
                                <span title={`Ganarías $${fmtEntero(ganancia)} si vendés todo`} className="text-[12px] tabular-nums"><span className="text-[#8E8E93]">${fmtEntero(t.ingresos)}</span><span className="text-[#AEAEB2] dark:text-[#636366]"> · {pctMargen(ganancia, t.ingresos).toLocaleString('es-AR', { maximumFractionDigits: 0 })}%</span></span>
                                {/* Con variantes: se abre en la tabla; sin variantes: abre la ficha */}
                                <svg className={`absolute right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#C7C7CC] transition ${multi ? (abierto ? 'rotate-90' : '') : 'opacity-0 group-hover:opacity-100'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                              </td>
                            </tr>

                            {/* Variantes abiertas: cuadrícula talle × color, o una fila por variante */}
                            {abierto && art.atributos.length === 2 && (
                              <tr className="animate-[reg-fade-in_200ms_ease-out]">
                                <td colSpan={4} className={`pb-3 pl-[60px] pr-10 pt-1 ${idx < articulosOrden.length - 1 ? 'border-b border-black/[0.05] dark:border-white/[0.06]' : ''}`}>
                                  <div className="flex flex-wrap items-end gap-4">
                                    <div className="w-full max-w-[460px]">
                                      <StockGrid articulo={art} compacta onElegir={(v) => abrirFicha(art, v.id)} />
                                    </div>
                                    <button type="button" onClick={() => abrirFicha(art)} className="pb-1 text-[12px] text-[#007AFF] dark:text-[#0A84FF]">Ver ficha ›</button>
                                  </div>
                                </td>
                              </tr>
                            )}
                            {abierto && art.atributos.length !== 2 && art.variantes.map((v, vi) => {
                              const ultima = vi === art.variantes.length - 1
                              const bordeV = ultima && idx < articulosOrden.length - 1 ? 'border-b border-black/[0.05] dark:border-white/[0.06]' : ''
                              return (
                                <tr key={v.id} onClick={() => abrirFicha(art, v.id)} className="group/v animate-[reg-fade-in_200ms_ease-out] cursor-pointer transition-colors hover:bg-black/[0.025] dark:hover:bg-white/[0.035]">
                                  <td className={`py-1 pl-[60px] pr-4 text-[12px] text-[#3C3C43] dark:text-[#EBEBF5]/80 ${bordeV}`}>
                                    {v.etiqueta}
                                    {v.precioPropio && <span className="ml-1.5 text-[11px] tabular-nums text-[#007AFF] dark:text-[#0A84FF]">${fmtEntero(v.precioVenta)}</span>}
                                  </td>
                                  <td className={`px-4 py-1 text-right text-[12px] tabular-nums ${v.stockActual <= 0 ? 'text-[#AEAEB2]' : v.stockActual <= (v.alertaStock ?? 2) ? 'text-[#C93400] dark:text-[#FFB340]' : 'text-[#3C3C43] dark:text-[#EBEBF5]/80'} ${bordeV}`}>{fmtUnits(v.stockActual)}</td>
                                  <td className={`px-4 py-1 text-right text-[12px] tabular-nums text-[#8E8E93] ${bordeV}`}>${fmtEntero(v.stockActual * v.precioCosto)}</td>
                                  <td className={`py-1 pl-4 pr-10 text-right text-[12px] tabular-nums text-[#AEAEB2] dark:text-[#636366] ${bordeV}`}>${fmtEntero(v.stockActual * v.precioVenta)}</td>
                                </tr>
                              )
                            })}
                          </React.Fragment>
                        )
                      })}

                    </React.Fragment>
                  )
                })}
              </tbody>
              {/* Total liviano: línea arriba y semibold, sin franja */}
              <tfoot>
                <tr className="total-general-row">
                  <td className="border-t border-black/[0.08] px-5 py-3 text-[13px] font-semibold text-[#1C1C1E] dark:border-white/[0.1] dark:text-white">Total</td>
                  <td className="border-t border-black/[0.08] px-4 py-3 text-right text-[14px] font-semibold tabular-nums text-[#1C1C1E] dark:border-white/[0.1] dark:text-white">{fmtUnits(totalGeneral.unidades)}</td>
                  <td className="border-t border-black/[0.08] px-4 py-3 text-right text-[14px] font-semibold tabular-nums text-[#1C1C1E] dark:border-white/[0.1] dark:text-white">${fmtEntero(totalGeneral.valorizado)}</td>
                  <td className="border-t border-black/[0.08] py-3 pl-4 pr-10 text-right dark:border-white/[0.1]"><span title={`Ganarías $${fmtEntero(totalGeneral.ganancia)} si vendés todo`} className="text-[13px] tabular-nums"><span className="text-[#8E8E93]">${fmtEntero(totalGeneral.ingresos)}</span><span className="text-[#AEAEB2] dark:text-[#636366]"> · {pctMargen(totalGeneral.ganancia, totalGeneral.ingresos).toLocaleString('es-AR', { maximumFractionDigits: 0 })}%</span></span></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-black/[0.06] px-5 py-2.5 text-[12px] text-[#8E8E93] dark:border-white/[0.08]">
          <span>
            {articulosFiltrados.length} producto{articulosFiltrados.length !== 1 ? 's' : ''}
            {filtrados.length > articulosFiltrados.length && <span className="text-[#AEAEB2]"> · {filtrados.length} variantes</span>}
          </span>
          <span>{sinStock} sin stock · {bajoStock} con stock bajo</span>
        </div>
      </div>

      {showSubtotales && (
        <SubtotalesSheet
          // Todas las categorías (sin el filtro del buscador)
          grupos={Array.from(productos.reduce((map, p) => {
            const key = p.categoria?.trim() || 'Sin categoría'
            const g = map.get(key) ?? { categoria: key, productos: 0, unidades: 0, valorizado: 0, ingresos: 0, ganancia: 0 }
            g.productos += 1
            g.unidades += p.stockActual
            g.valorizado += p.stockActual * p.precioCosto
            g.ingresos += p.stockActual * p.precioVenta
            g.ganancia += p.stockActual * (p.precioVenta - p.precioCosto)
            return map.set(key, g)
          }, new Map<string, { categoria: string; productos: number; unidades: number; valorizado: number; ingresos: number; ganancia: number }>()).values())}
          onClose={() => setShowSubtotales(false)}
          onElegir={(cat) => {
            setShowSubtotales(false)
            setBusqueda(cat)
            document.getElementById('inventario-tabla')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
        />
      )}

      {/* ── Nuevo / editar artículo (hoja iOS) ── */}
      {showForm && (
        <ProductoForm
          key={editingId ?? 'nuevo'}
          articulo={editingArt ? aEditable(editingArt) : null}
          categorias={categoriasExistentes}
          subcategorias={subcategoriasPorCat}
          marcas={marcasExistentes}
          valoresUsados={valoresUsados}
          onClose={() => { setShowForm(false); setEditingId(null) }}
          onSaved={() => {
            const editando = !!editingId
            setShowForm(false); setEditingId(null)
            void reload()
            mostrarAviso(editando ? 'Cambios guardados' : 'Producto creado')
          }}
        />
      )}

      {showMovimientosModal && selectedArticulo && (
        <ProductoSheet
          key={selectedArticulo.key}
          articulo={selectedArticulo}
          movimientos={movimientos}
          varianteInicial={varianteInicial}
          onClose={() => setShowMovimientosModal(false)}
          onEdit={() => { setShowMovimientosModal(false); setEditingId(selectedArticulo.key); setShowForm(true) }}
          onDelete={() => handleDelete(selectedArticulo)}
          onChanged={() => { void reload(); void loadMovimientos(selectedArticulo.variantes.map((v) => v.id)) }}
        />
      )}

      {showPrecios && (
        <PreciosMasivoSheet
          productos={productos}
          onClose={() => setShowPrecios(false)}
          onDone={(n) => { setShowPrecios(false); void reload(); mostrarAviso(`Precios actualizados (${n})`) }}
        />
      )}

      {/* Aviso breve abajo */}
      {aviso && (
        <div className="reg-toast fixed bottom-6 left-1/2 z-[80] rounded-full bg-[#1C1C1E]/90 px-4 py-2 text-[13px] text-white shadow-lg backdrop-blur dark:bg-white/90 dark:text-[#1C1C1E]" role="status">
          {aviso}
        </div>
      )}

      {/* ── Estilos print-friendly para inventario ── */}
    </div>
  )
}