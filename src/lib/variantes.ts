/**
 * Artículos con variantes (talle, color, tamaño, puffs…). Cada variante es un Producto con
 * su stock; el artículo las agrupa. Funciones puras: las usan el servidor y los formularios.
 */

export type AtributoDef = { nombre: string; valores: string[] }
export type ValoresVariante = Record<string, string>

const TALLES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '2XL', '3XL', '4XL']
const rangoTalle = (v: string) => TALLES.indexOf(v.trim().toUpperCase())
/** Número al principio del valor: "30.000 puff" → 30000, "1,2 L" → 1.2 */
function numeroDe(v: string): number | null {
  const m = v.trim().match(/^\d[\d.]*(,\d+)?/)
  if (!m) return null
  const txt = m[0]
  // "30.000" con punto de miles; "1.5" con punto decimal
  const n = /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(txt) ? Number(txt.replace(/\./g, '').replace(',', '.')) : Number(txt.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/**
 * Orden natural de los valores: talles (XS, S, M, L, XL), números con la misma unidad
 * y si no, el orden en que se cargaron.
 */
export function ordenarValores(valores: string[]): string[] {
  if (valores.length > 1 && valores.every((v) => rangoTalle(v) >= 0)) {
    return [...valores].sort((a, b) => rangoTalle(a) - rangoTalle(b))
  }
  // Números con la misma unidad: 10.000 puff < 30.000 puff (890 ml y 1,2 L quedan como se cargaron)
  const unidad = (v: string) => v.trim().replace(/^\d[\d.]*(,\d+)?/, '').trim().toLowerCase()
  if (valores.length > 1 && valores.every((v) => numeroDe(v) !== null && unidad(v) === unidad(valores[0]))) {
    return [...valores].sort((a, b) => (numeroDe(a) ?? 0) - (numeroDe(b) ?? 0))
  }
  return valores
}

/** ¿Es un atributo de talles? (para la cuadrícula talle × color) */
export const esDeTalles = (a: AtributoDef) => a.valores.length > 0 && a.valores.every((v) => rangoTalle(v) >= 0 || /^\d{1,2}$/.test(v.trim()))

export function parseAtributos(json: string | null | undefined): AtributoDef[] {
  if (!json) return []
  try {
    const data = JSON.parse(json)
    if (!Array.isArray(data)) return []
    return data
      .filter((a) => a && typeof a.nombre === 'string' && Array.isArray(a.valores))
      .map((a) => ({ nombre: String(a.nombre), valores: (a.valores as unknown[]).map(String) }))
  } catch {
    return []
  }
}

export function parseValores(json: string | null | undefined): ValoresVariante | null {
  if (!json) return null
  try {
    const data = JSON.parse(json)
    return data && typeof data === 'object' && !Array.isArray(data) ? (data as ValoresVariante) : null
  } catch {
    return null
  }
}

/** Limpia la definición: sin vacíos ni repetidos, valores ordenados */
export function normalizarAtributos(defs: AtributoDef[]): AtributoDef[] {
  const vistos = new Set<string>()
  const out: AtributoDef[] = []
  for (const d of defs) {
    const nombre = d.nombre.trim().slice(0, 30)
    if (!nombre || vistos.has(nombre.toLowerCase())) continue
    const vals = Array.from(new Map(d.valores.map((v) => v.trim().slice(0, 40)).filter(Boolean).map((v) => [v.toLowerCase(), v])).values())
    if (vals.length === 0) continue
    vistos.add(nombre.toLowerCase())
    out.push({ nombre, valores: ordenarValores(vals) })
  }
  return out
}

/** Todas las combinaciones: Talle [S, M] × Color [Negra] → {Talle:S,Color:Negra}, {Talle:M,Color:Negra} */
export function combinaciones(defs: AtributoDef[]): ValoresVariante[] {
  let out: ValoresVariante[] = [{}]
  for (const d of defs) {
    const next: ValoresVariante[] = []
    for (const parcial of out) for (const v of d.valores) next.push({ ...parcial, [d.nombre]: v })
    out = next
  }
  return defs.length === 0 ? [] : out
}

/** Clave estable de una variante (independiente del orden de las claves) */
export const claveVariante = (v: ValoresVariante | null) =>
  v ? Object.keys(v).sort().map((k) => `${k.toLowerCase()}=${v[k].toLowerCase()}`).join('|') : ''

/** "Negra · M" (en el orden de los atributos del artículo) */
export function etiquetaVariante(v: ValoresVariante | null, defs?: AtributoDef[]): string {
  if (!v) return ''
  const orden = defs?.map((d) => d.nombre) ?? Object.keys(v)
  return orden.filter((k) => v[k]).map((k) => v[k]).join(' · ')
}

/** Nombre completo de la variante, el que se ve en ventas e informes: "Remera Oversize · Negra · M" */
export const nombreVariante = (articulo: string, v: ValoresVariante | null, defs?: AtributoDef[]) => {
  const e = etiquetaVariante(v, defs)
  return e ? `${articulo} · ${e}` : articulo
}

/** Resumen corto para la lista: "3 colores · 4 talles" */
export function resumenAtributos(defs: AtributoDef[]): string {
  return defs.map((d) => `${d.valores.length} ${d.nombre.toLowerCase()}${d.valores.length === 1 || /s$/i.test(d.nombre) ? '' : /[aeiou]$/i.test(d.nombre) ? 's' : 'es'}`).join(' · ')
}
