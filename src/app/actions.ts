'use server'

import * as MOCK from '@/lib/mock'
import { ActionResult } from '@/lib/validations'; 
import { type DateRange } from '@/lib/validations';
import { revalidatePath } from 'next/cache';
import type { UndoRef } from '@/lib/registro';
import type { ArticuloInput, PreciosMasivoInput } from '@/server/db/articulos';

const hasDatabaseConfig = Boolean(process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL);
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' || process.env.USE_MOCK_DATA === 'true' || !hasDatabaseConfig;

const emptyCatalogs = () => ({
  accounts: [],
  categories: [],
  subcategories: [] as { id: string; name: string; categoryId: string }[],
  contacts: [],
  areas: [],
  productos: [],
  empleados: [],
  bienesDeUso: [],
  operatingModel: 'BOTH' as const,
});

function isNextRedirectError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'digest' in error
    && typeof (error as { digest?: unknown }).digest === 'string'
    && (error as { digest: string }).digest.startsWith('NEXT_REDIRECT')
}

// Cache the module promise so it resolves only once across all calls
let _dbActionsPromise: Promise<typeof import('./actions.database')> | null = null;
const getDatabaseActions = () => {
  if (!_dbActionsPromise) _dbActionsPromise = import('./actions.database');
  return _dbActionsPromise;
};

// ---- PROXY FUNCTIONS ----

export async function getModalCatalogs() {
  if (USE_MOCK) {
    return {
      accounts: MOCK.MOCK_ACCOUNTS,
      categories: MOCK.MOCK_CATEGORIES,
      subcategories: [] as { id: string; name: string; categoryId: string }[],
      contacts: [],
      areas: [],
      productos: MOCK.MOCK_PRODUCTOS,
      empleados: [],
      bienesDeUso: [],
      operatingModel: 'BOTH' as const,
    };
  }

  try {
    const databaseActions = await getDatabaseActions();
    return await databaseActions.getModalCatalogs();
  } catch (error) {
    if (isNextRedirectError(error)) {
      return emptyCatalogs();
    }
    throw error;
  }
}

export async function createContact(formData: FormData): Promise<ActionResult<{ id: string; name: string; type: string }>> {
  if (USE_MOCK) return { success: true, data: { id: `mock-${Date.now()}`, name: String(formData.get('name') ?? ''), type: String(formData.get('type') ?? 'CLIENT') } };
  const databaseActions = await getDatabaseActions();
  return databaseActions.createContact(formData);
}

export async function createTransaction(formData: FormData): Promise<ActionResult<{ clienteSaldado?: boolean; clienteNombre?: string; proveedorSaldado?: boolean; proveedorNombre?: string }>> {
  if (USE_MOCK) return { success: true, data: {} };
  const databaseActions = await getDatabaseActions();
  return databaseActions.createTransaction(formData);
}

export async function getClientesConCreditoPendiente() {
  if (USE_MOCK) return [];
  const databaseActions = await getDatabaseActions();
  return databaseActions.getClientesConCreditoPendiente();
}

export async function getProveedoresConDeudaPendiente() {
  if (USE_MOCK) return [];
  const databaseActions = await getDatabaseActions();
  return databaseActions.getProveedoresConDeudaPendiente();
}

export async function getBienesDeUso(
  activosOnly = true,
  period?: string,
  customFrom?: string,
  customTo?: string,
  selectedYear?: number,
  selectedMonth?: number,
  selectedDay?: string,
  selectedWeekStart?: string,
) {
  if (USE_MOCK) return [];
  const databaseActions = await getDatabaseActions();
  return databaseActions.getBienesDeUso(activosOnly, period as CashPeriodKey, customFrom, customTo, selectedYear, selectedMonth, selectedDay, selectedWeekStart);
}

export async function createCategoryWithContable(formData: FormData): Promise<ActionResult<{ id: string; name: string }>> {
  if (USE_MOCK) return { success: true, data: { id: 'mock', name: 'mock' } };
  const databaseActions = await getDatabaseActions();
  return databaseActions.createCategoryWithContable(formData);
}

export async function getAllTransactions(
  period?: string,
  customFrom?: string,
  customTo?: string,
  selectedYear?: number,
  selectedMonth?: number,
  selectedDay?: string,
  selectedWeekStart?: string,
) {
  if (USE_MOCK) return MOCK.MOCK_TRANSACTIONS;
  const databaseActions = await getDatabaseActions();
  return databaseActions.getAllTransactions(period as CashPeriodKey, customFrom, customTo, selectedYear, selectedMonth, selectedDay, selectedWeekStart);
}

export async function getLatestTransactionDate() {
  if (USE_MOCK) return null;
  const databaseActions = await getDatabaseActions();
  return databaseActions.getLatestTransactionDate();
}

export async function getReportData(range?: DateRange) {
  if (USE_MOCK) {
    // Mock calculations
    const allTx = MOCK.MOCK_TRANSACTIONS as unknown as Awaited<ReturnType<typeof import('./actions.database').getReportData>>['allTx'];
    const totalsByCurrency = { 'ARS': { income: 500000, expense: 350000 }, 'USD': { income: 1200, expense: 0 } };
    const monthlyHistory: never[] = []; // sin historial en modo demo
    const topCategories = MOCK.MOCK_CATEGORIES.slice(0, 3).map(c => ({ 
      name: c.name, income: c.type === 'INCOME' ? 1000 : 0, expense: c.type === 'EXPENSE' ? 500 : 0, currency: 'ARS' 
    }));
    const topContacts = MOCK.MOCK_CONTACTS.map(c => ({ name: c.name, income: 1000, expense: 0, txCount: 1 }));
    const topAreas = MOCK.MOCK_AREAS.map(a => ({ nombre: a.nombre, income: 1000, expense: 500 }));
    const accountTotalByCurrency = { 'ARS': 4700000, 'USD': 5000 };
    return { allTx, totalsByCurrency, monthlyHistory, topCategories, topContacts, topAreas, accountTotalByCurrency };
  }
  const databaseActions = await getDatabaseActions();
  return databaseActions.getReportData(range);
}

export async function createCategory(formData: FormData): Promise<ActionResult> {
  if (USE_MOCK) return { success: true };
  const databaseActions = await getDatabaseActions();
  return databaseActions.createCategory(formData);
}

export async function deleteCategory(id: string) {
  if (USE_MOCK) { revalidatePath('/'); return; }
  const databaseActions = await getDatabaseActions();
  return databaseActions.deleteCategory(id);
}

export async function createSubcategory(formData: FormData): Promise<ActionResult<{ id: string; name: string; categoryId: string }>> {
  if (USE_MOCK) return { success: true, data: { id: 'mock', name: 'mock', categoryId: 'mock' } };
  const databaseActions = await getDatabaseActions();
  return databaseActions.createSubcategory(formData);
}

export async function deleteSubcategory(id: string) {
  if (USE_MOCK) { revalidatePath('/'); return; }
  const databaseActions = await getDatabaseActions();
  return databaseActions.deleteSubcategory(id);
}

export async function getCreditAccounts(...args: CashPeriodArgs) {
  if (USE_MOCK) return [];
  const [period, ...rest] = args;
  const databaseActions = await getDatabaseActions();
  return databaseActions.getCreditAccounts(period as CashPeriodKey, ...rest);
}

export async function getProductos(
  period?: string,
  customFrom?: string,
  customTo?: string,
  selectedYear?: number,
  selectedMonth?: number,
  selectedDay?: string,
  selectedWeekStart?: string,
) {
  if (USE_MOCK) return MOCK.MOCK_PRODUCTOS;
  const databaseActions = await getDatabaseActions();
  return databaseActions.getProductos(period as CashPeriodKey, customFrom, customTo, selectedYear, selectedMonth, selectedDay, selectedWeekStart);
}

export async function createProducto(formData: FormData): Promise<ActionResult<{ id: string }>> {
  if (USE_MOCK) return { success: true, data: { id: 'mock' } };
  const databaseActions = await getDatabaseActions();
  return databaseActions.createProducto(formData);
}

export async function updateProducto(id: string, formData: FormData): Promise<ActionResult> {
  if (USE_MOCK) return { success: true };
  const databaseActions = await getDatabaseActions();
  return databaseActions.updateProducto(id, formData);
}

export async function deleteProducto(id: string) {
  if (USE_MOCK) { revalidatePath('/stock'); return; }
  const databaseActions = await getDatabaseActions();
  return databaseActions.deleteProducto(id);
}

export async function ajustarStock(productoId: string, contado: number, motivo: string): Promise<ActionResult> {
  if (USE_MOCK) return { success: true };
  const databaseActions = await getDatabaseActions();
  return databaseActions.ajustarStock(productoId, contado, motivo);
}

export async function getMovimientosStock(productoId: string | string[]) {
  if (USE_MOCK) return [];
  const databaseActions = await getDatabaseActions();
  return databaseActions.getMovimientosStock(productoId);
}

// ---- Artículos con variantes ----

export async function guardarArticulo(input: ArticuloInput): Promise<ActionResult<{ articuloId: string }>> {
  if (USE_MOCK) return { success: true, data: { articuloId: 'mock' } };
  const databaseActions = await getDatabaseActions();
  return databaseActions.guardarArticulo(input);
}

export async function guardarFotoArticulo(ref: { articuloId?: string | null; productoId?: string | null }, foto: string | null): Promise<ActionResult<{ articuloId: string }>> {
  if (USE_MOCK) return { success: true, data: { articuloId: 'mock' } };
  const databaseActions = await getDatabaseActions();
  return databaseActions.guardarFotoArticulo(ref, foto);
}

export async function actualizarPrecioVariante(productoId: string, precio: number | null): Promise<ActionResult> {
  if (USE_MOCK) return { success: true };
  const databaseActions = await getDatabaseActions();
  return databaseActions.actualizarPrecioVariante(productoId, precio);
}

export async function actualizarPreciosMasivo(input: PreciosMasivoInput): Promise<ActionResult<{ cambiados: number }>> {
  if (USE_MOCK) return { success: true, data: { cambiados: 0 } };
  const databaseActions = await getDatabaseActions();
  return databaseActions.actualizarPreciosMasivo(input);
}

export async function deleteArticulo(articuloId: string) {
  if (USE_MOCK) return;
  const databaseActions = await getDatabaseActions();
  return databaseActions.deleteArticulo(articuloId);
}

export async function getReportDataExtended(range?: DateRange) {
  if (USE_MOCK) {
    const base = await getReportData(range);
    return { 
      ...base, 
      activosPorMoneda: (base && 'accountTotalByCurrency' in base ? base.accountTotalByCurrency : {}) as Record<string, number>, 
      pasivosPorMoneda: {} as Record<string, number>, 
      cxcPorMoneda: {} as Record<string, number>, 
      flujo: {} as Record<string, { operativo: number; inversion: number; financiero: number }>, 
      anualMap: {} as Record<string, Record<string, { income: number; expense: number }>>,
      cmvTotal: 0,  
      valorInventario: 0, 
      valorInventarioVenta: 0, 
      margenBrutoInventario: 0, 
      topProductosPorStock: [],
      valorBienesUso: 0,
    }
  }
  const databaseActions = await getDatabaseActions();
  return databaseActions.getReportDataExtended(range);
}

export async function getDashboardStats(period: string, customFrom?: string, customTo?: string, preBusinessId?: string, selectedYear?: number, selectedMonth?: number, selectedDay?: string, selectedWeekStart?: string) {
  if (USE_MOCK) {
    const { getMockDashboardStats } = await import('@/lib/mock');
    return getMockDashboardStats();
  }
  const databaseActions = await getDatabaseActions();
  return databaseActions.getDashboardStats(period as CashPeriodKey, customFrom, customTo, preBusinessId, selectedYear, selectedMonth, selectedDay, selectedWeekStart);
}

export async function getAssetSnapshotAsOf(period: string, customFrom?: string, customTo?: string, selectedYear?: number, selectedMonth?: number, selectedDay?: string, selectedWeekStart?: string) {
  if (USE_MOCK) {
    const empty = { cajaTotal: 0, totalACobrar: 0, totalAPagar: 0, stockTotal: 0, bienesTotal: 0, cmvPeriod: 0 };
    return { ...empty, prev: empty };
  }
  const databaseActions = await getDatabaseActions();
  return databaseActions.getAssetSnapshotAsOf(period as CashPeriodKey, customFrom, customTo, selectedYear, selectedMonth, selectedDay, selectedWeekStart);
}

export async function getCajasData(
  period?: string,
  customFrom?: string,
  customTo?: string,
  selectedYear?: number,
  selectedMonth?: number,
  selectedDay?: string,
  selectedWeekStart?: string,
) {
  if (USE_MOCK) {
    const { getMockCajasData } = await import('@/lib/mock');
    return getMockCajasData();
  }
  const databaseActions = await getDatabaseActions();
  return databaseActions.getCajasData(period as CashPeriodKey, customFrom, customTo, selectedYear, selectedMonth, selectedDay, selectedWeekStart);
}

// ---- Cambio de caja / Diferencia de caja ----

export async function createCashTransfer(formData: FormData): Promise<ActionResult<{ undo?: UndoRef }>> {
  if (USE_MOCK) return { success: true };
  const databaseActions = await getDatabaseActions();
  return databaseActions.createCashTransfer(formData);
}

export async function createCashAdjustment(formData: FormData): Promise<ActionResult<{ difference: number; undo?: UndoRef }>> {
  if (USE_MOCK) return { success: true, data: { difference: 0 } };
  const databaseActions = await getDatabaseActions();
  return databaseActions.createCashAdjustment(formData);
}

export async function getCashAccountBalance(accountId: string, dateStr?: string): Promise<ActionResult<{ balance: number }>> {
  if (USE_MOCK) return { success: true, data: { balance: 0 } };
  const databaseActions = await getDatabaseActions();
  return databaseActions.getCashAccountBalance(accountId, dateStr);
}

type CashPeriodKey = Parameters<typeof import("./actions.database").getCashFlowByCurrency>[0]

type CashPeriodArgs = [
  period: string,
  customFrom?: string,
  customTo?: string,
  selectedYear?: number,
  selectedMonth?: number,
  selectedDay?: string,
  selectedWeekStart?: string,
]

export async function getCashFlowByCurrency(...args: CashPeriodArgs) {
  if (USE_MOCK) {
    const empty = (currency: string) => ({ currency, saldoInicial: 0, ingresos: 0, egresos: 0, cambioMoneda: 0, saldoFinal: 0 });
    return { from: new Date(), to: new Date(), ARS: empty('ARS'), USD: empty('USD') };
  }
  const [period, ...rest] = args;
  const databaseActions = await getDatabaseActions();
  return databaseActions.getCashFlowByCurrency(period as CashPeriodKey, ...rest);
}

export async function getYearlySeries(year: number, cashCurrency = 'ARS', accountId?: string) {
  if (USE_MOCK) return { year, resultados: Array(12).fill(null), flujo: Array(12).fill(null), patrimonio: Array(12).fill(null) };
  const databaseActions = await getDatabaseActions();
  return databaseActions.getYearlySeries(year, cashCurrency, accountId);
}

/** Todos los cambios de caja, desde el primero */
export async function getAllCashTransfers() {
  if (USE_MOCK) return [];
  const databaseActions = await getDatabaseActions();
  return databaseActions.getCashTransfers();
}

export async function getCashTransfers(...args: CashPeriodArgs) {
  if (USE_MOCK) return [];
  const [period, ...rest] = args;
  const databaseActions = await getDatabaseActions();
  return databaseActions.getCashTransfers(period as CashPeriodKey, ...rest);
}

export async function getCashFlowKpis(...args: CashPeriodArgs) {
  if (USE_MOCK) {
    const empty = { currency: 'ARS', saldoInicial: 0, ingresos: 0, egresos: 0, cambioMoneda: 0, saldoFinal: 0 };
    const vacio = { ingresos: 0, gananciaNeta: 0 };
    return { current: empty, prev: empty, prevComparable: false, usdSaldoFinal: 0, resultados: vacio, prevResultados: vacio };
  }
  const [period, ...rest] = args;
  const databaseActions = await getDatabaseActions();
  return databaseActions.getCashFlowKpis(period as CashPeriodKey, ...rest);
}

export async function getReportInsights(...args: CashPeriodArgs) {
  if (USE_MOCK) return { clientes: [], productos: [], consumidoresFinales: { ventas: 0, pct: 0 } };
  const [period, ...rest] = args;
  const databaseActions = await getDatabaseActions();
  return databaseActions.getReportInsights(period as CashPeriodKey, ...rest);
}

export async function getBalanceSheet(...args: CashPeriodArgs) {
  if (USE_MOCK) {
    const empty = { asOf: new Date(), rate: null, activo: [], pasivo: [], totalActivo: 0, totalPasivo: 0, patrimonio: 0 };
    return { current: empty, previous: empty };
  }
  const [period, ...rest] = args;
  const databaseActions = await getDatabaseActions();
  return databaseActions.getBalanceSheet(period as CashPeriodKey, ...rest);
}

export async function getCashStatement(...args: [...CashPeriodArgs, currency?: string, accountId?: string | null]) {
  if (USE_MOCK) {
    return { currency: 'ARS', accountId: null, saldoInicial: 0, saldoFinal: 0, ingresos: [], totalIngresos: 0, egresos: [], totalEgresos: 0, cambioMoneda: 0, exchangeNotes: [], accounts: [] };
  }
  const [period, ...rest] = args;
  const databaseActions = await getDatabaseActions();
  return databaseActions.getCashStatement(period as CashPeriodKey, ...rest);
}

export async function getCashAccountsSnapshot(...args: [...CashPeriodArgs, currency?: string]) {
  if (USE_MOCK) return [] as { name: string; type: string; inicio: number; cierre: number }[];
  const [period, ...rest] = args;
  const databaseActions = await getDatabaseActions();
  return databaseActions.getCashAccountsSnapshot(period as CashPeriodKey, ...rest);
}

export async function getIncomeStatement(...args: [...CashPeriodArgs, currency?: string]) {
  if (USE_MOCK) return { ventas: 0, cmv: 0, otherIncomeItems: [], expenseItems: [] };
  const [period, ...rest] = args;
  const databaseActions = await getDatabaseActions();
  return databaseActions.getIncomeStatement(period as CashPeriodKey, ...rest);
}

export async function createProductOperation(formData: FormData): Promise<ActionResult<{ operacionId: string; undo?: UndoRef }>> {
  if (USE_MOCK) return { success: true, data: { operacionId: 'mock' } };
  const databaseActions = await getDatabaseActions();
  return databaseActions.createProductOperation(formData);
}

export async function createConceptOperation(formData: FormData): Promise<ActionResult<{ clienteSaldado?: boolean; clienteNombre?: string; proveedorSaldado?: boolean; proveedorNombre?: string; undo?: UndoRef }>> {
  if (USE_MOCK) return { success: true, data: {} };
  const databaseActions = await getDatabaseActions();
  return databaseActions.createConceptOperation(formData);
}

export async function undoRegistro(ref: UndoRef): Promise<ActionResult> {
  if (USE_MOCK) return { success: true };
  const databaseActions = await getDatabaseActions();
  return databaseActions.undoRegistro(ref);
}
