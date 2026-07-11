import { Suspense } from 'react'

import AuthShell from '@/components/auth/AuthShell'
import LoginPanel from '@/components/auth/LoginPanel'

export default function LoginPage() {
  return (
    <AuthShell
      title="Inicia sesion"
      subtitle="Accede con tu proveedor social o con email y contraseña para seguir junto a tu negocio."
    >
      <Suspense fallback={null}>
        <LoginPanel
          googleEnabled={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)}
          microsoftEnabled={Boolean(process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET)}
          temporaryAccessEnabled={Boolean(process.env.TEMP_ACCESS_ADMIN_EMAIL)}
        />
      </Suspense>
    </AuthShell>
  )
}