import {
  createTransactionSchema,
  registerWithCredentialsSchema,
  verifyEmailChallengeSchema,
} from '../src/lib/validations'

type SmokeCase = {
  name: string
  passed: boolean
  details: string
}

function pass(name: string, details: string): SmokeCase {
  return { name, passed: true, details }
}

function fail(name: string, details: string): SmokeCase {
  return { name, passed: false, details }
}

const results: SmokeCase[] = []

const validRegister = registerWithCredentialsSchema.safeParse({
  name: 'Matias Perez',
  email: 'MATIAS@EXAMPLE.COM',
  password: '12345678',
  businessName: 'ContaGo',
  operatingModel: 'SERVICES',
})

if (!validRegister.success) {
  results.push(fail('register valid', validRegister.error.issues[0]?.message ?? 'Fallo inesperado'))
} else if (validRegister.data.email !== 'matias@example.com') {
  results.push(fail('register transform email', `Email transformado incorrectamente: ${validRegister.data.email}`))
} else {
  results.push(pass('register valid', 'Acepta datos validos y normaliza email a lowercase'))
}

const invalidRegister = registerWithCredentialsSchema.safeParse({
  name: 'M',
  email: 'correo-invalido',
  password: '123',
  businessName: '',
  operatingModel: 'INVALID',
})

if (invalidRegister.success) {
  results.push(fail('register invalid', 'Deberia rechazar datos invalidos'))
} else {
  results.push(pass('register invalid', `Rechaza datos invalidos con ${invalidRegister.error.issues.length} errores`))
}

const validChallenge = verifyEmailChallengeSchema.safeParse({
  email: 'demo@example.com',
  purpose: 'PASSWORD_RESET',
  code: '123456',
})

results.push(
  validChallenge.success
    ? pass('verify challenge valid', 'Acepta email, purpose y codigo validos')
    : fail('verify challenge valid', validChallenge.error.issues[0]?.message ?? 'Fallo inesperado'),
)

const validTransaction = createTransactionSchema.safeParse({
  amount: 1500,
  description: 'Venta mostrador',
  type: 'INCOME',
  accountId: '550e8400-e29b-41d4-a716-446655440000',
  categoryId: '',
  contactId: '',
  areaNegocioId: '',
  currency: 'ARS',
  esCredito: false,
  estado: 'COBRADO',
})

results.push(
  validTransaction.success
    ? pass('transaction valid', 'Acepta una transaccion minima valida')
    : fail('transaction valid', validTransaction.error.issues[0]?.message ?? 'Fallo inesperado'),
)

const invalidTransaction = createTransactionSchema.safeParse({
  amount: -5,
  description: '',
  type: 'OTHER',
  accountId: 'sin-uuid',
  currency: 'EUR',
  esCredito: false,
  estado: 'COBRADO',
})

if (invalidTransaction.success) {
  results.push(fail('transaction invalid', 'Deberia rechazar una transaccion invalida'))
} else {
  results.push(pass('transaction invalid', `Rechaza transaccion invalida con ${invalidTransaction.error.issues.length} errores`))
}

for (const result of results) {
  const prefix = result.passed ? '[OK]' : '[FAIL]'
  console.log(`${prefix} ${result.name}: ${result.details}`)
}

const failed = results.filter((result) => !result.passed)

if (failed.length > 0) {
  console.error(`\n${failed.length} validacion(es) fallaron.`)
  process.exit(1)
}

console.log(`\n${results.length} validaciones Zod pasaron correctamente.`)