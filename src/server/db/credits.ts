/**
 * Créditos y deudas: saldos por cliente/proveedor y cuotas pendientes.
 * Las expone src/app/actions.ts (que elige entre datos reales y demo).
 */

import prisma from '@/lib/prisma'
import { getCreditAccountsData } from '@/server/credits/credit-balances'
import { getBusinessId, type DashboardPeriodKey, computePeriodRange } from './shared'

/**
 * Créditos y deudas por cliente / proveedor al cierre del período: saldo neteado de
 * cobros y pagos, cuotas pendientes e historial (ver src/server/credits/credit-balances.ts).
 */
export async function getCreditAccounts(
  period: DashboardPeriodKey,
  customFrom?: string,
  customTo?: string,
  selectedYear?: number,
  selectedMonth?: number,
  selectedDay?: string,
  selectedWeekStart?: string,
) {
  const businessId = await getBusinessId()
  const { to } = computePeriodRange(period, customFrom, customTo, selectedYear, selectedMonth, selectedDay, selectedWeekStart)
  return getCreditAccountsData(businessId, to)
}

export type ClienteConCredito = {
  contactId: string
  nombre: string
  taxId: string | null
  deudaTotal: number
  creditos: {
    id: string
    description: string
    amount: number
    saldoPendiente: number
    fechaVencimiento: Date | null
    date: Date
    estado: string
  }[]
}

export async function getClientesConCreditoPendiente(): Promise<ClienteConCredito[]> {
  const businessId = await getBusinessId()

  // Traer todos los créditos de tipo INCOME que no estén COBRADO
  const creditos = await prisma.transaction.findMany({
    where: {
      businessId,
      type: 'INCOME',
      esCredito: true,
      contactId: { not: null },
      estado: { in: ['PENDIENTE', 'PARCIAL', 'VENCIDO'] },
    },
    select: {
      id: true,
      description: true,
      amount: true,
      date: true,
      fechaVencimiento: true,
      estado: true,
      contactId: true,
      contact: { select: { id: true, name: true, taxId: true } },
      cobrosAplicados: { select: { amount: true } },
    },
    orderBy: { date: 'desc' },
  })

  const map = new Map<string, ClienteConCredito>()
  for (const c of creditos) {
    if (!c.contactId || !c.contact) continue
    const cobrado = c.cobrosAplicados.reduce((s, x) => s + x.amount, 0)
    const saldo = c.amount - cobrado
    if (saldo <= 0.001) continue
    const existing = map.get(c.contactId)
    const credito = {
      id: c.id,
      description: c.description,
      amount: c.amount,
      saldoPendiente: saldo,
      fechaVencimiento: c.fechaVencimiento,
      date: c.date,
      estado: c.estado,
    }
    if (existing) {
      existing.deudaTotal += saldo
      existing.creditos.push(credito)
    } else {
      map.set(c.contactId, {
        contactId: c.contactId,
        nombre: c.contact.name,
        taxId: c.contact.taxId,
        deudaTotal: saldo,
        creditos: [credito],
      })
    }
  }

  return [...map.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

// =====================================================================
//  PAGO DE DEUDAS — Proveedores con saldo pendiente (mirror de cobros)
// =====================================================================

export type ProveedorConDeuda = {
  contactId: string
  nombre: string
  taxId: string | null
  deudaTotal: number
  deudas: {
    id: string
    description: string
    amount: number
    saldoPendiente: number
    fechaVencimiento: Date | null
    date: Date
    estado: string
  }[]
}

export async function getProveedoresConDeudaPendiente(): Promise<ProveedorConDeuda[]> {
  const businessId = await getBusinessId()

  const deudas = await prisma.transaction.findMany({
    where: {
      businessId,
      type: 'EXPENSE',
      esCredito: true,
      contactId: { not: null },
      estado: { in: ['PENDIENTE', 'PARCIAL', 'VENCIDO'] },
    },
    select: {
      id: true,
      description: true,
      amount: true,
      date: true,
      fechaVencimiento: true,
      estado: true,
      contactId: true,
      contact: { select: { id: true, name: true, taxId: true } },
      cobrosAplicados: { select: { amount: true } },
    },
    orderBy: { date: 'desc' },
  })

  const map = new Map<string, ProveedorConDeuda>()
  for (const d of deudas) {
    if (!d.contactId || !d.contact) continue
    const pagado = d.cobrosAplicados.reduce((s, x) => s + x.amount, 0)
    const saldo = d.amount - pagado
    if (saldo <= 0.001) continue
    const existing = map.get(d.contactId)
    const item = {
      id: d.id,
      description: d.description,
      amount: d.amount,
      saldoPendiente: saldo,
      fechaVencimiento: d.fechaVencimiento,
      date: d.date,
      estado: d.estado,
    }
    if (existing) {
      existing.deudaTotal += saldo
      existing.deudas.push(item)
    } else {
      map.set(d.contactId, {
        contactId: d.contactId,
        nombre: d.contact.name,
        taxId: d.contact.taxId,
        deudaTotal: saldo,
        deudas: [item],
      })
    }
  }

  return [...map.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

// =====================================================================
//  BIENES DE USO — CRUD básico
// =====================================================================
