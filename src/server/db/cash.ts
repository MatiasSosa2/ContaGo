/**
 * Cajas y flujo de efectivo: saldos, flujo por moneda, KPIs del inicio, estado de flujo, cambios de caja y la pantalla Cajas.
 * Las expone src/app/actions.ts (que elige entre datos reales y demo).
 */

import prisma from '@/lib/prisma'
import type { ActionResult } from '@/lib/validations'
import { CASH_ACCOUNT_TYPES, getCashBalanceOf, getCashBalancesAt, getCashFlowSummary } from '@/server/cash/cash-flow'
import { getIncomeStatementData } from '@/server/results/income-statement'
import { getCashStatementData } from '@/server/cash/cash-statement'
import { getBusinessId, endOfMovementDay, type DashboardPeriodKey, computePeriodRange } from './shared'

/** Saldo de una caja al cierre del día indicado (para el arqueo). */
export async function getCashAccountBalance(accountId: string, dateStr?: string): Promise<ActionResult<{ balance: number }>> {
  const businessId = await getBusinessId()
  const asOf = endOfMovementDay(dateStr)
  const balance = await getCashBalanceOf(businessId, accountId, asOf)
  if (balance === null) return { success: false, error: 'Caja no encontrada' }
  return { success: true, data: { balance } }
}

/**
 * Flujo de las cajas por moneda para el período (saldo inicial, ingresos, egresos,
 * cambio de moneda, saldo final). Es lo que muestran Cajas y el Estado de flujo de efectivo.
 */
export async function getCashFlowByCurrency(
  period: DashboardPeriodKey,
  customFrom?: string,
  customTo?: string,
  selectedYear?: number,
  selectedMonth?: number,
  selectedDay?: string,
  selectedWeekStart?: string,
) {
  const businessId = await getBusinessId()
  const { from, to } = computePeriodRange(period, customFrom, customTo, selectedYear, selectedMonth, selectedDay, selectedWeekStart)
  const [ARS, USD] = await Promise.all([
    getCashFlowSummary(businessId, from, to, 'ARS'),
    getCashFlowSummary(businessId, from, to, 'USD'),
  ])
  return { from, to, ARS, USD }
}

/**
 * Ingresos y egresos de caja en pesos del período y del período anterior: son los
 * totales del Estado de flujo de efectivo, para las tarjetas del Balance general.
 */
export async function getCashFlowKpis(
  period: DashboardPeriodKey,
  customFrom?: string,
  customTo?: string,
  selectedYear?: number,
  selectedMonth?: number,
  selectedDay?: string,
  selectedWeekStart?: string,
) {
  const businessId = await getBusinessId()
  const { from, to, prevFrom, prevTo } = computePeriodRange(period, customFrom, customTo, selectedYear, selectedMonth, selectedDay, selectedWeekStart)
  const [current, prev, usd, primero, er, prevEr] = await Promise.all([
    getCashFlowSummary(businessId, from, to, 'ARS'),
    getCashFlowSummary(businessId, prevFrom, prevTo, 'ARS'),
    getCashFlowSummary(businessId, from, to, 'USD'),
    prisma.transaction.findFirst({ where: { businessId }, orderBy: { date: 'asc' }, select: { date: true } }),
    getIncomeStatementData(businessId, from, to, 'ARS'),
    getIncomeStatementData(businessId, prevFrom, prevTo, 'ARS'),
  ])
  // El período anterior solo se compara si ya había movimientos desde su inicio (un margen de
  // 3 días); si el negocio empezó a cargar a mitad de ese período, la variación engaña.
  const MARGEN_MS = 3 * 24 * 60 * 60 * 1000
  const prevComparable = !!primero && primero.date.getTime() <= prevFrom.getTime() + MARGEN_MS
  // Ingresos (ventas + otros) y ganancia neta del Estado de resultados: base de Rentabilidad y ROA,
  // con la misma fórmula que el Estado de resultados de Informes
  const resultado = (d: typeof er) => {
    const otros = d.otherIncomeItems.reduce((s, i) => s + i.amount, 0)
    const gastos = d.expenseItems.reduce((s, i) => s + i.amount, 0)
    return { ingresos: d.ventas + otros, gananciaNeta: d.ventas - d.cmv + otros - gastos }
  }
  return { current, prev, prevComparable, usdSaldoFinal: usd.saldoFinal, resultados: resultado(er), prevResultados: resultado(prevEr) }
}

/** Detalle del Flujo de efectivo (todas las cajas de la moneda o una sola). Ver src/server/cash/cash-statement.ts */
export async function getCashStatement(
  period: DashboardPeriodKey,
  customFrom?: string,
  customTo?: string,
  selectedYear?: number,
  selectedMonth?: number,
  selectedDay?: string,
  selectedWeekStart?: string,
  currency = 'ARS',
  accountId?: string | null,
) {
  const businessId = await getBusinessId()
  const { from, to } = computePeriodRange(period, customFrom, customTo, selectedYear, selectedMonth, selectedDay, selectedWeekStart)
  return getCashStatementData(businessId, from, to, currency, accountId)
}

/** Saldo de cada caja de una moneda al inicio y al cierre del período (Flujo de efectivo › por caja). */
export async function getCashAccountsSnapshot(
  period: DashboardPeriodKey,
  customFrom?: string,
  customTo?: string,
  selectedYear?: number,
  selectedMonth?: number,
  selectedDay?: string,
  selectedWeekStart?: string,
  currency = 'ARS',
) {
  const businessId = await getBusinessId()
  const { from, to } = computePeriodRange(period, customFrom, customTo, selectedYear, selectedMonth, selectedDay, selectedWeekStart)
  const [accounts, inicio, cierre] = await Promise.all([
    prisma.account.findMany({
      where: { businessId, isSystemAccount: false, type: { in: [...CASH_ACCOUNT_TYPES] }, currency },
      select: { id: true, name: true, type: true },
      orderBy: { name: 'asc' },
    }),
    getCashBalancesAt(businessId, new Date(from.getTime() - 1)),
    getCashBalancesAt(businessId, to),
  ])
  return accounts.map((a) => ({ name: a.name, type: a.type, inicio: inicio[a.id] ?? 0, cierre: cierre[a.id] ?? 0 }))
}

/** Cambios de caja del período (sin período: todos), con las cajas de origen y destino. */
export async function getCashTransfers(
  period?: DashboardPeriodKey,
  customFrom?: string,
  customTo?: string,
  selectedYear?: number,
  selectedMonth?: number,
  selectedDay?: string,
  selectedWeekStart?: string,
) {
  const businessId = await getBusinessId()
  const range = period ? computePeriodRange(period, customFrom, customTo, selectedYear, selectedMonth, selectedDay, selectedWeekStart) : null
  return prisma.cashTransfer.findMany({
    where: { businessId, ...(range ? { date: { gte: range.from, lte: range.to } } : {}) },
    orderBy: { date: 'desc' },
    select: {
      id: true, date: true, description: true, amountFrom: true, amountTo: true, exchangeRate: true,
      fromAccount: { select: { name: true, type: true, currency: true } },
      toAccount: { select: { name: true, type: true, currency: true } },
    },
  })
}

export interface CajasAccountItem {
  id: string
  name: string
  type: string
  currency: string
  currentBalance: number
  recentMovements: number  // movimientos últimos 7 días
  todayVariation: number   // variación neta del día
}

export interface CajasGroupData {
  accounts: CajasAccountItem[]
  total: number
  todayVariation: number
}

export interface CajasData {
  efectivo: CajasGroupData
  virtual: CajasGroupData
  summaryMessage: string       // barra de consejo superior
  aiTipEfectivo: string        // consejo IA para efectivo
  aiTipVirtual: string         // consejo IA para virtual
}

export async function getCajasData(
  period?: DashboardPeriodKey,
  customFrom?: string,
  customTo?: string,
  selectedYear?: number,
  selectedMonth?: number,
  selectedDay?: string,
  selectedWeekStart?: string,
): Promise<CajasData> {
  const businessId = await getBusinessId()

  // Solo cajas propias (no las cuentas contables del sistema)
  const accounts = await prisma.account.findMany({
    where: { businessId, isSystemAccount: false, type: { in: [...CASH_ACCOUNT_TYPES] } },
  })

  // Rango efectivo: si no hay period, usar "hoy" como ventana de variación pero balance actual.
  const now = new Date()
  const range = period
    ? computePeriodRange(period, customFrom, customTo, selectedYear, selectedMonth, selectedDay, selectedWeekStart)
    : null
  const periodFrom = range?.from ?? new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
  const periodTo = range?.to ?? new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  const periodLabel = range?.label

  // Saldo de cada caja al cierre del período (misma fuente que el historial y el flujo de efectivo)
  const balanceAsofByAccount = period ? await getCashBalancesAt(businessId, periodTo) : {}

  // Movimientos del período que mueven plata: contar y calcular variación dentro de [periodFrom, periodTo]
  const txPeriodo = await prisma.transaction.findMany({
    where: { businessId, esCredito: false, date: { gte: periodFrom, lte: periodTo } },
    select: { accountId: true, amount: true, type: true },
  })

  const movCountByAccount: Record<string, number> = {}
  const periodVarByAccount: Record<string, number> = {}
  for (const tx of txPeriodo) {
    movCountByAccount[tx.accountId] = (movCountByAccount[tx.accountId] || 0) + 1
    const delta = tx.type === 'INCOME' ? tx.amount : -tx.amount
    periodVarByAccount[tx.accountId] = (periodVarByAccount[tx.accountId] || 0) + delta
  }

  // Clasificar: CASH = Efectivo, BANK/WALLET/otro = Virtual
  const efectivoAccounts: CajasAccountItem[] = []
  const virtualAccounts: CajasAccountItem[] = []

  for (const acc of accounts) {
    const balance = period ? (balanceAsofByAccount[acc.id] || 0) : acc.currentBalance
    const item: CajasAccountItem = {
      id: acc.id,
      name: acc.name,
      type: acc.type,
      currency: acc.currency,
      currentBalance: balance,
      recentMovements: movCountByAccount[acc.id] || 0,
      todayVariation: periodVarByAccount[acc.id] || 0,
    }
    if (acc.type === 'CASH') {
      efectivoAccounts.push(item)
    } else {
      virtualAccounts.push(item)
    }
  }

  const totalEfectivo = efectivoAccounts.reduce((s, a) => s + a.currentBalance, 0)
  const totalVirtual = virtualAccounts.reduce((s, a) => s + a.currentBalance, 0)
  const todayVarEfectivo = efectivoAccounts.reduce((s, a) => s + a.todayVariation, 0)
  const todayVarVirtual = virtualAccounts.reduce((s, a) => s + a.todayVariation, 0)

  // Resumen comparativo: período actual vs período anterior
  let incomeActual = 0, incomePrev = 0
  if (period && range) {
    const txComp = await prisma.transaction.findMany({
      where: { businessId, date: { gte: range.prevFrom, lte: periodTo } },
      select: { amount: true, type: true, date: true },
    })
    for (const tx of txComp) {
      if (tx.type !== 'INCOME') continue
      if (tx.date >= periodFrom && tx.date <= periodTo) incomeActual += tx.amount
      else if (tx.date >= range.prevFrom && tx.date <= range.prevTo) incomePrev += tx.amount
    }
  } else {
    const hace30dias = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const hace60dias = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
    const tx30 = await prisma.transaction.findMany({
      where: { businessId, date: { gte: hace60dias } },
      select: { amount: true, type: true, date: true },
    })
    for (const tx of tx30) {
      if (tx.type !== 'INCOME') continue
      if (tx.date >= hace30dias) incomeActual += tx.amount
      else incomePrev += tx.amount
    }
  }

  const growth = incomePrev > 0 ? ((incomeActual - incomePrev) / incomePrev) * 100 : 0
  const totalGeneral = totalEfectivo + totalVirtual
  const periodWord = periodLabel ?? 'mes'
  const summaryMessage = growth !== 0
    ? `Tus cajas suman $${totalGeneral.toLocaleString('es-AR')} en total. Tus ingresos ${growth >= 0 ? 'crecieron' : 'bajaron'} un ${Math.abs(growth).toFixed(1)}% respecto al período anterior.`
    : `Tus cajas suman $${totalGeneral.toLocaleString('es-AR')} en total al cierre de ${periodWord}.`

  // Consejos IA (placeholder inteligentes basados en datos)
  const aiTipEfectivo = efectivoAccounts.length === 0
    ? 'No tenés cajas de efectivo registradas. Creá una para empezar a trackear tus movimientos físicos.'
    : todayVarEfectivo > 0
      ? `En el período ingresaron $${todayVarEfectivo.toLocaleString('es-AR')} en efectivo. Buen ritmo de caja.`
      : todayVarEfectivo < 0
        ? `En el período salieron $${Math.abs(todayVarEfectivo).toLocaleString('es-AR')} en efectivo. Revisá si hay gastos no planificados.`
        : 'Sin movimientos de efectivo en el período. Todo estable.'

  const aiTipVirtual = virtualAccounts.length === 0
    ? 'No tenés cuentas virtuales registradas. Agregá tus bancos y billeteras digitales.'
    : todayVarVirtual > 0
      ? `En el período ingresaron $${todayVarVirtual.toLocaleString('es-AR')} en cuentas virtuales.`
      : todayVarVirtual < 0
        ? `En el período salieron $${Math.abs(todayVarVirtual).toLocaleString('es-AR')} de cuentas virtuales.`
        : 'Sin movimientos virtuales en el período.'

  return {
    efectivo: { accounts: efectivoAccounts, total: totalEfectivo, todayVariation: todayVarEfectivo },
    virtual: { accounts: virtualAccounts, total: totalVirtual, todayVariation: todayVarVirtual },
    summaryMessage,
    aiTipEfectivo,
    aiTipVirtual,
  }
}

// =====================================================================
//  COBRO DE CRÉDITOS — Clientes con saldo pendiente
// =====================================================================
