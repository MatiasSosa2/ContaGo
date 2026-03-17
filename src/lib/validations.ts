import { z } from 'zod'

export const EMAIL_CHALLENGE_PURPOSES = [
  'SIGNUP_VERIFY',
  'SOCIAL_LOGIN_VERIFY',
  'PASSWORD_RESET',
  'RISK_CHALLENGE',
] as const

export const BUSINESS_OPERATING_MODELS = ['SERVICES', 'PRODUCTS', 'BOTH'] as const

const emailSchema = z
  .string()
  .trim()
  .email('Email inválido')
  .transform((value) => value.toLowerCase())

const passwordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(72, 'La contraseña es demasiado larga')

const challengeCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'El código debe tener 6 dígitos')

// ---- Transaction ----
export const createTransactionSchema = z.object({
  amount: z
    .number({ message: 'El monto debe ser un número' })
    .positive('El monto debe ser mayor a 0')
    .finite('El monto no es válido'),
  description: z
    .string()
    .min(1, 'La descripción es obligatoria')
    .max(200, 'Máximo 200 caracteres'),
  type: z.enum(['INCOME', 'EXPENSE'], {
    message: 'El tipo debe ser INCOME o EXPENSE',
  }),
  accountId: z.string().uuid('Cuenta inválida'),
  categoryId: z.string().uuid('Categoría inválida').optional().or(z.literal('')),
  contactId: z.string().uuid('Contacto inválido').optional().or(z.literal('')),
  areaNegocioId: z.string().uuid('Área de negocio inválida').optional().or(z.literal('')),
  date: z.string().optional(),
  currency: z.enum(['ARS', 'USD']).default('ARS'),
  // Créditos y Deudas
  esCredito: z.boolean().default(false),
  estado: z.enum(['COBRADO', 'PAGADO', 'PENDIENTE', 'VENCIDO']).default('COBRADO'),
  fechaVencimiento: z.string().optional(),
})

// ---- Producto (Stock) ----
export const createProductoSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio').max(100),
  descripcion: z.string().max(300).optional().or(z.literal('')),
  categoria: z.string().max(80).optional().or(z.literal('')),
  marca: z.string().max(80).optional().or(z.literal('')),
  unidad: z.string().max(30).default('unidad'),
  metodoCosteo: z.enum(['PROMEDIO', 'FIFO', 'LIFO']).default('PROMEDIO'),
  precioVenta: z.number().min(0).default(0),
  precioCosto: z.number().min(0).default(0),
  stockActual: z.number().default(0),
  enTransito: z.number().min(0).default(0),
})

// ---- Movimiento de Stock ----
export const createMovimientoStockSchema = z.object({
  productoId: z.string().uuid('Producto inválido'),
  tipo: z.enum(['ENTRADA', 'SALIDA', 'AJUSTE']),
  cantidad: z.number().positive('La cantidad debe ser mayor a 0'),
  precio: z.number().min(0).default(0),
  motivo: z.string().max(200).optional().or(z.literal('')),
  fecha: z.string().optional(),
})

// ---- Área de Negocio ----
export const createAreaNegocioSchema = z.object({
  nombre: z
    .string()
    .min(1, 'El nombre del área es obligatorio')
    .max(100, 'Máximo 100 caracteres'),
  descripcion: z.string().max(200, 'Máximo 200 caracteres').optional().or(z.literal('')),
})

// ---- Bien de Uso ----
export const createBienDeUsoSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio').max(150),
  descripcion: z.string().max(500).optional().or(z.literal('')),
  categoria: z.enum(['TECNOLOGIA', 'MOBILIARIO', 'VEHICULO', 'HERRAMIENTA', 'INMUEBLE', 'OTRO'],
    { message: 'Categoría inválida' }),
  fechaCompra: z.string().min(1, 'La fecha de compra es obligatoria'),
  valorCompra: z.number({ message: 'El valor debe ser un número' }).positive('El valor debe ser mayor a 0'),
  currency: z.enum(['ARS', 'USD']).default('ARS'),
  vidaUtilMeses: z.number().int().min(1).max(600).default(60),
  valorResidual: z.number().min(0).default(0),
  estado: z.enum(['EN_USO', 'VENDIDO', 'DADO_DE_BAJA']).default('EN_USO'),
  notas: z.string().max(500).optional().or(z.literal('')),
})

// ---- Account ----
export const createAccountSchema = z.object({
  name: z
    .string()
    .min(1, 'El nombre es obligatorio')
    .max(100, 'Máximo 100 caracteres'),
  type: z.enum(['CASH', 'BANK', 'WALLET']).default('CASH'),
  currency: z.enum(['ARS', 'USD']).default('ARS'),
})

export const updateAccountSchema = z.object({
  name: z
    .string()
    .min(1, 'El nombre es obligatorio')
    .max(100, 'Máximo 100 caracteres'),
})

// ---- Contact ----
export const createContactSchema = z.object({
  name: z
    .string()
    .min(1, 'El nombre es obligatorio')
    .max(100, 'Máximo 100 caracteres'),
  type: z.enum(['CLIENT', 'SUPPLIER']).default('CLIENT'),
  phone: z.string().max(30).optional().or(z.literal('')),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
})

// ---- Category ----
export const createCategorySchema = z.object({
  name: z
    .string()
    .min(1, 'El nombre es obligatorio')
    .max(100, 'Máximo 100 caracteres'),
  type: z.enum(['INCOME', 'EXPENSE']).default('EXPENSE'),
})

// ---- Auth ----
export const registerWithCredentialsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'El nombre es obligatorio')
    .max(100, 'Máximo 100 caracteres'),
  email: emailSchema,
  password: passwordSchema,
  businessName: z
    .string()
    .trim()
    .min(2, 'El nombre del negocio es obligatorio')
    .max(120, 'Máximo 120 caracteres'),
  operatingModel: z.enum(BUSINESS_OPERATING_MODELS, {
    message: 'Selecciona si tu negocio ofrece servicios, productos o ambos',
  }),
})

export const requestEmailChallengeSchema = z.object({
  email: emailSchema,
  purpose: z.enum(EMAIL_CHALLENGE_PURPOSES),
})

export const loginWithCredentialsSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
})

export const verifyEmailChallengeSchema = z.object({
  email: emailSchema,
  purpose: z.enum(EMAIL_CHALLENGE_PURPOSES),
  code: challengeCodeSchema,
})

export const resetPasswordWithCodeSchema = z.object({
  email: emailSchema,
  code: challengeCodeSchema,
  password: passwordSchema,
})

// ---- Helpers ----
export type DateRange = { from?: Date; to?: Date }

export type ActionResult<T = void> = 
  | { success: true; data?: T }
  | { success: false; error: string }

export function parseFormData(formData: FormData): Record<string, string> {
  const obj: Record<string, string> = {}
  formData.forEach((value, key) => {
    obj[key] = value as string
  })
  return obj
}
