import { getFotoArticulo } from '@/server/db/articulos'
import { getSessionContext } from '@/server/auth/get-session-context'

export const runtime = 'nodejs'

/**
 * Foto de un artículo (guardada achicada en la base). El navegador la guarda en caché:
 * cuando cambia, la URL lleva otro ?v= (la fecha de la foto).
 *
 * GET /api/foto/[id]?v=...
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionContext()
  if (!session?.activeBusiness) return new Response(null, { status: 404, headers: { 'Cache-Control': 'private, no-store' } })

  const { id } = await params
  const foto = await getFotoArticulo(id)
  const m = foto?.match(/^data:(image\/[a-z]+);base64,(.+)$/)
  if (!m) return new Response(null, { status: 404 })
  return new Response(Buffer.from(m[2], 'base64'), {
    headers: {
      'Content-Type': m[1],
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
