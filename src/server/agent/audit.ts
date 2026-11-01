/**
 * Auditoría de acciones del usuario, del agente y del sistema.
 * Base del soporte ("¿quién hizo esto?") y del moat de datos del agente:
 * cada propuesta, aprobación y corrección queda registrada.
 */

export type AuditActor = 'USER' | 'AGENT' | 'SYSTEM'

export type AuditInput = {
  businessId: string
  actor: AuditActor
  action: string
  entityType?: string
  entityId?: string
  summary: string
  metadata?: Record<string, unknown>
  userId?: string
}

const SENSITIVE_KEY = /token|secret|password|authorization|apikey|api_key/i
const MAX_SUMMARY = 200
const MAX_METADATA = 2000

/** Metadata como JSON acotado y sin claves sensibles (nunca tokens ni contraseñas). */
export function sanitizeAuditMetadata(metadata: Record<string, unknown> | undefined): string | null {
  if (!metadata) return null
  const clean: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_KEY.test(key)) continue
    clean[key] = typeof value === 'string' ? value.slice(0, 300) : value
  }
  try {
    return JSON.stringify(clean).slice(0, MAX_METADATA)
  } catch {
    return null
  }
}

export type AuditDatabase = {
  auditLog: {
    create(args: {
      data: {
        businessId: string
        actor: string
        action: string
        entityType: string | null
        entityId: string | null
        summary: string
        metadata: string | null
        userId: string | null
      }
    }): Promise<unknown>
  }
}

/** Registra un evento. Fire-and-forget seguro: nunca debe romper la acción principal. */
export async function logAuditEvent(db: AuditDatabase, input: AuditInput): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        businessId: input.businessId,
        actor: input.actor,
        action: input.action.slice(0, 80),
        entityType: input.entityType?.slice(0, 60) ?? null,
        entityId: input.entityId?.slice(0, 80) ?? null,
        summary: input.summary.slice(0, MAX_SUMMARY),
        metadata: sanitizeAuditMetadata(input.metadata),
        userId: input.userId ?? null,
      },
    })
  } catch (error) {
    console.error('[audit] no se pudo registrar el evento', { action: input.action, error: error instanceof Error ? error.message : 'unknown' })
  }
}
