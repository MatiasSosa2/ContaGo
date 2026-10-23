import type { AtributoDef, ValoresVariante } from '@/lib/variantes'

/** Una variante (es un Producto: tiene stock, costo y precio propios) */
export type VarianteVista = {
  id: string
  nombre: string
  /** "Negra · M" ('' si el artículo no tiene variantes) */
  etiqueta: string
  valores: ValoresVariante | null
  /** Stock al cierre del período que se mira */
  stockActual: number
  /** Stock de hoy (para corregirlo) */
  stockHoy: number
  precioVenta: number
  /** Costo unitario al cierre del período (fijo o promedio de ese momento) */
  precioCosto: number
  /** Costo promedio que calcula el sistema (hoy) */
  costoPromedio: number
  /** Costo unitario fijado a mano (hoy); null = usa el promedio */
  costoFijo: number | null
  precioPropio: boolean
  alertaStock: number | null
}

/** Artículo con sus variantes, como se ve en Inventario */
export type ArticuloVista = {
  /** articuloId o, si es un producto suelto, su id */
  key: string
  articuloId: string | null
  nombre: string
  marca: string | null
  categoria: string | null
  subcategoria: string | null
  unidad: string
  tipo: 'MERCADERIA' | 'SERVICIO'
  precioBase: number
  atributos: AtributoDef[]
  fotoSrc: string | null
  variantes: VarianteVista[]
}
