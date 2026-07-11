import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  devIndicators: false,
};

// Solo activamos el plugin de Sentry si hay DSN configurado. De lo contrario
// exportamos la config tal cual para no añadir overhead ni fallar el build.
const sentryEnabled = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);

export default sentryEnabled
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      // Token para subir source maps (opcional). Sin él, no se suben mapas.
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: !process.env.CI,
      // Oculta los mapas del bundle cliente al público.
      widenClientFileUpload: true,
      // Evita fallar el build si falta el auth token.
      sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
      // Túnel para saltar ad-blockers (rutea eventos por tu dominio).
      tunnelRoute: "/monitoring",
      disableLogger: true,
    })
  : nextConfig;
