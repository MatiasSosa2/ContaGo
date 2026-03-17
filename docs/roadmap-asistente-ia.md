# Roadmap Tecnico: ContaGo + Asistente IA

## Objetivo

Preparar la plataforma para integrar un asistente IA capaz de:

- interpretar instrucciones del usuario en lenguaje natural
- registrar operaciones de negocio de forma segura
- consultar metricas y devolver explicaciones utiles
- procesar archivos y fotos antes de convertirlos en datos estructurados
- operar siempre dentro del negocio correcto y con permisos correctos

El objetivo no es conectar un modelo directamente a la base de datos, sino construir una capa de herramientas de dominio confiable que luego pueda ser orquestada por IA.

## Estado actual

El proyecto ya tiene una base funcional importante:

- modelo multi-tenant en Prisma con Business y BusinessMember
- autenticacion base con NextAuth
- dashboard, reportes, stock, creditos y bienes de uso
- validaciones con Zod
- una capa de acciones del lado servidor

Los principales bloqueos actuales para integrar IA con escritura segura son:

- el contexto de negocio todavia se resuelve con una logica temporal
- varias lecturas no filtran por businessId
- varias escrituras criticas estan deshabilitadas hasta cerrar auth
- no existe una capa formal de permisos por rol para operaciones de negocio
- no hay auditoria ni ejecucion trazable de comandos
- no hay pipeline de documentos para fotos, PDF y comprobantes

## Principios de arquitectura

1. La IA no toca Prisma directamente.
2. La IA solo invoca herramientas backend predefinidas.
3. Toda lectura y escritura debe estar scopeada por businessId.
4. Toda accion sensible debe validar permisos y dejar auditoria.
5. Toda accion ambigua debe pasar por confirmacion del usuario.
6. Los archivos se procesan primero como documentos, no como escrituras automaticas.
7. El dashboard pasa a ser una capa de verificacion y analitica, no el punto central de carga.

## Principio de producto

Desde la arquitectura interna, la IA debe ser el ultimo eslabon del sistema.

- primero identidad
- despues permisos
- despues comandos de dominio
- despues auditoria
- despues documentos y contexto
- recien despues IA

Desde la experiencia de usuario, la IA puede y debe ser el primer eslabon visible.

- el usuario entra por chat
- el sistema interpreta
- el backend traduce a comandos seguros
- el panel muestra impacto, trazabilidad y analitica

Esto permite tener una experiencia chat-first sin sacrificar control tecnico.

## Estrategia de identidad y acceso

La autenticacion no debe pensarse solo como login. Debe cubrir:

- alta de cuenta
- verificacion del email
- login social
- recuperacion de contraseña
- seleccion de negocio activo
- verificacion adicional para eventos de riesgo

### Objetivo de experiencia

Desde el lado del usuario, el acceso debe sentirse simple y consistente:

- continuar con Google
- continuar con Apple
- iniciar sesion con email y contraseña
- recuperar acceso mediante codigo enviado al email

### Recomendacion tecnica

Google y Apple no deberian copiar literalmente el mismo flujo que email y contraseña porque ya aportan una verificacion de identidad propia del proveedor. La forma mas robusta de unificar seguridad es esta:

- login con Google o Apple como autenticacion primaria
- verificacion por codigo al email en primer acceso, nuevo dispositivo o evento de riesgo
- login con email y contraseña con verificacion de email al alta
- recuperacion de contraseña por codigo temporal enviado al email
- verificacion adicional por codigo para acciones sensibles si mas adelante hiciera falta

Esto mantiene una experiencia consistente sin duplicar friccion innecesaria en cada login social.

### Flujos recomendados

#### Registro con email y contraseña

- el usuario crea cuenta
- el sistema envia codigo temporal al email
- el usuario valida codigo
- la cuenta queda habilitada

#### Login con Google o Apple

- el usuario autentica con el proveedor
- si es primer acceso o dispositivo no reconocido, el sistema envia codigo al email
- si el codigo es correcto, crea o habilita la sesion

#### Recuperacion de contraseña

- el usuario solicita recuperacion
- el sistema envia codigo numerico o token de un solo uso al email
- el usuario valida codigo
- el usuario define nueva contraseña

### Consideraciones de seguridad

- los codigos deben tener expiracion corta
- deben existir limites de reintentos
- debe registrarse auditoria de login, recuperacion y verificacion
- debe invalidarse el codigo luego de uso exitoso
- conviene detectar dispositivo nuevo o sesion riesgosa
- no deberian revelarse detalles sobre si un email existe o no

### Nuevas tablas sugeridas para identidad

- EmailVerificationCode
- PasswordRecoveryCode
- UserDevice o LoginChallenge
- ActiveBusinessSession opcional si se quiere persistir negocio activo fuera del JWT

## Arquitectura objetivo

Usuario -> Chat UI -> Orquestador IA -> Herramientas de dominio -> Prisma/DB

Usuario -> Upload de archivo/foto -> OCR/Parser -> Propuesta estructurada -> Confirmacion -> Herramientas de dominio -> Prisma/DB

Dashboard/Reportes -> consumen la misma base normalizada

## Fase 1: Identidad, sesion y negocio activo

Diseno detallado disponible en docs/fase-1-identidad-acceso-y-negocio-activo.md

### Objetivo

Eliminar la logica temporal de negocio y hacer que todas las operaciones dependan del usuario autenticado y del negocio activo.

### Trabajo tecnico

- extender la sesion para incluir userId, businessId activo y role
- definir seleccion de negocio activo para usuarios con multiples memberships
- reemplazar el helper temporal de businessId por un resolvedor real de contexto
- hacer que todas las lecturas filtren por businessId
- bloquear acceso cuando no exista sesion valida o membership valida
- integrar login con Google y Apple dentro de la misma politica de seguridad
- agregar verificacion por codigo al email para alta, recuperacion y eventos de riesgo
- modelar recuperacion de contraseña y confirmacion de email de forma trazable

### Archivos impactados

- src/lib/auth.ts
- src/app/actions.database.ts
- prisma/schema.prisma

### Criterio de salida

- ninguna query devuelve datos de otro negocio
- ninguna mutacion opera sin sesion y negocio activo
- el usuario puede cambiar de negocio si tiene multiples memberships
- el usuario puede iniciar sesion con Google, Apple o email
- la verificacion por email y la recuperacion de contraseña funcionan de forma consistente

## Fase 2: Capa de permisos y politicas

### Objetivo

Evitar que el futuro asistente ejecute acciones fuera del alcance del usuario.

### Trabajo tecnico

- definir permisos por rol: ADMIN, COLLABORATOR, VIEWER
- crear helpers de autorizacion por accion
- validar ownership de entidades relacionadas antes de mutar
- impedir cruces de entidades entre negocios distintos

### Ejemplos de reglas

- VIEWER no puede crear ni editar transacciones
- COLLABORATOR puede crear operaciones pero no configurar miembros
- ADMIN puede administrar negocio, usuarios y configuracion

### Criterio de salida

- toda mutacion pasa por una verificacion de rol y negocio
- las entidades conectadas siempre pertenecen al mismo businessId

## Fase 3: Comandos de dominio estables

### Objetivo

Separar UI de negocio y crear una capa reusable para formularios, API y futuro chat.

### Trabajo tecnico

- reorganizar acciones server en comandos explicitos
- estandarizar entradas y salidas
- centralizar validacion con Zod
- devolver errores estructurados y consistentes

### Comandos sugeridos

- createTransactionCommand
- createContactCommand
- createAccountCommand
- createCategoryCommand
- createStockMovementCommand
- createAssetCommand
- getBusinessMetricsQuery
- getCashPositionQuery
- getDebtSummaryQuery

### Recomendacion de estructura

- src/server/context
- src/server/auth
- src/server/permissions
- src/server/commands
- src/server/queries
- src/server/audit

### Criterio de salida

- formularios y futuras integraciones ya no dependen de logica mezclada en una sola action
- la IA puede usar estas herramientas sin conocer detalles internos de Prisma

## Fase 4: Consistencia, idempotencia y auditoria

### Objetivo

Hacer que las operaciones ejecutadas por el futuro asistente sean confiables y trazables.

### Trabajo tecnico

- agregar tabla de auditoria de acciones
- registrar actor, businessId, tipo de accion, payload normalizado y resultado
- soportar idempotency keys para evitar duplicados por reintentos
- guardar referencias cruzadas entre mensaje, herramienta y entidad creada

### Nuevas tablas sugeridas

- AuditLog
- ToolExecution
- IdempotencyKey

### Criterio de salida

- cada operacion puede trazarse de punta a punta
- reintentos no generan duplicados silenciosos

## Fase 5: Pipeline de documentos y archivos

### Objetivo

Permitir fotos, PDF y comprobantes sin escrituras automaticas ciegas.

### Trabajo tecnico

- definir almacenamiento de archivos y metadatos
- crear tabla de documentos subidos
- integrar OCR o parser documental
- generar propuesta estructurada a partir del archivo
- pedir confirmacion humana antes de registrar en base

### Nuevas tablas sugeridas

- UploadedDocument
- ParsedDocument
- DocumentLink

### Casos iniciales

- factura de compra
- factura de venta
- ticket de gasto
- remito o ingreso de stock

### Criterio de salida

- el sistema puede convertir un archivo en un borrador de operacion
- la escritura final solo ocurre luego de validacion o confirmacion

## Fase 6: Memoria conversacional y estado operativo

### Objetivo

Dar contexto a la IA sin depender solo de texto libre.

### Trabajo tecnico

- modelar sesiones de chat
- guardar mensajes, intenciones detectadas y acciones propuestas
- soportar estados pendientes de confirmacion
- permitir aclaraciones de seguimiento sin perder contexto

### Nuevas tablas sugeridas

- ChatSession
- ChatMessage
- PendingAction

### Criterio de salida

- el asistente puede continuar una operacion en varios turnos
- el usuario puede confirmar, corregir o cancelar una accion pendiente

## Fase 7: Orquestador IA con herramientas seguras

### Objetivo

Integrar un modelo para interpretar mensajes y ejecutar herramientas backend controladas.

### Trabajo tecnico

- definir contrato de herramientas disponibles para IA
- mapear intenciones a herramientas
- agregar logica de aclaracion cuando falten datos obligatorios
- definir umbrales de confirmacion para acciones sensibles
- separar respuestas consultivas de respuestas con mutacion

### Politicas sugeridas

- consultas: ejecucion directa
- altas simples con datos completos: ejecucion directa con confirmacion opcional segun riesgo
- acciones con monto alto, documentos dudosos o datos ambiguos: confirmacion obligatoria
- acciones administrativas: solo ADMIN

### Criterio de salida

- la IA no inventa operaciones ni accede libremente a datos
- toda mutacion via IA pasa por herramientas y politicas definidas

## Fase 8: Experiencia de usuario chat-first

### Objetivo

Mover el foco del producto desde el dashboard a un asistente operativo.

### Trabajo tecnico

- rediseñar la home para que el chat sea el punto de entrada principal
- dejar el dashboard como segunda capa de analitica y control
- mostrar sugerencias accionables en el chat
- mostrar resumen de impacto despues de cada operacion

### Ejemplos de flujos

- "Registra una venta de 250000 a Cliente X"
- "Cargue esta factura y decime que falta"
- "Mostrame por que bajo el margen este mes"
- "Cuanto stock inmovilizado tengo"

### Criterio de salida

- el usuario puede operar el negocio desde el asistente sin perder visibilidad del panel

## Backlog tecnico sugerido por prioridad

### Prioridad alta

- resolver negocio activo desde sesion
- cerrar estrategia de autenticacion y recuperacion de cuenta
- filtrar todas las queries por businessId
- rehabilitar mutaciones criticas con auth real
- agregar helpers de autorizacion por rol
- separar comandos y queries

### Prioridad media

- auditoria e idempotencia
- seleccion de negocio activo en UI
- mejoras de errores y respuestas estructuradas
- pipeline inicial de documentos

### Prioridad baja

- memoria conversacional persistente
- recomendaciones automaticas dentro del chat
- automatizaciones proactivas

## MVP recomendado antes de integrar IA real

El MVP previo a IA deberia dejar listas estas capacidades:

- login funcional con Google, Apple y email
- verificacion de email por codigo
- recuperacion de contraseña por codigo
- login funcional con negocio activo
- crear transaccion con validacion y permisos
- crear contacto y cuenta con validacion y permisos
- registrar movimientos de stock de forma segura
- consultar metricas por negocio
- dejar auditoria en mutaciones

Si esto esta bien hecho, la integracion IA posterior pasa a ser una capa de orquestacion, no una reescritura del sistema.

## Recomendaciones adicionales

### 1. No unir chat y automatizacion en la misma fase

Primero conviene tener comandos manuales robustos. Despues IA. Despues automatizaciones. Si mezclas las tres cosas al mismo tiempo, vas a dificultar debugging y control de errores.

### 2. Definir un catalogo de intenciones de negocio

Antes de elegir proveedor IA, definan 20 a 30 intenciones reales del usuario. Por ejemplo:

- registrar venta
- registrar gasto
- cargar comprobante
- crear proveedor
- mover stock
- consultar caja
- explicar variacion del margen

Eso te va a ordenar mejor que empezar por prompts generales.

### 3. Diseñar respuestas con modo borrador

El asistente no siempre deberia ejecutar. Muchas veces deberia responder:

- esto entendi
- esto falta
- esta es la operacion propuesta
- confirmas?

Ese patron reduce errores de negocio y mejora confianza del usuario.

### 4. Medir calidad desde el primer dia

Conviene instrumentar:

- tasa de operaciones confirmadas
- tasa de correcciones del usuario
- intenciones no resueltas
- herramientas con mas errores
- campos mas ambiguos

Sin eso, no vas a saber si el asistente realmente ayuda.

### 5. Mantener formularios tradicionales durante la transicion

El chat no deberia reemplazar todo de golpe. Durante varias iteraciones conviene sostener formularios y panel para poder comparar resultados y tener fallback operativo.

## Orden recomendado de implementacion

1. Fase 1: sesion y negocio activo
2. Fase 2: permisos y politicas
3. Fase 3: comandos de dominio
4. Fase 4: auditoria e idempotencia
5. Fase 5: documentos y archivos
6. Fase 6: memoria conversacional
7. Fase 7: integracion IA
8. Fase 8: UX chat-first

## Resultado esperado

Si este roadmap se ejecuta en orden, ContaGo queda preparado para que el futuro asistente IA:

- interprete instrucciones de negocio con menos ambiguedad
- opere dentro del negocio correcto
- respete permisos reales
- no genere duplicados ni escrituras opacas
- procese documentos de manera controlada
- conviva con reportes y panel analitico ya existentes

En ese escenario, la IA deja de ser una capa cosmetica y pasa a ser una interfaz operativa confiable sobre una base solida.