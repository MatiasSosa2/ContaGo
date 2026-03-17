import AuthShell from '@/components/auth/AuthShell'

const ERROR_COPY: Record<string, string> = {
  OAuthSignin: 'No se pudo iniciar el flujo con el proveedor externo.',
  OAuthAccountNotLinked: 'Esta cuenta ya existe con otro metodo de acceso.',
  AccessDenied: 'El acceso fue rechazado.',
  Verification: 'El enlace o codigo de verificacion ya no es valido.',
  NoBusinessAccess: 'La cuenta autenticada no tiene acceso a ningun negocio activo.',
  Default: 'Ocurrio un problema al intentar autenticar la sesion.',
}

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const error = params.error || 'Default'

  return (
    <AuthShell
      title="No pudimos completar el acceso"
      subtitle={ERROR_COPY[error] || ERROR_COPY.Default}
    >
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
        Codigo de error: <span className="font-medium">{error}</span>
      </div>
    </AuthShell>
  )
}