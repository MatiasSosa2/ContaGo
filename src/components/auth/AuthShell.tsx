import type { ReactNode } from 'react'

import Link from 'next/link'
import Image from 'next/image'

import AuthSignOutButton from '@/components/auth/AuthSignOutButton'

export default function AuthShell({
  title,
  subtitle,
  children,
  showSignOut = false,
}: {
  title: string
  subtitle: string
  children: ReactNode
  showSignOut?: boolean
}) {
  return (
    <div className="min-h-screen bg-[#f3efe7] lg:h-screen lg:overflow-hidden lg:bg-transparent">
      <div className="grid min-h-screen w-full lg:h-screen lg:grid-cols-[1.04fr_0.96fr]">
        <section className="relative flex min-h-[35vh] items-center justify-center overflow-hidden bg-[#003b1f] px-6 py-8 text-white sm:px-10 sm:py-10 lg:h-screen lg:min-h-0 lg:justify-start lg:px-12 lg:py-8 xl:px-14 xl:py-10">
          <div className="absolute inset-0 bg-[linear-gradient(180deg,_rgba(255,255,255,0.02),_rgba(0,0,0,0.12))]" />
          <div className="relative z-10 flex w-full max-w-3xl flex-col items-center text-center lg:-mt-6 lg:items-start lg:text-left">
            <div className="flex items-center justify-center gap-0 lg:justify-start lg:gap-1">
              <Image
                src="/contago-wordmark-copy.svg"
                alt="Conta"
                width={560}
                height={180}
                priority
                className="h-auto w-[205px] sm:w-[245px] lg:w-[248px] xl:w-[290px]"
              />
              <Image
                src="/contago-mark.svg"
                alt="GO"
                width={350}
                height={350}
                priority
                className="-ml-3 h-[118px] w-[118px] sm:-ml-4 sm:h-[145px] sm:w-[145px] lg:-ml-5 lg:h-[150px] lg:w-[150px]"
              />
            </div>
            <div className="mt-4 flex items-center justify-center gap-4 text-white/72 lg:mt-2 lg:justify-start">
              <span className="h-px w-10 bg-white/28 lg:w-8" />
              <p className="text-sm uppercase tracking-[0.28em] sm:text-base lg:text-[13px]">Junto a tu negocio</p>
            </div>
            <p className="mt-4 max-w-[24rem] text-sm leading-7 text-white/80 sm:max-w-[28rem] sm:text-base sm:leading-8 lg:mt-4 lg:max-w-md lg:text-[14px] lg:leading-6">
              Controla ingresos, gastos y decisiones con una experiencia simple, clara y alineada a la identidad de tu negocio.
            </p>
          </div>
        </section>

        <section className="flex items-start bg-[linear-gradient(180deg,_#f6f1e8_0%,_#efe7db_100%)] px-4 py-5 sm:px-8 sm:py-8 lg:h-screen lg:min-h-0 lg:items-center lg:px-8 lg:py-4 xl:px-10">
          <div className="w-full rounded-[28px] border border-black/8 bg-white px-5 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.08)] sm:rounded-[32px] sm:px-8 sm:py-9 lg:mx-auto lg:max-w-[40rem] lg:px-7 lg:py-6 xl:max-w-[42rem] xl:px-8 xl:py-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-brand-gold-dark">Acceso</p>
            <h2 className="mt-3 text-[2rem] font-semibold tracking-tight text-gray-900 sm:text-4xl lg:mt-2 lg:text-[1.95rem]">{title}</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-gray-500 lg:mt-2 lg:text-[13px] lg:leading-5">{subtitle}</p>
            <div className="mt-6 lg:mt-4">{children}</div>
            <div className="mt-6 flex flex-col gap-3 text-xs text-gray-400 lg:mt-4 lg:flex-row lg:items-center lg:justify-between">
              <Link href="/" className="font-medium text-brand-military hover:text-brand-military-dark">
                Volver al inicio
              </Link>
              {showSignOut && <AuthSignOutButton />}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}