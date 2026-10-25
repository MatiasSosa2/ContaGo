type Environment = Readonly<Record<string, string | undefined>>

export function getProductionConfigurationErrors(env: Environment): string[] {
  const errors: string[] = []
  const nextAuthSecret = env.NEXTAUTH_SECRET?.trim()
  const databaseUrl = (env.TURSO_DATABASE_URL || env.DATABASE_URL)?.trim()
  const databaseAuthToken = env.TURSO_AUTH_TOKEN?.trim()
  const authEmailProvider = env.AUTH_EMAIL_PROVIDER?.trim().toLowerCase()
  const upstashUrl = env.UPSTASH_REDIS_REST_URL?.trim()
  const upstashToken = env.UPSTASH_REDIS_REST_TOKEN?.trim()

  if (!nextAuthSecret || nextAuthSecret.length < 32) {
    errors.push('NEXTAUTH_SECRET must contain at least 32 characters')
  }

  if (!databaseUrl) {
    errors.push('TURSO_DATABASE_URL or DATABASE_URL is required')
  } else if (!/^(libsql|wss|https):/.test(databaseUrl)) {
    errors.push('Production requires a remote libSQL database URL')
  } else if (!databaseAuthToken) {
    errors.push('TURSO_AUTH_TOKEN is required for the production database')
  }

  const appUrl = env.NEXTAUTH_URL?.trim()
  if (!appUrl) {
    errors.push('NEXTAUTH_URL is required')
  } else {
    try {
      if (new URL(appUrl).protocol !== 'https:') {
        errors.push('NEXTAUTH_URL must use HTTPS in production')
      }
    } catch {
      errors.push('NEXTAUTH_URL must be a valid absolute URL')
    }
  }

  if (authEmailProvider !== 'resend') {
    errors.push('AUTH_EMAIL_PROVIDER must be "resend" in production')
  }
  if (!env.RESEND_API_KEY?.trim()) errors.push('RESEND_API_KEY is required')
  if (!env.AUTH_EMAIL_FROM?.trim()) errors.push('AUTH_EMAIL_FROM is required')

  if (!upstashUrl || !upstashToken) {
    errors.push('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required')
  } else {
    try {
      if (new URL(upstashUrl).protocol !== 'https:') {
        errors.push('UPSTASH_REDIS_REST_URL must use HTTPS')
      }
    } catch {
      errors.push('UPSTASH_REDIS_REST_URL must be a valid absolute URL')
    }
  }

  if (
    (env.MP_CLIENT_ID?.trim() || env.MP_CLIENT_SECRET?.trim()) &&
    !env.MP_TOKEN_ENCRYPTION_KEY?.trim()
  ) {
    errors.push('MP_TOKEN_ENCRYPTION_KEY is required when Mercado Pago is configured')
  }

  return errors
}

export function assertProductionConfiguration(env: Environment = process.env): void {
  const errors = getProductionConfigurationErrors(env)
  if (errors.length > 0) {
    throw new Error(`[configuration] Invalid production environment:\n- ${errors.join('\n- ')}`)
  }
}
