import type { Metadata } from "next";
import { Inter, Archivo, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { getSessionContext } from "@/server/auth/get-session-context";
import FloatingActionButton from "@/components/FloatingActionButton";
import { Analytics } from "@vercel/analytics/next";
import { Suspense } from "react";

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

async function AuthenticatedNavigation() {
  const sessionContext = await getSessionContext();
  if (!sessionContext?.activeBusiness) return null;

  return (
    <>
      <Sidebar businessName={sessionContext.activeBusiness.name} />
      <FloatingActionButton />
    </>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // No forzamos auth aquí: el root layout aplica también a /auth/* y eso producía
  // un loop infinito de redirects 307 (/auth/login -> requireAuth -> /auth/login).
  // Cada page.tsx protegido invoca `requireBusinessContext()` por su cuenta.
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
        <Suspense fallback={null}>
          <AuthenticatedNavigation />
        </Suspense>
        <main className="min-h-screen w-full flex-1 overflow-y-auto pb-[calc(4.25rem+env(safe-area-inset-bottom))] lg:pb-0">
          {children}
        </main>
        <Analytics />
      </body>
    </html>
  );
}
