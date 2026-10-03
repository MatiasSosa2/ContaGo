'use client'

/** URL de la foto de un artículo (cambia con cada foto nueva, así el navegador no muestra la vieja) */
export function fotoUrl(articuloId: string | null | undefined, fotoAt: Date | string | null | undefined) {
  if (!articuloId || !fotoAt) return null
  return `/api/foto/${articuloId}?v=${new Date(fotoAt).getTime()}`
}

/**
 * Achica la foto elegida (lado mayor 640 px) y la devuelve como data URL webp liviana para guardarla en la base.
 */
export async function achicarFoto(file: File, lado = 640): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Elegí una imagen')
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('No se pudo leer la imagen'))
      i.src = url
    })
    const escala = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.max(1, Math.round(img.naturalWidth * escala))
    const h = Math.max(1, Math.round(img.naturalHeight * escala))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('No se pudo procesar la imagen')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)
    let data = canvas.toDataURL('image/webp', 0.82)
    // Safari viejo no exporta webp: jpeg
    if (!data.startsWith('data:image/webp')) data = canvas.toDataURL('image/jpeg', 0.82)
    if (data.length > 400_000) data = canvas.toDataURL('image/jpeg', 0.6)
    return data
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Miniatura del artículo; sin foto, un ícono gris sutil */
export default function Foto({ src, alt, className = 'h-7 w-7 rounded-[7px]', icono = 'h-3.5 w-3.5' }: {
  src: string | null
  alt: string
  className?: string
  icono?: string
}) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} loading="lazy" className={`${className} shrink-0 bg-white object-cover ring-1 ring-black/[0.06] dark:ring-white/10`} />
  }
  return (
    <span className={`${className} flex shrink-0 items-center justify-center bg-black/[0.04] text-[#C7C7CC] dark:bg-white/[0.06] dark:text-[#48484A]`} aria-hidden>
      <svg className={icono} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    </span>
  )
}
