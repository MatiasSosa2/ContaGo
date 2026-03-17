import AuthShell from '@/components/auth/AuthShell'

export default function VerifyRequestPage() {
  return (
    <AuthShell
      title="Revisa tu email"
      subtitle="Te enviamos un mensaje para continuar con la verificacion de acceso."
    >
      <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-sm leading-6 text-gray-600">
        Si no lo ves de inmediato, revisa spam o promociones. Si el correo no llega, puedes volver e intentar nuevamente.
      </div>
    </AuthShell>
  )
}