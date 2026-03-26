'use server'

import * as MOCK from '@/lib/mock'
import { ActionResult } from '@/lib/validations'; 
import { type DateRange } from '@/lib/validations';
import { revalidatePath } from 'next/cache';

const hasDatabaseConfig = Boolean(process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL);
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' || process.env.USE_MOCK_DATA === 'true' || !hasDatabaseConfig;

// Cache the module promise so it resolves only once across all calls
let _dbActionsPromise: Promise<typeof import('./actions.database')> | null = null;
const getDatabaseActions = () => {
  if (!_dbActionsPromise) _dbActionsPromise = import('./actions.database');
  return _dbActionsPromise;
};

// ---- PROXY FUNCTIONS ----

export async function getAccounts(preBusinessId?: string) {
  if (USE_MOCK) return MOCK.MOCK_ACCOUNTS;
  const databaseActions = await getDatabaseActions();
  return databaseActions.getAccounts(preBusinessId);
}

export async function getCategories(preBusinessId?: string) {
  if (USE_MOCK) return MOCK.MOCK_CATEGORIES;
  const databaseActions = await getDatabaseActions();
  return databaseActions.getCategories(preBusinessId);
}

export async function getTransactions() {
  if (USE_MOCK) return MOCK.MOCK_TRANSACTIONS;
  const databaseActions = await getDatabaseActions();
  return databaseActions.getTransactions();
}

export async function getAreasNegocio(preBusinessId?: string) {
  if (USE_MOCK) return MOCK.MOCK_AREAS;
  const databaseActions = await getDatabaseActions();
  return databaseActions.getAreasNegocio(preBusinessId);
}

export async function getContacts(preBusinessId?: string) {
  if (USE_MOCK) return MOCK.MOCK_CONTACTS;
  const databaseActions = await getDatabaseActions();
  return databaseActions.getContacts(preBusinessId);
}

export async function createContact(formData: FormData): Promise<ActionResult> {
  if (USE_MOCK) return { success: true };
  const databaseActions = await getDatabaseActions();
  return databaseActions.createContact(formData);
}

export async function createTransaction(formData: FormData): Promise<ActionResult> {
  if (USE_MOCK) return { success: true };
  const databaseActions = await getDatabaseActions();
  return databaseActions.createTransaction(formData);
}

export async function deleteTransaction(id: string) {
  if (USE_MOCK) { revalidatePath('/'); return; }
  const databaseActions = await getDatabaseActions();
  return databaseActions.deleteTransaction(id);
}

export async function createAccount(formData: FormData): Promise<ActionResult> {
  if (USE_MOCK) return { success: true };
  const databaseActions = await getDatabaseActions();
  return databaseActions.createAccount(formData);
}

export async function getAllTransactions() {
  if (USE_MOCK) return MOCK.MOCK_TRANSACTIONS;
  const databaseActions = await getDatabaseActions();
  return databaseActions.getAllTransactions();
}

export async function getReportData(range?: DateRange) {
  if (USE_MOCK) {
    // Mock calculations
    const allTx = MOCK.MOCK_TRANSACTIONS as any[];
    const totalsByCurrency = { 'ARS': { income: 500000, expense: 350000 }, 'USD': { income: 1200, expense: 0 } };
    const monthlyHistory: any[] = [];
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

export async function getMonthlyStats() {
  if (USE_MOCK) {
    return [
      { currency: 'ARS', income: 500000, expense: 350000, balance: 150000 },
      { currency: 'USD', income: 1200, expense: 0, balance: 1200 }
    ];
  }
  const databaseActions = await getDatabaseActions();
  return databaseActions.getMonthlyStats();
}

export async function getWeeklyStats() {
  if (USE_MOCK) {
    return [
      { currency: 'ARS', income: 200000, expense: 50000, balance: 150000 },
    ];
  }
  const databaseActions = await getDatabaseActions();
  return databaseActions.getWeeklyStats();
}

export async function updateContact(id: string, formData: FormData): Promise<ActionResult> {
  if (USE_MOCK) return { success: true };
  const databaseActions = await getDatabaseActions();
  return databaseActions.updateContact(id, formData);
}

export async function deleteContact(id: string) {
  if (USE_MOCK) { revalidatePath('/'); return; }
  const databaseActions = await getDatabaseActions();
  return databaseActions.deleteContact(id);
}

export async function updateAccount(id: string, formData: FormData): Promise<ActionResult> {
  if (USE_MOCK) return { success: true };
  const databaseActions = await getDatabaseActions();
  return databaseActions.updateAccount(id, formData);
}

export async function deleteAccount(id: string): Promise<ActionResult> {
  if (USE_MOCK) return { success: true };
  const databaseActions = await getDatabaseActions();
  return databaseActions.deleteAccount(id);
}

export async function createAreaNegocio(formData: FormData): Promise<ActionResult> {
  if (USE_MOCK) return { success: true };
  const databaseActions = await getDatabaseActions();
  return databaseActions.createAreaNegocio(formData);
}

export async function updateAreaNegocio(id: string, formData: FormData): Promise<ActionResult> {
  if (USE_MOCK) return { success: true };
  const databaseActions = await getDatabaseActions();
  return databaseActions.updateAreaNegocio(id, formData);
}

export async function deleteAreaNegocio(id: string) {
  if (USE_MOCK) { revalidatePath('/'); return; }
  const databaseActions = await getDatabaseActions();
  return databaseActions.deleteAreaNegocio(id);
}

export async function createCategory(formData: FormData): Promise<ActionResult> {
  if (USE_MOCK) return { success: true };
  const databaseActions = await getDatabaseActions();
  return databaseActions.createCategory(formData);
}

export async function updateCategory(id: string, formData: FormData): Promise<ActionResult> {
  if (USE_MOCK) return { success: true };
  const databaseActions = await getDatabaseActions();
  return databaseActions.updateCategory(id, formData);
}

export async function deleteCategory(id: string) {
  if (USE_MOCK) { revalidatePath('/'); return; }
  const databaseActions = await getDatabaseActions();
  return databaseActions.deleteCategory(id);
}

export async function getCreditosDeudas() {
  if (USE_MOCK) return [];
  const databaseActions = await getDatabaseActions();
  return databaseActions.getCreditosDeudas();
}

export async function marcarEstadoCredito(id: string, estado: string): Promise<ActionResult> {
  if (USE_MOCK) return { success: true };
  const databaseActions = await getDatabaseActions();
  return databaseActions.marcarEstadoCredito(id, estado);
}

export async function getProductos() {
  if (USE_MOCK) return MOCK.MOCK_PRODUCTOS;
  const databaseActions = await getDatabaseActions();
  return databaseActions.getProductos();
}

export async function createProducto(formData: FormData): Promise<ActionResult> {
  if (USE_MOCK) return { success: true };
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

export async function addMovimientoStock(formData: FormData): Promise<ActionResult> {
  if (USE_MOCK) return { success: true };
  const databaseActions = await getDatabaseActions();
  return databaseActions.addMovimientoStock(formData);
}

export async function getMovimientosStock(productoId: string) {
  if (USE_MOCK) return [];
  const databaseActions = await getDatabaseActions();
  return databaseActions.getMovimientosStock(productoId);
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
      topProductosPorStock: [] 
    }
  }
  const databaseActions = await getDatabaseActions();
  return databaseActions.getReportDataExtended(range);
}

export async function getDailyStats() {
  if (USE_MOCK) return { txHoy: [], byCurrency: {} };
  const databaseActions = await getDatabaseActions();
  return databaseActions.getDailyStats();
}

export async function getDashboardStats(period: string, customFrom?: string, customTo?: string, preBusinessId?: string, selectedYear?: number, selectedMonth?: number) {
  if (USE_MOCK) {
    const { getMockDashboardStats } = await import('@/lib/mock');
    return getMockDashboardStats(period, customFrom, customTo);
  }
  const databaseActions = await getDatabaseActions();
  return databaseActions.getDashboardStats(period as any, customFrom, customTo, preBusinessId, selectedYear, selectedMonth);
}

export async function getMonthlyDashboardStats(preBusinessId?: string) {
  if (USE_MOCK) {
    const { getMockDashboardStats } = await import('@/lib/mock');
    return getMockDashboardStats('mensual');
  }
  const databaseActions = await getDatabaseActions();
  return databaseActions.getMonthlyDashboardStats(preBusinessId);
}

export async function getAvailableDashboardMonths(preBusinessId?: string) {
  if (USE_MOCK) {
    const now = new Date();
    return Array.from({ length: 4 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
      return {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        label: date.toLocaleDateString('es-AR', { month: 'short' }).replace('.', ''),
        shortYear: String(date.getFullYear()).slice(2),
        key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      };
    });
  }
  const databaseActions = await getDatabaseActions();
  return databaseActions.getAvailableDashboardMonths(preBusinessId);
}

export async function getDashboardPresetSummaries(preBusinessId?: string) {
  if (USE_MOCK) {
    const periods = ['diario', 'ayer', 'semanal', 'mensual', 'trimestral', 'semestral', 'anual'] as const;
    return periods.map((period) => ({
      period,
      periodLabel: period,
      income: 500000,
      expense: 320000,
      gain: 180000,
      incomeChangePct: 12.5,
      expenseChangePct: -4.2,
      gainChangePct: 18.1,
    }));
  }
  const databaseActions = await getDatabaseActions();
  return databaseActions.getDashboardPresetSummaries(preBusinessId);
}

export async function getCajasData() {
  if (USE_MOCK) {
    const { getMockCajasData } = await import('@/lib/mock');
    return getMockCajasData();
  }
  const databaseActions = await getDatabaseActions();
  return databaseActions.getCajasData();
}
