import { z } from 'zod'

/**
 * Borrador estructurado de un movimiento propuesto por el agente.
 * Es el contrato entre la extracción IA (fases 1+) y la bandeja de revisión:
 * el agente produce JSON, este esquema lo valida, y la aprobación lo ejecuta
 * con las acciones contables ya existentes.
 */
export const agentDraftSchema = z.object({
  kind: z.enum(['INCOME', 'EXPENSE', 'TRANSFER', 'SALE_PRODUCT', 'PURCHASE_PRODUCT']),
  amount: z.number().positive().max(1_000_000_000),
  currency: z.enum(['ARS', 'USD']).default('ARS'),
  description: z.string().trim().min(1).max(200),
  contactName: z.string().trim().max(120).optional(),
  categoryName: z.string().trim().max(80).optional(),
  /** yyyy-mm-dd en calendario argentino; sin fecha = hoy */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  items: z.array(z.object({
    name: z.string().trim().min(1).max(120),
    quantity: z.number().positive(),
    unitPrice: z.number().nonnegative(),
  })).max(50).optional(),
})

export type AgentDraft = z.infer<typeof agentDraftSchema>

/** Parsea y valida el JSON de un borrador. null si no es un borrador válido. */
export function parseAgentDraft(json: string): AgentDraft | null {
  try {
    const parsed = agentDraftSchema.safeParse(JSON.parse(json))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

/** Serializa un borrador validado para guardarlo en AgentProposal.draftJson. */
export function serializeAgentDraft(draft: AgentDraft): string {
  return JSON.stringify(agentDraftSchema.parse(draft))
}

/** Resumen legible para la bandeja ("Gasto · $45.000 · Distribuidora López"). */
export function describeAgentDraft(draft: AgentDraft): string {
  const kindLabel = {
    INCOME: 'Ingreso',
    EXPENSE: 'Gasto',
    TRANSFER: 'Cambio de caja',
    SALE_PRODUCT: 'Venta',
    PURCHASE_PRODUCT: 'Compra',
  }[draft.kind]
  const symbol = draft.currency === 'USD' ? 'US$' : '$'
  const amount = `${symbol}${Math.round(draft.amount).toLocaleString('es-AR')}`
  return [kindLabel, amount, draft.contactName].filter(Boolean).join(' · ')
}
