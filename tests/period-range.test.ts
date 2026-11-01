import assert from 'node:assert/strict'
import test from 'node:test'
import { computePeriodRange, dueDateEndOfDay, getArtCalendarParts } from '../src/lib/art-calendar'

// Argentina es UTC-3: el día 2026-10-31 empieza 03:00 UTC y termina 02:59:59.999 UTC del
// día siguiente, sin importar la zona horaria del servidor (Vercel corre en UTC).

test('diario: el día seleccionado cubre exactamente ese día en hora argentina', () => {
  const { from, to, prevFrom, prevTo, label } = computePeriodRange('diario', undefined, undefined, undefined, undefined, '2026-10-31')

  assert.equal(from.toISOString(), '2026-10-31T03:00:00.000Z')
  assert.equal(to.toISOString(), '2026-11-01T02:59:59.999Z')
  assert.equal(prevFrom.toISOString(), '2026-10-30T03:00:00.000Z')
  assert.equal(prevTo.toISOString(), '2026-10-31T02:59:59.999Z')
  assert.notEqual(label, 'Hoy')
})

test('mensual: un mes pasado cubre del 1 al último día en hora argentina', () => {
  const { from, to, prevFrom, prevTo } = computePeriodRange('mensual', undefined, undefined, 2026, 2)

  assert.equal(from.toISOString(), '2026-02-01T03:00:00.000Z')
  assert.equal(to.toISOString(), '2026-03-01T02:59:59.999Z')
  assert.equal(prevFrom.toISOString(), '2026-01-01T03:00:00.000Z')
  assert.equal(prevTo.toISOString(), '2026-02-01T02:59:59.999Z')
})

test('mensual: el mes actual cierra hoy y el anterior se recorta al mismo día', () => {
  const today = getArtCalendarParts()
  const { from, to, prevTo } = computePeriodRange('mensual')

  assert.equal(from.getTime(), new Date(Date.UTC(today.year, today.monthIndex, 1, 3)).getTime())
  assert.equal(to.getTime(), new Date(Date.UTC(today.year, today.monthIndex, today.day, 26, 59, 59, 999)).getTime())
  // El período anterior nunca supera el mismo día del mes previo
  assert.ok(prevTo.getTime() < from.getTime())
})

test('anual: un año pasado cubre el año completo en hora argentina', () => {
  const { from, to, prevFrom, prevTo } = computePeriodRange('anual', undefined, undefined, 2025)

  assert.equal(from.toISOString(), '2025-01-01T03:00:00.000Z')
  assert.equal(to.toISOString(), '2026-01-01T02:59:59.999Z')
  assert.equal(prevFrom.toISOString(), '2024-01-01T03:00:00.000Z')
  assert.equal(prevTo.toISOString(), '2025-01-01T02:59:59.999Z')
})

test('semanal: la semana seleccionada cubre 7 días desde el lunes en hora argentina', () => {
  // 2026-10-26 es lunes
  const { from, to, prevFrom, prevTo } = computePeriodRange('semanal', undefined, undefined, undefined, undefined, undefined, '2026-10-26')

  assert.equal(from.toISOString(), '2026-10-26T03:00:00.000Z')
  assert.equal(to.toISOString(), '2026-11-02T02:59:59.999Z')
  assert.equal(prevFrom.toISOString(), '2026-10-19T03:00:00.000Z')
  assert.equal(prevTo.toISOString(), '2026-10-26T02:59:59.999Z')
})

test('custom: los límites son el inicio y fin de esos días en hora argentina', () => {
  const { from, to, prevFrom, prevTo } = computePeriodRange('custom', '2026-10-01', '2026-10-15')

  assert.equal(from.toISOString(), '2026-10-01T03:00:00.000Z')
  assert.equal(to.toISOString(), '2026-10-16T02:59:59.999Z')
  assert.ok(prevFrom.getTime() < prevTo.getTime())
  assert.ok(prevTo.getTime() < from.getTime())
})

test('dueDateEndOfDay: el vencimiento vale hasta el fin del día en Argentina', () => {
  // Antes vencía a medianoche UTC = 21:00 del día anterior en Argentina
  assert.equal(dueDateEndOfDay('2026-10-31').toISOString(), '2026-11-01T02:59:59.999Z')
})

test('getArtCalendarParts: un instante UTC puede ser otro día calendario en Argentina', () => {
  // 2026-11-01 02:31 UTC = 2026-10-31 23:31 en Argentina
  const parts = getArtCalendarParts(new Date('2026-11-01T02:31:00.000Z'))
  assert.deepEqual(
    { year: parts.year, monthIndex: parts.monthIndex, day: parts.day },
    { year: 2026, monthIndex: 9, day: 31 },
  )
})
