import { defineConfig } from 'prisma/config'

// Configura Prisma CLI (migrate, studio, introspect).
// El cliente en runtime recibe el adaptador libSQL en src/lib/prisma.ts.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || 'file:./prisma/dev.db',
  },
})
