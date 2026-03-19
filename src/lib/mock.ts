export const MOCK_ACCOUNTS = [
  { id: '1', name: 'Caja Principal (Demo)', type: 'CASH', currency: 'ARS', currentBalance: 1500000, businessId: 'demo', createdAt: new Date(), updatedAt: new Date() },
  { id: '2', name: 'Banco Galicia (Demo)', type: 'BANK', currency: 'ARS', currentBalance: 3200000, businessId: 'demo', createdAt: new Date(), updatedAt: new Date() },
  { id: '3', name: 'Caja USD (Demo)', type: 'CASH', currency: 'USD', currentBalance: 5000, businessId: 'demo', createdAt: new Date(), updatedAt: new Date() },
]

export const MOCK_CATEGORIES = [
  { id: '1', name: 'Ventas', type: 'INCOME', businessId: 'demo', createdAt: new Date(), updatedAt: new Date() },
  { id: '2', name: 'Servicios', type: 'INCOME', businessId: 'demo', createdAt: new Date(), updatedAt: new Date() },
  { id: '3', name: 'Alquiler', type: 'EXPENSE', businessId: 'demo', createdAt: new Date(), updatedAt: new Date() },
  { id: '4', name: 'Sueldos', type: 'EXPENSE', businessId: 'demo', createdAt: new Date(), updatedAt: new Date() },
  { id: '5', name: 'Proveedores', type: 'EXPENSE', businessId: 'demo', createdAt: new Date(), updatedAt: new Date() },
]

export const MOCK_CONTACTS = [
  { id: '1', name: 'Cliente Demo', type: 'CLIENT', businessId: 'demo', phone: '123456', email: 'juan@cliente.com', taxId: null, createdAt: new Date(), updatedAt: new Date() },
  { id: '2', name: 'Proveedor Demo', type: 'SUPPLIER', businessId: 'demo', phone: '987654', email: 'contacto@tech.com', taxId: null, createdAt: new Date(), updatedAt: new Date() },
]

export const MOCK_AREAS = [
  { id: '1', nombre: 'Administración', descripcion: 'Oficina central', businessId: 'demo', createdAt: new Date(), updatedAt: new Date() },
  { id: '2', nombre: 'Ventas', descripcion: 'Equipo comercial', businessId: 'demo', createdAt: new Date(), updatedAt: new Date() },
]

export const MOCK_TRANSACTIONS = [
  { 
    id: '1', description: 'Cobro factura A-0001', amount: 500000, currency: 'ARS', type: 'INCOME', date: new Date(), 
    esCredito: false, estado: 'COBRADO', fechaVencimiento: null, invoiceType: null, invoiceNumber: null, invoiceFileUrl: null,
    categoryId: '1', accountId: '1', contactId: '1', areaNegocioId: '2', businessId: 'demo',
    category: MOCK_CATEGORIES[0], account: MOCK_ACCOUNTS[0], contact: MOCK_CONTACTS[0], areaNegocio: MOCK_AREAS[1],
    createdAt: new Date(), updatedAt: new Date()
  },
  { 
    id: '2', description: 'Pago alquiler oficina', amount: 350000, currency: 'ARS', type: 'EXPENSE', date: new Date(Date.now() - 86400000 * 2), 
    esCredito: false, estado: 'PAGADO', fechaVencimiento: null, invoiceType: null, invoiceNumber: null, invoiceFileUrl: null,
    categoryId: '3', accountId: '2', contactId: null, areaNegocioId: '1', businessId: 'demo',
    category: MOCK_CATEGORIES[2], account: MOCK_ACCOUNTS[1], contact: null, areaNegocio: MOCK_AREAS[0],
    createdAt: new Date(), updatedAt: new Date()
  },
  { 
    id: '3', description: 'Venta de servicios consultoría', amount: 1200, currency: 'USD', type: 'INCOME', date: new Date(Date.now() - 86400000 * 5), 
    esCredito: false, estado: 'COBRADO', fechaVencimiento: null, invoiceType: null, invoiceNumber: null, invoiceFileUrl: null,
    categoryId: '2', accountId: '3', contactId: '1', areaNegocioId: '2', businessId: 'demo',
    category: MOCK_CATEGORIES[1], account: MOCK_ACCOUNTS[2], contact: MOCK_CONTACTS[0], areaNegocio: MOCK_AREAS[1],
    createdAt: new Date(), updatedAt: new Date()
  },
]

export const MOCK_PRODUCTOS = [
  { id: '1', nombre: 'Producto Demo A', descripcion: null, categoria: null, marca: null, unidad: 'unidad', metodoCosteo: 'PROMEDIO', currency: 'ARS', precioVenta: 100, precioCosto: 50, stockActual: 100, enTransito: 0, activo: true, businessId: 'demo', createdAt: new Date(), updatedAt: new Date(), movimientos: [] },
]

export const MOCK_BIENES = []

// ── Mock getDashboardStats ──
export function getMockDashboardStats(_period?: string, _customFrom?: string, _customTo?: string) {
  const CAT_COLORS = ['#3A4D39', '#C5A065', '#5A7A57', '#d4ae84', '#6b8f65', '#c49a6c']
  return {
    kpis: { income: 500000, expense: 350000, gain: 150000, marginPct: 30 },
    prevKpis: { income: 420000, expense: 310000, gain: 110000, marginPct: 26.2 },
    chartData: [
      { label: 'Lun', income: 80000, expense: 50000, net: 30000 },
      { label: 'Mar', income: 90000, expense: 60000, net: 30000 },
      { label: 'Mié', income: 70000, expense: 45000, net: 25000 },
      { label: 'Jue', income: 85000, expense: 55000, net: 30000 },
      { label: 'Vie', income: 100000, expense: 70000, net: 30000 },
      { label: 'Sáb', income: 50000, expense: 40000, net: 10000 },
      { label: 'Dom', income: 25000, expense: 30000, net: -5000 },
    ],
    categoryBreakdown: [
      { name: 'Alquiler', value: 150000, color: CAT_COLORS[0] },
      { name: 'Sueldos', value: 120000, color: CAT_COLORS[1] },
      { name: 'Proveedores', value: 80000, color: CAT_COLORS[2] },
    ],
    incomeCategoryBreakdown: [
      { name: 'Ventas', value: 300000, color: '#2D6A4F' },
      { name: 'Servicios', value: 150000, color: '#5A7A57' },
      { name: 'Otros', value: 50000, color: '#6b8f65' },
    ],
    recentTx: MOCK_TRANSACTIONS.slice(0, 7).map(tx => ({
      id: tx.id, description: tx.description, amount: tx.amount,
      currency: tx.currency, type: tx.type, date: tx.date,
      category: tx.category ? { name: tx.category.name } : null,
      account: tx.account ? { name: tx.account.name } : null,
    })),
    sparklines: {
      income: [80000, 90000, 70000, 85000, 100000, 75000],
      expense: [50000, 60000, 45000, 55000, 70000, 70000],
      balance: [30000, 30000, 25000, 30000, 30000, 5000],
    },
    debtStatus: {
      vencidos: { count: 0, total: 0 },
      en48hs: { count: 0, total: 0 },
      futuros: { count: 0, total: 0 },
      totalPendiente: 0,
      creditosDeudas: [],
    },
    alerts: [],
    periodLabel: 'Demo',
  }
}

// ── Mock getCajasData ──
export function getMockCajasData() {
  // Calcular variaciones desde las transacciones mock (coherencia con dashboard)
  const now = new Date()
  const inicioHoy = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
  const hace7dias = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  // Contar movimientos y variación real por cuenta
  const movCountByAccount: Record<string, number> = {}
  const todayVarByAccount: Record<string, number> = {}

  for (const tx of MOCK_TRANSACTIONS) {
    const txDate = tx.date instanceof Date ? tx.date : new Date(tx.date)
    // Últimos 7 días
    if (txDate >= hace7dias) {
      movCountByAccount[tx.accountId] = (movCountByAccount[tx.accountId] || 0) + 1
    }
    // Hoy
    if (txDate >= inicioHoy) {
      const delta = tx.type === 'INCOME' ? tx.amount : -tx.amount
      todayVarByAccount[tx.accountId] = (todayVarByAccount[tx.accountId] || 0) + delta
    }
  }

  const efectivoAccounts = MOCK_ACCOUNTS.filter(a => a.type === 'CASH').map(a => ({
    id: a.id,
    name: a.name,
    type: a.type,
    currency: a.currency,
    currentBalance: a.currentBalance,
    recentMovements: movCountByAccount[a.id] || 0,
    todayVariation: todayVarByAccount[a.id] || 0,
  }))
  const virtualAccounts = MOCK_ACCOUNTS.filter(a => a.type !== 'CASH').map(a => ({
    id: a.id,
    name: a.name,
    type: a.type,
    currency: a.currency,
    currentBalance: a.currentBalance,
    recentMovements: movCountByAccount[a.id] || 0,
    todayVariation: todayVarByAccount[a.id] || 0,
  }))
  const totalEfectivo = efectivoAccounts.reduce((s, a) => s + a.currentBalance, 0)
  const totalVirtual = virtualAccounts.reduce((s, a) => s + a.currentBalance, 0)
  const todayVarEfectivo = efectivoAccounts.reduce((s, a) => s + a.todayVariation, 0)
  const todayVarVirtual = virtualAccounts.reduce((s, a) => s + a.todayVariation, 0)

  // Mensaje de resumen coherente con los KPIs del dashboard
  const totalGeneral = totalEfectivo + totalVirtual
  const summaryMessage = `Tus cajas suman $${totalGeneral.toLocaleString('es-AR')} en total. Tus ingresos crecieron un 19.0% respecto al mes anterior.`

  const aiTipEfectivo = todayVarEfectivo > 0
    ? `Hoy ingresaron $${todayVarEfectivo.toLocaleString('es-AR')} en efectivo. Buen día de caja.`
    : todayVarEfectivo < 0
      ? `Hoy salieron $${Math.abs(todayVarEfectivo).toLocaleString('es-AR')} en efectivo.`
      : 'Sin movimientos de efectivo hoy. Todo estable.'

  const aiTipVirtual = todayVarVirtual > 0
    ? `Hoy ingresaron $${todayVarVirtual.toLocaleString('es-AR')} en cuentas virtuales.`
    : todayVarVirtual < 0
      ? `Hoy salieron $${Math.abs(todayVarVirtual).toLocaleString('es-AR')} de cuentas virtuales.`
      : 'Sin movimientos virtuales hoy.'

  return {
    efectivo: { accounts: efectivoAccounts, total: totalEfectivo, todayVariation: todayVarEfectivo },
    virtual: { accounts: virtualAccounts, total: totalVirtual, todayVariation: todayVarVirtual },
    summaryMessage,
    aiTipEfectivo,
    aiTipVirtual,
  }
}
