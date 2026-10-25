# Production operations

This runbook describes operational requirements for ContaGo's current
Next.js, Prisma, Turso/libSQL, Resend, Upstash and Vercel-compatible setup.
It is not a substitute for validating the actual provider account, deployment
or legal obligations.

## Required production configuration

Configure secrets in the deployment provider, not in source control:

- `NEXTAUTH_SECRET`: a stable, randomly generated value of at least 32
  characters, identical across all application instances.
- `NEXTAUTH_URL`: the canonical HTTPS origin used for auth callbacks.
- `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`: the production remote libSQL
  database and its access token.
- `AUTH_EMAIL_PROVIDER=resend`, `RESEND_API_KEY` and `AUTH_EMAIL_FROM`: a
  verified sender and active transactional email account.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` when Google sign-in is enabled;
  register `{NEXTAUTH_URL}/api/auth/callback/google` as an authorized redirect URI.
- `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET` and optionally
  `AZURE_AD_TENANT_ID` when Microsoft sign-in is enabled; register
  `{NEXTAUTH_URL}/api/auth/callback/azure-ad` as a redirect URI.
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`: shared rate-limit
  storage for production instances.
- `MP_TOKEN_ENCRYPTION_KEY` when Mercado Pago credentials are enabled.

Production startup validates these settings and fails closed when required
configuration is absent or invalid. Rotate secrets through the provider's
secret-management interface and follow each provider's rotation procedure.
Never put live credentials into CI variables or logs.

## Authentication flows

Google and Microsoft sign-in are enabled only when their provider credentials
are configured. Register the callback URLs shown in `.env.example` with each
identity provider. A first OAuth sign-in creates a default business named
`Mi negocio`; users who already have an active membership keep their existing
businesses. The provider flow verifies the email before granting access.

Before enabling a provider in production, test a new account and an existing
account in staging. Also test email verification, password reset, password
change, and a second login attempt while the single-session lock is active.
Password changes and resets revoke the active application session.

## Deployment and database migrations

1. Back up the target database and confirm the backup is restorable before a
   schema change.
2. Review the migration SQL, data impact, provider compatibility and expected
   lock/downtime characteristics.
3. Apply reviewed migrations to a staging database and run smoke checks.
4. Deploy the application and migration in a controlled release. Do not use
   `prisma migrate dev` against production; use the approved production
   migration procedure for the selected database provider.
5. Verify the public health endpoint, sign-in, a read-only business workflow,
   and the error/availability dashboards.
6. If verification fails, follow a pre-reviewed rollback or forward-fix plan.
   Do not assume that rolling back application code reverses a database
   migration.

The repository currently has Prisma migration SQL for SQLite and a runtime
libSQL adapter. The current CI migration test uses a new local SQLite database;
it does not certify deployment against a remote Turso database. Validate every
migration against the exact deployed Turso environment before release; local
SQLite success alone is not sufficient.

## Backup and recovery

Backups must be configured and retained using the database provider's
supported mechanism and the organization's retention/privacy policy. This
repository does not configure provider-side backup schedules.

At minimum:

- Document the database backup schedule, retention, encryption and responsible
  owner outside the application repository.
- Record agreed Recovery Point Objective (RPO) and Recovery Time Objective
  (RTO) with the business owner.
- Perform a restore drill in an isolated non-production database before the
  first production launch and on a recurring schedule.
- Verify restored schema, representative financial records, relationships and
  application connectivity; record the result and elapsed recovery time.
- Restrict restore access and securely dispose of temporary restored data.

## Monitoring and incident response

- Monitor `/api/health` and alert on sustained non-200 results and elevated
  database latency.
- Configure Sentry and provider dashboards for server errors, database,
  email, rate-limit and deployment failures.
- Keep `NEXT_PUBLIC_SENTRY_DSN` free of private credentials; keep
  `SENTRY_AUTH_TOKEN` in deployment secrets.
- Define an on-call contact, incident severity, customer communication path,
  credential-rotation procedure and incident log before production use.
- Do not include passwords, auth codes, payment tokens or financial personal
  data in logs or issue reports.

## Release checklist

- [ ] CI passes Prisma validation, lint, type checking, unit/schema/E2E tests
      and production build.
- [ ] Production environment validation passes without exposing secret values.
- [ ] Database backup exists and its restore process has been tested.
- [ ] Migration has been reviewed and tested against a staging copy.
- [ ] Health check and monitoring alerts are active.
- [ ] Sign-in, authorization boundaries and a critical financial workflow have
      been smoke-tested in staging.
- [ ] Rollback/forward-fix owner and customer communication path are known.
