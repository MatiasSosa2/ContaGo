/**
 * Acciones con la base de datos, separadas por tema en src/server/db/*.
 * Solo las usa src/app/actions.ts (que elige entre datos reales y demo); los componentes
 * importan de acá únicamente tipos.
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
