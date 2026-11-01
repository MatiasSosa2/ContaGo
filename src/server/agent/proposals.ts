/**
 * Acciones de la bandeja del agente con contexto de sesión.
 * La lógica de transición vive en ./proposal-core (testeable, DB inyectada);
 * acá solo se resuelve la sesión y la base real.
 */

import { revalidatePath } from 'next/cache'

import type { ActionResult } from '@/lib/validations'
import { describeAgentDraft, parseAgentDraft, type AgentDraft } from '@/lib/agent-drafts'
import { requireBusinessContext, requireBusinessWriteContext } from '@/server/auth/require-business-context'

import { createProposalCore, decideProposalCore, type ProposalSource } from './proposal-core'

export type { ProposalSource } from './proposal-core'

export type AgentProposalView = {
  id: string
  source: ProposalSource
  sourceText: string | null
  documentUrl: string | null
  draft: AgentDraft
  summary: string
  confidence: number
  status: string
  createdAt: Date
  reviewNote: string | null
}

function toView(p: {
  id: string; source: string; sourceText: string | null; documentUrl: string | null
  draftJson: string; confidence: number; status: string; createdAt: Date; reviewNote: string | null
}): AgentProposalView | null {
  const draft = parseAgentDraft(p.draftJson)
  if (!draft) return null
  return {
    id: p.id,
    source: (p.source === 'PHOTO' || p.source === 'AUDIO' ? p.source : 'TEXT'),
    sourceText: p.sourceText,
    documentUrl: p.documentUrl,
    draft,
    summary: describeAgentDraft(draft),
    confidence: p.confidence,
    status: p.status,
    createdAt: p.createdAt,
    reviewNote: p.reviewNote,
  }
}

/** Bandeja: pendientes primero, y el historial reciente de resueltas. */
export async function getAgentProposals(): Promise<{ pending: AgentProposalView[]; reviewed: AgentProposalView[] }> {
  const sessionContext = await requireBusinessContext()
  const businessId = sessionContext.activeBusiness.id

  // Import dinámico: el módulo no debe cargar Prisma al importarse en tests
  const { default: prisma } = await import('@/lib/prisma')
  const rows = await prisma.agentProposal.findMany({
    where: { businessId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  const pending: AgentProposalView[] = []
  const reviewed: AgentProposalView[] = []
  for (const row of rows) {
    const view = toView(row)
    if (!view) continue
    if (row.status === 'PENDING') pending.push(view)
    else reviewed.push(view)
  }
  return { pending, reviewed: reviewed.slice(0, 20) }
}

/** Crea una propuesta (la usa el intake del agente en la fase 1). */
export async function createAgentProposal(input: {
  source: ProposalSource
  sourceText?: string
  documentUrl?: string
  draft: AgentDraft
  confidence: number
}): Promise<ActionResult<{ id: string }>> {
  const sessionContext = await requireBusinessWriteContext()
  const { default: prisma } = await import('@/lib/prisma')
  const proposal = await createProposalCore(prisma, {
    businessId: sessionContext.activeBusiness.id,
    createdById: sessionContext.user.id,
    ...input,
  })
  revalidatePath('/agente')
  return { success: true, data: proposal }
}

export async function approveAgentProposal(proposalId: string): Promise<ActionResult> {
  const sessionContext = await requireBusinessWriteContext()
  const { default: prisma } = await import('@/lib/prisma')
  // La ejecución del movimiento (llamada a las acciones contables) entra en la fase 1;
  // acá la decisión queda registrada y es irrepetible.
  const ok = await decideProposalCore(prisma, {
    businessId: sessionContext.activeBusiness.id,
    proposalId,
    decision: 'APPROVED',
    reviewedById: sessionContext.user.id,
  })
  if (!ok) return { success: false, error: 'La propuesta ya fue revisada o no existe' }
  revalidatePath('/agente')
  return { success: true }
}

export async function rejectAgentProposal(proposalId: string, note?: string): Promise<ActionResult> {
  const sessionContext = await requireBusinessWriteContext()
  const { default: prisma } = await import('@/lib/prisma')
  const ok = await decideProposalCore(prisma, {
    businessId: sessionContext.activeBusiness.id,
    proposalId,
    decision: 'REJECTED',
    reviewedById: sessionContext.user.id,
    reviewNote: note,
  })
  if (!ok) return { success: false, error: 'La propuesta ya fue revisada o no existe' }
  revalidatePath('/agente')
  return { success: true }
}
