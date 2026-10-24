# Auditoría de seguridad de ContaGo

Referencia: [cloudflare/security-audit-skill](https://github.com/cloudflare/security-audit-skill), adaptado a una revisión de código de solo lectura seguida de correcciones. No se ejecutó el flujo completo de seis fases en sandbox.

## Hallazgos y estado

| # | Severidad | Hallazgo | Estado |
|---|-----------|----------|--------|
| 1 | 🟠 HIGH | Enumeración de cuentas en el registro (mensaje distinto si el email existe) | Corregido |
| 2 | 🟡 MEDIUM | Sin headers de seguridad (CSP, HSTS, X-Frame-Options, etc.) | Corregido |
| 3 | 🟡 MEDIUM | IP de cliente spoofeable por `x-forwarded-for` (rate limit) | Corregido |
| 4 | 🟠 HIGH | Modo mock de autenticación podía activarse fuera de desarrollo | Corregido |
| 5 | 🟡 MEDIUM | `postVerifyChallengeId` reutilizable durante 120 s | Corregido: consumo atómico (`loginConsumedAt`) |
| 6 | 🟡 MEDIUM | `/api/health` exponía mensajes de error, versión y entorno | Corregido |
| 7 | 🟡 MEDIUM | Proveedor `azure-ad` tratado como `credentials` en el enrutamiento de verificación | Corregido |
| 8 | 🟡 MEDIUM | Sesiones JWT no revocadas al cambiar la contraseña | Corregido: `passwordChangedAt` invalida sesiones anteriores |
| 9 | ⚪ LOW | Sin throttle de envío de códigos por email | Corregido |
| 10 | ⚪ LOW | `/api/foto/[id]` sin verificar sesión ni negocio activo | Corregido |

## Correcciones aplicadas

- **Mock solo fuera de producción** (`src/lib/auth.ts`, `src/app/auth/actions.ts`, `src/app/actions.ts`): `allowMock = NODE_ENV !== 'production'`.
- **Código de verificación** (`src/server/auth/challenges.ts`): el pepper usa `AUTH_CHALLENGE_PEPPER` o `NEXTAUTH_SECRET`. En producción falla si faltan ambos. Ya no tiene un valor de desarrollo hardcodeado en producción.
- **Envío de email** (`src/server/auth/email.ts`): en producción solo se permite el proveedor `resend`. Si no está configurado, falla en lugar de escribir el código en consola.
- **Registro uniforme** (`src/app/auth/actions.ts`): si el email ya existe, se responde igual que un registro nuevo y no se crea ni envía nada. Eliminé `prepareCredentialsLogin`, que no se usaba.
- **Throttle de códigos** (`src/app/auth/actions.ts`): máximo 3 códigos por email cada 10 minutos. Por encima de ese límite se responde éxito sin enviar.
- **Azure AD** (`src/lib/auth.ts`, `src/types/next-auth.d.ts`, `src/server/auth/get-session-context.ts`, `src/server/auth/login-security.ts`, `src/components/AppHeader.tsx`): `azure-ad` se mapea como proveedor social.
- **IP confiable** (`src/middleware.ts`): usa `x-real-ip` o, si no existe, el último valor de `x-forwarded-for`.
- **Health** (`src/app/api/health/route.ts`): respuesta mínima pública. El error solo se registra con `console.error`.
- **Foto** (`src/app/api/foto/[id]/route.ts`): exige sesión con negocio activo (404 si no hay) y envía `X-Content-Type-Options: nosniff`.
- **Headers** (`next.config.ts`): CSP, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS, y `poweredByHeader: false`. `upgrade-insecure-requests` solo fuera de desarrollo.

## Decisiones y trade-offs

- **Registro**: un usuario existente que se registra otra vez ve la pantalla de código y no recibe correo. Es el costo de no revelar qué emails existen.
- **Rate limit**: sin `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`, el límite es fail-open y no bloquea. Hay que confirmar que Production las tenga configuradas.
- **CSP**: incluye `'unsafe-inline'` en scripts y estilos porque Next.js lo necesita sin nonces. Se pueden endurecer después con nonces.

## Migración de base de datos

Migración: `prisma/migrations/20261010120000_auth_session_revocation_and_login_challenge`. Agrega `User.passwordChangedAt` y `EmailChallenge.loginConsumedAt` (ambas opcionales). Ya está aplicada en la base de Turso compartida (columnas verificadas; no se modificaron datos).

Nota: la base de Turso no tiene la tabla `_prisma_migrations`, así que las migraciones anteriores no se registraron con `prisma migrate`. Un `prisma migrate deploy` contra esa base intentaría reaplicar todo el historial. Para migraciones futuras conviene usar `prisma db push` o reconciliar el historial antes.

Cualquier cambio de esquema debe aplicarse a la base de Turso antes de desplegar código que dependa de esos campos.

## Verificación

- `pnpm exec tsc --noEmit`: sin errores.
- `pnpm exec eslint src next.config.ts`: 0 errores y 1 warning preexistente (`businessId` sin uso en `src/app/page.tsx`).
- `pnpm run build`: compila y genera todas las rutas.
- `pnpm run test:zod`: 5 validaciones pasan.

Pendiente: probar en navegador el login con credenciales y con Google bajo el CSP nuevo.

## Limitaciones de la revisión

- No se revisó completo `src/app/actions*.ts`, las páginas de reset ni `prisma.config.ts`.
- No se consultaron advisories de dependencias (`pnpm audit`).
- La configuración real de Vercel (variables y dominios) no se verificó.

## Integración Mercado Pago (vinculación y revisión de movimientos)

- Acceso: solo rol ADMIN. Página /mercadopago; OAuth en /api/mercadopago/connect y /api/mercadopago/callback.
- El state de OAuth va en una cookie httpOnly cifrada, ligada a usuario, negocio, nonce y vencimiento (10 min).
- Tokens de acceso y refresh cifrados en reposo (AES-256-GCM) con MP_TOKEN_ENCRYPTION_KEY.
- Sincronización: consulta pagos aprobados por fecha de aprobación; se guardan en una tabla de revisión (MercadoPagoPayment, estado PENDING). No se crea ningún movimiento hasta que el usuario lo importe.
- Importación: crea un INGRESO (subtipo OTHER_INCOME) por el monto neto; la descripción conserva el bruto y la comisión.
- Pendiente: devoluciones y contracargos no se tratan; no hay prueba contra la API real de Mercado Pago todavía.
- Variables: MP_CLIENT_ID, MP_CLIENT_SECRET, MP_REDIRECT_URI, MP_TOKEN_ENCRYPTION_KEY (ver .env.example).
