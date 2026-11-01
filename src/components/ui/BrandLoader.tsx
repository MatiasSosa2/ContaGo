/** Indicador de carga de marca, con una pasada de luz sobre el logo original. */
export default function BrandLoader({ fullScreen = false }: { fullScreen?: boolean }) {
  return (
    <div
      className={`brand-loader${fullScreen ? ' brand-loader--screen' : ''}`}
      role="status"
      aria-label="Cargando ContaGo"
    >
      <div className="brand-loader__lockup" aria-hidden="true">
        <span className="brand-loader__mark">
          <span className="brand-loader__mark-shape" />
          <Image
            src="/contago-go-shine.svg"
            alt=""
            fill
            priority
            unoptimized
            sizes="132px"
            aria-hidden="true"
            className="brand-loader__shine-svg"
          />
        </span>
      </div>
      <span className="sr-only">Cargando ContaGo</span>
    </div>
  )
}
import Image from 'next/image'

