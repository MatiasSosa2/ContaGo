import { Prisma } from '@prisma/client'

const MAX_MINOR_UNITS = BigInt('9223372036854775807')
const MIN_MINOR_UNITS = BigInt('-9223372036854775808')
const MAX_CURRENCY_EXPONENT = 18
const DECIMAL_STRING = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/

function validateExponent(exponent: number): void {
  if (!Number.isInteger(exponent) || exponent < 0 || exponent > MAX_CURRENCY_EXPONENT) {
    throw new RangeError(`Currency exponent must be an integer between 0 and ${MAX_CURRENCY_EXPONENT}`)
  }
}

function validateMinorUnits(minorUnits: bigint): void {
  if (minorUnits < MIN_MINOR_UNITS || minorUnits > MAX_MINOR_UNITS) {
    throw new RangeError('Minor units exceed the signed 64-bit storage range')
  }
}

export function decimalToMinorUnits(value: string, exponent: number): bigint {
  validateExponent(exponent)
  if (!DECIMAL_STRING.test(value)) {
    throw new TypeError('Amount must be a plain decimal string')
  }

  const decimal = new Prisma.Decimal(value)
  const rounded = decimal.toDecimalPlaces(exponent, Prisma.Decimal.ROUND_HALF_UP)
  const fixed = rounded.toFixed(exponent)
  const minorUnits = BigInt(fixed.replace('.', ''))
  validateMinorUnits(minorUnits)
  return minorUnits
}

export function decimalToMinorUnitsStrict(value: string, exponent: number): bigint {
  validateExponent(exponent)
  if (!DECIMAL_STRING.test(value)) {
    throw new TypeError('Amount must be a plain decimal string')
  }

  const decimal = new Prisma.Decimal(value)
  const rounded = decimal.toDecimalPlaces(exponent, Prisma.Decimal.ROUND_HALF_UP)
  if (!decimal.equals(rounded)) {
    throw new RangeError(`Amount has more than ${exponent} fractional digits`)
  }

  return decimalToMinorUnits(value, exponent)
}

export function minorUnitsToDecimalString(minorUnits: bigint, exponent: number): string {
  validateExponent(exponent)
  validateMinorUnits(minorUnits)

  const negative = minorUnits < BigInt(0)
  const digits = (negative ? -minorUnits : minorUnits).toString()
  if (exponent === 0) return `${negative ? '-' : ''}${digits}`

  const padded = digits.padStart(exponent + 1, '0')
  const integer = padded.slice(0, -exponent)
  const fraction = padded.slice(-exponent).replace(/0+$/, '')
  const sign = negative ? '-' : ''
  return fraction ? `${sign}${integer}.${fraction}` : `${sign}${integer}`
}
