/**
 * Costos del inventario: costo promedio (lo calcula el sistema con cada compra) o costo fijo
 * (lo carga el usuario y vale desde la fecha en que lo cambia). Funciones puras: las usan
 * Inventario, el Estado patrimonial, el Estado de resultados y el registro de operaciones.
 */

/** Sobrante o faltante cargado a mano: va al resultado, no al costo de lo vendido */
export const DIF_INVENTARIO = 'DIFERENCIA_INVENTARIO'
/** Movimiento de cambio de costo (cantidad 0; precio = costo unitario nuevo) */
export const REVALUACION = 'REVALUACION'

/** Costo con el que se valoriza hoy el producto: el fijo si hay, si no el promedio */
export const costoEfectivo = (p: { costoFijo?: number | null; precioCosto?: number | null }) =>
  p.costoFijo ?? p.precioCosto ?? 0

export type MovValuable = {
  tipo: string
  concepto?: string | null
  cantidad: number
  precio: number
  costoUnitario: number | null
}

export type EstadoStock = { stock: number; valor: number }

export type EfectoMovimiento = {
  /** Unidades y valor que entran por compra (sin diferencias de inventario) */
  compraU: number
  compra$: number
  /** Unidades y costo que salen por venta (costo de lo vendido) */
  ventaU: number
  venta$: number
  /** Sobrante (+) o faltante (−) cargado a mano */
  difU: number
  dif$: number
  /** Cambio de valor del stock por cambiar el costo unitario */
  reval$: number
  /** Ajuste viejo (la cantidad era el stock resultante) */
  ajusteU: number
}

/**
 * Aplica un movimiento al stock y valor de un producto (en orden cronológico).
 * - Entradas: al costo guardado (costo fijo del momento) o, si no, al precio de compra.
 * - Salidas: al costo guardado del momento (promedio o fijo).
 * - Revaluación: todo el stock pasa a valer el costo nuevo.
 */
export function aplicarMovimiento(e: EstadoStock, m: MovValuable, costoSinStock: number): EfectoMovimiento {
  const ef: EfectoMovimiento = { compraU: 0, compra$: 0, ventaU: 0, venta$: 0, difU: 0, dif$: 0, reval$: 0, ajusteU: 0 }
  const cpp = e.stock > 0 ? e.valor / e.stock : costoSinStock
  const esDif = m.concepto === DIF_INVENTARIO
  if (m.tipo === 'ENTRADA') {
    const costo = m.costoUnitario ?? (m.precio > 0 ? m.precio : cpp)
    e.stock += m.cantidad
    e.valor += m.cantidad * costo
    if (esDif) { ef.difU += m.cantidad; ef.dif$ += m.cantidad * costo }
    else { ef.compraU += m.cantidad; ef.compra$ += m.cantidad * costo }
  } else if (m.tipo === 'SALIDA') {
    const costo = m.costoUnitario ?? cpp
    e.stock -= m.cantidad
    e.valor -= m.cantidad * costo
    if (esDif) { ef.difU -= m.cantidad; ef.dif$ -= m.cantidad * costo }
    else { ef.ventaU += m.cantidad; ef.venta$ += m.cantidad * costo }
  } else if (m.tipo === REVALUACION) {
    const antes = e.valor
    e.valor = Math.max(0, e.stock) * m.precio
    ef.reval$ = e.valor - antes
  } else {
    // Ajuste viejo: la cantidad es el stock resultante
    ef.ajusteU = m.cantidad - e.stock
    e.stock = m.cantidad
    e.valor = m.cantidad * cpp
  }
  return ef
}

/** Variación de unidades de un movimiento (para reconstruir el stock a una fecha) */
export const deltaUnidades = (m: { tipo: string; cantidad: number }) =>
  m.tipo === 'ENTRADA' ? m.cantidad : m.tipo === 'SALIDA' ? -m.cantidad : 0
