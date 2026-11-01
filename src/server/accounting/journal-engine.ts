/**
 * journal-engine.ts
 *
 * Motor de doble partida contable.
 * Función PURA — no hace llamadas a la DB, solo genera las líneas del asiento.
 *
 * Regla de oro: SUM(debit) === SUM(credit) siempre.
 *
 * Casos soportados (vía `mode`):
 *
 *   STANDARD (default):
 *     INCOME  + !esCredito  →  DEBE: cuenta física (ASSET)      | HABER: categoría (INCOME)
 *     INCOME  +  esCredito  →  DEBE: Clientes / CxC (ASSET)     | HABER: categoría (INCOME)
 *     EXPENSE + !esCredito  →  DEBE: categoría (EXPENSE)        | HABER: cuenta física
 *     EXPENSE +  esCredito  →  DEBE: categoría (EXPENSE)        | HABER: Proveedores / CxP
 *
 *   SALE_PRODUCT (mercadería):
 *     Líneas estándar de venta + asiento de costo:
 *     DEBE: COGS (EXPENSE) | HABER: Inventario (ASSET) por (cantidad × precioCosto)
 *
 *   SALE_BIEN_USO (activo fijo):
 *     DEBE: cuenta física (o CxC si crédito) por monto recibido
 *     HABER: Bienes de Uso (ASSET) por valor neto en libros
 *     + diferencia → Resultado por venta de bien de uso (INCOME ganancia / EXPENSE pérdida)
 *
 *   COBRO_CREDITO (cancela / amortiza un crédito existente):
 *     DEBE: cuenta física | HABER: Clientes / CxC
 *     (NO genera ingreso, ya se reconoció al crear el crédito original)
 *
 *   PURCHASE_PRODUCT (compra de mercadería):
 *     DEBE: Inventario (ASSET) por monto | HABER: Caja o CxP
 *     (no impacta resultado; el costo se reconoce al vender)
 *
 *   PURCHASE_BIEN_USO (alta de activo fijo):
 *     DEBE: Bienes de Uso (ASSET) | HABER: Caja o CxP
 *
 *   PAGO_DEUDA (cancela / amortiza una deuda con proveedor):
 *     DEBE: Proveedores / CxP | HABER: cuenta física
 *     (NO genera gasto, ya se reconoció al crear la deuda original)
 */

export type JournalLineInput = {
  accountId: string
  debit: number
  credit: number
  description?: string
}

export type GenerateJournalLinesParams = {
  amount: number
  type: 'INCOME' | 'EXPENSE'
  esCredito: boolean
  /** ID de la cuenta física del usuario (Caja, Banco, etc.) */
  physicalAccountId: string
  /** ID de la cuenta contable de la categoría (puede ser undefined si no hay categoría) */
  categoryContableAccountId: string | undefined | null
  /** ID de la cuenta sistema Clientes/CxC del negocio */
  cxcAccountId: string | undefined | null
  /** ID de la cuenta sistema Proveedores/CxP del negocio */
  cxpAccountId: string | undefined | null
  description?: string
  /** Modo extendido para casos especiales */
  mode?: 'STANDARD' | 'SALE_PRODUCT' | 'SALE_BIEN_USO' | 'COBRO_CREDITO' | 'PURCHASE_PRODUCT' | 'PURCHASE_BIEN_USO' | 'PAGO_DEUDA'
  /** Para SALE_PRODUCT: monto del costo (cantidad × precioCosto) */
  costoMercaderia?: number
  /** Para SALE_PRODUCT: cuenta sistema Inventario */
  inventoryAccountId?: string | null
  /** Para SALE_PRODUCT: cuenta sistema COGS */
  cogsAccountId?: string | null
  /** Para SALE_BIEN_USO: cuenta sistema Bienes de Uso */
  fixedAssetAccountId?: string | null
  /** Para SALE_BIEN_USO: valor neto en libros (HABER a Bienes de Uso) */
  bienValorNetoEnLibros?: number
  /** Para PURCHASE_PRODUCT con costo fijo: valor al que entra el inventario (DEBE Inventario) */
  inventoryValue?: number
  /** Para PURCHASE_PRODUCT con costo fijo: pagado − inventoryValue (va al resultado) */
  costVariance?: number
  /** Para PURCHASE_PRODUCT con costo fijo: cuenta sistema Diferencia de costo */
  costVarianceAccountId?: string | null
}

export type GenerateJournalLinesResult =
  | { ok: true; lines: JournalLineInput[] }
  | { ok: false; reason: string }

const round2 = (v: number) => Math.round(v * 100) / 100

/**
 * Reparte `total` entre partes en proporción a sus pesos, redondeando a centavos y
 * asignando el residual al último peso positivo. La suma SIEMPRE da `total` exacto.
 */
export function allocateProportionally(total: number, weights: number[]): number[] {
  if (weights.length === 0) return []
  const weightSum = weights.reduce((s, w) => s + Math.max(0, w), 0)
  if (weightSum <= 0) {
    const result = weights.map(() => 0)
    result[weights.length - 1] = round2(total)
    return result
  }
  const result = weights.map((w) => round2((total * Math.max(0, w)) / weightSum))
  const residual = round2(total - result.reduce((s, v) => s + v, 0))
  if (Math.abs(residual) >= 0.001) {
    for (let i = weights.length - 1; i >= 0; i--) {
      if (weights[i] > 0) { result[i] = round2(result[i] + residual); break }
    }
  }
  return result
}

/**
 * Asiento de un cambio de caja, SIEMPRE denominado en pesos: el lado en dólares se
 * expresa al tipo de cambio del cambio y el residual de redondeo va a Diferencia de
 * cambio. Así el libro nunca mezcla unidades y débitos = créditos.
 */
export function buildTransferJournalLines(params: {
  amountFrom: number
  amountTo: number
  fromCurrency: string
  toCurrency: string
  exchangeRate: number | null
  fromAccountId: string
  toAccountId: string
  fxDiffAccountId: string | null
  description?: string
}): GenerateJournalLinesResult {
  const { amountFrom, amountTo, fromCurrency, toCurrency, exchangeRate, fromAccountId, toAccountId, fxDiffAccountId, description } = params

  if (fromCurrency === toCurrency) {
    const lines = [
      { accountId: toAccountId, debit: amountTo, credit: 0, description },
      { accountId: fromAccountId, debit: 0, credit: amountFrom, description },
    ]
    return balanced(lines) ? { ok: true, lines } : { ok: false, reason: 'desequilibrio_contable' }
  }

  if (!exchangeRate || exchangeRate <= 0) return { ok: false, reason: 'sin_cotizacion' }

  const fromArs = round2(fromCurrency === 'ARS' ? amountFrom : amountFrom * exchangeRate)
  const toArs = round2(toCurrency === 'ARS' ? amountTo : amountTo * exchangeRate)
  const lines: JournalLineInput[] = [
    { accountId: toAccountId, debit: toArs, credit: 0, description },
    { accountId: fromAccountId, debit: 0, credit: fromArs, description },
  ]

  // Residual de redondeo de la conversión
  const diff = round2(fromArs - toArs)
  if (Math.abs(diff) >= 0.01) {
    if (!fxDiffAccountId) return { ok: false, reason: 'sin_cuenta_dif_cambio' }
    if (diff > 0) lines.push({ accountId: fxDiffAccountId, debit: diff, credit: 0, description: 'Diferencia de cambio' })
    else lines.push({ accountId: fxDiffAccountId, debit: 0, credit: -diff, description: 'Diferencia de cambio' })
  }

  return balanced(lines) ? { ok: true, lines } : { ok: false, reason: 'desequilibrio_contable' }
}

function balanced(lines: JournalLineInput[]): boolean {
  const totalDebit = lines.reduce((s, l) => s + l.debit, 0)
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0)
  return Math.abs(totalDebit - totalCredit) <= 0.001
}

export function generateJournalLines(
  params: GenerateJournalLinesParams,
): GenerateJournalLinesResult {
  const {
    amount,
    type,
    esCredito,
    physicalAccountId,
    categoryContableAccountId,
    cxcAccountId,
    cxpAccountId,
    description,
    mode = 'STANDARD',
    costoMercaderia,
    inventoryAccountId,
    cogsAccountId,
    fixedAssetAccountId,
    bienValorNetoEnLibros,
    inventoryValue,
    costVariance,
    costVarianceAccountId,
  } = params

  const lines: JournalLineInput[] = []

  // ─── Cobro de crédito ─────────────────────────────────────────────────────
  if (mode === 'COBRO_CREDITO') {
    if (!cxcAccountId) return { ok: false, reason: 'sin_cuenta_cxc' }
    lines.push({ accountId: physicalAccountId, debit: amount, credit: 0, description })
    lines.push({ accountId: cxcAccountId, debit: 0, credit: amount, description })
    if (!balanced(lines)) return { ok: false, reason: 'desequilibrio_contable' }
    return { ok: true, lines }
  }
  // ─── Pago de deuda (mirror de cobro) ─────────────────────────────────────────
  if (mode === 'PAGO_DEUDA') {
    if (!cxpAccountId) return { ok: false, reason: 'sin_cuenta_cxp' }
    lines.push({ accountId: cxpAccountId, debit: amount, credit: 0, description })
    lines.push({ accountId: physicalAccountId, debit: 0, credit: amount, description })
    if (!balanced(lines)) return { ok: false, reason: 'desequilibrio_contable' }
    return { ok: true, lines }
  }

  // ─── Compra de mercadería ─────────────────────────────────────────────────────
  if (mode === 'PURCHASE_PRODUCT') {
    if (!inventoryAccountId) return { ok: false, reason: 'sin_cuenta_inventario' }
    const creditTarget = esCredito ? cxpAccountId : physicalAccountId
    if (esCredito && !cxpAccountId) return { ok: false, reason: 'sin_cuenta_cxp' }
    if (!creditTarget) return { ok: false, reason: 'sin_cuenta_destino' }
    // Con costo fijo el inventario entra valorizado al fijo y la diferencia contra lo
    // pagado va al resultado (Diferencia de costo); sin costo fijo entra a lo pagado.
    const valorInventario = inventoryValue ?? amount
    const variance = costVariance ?? 0
    lines.push({ accountId: inventoryAccountId, debit: valorInventario, credit: 0, description })
    if (Math.abs(variance) >= 0.01) {
      if (!costVarianceAccountId) return { ok: false, reason: 'sin_cuenta_dif_costo' }
      if (variance > 0) lines.push({ accountId: costVarianceAccountId, debit: variance, credit: 0, description: 'Diferencia de costo' })
      else lines.push({ accountId: costVarianceAccountId, debit: 0, credit: -variance, description: 'Diferencia de costo' })
    }
    lines.push({ accountId: creditTarget, debit: 0, credit: amount, description })
    if (!balanced(lines)) return { ok: false, reason: 'desequilibrio_contable' }
    return { ok: true, lines }
  }

  // ─── Compra de bien de uso ────────────────────────────────────────────────────
  if (mode === 'PURCHASE_BIEN_USO') {
    if (!fixedAssetAccountId) return { ok: false, reason: 'sin_cuenta_bienes_uso' }
    const creditTarget = esCredito ? cxpAccountId : physicalAccountId
    if (esCredito && !cxpAccountId) return { ok: false, reason: 'sin_cuenta_cxp' }
    if (!creditTarget) return { ok: false, reason: 'sin_cuenta_destino' }
    lines.push({ accountId: fixedAssetAccountId, debit: amount, credit: 0, description })
    lines.push({ accountId: creditTarget, debit: 0, credit: amount, description })
    if (!balanced(lines)) return { ok: false, reason: 'desequilibrio_contable' }
    return { ok: true, lines }
  }
  // ─── Venta de bien de uso ────────────────────────────────────────────────
  if (mode === 'SALE_BIEN_USO') {
    if (!fixedAssetAccountId) return { ok: false, reason: 'sin_cuenta_bienes_uso' }
    const valorNeto = Math.max(0, bienValorNetoEnLibros ?? 0)
    const debitTarget = esCredito ? cxcAccountId : physicalAccountId
    if (esCredito && !cxcAccountId) return { ok: false, reason: 'sin_cuenta_cxc' }
    if (!debitTarget) return { ok: false, reason: 'sin_cuenta_destino' }

    lines.push({ accountId: debitTarget, debit: amount, credit: 0, description })
    if (valorNeto > 0) {
      lines.push({ accountId: fixedAssetAccountId, debit: 0, credit: valorNeto, description })
    }

    const resultado = amount - valorNeto
    if (Math.abs(resultado) > 0.001) {
      if (!categoryContableAccountId) return { ok: false, reason: 'sin_categoria_contable' }
      if (resultado > 0) {
        lines.push({ accountId: categoryContableAccountId, debit: 0, credit: resultado, description })
      } else {
        lines.push({ accountId: categoryContableAccountId, debit: -resultado, credit: 0, description })
      }
    }

    if (!balanced(lines)) return { ok: false, reason: 'desequilibrio_contable' }
    return { ok: true, lines }
  }

  // ─── Estándar (INCOME/EXPENSE) ───────────────────────────────────────────
  if (!categoryContableAccountId) {
    return { ok: false, reason: 'sin_categoria_contable' }
  }

  if (type === 'INCOME') {
    if (!esCredito) {
      lines.push({ accountId: physicalAccountId, debit: amount, credit: 0, description })
      lines.push({ accountId: categoryContableAccountId, debit: 0, credit: amount, description })
    } else {
      if (!cxcAccountId) return { ok: false, reason: 'sin_cuenta_cxc' }
      lines.push({ accountId: cxcAccountId, debit: amount, credit: 0, description })
      lines.push({ accountId: categoryContableAccountId, debit: 0, credit: amount, description })
    }
  } else {
    if (!esCredito) {
      lines.push({ accountId: categoryContableAccountId, debit: amount, credit: 0, description })
      lines.push({ accountId: physicalAccountId, debit: 0, credit: amount, description })
    } else {
      if (!cxpAccountId) return { ok: false, reason: 'sin_cuenta_cxp' }
      lines.push({ accountId: categoryContableAccountId, debit: amount, credit: 0, description })
      lines.push({ accountId: cxpAccountId, debit: 0, credit: amount, description })
    }
  }

  // ─── Add-on SALE_PRODUCT: asiento de costo ──────────────────────────────
  if (mode === 'SALE_PRODUCT' && type === 'INCOME' && (costoMercaderia ?? 0) > 0) {
    if (!inventoryAccountId) return { ok: false, reason: 'sin_cuenta_inventario' }
    if (!cogsAccountId) return { ok: false, reason: 'sin_cuenta_cogs' }
    const costo = costoMercaderia as number
    lines.push({ accountId: cogsAccountId, debit: costo, credit: 0, description: 'Costo de mercadería vendida' })
    lines.push({ accountId: inventoryAccountId, debit: 0, credit: costo, description: 'Salida de inventario' })
  }

  if (!balanced(lines)) {
    return { ok: false, reason: 'desequilibrio_contable' }
  }
  return { ok: true, lines }
}
