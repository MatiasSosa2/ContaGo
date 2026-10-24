import AuthShell from '@/components/auth/AuthShell'
import RegisterPanel from '@/components/auth/RegisterPanel'

export default function RegisterPage() {
  return (
    <AuthShell
      title="Crea tu cuenta"
      subtitle="Empieza con tus datos básicos. Confirmaremos tu email antes de iniciar."
    >
      <RegisterPanel />
    </AuthShell>
  )
}