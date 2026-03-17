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
        <section className="relative flex min-h-[42vh] items-center overflow-hidden bg-[#003b1f] px-6 py-12 text-white sm:px-10 lg:min-h-screen lg:px-14 lg:py-10 xl:px-16 xl:py-12">
          <div className="absolute inset-0 bg-[linear-gradient(180deg,_rgba(255,255,255,0.02),_rgba(0,0,0,0.12))]" />
          <div className="relative z-10 mt-[-20px] w-full max-w-3xl lg:mt-[-32px]">
            <div className="flex items-center gap-0 sm:gap-0 lg:gap-1">
              <Image
                src="/contago-wordmark-copy.svg"
                alt="Conta"
                width={560}
                height={180}
                priority
                className="h-auto w-[190px] sm:w-[230px] lg:w-[270px] xl:w-[310px]"
              />
              <Image
                src="/contago-mark.svg"
                alt="GO"
                width={350}
                height={350}
                priority
                className="-ml-3 h-[120px] w-[120px] sm:-ml-4 sm:h-[140px] sm:w-[140px] lg:-ml-5 lg:h-[168px] lg:w-[168px]"
              />
            </div>
            <div className="mt-4 flex items-center gap-4 text-white/72 lg:mt-3">
              <span className="h-px w-10 bg-white/28 lg:w-8" />
              <p className="text-sm uppercase tracking-[0.28em] sm:text-base lg:text-sm">Junto a tu negocio</p>
            </div>
            <p className="mt-6 max-w-xl text-base leading-8 text-white/80 lg:mt-5 lg:max-w-lg lg:text-[15px] lg:leading-7">
              Controla ingresos, gastos y decisiones con una experiencia simple, clara y alineada a la identidad de tu negocio.
            </p>
          </div>
        </section>

        <section className="flex items-center bg-[linear-gradient(180deg,_#f6f1e8_0%,_#efe7db_100%)] px-4 py-8 sm:px-8 lg:min-h-screen lg:px-10 lg:py-6 xl:px-12">
          <div className="w-full rounded-[32px] border border-black/8 bg-white px-6 py-7 shadow-[0_24px_80px_rgba(0,0,0,0.08)] sm:px-8 sm:py-9 lg:mx-auto lg:max-w-xl lg:px-8 lg:py-8 xl:max-w-[44rem] xl:px-9 xl:py-9">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-brand-gold-dark">Acceso</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl lg:text-[2.15rem]">{title}</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-gray-500">{subtitle}</p>
            <div className="mt-6 lg:mt-5">{children}</div>
            <div className="mt-6 text-xs text-gray-400 lg:mt-5">
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