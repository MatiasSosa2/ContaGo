/**
 * Database actions grouped by domain in src/server/db/*.
 * Used by src/app/actions.ts to choose between real and demo data.
 */
export * from '@/server/db/catalogs'
export * from '@/server/db/transactions'
export * from '@/server/db/reports'
export * from '@/server/db/cash'
export * from '@/server/db/registro'
export * from '@/server/db/credits'
export * from '@/server/db/stock'
export * from '@/server/db/articulos'
export * from '@/server/db/dashboard'
export type { DashboardPeriodKey, DateRange } from '@/server/db/shared'
