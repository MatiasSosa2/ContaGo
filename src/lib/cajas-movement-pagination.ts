export const CAJAS_MOVEMENT_KINDS = ['operation', 'transaction', 'transfer-out', 'transfer-in'] as const
export type CajasMovementKind = typeof CAJAS_MOVEMENT_KINDS[number]

export type CajasMovementCursor = {
  date: string
  id: string
  kind: CajasMovementKind
}

export function compareCajasMovementCandidates(a: CajasMovementCursor, b: CajasMovementCursor): number {
  const dateDifference = new Date(b.date).getTime() - new Date(a.date).getTime()
  if (dateDifference !== 0) return dateDifference
  const rankDifference = CAJAS_MOVEMENT_KINDS.indexOf(a.kind) - CAJAS_MOVEMENT_KINDS.indexOf(b.kind)
  return rankDifference !== 0 ? rankDifference : b.id.localeCompare(a.id)
}
