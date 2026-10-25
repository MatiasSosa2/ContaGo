import AuthShell from '@/components/auth/AuthShell'
import RegisterPanel from '@/components/auth/RegisterPanel'

export default function RegisterPage() {
  return (
    <AuthShell
      title="Crea tu cuenta"
      subtitle="Empieza con tus datos básicos. Confirmaremos tu email antes de iniciar."
    >
      <RegisterPanel
        googleEnabled={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)}
        microsoftEnabled={Boolean(process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET)}
      />
    </AuthShell>
  )
}