import type { ReactNode } from 'react'

import Link from 'next/link'
import Image from 'next/image'

export default function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#f3efe7]">
      <div className="grid min-h-screen w-full lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative flex min-h-[42vh] items-center overflow-hidden bg-[#003b1f] px-6 py-12 text-white sm:px-10 lg:min-h-screen lg:px-16 lg:py-16 xl:px-20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_20%,_rgba(255,255,255,0.08),_transparent_22%),radial-gradient(circle_at_70%_72%,_rgba(0,0,0,0.20),_transparent_30%)]" />
          <div className="relative z-10 w-full max-w-3xl">
            <div className="flex items-center gap-4">
              <Image
                src="/contago-mark.svg"
                alt="Logo ContaGO"
                width={88}
                height={88}
                priority
                className="h-14 w-14 rounded-2xl shadow-[0_18px_48px_rgba(0,0,0,0.20)] sm:h-16 sm:w-16"
              />
              <p className="text-[11px] font-medium uppercase tracking-[0.38em] text-white/55">ContaGO</p>
            </div>
            <div className="mt-6">
              <Image
                src="/contago-wordmark.svg"
                alt="ContaGO"
                width={760}
                height={180}
                priority
                className="h-auto w-[260px] brightness-0 invert sm:w-[320px] lg:w-[420px] xl:w-[500px]"
              />
            </div>
            <div className="mt-5 flex items-center gap-4 text-white/72">
              <span className="h-px w-10 bg-white/28" />
              <p className="text-sm uppercase tracking-[0.28em] sm:text-base">Junto a tu negocio</p>
            </div>
            <p className="mt-8 max-w-xl text-base leading-8 text-white/80 lg:text-lg">
              Controla ingresos, gastos y decisiones con una experiencia simple, clara y alineada a la identidad de tu negocio.
            </p>
            <div className="mt-12 grid max-w-2xl gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-4 backdrop-blur-sm">
                <p className="text-[10px] uppercase tracking-[0.22em] text-white/50">Simple</p>
                <p className="mt-2 text-sm leading-6 text-white/88">Una entrada limpia para empezar a operar sin fricción.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-4 backdrop-blur-sm">
                <p className="text-[10px] uppercase tracking-[0.22em] text-white/50">Seguro</p>
                <p className="mt-2 text-sm leading-6 text-white/88">Código por email y contexto de negocio real en cada sesión.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-4 backdrop-blur-sm">
                <p className="text-[10px] uppercase tracking-[0.22em] text-white/50">Ordenado</p>
                <p className="mt-2 text-sm leading-6 text-white/88">Menos desorden. Más control para crecer con criterio.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center bg-[linear-gradient(180deg,_#f6f1e8_0%,_#efe7db_100%)] px-4 py-8 sm:px-8 lg:min-h-screen lg:px-12 xl:px-16">
          <div className="w-full rounded-[32px] border border-black/8 bg-white px-6 py-7 shadow-[0_24px_80px_rgba(0,0,0,0.08)] sm:px-8 sm:py-9 lg:mx-auto lg:max-w-xl xl:max-w-2xl xl:px-10 xl:py-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-brand-gold-dark">Acceso</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">{title}</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-gray-500">{subtitle}</p>
            <div className="mt-8">{children}</div>
            <div className="mt-8 text-xs text-gray-400">
              <Link href="/" className="font-medium text-brand-military hover:text-brand-military-dark">
                Volver al inicio
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}