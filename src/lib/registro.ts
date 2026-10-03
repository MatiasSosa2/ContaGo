/**
 * Lo que creó un registro del "+", para poder deshacerlo en los segundos siguientes.
 * - transactions: movimientos (con su operación, stock, bien de uso y cuotas saldadas)
 * - transfer: un cambio de caja
 */
export type UndoRef =
  | {
      kind: 'transactions'
      ids: string[]
      operacionId?: string | null
      /** Movimientos de stock de una venta/compra de productos */
      movimientoIds?: string[]
      /** Bien de uso dado de alta por una compra (se borra) */
      bienCreadoId?: string | null
      /** Bien de uso dado de baja por una venta (vuelve a estar activo) */
      bienVendidoId?: string | null
      /** Cuotas saldadas por un cobro / pago de deuda (se recalcula su estado) */
      creditoIds?: string[]
    }
  | { kind: 'transfer'; id: string }

/** Ventana para deshacer en el servidor: un poco más que el aviso (5 s) por si la red tarda */
export const UNDO_WINDOW_MS = 2 * 60 * 1000

/** Lo que muestra el aviso al registrar: "✓ Venta registrada · $45.000" + detalle opcional */
export type Registrado = {
  titulo: string
  monto?: number
  /** Moneda del monto (por defecto pesos) */
  currency?: string
  /** Ej: "Constructora Del Sur quedó al día" */
  detalle?: string
  undo?: UndoRef
}
