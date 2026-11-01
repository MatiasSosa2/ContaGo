import BrandLoader from './BrandLoader'

type PageSkeletonProps = {
  cards?: number
  chart?: boolean
  variant?: 'generic' | 'cajas' | 'creditos' | 'report'
}

/** Carga de página con el logo ContaGo centrado como elemento principal. */
export default function PageSkeleton(_props: PageSkeletonProps) {
  void _props
  return <BrandLoader fullScreen />
}
