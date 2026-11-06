/**
 * Calendario del negocio en hora argentina (America/Argentina/Buenos_Aires).
 *
 * Módulo PURO (sin Prisma ni Next): lo usan las acciones de servidor y los tests.
 * Argentina es UTC-3 todo el año (sin horario de verano desde 2009), así que las
 * fechas se construyen con Date.UTC + 3 h y nunca dependen de la zona horaria del
 * servidor (en Vercel el servidor corre en UTC).
 */

export const BUSINESS_TZ = 'America/Argentina/Buenos_Aires'

const ART_OFFSET_MS = 3 * 60 * 60 * 1000

/** Instante real (UTC) de una fecha/hora de calendario en Argentina. monthIndex es 0-11. */
function artInstant(year: number, monthIndex: number, day: number, h = 0, mi = 0, s = 0, ms = 0): Date {
  return new Date(Date.UTC(year, monthIndex, day, h, mi, s, ms) + ART_OFFSET_MS)
}

export const artStartOfDay = (year: number, monthIndex: number, day: number) => artInstant(year, monthIndex, day)
export const artEndOfDay = (year: number, monthIndex: number, day: number) => artInstant(year, monthIndex, day, 23, 59, 59, 999)

/** Partes de calendario de un instante, vistas desde Argentina (ART = UTC − 3 h). */
export function getArtCalendarParts(date: Date = new Date()): { year: number; monthIndex: number; day: number; dayOfWeek: number } {
  const shifted = new Date(date.getTime() - ART_OFFSET_MS)
  return {
    year: shifted.getUTCFullYear(),
    monthIndex: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    dayOfWeek: shifted.getUTCDay(),
  }
}

/** "yyyy-mm-dd" → partes de calendario (sin interpretación UTC local). */
function parseArtDay(dateStr: string): { year: number; monthIndex: number; day: number } {
  const [y, m, d] = dateStr.split('-').map(Number)
  return { year: y, monthIndex: m - 1, day: d }
}

/** Días que tiene un mes (monthIndex 0-11). */
const artDaysInMonth = (year: number, monthIndex: number) => new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()

/** Vencimiento de una deuda/crédito cargado como fecha sin hora: vale todo el día en Argentina. */
export function dueDateEndOfDay(dateStr: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return new Date(dateStr)
  const { year, monthIndex, day } = parseArtDay(dateStr)
  return artEndOfDay(year, monthIndex, day)
}

export type DashboardPeriodKey = 'diario' | 'semanal' | 'mensual' | 'anual' | 'custom'

const PERIOD_KEYS: readonly DashboardPeriodKey[] = ['diario', 'semanal', 'mensual', 'anual', 'custom']
/** Años que se aceptan en la URL: evita rangos absurdos (consultas enormes) y fechas inválidas */
const MIN_YEAR = 1970
const MAX_YEARS_AHEAD = 10
/** Un rango personalizado no puede pasar de 10 años */
const MAX_CUSTOM_RANGE_MS = 10 * 366 * 24 * 60 * 60 * 1000

export type PeriodParams = {
  period: DashboardPeriodKey
  customFrom?: string
  customTo?: string
  selectedYear?: number
  selectedMonth?: number
  selectedDay?: string
  selectedWeekStart?: string
}

const validYear = (year: number) =>
  Number.isInteger(year) && year >= MIN_YEAR && year <= getArtCalendarParts().year + MAX_YEARS_AHEAD

/** "yyyy-mm-dd" que existe en el calendario (no 2026-02-31) y con un año razonable */
function validDayString(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const { year, monthIndex, day } = parseArtDay(value)
  if (!validYear(year) || monthIndex < 0 || monthIndex > 11) return false
  return day >= 1 && day <= artDaysInMonth(year, monthIndex)
}

/**
 * Limpia los parámetros de período que llegan de la URL (o de una acción del cliente).
 * Lo válido queda igual; lo inválido se descarta y se usa el valor por defecto, así nunca
 * se consulta la base con fechas "NaN" o rangos gigantes.
 */
export function sanitizePeriodParams(input: {
  period?: unknown
  customFrom?: unknown
  customTo?: unknown
  selectedYear?: unknown
  selectedMonth?: unknown
  selectedDay?: unknown
  selectedWeekStart?: unknown
}): PeriodParams {
  const period = PERIOD_KEYS.includes(input.period as DashboardPeriodKey) ? input.period as DashboardPeriodKey : 'mensual'
  const year = typeof input.selectedYear === 'string' ? Number(input.selectedYear) : input.selectedYear
  const month = typeof input.selectedMonth === 'string' ? Number(input.selectedMonth) : input.selectedMonth
  let customFrom = validDayString(input.customFrom) ? input.customFrom : undefined
  let customTo = validDayString(input.customTo) ? input.customTo : undefined
  // Desde y hasta al revés: se dan vuelta en vez de devolver un rango vacío
  if (customFrom && customTo && customFrom > customTo) [customFrom, customTo] = [customTo, customFrom]
  if (customFrom && customTo) {
    const a = parseArtDay(customFrom), b = parseArtDay(customTo)
    if (Date.UTC(b.year, b.monthIndex, b.day) - Date.UTC(a.year, a.monthIndex, a.day) > MAX_CUSTOM_RANGE_MS) {
      customFrom = undefined
      customTo = undefined
    }
  }
  return {
    period,
    customFrom,
    customTo,
    selectedYear: typeof year === 'number' && validYear(year) ? year : undefined,
    selectedMonth: typeof month === 'number' && Number.isInteger(month) && month >= 1 && month <= 12 ? month : undefined,
    selectedDay: validDayString(input.selectedDay) ? input.selectedDay : undefined,
    selectedWeekStart: validDayString(input.selectedWeekStart) ? input.selectedWeekStart : undefined,
  }
}

/** Rango [from, to] y período anterior [prevFrom, prevTo], siempre en calendario argentino. */
export function computePeriodRange(
  period: DashboardPeriodKey,
  customFrom?: string,
  customTo?: string,
  selectedYear?: number,
  selectedMonth?: number,
  selectedDay?: string,
  selectedWeekStart?: string,
): { from: Date; to: Date; prevFrom: Date; prevTo: Date; label: string } {
  // Única puerta de entrada de todas las pestañas: los parámetros inválidos se descartan acá
  ;({ period, customFrom, customTo, selectedYear, selectedMonth, selectedDay, selectedWeekStart } =
    sanitizePeriodParams({ period, customFrom, customTo, selectedYear, selectedMonth, selectedDay, selectedWeekStart }))
  const today = getArtCalendarParts()
  const fmtDay = (d: Date) => d.toLocaleDateString('es-AR', { timeZone: BUSINESS_TZ, day: '2-digit', month: 'short' })
  let from: Date, to: Date, prevFrom: Date, prevTo: Date, label: string

  switch (period) {
    case 'diario': {
      const target = selectedDay ? parseArtDay(selectedDay) : today
      from = artStartOfDay(target.year, target.monthIndex, target.day)
      to = artEndOfDay(target.year, target.monthIndex, target.day)
      const prev = new Date(Date.UTC(target.year, target.monthIndex, target.day - 1))
      prevFrom = artStartOfDay(prev.getUTCFullYear(), prev.getUTCMonth(), prev.getUTCDate())
      prevTo = artEndOfDay(prev.getUTCFullYear(), prev.getUTCMonth(), prev.getUTCDate())
      const isToday = target.year === today.year && target.monthIndex === today.monthIndex && target.day === today.day
      label = isToday
        ? 'Hoy'
        : from.toLocaleDateString('es-AR', { timeZone: BUSINESS_TZ, day: '2-digit', month: 'long', year: 'numeric' })
      break
    }
    case 'semanal': {
      let start: { year: number; monthIndex: number; day: number }
      if (selectedWeekStart) {
        start = parseArtDay(selectedWeekStart)
      } else {
        const mondayOffset = today.dayOfWeek === 0 ? -6 : 1 - today.dayOfWeek
        const monday = new Date(Date.UTC(today.year, today.monthIndex, today.day + mondayOffset))
        start = { year: monday.getUTCFullYear(), monthIndex: monday.getUTCMonth(), day: monday.getUTCDate() }
      }
      const endDay = new Date(Date.UTC(start.year, start.monthIndex, start.day + 6))
      const prevStart = new Date(Date.UTC(start.year, start.monthIndex, start.day - 7))
      const prevEnd = new Date(Date.UTC(start.year, start.monthIndex, start.day - 1))
      from = artStartOfDay(start.year, start.monthIndex, start.day)
      to = artEndOfDay(endDay.getUTCFullYear(), endDay.getUTCMonth(), endDay.getUTCDate())
      prevFrom = artStartOfDay(prevStart.getUTCFullYear(), prevStart.getUTCMonth(), prevStart.getUTCDate())
      prevTo = artEndOfDay(prevEnd.getUTCFullYear(), prevEnd.getUTCMonth(), prevEnd.getUTCDate())
      label = `${fmtDay(from)} – ${fmtDay(to)}`
      break
    }
    case 'mensual': {
      const targetYear = selectedYear ?? today.year
      const targetMonthIndex = (selectedMonth ?? (today.monthIndex + 1)) - 1
      const isCurrentMonth = targetYear === today.year && targetMonthIndex === today.monthIndex

      from = artStartOfDay(targetYear, targetMonthIndex, 1)
      to = isCurrentMonth
        ? artEndOfDay(today.year, today.monthIndex, today.day)
        : artEndOfDay(targetYear, targetMonthIndex, artDaysInMonth(targetYear, targetMonthIndex))
      const prevMonth = new Date(Date.UTC(targetYear, targetMonthIndex - 1, 1))
      const prevYear = prevMonth.getUTCFullYear()
      const prevMonthIndex = prevMonth.getUTCMonth()
      prevFrom = artStartOfDay(prevYear, prevMonthIndex, 1)
      prevTo = isCurrentMonth
        ? artEndOfDay(prevYear, prevMonthIndex, Math.min(today.day, artDaysInMonth(prevYear, prevMonthIndex)))
        : artEndOfDay(prevYear, prevMonthIndex, artDaysInMonth(prevYear, prevMonthIndex))
      label = from.toLocaleDateString('es-AR', { timeZone: BUSINESS_TZ, month: 'long', year: 'numeric' })
      label = label.charAt(0).toUpperCase() + label.slice(1)
      break
    }
    case 'anual': {
      const targetYear = selectedYear ?? today.year
      const isCurrentYear = targetYear === today.year
      from = artStartOfDay(targetYear, 0, 1)
      to = isCurrentYear
        ? artEndOfDay(today.year, today.monthIndex, today.day)
        : artEndOfDay(targetYear, 11, 31)
      prevFrom = artStartOfDay(targetYear - 1, 0, 1)
      prevTo = isCurrentYear
        ? artEndOfDay(targetYear - 1, today.monthIndex, today.day)
        : artEndOfDay(targetYear - 1, 11, 31)
      label = `Año ${targetYear}`
      break
    }
    case 'custom': {
      from = customFrom
        ? artStartOfDay(...Object.values(parseArtDay(customFrom)) as [number, number, number])
        : artStartOfDay(today.year, today.monthIndex, 1)
      to = customTo
        ? artEndOfDay(...Object.values(parseArtDay(customTo)) as [number, number, number])
        : artEndOfDay(today.year, today.monthIndex, today.day)
      const durationMs = to.getTime() - from.getTime()
      prevTo = new Date(from.getTime() - 1)
      prevFrom = new Date(prevTo.getTime() - durationMs)
      label = `${fmtDay(from)} – ${fmtDay(to)}`
      break
    }
  }

  return { from, to, prevFrom, prevTo, label }
}
