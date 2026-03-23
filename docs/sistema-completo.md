# ContaGo — Documentación Completa del Sistema

**Versión:** 0.1.0  
**Fecha:** 20 de marzo de 2026  
**Estado:** Fase 1 en ejecución (Identidad, Acceso y Negocio Activo)

---

## Índice

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Stack Tecnológico](#2-stack-tecnológico)
3. [Estructura del Proyecto](#3-estructura-del-proyecto)
4. [Configuración y Build](#4-configuración-y-build)
5. [Base de Datos — Esquema Prisma](#5-base-de-datos--esquema-prisma)
6. [Migraciones](#6-migraciones)
7. [Sistema de Autenticación](#7-sistema-de-autenticación)
8. [Server Actions y Lógica de Negocio](#8-server-actions-y-lógica-de-negocio)
9. [Sistema de Rutas y Páginas](#9-sistema-de-rutas-y-páginas)
10. [Componentes UI](#10-componentes-ui)
11. [Sistema de Temas y Estilos](#11-sistema-de-temas-y-estilos)
12. [Datos de Seed y Mock](#12-datos-de-seed-y-mock)
13. [Modelo de Negocio y Roadmap](#13-modelo-de-negocio-y-roadmap)
14. [Estado Actual y Pendientes](#14-estado-actual-y-pendientes)
15. [Análisis de Riesgos y Recomendaciones](#15-análisis-de-riesgos-y-recomendaciones)

---

## 1. Resumen Ejecutivo

**ContaGo** es una plataforma web de gestión contable y financiera construida con Next.js 16, React 19, Prisma 7, NextAuth 4 y Tailwind CSS v4. Está dirigida específicamente a **dueños de negocios, monotributistas y PYMEs de Argentina**.

El sistema permite registrar ingresos, egresos, créditos/deudas, inventario y bienes de uso, con dashboards visuales, reportes financieros y un modelo multi-tenant donde cada usuario puede administrar uno o múltiples negocios.

| Concepto | Valor |
|---|---|
| Público objetivo | Monotributistas, dueños de negocios, PYMEs (Argentina) |
| Modelo de negocio | Freemium (gratis con límites + suscripción pago) |
| Arquitectura DB | Multi-tenant: User → BusinessMember → Business (N:M) |
| Frontend | React 19 + TypeScript + Tailwind CSS v4 + ECharts |
| Backend | Next.js App Router + Server Actions |
| Auth | NextAuth.js con Google, Apple y credenciales (email/password) |
| Database | SQLite local / Turso (libSQL remoto) con Prisma ORM |
| Deploy | Vercel |
| MVP estimado | ~10 de abril de 2026 |

---

## 2. Stack Tecnológico

### 2.1 Frontend

| Tecnología | Versión | Rol |
|---|---|---|
| Next.js | 16.1.6 | Framework principal (App Router, Turbopack, React Compiler) |
| React | 19.2.3 | Librería UI |
| TypeScript | 5 | Lenguaje |
| Tailwind CSS | 4 | Sistema de estilos utilitario |
| ECharts | 6.0.0 | Gráficos interactivos (barras, donuts, gauges, sparklines) |
| echarts-for-react | 3.0.6 | Wrapper React para ECharts |
| Recharts | 3.7.0 | Librería de gráficos adicional (duplicada, pendiente remoción) |
| Zod | 4.3.6 | Validación de schemas en cliente y servidor |
| date-fns | 4.1.0 | Utilidades de manejo de fechas |
| react-day-picker | 9.14.0 | Componente de calendario para selección de fechas/rangos |

### 2.2 Backend y Runtime

| Tecnología | Versión | Rol |
|---|---|---|
| Next.js Server Actions | — | Mutaciones server-side (usa `"use server"`) |
| Next.js API Routes | — | Handlers HTTP (`/api/auth/[...nextauth]`) |
| Prisma ORM | 7.4.1 | Acceso a base de datos tipado |
| @prisma/adapter-libsql | 7.4.1 | Adaptador para Turso (libSQL) |
| @libsql/client | 0.17.0 | Cliente oficial de Turso |
| next-auth | 4.24.13 | Autenticación y sesiones |
| @next-auth/prisma-adapter | 1.0.7 | Persistencia de cuentas OAuth via Prisma |
| bcryptjs | 3.0.3 | Hashing de contraseñas (cost factor 12) |

### 2.3 Herramientas de Desarrollo

| Tecnología | Versión | Rol |
|---|---|---|
| ESLint | 9 | Linting con `next/core-web-vitals` + TypeScript |
| PostCSS | — | Procesamiento CSS con plugin `@tailwindcss/postcss` |
| tsx | 4.21.0 | Transpiler para ejecutar scripts TS (seed, etc.) |
| babel-plugin-react-compiler | 1.0.0 | Optimizaciones automáticas de React |
| Prisma CLI | 7.4.1 | Migraciones, generación de cliente, seed |

### 2.4 Servicios Externos

| Servicio | Uso |
|---|---|
| Turso (libSQL) | Base de datos en producción (SQLite compatible, edge-optimized) |
| Resend | Envío de emails transaccionales (códigos de verificación) |
| Google OAuth | Login social con Google |
| Apple OAuth | Login social con Apple (configurado, pendiente credenciales) |
| Vercel | Hosting y deployment |

### 2.5 Variables de Entorno Requeridas

```
NEXTAUTH_URL              # URL base de la app (ej: https://contago.com)
NEXTAUTH_SECRET           # Secreto para firmar JWT
GOOGLE_CLIENT_ID          # OAuth Google
GOOGLE_CLIENT_SECRET      # OAuth Google
APPLE_CLIENT_ID           # OAuth Apple (opcional)
APPLE_CLIENT_SECRET       # OAuth Apple (opcional)
TURSO_DATABASE_URL        # URL de Turso (producción)
TURSO_AUTH_TOKEN           # Token de autenticación Turso
DATABASE_URL              # Fallback para connection string
RESEND_API_KEY            # API key de Resend para emails
AUTH_EMAIL_FROM           # Dirección de envío (ej: noreply@contago.com)
AUTH_CHALLENGE_PEPPER     # Sal adicional para hash de códigos (fallback a NEXTAUTH_SECRET)
```

---

## 3. Estructura del Proyecto

```
ContaGo/
├── src/
│   ├── app/                              # Next.js App Router
│   │   ├── layout.tsx                    # Root layout (Sidebar + Main + FAB)
│   │   ├── page.tsx                      # Dashboard principal (requiere auth + negocio)
│   │   ├── globals.css                   # Tema global, design system, dark mode
│   │   ├── actions.ts                    # Server actions — proxy mock/db
│   │   ├── actions.database.ts           # Server actions — implementación real con Prisma
│   │   ├── auth/
│   │   │   ├── actions.ts                # Acciones de auth (register, login, verify, reset)
│   │   │   ├── login/page.tsx            # Página de login
│   │   │   ├── register/page.tsx         # Página de registro
│   │   │   ├── verify-code/page.tsx      # Página de verificación de código
│   │   │   ├── reset-password/page.tsx   # Página de reset de contraseña
│   │   │   ├── forgot-password/page.tsx  # Página de "Olvidé mi contraseña"
│   │   │   ├── verify-request/page.tsx   # Confirmación de envío de código
│   │   │   └── error/page.tsx            # Errores de autenticación
│   │   ├── bienes/page.tsx               # Gestión de bienes de uso (activos fijos)
│   │   ├── cajas/page.tsx                # Gestión de cuentas y cajas
│   │   ├── creditos/page.tsx             # Cuentas por cobrar / por pagar
│   │   ├── reports/page.tsx              # Reportes financieros
│   │   ├── stock/page.tsx                # Inventario y movimientos de stock
│   │   ├── select-business/page.tsx      # Selector de negocio activo
│   │   └── api/
│   │       └── auth/[...nextauth]/
│   │           └── route.ts              # NextAuth handlers (GET + POST)
│   ├── components/
│   │   ├── Sidebar.tsx                   # Navegación lateral + bottom nav mobile
│   │   ├── DashboardCharts.tsx           # Gráficos ECharts (KpiSparkline, FinancialOverview, etc.)
│   │   ├── DashboardUserMenu.tsx         # Menú de usuario con datos de sesión
│   │   ├── TransactionForm.tsx           # Formulario de creación de transacciones
│   │   ├── TransactionFormCard.tsx       # Card wrapper del formulario
│   │   ├── TransactionList.tsx           # Listado de transacciones
│   │   ├── TransactionSection.tsx        # Sección combinada (form + list)
│   │   ├── ThemeToggle.tsx               # Toggle dark/light mode
│   │   ├── FloatingActionButton.tsx      # Botón flotante de acción rápida
│   │   ├── KpiCardWithModal.tsx          # Tarjeta KPI con modal de detalle
│   │   ├── PeriodFilter.tsx              # Filtro de período (7d, 30d, mes, custom)
│   │   ├── PeriodTabs.tsx                # Tabs de período para el dashboard
│   │   ├── DateRangeModal.tsx            # Modal con calendario para rango de fechas
│   │   ├── PuntoEquilibrio.tsx           # Análisis de punto de equilibrio (breakeven)
│   │   ├── ReportCharts.tsx              # Gráficos específicos de reportes
│   │   ├── ReportTable.tsx               # Tablas de reportes
│   │   ├── CajasClient.tsx               # Componente client-side para gestión de cajas
│   │   ├── AlertsBanner.tsx              # Banner de alertas/notificaciones
│   │   ├── MonthlySummary.tsx            # Resumen mensual
│   │   ├── PrintButton.tsx               # Botón de impresión/PDF
│   │   ├── AccountManager.tsx            # CRUD de cuentas/cajas
│   │   ├── AreaNegocioManager.tsx        # CRUD de áreas de negocio
│   │   ├── CategoryManager.tsx           # CRUD de categorías
│   │   ├── ContactManager.tsx            # CRUD de contactos
│   │   └── auth/
│   │       ├── AuthShell.tsx             # Layout base para pantallas de auth
│   │       ├── LoginPanel.tsx            # Componente de login (social + credentials)
│   │       ├── RegisterPanel.tsx         # Componente de registro
│   │       ├── VerifyCodePanel.tsx       # Componente de verificación de código
│   │       ├── ResetPasswordPanel.tsx    # Componente de reset de contraseña
│   │       ├── ForgotPasswordPanel.tsx   # Componente de forgot password
│   │       ├── BusinessSelectorPanel.tsx # Selector de negocio activo
│   │       └── AuthSignOutButton.tsx     # Botón de cerrar sesión
│   ├── lib/
│   │   ├── auth.ts                       # Configuración NextAuth (providers, callbacks, session)
│   │   ├── prisma.ts                     # Instancia singleton de Prisma Client
│   │   ├── validations.ts               # Schemas de validación Zod
│   │   └── mock.ts                       # Datos mock para desarrollo sin DB
│   ├── server/
│   │   └── auth/
│   │       ├── business-context.ts       # Resolución del negocio activo del usuario
│   │       ├── challenge-routing.ts      # Decisión de redireccionamiento post-auth
│   │       ├── challenges.ts             # Generación y verificación de códigos
│   │       ├── email.ts                  # Envío de emails (Resend)
│   │       ├── get-session-context.ts    # Contexto completo de sesión
│   │       ├── login-security.ts         # Decisiones de desafío de seguridad
│   │       ├── passwords.ts             # Hash y reset de contraseñas
│   │       ├── require-auth.ts          # Middleware: requiere usuario autenticado
│   │       ├── require-business-context.ts # Middleware: requiere negocio activo
│   │       └── require-page-session.ts  # Middleware: requiere sesión para páginas
│   └── types/
│       └── next-auth.d.ts               # Augmentación de tipos NextAuth (Session, JWT, User)
├── prisma/
│   ├── schema.prisma                     # Esquema completo de la base de datos
│   ├── seed.ts                           # Script de seed con datos demo
│   ├── migrations/
│   │   ├── 20260316211000_sqlite_baseline/migration.sql
│   │   ├── 20260317000817_phase1_identity_access_foundation/migration.sql
│   │   └── 20260317002903_business_operating_model_onboarding/migration.sql
│   └── migrations_mysql_legacy/          # Migraciones legacy (MySQL, no se usan)
├── docs/
│   ├── estado-plan-y-ejecucion.md        # Estado actual de cada fase
│   ├── fase-1-identidad-acceso-y-negocio-activo.md # Detalle Fase 1
│   └── roadmap-asistente-ia.md           # Roadmap del asistente IA
├── public/                               # Assets estáticos (logos, SVGs)
├── package.json
├── tsconfig.json
├── next.config.ts
├── prisma.config.ts
├── eslint.config.mjs
├── postcss.config.mjs
├── vercel.json
├── Estrategia.md                         # Documento de estrategia general
└── README.md
```

---

## 4. Configuración y Build

### 4.1 package.json

**Nombre del paquete:** `financiero`  
**Versión:** `0.1.0`  
**Private:** `true`

**Scripts:**

| Comando | Acción |
|---|---|
| `npm run dev` | Inicia servidor de desarrollo con Turbopack (`next dev`) |
| `npm run build` | Genera cliente Prisma + compila producción (`prisma generate && next build`) |
| `npm start` | Sirve la build de producción (`next start`) |
| `npm run lint` | Ejecuta ESLint (`eslint`) |
| `postinstall` | Auto-genera cliente Prisma al instalar dependencias (`prisma generate`) |

### 4.2 next.config.ts

```typescript
const nextConfig: NextConfig = {
  reactCompiler: true,  // Habilita React Compiler para optimizar re-renders automáticamente
};
```

El React Compiler analiza el código en build time y agrega memoización automática donde es beneficioso, eliminando la necesidad de `useMemo`, `useCallback` y `React.memo` manuales.

### 4.3 tsconfig.json

- **target:** ES2017
- **lib:** `dom`, `dom.iterable`, `esnext`
- **module:** esnext
- **moduleResolution:** bundler
- **jsx:** preserve
- **strict:** true (modo estricto de TypeScript)
- **Path alias:** `@/*` → `./src/*` (permite imports como `@/components/Sidebar`)
- **incremental:** true (compilación incremental)
- **plugins:** `[{ "name": "next" }]` (soporte IDE para Next.js)

### 4.4 eslint.config.mjs

Configuración ESLint 9 flat config:
- Extiende `next/core-web-vitals` (reglas de rendimiento web)
- Extiende `next/typescript` (reglas de TypeScript)
- Ignora: `.next/**`, `out/**`, `build/**`, `next-env.d.ts`

### 4.5 postcss.config.mjs

```javascript
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

Usa el plugin oficial de Tailwind CSS v4 para PostCSS.

### 4.6 prisma.config.ts

```typescript
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || 'file:./prisma/dev.db',
  },
});
```

**Prioridad de conexión:**
1. `TURSO_DATABASE_URL` — Producción (Turso remoto)
2. `DATABASE_URL` — Fallback genérico
3. `file:./prisma/dev.db` — SQLite local para desarrollo

### 4.7 vercel.json

```json
{
  "installCommand": "npm install",
  "buildCommand": "npx prisma generate && next build"
}
```

Asegura que Prisma Client se genere antes de compilar en Vercel.

---

## 5. Base de Datos — Esquema Prisma

El esquema de base de datos está en `prisma/schema.prisma` y usa **SQLite/Turso** como proveedor. Contiene **15 modelos** organizados en tres dominios: Autenticación, Negocio y Operaciones Financieras.

### 5.1 Modelo User (Identidad)

```prisma
model User {
  id                       String    @id @default(uuid())
  name                     String?
  email                    String    @unique
  emailVerified            DateTime?
  image                    String?
  password                 String?                    // Hash bcrypt (null si solo OAuth)
  defaultBusinessId        String?                    // Negocio activo por defecto
  lastLoginAt              DateTime?                  // Timestamp del último login exitoso
  lastSecurityChallengeAt  DateTime?                  // Para decidir desafío periódico (cada 30 días)

  accounts         AccountAuth[]
  sessions         Session[]
  emailChallenges  EmailChallenge[]
  devices          UserDevice[]
  memberships      BusinessMember[]
  defaultBusiness  Business?  @relation("UserDefaultBusiness", ...)

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([defaultBusinessId])
}
```

**Propósito:** Almacena la identidad del usuario, sus credenciales hasheadas, referencias a cuentas OAuth, contexto de seguridad (último login, último desafío) y la relación con el negocio activo por defecto.

**Campos clave:**
- `password`: Solo tiene valor si el usuario se registró con email/password. Hash bcrypt con cost factor 12.
- `defaultBusinessId`: Referencia al negocio que se carga automáticamente al iniciar sesión. Si el usuario tiene un solo negocio, se asigna automáticamente.
- `lastSecurityChallengeAt`: Se compara contra un umbral de 30 días para decidir si solicitar re-verificación.

---

### 5.2 Modelo AccountAuth (Cuentas OAuth)

```prisma
model AccountAuth {
  id                 String  @id @default(uuid())
  userId             String
  type               String                    // "oauth" | "credentials"
  provider           String                    // "google" | "apple" | "credentials"
  providerAccountId  String                    // ID del usuario en el proveedor
  refresh_token      String?
  access_token       String?
  expires_at         Int?
  token_type         String?
  scope              String?
  id_token           String?
  session_state      String?

  user  User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("Account_Auth_NextAuth")
}
```

**Propósito:** Tabla de NextAuth para almacenar cuentas de proveedores OAuth. Renombrada a `Account_Auth_NextAuth` en la base de datos para evitar conflicto con el modelo `Account` (cuentas financieras).

---

### 5.3 Modelo Session

```prisma
model Session {
  id            String   @id @default(uuid())
  sessionToken  String   @unique
  userId        String
  expires       DateTime
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

**Nota:** Este modelo existe por compatibilidad con NextAuth pero **no se usa activamente** ya que la estrategia de sesión es JWT (sin persistencia en base de datos). Puede eliminarse en el futuro.

---

### 5.4 Modelo EmailChallenge (Verificación por Código)

```prisma
model EmailChallenge {
  id           String    @id @default(uuid())
  userId       String?                   // Null para registros pre-cuenta
  email        String                    // Email destinatario
  purpose      String                    // SIGNUP_VERIFY | SOCIAL_LOGIN_VERIFY | PASSWORD_RESET | RISK_CHALLENGE
  codeHash     String                    // SHA256(pepper + ":" + code) — nunca almacena plaintext
  expiresAt    DateTime                  // Creación + 10 minutos
  consumedAt   DateTime?                 // Null = aún válido; valor = ya consumido
  attempts     Int       @default(0)     // Intentos fallidos
  maxAttempts  Int       @default(5)     // Máximo de intentos antes de bloqueo
  ipAddress    String?                   // IP del solicitante (auditoría)
  userAgent    String?                   // User-agent del navegador (auditoría)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  user  User? @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([email, purpose])
  @@index([userId, purpose])
  @@index([expiresAt])
}
```

**Propósito:** Sistema unificado de desafíos por código al email. Reemplaza los modelos antiguos `VerificationToken` y `PasswordResetToken`.

**Propósitos (purpose):**
- `SIGNUP_VERIFY`: Verificar email durante registro con credenciales
- `SOCIAL_LOGIN_VERIFY`: Verificar email en el primer login con Google/Apple
- `PASSWORD_RESET`: Recuperación de contraseña
- `RISK_CHALLENGE`: Desafío periódico por inactividad (+30 días) o riesgo detectado

**Seguridad:**
- El código nunca se almacena en texto plano, solo su hash SHA256 con pepper
- Máximo 5 intentos por código
- Expira en 10 minutos
- Se marca como consumido al verificar exitosamente

---

### 5.5 Modelo UserDevice (Dispositivos Confiables)

```prisma
model UserDevice {
  id                    String    @id @default(uuid())
  userId                String
  deviceFingerprintHash String                    // Hash derivado de user-agent, IP, etc.
  label                 String?                   // "iPhone 15", "Chrome Desktop", etc.
  lastSeenAt            DateTime  @default(now())
  trustedAt             DateTime?                 // Null = no confiable
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  user  User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, deviceFingerprintHash])
  @@index([userId, lastSeenAt])
}
```

**Propósito:** Rastrear dispositivos desde donde el usuario accede. Cuando un dispositivo se marca como "confiable" (`trustedAt` no es null), se puede omitir el desafío por código. Preparado para uso futuro.

---

### 5.6 Modelo Business (Negocio / Tenant)

```prisma
model Business {
  id                     String    @id @default(uuid())
  name                   String
  slug                   String?   @unique        // URL-friendly (opcional)
  currency               String    @default("ARS")
  operatingModel         String    @default("BOTH")  // SERVICES | PRODUCTS | BOTH
  onboardingCompletedAt  DateTime?                    // Null = onboarding en progreso

  members       BusinessMember[]
  accounts      Account[]
  categories    Category[]
  transactions  Transaction[]
  contacts      Contact[]
  areas         AreaNegocio[]
  productos     Producto[]
  bienes        BienDeUso[]
  defaultUsers  User[]  @relation("UserDefaultBusiness")

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

**Propósito:** Entidad central del modelo multi-tenant. Todo dato financiero (transacciones, cuentas, productos, etc.) está vinculado a un Business.

**operatingModel** controla la experiencia de la plataforma:
- `SERVICES`: Prioriza clientes, cobros, gastos operativos en la UI
- `PRODUCTS`: Prioriza inventario, proveedores, márgenes en la UI
- `BOTH`: Experiencia completa sin restricciones

---

### 5.7 Modelo BusinessMember (Membresía y Roles)

```prisma
model BusinessMember {
  id          String    @id @default(uuid())
  role        String    @default("COLLABORATOR")  // ADMIN | COLLABORATOR | VIEWER
  status      String    @default("ACTIVE")        // ACTIVE | INVITED | SUSPENDED
  invitedAt   DateTime?
  acceptedAt  DateTime?

  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  businessId  String
  business    Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([userId, businessId])
  @@index([userId, status])
  @@index([businessId, status])
}
```

**Propósito:** Tabla pivote que conecta usuarios con negocios. Un usuario puede pertenecer a varios negocios con diferentes roles.

**Roles:**
- **ADMIN**: Control total — configuración, miembros, todas las operaciones
- **COLLABORATOR**: Crear/editar transacciones y operaciones normales, sin acceso a configuración
- **VIEWER**: Solo lectura, sin escrituras

**Estados:**
- **ACTIVE**: Miembro activo con acceso completo según su rol
- **INVITED**: Invitación enviada, pendiente de aceptación
- **SUSPENDED**: Acceso temporalmente revocado

---

### 5.8 Modelo Account (Cuentas / Cajas)

```prisma
model Account {
  id              String  @id @default(uuid())
  name            String
  description     String?
  type            String                        // CASH | BANK | WALLET
  currency        String  @default("ARS")
  currentBalance  Float   @default(0)           // Saldo actualizado incrementalmente

  transactions  Transaction[]
  businessId    String
  business      Business @relation(fields: [businessId], references: [id], onDelete: Cascade)

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

**Propósito:** Representa las "cajas" o cuentas donde fluye el dinero. Cada transacción está asociada a una cuenta.

**Tipos:**
- `CASH`: Efectivo / caja chica
- `BANK`: Cuenta bancaria
- `WALLET`: Billetera virtual (MercadoPago, etc.)

**Nota:** El `currentBalance` se actualiza incrementalmente al crear/eliminar transacciones. Esto requiere operaciones atómicas para evitar inconsistencias.

---

### 5.9 Modelo Category (Categorías de Transacciones)

```prisma
model Category {
  id    String  @id @default(uuid())
  name  String
  type  String                    // INCOME | EXPENSE

  transactions  Transaction[]
  businessId    String
  business      Business @relation(fields: [businessId], references: [id], onDelete: Cascade)

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

**Propósito:** Clasificación de transacciones. Cada categoría pertenece exclusivamente a un tipo (ingreso o egreso) y a un negocio.

**Ejemplos:**
- INCOME: "Ventas Servicios", "Alquileres", "Otros Ingresos"
- EXPENSE: "Sueldos", "Alquiler", "Servicios", "Publicidad", "Materiales", "Impuestos"

---

### 5.10 Modelo Transaction (Movimientos Financieros)

```prisma
model Transaction {
  id              String    @id @default(uuid())
  description     String
  amount          Float
  currency        String    @default("ARS")
  exchangeRate    Float?    @default(1)         // Para conversión a moneda base
  date            DateTime  @default(now())
  type            String                         // INCOME | EXPENSE

  // ── Créditos y Deudas ──
  esCredito         Boolean   @default(false)
  estado            String    @default("COBRADO")   // COBRADO | PAGADO | PENDIENTE | VENCIDO
  fechaVencimiento  DateTime?

  // ── Datos Fiscales ──
  invoiceType     String?                        // A, B, C, E, M, NotaCredito, etc.
  invoiceNumber   String?                        // 0001-00001234 (formato facturador)
  invoiceFileUrl  String?                        // Link a foto/PDF del comprobante

  // ── Relaciones ──
  accountId       String
  account         Account      @relation(fields: [accountId], references: [id])
  categoryId      String?
  category        Category?    @relation(fields: [categoryId], references: [id])
  contactId       String?
  contact         Contact?     @relation(fields: [contactId], references: [id])
  areaNegocioId   String?
  areaNegocio     AreaNegocio? @relation(fields: [areaNegocioId], references: [id])
  businessId      String
  business        Business     @relation(fields: [businessId], references: [id], onDelete: Cascade)

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([businessId, date, createdAt])
}
```

**Propósito:** Modelo central del sistema financiero. Registra cada movimiento de dinero (ingreso o egreso) con soporte para créditos/deudas, multi-moneda y datos fiscales.

**Campos clave:**
- `esCredito`: Si es `true`, representa una Cuenta por Cobrar (INCOME) o Cuenta por Pagar (EXPENSE)
- `estado`: `COBRADO`/`PAGADO` = saldada; `PENDIENTE`/`VENCIDO` = vigente
- `exchangeRate`: Permite registrar transacciones en USD u otras monedas y convertir a ARS
- `invoiceType`: Preparado para integración futura con AFIP (facturación electrónica)

---

### 5.11 Modelo Contact (Clientes y Proveedores)

```prisma
model Contact {
  id     String  @id @default(uuid())
  name   String
  phone  String?
  email  String?
  taxId  String?              // CUIT / CUIL / DNI
  type   String               // CLIENT | SUPPLIER

  transactions  Transaction[]
  businessId    String
  business      Business @relation(fields: [businessId], references: [id], onDelete: Cascade)

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

**Propósito:** Directorio de clientes y proveedores del negocio. Se vinculan a transacciones para saber de quién se cobró o a quién se pagó.

---

### 5.12 Modelo AreaNegocio (Centros de Costo)

```prisma
model AreaNegocio {
  id           String  @id @default(uuid())
  nombre       String
  descripcion  String?

  transactions  Transaction[]
  businessId    String
  business      Business @relation(fields: [businessId], references: [id], onDelete: Cascade)

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([nombre, businessId])
}
```

**Propósito:** Permite clasificar transacciones por área del negocio (ej: "Comercial", "Administración", "Operaciones"). Facilita análisis de rentabilidad por departamento/área.

---

### 5.13 Modelo Producto (Inventario)

```prisma
model Producto {
  id              String   @id @default(uuid())
  nombre          String
  descripcion     String?
  categoria       String?
  marca           String?
  unidad          String   @default("unidad")
  metodoCosteo    String   @default("PROMEDIO")  // PROMEDIO | FIFO | LIFO
  currency        String   @default("ARS")
  precioVenta     Float    @default(0)
  precioCosto     Float    @default(0)
  stockActual     Float    @default(0)
  enTransito      Float    @default(0)            // Stock pendiente de entrada
  activo          Boolean  @default(true)

  movimientos  MovimientoStock[]
  businessId   String
  business     Business @relation(fields: [businessId], references: [id], onDelete: Cascade)

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

**Propósito:** Catálogo de productos con control de stock, precios y método de costeo. Soporta múltiples unidades de medida y stock en tránsito.

**Métodos de costeo:**
- `PROMEDIO`: Costo promedio ponderado
- `FIFO`: Primero en entrar, primero en salir
- `LIFO`: Último en entrar, primero en salir

---

### 5.14 Modelo MovimientoStock (Historial de Stock)

```prisma
model MovimientoStock {
  id          String   @id @default(uuid())
  tipo        String                     // ENTRADA | SALIDA | AJUSTE
  cantidad    Float
  precio      Float    @default(0)
  motivo      String?
  fecha       DateTime @default(now())

  productoId  String
  producto    Producto @relation(fields: [productoId], references: [id], onDelete: Cascade)

  createdAt  DateTime @default(now())
}
```

**Propósito:** Registro de cada movimiento de inventario. Permite trazabilidad completa del stock.

---

### 5.15 Modelo BienDeUso (Activos Fijos)

```prisma
model BienDeUso {
  id              String    @id @default(uuid())
  nombre          String
  descripcion     String?
  categoria       String                     // TECNOLOGIA | MOBILIARIO | VEHICULO | HERRAMIENTA | INMUEBLE | OTRO
  fechaCompra     DateTime
  valorCompra     Float
  currency        String    @default("ARS")
  vidaUtilMeses   Int       @default(60)    // 5 años por defecto
  valorResidual   Float     @default(0)
  estado          String    @default("EN_USO")  // EN_USO | VENDIDO | DADO_DE_BAJA
  notas           String?
  activo          Boolean   @default(true)

  businessId  String
  business    Business @relation(fields: [businessId], references: [id], onDelete: Cascade)

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

**Propósito:** Gestión de activos fijos (Propiedad, Planta y Equipo). Calcula depreciación lineal automáticamente.

**Fórmula de depreciación:**
```
depreciacionMensual = (valorCompra - valorResidual) / vidaUtilMeses
depreciacionAcumulada = min(depreciacionMensual × mesesTranscurridos, valorCompra - valorResidual)
valorEnLibros = valorCompra - depreciacionAcumulada
```

**Categorías:** TECNOLOGIA, MOBILIARIO, VEHICULO, HERRAMIENTA, INMUEBLE, OTRO

---

### 5.16 Diagrama de Relaciones

```
User ──1:N──> AccountAuth        (cuentas OAuth)
User ──1:N──> EmailChallenge     (códigos de verificación)
User ──1:N──> UserDevice         (dispositivos confiables)
User ──1:N──> BusinessMember     (membresías)
User ──1:1──> Business           (negocio por defecto)

Business ──1:N──> BusinessMember
Business ──1:N──> Account
Business ──1:N──> Category
Business ──1:N──> Transaction
Business ──1:N──> Contact
Business ──1:N──> AreaNegocio
Business ──1:N──> Producto
Business ──1:N──> BienDeUso

Transaction ──N:1──> Account     (en qué caja pasó)
Transaction ──N:1──> Category    (clasificación)
Transaction ──N:1──> Contact     (con quién)
Transaction ──N:1──> AreaNegocio (en qué área)

Producto ──1:N──> MovimientoStock
```

---

## 6. Migraciones

### 6.1 Migration: sqlite_baseline (16 Mar 2026)

**Archivo:** `20260316211000_sqlite_baseline/migration.sql`

**Propósito:** Crear el schema base completo en SQLite.

**Tablas creadas:**
- User, Session, Account_Auth_NextAuth, VerificationToken, PasswordResetToken
- Business, BusinessMember
- Account, Category, Transaction
- Producto, MovimientoStock
- AreaNegocio, Contact, BienDeUso

**Índices creados:**
- User: `email` (unique)
- AccountAuth: `provider + providerAccountId` (unique)
- Session: `sessionToken` (unique)
- Transaction: `(businessId, date, createdAt)` (compuesto para queries ordenados)

---

### 6.2 Migration: phase1_identity_access_foundation (17 Mar 2026)

**Archivo:** `20260317000817_phase1_identity_access_foundation/migration.sql`

**Propósito:** Implementar el sistema de identidad y acceso de Fase 1.

**Cambios:**

1. **Nueva tabla `EmailChallenge`:**
   - Sistema unificado de verificación por código al email
   - Índices: `(email, purpose)`, `(userId, purpose)`, `(expiresAt)`

2. **Nueva tabla `UserDevice`:**
   - Rastreo de dispositivos confiables
   - Índices: `(userId, lastSeenAt)`, `(userId, deviceFingerprintHash)` unique

3. **Columnas nuevas en `User`:**
   - `defaultBusinessId` — Negocio activo por defecto
   - `lastLoginAt` — Timestamp último login
   - `lastSecurityChallengeAt` — Para desafío periódico

4. **Columnas nuevas en `BusinessMember`:**
   - `status` — ACTIVE | INVITED | SUSPENDED
   - `invitedAt`, `acceptedAt` — Tracking de invitaciones
   - Nuevos índices: `(userId, status)`, `(businessId, status)`, `(userId, businessId)` unique

---

### 6.3 Migration: business_operating_model_onboarding (17 Mar 2026)

**Archivo:** `20260317002903_business_operating_model_onboarding/migration.sql`

**Propósito:** Agregar el modelo operativo al negocio.

**Cambios en `Business`:**
- `operatingModel` — "SERVICES" | "PRODUCTS" | "BOTH" (default: "BOTH")
- `onboardingCompletedAt` — Timestamp de completado del onboarding

---

## 7. Sistema de Autenticación

### 7.1 Arquitectura General

La autenticación está construida sobre **NextAuth.js v4** con estrategia **JWT** (sin tabla de sesiones en BD). Soporta tres proveedores: Google, Apple y Credenciales (email/password).

**Flujo general:**

```
Usuario llega a /auth/login
  │
  ├─ Elige Google → OAuth flow → NextAuth callback → ¿Código requerido?
  ├─ Elige Apple  → OAuth flow → NextAuth callback → ¿Código requerido?
  └─ Elige Email  → Ingresa email + password → Server Action
       │
       ├─ prepareCredentialsLogin() verifica credenciales
       │   └─ decideLoginChallenge() → ¿Requiere código?
       │       ├─ SÍ → Crea EmailChallenge + envía email → Redirect /verify-code
       │       └─ NO → signIn("credentials") → JWT creado
       │
       └─ Después del JWT:
           ├─ hydrateTokenContext() resuelve negocio activo
           ├─ 1 negocio → Dashboard automáticamente
           ├─ N negocios → Redirect /select-business
           └─ 0 negocios → /auth/error?error=NoBusinessAccess
```

### 7.2 Configuración NextAuth (src/lib/auth.ts)

**Session Strategy:** `jwt` — El token se almacena como cookie HTTP-only, no en base de datos.

**Providers:**

1. **GoogleProvider** — Se activa condicionalmente si `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` existen en las variables de entorno.

2. **AppleProvider** — Se activa condicionalmente si `APPLE_CLIENT_ID` y `APPLE_CLIENT_SECRET` existen.

3. **CredentialsProvider** — Siempre disponible. La función `authorize()` busca el usuario por email, compara el hash bcrypt de la contraseña, y retorna el user si es válido.

**Callbacks:**

- **`signIn({ user, account })`:**
  1. Valida que el usuario y al menos un negocio existan
  2. Llama a `decideLoginChallenge()` para determinar si se requiere verificación por código
  3. Si se requiere código: crea `EmailChallenge`, envía email, y retorna URL de redirección a `/verify-code`
  4. Si no: actualiza `lastLoginAt` y permite el login

- **`jwt({ token, user, account, trigger, session })`:**
  1. En login inicial: almacena `userId`, `provider`, `challengeSatisfied` en el token
  2. En `trigger === 'update'`: sincroniza `activeBusiness` desde el objeto `session` (para cambio de negocio activo)
  3. Llama a `hydrateTokenContext(token)` en cada request para mantener datos actualizados

- **`session({ session, token })`:**
  Expone al cliente: `user.id`, `user.emailVerified`, `activeBusiness` (id, name, slug, role, status), `auth.provider`, `auth.challengeSatisfied`

**`hydrateTokenContext(token)`:**
En cada request con JWT, ejecuta 2 queries:
1. `prisma.user.findUnique()` — Obtiene `emailVerified` y `lastSecurityChallengeAt`
2. `resolveUserActiveBusiness()` — Resuelve el negocio activo (por defecto o primero disponible)

### 7.3 Decisión de Desafío (src/server/auth/login-security.ts)

```typescript
function decideLoginChallenge(input: {
  provider: 'credentials' | 'google' | 'apple'
  emailVerified?: Date | null
  lastSecurityChallengeAt?: Date | null
}): EmailChallengePurpose | null
```

**Reglas:**
1. Si email NO verificado → `SIGNUP_VERIFY` (credentials) o `SOCIAL_LOGIN_VERIFY` (OAuth)
2. Si email verificado pero último desafío hace +30 días → `RISK_CHALLENGE`
3. Si todo OK → `null` (no requiere código)

### 7.4 Sistema de Códigos (src/server/auth/challenges.ts)

**Generación:**
- `generateNumericCode(length = 6)`: Genera código numérico aleatorio de 6 dígitos
- `hashChallengeCode(code)`: SHA256(pepper + ":" + code) — nunca se almacena en texto plano

**Creación de desafío:**
```typescript
await prisma.emailChallenge.create({
  data: {
    email, purpose, userId,
    codeHash: hashChallengeCode(code),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),  // 10 minutos
    attempts: 0, maxAttempts: 5
  }
})
```

**Verificación:**
```typescript
await verifyEmailChallenge({ email, purpose, code })
// 1. Busca el challenge más reciente no consumido para ese email+purpose
// 2. Verifica hash con timing-safe comparison
// 3. Si falla: incrementa attempts; si excede maxAttempts: marca como bloqueado
// 4. Si pasa: marca consumedAt = now()
```

### 7.5 Envío de Emails (src/server/auth/email.ts)

**Provider:** Resend (con fallback a `console.log` en desarrollo)

```typescript
async function sendAuthCodeEmail({ email, code, purpose })
```

Construye un HTML con:
- Título según el propósito (ej: "Verificá tu email", "Código de seguridad")
- Código de 6 dígitos en fuente grande
- Mensaje de expiración (10 minutos)
- Disclaimer legal

Si no hay `RESEND_API_KEY`, loguea el código a la consola para desarrollo.

### 7.6 Contraseñas (src/server/auth/passwords.ts)

- `hashPassword(password)`: `bcryptjs.hash(password, 12)` — Cost factor 12
- `requestPasswordResetFlow(email)`: Busca usuario, crea EmailChallenge con purpose `PASSWORD_RESET`, envía código al email
- `resetPasswordWithCodeFlow({ email, code, password })`: Verifica código, hashea nueva contraseña, actualiza en BD

### 7.7 Contexto de Negocio (src/server/auth/business-context.ts)

```typescript
async function resolveUserActiveBusiness(userId: string, preferredBusinessId?: string)
```

**Lógica:**
1. Si hay `preferredBusinessId`, busca membresía ACTIVE para ese negocio
2. Si no, busca `defaultBusinessId` del usuario
3. Si no, toma la primera membresía ACTIVE
4. Si no tiene ninguna membresía activa, retorna `null`

Retorna: `{ id, name, slug, role, memberStatus }`

### 7.8 Middlewares de Auth

- **`requireAuth()`** (`src/server/auth/require-auth.ts`): Verifica que exista sesión JWT válida. Si no, redirige a `/auth/login`.
- **`requireBusinessContext()`** (`src/server/auth/require-business-context.ts`): Verifica sesión + negocio activo. Si no hay negocio, redirige a `/select-business` o `/auth/error`.
- **`requirePageSession()`** (`src/server/auth/require-page-session.ts`): Variante para Server Components de páginas.

### 7.9 Tipos Augmentados (src/types/next-auth.d.ts)

Extiende los tipos de NextAuth para incluir:
- `Session.user.id`: ID del usuario
- `Session.user.emailVerified`: Fecha de verificación
- `Session.activeBusiness`: `{ id, name, slug, role, memberStatus }`
- `Session.auth`: `{ provider, challengeSatisfied }`
- `JWT.userId`, `JWT.provider`, etc.

---

## 8. Server Actions y Lógica de Negocio

### 8.1 Patrón Proxy Mock/DB

El sistema usa un patrón proxy que permite operar con datos mock (desarrollo sin DB) o con la base de datos real:

**`src/app/actions.ts`** — Punto de entrada público. Exporta todas las funciones que consumen los componentes.

```typescript
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true'
                 || process.env.USE_MOCK_DATA === 'true'
                 || !hasDatabaseConfig

// Si USE_MOCK es true, retorna datos del mock
// Si no, carga dinámicamente actions.database.ts y ejecuta la query real
```

**`src/app/actions.database.ts`** — Implementación real con Prisma. Cada función:
1. Obtiene el `businessId` de la sesión autenticada
2. Ejecuta queries Prisma filtrando por `businessId` (aislamiento multi-tenant)

### 8.2 Acciones de Lectura (Implementadas y Activas)

| Función | Descripción |
|---|---|
| `getAccounts(businessId?)` | Lista todas las cuentas/cajas del negocio |
| `getCategories(businessId?)` | Lista categorías de ingreso y egreso |
| `getTransactions()` | Lista transacciones con relaciones (account, category, contact, area) |
| `getAreasNegocio(businessId?)` | Lista áreas de negocio / centros de costo |
| `getContacts(businessId?)` | Lista contacts (clientes y proveedores) |
| `getReportData(range?)` | Datos para la página de reportes |
| `getCreditosDeudas()` | Transacciones con `esCredito = true` |
| `getProductos()` | Lista productos con movimientos de stock |
| `getBienesDeUso()` | Lista bienes de uso (activos fijos) |
| `getCajasData()` | Datos completos para la página de cajas |
| `getDashboardStats(period, from?, to?, businessId?)` | KPIs, sparklines, chart data, categorías |
| `getMonthlyStats()` | Estadísticas agrupadas por mes |
| `getWeeklyStats()` | Estadísticas agrupadas por semana |
| `getDailyStats()` | Estadísticas agrupadas por día |

### 8.3 Acciones de Escritura — DESHABILITADAS (Pendiente Auth)

Las siguientes funciones están **comentadas/deshabilitadas** esperando la rehabilitación con validación de rol y negocio:

| Función | Estado | Razón |
|---|---|---|
| `createTransaction(formData)` | DESHABILITADA | Necesita `getBusinessId()` + transacción atómica para balance |
| `createAccount(formData)` | DESHABILITADA | Necesita `getBusinessId()` |
| `createContact(formData)` | DESHABILITADA | Necesita `getBusinessId()` |
| `createCategory(formData)` | DESHABILITADA | Necesita `getBusinessId()` |
| `createAreaNegocio(formData)` | DESHABILITADA | Necesita `getBusinessId()` |
| `createProducto(formData)` | DESHABILITADA | Necesita `getBusinessId()` |
| `createBienDeUso(formData)` | DESHABILITADA | Necesita `getBusinessId()` |
| `addMovimientoStock(formData)` | DESHABILITADA | Necesita `getBusinessId()` |

### 8.4 Acciones de Escritura — HABILITADAS

| Función | Descripción |
|---|---|
| `updateContact(id, formData)` | Actualiza un contacto |
| `deleteContact(id)` | Elimina un contacto |
| `updateAccount(id, formData)` | Actualiza una cuenta |
| `deleteAccount(id)` | Elimina una cuenta |
| `updateAreaNegocio(id, formData)` | Actualiza un área |
| `deleteAreaNegocio(id)` | Elimina un área |
| `updateCategory(id, formData)` | Actualiza una categoría |
| `deleteCategory(id)` | Elimina una categoría |
| `updateProducto(id, formData)` | Actualiza un producto |
| `deleteProducto(id)` | Elimina un producto |
| `updateBienDeUso(id, formData)` | Actualiza un bien de uso |
| `deleteBienDeUso(id)` | Elimina un bien de uso |
| `marcarEstadoCredito(id, estado)` | Cambia estado de un crédito/deuda |
| `deleteTransaction(id)` | Elimina una transacción |

### 8.5 Acciones de Auth (src/app/auth/actions.ts)

| Función | Descripción |
|---|---|
| `registerWithCredentials(formData)` | Registra usuario + negocio + membership + envía código de verificación |
| `prepareCredentialsLogin(formData)` | Valida credenciales, decide si requiere código, envía código si aplica |
| `requestEmailVerification(formData)` | Re-envía código de verificación (si el anterior expiró) |
| `verifyEmailCode(formData)` | Verifica código ingresado contra hash almacenado |
| `requestPasswordReset(formData)` | Solicita recuperación de contraseña (envía código al email) |
| `resetPasswordWithCode(formData)` | Verifica código + establece nueva contraseña |

**Detalle de `registerWithCredentials`:**
1. Valida schema Zod (name, email, password, businessName, operatingModel)
2. Verifica que el email no esté ya registrado
3. Hashea la contraseña con bcrypt
4. En una **transacción Prisma atómica** crea:
   - `User` con password hasheada
   - `Business` con nombre y operatingModel
   - `BusinessMember` con role ADMIN y status ACTIVE
   - Actualiza `User.defaultBusinessId`
5. Crea `EmailChallenge` con purpose `SIGNUP_VERIFY`
6. Envía el código al email via Resend
7. Retorna `{ success: true, data: { email } }`

### 8.6 Validaciones Zod (src/lib/validations.ts)

Esquemas de validación definidos con Zod para:
- `createTransactionSchema`: Valida monto (>0), tipo (INCOME/EXPENSE), accountId, descripción, etc.
- `registerSchema`: Valida name, email, password (mínimo 8 chars), businessName, operatingModel
- `loginSchema`: Valida email, password
- Otros schemas para contactos, categorías, productos, etc.

---

## 9. Sistema de Rutas y Páginas

### 9.1 Layout Raíz (src/app/layout.tsx)

```
<html data-theme="light">
  <head>
    <script> // Inline: lee localStorage['theme'] y aplica data-theme para evitar flash </script>
  </head>
  <body className="font-sans bg-bone text-carbon">
    <Sidebar />
    <main className="...">
      {children}
    </main>
    <FloatingActionButton />
  </body>
</html>
```

- El `Sidebar` se oculta automáticamente en rutas `/auth/*` y `/select-business/*`
- El inline script evita el "flash" de tema incorrecto al cargar la página
- Las fuentes (Inter, Archivo, Geist Mono) se cargan via `next/font`

### 9.2 Páginas Públicas (Sin Autenticación)

#### `/auth/login` — Login

**Server Component** que renderiza `<AuthShell>` + `<LoginPanel>`.

**LoginPanel** ofrece:
- Botón "Continuar con Google" (si `GOOGLE_CLIENT_ID` configurado)
- Botón "Continuar con Apple" (si `APPLE_CLIENT_ID` configurado)
- Formulario email + contraseña
- Link a "Olvidé mi contraseña"
- Link a "Crear cuenta"

**Flujo:**
1. Usuario ingresa email + contraseña
2. Se ejecuta `prepareCredentialsLogin()` (server action)
3. Si no requiere código → `signIn("credentials")` de NextAuth
4. Si requiere código → `router.push(/auth/verify-code?email=...&purpose=...)`

#### `/auth/register` — Registro

**RegisterPanel** solicita:
- Nombre del usuario
- Nombre del negocio
- Modelo operativo (Servicios / Productos / Ambos)
- Email
- Contraseña (mínimo 8 caracteres)

**Flujo:**
1. Se ejecuta `registerWithCredentials()` (transacción atómica)
2. Crea User + Business + BusinessMember
3. Envía código de verificación al email
4. Redirige a `/auth/verify-code?email=...&purpose=SIGNUP_VERIFY`

#### `/auth/verify-code` — Verificación de Código

**VerifyCodePanel** presenta:
- Input para código de 6 dígitos
- Botón "Verificar"
- Link "Reenviar código" (pide nuevo código si expiró)

**Flujo:**
1. Se ejecuta `verifyEmailCode()` (valida hash)
2. Si pasa → marca `emailVerified` o `lastSecurityChallengeAt`
3. Redirige al dashboard o al login según el purpose

#### `/auth/forgot-password` — Olvidé mi Contraseña

**ForgotPasswordPanel** solicita email. Ejecuta `requestPasswordReset()` que envía código al email. Redirige a `/auth/reset-password?email=...`.

#### `/auth/reset-password` — Reset de Contraseña

**ResetPasswordPanel** solicita:
- Código de verificación (6 dígitos)
- Nueva contraseña
- Confirmar nueva contraseña

Ejecuta `resetPasswordWithCode()` y redirige al login.

#### `/auth/verify-request` — Confirmación de Envío

Página estática que informa: "Te enviamos un código de verificación a tu email".

#### `/auth/error` — Error de Auth

Lee el query parameter `?error` y muestra mensaje correspondiente:
- `NoBusinessAccess`: "No tienes acceso a ningún negocio"
- `Configuration`: "Error de configuración"
- Otros errores genéricos de NextAuth

### 9.3 Páginas Privadas (Requieren Autenticación + Negocio Activo)

#### `/` — Dashboard Principal

**Server Component** protegido por `requireBusinessContext()`.

**Rendering:**
```
<Suspense fallback={<DashboardSkeleton />}>
  <DashboardContent businessId={...} periodo={...} />
</Suspense>
```

**Contenido de DashboardContent (async server component):**

1. **Header:** Nombre del negocio + `DashboardUserMenu` + `PeriodTabs`

2. **Fila KPI (4 tarjetas):**
   - **Ingresos**: Monto, variación %, sparkline, fondo verde militar
   - **Egresos**: Monto, variación %, sparkline, fondo rojo
   - **Ganancia**: Monto neto, variación %, sparkline, fondo dorado
   - **Rentabilidad**: Porcentaje, donut gauge, fondo oscuro

3. **Gráfico FinancialOverview:** Barras de ingresos/egresos + línea de ganancia por mes

4. **Sección de Insights IA:** Placeholder preparado para el asistente de inteligencia artificial (Fase 2)

5. **Sección de Transacciones:** TransactionSection con formulario + listado reciente

**Períodos disponibles:** Hoy, Últimos 7 días, Últimos 30 días, Mes actual, Mes anterior, Rango personalizado

#### `/cajas` — Gestión de Cuentas y Cajas

Muestra las cuentas del negocio (CASH, BANK, WALLET) con:
- Saldo actual de cada cuenta
- Movimientos recientes por cuenta
- Crear/editar/eliminar cuentas (via `AccountManager`)
- Componente `CajasClient` para interactividad client-side

#### `/creditos` — Cuentas por Cobrar y por Pagar

Lista transacciones donde `esCredito = true`:
- Filtro por tipo: CxC (cuentas por cobrar) / CxP (cuentas por pagar)
- Estados: PENDIENTE, VENCIDO, COBRADO, PAGADO
- Acción para marcar estado (`marcarEstadoCredito`)
- Alertas de vencimientos próximos

#### `/reports` — Reportes Financieros

Página de análisis extendido con:
- **ReportCharts:** Gráficos de flujo de fondos, barras horizontales por categoría, evolución temporal
- **ReportTable:** Tablas detalladas de ingresos/egresos por categoría, período, contacto
- **PuntoEquilibrio:** Análisis de punto de equilibrio (costos fijos vs variables vs ingresos)
- **PeriodFilter:** Selector de período para filtrar datos
- **PrintButton:** Exportar/imprimir reportes

#### `/stock` — Inventario

Gestión de productos y stock:
- Listado de productos con stock actual, precio de venta y costo
- Movimientos de stock (ENTRADA, SALIDA, AJUSTE)
- Crear/editar/eliminar productos (`ProductoManager`)
- Agregar movimientos de stock (`addMovimientoStock`)

#### `/bienes` — Bienes de Uso

Gestión de activos fijos:
- Listado de bienes con categoría, valor de compra, depreciación acumulada, valor en libros
- Estado: EN_USO, VENDIDO, DADO_DE_BAJA
- Crear/editar/eliminar bienes
- Cálculo automático de depreciación lineal

#### `/select-business` — Selector de Negocio

**BusinessSelectorPanel** muestra las membresías activas del usuario. Aparece cuando el usuario tiene acceso a más de un negocio. Al seleccionar uno, actualiza la sesión JWT con `session.update({ activeBusiness })`.

### 9.4 Ruta API

#### `/api/auth/[...nextauth]/route.ts`

Handler de NextAuth que exporta `GET` y `POST`. Maneja todas las rutas de auth:
- `/api/auth/signin` — Inicio de sesión
- `/api/auth/callback/*` — Callbacks OAuth
- `/api/auth/signout` — Cierre de sesión
- `/api/auth/session` — Obtener sesión actual
- `/api/auth/csrf` — Token CSRF

---

## 10. Componentes UI

### 10.1 Sidebar (src/components/Sidebar.tsx)

Navegación principal de la aplicación.

**Desktop:** Barra lateral izquierda con logo, items de menú y toggle de tema.  
**Mobile:** Barra inferior (bottom navigation) con iconos.

**Items de menú:**
| Icon | Label | Ruta | Estado |
|---|---|---|---|
| Home | Inicio | `/` | Activo |
| Wallet | Cajas | `/cajas` | Activo |
| BarChart | Informes | `/reports` | Activo |
| CreditCard | Créditos | `/creditos` | Activo |
| Package | Stock | `/stock` | Activo |
| Building | Bienes | `/bienes` | Activo |
| Users | Usuarios | — | Deshabilitado (próximamente) |
| Settings | Configuración | — | Deshabilitado (próximamente) |

**Comportamiento:**
- Se oculta completamente en rutas `/auth/*` y `/select-business/*`
- Indica la ruta activa con estilo destacado
- ThemeToggle integrado

### 10.2 DashboardCharts (src/components/DashboardCharts.tsx)

Exporta múltiples componentes de gráficos basados en ECharts:

#### KpiSparkline
- Mini gráfico de área + línea sin ejes (solo tendencia visual)
- Usado dentro de las tarjetas KPI
- Props: `data: number[]`, `color: string`, `height: number`

#### MarginGauge
- Gráfico semicircular tipo velocímetro que muestra porcentaje de rentabilidad
- Gradiente de colores: rojo (<30%) → amarillo (30-60%) → verde (>60%)

#### FinancialOverviewChart
- Gráfico combinado: barras (ingresos/egresos) + línea (ganancia neta)
- Datos agrupados por mes
- Tooltip con detalle al hover

#### ExpenseCategoryDonut
- Gráfico donut que muestra distribución de gastos por categoría
- Colores diferenciados por categoría

#### ProfitabilityDonut
- Gráfico donut de rentabilidad (gastos vs ganancia)

**Paleta de colores del sistema:**
```javascript
const C = {
  income:  '#2D6A4F',   // Verde militar
  expense: '#6b7280',   // Gris
  net:     '#C5A065',   // Dorado
  red:     '#EF4444',   // Rojo para alertas/pérdidas
}
```

### 10.3 KpiCardWithModal (src/components/KpiCardWithModal.tsx)

Tarjeta que muestra un KPI (ej: "Ingresos: $500.000") con un modal expandible que muestra desglose por categoría al hacer click.

**Props:** `title`, `categories`, `total`, `children` (el card content)

### 10.4 TransactionForm (src/components/TransactionForm.tsx)

Formulario completo para crear transacciones.

**Props:**
- `accounts`: Lista de cuentas disponibles
- `categories`: Lista de categorías
- `contacts`: Lista de contactos
- `areas`: Lista de áreas de negocio
- `onSubmit`: Server action para crear la transacción
- `initialType`: Tipo inicial (INCOME | EXPENSE)
- `onTypeChange`: Callback al cambiar tipo

**Campos del formulario:**
1. **Tipo**: Radio buttons INCOME / EXPENSE
2. **Monto**: Input numérico con símbolo de moneda
3. **Descripción**: Texto libre
4. **Cuenta**: Dropdown de cuentas
5. **Categoría**: Dropdown filtrado por tipo (INCOME/EXPENSE)
6. **Fecha**: Date picker (hoy por defecto)
7. **Contacto**: Dropdown (opcional)
8. **Área de Negocio**: Dropdown (opcional)
9. **Es Crédito**: Checkbox → Si activo muestra:
   - Fecha de vencimiento
   - Estado (PENDIENTE | VENCIDO | COBRADO | PAGADO)
10. **Es Bien de Uso**: Checkbox (solo si EXPENSE) → Si activo muestra:
    - Categoría del bien (TECNOLOGIA, MOBILIARIO, etc.)
    - Vida útil en meses
    - Valor residual

### 10.5 TransactionList (src/components/TransactionList.tsx)

Listado de transacciones recientes con:
- Descripción
- Monto formateado con signo (+/-) y color (verde/rojo)
- Fecha
- Categoría
- Botones de acción (editar, eliminar)

### 10.6 DashboardUserMenu (src/components/DashboardUserMenu.tsx)

Menú desplegable en el header del dashboard:
- Avatar (imagen de perfil o iniciales)
- Nombre del usuario
- Nombre del negocio activo
- Rol (ADMIN / COLLABORATOR / VIEWER)
- Email
- Provider de autenticación (Google / Apple / Credenciales)
- Botón "Cerrar sesión"

### 10.7 PeriodFilter y PeriodTabs

**PeriodTabs** (`src/components/PeriodTabs.tsx`): Tabs para seleccionar período en el dashboard.
**PeriodFilter** (`src/components/PeriodFilter.tsx`): Filtro de período para reportes.

**Períodos disponibles (type PeriodKey):**
- `today`: Hoy
- `7d`: Últimos 7 días
- `30d`: Últimos 30 días
- `month`: Mes actual
- `last-month`: Mes anterior
- `custom`: Rango personalizado (abre DateRangeModal)

### 10.8 DateRangeModal (src/components/DateRangeModal.tsx)

Modal con calendario (react-day-picker) para seleccionar un rango de fechas personalizado. Se activa cuando el usuario elige "Rango personalizado" en PeriodFilter/PeriodTabs.

### 10.9 PuntoEquilibrio (src/components/PuntoEquilibrio.tsx)

Análisis de punto de equilibrio (breakeven analysis):
- Costos fijos vs costos variables
- Ingresos necesarios para cubrir costos
- Visualización gráfica del punto de equilibrio

### 10.10 ReportCharts y ReportTable

**ReportCharts** (`src/components/ReportCharts.tsx`): Gráficos adicionales para la página de reportes:
- Barras horizontales por categoría
- Gráfico de área para flujo de fondos
- Evolución temporal de ingresos/egresos

**ReportTable** (`src/components/ReportTable.tsx`): Tablas detalladas con datos tabulares de reportes.

### 10.11 Managers (AccountManager, CategoryManager, ContactManager, AreaNegocioManager)

Componentes CRUD modales para gestionar entidades del negocio:
- **AccountManager**: Crear, editar, eliminar cuentas/cajas (nombre, tipo, moneda)
- **CategoryManager**: Crear, editar, eliminar categorías (nombre, tipo INCOME/EXPENSE)
- **ContactManager**: Crear, editar, eliminar contactos (nombre, teléfono, email, taxId, tipo)
- **AreaNegocioManager**: Crear, editar, eliminar áreas de negocio

### 10.12 CajasClient (src/components/CajasClient.tsx)

Componente client-side para la página de Cajas. Maneja la interactividad del lado del cliente (expandir/colapsar cuentas, filtros, etc.).

### 10.13 AlertsBanner (src/components/AlertsBanner.tsx)

Banner que muestra alertas y notificaciones importantes (ej: créditos vencidos, balance bajo).

### 10.14 MonthlySummary (src/components/MonthlySummary.tsx)

Resumen mensual con totales de ingresos, egresos y ganancia neta.

### 10.15 PrintButton (src/components/PrintButton.tsx)

Botón que activa la impresión del contenido actual de la página o genera un PDF.

### 10.16 FloatingActionButton (src/components/FloatingActionButton.tsx)

Botón flotante (FAB) posicionado en la esquina inferior derecha para acciones rápidas (típicamente crear nueva transacción).

### 10.17 ThemeToggle (src/components/ThemeToggle.tsx)

Botón para alternar entre modo claro y oscuro:
- Lee `localStorage['theme']` al montar
- Actualiza `document.documentElement.setAttribute('data-theme', 'dark'|'light')`
- Persiste la preferencia en localStorage

### 10.18 Componentes de Auth

#### AuthShell (src/components/auth/AuthShell.tsx)
Layout base para todas las pantallas de autenticación. Centra el contenido con branding de ContaGo.

#### LoginPanel (src/components/auth/LoginPanel.tsx)
Panel de login con social buttons + formulario email/password. Props: `googleEnabled`, `appleEnabled`, `temporaryAccessEnabled`.

#### RegisterPanel (src/components/auth/RegisterPanel.tsx)
Formulario de registro con campos: nombre, nombre del negocio, modelo operativo, email, contraseña.

#### VerifyCodePanel (src/components/auth/VerifyCodePanel.tsx)
Input de código de 6 dígitos con botón de verificar y opción de reenviar.

#### ForgotPasswordPanel (src/components/auth/ForgotPasswordPanel.tsx)
Input de email para solicitar reset de contraseña.

#### ResetPasswordPanel (src/components/auth/ResetPasswordPanel.tsx)
Formulario con código + nueva contraseña + confirmación.

#### BusinessSelectorPanel (src/components/auth/BusinessSelectorPanel.tsx)
Lista de negocios disponibles para seleccionar cuál activar.

#### AuthSignOutButton (src/components/auth/AuthSignOutButton.tsx)
Botón de cerrar sesión que llama a `signOut()` de NextAuth.

---

## 11. Sistema de Temas y Estilos

### 11.1 Design System (src/app/globals.css)

El sistema de diseño está definido en CSS con variables custom, integrado con Tailwind CSS v4.

**Colores de marca:**

| Token | Hex | Uso |
|---|---|---|
| `--color-military` | `#4A5C3F` | Color primario (verde oliva militar) |
| `--color-gold` | `#C5A065` | Acento dorado (ganancias, highlights) |
| `--color-bone` | `#F5F0EB` | Fondo principal (modo claro) |
| `--color-sand` | `#E8E0D6` | Fondo secundario |
| `--color-oxide` | `#8B6F47` | Bordes, acentos terrosos |
| `--color-carbon` | `#1C1917` | Texto principal (modo claro) |
| `--color-slate` | `#44403C` | Texto secundario |

**Tipografía:**

| Fuente | Uso |
|---|---|
| Inter | Texto general del sistema (sans-serif) |
| Archivo | Títulos y headers |
| Geist Mono | Números y datos tabulares (monoespaciada) |

### 11.2 Clases Globales Personalizadas

| Clase | Propósito |
|---|---|
| `.executive-card` | Tarjetas con fondo blanco, bordes suaves y sombra sutil |
| `.num-tabular` | Números alineados tabularlmente con font-variant-numeric |
| `.font-title` | Aplica fuente Archivo para títulos |
| `.scrollbar-hide` | Oculta scrollbar manteniendo scroll funcional |
| `.touch-target` | Mínimo 44x44px para cumplir WCAG (accesibilidad táctil) |

### 11.3 Dark Mode

Activado mediante `data-theme="dark"` en el elemento `<html>`.

**Mecanismo:**
1. Al cargar la página, un inline script lee `localStorage['theme']` y aplica el atributo
2. `ThemeToggle` permite cambiar entre modos
3. La preferencia se persiste en localStorage

**Cambios en dark mode:**
- Fondos: blanco → tonos oscuros (`#1C1917`, `#292524`)
- Texto: oscuro → claro (`#F5F0EB`, `#D6D3D1`)
- Tarjetas: fondo blanco → fondo gris oscuro
- Bordes: gris claro → gris oscuro
- Inputs: fondo blanco → fondo oscuro
- Gráficos: tonos ajustados para contraste

### 11.4 Estilos de Impresión

```css
@media print {
  /* Oculta sidebar, FAB, botones de acción */
  /* Maximiza área de contenido */
  /* Ajusta colores para impresión */
}
```

### 11.5 Calendar Styles

Estilos personalizados para react-day-picker bajo la clase `.contago-calendar`:
- Colores integrados con el design system
- Tamaño adaptado a mobile y desktop

---

## 12. Datos de Seed y Mock

### 12.1 Seed Data (prisma/seed.ts)

Script ejecutable con `npx prisma db seed` que genera datos de demo para desarrollo y testing.

**Datos generados:**

1. **Usuario demo:**
   - Email: `demo@finarg.com`
   - Contraseña: `Demo1234` (hasheada con bcrypt)
   - Email verificado

2. **Negocio de demo:**
   - Nombre: "FinArg Demo S.A."
   - Moneda: ARS
   - Modelo operativo: BOTH
   - Membresía: ADMIN / ACTIVE

3. **Cuentas (3):**
   - Caja Chica (CASH) — $280.000 ARS
   - Banco Galicia (BANK) — $8.400.000 ARS
   - Caja Ahorro USD (BANK) — $4.200 USD

4. **Categorías (10):**
   - INCOME: Ventas Servicios, Alquileres, Otros Ingresos
   - EXPENSE: Sueldos, Alquiler, Servicios, Publicidad, Materiales, Impuestos, Retiros Socios

5. **Áreas de Negocio (3):** Comercial, Administración, Operaciones

6. **Contactos (5):**
   - Clientes: Grupo Meridian, Constructora Del Sur, Farmacia El Sol
   - Proveedores: Servicios Tech, Distribuidora Norte

7. **Transacciones:** 6 meses de datos realistas (Oct 2025 → Mar 2026)
   - Patrones coherentes de ingresos y egresos mensuales
   - Créditos pendientes y vencidos incluidos
   - Transacciones multi-moneda (ARS + USD con exchange rate)

8. **Productos (3):** Con movimientos de stock de ejemplo

**Comportamiento:** Limpia todas las tablas antes de re-sembrar (respeta orden de FK).

### 12.2 Mock Data (src/lib/mock.ts)

Fallback para desarrollo sin base de datos configurada.

**Activación:**
```typescript
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true'
                 || process.env.USE_MOCK_DATA === 'true'
                 || !hasDatabaseConfig   // Si no hay DB URL
```

**Exports:**
- `MOCK_ACCOUNTS` — Cuentas estáticas
- `MOCK_CATEGORIES` — Categorías estáticas
- `MOCK_CONTACTS` — Contactos estáticos
- `MOCK_AREAS` — Áreas estáticas
- `MOCK_TRANSACTIONS` — Transacciones estáticas
- `MOCK_PRODUCTOS` — Productos estáticos
- `MOCK_BIENES` — Bienes de uso estáticos
- `getMockDashboardStats(period, from?, to?)` — Genera KPIs calculados para el dashboard
- `getMockCajasData()` — Datos para la página de cajas

---

## 13. Modelo de Negocio y Roadmap

### 13.1 Plan Freemium

**Plan Gratis:**
- Máximo 150 transacciones por mes
- Máximo 20 contactos
- 1 solo negocio
- Sin exportar PDF/Excel
- Sin facturación AFIP
- Asistente IA con límite de mensajes diarios

**Plan Pago (precio por definir):**
- Transacciones ilimitadas
- Contactos ilimitados
- Múltiples negocios
- Exportar PDF/Excel
- Facturación AFIP (post-MVP)
- Asistente IA sin límites
- Conciliación bancaria
- Notificaciones avanzadas

**Implementación futura:**
- Campo `isPro` + `planExpiresAt` en el modelo Business
- Middleware en server actions validando límites
- Mensajes amigables cuando se alcanza un límite

### 13.2 Fases de Desarrollo

#### Fase 1: Identidad, Acceso y Negocio Activo (Semana 20-27 Mar)
- Login social (Google, Apple) + credenciales
- Verificación por código al email
- Recuperación de contraseña
- Multi-tenancy con roles
- Selector de negocio activo
- Endurecimiento de seguridad

#### Fase 2: Asistente IA (Semana 27 Mar - 3 Abr)
- Chat UI para asistente IA
- Tool calling para crear transacciones via chat
- Contexto automático (KPIs, alertas, créditos vencidos)
- Clasificación automática de categorías

#### Fase 3: Reportes Mejorados (Semana 3-10 Abr)
- KPIs avanzados y flujo de fondos
- Punto de equilibrio (breakeven analysis)
- Exportar PDF/Excel
- Cacheo de reportes para rendimiento

#### Fase 4: Automatización (Semana 10-18 Abr)
- Emails automáticos (créditos por vencer)
- Push notifications
- Conciliación bancaria
- PWA manifest para experiencia mobile nativa

#### Fase 5+ (Post-MVP)
- Facturación AFIP
- Integración MercadoPago
- App móvil (React Native)
- Memoria conversacional avanzada para IA
- Orquestación IA multi-herramienta

### 13.3 Métricas de Éxito MVP

| Métrica | Objetivo |
|---|---|
| Tiempo de carga del dashboard | < 1.5s |
| Tiempo de respuesta IA | < 3s (streaming) |
| Uptime | > 99.5% |
| Usuarios activos (mes 1) | 10-30 |
| Retención semanal | > 60% |
| NPS beta testers | > 40 |
| Errores no manejados | < 1% de requests |

---

## 14. Estado Actual y Pendientes

### 14.1 Completado

**Autenticación:**
- NextAuth con Google, Apple y Credentials configurado
- Sistema de verificación por código al email (EmailChallenge)
- Recuperación de contraseña con código
- Sesión JWT extendida con contexto de negocio
- Desafío de seguridad periódico (cada 30 días)
- Todas las pantallas de auth implementadas (login, registro, verificación, reset, error)

**Multi-Tenancy:**
- Modelo User → BusinessMember → Business
- Roles: ADMIN, COLLABORATOR, VIEWER
- Selector de negocio activo para usuarios con múltiples membresías
- `defaultBusinessId` en User para acceso directo

**Base de Datos:**
- Esquema Prisma con 15 modelos
- 3 migraciones ejecutadas
- Script de seed con datos demo realistas
- Prisma Client configurado con adaptador Turso/libSQL

**Modelo Financiero:**
- Cuentas/Cajas (CASH, BANK, WALLET)
- Categorías (INCOME, EXPENSE)
- Transacciones con soporte para créditos/deudas y multi-moneda
- Productos con control de stock y movimientos
- Bienes de uso con depreciación lineal automática
- Áreas de negocio (centros de costo)
- Contactos (clientes y proveedores)

**Frontend:**
- Dashboard con 4 tarjetas KPI + sparklines + gráficos
- 6 páginas funcionales (Cajas, Créditos, Reports, Stock, Bienes, Select Business)
- Sidebar responsive (desktop + mobile)
- Dark/light mode con persistencia
- Formulario de transacciones completo
- Componentes CRUD para todas las entidades
- Sistema de diseño con colores de marca

### 14.2 Pendiente — Crítico (Fase 1)

1. **Rehabilitar acciones CRUD deshabilitadas:** `createTransaction`, `createAccount`, `createContact`, etc. necesitan implementarse con `getBusinessId()` + transacciones atómicas.

2. **Agregar índices faltantes en Prisma:**
   - Account: `@@index([businessId])`
   - Category: `@@index([businessId])`
   - Contact: `@@index([businessId])`
   - Producto: `@@index([businessId])`
   - AreaNegocio: `@@index([businessId])`
   - BienDeUso: `@@index([businessId])`

3. **Optimizar JWT hydration:** Agregar throttle/caché para evitar 2 queries en cada request.

4. **Headers de seguridad en next.config.ts:** `poweredByHeader: false`, CSP, X-Frame-Options, X-Content-Type-Options.

5. **Rate limiting:** Protección contra fuerza bruta en login y verificación de código.

6. **Limpieza de EmailChallenge**: Cron job o mecanismo para eliminar challenges expirados.

7. **Configurar Resend end-to-end:** Credenciales reales para envío de emails en producción.

### 14.3 Pendiente — Fase 2+

- Asistente IA con chat UI y tool calling
- Validación de permisos por rol en mutaciones
- Tabla de auditoría (AuditLog)
- Pipeline de documentos (OCR para facturas)
- Emails automáticos para créditos por vencer
- Exportación PDF/Excel
- Conciliación bancaria
- PWA manifest

---

## 15. Análisis de Riesgos y Recomendaciones

### 15.1 Riesgos Identificados

#### Crítico

| # | Riesgo | Impacto | Mitigación |
|---|---|---|---|
| 1 | Queries N+1 en `hydrateTokenContext` — 2 queries por cada request JWT sin throttle | Degradación de performance con usuarios concurrentes | Agregar caché in-memory con TTL de 60 segundos |
| 2 | Actualización de balance no atómica en `createTransaction` | Inconsistencia de datos si falla mid-operación | Envolver en `prisma.$transaction()` |
| 3 | Funciones CRUD principales deshabilitadas | Sin escritura de datos (el sistema es solo lectura actualmente) | Rehabilitar con validación de rol y negocio |

#### Alto

| # | Riesgo | Impacto | Mitigación |
|---|---|---|---|
| 4 | Índices faltantes en 6 tablas por `businessId` | Full table scans, queries lentos con escala | Agregar índices, ejecutar migración |
| 5 | Sin rate limiting en server actions | Fuerza bruta en login, spam, abuso | Implementar rate limiter (Upstash Redis o similar) |
| 6 | Headers HTTP de seguridad faltantes (CSP, X-Frame-Options, etc.) | Vulnerabilidad a XSS, clickjacking, MIME sniffing | Agregar headers en next.config.ts |

#### Medio

| # | Riesgo | Impacto | Mitigación |
|---|---|---|---|
| 7 | Resend no configurado con credenciales reales | Sin envío real de códigos en producción | Configurar RESEND_API_KEY y AUTH_EMAIL_FROM |
| 8 | Código muerto (~130 líneas comentadas, modelos no usados) | Confusión, mantenimiento difícil | Limpiar VerificationToken, PasswordResetToken |
| 9 | Dos librerías de gráficos (ECharts + Recharts) | Bundle size inflado, redundancia | Quedarse solo con ECharts |

#### Bajo

| # | Riesgo | Impacto | Mitigación |
|---|---|---|---|
| 10 | Apple OAuth sin credenciales reales | Login con Apple no funcional | Configurar credenciales en producción |

### 15.2 Recomendaciones Técnicas

1. **Caché para JWT hydration:** Agregar TTL de 60s para evitar queries repetitivos.
2. **Transacciones atómicas:** Todas las operaciones de escritura que afectan balance deben usar `prisma.$transaction()`.
3. **Observabilidad:** Integrar Sentry (errores) + PostHog (analytics) antes de producción.
4. **Testing:** Implementar tests unitarios (Jest) y E2E (Playwright) con mínimo 70% de cobertura.
5. **Migrar a PostgreSQL (Neon):** Post-MVP, para aprovechar triggers, JSONB y mejor escalabilidad.
6. **Cleanup:** Eliminar código comentado, modelos no usados y unificar librería de gráficos.

---

*Documento generado el 20 de marzo de 2026 — Refleja el estado real del código fuente del proyecto ContaGo.*
