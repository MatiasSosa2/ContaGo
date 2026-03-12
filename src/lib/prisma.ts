import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

const prismaClientSingleton = () => {
  const connectionString = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL
  const isMock = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' || process.env.USE_MOCK_DATA === 'true';

  if (!connectionString) {
    if (isMock) {
       // Mock Mode: Return a dummy client to satisfy types without crashing on init
       // We use a dummy file url, even if file doesn't exist, it won't crash until query
       return new PrismaClient({ datasources: { db: { url: "file:./dummy.db" } } })
    }
    // If not mock and no URL, let it throw or default?
    // fallback to dev.db if undefined?
    // Default prisma behavior checks .env
  }
  
  const url = connectionString || "file:./dev.db";

  // Usa adaptador Turso solo si la URL es de Turso (empieza con libsql:// o wss://)
  if (url.startsWith('libsql') || url.startsWith('wss')) {
    const authToken = process.env.TURSO_AUTH_TOKEN
    const libsql = createClient({
      url: url,
      authToken,
    })
    const adapter = new PrismaLibSql(libsql as any)
    return new PrismaClient({ adapter: adapter as any })
  }

  // Fallback a Prisma normal (local SQLitedev.db)
  return new PrismaClient({ datasources: { db: { url } } })
}

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = globalThis.prisma ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma
