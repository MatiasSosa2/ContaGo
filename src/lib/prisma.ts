import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

// dotenv puede dejar comillas literales en los valores; las eliminamos
function stripQuotes(val: string | undefined): string | undefined {
  return val?.replace(/^["']|["']$/g, '')
}

function buildPrismaClient() {
  const isMock =
    process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' ||
    process.env.USE_MOCK_DATA === 'true'

  // ── Leer URL de Turso (TURSO_DATABASE_URL tiene prioridad) ─────────────────
  const url = stripQuotes(process.env.TURSO_DATABASE_URL) ||
              stripQuotes(process.env.DATABASE_URL)
  const authToken = stripQuotes(process.env.TURSO_AUTH_TOKEN)

  // ── Modo mock: no se conecta a ninguna DB real ──────────────────────────────
  // En Prisma 7 siempre se requiere un adapter; usamos la misma DB pero sin
  // ejecutar queries reales (el mock data se inyecta en las actions).
  if (isMock && url && authToken) {
    const adapter = new PrismaLibSql({ url, authToken })
    return new PrismaClient({ adapter } as any)
  }

  if (!url) {
    throw new Error(
      '\n[Prisma] ❌ No se encontró TURSO_DATABASE_URL ni DATABASE_URL.\n' +
      '  → Verificá que el archivo .env tenga las variables configuradas y reiniciá el servidor (npm run dev).'
    )
  }

  // ── Conexión remota Turso via libSQL ────────────────────────────────────────
  if (url.startsWith('libsql') || url.startsWith('wss') || url.startsWith('https')) {
    if (!authToken) {
      throw new Error(
        '\n[Prisma] ❌ TURSO_AUTH_TOKEN no está definido.\n' +
        '  → Agregá el token de autenticación de Turso al archivo .env.'
      )
    }

    // API Prisma 7: PrismaLibSql({ url, authToken }) — es un AdapterFactory
    const adapter = new PrismaLibSql({ url, authToken })
    return new PrismaClient({ adapter } as any)
  }

  // ── SQLite local embebido (file:./...) ─────────────────────────────────────
  // Usa libsql con archivo local para compatibilidad con Prisma 7 adapter-only
  const adapter = new PrismaLibSql({ url })
  return new PrismaClient({ adapter } as any)
}

declare global {
  // eslint-disable-next-line no-var
  var prisma: undefined | ReturnType<typeof buildPrismaClient>
}

// Singleton: reutilizamos la conexión entre hot-reloads en dev
const prisma = globalThis.prisma ?? buildPrismaClient()
export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma
