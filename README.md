# ContaGo

ContaGo is a financial management application built with Next.js, TypeScript,
Prisma and libSQL/Turso.

## Requirements

- Node.js 22
- pnpm 10.25.0
- A Turso/libSQL database for production, or SQLite for local development

## Local development

1. Install the pinned dependencies:

   ```sh
   pnpm install --frozen-lockfile
   ```

2. Copy `.env.example` to `.env` and configure the database URL and token.
   Use a local SQLite URL such as `DATABASE_URL="file:./dev.db"` when
   developing without Turso. In that case, remove or comment out
   `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`; Prisma gives Turso precedence
   over `DATABASE_URL`.
3. Apply local migrations and generate the Prisma client:

   ```sh
   pnpm exec prisma migrate dev
   pnpm exec prisma generate
   ```

4. Start the development server:

   ```sh
   pnpm dev
   ```

## Quality checks

```sh
pnpm lint
pnpm exec tsc --noEmit
pnpm test:unit
pnpm test:zod
pnpm test:e2e
pnpm build
```

The GitHub Actions workflow runs these checks, validates Prisma migrations,
and builds the production bundle on pull requests and pushes to `main`.
The lint command covers app, E2E and test code; legacy database-maintenance
scripts are not lint-gated yet and should be brought into that gate separately.

## Production configuration

Production startup validates the authentication secret, canonical HTTPS URL,
remote libSQL database, Resend email delivery and Upstash rate limiting.
Missing or invalid required settings stop startup rather than silently
disabling protections. Never use real production credentials in CI.

See [OPERATIONS.md](./OPERATIONS.md) for deployment, migration, backup and
recovery expectations.
