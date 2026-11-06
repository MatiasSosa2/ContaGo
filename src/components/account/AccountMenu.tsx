'use client'

import { useEffect, useState, useTransition, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getCsrfToken, signOut } from 'next-auth/react'

import { changePassword, getAccountInfo, setActiveBusiness, updateProfileName } from '@/app/auth/actions'
import { Caption, Group, IOS_FONT, Row, useDismiss } from '@/components/ui/ios'

export type AccountRole = 'ADMIN' | 'COLLABORATOR' | 'VIEWER'
export type AccountProvider = 'google' | 'apple' | 'azure-ad' | 'credentials' | 'mock'

type User = { name?: string | null; email: string; image?: string | null }
type Business = { id?: string; name: string; role: AccountRole }

const ROLE_LABELS: Record<AccountRole, string> = {
  ADMIN: 'Administrador',
  COLLABORATOR: 'Colaborador',
  VIEWER: 'Visualizador',
}

const PROVIDER_LABELS: Record<AccountProvider, string> = {
  google: 'Google',
  apple: 'Apple',
  'azure-ad': 'Microsoft',
  credentials: 'Email y contraseña',
  mock: 'Demo',
}

function getInitials(name?: string | null, email?: string) {
  const source = name?.trim() || email || 'CG'
  const words = source.split(/\s+/).filter(Boolean)
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

function Avatar({ user, size }: { user: User; size: number }) {
  const displayName = user.name?.trim() || user.email
  if (user.image) {
    // eslint-disable-next-line @next/next/no-img-element -- foto de Google/Microsoft: dominio variable, no pasa por next/image
    return <img src={user.image} alt={`Avatar de ${displayName}`} style={{ width: size, height: size }} className="shrink-0 rounded-full object-cover" />
  }
  return (
    <div
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      className="flex shrink-0 items-center justify-center rounded-full bg-[var(--ui-avatar-bg)] font-semibold text-[var(--ui-avatar-text)]"
    >
      {getInitials(user.name, user.email)}
    </div>
  )
}

function Icon({ d }: { d: string }) {
  return (
    <svg className="h-[18px] w-[18px] shrink-0 text-[var(--ds-gray-500)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  )
}

const ICONS = {
  cuenta: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z',
  negocio: 'M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21',
  equipo: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
  integraciones: 'M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244',
  salir: 'M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6A2.25 2.25 0 005.25 5.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l3 3m0 0-3 3m3-3H3.75',
}

const ITEM_CLS = 'flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-[13.5px] text-[var(--ds-gray-900)] transition-colors hover:bg-black/[0.04] dark:text-white dark:hover:bg-white/[0.06]'

function Check() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0 text-[var(--brand-700)] dark:text-[#A8C89C]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.6} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  )
}

/**
 * Tarjeta del usuario arriba a la derecha: al tocarla abre el menú de la cuenta
 * (Mi cuenta, cambiar de negocio, equipo, integraciones y salir).
 */
export default function AccountMenu({ user, business, businesses = [], provider }: {
  user: User
  business: Business
  businesses?: Array<{ id: string; name: string; role: AccountRole }>
  provider: AccountProvider
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [negociosOpen, setNegociosOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [switching, startSwitch] = useTransition()
  const [signingOut, startSignOut] = useTransition()
  const close = () => { setOpen(false); setNegociosOpen(false) }
  const ref = useDismiss(open, close)
  const displayName = user.name?.trim() || user.email.split('@')[0]

  function cambiarNegocio(target: { id: string; name: string; role: AccountRole }) {
    if (target.id === business.id) return
    startSwitch(async () => {
      const fd = new FormData()
      fd.set('businessId', target.id)
      const result = await setActiveBusiness(fd)
      if (!result.success) return
      // El negocio activo viaja en la sesión: se actualiza igual que useSession().update()
      const csrfToken = await getCsrfToken()
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csrfToken, data: { activeBusiness: target } }),
      })
      close()
      router.push('/')
      router.refresh()
    })
  }

  return (
    <div ref={ref} className={`relative hidden shrink-0 lg:block ${IOS_FONT}`}>
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`${displayName} · ${business.name} · ${ROLE_LABELS[business.role]}`}
        className={`flex min-h-11 items-center gap-2.5 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-header)] px-2.5 py-1.5 shadow-[0_6px_22px_rgba(15,23,42,0.06)] transition hover:brightness-[0.98] dark:shadow-[0_10px_28px_rgba(0,0,0,0.32)] ${open ? 'ring-2 ring-[var(--brand-700)]/15' : ''}`}
      >
        <Avatar user={user} size={32} />
        <div className="min-w-0 text-left leading-tight">
          <p className="max-w-[160px] truncate text-[12px] font-semibold text-[var(--ui-label)]">{displayName}</p>
          <p className="max-w-[160px] truncate text-[10.5px] font-medium text-[var(--ui-accent-text)]">{business.name}</p>
        </div>
        <svg className={`h-3 w-3 shrink-0 text-[var(--ds-gray-500)] transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-[280px] overflow-hidden rounded-2xl bg-[var(--ds-white)]/95 shadow-[0_16px_48px_rgba(0,0,0,0.2)] ring-1 ring-black/[0.06] backdrop-blur-xl animate-[reg-pop-in_160ms_ease-out] dark:bg-[var(--ds-gray-800)]/95 dark:ring-white/10"
        >
          {/* Quién sos y en qué negocio */}
          <div className="flex items-center gap-3 px-3.5 pb-3 pt-3.5">
            <Avatar user={user} size={40} />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[14px] font-semibold text-[var(--ds-gray-900)] dark:text-white">{displayName}</p>
              <p className="truncate text-[11.5px] text-[var(--ds-gray-500)]">{user.email}</p>
              <p className="mt-1 truncate text-[11px] font-medium text-[var(--ui-accent-text)]">
                {business.name} · {ROLE_LABELS[business.role]}
              </p>
            </div>
          </div>

          <div className="border-t border-black/[0.06] py-1 dark:border-white/[0.08]">
            <button type="button" role="menuitem" className={ITEM_CLS} onClick={() => { close(); setSheetOpen(true) }}>
              <Icon d={ICONS.cuenta} />
              <span className="flex-1">Mi cuenta</span>
              <span className="text-[11px] text-[var(--ds-gray-500)]">Perfil y seguridad</span>
            </button>

            <button
              type="button"
              role="menuitem"
              aria-expanded={negociosOpen}
              className={ITEM_CLS}
              onClick={() => setNegociosOpen((v) => !v)}
            >
              <Icon d={ICONS.negocio} />
              <span className="flex-1">Cambiar de negocio</span>
              {businesses.length > 1 && <span className="text-[11px] tabular-nums text-[var(--ds-gray-500)]">{businesses.length}</span>}
              <svg className={`h-3 w-3 shrink-0 text-[#C7C7CC] transition-transform ${negociosOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.6} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            {negociosOpen && (
              <div className="mx-2 mb-1 rounded-xl bg-black/[0.03] py-1 dark:bg-white/[0.04]">
                {(businesses.length ? businesses : [{ id: business.id ?? '', name: business.name, role: business.role }]).map((b) => {
                  const actual = b.id === business.id || businesses.length <= 1
                  return (
                    <button
                      key={b.id || b.name}
                      type="button"
                      disabled={switching || actual}
                      onClick={() => cambiarNegocio(b)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors enabled:hover:bg-black/[0.04] disabled:cursor-default dark:enabled:hover:bg-white/[0.06]"
                    >
                      <div className="min-w-0 flex-1 leading-tight">
                        <p className={`truncate text-[13px] ${actual ? 'font-semibold text-[var(--ds-gray-900)] dark:text-white' : 'text-[var(--ds-gray-700)] dark:text-[var(--ds-gray-300)]'}`}>{b.name}</p>
                        <p className="text-[10.5px] text-[var(--ds-gray-500)]">{ROLE_LABELS[b.role]}</p>
                      </div>
                      {actual && <Check />}
                    </button>
                  )
                })}
                {businesses.length <= 1 && (
                  <p className="px-3 pb-1.5 pt-0.5 text-[10.5px] text-[var(--ds-gray-500)]">Por ahora tenés un solo negocio.</p>
                )}
                {switching && <p className="px-3 pb-1.5 text-[10.5px] text-[var(--ds-gray-500)]">Cambiando…</p>}
              </div>
            )}

            <Link href="/equipo" role="menuitem" className={ITEM_CLS} onClick={close}>
              <Icon d={ICONS.equipo} />
              <span className="flex-1">Equipo y permisos</span>
            </Link>
            <Link href="/mercadopago" role="menuitem" className={ITEM_CLS} onClick={close}>
              <Icon d={ICONS.integraciones} />
              <span className="flex-1">Integraciones</span>
              <span className="text-[11px] text-[var(--ds-gray-500)]">Mercado Pago</span>
            </Link>
          </div>

          <div className="border-t border-black/[0.06] py-1 dark:border-white/[0.08]">
            <button
              type="button"
              role="menuitem"
              disabled={signingOut}
              onClick={() => startSignOut(async () => { await signOut({ callbackUrl: '/auth/login' }) })}
              className={`${ITEM_CLS} !text-[var(--expense)] disabled:opacity-50`}
            >
              <svg className="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d={ICONS.salir} />
              </svg>
              <span className="flex-1">{signingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}</span>
            </button>
          </div>
        </div>
      )}

      {sheetOpen && (
        <AccountSheet
          user={user}
          business={business}
          provider={provider}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </div>
  )
}

const FIELD_CLS = 'ios-bare w-full min-w-0 bg-transparent text-right text-[15px] text-[#1C1C1E] outline-none placeholder:text-[#C7C7CC] dark:text-white'

/** Hoja "Mi cuenta": perfil (nombre) y seguridad (contraseña), encima de la pantalla actual */
function AccountSheet({ user, business, provider, onClose }: {
  user: User
  business: Business
  provider: AccountProvider
  onClose: () => void
}) {
  const router = useRouter()
  const inicial = user.name?.trim() || ''
  const [nombre, setNombre] = useState(inicial)
  const [guardado, setGuardado] = useState(inicial)
  const [perfilMsg, setPerfilMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [savingName, startSaveName] = useTransition()

  const [hasPassword, setHasPassword] = useState<boolean | null>(null)
  const [passOpen, setPassOpen] = useState(false)
  const [passError, setPassError] = useState<string | null>(null)
  const [savingPass, startSavePass] = useTransition()

  useEffect(() => {
    let vivo = true
    getAccountInfo().then((info) => { if (vivo) setHasPassword(info.hasPassword) }).catch(() => { if (vivo) setHasPassword(true) })
    return () => { vivo = false }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const nombreCambio = nombre.trim() !== guardado

  function guardarNombre() {
    startSaveName(async () => {
      const fd = new FormData()
      fd.set('name', nombre)
      const result = await updateProfileName(fd)
      if (!result.success) {
        setPerfilMsg({ ok: false, text: result.error })
        return
      }
      setGuardado(nombre.trim().replace(/\s+/g, ' '))
      setPerfilMsg({ ok: true, text: 'Nombre actualizado' })
      router.refresh()
    })
  }

  function cambiarPassword(formData: FormData) {
    startSavePass(async () => {
      setPassError(null)
      const result = await changePassword(formData)
      if (!result.success) {
        setPassError(result.error)
        return
      }
      // Cambiar la contraseña cierra las sesiones: hay que volver a entrar
      await signOut({ redirect: false })
      window.location.assign('/auth/login?passwordChanged=1')
    })
  }

  const passInput = (name: string, placeholder: string, autoComplete: string): ReactNode => (
    <Row>
      <input
        name={name}
        type="password"
        required
        minLength={name === 'currentPassword' ? undefined : 8}
        maxLength={72}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="ios-bare w-full bg-transparent text-[15px] text-[#1C1C1E] outline-none placeholder:text-[#AEAEB2] dark:text-white"
      />
    </Row>
  )

  return createPortal(
    <div className={`fixed inset-0 z-[90] flex items-end justify-center sm:items-center ${IOS_FONT}`} role="dialog" aria-modal="true" aria-label="Mi cuenta">
      <button type="button" aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-black/30 backdrop-blur-[2px] animate-in fade-in duration-200" />
      <div className="relative flex max-h-[92vh] w-full max-w-[440px] flex-col overflow-hidden rounded-t-[22px] bg-[#F2F2F7] shadow-[0_24px_80px_rgba(0,0,0,0.3)] animate-[reg-pop-in_180ms_ease-out] sm:rounded-[22px] dark:bg-[#000]">
        <div className="relative flex h-12 shrink-0 items-center justify-center border-b border-black/[0.06] dark:border-white/[0.08]">
          <p className="text-[15px] font-semibold text-[#1C1C1E] dark:text-white">Mi cuenta</p>
          <button type="button" onClick={onClose} className="absolute right-4 text-[15px] font-semibold text-[var(--brand-700)] active:opacity-60 dark:text-[#A8C89C]">
            Listo
          </button>
        </div>

        <div className="overflow-y-auto px-4 pb-6 pt-5">
          <div className="mb-5 flex flex-col items-center text-center">
            <Avatar user={{ ...user, name: guardado || user.name }} size={64} />
            <p className="mt-2 text-[17px] font-semibold text-[#1C1C1E] dark:text-white">{guardado || user.email.split('@')[0]}</p>
            <p className="text-[12px] text-[#8E8E93]">{user.email}</p>
          </div>

          <Caption>Perfil</Caption>
          <Group>
            <Row>
              <span className="shrink-0 text-[15px] text-[#1C1C1E] dark:text-white">Nombre</span>
              <input
                value={nombre}
                onChange={(e) => { setNombre(e.target.value); setPerfilMsg(null) }}
                onKeyDown={(e) => { if (e.key === 'Enter' && nombreCambio) guardarNombre() }}
                maxLength={60}
                placeholder="Tu nombre"
                aria-label="Nombre"
                className={FIELD_CLS}
              />
            </Row>
            <Row label="Email" value={<span className="max-w-[220px] truncate">{user.email}</span>} />
            <Row label="Negocio" value={<span className="max-w-[220px] truncate">{business.name}</span>} />
            <Row label="Rol" value={ROLE_LABELS[business.role]} />
          </Group>
          {(nombreCambio || perfilMsg) && (
            <div className="mt-2 flex items-center justify-between px-4">
              <p className={`text-[12px] ${perfilMsg ? (perfilMsg.ok ? 'text-[var(--income)]' : 'text-[var(--expense)]') : 'text-[#8E8E93]'}`}>
                {perfilMsg?.text ?? 'Cambios sin guardar'}
              </p>
              {nombreCambio && (
                <button
                  type="button"
                  onClick={guardarNombre}
                  disabled={savingName}
                  className="text-[15px] font-semibold text-[var(--brand-700)] active:opacity-60 disabled:opacity-50 dark:text-[#A8C89C]"
                >
                  {savingName ? 'Guardando…' : 'Guardar'}
                </button>
              )}
            </div>
          )}

          <Caption>Seguridad</Caption>
          <Group>
            <Row label="Acceso con" value={PROVIDER_LABELS[provider]} />
            <Row
              label="Contraseña"
              value={hasPassword === null ? '' : passOpen ? 'Cancelar' : hasPassword ? 'Cambiar' : 'Crear'}
              chevron={!passOpen}
              onClick={() => { setPassOpen((v) => !v); setPassError(null) }}
            />
          </Group>

          {passOpen && hasPassword !== null && (
            <form action={cambiarPassword} className="mt-3">
              {!hasPassword && (
                <p className="mb-2 px-4 text-[12px] text-[#8E8E93]">
                  Tu cuenta se creó con {PROVIDER_LABELS[provider]}. Podés crear una contraseña para entrar también con tu email.
                </p>
              )}
              <Group>
                {hasPassword && passInput('currentPassword', 'Contraseña actual', 'current-password')}
                {passInput('newPassword', 'Nueva contraseña (mín. 8)', 'new-password')}
                {passInput('confirmPassword', 'Repetir nueva contraseña', 'new-password')}
              </Group>
              {passError && <p className="mt-2 px-4 text-[12px] text-[var(--expense)]">{passError}</p>}
              <p className="mt-2 px-4 text-[11.5px] text-[#8E8E93]">Al cambiarla se cierran tus sesiones y volvés a entrar con la nueva.</p>
              <button
                type="submit"
                disabled={savingPass}
                className="mt-3 w-full rounded-xl bg-[var(--brand-700)] py-3 text-[15px] font-semibold text-white transition hover:brightness-95 active:scale-[0.99] disabled:opacity-50"
              >
                {savingPass ? 'Actualizando…' : hasPassword ? 'Actualizar contraseña' : 'Crear contraseña'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
