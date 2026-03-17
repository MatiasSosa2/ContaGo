# Financiero - Proyecto de Gestión

Este proyecto es una aplicación web de gestión financiera construida con [Next.js](https://nextjs.org), Prisma y bases de datos relacionales (SQLite por defecto para desarrollo).

## Requisitos Previos

- [Node.js](https://nodejs.org/) (versión 18 o superior recomendada)
- [Git](https://git-scm.com/)

## Instrucciones de Instalación

Sigue estos pasos para configurar y ejecutar el proyecto localmente:

1.  **Clonar el repositorio:**
    ```bash
    git clone <URL_DEL_REPOSITORIO>
    cd financiero
    ```

2.  **Instalar dependencias:**
    ```bash
    npm install
    # o
    yarn install
    ```

3.  **Configurar variables de entorno:**
    Copia el archivo de ejemplo `.env.example` a `.env`:
    ```bash
    cp .env.example .env
    # En Windows (PowerShell):
    Copy-Item .env.example .env
    ```
    Edita el archivo `.env` con tus propios valores secretos. Para desarrollo local puedes dejar el correo en modo `console`, pero para probar registro, recuperación y desafíos de seguridad con emails reales conviene usar Resend.

### Configuracion de correo transaccional con Resend

El proyecto ya soporta dos modos para correos de autenticacion desde [src/server/auth/email.ts](src/server/auth/email.ts):

- `AUTH_EMAIL_PROVIDER="console"`: imprime el codigo en la consola del servidor.
- `AUTH_EMAIL_PROVIDER="resend"`: envia el codigo por email real usando Resend.

Para activar Resend en `.env`:

```env
AUTH_EMAIL_PROVIDER="resend"
AUTH_EMAIL_FROM="ContaGo <tu-dominio-verificado@tudominio.com>"
RESEND_API_KEY="re_xxxxxxxxxxxxxxxxx"
```

Notas importantes:

- `AUTH_EMAIL_FROM` debe usar un remitente permitido por tu cuenta de Resend.
- si `AUTH_EMAIL_PROVIDER` vale `resend` pero faltan `RESEND_API_KEY` o `AUTH_EMAIL_FROM`, el sistema falla de forma explícita para no simular envíos inexistentes.
- mientras no tengas esas credenciales, puedes seguir desarrollando con `AUTH_EMAIL_PROVIDER="console"`.

4.  **Configurar la base de datos:**
    Inicializa la base de datos (creará el archivo `dev.db`):
    ```bash
    npx prisma migrate dev --name init
    # Si quieres poblar la base de datos con datos de prueba:
    npx prisma db seed
    ```

5.  **Ejecutar el servidor de desarrollo:**
    ```bash
    npm run dev
    ```

6.  **Abrir en el navegador:**
    Visita [http://localhost:3000](http://localhost:3000) para ver la aplicación.

## Estructura del Proyecto

- `src/app`: Rutas y páginas de la aplicación (App Router).
- `src/components`: Componentes reutilizables de React.
- `src/lib`: Utilidades, configuración de Prisma y autenticación.
- `prisma`: Esquema de la base de datos y migraciones.
- `public`: Archivos estáticos.

## Scripts Disponibles

- `npm run dev`: Inicia el servidor de desarrollo.
- `npm run build`: Construye la aplicación para producción.
- `npm start`: Inicia el servidor de producción.
- `npm run lint`: Ejecuta el linter para encontrar problemas en el código.

## Estado actual del login

Hoy el proyecto ya tiene implementados:

- registro con email y contraseña
- verificacion por codigo al email
- recuperacion de contraseña por codigo
- selector de negocio activo
- challenge de riesgo para login cuando la validacion de seguridad es vieja o falta verificar el email

## Acceso temporal con usuario real de Turso

Si quieres mostrar la app a socios sin revelar credenciales reales, puedes habilitar un botón temporal en el login que entra siempre con un único usuario administrador existente en Turso.

Agrega en `.env`:

```env
TEMP_ACCESS_ADMIN_EMAIL="cisaestudio@gmail.com"
```

Condiciones de este acceso:

- no usa datos mock
- inicia sesión con un usuario real existente en Turso
- ese usuario debe tener al menos una membresía activa con rol `ADMIN`
- el resto del sistema sigue operando exactamente igual después del ingreso
- si quitas `TEMP_ACCESS_ADMIN_EMAIL`, el botón desaparece del login

Para cerrar esta parte en entorno real solo faltan dos cosas operativas:

- cargar credenciales reales de Resend
- cargar credenciales reales de Google y Apple si quieres probar login social completo

## Licencia

[MIT](https://choosealicense.com/licenses/mit/)

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.