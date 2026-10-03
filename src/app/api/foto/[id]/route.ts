import { getFotoArticulo } from '@/server/db/articulos'

export const runtime = 'nodejs'

/**
 * Foto de un artículo (guardada achicada en la base). El navegador la guarda en caché:
 * cuando cambia, la URL lleva otro ?v= (la fecha de la foto).
 *
 * GET /api/foto/[id]?v=...
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const foto = await getFotoArticulo(id)
  const m = foto?.match(/^data:(image\/[a-z]+);base64,(.+)$/)
  if (!m) return new Response(null, { status: 404 })
  return new Response(Buffer.from(m[2], 'base64'), {
    headers: {
      'Content-Type': m[1],
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  })
}
