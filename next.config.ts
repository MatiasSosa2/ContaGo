import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const isDev = process.env.NODE_ENV !== "production";

// CSP: 'unsafe-inline' en script/style es necesario porque Next.js y el layout
// usan scripts y estilos inline. form-action permite los POST de NextAuth a
// Google y Microsoft (OAuth) y sus redirecciones.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.sentry.io",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com https://login.microsoftonline.com",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  devIndicators: false,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
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
