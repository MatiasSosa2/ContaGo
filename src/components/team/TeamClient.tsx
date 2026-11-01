'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import {
  changeTeamMemberRole,
  inviteTeamMember,
  removeTeamMember,
  revokeTeamInvitation,
} from '@/app/actions'
import type { TeamInvitationView, TeamMemberView } from '@/server/team/members'

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Administrador',
  COLLABORATOR: 'Colaborador',
  VIEWER: 'Solo lectura',
}

const ROLE_CLS: Record<string, string> = {
  ADMIN: 'bg-[#E8EFE5] text-[#1E4B1C] dark:bg-[#151515] dark:text-[#A8C89C]',
  COLLABORATOR: 'bg-black/[0.06] text-[var(--ds-gray-700)] dark:bg-white/10 dark:text-[var(--ds-gray-200)]',
  VIEWER: 'bg-black/[0.035] text-[var(--ds-gray-500)] dark:bg-white/[0.06]',
}

function iniciales(name: string | null, email: string) {
  const base = name?.trim() || email
  const partes = base.replace(/[^\p{L}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean)
  return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase() || base[0]?.toUpperCase() || '·'
}

const fmtLastLogin = (d: Date | string | null) =>
  d ? `Último acceso: ${new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}` : 'Todavía no ingresó'

export default function TeamClient({
  members,
  invitations,
  canManage,
}: {
  members: TeamMemberView[]
  invitations: TeamInvitationView[]
  canManage: boolean
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function run(action: () => Promise<{ success: boolean; error?: string }>) {
    startTransition(async () => {
      setError(null)
      setNotice(null)
      const result = await action()
      if (!result.success) {
        setError(result.error ?? 'No se pudo completar la acción')
        return
      }
      router.refresh()
    })
  }

  function handleInvite(formData: FormData) {
    run(async () => {
      const result = await inviteTeamMember(formData)
      if (result.success) setNotice('Invitación enviada. Cuando esa persona entre con su email, el negocio le aparece solo.')
      return result
    })
  }

  return (
    <div className="space-y-6">
      {error && (
        <p role="alert" className="rounded-xl border border-[#FEE4E2] bg-[#FEF3F2] px-4 py-3 text-sm text-[#B42318] dark:border-[#2E1919] dark:bg-[#1F1514] dark:text-[#FCA5A5]">{error}</p>
      )}
      {notice && (
        <p role="status" className="rounded-xl border border-[#E8EFE5] bg-[#E8EFE5] px-4 py-3 text-sm text-[#1E4B1C] dark:border-[#303030] dark:bg-[#151515] dark:text-[#A8C89C]">{notice}</p>
      )}

      {canManage && (
        <section className="ds-panel p-4 sm:p-5">
          <h2 className="text-[15px] font-semibold text-[var(--ds-gray-900)] dark:text-white">Invitar a alguien</h2>
          <p className="mt-1 text-[13px] text-[var(--ds-gray-500)]">
            Solo necesitás su email. Si todavía no tiene cuenta, la crea al entrar.
          </p>
          <form action={handleInvite} className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              name="email"
              type="email"
              required
              placeholder="email@empleado.com"
              className="min-h-11 flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-[#235347] dark:border-white/10 dark:bg-white/[0.06]"
            />
            <select
              name="role"
              defaultValue="COLLABORATOR"
              className="min-h-11 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#235347] dark:border-white/10 dark:bg-[var(--ds-gray-800)]"
            >
              <option value="COLLABORATOR">Colaborador (registra movimientos)</option>
              <option value="VIEWER">Solo lectura</option>
              <option value="ADMIN">Administrador (control total)</option>
            </select>
            <button
              type="submit"
              disabled={isPending}
              className="min-h-11 rounded-xl bg-[#1E4B1C] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#102D12] disabled:opacity-60 dark:bg-[#151515] dark:text-[#A8C89C] dark:ring-1 dark:ring-[#A8C89C]/30 dark:hover:bg-black"
            >
              {isPending ? 'Enviando…' : 'Invitar'}
            </button>
          </form>
        </section>
      )}

      <section>
        <h2 className="mb-2 px-1 text-[13px] font-medium text-[var(--ds-gray-500)]">
          Miembros ({members.length})
        </h2>
        <div className="divide-y divide-black/[0.06] overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:divide-white/[0.08] dark:bg-[var(--ds-gray-900)] dark:shadow-none">
          {members.map((m) => (
            <div key={m.memberId} className="flex items-center gap-3 px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E8EFE5] text-[13px] font-semibold text-[#1E4B1C] dark:bg-[#151515] dark:text-[#A8C89C]">
                {iniciales(m.name, m.email)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-[var(--ds-gray-900)] dark:text-white">
                  {m.name || m.email}{m.isSelf ? ' (vos)' : ''}
                </p>
                <p className="truncate text-[12px] text-[var(--ds-gray-500)]">{m.email} · {fmtLastLogin(m.lastLoginAt)}</p>
              </div>
              {canManage && !m.isSelf ? (
                <div className="flex shrink-0 items-center gap-2">
                  <select
                    value={m.role}
                    disabled={isPending}
                    onChange={(e) => run(() => changeTeamMemberRole(m.memberId, e.target.value))}
                    aria-label={`Rol de ${m.name || m.email}`}
                    className="min-h-11 rounded-xl border border-gray-200 bg-white px-2 py-1.5 text-[12px] outline-none focus:border-[#235347] dark:border-white/10 dark:bg-[var(--ds-gray-800)]"
                  >
                    <option value="ADMIN">Administrador</option>
                    <option value="COLLABORATOR">Colaborador</option>
                    <option value="VIEWER">Solo lectura</option>
                  </select>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => run(() => removeTeamMember(m.memberId))}
                    aria-label={`Quitar a ${m.name || m.email}`}
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-[var(--ds-gray-400)] transition hover:bg-[#FEF3F2] hover:text-[#B42318] disabled:opacity-60"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                  </button>
                </div>
              ) : (
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${ROLE_CLS[m.role]}`}>
                  {ROLE_LABEL[m.role]}
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      {invitations.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 text-[13px] font-medium text-[var(--ds-gray-500)]">
            Invitaciones pendientes ({invitations.length})
          </h2>
          <div className="divide-y divide-black/[0.06] overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:divide-white/[0.08] dark:bg-[var(--ds-gray-900)] dark:shadow-none">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium text-[var(--ds-gray-900)] dark:text-white">{inv.email}</p>
                  <p className="text-[12px] text-[var(--ds-gray-500)]">
                    {ROLE_LABEL[inv.role]} · enviada el {new Date(inv.createdAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                {canManage && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => run(() => revokeTeamInvitation(inv.id))}
                    className="min-h-11 shrink-0 rounded-xl border border-gray-200 px-3 text-[12px] font-semibold text-gray-600 transition hover:border-[#B42318] hover:text-[#B42318] disabled:opacity-60 dark:border-white/10 dark:text-gray-300"
                  >
                    Revocar
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
