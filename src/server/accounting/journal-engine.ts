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
}

export type GenerateJournalLinesResult =
  | { ok: true; lines: JournalLineInput[] }
  | { ok: false; reason: string }

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
    lines.push({ accountId: inventoryAccountId, debit: amount, credit: 0, description })
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
