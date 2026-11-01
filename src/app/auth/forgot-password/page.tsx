import AuthShell from '@/components/auth/AuthShell'
import ForgotPasswordPanel from '@/components/auth/ForgotPasswordPanel'

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Recuperá tu contraseña"
      subtitle="Te enviaremos un código temporal para definir una nueva contraseña."
    >
      <ForgotPasswordPanel />
    </AuthShell>
  )
}