import assert from 'node:assert/strict'
import test from 'node:test'
import {
  changeMemberRoleCore,
  claimPendingInvitationsCore,
  inviteMemberCore,
  normalizeInviteEmail,
  normalizeTeamRole,
  removeMemberCore,
  revokeInvitationCore,
} from '../src/server/team/members-core'

type Member = { id: string; userId: string; businessId: string; role: string; status: string }
type Invitation = { id: string; businessId: string; email: string; role: string; status: string }

function createFakeDb() {
  const members: Member[] = []
  const invitations: Invitation[] = []
  const audits: { action: string }[] = []
  let seq = 0

  const db = {
    businessMember: {
      async findMany({ where }: { where: Record<string, unknown> }) {
        return members.filter((m) =>
          Object.entries(where).every(([k, v]) => m[k as keyof Member] === v),
        )
      },
      async create({ data }: { data: Omit<Member, 'id'> & { acceptedAt: Date } }) {
        const id = `mem-${++seq}`
        members.push({ id, ...data })
        return { id }
      },
      async updateMany({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) {
        const target = members.find((m) =>
          Object.entries(where).every(([k, v]) => m[k as keyof Member] === v),
        )
        if (!target) return { count: 0 }
        Object.assign(target, data)
        return { count: 1 }
      },
      async deleteMany({ where }: { where: Record<string, unknown> }) {
        const idx = members.findIndex((m) =>
          Object.entries(where).every(([k, v]) => m[k as keyof Member] === v),
        )
        if (idx === -1) return { count: 0 }
        members.splice(idx, 1)
        return { count: 1 }
      },
    },
    businessInvitation: {
      async findMany({ where }: { where: Record<string, unknown> }) {
        return invitations.filter((i) =>
          Object.entries(where).every(([k, v]) => i[k as keyof Invitation] === v),
        )
      },
      async findFirst({ where }: { where: Record<string, unknown> }) {
        return invitations.find((i) =>
          Object.entries(where).every(([k, v]) => i[k as keyof Invitation] === v),
        ) ?? null
      },
      async create({ data }: { data: { businessId: string; email: string; role: string; invitedById: string } }) {
        const id = `inv-${++seq}`
        invitations.push({ id, ...data, status: 'PENDING' })
        return { id }
      },
      async updateMany({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) {
        const target = invitations.find((i) =>
          Object.entries(where).every(([k, v]) => i[k as keyof Invitation] === v),
        )
        if (!target) return { count: 0 }
        Object.assign(target, data)
        return { count: 1 }
      },
    },
    auditLog: {
      async create({ data }: { data: { action: string } }) {
        audits.push({ action: data.action })
      },
    },
  }
  return { db, members, invitations, audits }
}

const base = { businessId: 'biz-1', invitedById: 'owner-1' }

test('normaliza roles y emails de invitación', () => {
  assert.equal(normalizeTeamRole('ADMIN'), 'ADMIN')
  assert.equal(normalizeTeamRole('SUPERUSER'), null)
  assert.equal(normalizeInviteEmail('  Ana@Gmail.com '), 'ana@gmail.com')
  assert.equal(normalizeInviteEmail('no-es-email'), null)
})

test('invita un email nuevo y lo audita; la re-invitación reutiliza la pendiente', async () => {
  const { db, invitations, audits } = createFakeDb()
  const first = await inviteMemberCore(db, { ...base, email: 'empleado@test.com', role: 'COLLABORATOR', emailAlreadyMember: false })
  assert.ok(first.ok)
  assert.equal(invitations.length, 1)
  assert.equal(audits[0].action, 'team.invited')

  const second = await inviteMemberCore(db, { ...base, email: 'empleado@test.com', role: 'VIEWER', emailAlreadyMember: false })
  assert.ok(second.ok)
  assert.equal(second.reused, true)
  assert.equal(invitations.length, 1)
  assert.equal(invitations[0].role, 'VIEWER')
})

test('no invita a quien ya es miembro ni acepta datos inválidos', async () => {
  const { db, invitations } = createFakeDb()
  const dup = await inviteMemberCore(db, { ...base, email: 'ya@test.com', role: 'COLLABORATOR', emailAlreadyMember: true })
  assert.equal(dup.ok, false)
  const bad = await inviteMemberCore(db, { ...base, email: 'mal', role: 'COLLABORATOR', emailAlreadyMember: false })
  assert.equal(bad.ok, false)
  const badRole = await inviteMemberCore(db, { ...base, email: 'x@x.com', role: 'OWNER', emailAlreadyMember: false })
  assert.equal(badRole.ok, false)
  assert.equal(invitations.length, 0)
})

test('no se puede degradar al último administrador ni auto-degradarse', async () => {
  const { db, members } = createFakeDb()
  members.push({ id: 'm1', userId: 'owner', businessId: 'biz-1', role: 'ADMIN', status: 'ACTIVE' })

  const selfDemote = await changeMemberRoleCore(db, { businessId: 'biz-1', memberId: 'm1', newRole: 'VIEWER', actorUserId: 'owner' })
  assert.equal(selfDemote.ok, false)

  const byOther = await changeMemberRoleCore(db, { businessId: 'biz-1', memberId: 'm1', newRole: 'VIEWER', actorUserId: 'otro' })
  assert.equal(byOther.ok, false)

  members.push({ id: 'm2', userId: 'admin2', businessId: 'biz-1', role: 'ADMIN', status: 'ACTIVE' })
  const nowOk = await changeMemberRoleCore(db, { businessId: 'biz-1', memberId: 'm1', newRole: 'COLLABORATOR', actorUserId: 'admin2' })
  assert.ok(nowOk.ok)
  assert.equal(members[0].role, 'COLLABORATOR')
})

test('quitar miembro: no a uno mismo, no al último admin; el resto funciona', async () => {
  const { db, members } = createFakeDb()
  members.push(
    { id: 'm1', userId: 'owner', businessId: 'biz-1', role: 'ADMIN', status: 'ACTIVE' },
    { id: 'm2', userId: 'empleado', businessId: 'biz-1', role: 'VIEWER', status: 'ACTIVE' },
  )

  assert.equal((await removeMemberCore(db, { businessId: 'biz-1', memberId: 'm1', actorUserId: 'owner' })).ok, false)
  assert.ok((await removeMemberCore(db, { businessId: 'biz-1', memberId: 'm2', actorUserId: 'owner' })).ok)
  assert.equal(members.length, 1)
})

test('una invitación se revoca una sola vez', async () => {
  const { db } = createFakeDb()
  await inviteMemberCore(db, { ...base, email: 'x@x.com', role: 'COLLABORATOR', emailAlreadyMember: false })
  const inv = (await db.businessInvitation.findMany({ where: { businessId: 'biz-1' } }))[0]

  assert.ok((await revokeInvitationCore(db, { businessId: 'biz-1', invitationId: inv.id, actorUserId: 'owner' })).ok)
  assert.equal((await revokeInvitationCore(db, { businessId: 'biz-1', invitationId: inv.id, actorUserId: 'owner' })).ok, false)
})

test('el claim activa membresías sin duplicar y marca las invitaciones', async () => {
  const { db, members, invitations, audits } = createFakeDb()
  await inviteMemberCore(db, { ...base, email: 'nuevo@test.com', role: 'VIEWER', emailAlreadyMember: false })

  const claimed = await claimPendingInvitationsCore(db, { userId: 'user-nuevo', email: 'Nuevo@Test.com' })
  assert.equal(claimed, 1)
  assert.equal(members.length, 1)
  assert.equal(members[0].role, 'VIEWER')
  assert.equal(invitations[0].status, 'ACCEPTED')
  assert.ok(audits.some((a) => a.action === 'team.invitation_accepted'))

  // Segundo login: no duplica la membresía
  const again = await claimPendingInvitationsCore(db, { userId: 'user-nuevo', email: 'nuevo@test.com' })
  assert.equal(again, 0)
  assert.equal(members.length, 1)
})
