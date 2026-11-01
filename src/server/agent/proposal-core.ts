/**
 * Núcleo testeable de la bandeja del agente (sin Prisma ni Next en imports):
 * la DB se inyecta, así las reglas de transición se prueban sin base real.
 *
 * Regla de oro (docs/plan-agente-ia.md): una propuesta PENDING solo puede
 * transicionar una vez (updateMany condicional), así dos revisores simultáneos
 * no pueden aprobar/rechazar dos veces.
 */

import { describeAgentDraft, serializeAgentDraft, type AgentDraft } from '@/lib/agent-drafts'

import { logAuditEvent, type AuditDatabase } from './audit'

export type ProposalSource = 'TEXT' | 'PHOTO' | 'AUDIO'

export type ProposalDatabase = {
  agentProposal: {
    create(args: {
      data: {
        businessId: string
        createdById: string
        source: string
        sourceText: string | null
        documentUrl: string | null
        draftJson: string
        confidence: number
      }
    }): Promise<{ id: string }>
    updateMany(args: {
      where: { id: string; businessId: string; status: string }
      data: {
        status: string
        reviewedById: string
        reviewedAt: Date
        reviewNote: string | null
      }
    }): Promise<{ count: number }>
  }
}

export async function createProposalCore(
  db: ProposalDatabase & AuditDatabase,
  input: {
    businessId: string
    createdById: string
    source: ProposalSource
    sourceText?: string
    documentUrl?: string
    draft: AgentDraft
    confidence: number
  },
): Promise<{ id: string }> {
  const draftJson = serializeAgentDraft(input.draft)
  const confidence = Math.min(1, Math.max(0, input.confidence))
  const proposal = await db.agentProposal.create({
    data: {
      businessId: input.businessId,
      createdById: input.createdById,
      source: input.source,
      sourceText: input.sourceText?.slice(0, 2000) ?? null,
      documentUrl: input.documentUrl ?? null,
      draftJson,
      confidence,
    },
  })
  await logAuditEvent(db, {
    businessId: input.businessId,
    actor: 'AGENT',
    action: 'proposal.created',
    entityType: 'AgentProposal',
    entityId: proposal.id,
    summary: `Propuesta creada: ${describeAgentDraft(input.draft)}`,
    metadata: { source: input.source, confidence },
    userId: input.createdById,
  })
  return proposal
}

export type ProposalDecision = 'APPROVED' | 'REJECTED'

/**
 * Transición atómica PENDING → APPROVED/REJECTED. Devuelve false si otro
 * revisor ya la resolvió (o no pertenece al negocio).
 */
export async function decideProposalCore(
  db: ProposalDatabase & AuditDatabase,
  input: {
    businessId: string
    proposalId: string
    decision: ProposalDecision
    reviewedById: string
    reviewNote?: string
  },
): Promise<boolean> {
  const updated = await db.agentProposal.updateMany({
    where: { id: input.proposalId, businessId: input.businessId, status: 'PENDING' },
    data: {
      status: input.decision,
      reviewedById: input.reviewedById,
      reviewedAt: new Date(),
      reviewNote: input.reviewNote?.slice(0, 300) ?? null,
    },
  })
  if (updated.count !== 1) return false

  await logAuditEvent(db, {
    businessId: input.businessId,
    actor: 'USER',
    action: input.decision === 'APPROVED' ? 'proposal.approved' : 'proposal.rejected',
    entityType: 'AgentProposal',
    entityId: input.proposalId,
    summary: input.decision === 'APPROVED' ? 'Propuesta aprobada' : 'Propuesta rechazada',
    metadata: input.reviewNote ? { reviewNote: input.reviewNote } : undefined,
    userId: input.reviewedById,
  })
  return true
}
