import prisma from '@/lib/prisma'
import { decryptSecret, encryptSecret } from './crypto'
import { MercadoPagoError, refreshAccessToken, type MpTokenResponse } from './client'

const REFRESH_MARGIN_MS = 5 * 60 * 1000

export async function saveConnection(businessId: string, connectedByUserId: string, tokens: MpTokenResponse) {
  const data = {
    mpUserId: String(tokens.user_id),
    accessTokenEnc: encryptSecret(tokens.access_token),
    refreshTokenEnc: encryptSecret(tokens.refresh_token),
    expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    connectedByUserId,
  }
  await prisma.mercadoPagoConnection.upsert({
    where: { businessId },
    create: { businessId, ...data },
    update: data,
  })
}

export async function getConnection(businessId: string) {
  return prisma.mercadoPagoConnection.findUnique({ where: { businessId } })
}

/** Devuelve un access token vigente; si vence pronto, lo renueva y guarda el nuevo refresh token (rota). */
export async function getValidAccessToken(businessId: string): Promise<string> {
  const connection = await getConnection(businessId)
  if (!connection) throw new MercadoPagoError('Este negocio no tiene una cuenta de Mercado Pago vinculada')

  const accessToken = decryptSecret(connection.accessTokenEnc)
  if (connection.expiresAt.getTime() - Date.now() > REFRESH_MARGIN_MS) return accessToken

  const refreshed = await refreshAccessToken(decryptSecret(connection.refreshTokenEnc))
  await prisma.mercadoPagoConnection.update({
    where: { businessId },
    data: {
      accessTokenEnc: encryptSecret(refreshed.access_token),
      refreshTokenEnc: encryptSecret(refreshed.refresh_token),
      expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
    },
  })
  return refreshed.access_token
}
