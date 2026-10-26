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
    <div className="min-h-screen bg-white">
      <div className="grid min-h-screen w-full lg:grid-cols-[0.9fr_1.1fr]">
        <section className="relative flex min-h-[18vh] items-center justify-center overflow-hidden bg-white px-4 py-5 text-[#163832] sm:min-h-[20vh] sm:px-10 sm:py-8 lg:min-h-screen lg:justify-start lg:px-12 lg:py-8 xl:px-14 xl:py-10">
          <span aria-hidden className="absolute left-1/4 top-1/3 h-48 w-48 rounded-full bg-[#DAF1DE]/60 blur-3xl" />
          <div className="relative z-10 flex w-full max-w-3xl flex-col items-center text-center lg:-mt-6 lg:items-start lg:text-left">
            <div className="flex items-center justify-center gap-0 lg:justify-start lg:gap-1">
              <Image
                src="/contago-wordmark-copy.svg"
                alt="Conta"
                width={560}
                height={180}
                priority
                className="h-auto w-[min(42vw,205px)] sm:w-[245px] lg:w-[248px] xl:w-[290px]"
              />
              <Image
                src="/contago-mark.svg"
                alt="GO"
                width={350}
                height={350}
                priority
                className="-ml-3 h-[min(25vw,118px)] w-[min(25vw,118px)] sm:-ml-4 sm:h-[145px] sm:w-[145px] lg:-ml-5 lg:h-[150px] lg:w-[150px]"
              />
            </div>
            <div className="mt-4 flex items-center justify-center gap-4 text-[#235347]/75 lg:mt-2 lg:justify-start">
              <span className="h-px w-10 bg-[#235347]/30 lg:w-8" />
              <p className="text-sm uppercase tracking-[0.28em] sm:text-base lg:text-[13px]">Junto a tu negocio</p>
            </div>
            <p className="mt-3 hidden max-w-[24rem] text-sm leading-7 text-gray-500 sm:block sm:max-w-[28rem] sm:text-base sm:leading-8 lg:mt-4 lg:max-w-md lg:text-[14px] lg:leading-6">
              Controla ingresos, gastos y decisiones con una experiencia simple, clara y alineada a la identidad de tu negocio.
            </p>
          </div>
        </section>

        <section className="flex items-start bg-white px-4 py-5 sm:px-8 sm:py-8 lg:min-h-screen lg:items-center lg:px-8 lg:py-10 xl:px-10">
          <div className="mx-auto w-full max-w-[34rem] py-2 sm:py-4 lg:py-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#235347]">Acceso</p>
            <h2 className="mt-3 text-[clamp(1.65rem,7vw,2rem)] font-semibold tracking-tight text-gray-900 sm:text-4xl lg:mt-2 lg:text-[1.95rem]">{title}</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-gray-500 lg:mt-2 lg:text-[13px] lg:leading-5">{subtitle}</p>
            <div className="mt-6 lg:mt-5">{children}</div>
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