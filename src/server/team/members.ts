/**
 * Acciones de equipo con contexto de sesión (la lógica vive en ./members-core).
 * Gestión = solo ADMIN del negocio; listado = cualquier miembro activo.
 */

import { revalidatePath } from 'next/cache'

import type { ActionResult } from '@/lib/validations'
import { requireBusinessAdminContext, requireBusinessContext } from '@/server/auth/require-business-context'
import { sendTeamInviteEmail } from '@/server/auth/email'

import {
  changeMemberRoleCore,
  claimPendingInvitationsCore,
  inviteMemberCore,
  normalizeTeamRole,
  removeMemberCore,
  revokeInvitationCore,
  type TeamRole,
} from './members-core'

export type TeamMemberView = {
  memberId: string
  userId: string
  name: string | null
  email: string
  role: TeamRole
  status: string
  lastLoginAt: Date | null
  isSelf: boolean
}

export type TeamInvitationView = {
  id: string
  email: string
  role: TeamRole
  createdAt: Date
}

export type TeamView = {
  members: TeamMemberView[]
  invitations: TeamInvitationView[]
  canManage: boolean
}

export async function getTeam(): Promise<TeamView> {
  const sessionContext = await requireBusinessContext()
  const businessId = sessionContext.activeBusiness.id

  const { default: prisma } = await import('@/lib/prisma')
  const [members, invitations] = await Promise.all([
    prisma.businessMember.findMany({
      where: { businessId, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        role: true,
        status: true,
        user: { select: { id: true, name: true, email: true, lastLoginAt: true } },
      },
    }),
    prisma.businessInvitation.findMany({
      where: { businessId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, role: true, createdAt: true },
    }),
  ])

  return {
    members: members.map((m) => ({
      memberId: m.id,
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      role: normalizeTeamRole(m.role) ?? 'COLLABORATOR',
      status: m.status,
      lastLoginAt: m.user.lastLoginAt,
      isSelf: m.user.id === sessionContext.user.id,
    })),
    invitations: invitations.map((i) => ({
      id: i.id,
      email: i.email,
      role: normalizeTeamRole(i.role) ?? 'COLLABORATOR',
      createdAt: i.createdAt,
    })),
    canManage: sessionContext.activeBusiness.role === 'ADMIN',
  }
}

function mapError<T = void>(result: { ok: boolean; error?: string }): ActionResult<T> {
  return result.ok ? { success: true } : { success: false, error: result.error ?? 'No se pudo completar la acción' }
}

export async function inviteTeamMember(formData: FormData): Promise<ActionResult<{ invitationId?: string; reused: boolean }>> {
  const sessionContext = await requireBusinessAdminContext()
  const businessId = sessionContext.activeBusiness.id
  const email = String(formData.get('email') || '')
  const role = String(formData.get('role') || 'COLLABORATOR')

  const { default: prisma } = await import('@/lib/prisma')

  // ¿Ya es miembro activo con ese email?
  const existingUser = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true },
  })
  const emailAlreadyMember = existingUser
    ? (await prisma.businessMember.count({
        where: { businessId, userId: existingUser.id, status: 'ACTIVE' },
      })) > 0
    : false

  const result = await inviteMemberCore(prisma, {
    businessId,
    email,
    role,
    invitedById: sessionContext.user.id,
    emailAlreadyMember,
  })
  if (!result.ok) return mapError(result)

  // Aviso por email (best-effort: nunca bloquea la invitación)
  void sendTeamInviteEmail({
    email: email.trim().toLowerCase(),
    businessName: sessionContext.activeBusiness.name,
    role: normalizeTeamRole(role) ?? 'COLLABORATOR',
  }).catch(() => null)

  revalidatePath('/equipo')
  return { success: true, data: { invitationId: result.invitationId, reused: result.reused ?? false } }
}

export async function changeTeamMemberRole(memberId: string, newRole: string): Promise<ActionResult> {
  const sessionContext = await requireBusinessAdminContext()
  const { default: prisma } = await import('@/lib/prisma')
  const result = await changeMemberRoleCore(prisma, {
    businessId: sessionContext.activeBusiness.id,
    memberId,
    newRole,
    actorUserId: sessionContext.user.id,
  })
  if (result.ok) revalidatePath('/equipo')
  return mapError(result)
}

export async function removeTeamMember(memberId: string): Promise<ActionResult> {
  const sessionContext = await requireBusinessAdminContext()
  const { default: prisma } = await import('@/lib/prisma')
  const result = await removeMemberCore(prisma, {
    businessId: sessionContext.activeBusiness.id,
    memberId,
    actorUserId: sessionContext.user.id,
  })
  if (result.ok) revalidatePath('/equipo')
  return mapError(result)
}

export async function revokeTeamInvitation(invitationId: string): Promise<ActionResult> {
  const sessionContext = await requireBusinessAdminContext()
  const { default: prisma } = await import('@/lib/prisma')
  const result = await revokeInvitationCore(prisma, {
    businessId: sessionContext.activeBusiness.id,
    invitationId,
    actorUserId: sessionContext.user.id,
  })
  if (result.ok) revalidatePath('/equipo')
  return mapError(result)
}

/** La llama NextAuth al iniciar sesión con email verificado: activa las invitaciones pendientes. */
export async function claimPendingInvitations(userId: string, email: string | null | undefined): Promise<number> {
  if (!email) return 0
  const { default: prisma } = await import('@/lib/prisma')
  return claimPendingInvitationsCore(prisma, { userId, email })
}
