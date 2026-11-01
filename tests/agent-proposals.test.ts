import assert from 'node:assert/strict'
import test from 'node:test'
import { describeAgentDraft, parseAgentDraft, serializeAgentDraft, type AgentDraft } from '../src/lib/agent-drafts'
import { sanitizeAuditMetadata } from '../src/server/agent/audit'
import { createProposalCore, decideProposalCore } from '../src/server/agent/proposal-core'

const validDraft: AgentDraft = {
  kind: 'EXPENSE',
  amount: 45000,
  currency: 'ARS',
  description: 'Compra a Distribuidora López',
  contactName: 'Distribuidora López',
}

test('parseAgentDraft acepta un borrador válido y lo devuelve con defaults', () => {
  const draft = parseAgentDraft(JSON.stringify({ kind: 'INCOME', amount: 80000, description: 'Cobro a Juan' }))
  assert.ok(draft)
  assert.equal(draft.currency, 'ARS')
  assert.equal(draft.kind, 'INCOME')
})

test('parseAgentDraft rechaza JSON roto, montos inválidos y campos extraños', () => {
  assert.equal(parseAgentDraft('no es json'), null)
  assert.equal(parseAgentDraft(JSON.stringify({ kind: 'INCOME', amount: -5, description: 'x' })), null)
  assert.equal(parseAgentDraft(JSON.stringify({ kind: 'MAGIC', amount: 10, description: 'x' })), null)
  assert.equal(parseAgentDraft(JSON.stringify({ kind: 'INCOME', amount: 10 })), null)
})

test('serializeAgentDraft + parseAgentDraft hacen ida y vuelta exacta', () => {
  const roundtrip = parseAgentDraft(serializeAgentDraft(validDraft))
  assert.deepEqual(roundtrip, validDraft)
})

test('describeAgentDraft resume en lenguaje legible', () => {
  assert.equal(describeAgentDraft(validDraft), 'Gasto · $45.000 · Distribuidora López')
  assert.equal(describeAgentDraft({ kind: 'INCOME', amount: 1000, currency: 'USD', description: 'Venta' }), 'Ingreso · US$1.000')
})

test('sanitizeAuditMetadata quita claves sensibles y acota tamaños', () => {
  const result = sanitizeAuditMetadata({
    source: 'TEXT',
    access_token: 'no-debe-aparecer',
    note: 'x'.repeat(500),
  })
  assert.ok(result)
  assert.ok(result.includes('TEXT'))
  assert.ok(!result.includes('no-debe-aparecer'))
  assert.ok(!result.includes('access_token'))
  assert.ok(result.length <= 2000)

  assert.equal(sanitizeAuditMetadata(undefined), null)
})

// ── Núcleo con DB falsa ──────────────────────────────────────────────────────

type StoredProposal = {
  id: string
  businessId: string
  status: string
  createdById: string
  draftJson: string
  confidence: number
  reviewedById: string | null
}

function createFakeDb() {
  const proposals: StoredProposal[] = []
  const audits: { action: string; actor: string; entityId: string | null }[] = []
  let seq = 0
  const db = {
    agentProposal: {
      async create({ data }: { data: Record<string, unknown> }) {
        const id = `prop-${++seq}`
        proposals.push({
          id,
          businessId: data.businessId as string,
          createdById: data.createdById as string,
          draftJson: data.draftJson as string,
          confidence: data.confidence as number,
          status: 'PENDING',
          reviewedById: null,
        })
        return { id }
      },
      async updateMany({ where, data }: { where: { id: string; businessId: string; status: string }; data: Record<string, unknown> }) {
        const target = proposals.find(
          (p) => p.id === where.id && p.businessId === where.businessId && p.status === where.status,
        )
        if (!target) return { count: 0 }
        target.status = data.status as string
        target.reviewedById = (data.reviewedById as string) ?? null
        return { count: 1 }
      },
    },
    auditLog: {
      async create({ data }: { data: { action: string; actor: string; entityId: string | null } }) {
        audits.push({ action: data.action, actor: data.actor, entityId: data.entityId })
      },
    },
  }
  return { db, proposals, audits }
}

test('el agente crea la propuesta y queda auditada como AGENT', async () => {
  const { db, proposals, audits } = createFakeDb()
  const { id } = await createProposalCore(db, {
    businessId: 'biz-1',
    createdById: 'user-1',
    source: 'TEXT',
    sourceText: 'gasté 45 mil en López',
    draft: validDraft,
    confidence: 0.9,
  })

  assert.equal(proposals.length, 1)
  assert.equal(proposals[0].id, id)
  assert.equal(proposals[0].status, 'PENDING')
  assert.equal(audits[0].action, 'proposal.created')
  assert.equal(audits[0].actor, 'AGENT')
})

test('la confianza se acota a 0..1', async () => {
  const { db, proposals } = createFakeDb()
  await createProposalCore(db, { businessId: 'b', createdById: 'u', source: 'TEXT', draft: validDraft, confidence: 42 })
  assert.equal(proposals[0].confidence, 1)
})

test('una propuesta se aprueba una sola vez, aunque haya dos revisores simultáneos', async () => {
  const { db, audits } = createFakeDb()
  const { id } = await createProposalCore(db, {
    businessId: 'biz-1', createdById: 'user-1', source: 'TEXT', draft: validDraft, confidence: 0.9,
  })

  const [first, second] = await Promise.all([
    decideProposalCore(db, { businessId: 'biz-1', proposalId: id, decision: 'APPROVED', reviewedById: 'user-1' }),
    decideProposalCore(db, { businessId: 'biz-1', proposalId: id, decision: 'REJECTED', reviewedById: 'user-2' }),
  ])

  assert.equal([first, second].filter(Boolean).length, 1)
  assert.equal(audits.filter((a) => a.action.startsWith('proposal.')).length, 2) // created + una decisión
})

test('no se puede decidir una propuesta de otro negocio', async () => {
  const { db } = createFakeDb()
  const { id } = await createProposalCore(db, {
    businessId: 'biz-1', createdById: 'user-1', source: 'TEXT', draft: validDraft, confidence: 0.9,
  })
  const ok = await decideProposalCore(db, { businessId: 'otro', proposalId: id, decision: 'APPROVED', reviewedById: 'x' })
  assert.equal(ok, false)
})
