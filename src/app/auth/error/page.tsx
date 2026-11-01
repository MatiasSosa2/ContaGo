import AuthShell from '@/components/auth/AuthShell'
import Link from 'next/link'

const ERROR_COPY: Record<string, { title: string; description: string; nextStep: string }> = {
  SessionLimitReached: {
    title: 'Ya hay tres dispositivos conectados',
    description: 'Esta cuenta alcanzó el máximo de 3 sesiones simultáneas.',
    nextStep: 'Cierra sesión en uno de tus otros dispositivos y vuelve a intentarlo. Si ya no tienes acceso a ellos, espera a que sus sesiones expiren.',
  },
  CredentialsSignin: {
    title: 'No se pudieron validar esos datos',
    description: 'El email o la contraseña no coinciden con una cuenta activa.',
    nextStep: 'Revisa los datos o usa la opción para recuperar tu contraseña.',
  },
  AuthenticationUnavailable: {
    title: 'No se pudo comprobar la sesión',
    description: 'El servicio de autenticación o la base de datos no respondió correctamente. No se inició una sesión nueva.',
    nextStep: 'Inténtalo nuevamente en unos minutos. Si el problema continúa, contacta al administrador e informa el código AUTHENTICATION_UNAVAILABLE.',
  },
  OAuthSignin: {
    title: 'No se pudo iniciar el acceso externo',
    description: 'El proveedor de acceso no pudo iniciar el proceso.',
    nextStep: 'Inténtalo nuevamente o inicia sesión con email y contraseña.',
  },
  OAuthCallback: {
    title: 'No se pudo completar el acceso externo',
    description: 'El proveedor no pudo confirmar la autenticación o la respuesta llegó incompleta.',
    nextStep: 'Vuelve a iniciar el proceso. Si se repite, contacta al administrador.',
  },
  OAuthAccountNotLinked: {
    title: 'La cuenta usa otro método de acceso',
    description: 'Este email ya está asociado a una cuenta creada con otro método.',
    nextStep: 'Inicia sesión con el método que utilizaste al crear la cuenta.',
  },
  AccessDenied: {
    title: 'Acceso denegado',
    description: 'La cuenta no tiene permisos para completar esta acción.',
    nextStep: 'Inicia sesión con una cuenta autorizada o contacta al administrador del negocio.',
  },
  Verification: {
    title: 'El código de verificación venció',
    description: 'El enlace o código ya no es válido o fue utilizado anteriormente.',
    nextStep: 'Solicita un nuevo código e inténtalo otra vez.',
  },
  NoBusinessAccess: {
    title: 'La cuenta no tiene un negocio activo',
    description: 'La autenticación fue correcta, pero no se encontró acceso a un negocio activo.',
    nextStep: 'Contacta al administrador del negocio para que revise tu membresía.',
  },
  Default: {
    title: 'No pudimos completar el acceso',
    description: 'Ocurrió un problema inesperado durante la autenticación.',
    nextStep: 'Vuelve a intentarlo. Si persiste, contacta al administrador.',
  },
}

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const error = params.error && Object.hasOwn(ERROR_COPY, params.error) ? params.error : 'Default'
  const copy = ERROR_COPY[error]

  return (
    <AuthShell
      title={copy.title}
      subtitle={copy.description}
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-ds-red-100 bg-ds-red-50 px-4 py-4 text-sm leading-6 text-ds-red-800">
          {copy.nextStep}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/auth/login"
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-brand-military px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-military-dark"
          >
            Volver a iniciar sesión
          </Link>
          <Link
            href="/auth/forgot-password"
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-brand-military hover:text-brand-military"
          >
            Recuperar contraseña
          </Link>
        </div>
      </div>
    </AuthShell>
  )
}