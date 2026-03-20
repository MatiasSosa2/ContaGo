# ContaGo — Plan Maestro de Arquitectura v2.0
## Auditoría Técnica y Roadmap de Desarrollo

**Fecha:** 20 de marzo de 2026  
**Versión:** 2.0  
**Preparado para:** Equipo ContaGo

---

## 1. Resumen Ejecutivo

ContaGo es un sistema de gestión contable pensado para dueños de negocios y monotributistas en Argentina. Este documento detalla el plan completo de reestructuración y desarrollo, partiendo del estado actual del software hacia una versión profesional, escalable y lista para producción.

### Datos clave del proyecto

| Concepto | Valor |
|----------|-------|
| Público objetivo | Dueños de negocios y monotributistas (Argentina) |
| Modelo de cuenta | 1 usuario = 1 negocio (estricto) |
| Prioridades UX | Fácil de usar, fácil de entender, moderno y veloz |
| Killer feature | Asistente IA con Claude — herramienta central del sistema |
| Deadline MVP | ~10 de abril de 2026 (prueba con conocidos) |
| Escala proyectada | 30 → 100 → 2.000 usuarios en 3 años |
| Monetización | Freemium (gratis con límites + plan pago) |

---

## 2. Stack Tecnológico

### Actual
- **Framework:** Next.js 16.1.6 (Turbopack, React Compiler)
- **Frontend:** React 19.2.3, Tailwind CSS v4, ECharts + Recharts
- **Auth:** NextAuth v4 (JWT, credentials + Google + Apple)
- **DB:** Turso (libSQL remoto) con Prisma 7.4.1
- **Email:** Resend
- **Deploy:** Vercel

### Propuesto
- **DB:** Migrar a PostgreSQL (Neon — serverless, tier gratis generoso)
- **IA:** Anthropic Claude via API (tool calling para acciones reales)
- **Móvil:** React Native / Expo (post-MVP)
- **Notificaciones:** Email (Resend) + Web Push
- **Pagos:** MercadoPago (post-MVP)

---

## 3. Arquitectura de Datos — Modelo 1:1

### Problema actual
El schema tiene un modelo multi-tenant con tabla intermedia `BusinessMember` (N:M entre User y Business), roles (ADMIN/COLLABORATOR/VIEWER), flujo de selección de negocio, y `defaultBusinessId`.

### Modelo propuesto
- `User` tiene un `businessId` directo → relación 1:1 con `Business`
- `Business` se crea automáticamente en el wizard de onboarding post-registro
- Eliminar `BusinessMember`, `select-business/`, `BusinessSelectorPanel`

### Sistema de roles simplificado
- El **dueño** es el User vinculado al Business
- Los **empleados** se modelan con una tabla `BusinessEmployee` (userId, businessId, permisos limitados)
- Empleados NO pueden: eliminar datos, modificar configuración, ver datos sensibles

### Archivos impactados
| Archivo | Cambio |
|---------|--------|
| `prisma/schema.prisma` | Eliminar `BusinessMember`, agregar `businessId` en User, nueva tabla `BusinessEmployee` |
| `src/server/auth/business-context.ts` | Simplificar a 1 query trivial o eliminar |
| `src/server/auth/get-session-context.ts` | Ya no llama `listUserBusinesses`. 1 query con include |
| `src/server/auth/require-business-context.ts` | No redirige a select-business |
| `src/app/select-business/page.tsx` | Eliminar |
| `src/components/auth/BusinessSelectorPanel.tsx` | Eliminar |
| `src/lib/auth.ts` | Simplificar `hydrateTokenContext` a 1 query |
| `src/app/actions.database.ts` | `getBusinessId()` internamente más rápido |

---

## 4. Auditoría del Estado Actual

### 4.1 Índices faltantes en la base de datos (CRÍTICO)
Casi todas las tablas financieras filtran por `businessId` pero no tienen índice. Esto degrada el rendimiento con escala.

| Modelo | Índice faltante |
|--------|----------------|
| Account | `@@index([businessId])` |
| Category | `@@index([businessId])` |
| Contact | `@@index([businessId])` |
| Producto | `@@index([businessId])` |
| BienDeUso | `@@index([businessId])` |
| MovimientoStock | `@@index([productoId, fecha])` |
| AreaNegocio | `@@index([businessId])` |

Solo `Transaction` tiene índice compuesto correcto.

### 4.2 Cuello de botella: JWT Hydration (ALTO)
`hydrateTokenContext` en `src/lib/auth.ts` ejecuta 2 queries a la DB en CADA request HTTP:
1. `prisma.user.findUnique(...)` — datos del usuario
2. `resolveUserActiveBusiness(...)` — query a BusinessMember + Business

**Solución:** Con modelo 1:1, query 2 desaparece. Agregar throttle: no rehidratar si `token.hydratedAt` < 60 segundos.

### 4.3 CRUD deshabilitado (CRÍTICO)
Tres funciones están comentadas con TODO en `src/app/actions.database.ts`:
- `createTransaction` (~línea 119)
- `createAccount` (~línea 228)
- `createContact` (~línea 97)

El código funcional está comentado. Además, `createTransaction` tiene un bug: actualiza el balance fuera de una transacción atómica.

**Solución:** Rehabilitar usando `getBusinessId()` y envolver en `prisma.$transaction()`.

### 4.4 Queries pesados en reportes (MEDIO)
`getReportData` carga TODAS las transacciones en memoria y las procesa con loops JS. Sin paginación ni caché (a diferencia de `getDashboardStats` que usa `unstable_cache`).

**Solución:** Agregar `unstable_cache` con TTL 30-60s. Para negocios grandes, usar agregar con GROUP BY en vez de traer todo a JS.

### 4.5 Seguridad
| Hallazgo | Impacto |
|----------|---------|
| `next.config.ts` sin `poweredByHeader: false` | Expone tecnología del servidor |
| Sin headers de seguridad (CSP, X-Frame-Options) | Vulnerable a clickjacking/XSS |
| Challenge pepper fallback hardcodeado | Riesgo si faltan env vars |
| Sin limpieza automática de EmailChallenge expirados | Tabla crece indefinidamente |
| Sin rate limiting en server actions | Posible abuso |

### 4.6 Código muerto
| Elemento | Detalle |
|----------|---------|
| ~130 líneas comentadas | createTransaction, createAccount, createContact |
| `PasswordResetToken` en schema | No se usa (se usa EmailChallenge) |
| `VerificationToken` en schema | No se usa (se usa EmailChallenge) |
| `Session` model en schema | JWT no necesita tabla de sesiones |
| `getMonthlyStats` / `getWeeklyStats` | Posiblemente no usadas (dashboard usa getDashboardStats) |
| Dos librerías de charts | ECharts + Recharts — unificar |

---

## 5. Plan Freemium

### Plan Gratis
- Máximo 150 transacciones por mes
- Máximo 20 contactos
- 1 solo negocio
- Sin exportar PDF/Excel
- Sin facturación AFIP
- Asistente IA con límite de mensajes diarios

### Plan Pago (precio a definir)
- Transacciones ilimitadas
- Contactos ilimitados
- Exportar PDF/Excel
- Facturación AFIP
- Asistente IA sin límites
- Conciliación bancaria
- Notificaciones avanzadas

### Implementación
- Campo `isPro` y `planExpiresAt` en modelo Business
- Middleware en server actions que valida límites antes de ejecutar
- Mensajes amigables cuando se alcanza un límite

---

## 6. Roadmap de Desarrollo

### FASE 0 — Cimientos (semana 1, días 1-4)

Objetivo: Base sólida sin features nuevas. Todo lo que viene después depende de esto.

| # | Tarea | Detalle |
|---|-------|---------|
| 0.1 | Migrar DB a PostgreSQL (Neon) | Cambiar provider, configurar conexión, migrar datos |
| 0.2 | Simplificar schema 1:1 | Eliminar BusinessMember, User → businessId directo |
| 0.3 | Sistema de roles | Tabla BusinessEmployee para empleados con permisos limitados |
| 0.4 | Agregar índices faltantes | @@index([businessId]) en 6 tablas |
| 0.5 | Rehabilitar CRUD deshabilitado | createTransaction, createAccount, createContact |
| 0.6 | Optimizar JWT hydration | Throttle 60s + eliminar query redundante |
| 0.7 | Limpiar código muerto | Modelos unused, funciones comentadas, unificar charts |
| 0.8 | Headers de seguridad | poweredByHeader, CSP, X-Frame-Options |

### FASE 1 — Funcionalidades Core (semana 1-2, días 4-10)

Objetivo: Todas las funciones de caja, stock y créditos funcionando perfectamente.

| # | Tarea | Detalle |
|---|-------|---------|
| 1.1 | Wizard de onboarding | Nombre del negocio, moneda base, modelo operativo, cuentas iniciales |
| 1.2 | Transacciones completas | CRUD con actualización atómica de balance, multi-moneda, créditos/deudas |
| 1.3 | Cuentas/Cajas | CRUD completo, balance automático, multi-moneda configurable |
| 1.4 | Contactos | CRUD con tipo cliente/proveedor, límite 20 en plan gratis |
| 1.5 | Stock completo | Productos + movimientos, actualización automática, top por valor |
| 1.6 | Créditos y deudas | Vista dedicada, estados, alertas de vencimiento |
| 1.7 | Bienes de uso | CRUD con depreciación, categorías, vinculación con transacción |
| 1.8 | Límites Freemium | Middleware de validación con mensajes amigables |

### FASE 2 — Asistente IA (semana 2, días 8-12)

Objetivo: El asistente IA como copiloto financiero central del sistema.

| # | Tarea | Detalle |
|---|-------|---------|
| 2.1 | API route `/api/chat` | Endpoint streaming con Anthropic SDK + system prompt contextual |
| 2.2 | Tool calling | Claude ejecuta acciones reales: crear transacciones, buscar datos, obtener KPIs, registrar stock, marcar créditos |
| 2.3 | Chat UI integrado | Panel lateral/modal desde cualquier página, historial persistido, botón flotante |
| 2.4 | Contexto automático | Inyectar KPIs, alertas activas, créditos vencidos antes de cada mensaje |
| 2.5 | Alertas predictivas | Análisis periódico: runway bajo, gastos crecientes, créditos por vencer |
| 2.6 | Clasificación automática | Sugerir categoría al cargar transacciones, basado en descripción e historial |

### FASE 3 — Reportes y Exportación (semana 2-3, días 10-14)

| # | Tarea | Detalle |
|---|-------|---------|
| 3.1 | Dashboard mejorado | KPIs con comparativo ▲▼, sparklines, alertas inteligentes |
| 3.2 | Flujo de fondos | Operativo/Inversión/Financiero con gráfico apilado |
| 3.3 | Punto de equilibrio | Breakeven con costos fijos vs variables, gráfico interactivo |
| 3.4 | Exportar PDF | react-pdf/renderer para reportes descargables (solo plan pago) |
| 3.5 | Exportar Excel | xlsx/exceljs para transacciones y reportes (solo plan pago) |
| 3.6 | Cachear reportes | unstable_cache con TTL 30-60s |

### FASE 4 — Notificaciones y Conciliación (semana 3, días 14-18)

| # | Tarea | Detalle |
|---|-------|---------|
| 4.1 | Emails automáticos | Créditos venciendo en 48hs, resumen semanal (Resend + Vercel Cron) |
| 4.2 | Push notifications | Service worker para alertas web push |
| 4.3 | Conciliación bancaria | Upload CSV/Excel, matching por monto+fecha, UI para confirmar |
| 4.4 | PWA manifest | App instalable desde navegador |

### FASE 5 — Facturación AFIP (post-MVP)

| # | Tarea | Detalle |
|---|-------|---------|
| 5.1 | Registrar facturas | UI para cargar tipo, número y archivo de factura |
| 5.2 | Emitir facturas monotributista | Integración WSFE/AFIP con certificado digital (solo plan pago) |
| 5.3 | MercadoPago | Webhook para registrar cobros/pagos automáticamente |

### FASE 6 — App Móvil (post-MVP, paralelo)

| # | Tarea | Detalle |
|---|-------|---------|
| 6.1 | Expo + React Native | Compartir validaciones Zod y tipos, API routes como backend |
| 6.2 | Pantallas prioritarias | Dashboard, cargar transacción, chat IA, lista de transacciones |
| 6.3 | Auth nativa | Sign in with Apple + Google nativo, JWT compartido |

---

## 7. Recomendaciones Técnicas

### PostgreSQL → Neon (recomendado)
- **Tier gratis:** 0.5 GB storage, 190 horas de cómputo/mes
- **Serverless:** escala a cero, sin costo en idle
- **Branching:** como Git para la DB (ideal para desarrollo)
- **Vercel compatible:** sin configuración extra
- **Backups automáticos** incluidos
- Alternativa: Supabase (más features pero más pesado)

### Unificar librería de charts
Se usan ECharts y Recharts simultáneamente. Recomendación: quedar solo con **ECharts** (más potente, mejor rendimiento, ya usado en los gráficos principales).

### Configuración de seguridad para next.config.ts
- `poweredByHeader: false`
- Headers HTTP de seguridad (CSP, X-Frame-Options, X-Content-Type-Options)
- `output: 'standalone'` si se despliega fuera de Vercel en el futuro

---

## 8. Cronograma Resumido

```
Semana 1 (20-27 mar):  FASE 0 + inicio FASE 1
                        → DB migrada, schema 1:1, CRUD funcionando

Semana 2 (27 mar - 3 abr): FASE 1 completa + FASE 2
                        → Funciones core completas + asistente IA básico

Semana 3 (3-10 abr):   FASE 2 completa + FASE 3 + FASE 4 parcial
                        → IA completo, reportes, notificaciones
                        → LISTO PARA PRUEBA CON CONOCIDOS
```

**Fases 5 y 6** (AFIP + app nativa) se ejecutan post-MVP según feedback de usuarios.

---

## 9. Métricas de Éxito

| Métrica | Objetivo |
|---------|----------|
| Tiempo de carga del dashboard | < 1.5 segundos |
| Tiempo de respuesta del asistente IA | < 3 segundos (streaming) |
| Uptime | > 99.5% |
| Usuarios activos (mes 1) | 10-30 |
| Retención semanal | > 60% |
| NPS de beta testers | > 40 |

---

*Documento generado el 20 de marzo de 2026 — ContaGo v2.0*