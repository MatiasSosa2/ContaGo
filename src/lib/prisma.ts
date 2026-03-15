import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

function buildPrismaClient() {
  const isMock =
    process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' ||
    process.env.USE_MOCK_DATA === 'true'

  // ── Modo mock: no se conecta a ninguna DB real ──────────────────────────────
  if (isMock) {
    return new PrismaClient()
  }

  // ── Leer URL de Turso (TURSO_DATABASE_URL tiene prioridad) ─────────────────
  const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL

  if (!url) {
    throw new Error(
      '\n[Prisma] ❌ No se encontró TURSO_DATABASE_URL ni DATABASE_URL.\n' +
      '  → Verificá que el archivo .env tenga las variables configuradas y reiniciá el servidor (npm run dev).'
    )
  }

  // ── Conexión remota Turso via libSQL ────────────────────────────────────────
  // En Prisma 7, PrismaLibSql es un factory que recibe Config directamente
  // (ya NO se usa createClient de @libsql/client por separado)
  if (url.startsWith('libsql') || url.startsWith('wss') || url.startsWith('https')) {
    const authToken = process.env.TURSO_AUTH_TOKEN

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

  // ── SQLite local (file:./...) — solo para desarrollo sin Turso ─────────────
  return new PrismaClient()
}

declare global {
  // eslint-disable-next-line no-var
  var prisma: undefined | ReturnType<typeof buildPrismaClient>
}

// Singleton: reutilizamos la conexión entre hot-reloads en dev
const prisma = globalThis.prisma ?? buildPrismaClient()
export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma
