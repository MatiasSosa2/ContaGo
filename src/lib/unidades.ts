const UNIDAD_CORTA: Record<string, string> = { unidad: 'u.', u: 'u.', m3: 'm³', 'm³': 'm³', m2: 'm²', kg: 'kg', g: 'g', m: 'm', l: 'l', lt: 'l', litro: 'l' }

/** Unidad de medida legible: "bolsa" → "bolsas" cuando hay más de una; abreviaturas (u., m³, kg) quedan igual */
export function unidadDe(unidad: string | null | undefined, cantidad: number) {
  const u = (unidad ?? 'unidad').trim().toLowerCase()
  if (UNIDAD_CORTA[u]) return UNIDAD_CORTA[u]
  if (cantidad === 1 || u.endsWith('s')) return u
  return /[aeiou]$/.test(u) ? `${u}s` : `${u}es`
}
