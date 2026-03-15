import type { Metadata } from "next";
import { Inter, Archivo, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${inter.variable} ${archivo.variable} ${geistMono.variable} antialiased flex`}
      >
        <Sidebar />
        <main className="flex-1 w-full min-h-screen overflow-y-auto pb-16 md:pb-0">
          {children}
        </main>
      </body>
    </html>
  );
}

