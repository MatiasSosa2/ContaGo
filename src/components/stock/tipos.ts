import type { AtributoDef, ValoresVariante } from '@/lib/variantes'

/** Una variante (es un Producto: tiene stock, costo y precio propios) */
export type VarianteVista = {
  id: string
  nombre: string
  /** "Negra · M" ('' si el artículo no tiene variantes) */
  etiqueta: string
  valores: ValoresVariante | null
  stockActual: number
  precioVenta: number
  precioCosto: number
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
