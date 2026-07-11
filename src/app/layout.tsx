import type { Metadata } from "next";
import { Inter, Archivo, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { getSessionContext } from "@/server/auth/get-session-context";
import FloatingActionButton from "@/components/FloatingActionButton";
import { Analytics } from "@vercel/analytics/next";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ContaGO",
  description: "Plataforma de Gestión Financiera",
  icons: {
    icon: "/contago-mark.svg",
    shortcut: "/contago-mark.svg",
    apple: "/contago-mark.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // No forzamos auth aquí: el root layout aplica también a /auth/* y eso producía
  // un loop infinito de redirects 307 (/auth/login -> requireAuth -> /auth/login).
  // Cada page.tsx protegido invoca `requireBusinessContext()` por su cuenta.
  const sessionContext = await getSessionContext();
  const isAuthenticatedWithBusiness = Boolean(sessionContext?.activeBusiness);

  return (
    <html lang="es" suppressHydrationWarning>
      {/* Script bloqueante: aplica el tema guardado antes del primer pintado para evitar flash */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('theme');document.documentElement.setAttribute('data-theme',t==='dark'?'dark':'light')})()`,
          }}
        />
      </head>
      <body
        suppressHydrationWarning
        className={`${inter.variable} ${archivo.variable} ${geistMono.variable} antialiased flex`}
      >
        {isAuthenticatedWithBusiness && sessionContext?.activeBusiness && (
          <Sidebar
            sessionContext={{
              user: sessionContext.user,
              activeBusiness: sessionContext.activeBusiness,
              auth: sessionContext.auth,
            }}
          />
        )}
        <main className="flex-1 w-full min-h-screen overflow-y-auto pb-16 md:pb-0">
          {children}
        </main>
        {isAuthenticatedWithBusiness && <FloatingActionButton />}
        <Analytics />
      </body>
    </html>
  );
}

