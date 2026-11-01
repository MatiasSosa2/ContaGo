/**
 * Cotización del dólar para unificar importes multi-moneda en pesos.
 *
 * Fuente externa: DolarAPI (https://dolarapi.com/v1/dolares/oficial), la API
 * pública que consumen los sitios argentinos de cotización. Se cachea 5 minutos
 * vía `next.revalidate`. Si la API no responde, se usa la última cotización que
 * el negocio registró en un cambio de caja; si tampoco hay, los agregados
 * omiten la conversión en vez de mezclar monedas.
 */

export type FxRate = {
  /** Pesos por dólar */
  rate: number
  source: 'dolarapi' | 'registrada'
}

const DOLAR_API_URL = 'https://dolarapi.com/v1/dolares/oficial'

/** Dólar oficial (punta vendedora) según DolarAPI. null si la API falla o responde algo inválido. */
export async function fetchDolarOficial(fetchImpl: typeof fetch = fetch): Promise<number | null> {
  try {
    const res = await fetchImpl(DOLAR_API_URL, { next: { revalidate: 300 } } as RequestInit)
    if (!res.ok) return null
    const data: unknown = await res.json()
    const venta = (data as { venta?: unknown } | null)?.venta
    return typeof venta === 'number' && Number.isFinite(venta) && venta > 0 ? venta : null
  } catch {
    return null
  }
}

/** Última cotización (pesos por dólar) registrada por el negocio en un cambio de caja hasta `asOf`. */
export async function getLastBusinessRate(businessId: string, asOf: Date = new Date()): Promise<number | null> {
  // Import dinámico: las funciones puras del módulo deben poder testearse sin base de datos
  const { default: prisma } = await import('@/lib/prisma')
  const t = await prisma.cashTransfer.findFirst({
    where: { businessId, exchangeRate: { not: null }, date: { lte: asOf } },
    orderBy: { date: 'desc' },
    select: { exchangeRate: true },
  })
  return t?.exchangeRate && t.exchangeRate > 0 ? t.exchangeRate : null
}

/**
 * Pesos por dólar a usar para agregados:
 * - Sin fecha de corte (valores actuales): prioriza el oficial actual de DolarAPI.
 * - Con corte histórico: prioriza la última cotización registrada hasta esa fecha
 *   (el oficial de hoy no describe ese pasado) y solo cae a DolarAPI si nunca se
 *   registró una cotización.
 */
export async function getArsRate(businessId: string, asOf?: Date): Promise<FxRate | null> {
  if (asOf) {
    const registrada = await getLastBusinessRate(businessId, asOf)
    if (registrada) return { rate: registrada, source: 'registrada' }
    const oficial = await fetchDolarOficial()
    return oficial ? { rate: oficial, source: 'dolarapi' } : null
  }
  const oficial = await fetchDolarOficial()
  if (oficial) return { rate: oficial, source: 'dolarapi' }
  const registrada = await getLastBusinessRate(businessId)
  return registrada ? { rate: registrada, source: 'registrada' } : null
}

/** Convierte a pesos. Monedas distintas de USD ya están en pesos. Sin cotización: 0 (nunca mezclar). */
export function toArs(amount: number, currency: string, rate: number | null): number {
  if (currency !== 'USD') return amount
  return rate !== null ? amount * rate : 0
}
