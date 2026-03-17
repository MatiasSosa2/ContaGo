# Fase 1: Identidad, Acceso y Negocio Activo

## Objetivo

Construir una base de autenticacion y contexto de negocio suficientemente robusta para que:

- cada usuario acceda de forma segura
- cada request se ejecute dentro del negocio correcto
- cada accion futura del asistente IA herede permisos reales
- la experiencia de acceso sea moderna y familiar para el usuario

La IA no depende de prompts en esta fase. Depende de que el sistema sepa con precision quien es el usuario, desde donde entra y sobre que negocio puede operar.

## Respuesta corta de producto

Si, este tipo de login es estandar en aplicaciones de primer nivel.

Lo correcto no es copiar una autenticacion casera, sino integrar componentes probados:

- Auth.js o NextAuth como capa de sesion y proveedores
- Google como proveedor social
- Apple como proveedor social
- un proveedor de correo transaccional para envio de codigos
- controles propios para negocio activo, recuperacion y desafios de seguridad

En otras palabras: se integra el ecosistema estandar, pero se diseña una capa propia para las reglas del producto.

## Estado actual del repo

Hoy ya existe una base sobre la cual conviene construir:

- NextAuth con Google y Credentials en src/lib/auth.ts
- route handler de auth en src/app/api/auth/[...nextauth]/route.ts
- modelo User, Session, VerificationToken y PasswordResetToken en prisma/schema.prisma
- modelo Business y BusinessMember para multi-tenancy en prisma/schema.prisma

Los huecos principales que esta fase debe cerrar son:

- falta Apple como proveedor de login
- la sesion no resuelve negocio activo ni role
- ya existe una seleccion formal de negocio activo, pero falta terminar de endurecer su uso en todo el backend
- no hay flujo implementado de verificacion por codigo al email
- no hay flujo implementado de recuperacion de contraseña con codigo
- el backend de negocio usa un helper temporal para obtener businessId
- el onboarding inicial todavia no captura el modelo operativo del negocio

## Decisiones tecnicas de Fase 1

### Decision 1: mantener Auth.js como nucleo de sesion

No conviene reescribir autenticacion desde cero.

Se recomienda:

- mantener Auth.js para sesiones y providers
- agregar AppleProvider
- mantener CredentialsProvider para email y contraseña
- resolver informacion de sesion extendida via callbacks y consultas al backend

### Decision 2: unificar politica de seguridad, no necesariamente flujo identico

El usuario quiere consistencia entre Google, Apple y email. Eso se logra con politica comun:

- email verificado
- control de nuevo dispositivo o evento de riesgo
- desafios por codigo al email cuando corresponda
- recuperacion de contraseña por codigo

No hace falta pedir codigo al email en cada login social. Eso agregaria friccion sin mejorar de verdad la seguridad diaria.

Se recomienda pedir codigo al email en:

- registro con email y contraseña
- recuperacion de contraseña
- primer login social
- login desde dispositivo nuevo
- evento de riesgo

### Decision 3: negocio activo como parte formal de la sesion

El sistema debe saber siempre sobre que negocio opera el usuario.

Se recomienda que la sesion exponga:

- userId
- activeBusinessId
- activeBusinessRole
- email
- emailVerified
- authMethod o amr basico

### Decision 4: el backend no debe inferir negocio por fallback

El helper temporal que hoy crea o toma el primer negocio debe eliminarse al cerrar esta fase.

Toda accion debe fallar de forma controlada si:

- no hay sesion
- no hay negocio activo
- el usuario no pertenece al negocio activo

### Decision 5: el onboarding debe capturar el perfil operativo del negocio

En una cuenta nueva no alcanza con crear usuario y negocio. Tambien conviene capturar como opera ese negocio.

Se recomienda guardar en Business un campo de perfil operativo inicial:

- SERVICES
- PRODUCTS
- BOTH

Ese dato no es decorativo. Se va a usar despues para adaptar:

- modulos prioritarios
- onboarding inicial
- ayudas contextuales
- recomendaciones del asistente
- vistas destacadas dentro del producto

## Arquitectura objetivo de acceso

Usuario -> Pantalla de login -> Google / Apple / Email

Usuario autenticado -> desafio por codigo si aplica -> sesion emitida

Sesion emitida -> seleccion de negocio activo si hay multiples memberships -> acceso al producto

Request de negocio -> resolver contexto de sesion -> validar membership -> ejecutar accion

Estado actual:

- el login ya redirige al selector de negocio activo
- existe una pantalla dedicada para elegir negocio cuando el usuario tiene multiples memberships
- la seleccion se persiste como negocio por defecto del usuario
- la resolucion de negocio activo ya no selecciona implicitamente el primer negocio cuando hay multiples memberships
- el backend principal ya no crea ni toma un negocio por fallback para seguir operando
- el login con credenciales ya exige verificacion previa si la cuenta no tiene email validado
- el login social y el login por credenciales ya disparan challenge de riesgo cuando no existe una validacion reciente
- falta completar el endurecimiento final de las mutaciones que todavia siguen deshabilitadas

## Modelo de sesion recomendado

La sesion final deberia incluir algo equivalente a esto:

```ts
type AppSession = {
  user: {
    id: string
    email: string
    name?: string | null
    image?: string | null
    emailVerified: boolean
  }
  activeBusiness: {
    id: string
    name: string
    role: 'ADMIN' | 'COLLABORATOR' | 'VIEWER'
  } | null
  auth: {
    provider: 'google' | 'apple' | 'credentials'
    challengeSatisfied: boolean
  }
}
```

No hace falta que todo viva en el JWT. Parte puede resolverse server-side si conviene. Pero desde el punto de vista de la app, ese es el contrato deseado.

## Cambios recomendados en Prisma

### Mantener y reutilizar

- User
- Session
- VerificationToken
- PasswordResetToken
- Business
- BusinessMember

### Cambios sugeridos

#### User

Agregar o formalizar:

- defaultBusinessId opcional
- lastLoginAt opcional
- lastSecurityChallengeAt opcional

#### BusinessMember

Agregar o formalizar:

- status: ACTIVE | INVITED | SUSPENDED
- invitedAt opcional
- acceptedAt opcional

#### Nuevas tablas sugeridas

##### EmailChallenge

Se usa para desafios por codigo al email.

Campos sugeridos:

- id
- userId opcional
- email
- purpose: SIGNUP_VERIFY | SOCIAL_LOGIN_VERIFY | PASSWORD_RESET | RISK_CHALLENGE
- codeHash
- expiresAt
- consumedAt opcional
- attempts
- maxAttempts
- ipAddress opcional
- userAgent opcional
- createdAt

##### UserDevice

Se usa para recordar dispositivos confiables.

Campos sugeridos:

- id
- userId
- deviceFingerprintHash
- label opcional
- lastSeenAt
- trustedAt opcional
- createdAt

##### UserActiveBusiness

Opcional. Se usa si queres persistir el negocio activo fuera de JWT.

Campos sugeridos:

- userId
- businessId
- updatedAt

### Observacion importante

El PasswordResetToken actual puede mantenerse si se usa como token largo. Pero si tu UX objetivo es codigo numerico al email, conviene unificar todo con EmailChallenge y manejar password reset como un purpose especifico.

Eso simplifica la arquitectura.

#### Business

Agregar o formalizar:

- operatingModel: SERVICES | PRODUCTS | BOTH
- onboardingCompletedAt opcional

## Flujos funcionales recomendados

## Onboarding inicial recomendado

El onboarding inicial no debe ser largo ni tecnico. Debe pedir solo el contexto minimo para adaptar la primera experiencia del sistema.

### Objetivo del onboarding inicial

- entender como opera el negocio
- definir que modulos priorizar
- ordenar la primera experiencia del usuario
- evitar preguntas avanzadas demasiado temprano

### Regla de producto

El onboarding inicial debe tener preguntas simples, cortas y con impacto real. Si una respuesta no cambia nada relevante en la experiencia, no deberia formar parte del onboarding obligatorio.

### Preguntas recomendadas

#### 1. Tu negocio vende servicios, productos o ambos

Opciones:

- Servicios
- Productos
- Servicios y productos

Impacto esperado:

- SERVICES: priorizar clientes, cobros, gastos, rentabilidad y reportes operativos
- PRODUCTS: priorizar stock, proveedores, costo, margen e inventario
- BOTH: habilitar una experiencia mixta sin ocultar ninguno de los dos frentes

#### 2. Ya estas operando o quieres empezar desde cero

Opciones:

- Ya tengo movimientos y quiero ordenarlos
- Estoy empezando desde cero

Impacto esperado:

- si ya opera: priorizar importacion, carga inicial y puesta en orden
- si empieza de cero: priorizar configuracion guiada, cuentas base y primeros registros

#### 3. Trabajas solo o con un equipo

Opciones:

- Trabajo solo
- Trabajo con equipo

Impacto esperado:

- solo: experiencia mas directa y menos foco en colaboracion
- equipo: preparar luego invitaciones, permisos y operacion compartida

#### 4. Que quieres resolver primero

Opciones sugeridas:

- Ordenar ingresos y gastos
- Controlar stock
- Mejorar cobranzas
- Entender mejor los numeros del negocio

Impacto esperado:

- define el primer foco del dashboard, sugerencias iniciales y recorrido guiado

#### 5. Quieres cargar datos reales ahora o prefieres empezar con una guia

Opciones:

- Cargar mis datos ahora
- Empezar con una guia paso a paso

Impacto esperado:

- datos reales: llevar al usuario a su primer flujo operativo real
- guia: mostrar pasos sugeridos, ejemplos y recorrido asistido

### Preguntas que no conviene incluir en el onboarding inicial

- configuraciones contables avanzadas
- estructuras complejas de categorias
- politicas fiscales detalladas
- configuraciones profundas de inventario
- preguntas que el sistema puede inferir despues

### Resultado esperado del onboarding inicial

Al finalizar este onboarding, el sistema ya deberia poder:

- decidir que modulos resaltar primero
- definir el primer flujo recomendado
- adaptar la home y sugerencias iniciales
- preparar el contexto base para el futuro asistente IA

### Resultado esperado por perfil

#### Perfil SERVICES

- destacar clientes, transacciones, creditos y reportes
- reducir protagonismo inicial del modulo de stock

#### Perfil PRODUCTS

- destacar inventario, productos, proveedores y margen
- reducir protagonismo inicial de flujos puramente de servicios

#### Perfil BOTH

- mostrar una experiencia balanceada
- sugerir un primer recorrido segun la prioridad declarada por el usuario

### 1. Registro con email y contraseña

1. El usuario completa nombre, email, contraseña y perfil operativo del negocio.
2. Se crea el usuario en estado pendiente o con acceso restringido.
3. Se emite EmailChallenge con purpose SIGNUP_VERIFY.
4. Se envia codigo al email.
5. El usuario valida codigo.
6. Se marca email como verificado.
7. Se crea negocio inicial con operatingModel.
8. El sistema puede adaptar onboarding y modulos segun ese perfil.

### 2. Login con email y contraseña

1. El usuario envia email y contraseña.
2. CredentialsProvider valida hash.
3. Si email no esta verificado, se fuerza flujo de verificacion.
4. Si hay riesgo o dispositivo nuevo, se emite EmailChallenge.
5. Si todo esta bien, se crea sesion.

### 3. Login con Google

1. Auth.js redirige a Google.
2. Google autentica al usuario.
3. Se busca o crea el usuario interno.
4. Si es primer acceso o evento de riesgo, se emite EmailChallenge.
5. Se completa sesion.

### 4. Login con Apple

1. Auth.js redirige a Apple.
2. Apple autentica al usuario.
3. Se busca o crea el usuario interno.
4. Si es primer acceso o evento de riesgo, se emite EmailChallenge.
5. Se completa sesion.

### 5. Recuperacion de contraseña

1. El usuario ingresa su email.
2. El sistema responde de forma neutra.
3. Si la cuenta existe, se emite EmailChallenge con purpose PASSWORD_RESET.
4. El usuario ingresa codigo.
5. El sistema habilita cambio de contraseña.
6. Se invalida todo challenge pendiente relacionado.

### 6. Seleccion de negocio activo

1. Luego del login se consultan memberships activas.
2. Si hay una sola, se selecciona automaticamente.
3. Si hay varias, se muestra selector.
4. La seleccion se guarda en sesion o persistencia auxiliar.
5. Toda accion de negocio usa ese contexto.

## Reglas de seguridad recomendadas

### Email challenge

- expiracion de 10 minutos
- 5 intentos maximos
- invalidacion al usarlo correctamente
- un solo challenge activo por purpose y email cuando corresponda

### Passwords

- bcrypt o argon2
- politicas de longitud minima
- invalidacion de sesiones activas tras reset de contraseña

### Recovery y login

- mensajes neutros ante email inexistente
- rate limiting por IP y por email
- auditoria de intentos fallidos
- bloqueo temporal ante exceso de intentos

### Session hardening

- revisar expiracion y refresh del JWT
- invalidar negocio activo si el membership deja de existir
- no confiar solo en datos del cliente para role o businessId

## Propuesta de cambios por archivo

### prisma/schema.prisma

Cambios a introducir:

- agregar Apple support indirectamente via AccountAuth existente
- agregar EmailChallenge
- agregar UserDevice
- evaluar UserActiveBusiness o defaultBusinessId en User
- ampliar BusinessMember con status
- agregar operatingModel en Business para adaptar la experiencia por tipo de negocio

### src/lib/auth.ts

Cambios a introducir:

- agregar AppleProvider
- extender callbacks para incluir negocio activo y role
- desacoplar logica de challenge de la configuracion del provider
- endurecer authorize de credentials

### src/app/api/auth/[...nextauth]/route.ts

Se mantiene como entrypoint de Auth.js.

### Nuevos modulos recomendados

- src/server/auth/get-session-context.ts
- src/server/auth/require-auth.ts
- src/server/auth/require-business-context.ts
- src/server/auth/challenges.ts
- src/server/auth/devices.ts
- src/server/auth/passwords.ts
- src/server/auth/business-selection.ts

### src/app/actions.database.ts

Cambios a introducir:

- eliminar helper temporal de businessId
- reemplazarlo por requireBusinessContext
- filtrar todas las lecturas por businessId
- verificar membership antes de cada mutacion

### Nuevas rutas o pantallas sugeridas

- src/app/auth/login/page.tsx
- src/app/auth/register/page.tsx
- src/app/auth/verify-code/page.tsx
- src/app/auth/forgot-password/page.tsx
- src/app/auth/reset-password/page.tsx
- src/app/select-business/page.tsx

## Secuencia de implementacion recomendada

### Paso 1

Definir contrato de sesion extendida y helpers server-side.

Salida esperada:

- el backend ya sabe obtener userId, businessId y role de manera consistente

### Paso 2

Modificar Prisma para soportar challenges y negocio activo.

Salida esperada:

- existen tablas para codigo al email y dispositivos confiables

### Paso 3

Completar Auth.js con Apple y callbacks extendidos.

Salida esperada:

- login con Google, Apple y Credentials usando un modelo coherente

### Paso 4

Implementar verificacion por codigo y recuperacion de contraseña.

Salida esperada:

- signup verify, social verify y password reset funcionan

### Paso 5

Implementar selector de negocio activo.

Salida esperada:

- usuarios multiempresa cambian de contexto sin inconsistencias

### Paso 6

Refactorizar acciones de negocio para usar contexto real.

Salida esperada:

- desaparece la logica temporal de businessId del backend

## Criterios de aceptacion de la Fase 1

- el usuario puede iniciar sesion con Google
- el usuario puede iniciar sesion con Apple
- el usuario puede iniciar sesion con email y contraseña
- el usuario puede verificar cuenta por codigo enviado al email
- el usuario puede recuperar contraseña con codigo al email
- toda request de negocio resuelve negocio activo y role reales
- ninguna lectura devuelve datos fuera del negocio activo
- ninguna mutacion opera sin sesion valida y membership valida

## Riesgos a evitar

- mezclar verificacion de email con recuperacion en modelos inconsistentes
- guardar role y businessId solo en cliente
- seguir usando fallbacks que creen negocios demo automaticamente
- exigir codigo al email en absolutamente todos los logins sociales
- meter IA antes de que estas reglas esten cerradas

## Recomendaciones de integracion

### Proveedor de correo

Para envio de codigos:

- Resend
- Postmark
- Amazon SES

No conviene usar un SMTP improvisado como base del producto.

### Apple Sign In

Apple requiere configuracion real en Apple Developer:

- Services ID
- Team ID
- Key ID
- private key
- dominios y redirect URLs correctos

Esto no es complejo, pero conviene tratarlo como una tarea de infraestructura y no como un detalle de UI.

### Device trust

No hace falta construir un motor antifraude complejo en esta fase.

Alcanza con:

- challenge en primer login
- challenge en dispositivo no reconocido
- auditoria de eventos

## Resultado de negocio de esta fase

Cuando esta fase este terminada, el producto ya no sera solo una app con login. Va a ser una plataforma que sabe:

- quien entra
- como fue autenticado
- que negocio tiene activo
- que permisos tiene
- cuando exigir una verificacion adicional

Ese es el piso tecnico correcto para que despues el chat sea la cara visible del producto y la IA se adapte a un sistema serio.