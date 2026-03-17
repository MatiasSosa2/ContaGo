import AuthShell from '@/components/auth/AuthShell'
import LoginPanel from '@/components/auth/LoginPanel'

export default function LoginPage() {
  return (
    <AuthShell
      title="Inicia sesion"
      subtitle="Accede con tu proveedor social o con email y contraseña para seguir junto a tu negocio."
    >
      <LoginPanel
        googleEnabled={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)}
        appleEnabled={Boolean(process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET)}
      />
    </AuthShell>
  )
}