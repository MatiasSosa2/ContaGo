export function requireTargetBusinessId(sampleData = false): string {
  if (sampleData && (process.env.NODE_ENV === 'production' || process.env.ALLOW_SAMPLE_DATA_MUTATION !== 'true')) {
    throw new Error('Los seeds de ejemplo requieren un entorno no productivo y ALLOW_SAMPLE_DATA_MUTATION=true.')
  }

  const businessId = process.env.TARGET_BUSINESS_ID?.trim()
  if (!businessId) {
    throw new Error('Definí TARGET_BUSINESS_ID para indicar explícitamente el negocio de destino.')
  }

  return businessId
}