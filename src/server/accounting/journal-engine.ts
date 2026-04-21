/**
 * journal-engine.ts
 *
 * Motor de doble partida contable.
 * Función PURA — no hace llamadas a la DB, solo genera las líneas del asiento.
 *
 * Regla de oro: SUM(debit) === SUM(credit) siempre.
 *
 * Casos soportados:
 *
 *   INCOME  + !esCredito  →  DEBE: cuenta física (ASSET)      | HABER: cuenta de categoría (INCOME)
 *   INCOME  +  esCredito  →  DEBE: cuenta Clientes CxC (ASSET) | HABER: cuenta de categoría (INCOME)
 *   EXPENSE + !esCredito  →  DEBE: cuenta de categoría (EXPENSE) | HABER: cuenta física (ASSET)
 *   EXPENSE +  esCredito  →  DEBE: cuenta de categoría (EXPENSE) | HABER: cuenta Proveedores CxP (LIABILITY)
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
}

export type GenerateJournalLinesResult =
  | { ok: true; lines: JournalLineInput[] }
  | { ok: false; reason: string }

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
  } = params

  // Si no hay cuenta contable de categoría, no podemos generar el asiento completo
  if (!categoryContableAccountId) {
    return { ok: false, reason: 'sin_categoria_contable' }
  }

  const lines: JournalLineInput[] = []

  if (type === 'INCOME') {
    if (!esCredito) {
      // Venta / cobro al contado
      // DEBE: cuenta física (entra plata)
      // HABER: cuenta de ingresos de la categoría
      lines.push({ accountId: physicalAccountId, debit: amount, credit: 0, description })
      lines.push({ accountId: categoryContableAccountId, debit: 0, credit: amount, description })
    } else {
      // Venta / cobro a crédito
      // DEBE: Clientes / CxC (el cliente nos debe)
      // HABER: cuenta de ingresos de la categoría
      if (!cxcAccountId) {
        return { ok: false, reason: 'sin_cuenta_cxc' }
      }
      lines.push({ accountId: cxcAccountId, debit: amount, credit: 0, description })
      lines.push({ accountId: categoryContableAccountId, debit: 0, credit: amount, description })
    }
  } else {
    // EXPENSE
    if (!esCredito) {
      // Gasto pagado al contado
      // DEBE: cuenta de egresos de la categoría
      // HABER: cuenta física (sale plata)
      lines.push({ accountId: categoryContableAccountId, debit: amount, credit: 0, description })
      lines.push({ accountId: physicalAccountId, debit: 0, credit: amount, description })
    } else {
      // Gasto a crédito (deuda con proveedor)
      // DEBE: cuenta de egresos de la categoría
      // HABER: Proveedores / CxP (le debemos al proveedor)
      if (!cxpAccountId) {
        return { ok: false, reason: 'sin_cuenta_cxp' }
      }
      lines.push({ accountId: categoryContableAccountId, debit: amount, credit: 0, description })
      lines.push({ accountId: cxpAccountId, debit: 0, credit: amount, description })
    }
  }

  // Invariante: suma de débitos === suma de créditos
  const totalDebit = lines.reduce((s, l) => s + l.debit, 0)
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0)
  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    return {
      ok: false,
      reason: `desequilibrio_contable: DEBE=${totalDebit} HABER=${totalCredit}`,
    }
  }

  return { ok: true, lines }
}
