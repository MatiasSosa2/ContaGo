import assert from 'node:assert/strict'
import test from 'node:test'
import {
  decimalToMinorUnits,
  minorUnitsToDecimalString,
} from '../src/lib/money'

test('converts amounts using currency-specific exponents', () => {
  assert.equal(decimalToMinorUnits('1234.56', 2), BigInt(123456))
  assert.equal(decimalToMinorUnits('1234', 0), BigInt(1234))
  assert.equal(decimalToMinorUnits('1234.567', 3), BigInt(1234567))
})

test('rounds half away from zero at the currency exponent', () => {
  assert.equal(decimalToMinorUnits('1.005', 2), BigInt(101))
  assert.equal(decimalToMinorUnits('-1.005', 2), BigInt(-101))
  assert.equal(decimalToMinorUnits('1.0049', 2), BigInt(100))
  assert.equal(decimalToMinorUnits('-1.0049', 2), BigInt(-100))
})

test('rounds each line before exact integer totals are added', () => {
  const lines = ['1.005', '1.005'].map((line) => decimalToMinorUnits(line, 2))

  assert.deepEqual(lines, [BigInt(101), BigInt(101)])
  assert.equal(lines.reduce((total, line) => total + line, BigInt(0)), BigInt(202))
})

test('converts minor units to a canonical decimal string', () => {
  assert.equal(minorUnitsToDecimalString(BigInt(123456), 2), '1234.56')
  assert.equal(minorUnitsToDecimalString(BigInt(1234), 0), '1234')
  assert.equal(minorUnitsToDecimalString(BigInt(1234567), 3), '1234.567')
  assert.equal(minorUnitsToDecimalString(BigInt(100), 2), '1')
  assert.equal(minorUnitsToDecimalString(BigInt(1), 2), '0.01')
  assert.equal(minorUnitsToDecimalString(BigInt(-1), 2), '-0.01')
})

test('roundtrips signed 64-bit boundary values', () => {
  const max = BigInt('9223372036854775807')
  const min = BigInt('-9223372036854775808')

  assert.equal(decimalToMinorUnits(max.toString(), 0), max)
  assert.equal(decimalToMinorUnits(min.toString(), 0), min)
  assert.equal(minorUnitsToDecimalString(max, 0), max.toString())
  assert.equal(minorUnitsToDecimalString(min, 0), min.toString())
})

test('rejects invalid decimal strings and exponents', () => {
  assert.throws(() => decimalToMinorUnits('1e3', 2), TypeError)
  assert.throws(() => decimalToMinorUnits('NaN', 2), TypeError)
  assert.throws(() => decimalToMinorUnits(' 1.00 ', 2), TypeError)
  assert.throws(() => decimalToMinorUnits('1.00', -1), RangeError)
  assert.throws(() => decimalToMinorUnits('1.00', 1.5), RangeError)
  assert.throws(() => minorUnitsToDecimalString(BigInt(1), 19), RangeError)
})

test('rejects values outside signed 64-bit storage range', () => {
  assert.throws(
    () => decimalToMinorUnits('9223372036854775808', 0),
    RangeError,
  )
  assert.throws(
    () => minorUnitsToDecimalString(BigInt('9223372036854775808'), 0),
    RangeError,
  )
})
