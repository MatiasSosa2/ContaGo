/**
 * insights.ts
 *
 * Datos para decidir, en la pestaña Informes:
 * - Top 5 clientes: lo que le vendiste a cada cliente registrado en el período (cobrado o no).
 *   Solo ventas con cliente asignado; las de mostrador no entran en el ranking.
 * - Top 5 productos más vendidos: ventas = precio × cantidad de cada producto en el período.
 * - Consumidores finales: lo vendido sin cliente asignado (mostrador) y su peso sobre el total.
 */

import prisma from '@/lib/prisma'

export type TopCliente = { name: string; ventas: number; operaciones: number }
export type ProductoVendido = { name: string; ventas: number; unidades: number }

export type ReportInsights = {
  clientes: TopCliente[]
  productos: ProductoVendido[]
  consumidoresFinales: { ventas: number; pct: number }
}

export async function getReportInsightsData(businessId: string, from: Date, to: Date): Promise<ReportInsights> {
  const ventas = await prisma.operacion.findMany({
    where: { businessId, tipo: 'VENTA', date: { gte: from, lte: to } },
    select: {
      total: true,
      contact: { select: { name: true } },
      items: { select: { cantidad: true, subtotal: true, producto: { select: { nombre: true } } } },
    },
  })

  const porCliente = new Map<string, TopCliente>()
  const porProducto = new Map<string, ProductoVendido>()

  let total = 0
  let sinCliente = 0
  for (const v of ventas) {
    total += v.total
    // Solo clientes registrados: las ventas de mostrador no entran en el ranking
    if (v.contact) {
      const c = porCliente.get(v.contact.name) ?? { name: v.contact.name, ventas: 0, operaciones: 0 }
      c.ventas += v.total
      c.operaciones += 1
      porCliente.set(v.contact.name, c)
    } else {
      sinCliente += v.total
    }
    for (const it of v.items) {
      const p = porProducto.get(it.producto.nombre) ?? { name: it.producto.nombre, ventas: 0, unidades: 0 }
      p.ventas += it.subtotal // precio × cantidad
      p.unidades += it.cantidad
      porProducto.set(it.producto.nombre, p)
    }
  }

  return {
    clientes: [...porCliente.values()].sort((a, b) => b.ventas - a.ventas).slice(0, 5),
    productos: [...porProducto.values()].sort((a, b) => b.ventas - a.ventas).slice(0, 5),
    consumidoresFinales: { ventas: sinCliente, pct: total > 0 ? (sinCliente / total) * 100 : 0 },
  }
}
