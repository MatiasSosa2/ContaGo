import AuthShell from '@/components/auth/AuthShell'
import RegisterPanel from '@/components/auth/RegisterPanel'

export default function RegisterPage() {
  return (
    <AuthShell
      title="Crea tu cuenta"
      subtitle="Registra tu negocio, define una contraseña y valida tu email con codigo."
    >
      <RegisterPanel />
    </AuthShell>
  )
}