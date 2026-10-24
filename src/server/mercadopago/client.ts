const MP_AUTH_URL = 'https://auth.mercadopago.com/authorization'
const MP_API_URL = 'https://api.mercadopago.com'
const PAGE_SIZE = 100
const MAX_PAGES = 50

export class MercadoPagoError extends Error {}

function getConfig() {
  const clientId = process.env.MP_CLIENT_ID
  const clientSecret = process.env.MP_CLIENT_SECRET
  const redirectUri = process.env.MP_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) {
    throw new MercadoPagoError('Mercado Pago no está configurado en este entorno')
  }
  return { clientId, clientSecret, redirectUri }
}

export function buildAuthorizationUrl(state: string): string {
  const { clientId, redirectUri } = getConfig()
  const url = new URL(MP_AUTH_URL)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', state)
  return url.toString()
}

export type MpTokenResponse = {
  access_token: string
  refresh_token: string
  expires_in: number
  user_id: number | string
}

async function requestToken(params: Record<string, string>): Promise<MpTokenResponse> {
  const { clientId, clientSecret } = getConfig()
  const response = await fetch(`${MP_API_URL}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...params }),
    cache: 'no-store',
  })
  const data = (await response.json().catch(() => null)) as Partial<MpTokenResponse> | null
  if (!response.ok || !data?.access_token || !data.refresh_token || !data.expires_in) {
    // No incluimos el cuerpo de la respuesta: podría traer datos sensibles
    throw new MercadoPagoError('No se pudo completar la autorización con Mercado Pago')
  }
  return data as MpTokenResponse
}

export function exchangeAuthorizationCode(code: string): Promise<MpTokenResponse> {
  const { redirectUri } = getConfig()
  return requestToken({ grant_type: 'authorization_code', code, redirect_uri: redirectUri })
}

export function refreshAccessToken(refreshToken: string): Promise<MpTokenResponse> {
  return requestToken({ grant_type: 'refresh_token', refresh_token: refreshToken })
}

export type MpFeeDetail = { type?: string; amount: number }

export type MpPayment = {
  id: number | string
  status: string
  transaction_amount: number
  currency_id?: string
  date_approved?: string | null
  date_created?: string | null
  description?: string | null
  payment_method_id?: string | null
  fee_details?: MpFeeDetail[] | null
  transaction_details?: { net_received_amount?: number | null } | null
  payer?: { email?: string | null } | null
}

/**
 * Pagos aprobados cuya fecha de aprobación cae entre ambas fechas (ISO 8601).
 * Pagina hasta MAX_PAGES para evitar bucles infinitos si la API se comporta raro.
 */
export async function searchApprovedPayments(accessToken: string, fromIso: string, toIso: string): Promise<MpPayment[]> {
  const results: MpPayment[] = []

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(`${MP_API_URL}/v1/payments/search`)
    url.searchParams.set('range', 'date_approved')
    url.searchParams.set('begin_date', fromIso)
    url.searchParams.set('end_date', toIso)
    url.searchParams.set('status', 'approved')
    url.searchParams.set('sort', 'date_approved')
    url.searchParams.set('criteria', 'asc')
    url.searchParams.set('limit', String(PAGE_SIZE))
    url.searchParams.set('offset', String(page * PAGE_SIZE))

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!response.ok) throw new MercadoPagoError('Mercado Pago rechazó la consulta de pagos')

    const data = (await response.json()) as { results?: MpPayment[]; paging?: { total?: number } }
    const batch = data.results ?? []
    results.push(...batch)

    const total = data.paging?.total ?? 0
    if (batch.length < PAGE_SIZE || results.length >= total) break
  }

  return results
}

/** Convierte un pago de la API en la fila de revisión. Neto = lo que efectivamente llega a la cuenta. */
export function toReviewRow(payment: MpPayment) {
  const gross = payment.transaction_amount
  const fee = (payment.fee_details ?? []).reduce((acc, f) => acc + (f.amount ?? 0), 0)
  const net = payment.transaction_details?.net_received_amount ?? gross - fee
  const dateApproved = payment.date_approved ?? payment.date_created
  return {
    mpPaymentId: String(payment.id),
    amountGross: gross,
    feeAmount: Math.round(fee * 100) / 100,
    amountNet: Math.round(net * 100) / 100,
    currency: payment.currency_id ?? 'ARS',
    dateApproved: dateApproved ? new Date(dateApproved) : new Date(),
    description: payment.description ?? null,
    paymentMethod: payment.payment_method_id ?? null,
    payerEmail: payment.payer?.email ?? null,
  }
}
