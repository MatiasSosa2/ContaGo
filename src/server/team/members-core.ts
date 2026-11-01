/**
 * Núcleo de gestión de equipo (sin Prisma ni Next en imports; DB inyectada).
 *
 * Privilegios y guardas:
 * - Solo roles válidos: ADMIN | COLLABORATOR | VIEWER.
 * - Nadie puede quitarse a sí mismo ni degradarse de ADMIN (evita lockout).
 * - Degradar o quitar a un ADMIN exige que quede otro ADMIN activo.
 * - Una invitación PENDING se revoca una sola vez (transición condicional).
 * - El claim al iniciar sesión nunca duplica membresías.
 */

import { logAuditEvent, type AuditDatabase } from '@/server/agent/audit'

export const TEAM_ROLES = ['ADMIN', 'COLLABORATOR', 'VIEWER'] as const
export type TeamRole = (typeof TEAM_ROLES)[number]

export function normalizeTeamRole(role: string | null | undefined): TeamRole | null {
  return role === 'ADMIN' || role === 'COLLABORATOR' || role === 'VIEWER' ? role : null
}

export function normalizeInviteEmail(email: string): string | null {
  const normalized = email.trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null
}

export type TeamMemberRow = { id: string; userId: string; role: string; status: string }

export type TeamDatabase = AuditDatabase & {
  businessMember: {
    findMany(args: { where: Record<string, unknown>; select?: Record<string, unknown> }): Promise<TeamMemberRow[]>
    create(args: { data: { userId: string; businessId: string; role: string; status: string; acceptedAt: Date } }): Promise<{ id: string }>
    updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>
    deleteMany(args: { where: Record<string, unknown> }): Promise<{ count: number }>
  }
  businessInvitation: {
    findMany(args: { where: Record<string, unknown> }): Promise<{ id: string; businessId: string; role: string; status: string }[]>
    findFirst(args: { where: Record<string, unknown> }): Promise<{ id: string; role: string; status: string } | null>
    create(args: { data: { businessId: string; email: string; role: string; invitedById: string } }): Promise<{ id: string }>
    updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>
  }
}

export type TeamResult = { ok: true } | { ok: false; error: string }

const fail = (error: string): TeamResult => ({ ok: false, error })
const ok: TeamResult = { ok: true }

/** Invita un email al negocio. Reutiliza una invitación pendiente si ya existe. */
export async function inviteMemberCore(
  db: TeamDatabase,
  input: { businessId: string; email: string; role: string; invitedById: string; emailAlreadyMember: boolean },
): Promise<TeamResult & { invitationId?: string; reused?: boolean }> {
  const email = normalizeInviteEmail(input.email)
  if (!email) return { ...fail('Ingresá un email válido') }
  const role = normalizeTeamRole(input.role)
  if (!role) return { ...fail('Rol inválido') }

  if (input.emailAlreadyMember) return { ...fail('Ese email ya es parte del negocio') }

  const pending = await db.businessInvitation.findFirst({
    where: { businessId: input.businessId, email, status: 'PENDING' },
  })
  if (pending) {
    // Re-invitación: solo actualiza el rol (mismo vínculo pendiente)
    await db.businessInvitation.updateMany({
      where: { id: pending.id, status: 'PENDING' },
      data: { role },
    })
    await logAuditEvent(db, {
      businessId: input.businessId,
      actor: 'USER',
      action: 'team.invitation_resent',
      entityType: 'BusinessInvitation',
      entityId: pending.id,
      summary: `Invitación reenviada a ${email} como ${role}`,
      userId: input.invitedById,
    })
    return { ok: true, invitationId: pending.id, reused: true }
  }

  const invitation = await db.businessInvitation.create({
    data: { businessId: input.businessId, email, role, invitedById: input.invitedById },
  })
  await logAuditEvent(db, {
    businessId: input.businessId,
    actor: 'USER',
    action: 'team.invited',
    entityType: 'BusinessInvitation',
    entityId: invitation.id,
    summary: `Invitación enviada a ${email} como ${role}`,
    userId: input.invitedById,
  })
  return { ok: true, invitationId: invitation.id }
}

async function countOtherActiveAdmins(db: TeamDatabase, businessId: string, excludeMemberId: string): Promise<number> {
  const admins = await db.businessMember.findMany({
    where: { businessId, role: 'ADMIN', status: 'ACTIVE' },
  })
  return admins.filter((m) => m.id !== excludeMemberId).length
}

/** Cambia el rol de un miembro activo. */
export async function changeMemberRoleCore(
  db: TeamDatabase,
  input: { businessId: string; memberId: string; newRole: string; actorUserId: string },
): Promise<TeamResult> {
  const newRole = normalizeTeamRole(input.newRole)
  if (!newRole) return fail('Rol inválido')

  const members = await db.businessMember.findMany({
    where: { id: input.memberId, businessId: input.businessId, status: 'ACTIVE' },
  })
  const member = members[0]
  if (!member) return fail('El miembro no existe o no pertenece al negocio')
  if (member.role === newRole) return ok

  if (member.userId === input.actorUserId && member.role === 'ADMIN' && newRole !== 'ADMIN') {
    return fail('No podés quitarte el rol de administrador a vos mismo')
  }
  if (member.role === 'ADMIN' && newRole !== 'ADMIN') {
    const others = await countOtherActiveAdmins(db, input.businessId, member.id)
    if (others === 0) return fail('El negocio necesita al menos un administrador')
  }

  const updated = await db.businessMember.updateMany({
    where: { id: member.id, businessId: input.businessId, status: 'ACTIVE', role: member.role },
    data: { role: newRole },
  })
  if (updated.count !== 1) return fail('El miembro cambió mientras tanto. Recargá e intentá de nuevo.')

  await logAuditEvent(db, {
    businessId: input.businessId,
    actor: 'USER',
    action: 'team.role_changed',
    entityType: 'BusinessMember',
    entityId: member.id,
    summary: `Rol cambiado de ${member.role} a ${newRole}`,
    metadata: { targetUserId: member.userId },
    userId: input.actorUserId,
  })
  return ok
}

/** Quita a un miembro del negocio. */
export async function removeMemberCore(
  db: TeamDatabase,
  input: { businessId: string; memberId: string; actorUserId: string },
): Promise<TeamResult> {
  const members = await db.businessMember.findMany({
    where: { id: input.memberId, businessId: input.businessId, status: 'ACTIVE' },
  })
  const member = members[0]
  if (!member) return fail('El miembro no existe o no pertenece al negocio')
  if (member.userId === input.actorUserId) return fail('No podés quitarte del negocio a vos mismo')

  if (member.role === 'ADMIN') {
    const others = await countOtherActiveAdmins(db, input.businessId, member.id)
    if (others === 0) return fail('El negocio necesita al menos un administrador')
  }

  const removed = await db.businessMember.deleteMany({
    where: { id: member.id, businessId: input.businessId, status: 'ACTIVE' },
  })
  if (removed.count !== 1) return fail('El miembro cambió mientras tanto. Recargá e intentá de nuevo.')

  await logAuditEvent(db, {
    businessId: input.businessId,
    actor: 'USER',
    action: 'team.member_removed',
    entityType: 'BusinessMember',
    entityId: member.id,
    summary: 'Miembro quitado del negocio',
    metadata: { targetUserId: member.userId },
    userId: input.actorUserId,
  })
  return ok
}

/** Revoca una invitación pendiente (una sola vez). */
export async function revokeInvitationCore(
  db: TeamDatabase,
  input: { businessId: string; invitationId: string; actorUserId: string },
): Promise<TeamResult> {
  const updated = await db.businessInvitation.updateMany({
    where: { id: input.invitationId, businessId: input.businessId, status: 'PENDING' },
    data: { status: 'REVOKED' },
  })
  if (updated.count !== 1) return fail('La invitación ya no está pendiente')

  await logAuditEvent(db, {
    businessId: input.businessId,
    actor: 'USER',
    action: 'team.invitation_revoked',
    entityType: 'BusinessInvitation',
    entityId: input.invitationId,
    summary: 'Invitación revocada',
    userId: input.actorUserId,
  })
  return ok
}

/**
 * Reclama las invitaciones pendientes del email (ya verificado) al iniciar sesión:
 * crea la membresía ACTIVE si no existe y marca la invitación como aceptada.
 * Devuelve cuántas se activaron. Nunca duplica membresías.
 */
export async function claimPendingInvitationsCore(
  db: TeamDatabase,
  input: { userId: string; email: string },
): Promise<number> {
  const email = normalizeInviteEmail(input.email)
  if (!email) return 0

  const pending = await db.businessInvitation.findMany({
    where: { email, status: 'PENDING' },
  })
  let claimed = 0

  for (const invitation of pending) {
    // Transición condicional: si otro login concurrente ya la tomó, no hacer nada
    const taken = await db.businessInvitation.updateMany({
      where: { id: invitation.id, status: 'PENDING' },
      data: { status: 'ACCEPTED', acceptedAt: new Date() },
    })
    if (taken.count !== 1) continue

    const existing = await db.businessMember.findMany({
      where: { businessId: invitation.businessId, userId: input.userId, status: 'ACTIVE' },
    })
    if (existing.length === 0) {
      await db.businessMember.create({
        data: {
          userId: input.userId,
          businessId: invitation.businessId,
          role: invitation.role,
          status: 'ACTIVE',
          acceptedAt: new Date(),
        },
      })
    }

    await logAuditEvent(db, {
      businessId: invitation.businessId,
      actor: 'SYSTEM',
      action: 'team.invitation_accepted',
      entityType: 'BusinessInvitation',
      entityId: invitation.id,
      summary: `Invitación aceptada por ${email}`,
      userId: input.userId,
    })
    claimed += 1
  }

  return claimed
}
