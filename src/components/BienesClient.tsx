'use client'

import { useState, useTransition } from 'react'
import {
  getBienesDeUso,
  createBienDeUso,
  updateBienDeUso,
  deleteBienDeUso,
  getAccounts,
} from '@/app/actions'

// ── Tipos ──
type Account = { id: string; name: string; currentBalance: number; currency: string }

export type BienDeUso = {
  id: string
  nombre: string
  descripcion: string | null
  categoria: string
  fechaCompra: Date | string
  valorCompra: number
  currency: string
  vidaUtilMeses: number
  valorResidual: number
  estado: string
  notas: string | null
  activo: boolean
  createdAt: Date | string
  updatedAt: Date | string
}

// ── Constantes ──
const CATEGORIAS: { value: string; label: string; icon: string }[] = [
  { value: 'TECNOLOGIA', label: 'Tecnología', icon: '💻' },
  { value: 'MOBILIARIO', label: 'Mobiliario', icon: '🪑' },
  { value: 'VEHICULO', label: 'Vehículo', icon: '🚗' },
  { value: 'HERRAMIENTA', label: 'Herramienta', icon: '🔧' },
  { value: 'INMUEBLE', label: 'Inmueble', icon: '🏢' },
  { value: 'OTRO', label: 'Otro', icon: '📦' },
]

const ESTADOS: { value: string; label: string; color: string }[] = [
  { value: 'EN_USO', label: 'En uso', color: '#2D6A4F' },
  { value: 'VENDIDO', label: 'Vendido', color: '#C5A065' },
  { value: 'DADO_DE_BAJA', label: 'Dado de baja', color: '#6b7280' },
]

// ── Helpers ──
function getCatInfo(val: string) {
  return CATEGORIAS.find(c => c.value === val) ?? { value: val, label: val, icon: '📦' }
}

function getEstadoInfo(val: string) {
  return ESTADOS.find(e => e.value === val) ?? { value: val, label: val, color: '#6b7280' }
}

function fmt(n: number, cur = 'ARS') {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: cur === 'USD' ? 'USD' : 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

function calcDepreciacion(bien: BienDeUso) {
  const hoy = new Date()
  const compra = new Date(bien.fechaCompra)
  const mesesTranscurridos =
    (hoy.getFullYear() - compra.getFullYear()) * 12 +
    (hoy.getMonth() - compra.getMonth())
  const base = bien.valorCompra - bien.valorResidual
  const depMensual = bien.vidaUtilMeses > 0 ? base / bien.vidaUtilMeses : 0
  const depAcumulada = Math.min(depMensual * Math.max(mesesTranscurridos, 0), base)
  const valorLibros = bien.valorCompra - depAcumulada
  const porcentaje = base > 0 ? (depAcumulada / base) * 100 : 0
  const mesesRestantes = Math.max(bien.vidaUtilMeses - mesesTranscurridos, 0)
  return { depMensual, depAcumulada, valorLibros, porcentaje, mesesRestantes, mesesTranscurridos }
}

function toInputDate(val: Date | string): string {
  const d = new Date(val)
  return d.toISOString().slice(0, 10)
}

// ── Ícono Sparkle ──
function SparkleIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09ZM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456Z" />
    </svg>
  )
}

// ── Formulario modal ──
type FormProps = {
  editingBien: BienDeUso | null
  accounts: Account[]
  onCancel: () => void
  onSaved: () => void
}

function BienForm({ editingBien, accounts, onCancel, onSaved }: FormProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [currency, setCurrency] = useState(editingBien?.currency ?? 'ARS')
  const [categoria, setCategoria] = useState(editingBien?.categoria ?? 'TECNOLOGIA')
  const [estado, setEstado] = useState(editingBien?.estado ?? 'EN_USO')
  const [accountId, setAccountId] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)
    fd.set('currency', currency)
    fd.set('categoria', categoria)
    fd.set('estado', estado)
    fd.set('accountId', accountId)
    startTransition(async () => {
      const result = editingBien
        ? await updateBienDeUso(editingBien.id, fd)
        : await createBienDeUso(fd)
      if (result.success) {
        onSaved()
      } else {
        setError(result.error ?? 'Error desconocido')
      }
    })
  }

  const inputClass =
    'w-full border border-[#E5E7EB] dark:border-white/10 dark:bg-[#1F1F1F] dark:text-[#E8E8E8] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 focus:border-[#2D6A4F]'

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-[#E5E7EB] dark:border-white/10">
        <div className="px-6 py-4 rounded-t-2xl flex justify-between items-center bg-brand-military">
          <div>
            <h2 className="text-base font-semibold text-white">
              {editingBien ? 'Editar Bien de Uso' : 'Nuevo Bien de Uso'}
            </h2>
            <p className="text-xs mt-0.5 text-emerald-200/70">
              PC, muebles, vehículos, herramientas...
            </p>
          </div>
          <button onClick={onCancel} className="text-white/60 hover:text-white text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#6B7280] dark:text-[#9CA3AF] mb-1">Nombre del bien *</label>
            <input
              name="nombre"
              defaultValue={editingBien?.nombre}
              placeholder="Ej: MacBook Pro M3, Silla ergonómica..."
              required
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#6B7280] dark:text-[#9CA3AF] mb-1">Categoría *</label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIAS.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategoria(c.value)}
                  className="flex flex-col items-center gap-1 py-2 px-1 rounded-xl border text-xs font-medium transition-all"
                  style={
                    categoria === c.value
                      ? { background: '#D8F3DC', borderColor: '#2D6A4F', color: '#1B4332' }
                      : { borderColor: '#e5e7eb', color: '#6b7280' }
                  }
                >
                  <span className="text-lg">{c.icon}</span>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#6B7280] dark:text-[#9CA3AF] mb-1">Fecha de compra *</label>
              <input
                name="fechaCompra"
                type="date"
                defaultValue={editingBien ? toInputDate(editingBien.fechaCompra) : new Date().toISOString().slice(0, 10)}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B7280] dark:text-[#9CA3AF] mb-1">Moneda</label>
              <div className="flex gap-2">
                {(['ARS', 'USD'] as const).map(cur => (
                  <button
                    key={cur}
                    type="button"
                    onClick={() => setCurrency(cur)}
                    className="flex-1 py-2 rounded-xl border text-sm font-semibold transition-all"
                    style={
                      currency === cur
                        ? { background: '#1B4332', color: 'white', borderColor: '#1B4332' }
                        : { borderColor: '#e5e7eb', color: '#6b7280' }
                    }
                  >
                    {cur}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#6B7280] dark:text-[#9CA3AF] mb-1">Valor de compra *</label>
              <input
                name="valorCompra"
                type="number"
                step="0.01"
                min="0.01"
                defaultValue={editingBien?.valorCompra}
                placeholder="0"
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B7280] dark:text-[#9CA3AF] mb-1">
                Valor residual <span className="text-[#9CA3AF] font-normal ml-1">(al final)</span>
              </label>
              <input
                name="valorResidual"
                type="number"
                step="0.01"
                min="0"
                defaultValue={editingBien?.valorResidual ?? 0}
                placeholder="0"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#6B7280] dark:text-[#9CA3AF] mb-1">
              Vida útil estimada (meses) <span className="text-[#9CA3AF] font-normal">— determina la depreciación mensual</span>
            </label>
            <div className="flex gap-2">
              {[24, 36, 60, 120].map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={e => {
                    const input = (e.currentTarget.parentElement!.querySelector('input') as HTMLInputElement)
                    input.value = String(m)
                  }}
                  className="text-xs px-2 py-1 rounded-lg border border-[#E5E7EB] dark:border-white/10 text-[#6B7280] hover:border-[#2D6A4F] hover:text-[#2D6A4F] transition-colors"
                >
                  {m === 24 ? '2a' : m === 36 ? '3a' : m === 60 ? '5a' : '10a'}
                </button>
              ))}
              <input
                name="vidaUtilMeses"
                type="number"
                min="1"
                max="600"
                defaultValue={editingBien?.vidaUtilMeses ?? 60}
                className="flex-1 border border-[#E5E7EB] dark:border-white/10 dark:bg-[#1F1F1F] dark:text-[#E8E8E8] rounded-xl px-3 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 focus:border-[#2D6A4F]"
              />
            </div>
          </div>

          {!editingBien && (
            <div>
              <label className="block text-xs font-medium text-[#6B7280] dark:text-[#9CA3AF] mb-1">¿De qué cuenta sale el dinero?</label>
              <select
                value={accountId}
                onChange={e => setAccountId(e.target.value)}
                className={inputClass}
              >
                <option value="">— No registrar movimiento de caja —</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.currency} {a.currentBalance.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })})
                  </option>
                ))}
              </select>
              {accountId ? (
                <p className="text-[11px] mt-1.5 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl px-2.5 py-1.5">
                  ✓ Al guardar, se descuenta el valor de compra de esta cuenta → gasto en &quot;Bienes de Uso&quot;
                </p>
              ) : (
                <p className="text-[11px] mt-1.5 text-[#9CA3AF]">
                  Si no elegís cuenta, el bien queda registrado pero el saldo de caja no se modifica.
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#6B7280] dark:text-[#9CA3AF] mb-1">Estado</label>
            <div className="flex gap-2">
              {ESTADOS.map(e => (
                <button
                  key={e.value}
                  type="button"
                  onClick={() => setEstado(e.value)}
                  className="flex-1 py-2 rounded-xl border text-xs font-medium transition-all"
                  style={
                    estado === e.value
                      ? { background: e.color, color: 'white', borderColor: e.color }
                      : { borderColor: '#e5e7eb', color: '#6b7280' }
                  }
                >
                  {e.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#6B7280] dark:text-[#9CA3AF] mb-1">Descripción / Notas</label>
            <textarea
              name="descripcion"
              defaultValue={editingBien?.descripcion ?? ''}
              placeholder="Modelo, número de serie, proveedor..."
              rows={2}
              className={inputClass + ' resize-none'}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-xl px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-white/10 text-sm font-medium text-[#6B7280] dark:text-gray-400 hover:bg-[#F9FAFB] dark:hover:bg-white/5 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-60 bg-brand-military hover:bg-brand-military-dark"
            >
              {isPending ? 'Guardando...' : editingBien ? 'Actualizar' : 'Registrar Bien'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Tarjeta de bien ──
function BienCard({ bien, onEdit, onDelete }: { bien: BienDeUso; onEdit: () => void; onDelete: () => void }) {
  const cat = getCatInfo(bien.categoria)
  const est = getEstadoInfo(bien.estado)
  const dep = calcDepreciacion(bien)
  const pct = Math.min(dep.porcentaje, 100)
  const isFullyDep = pct >= 100

  return (
    <div
      className="bg-white dark:bg-[#141414] rounded-2xl border border-[#E5E7EB] dark:border-white/10 p-5 hover:shadow-md dark:hover:shadow-black/30 transition-shadow"
      style={{ boxShadow: '0px 2px 8px rgba(0,0,0,0.05)' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 bg-brand-military-light">
            {cat.icon}
          </div>
          <div>
            <p className="text-sm font-semibold text-[#1F2937] dark:text-[#E8E8E8] leading-tight">{bien.nombre}</p>
            <p className="text-xs text-[#9CA3AF] mt-0.5">{cat.label}</p>
          </div>
        </div>
        <span
          className="shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-lg"
          style={{ background: est.color + '18', color: est.color }}
        >
          {est.label}
        </span>
      </div>

      {/* Valores */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div>
          <p className="text-[10px] font-medium text-[#9CA3AF] uppercase tracking-wide mb-0.5">Valor compra</p>
          <p className="text-sm font-mono font-semibold text-[#1F2937] dark:text-[#E8E8E8] num-tabular">{fmt(bien.valorCompra, bien.currency)}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-[#9CA3AF] uppercase tracking-wide mb-0.5">Dep. acumulada</p>
          <p className="text-sm font-mono font-semibold text-red-500 dark:text-red-400 num-tabular">-{fmt(dep.depAcumulada, bien.currency)}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-[#9CA3AF] uppercase tracking-wide mb-0.5">Valor libros</p>
          <p className="text-sm font-mono font-semibold text-brand-military-dark dark:text-[#6EBC8A] num-tabular">
            {fmt(dep.valorLibros, bien.currency)}
          </p>
        </div>
      </div>

      {/* Barra depreciación */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1">
          <p className="text-[10px] text-[#9CA3AF]">
            Depreciado: <span className="font-semibold text-[#6B7280] dark:text-[#D1D5DB]">{pct.toFixed(0)}%</span>
          </p>
          <p className="text-[10px] text-[#9CA3AF]">
            {isFullyDep ? 'Totalmente depreciado' : `${dep.mesesRestantes} meses restantes`}
          </p>
        </div>
        <div className="h-1.5 rounded-full bg-[#F3F4F6] dark:bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              background: pct >= 90 ? '#ef4444' : pct >= 60 ? '#f59e0b' : '#2D6A4F',
            }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-[#9CA3AF]">
          Dep/mes: <span className="font-mono font-medium text-[#6B7280] dark:text-[#D1D5DB] num-tabular">{fmt(dep.depMensual, bien.currency)}</span>
          <span className="ml-1 text-[#D1D5DB] dark:text-[#444]">· {new Date(bien.fechaCompra).toLocaleDateString('es-AR', { year: 'numeric', month: 'short' })}</span>
        </p>
        <div className="flex gap-1.5">
          <button
            onClick={onEdit}
            className="text-[11px] px-2.5 py-1 rounded-lg border border-[#E5E7EB] dark:border-white/10 text-[#6B7280] dark:text-gray-400 hover:border-brand-military hover:text-brand-military transition-colors"
          >
            Editar
          </button>
          <button
            onClick={onDelete}
            className="text-[11px] px-2.5 py-1 rounded-lg border border-[#E5E7EB] dark:border-white/10 text-[#6B7280] dark:text-gray-400 hover:border-red-300 hover:text-red-500 transition-colors"
          >
            Dar de baja
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ──
export default function BienesClient({ initialBienes, initialAccounts }: {
  initialBienes: BienDeUso[]
  initialAccounts: Account[]
}) {
  const [bienes, setBienes] = useState<BienDeUso[]>(initialBienes)
  const [accounts] = useState<Account[]>(initialAccounts)
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingBien, setEditingBien] = useState<BienDeUso | null>(null)
  const [filtroCategoria, setFiltroCategoria] = useState<string>('TODOS')
  const [filtroEstado, setFiltroEstado] = useState<string>('TODOS')
  const [, startTransition] = useTransition()

  async function reload() {
    setLoading(true)
    const data = await getBienesDeUso()
    setBienes(data as BienDeUso[])
    setLoading(false)
  }

  function handleEdit(bien: BienDeUso) {
    setEditingBien(bien)
    setShowForm(true)
  }

  function handleDelete(id: string) {
    if (!confirm('¿Dar de baja este bien? Quedará desactivado del sistema.')) return
    startTransition(async () => {
      await deleteBienDeUso(id)
      await reload()
    })
  }

  // KPIs
  const bienesEnUso = bienes.filter(b => b.estado === 'EN_USO')
  const totalValorCompra = bienesEnUso.reduce((s, b) => s + b.valorCompra, 0)
  const totalDepAcumulada = bienesEnUso.reduce((s, b) => s + calcDepreciacion(b).depAcumulada, 0)
  const totalValorLibros = bienesEnUso.reduce((s, b) => s + calcDepreciacion(b).valorLibros, 0)
  const depMensualTotal = bienesEnUso.reduce((s, b) => s + calcDepreciacion(b).depMensual, 0)

  // Filtros
  const filtrados = bienes.filter(b => {
    const pasaCat = filtroCategoria === 'TODOS' || b.categoria === filtroCategoria
    const pasaEst = filtroEstado === 'TODOS' || b.estado === filtroEstado
    return pasaCat && pasaEst
  })

  // Consejo IA contextual
  const aiTip = depMensualTotal > 0
    ? `Tu depreciación mensual total es ${fmt(depMensualTotal)}. Considerá reservar esta cifra mensualmente para cubrir la renovación de activos a futuro.`
    : bienesEnUso.length > 0
      ? `Tenés ${bienesEnUso.length} bien${bienesEnUso.length !== 1 ? 'es' : ''} en uso. Asegurate de tener actualizados los datos de compra y vida útil para calcular correctamente la depreciación.`
      : 'Registrá tus activos fijos para llevar un control preciso de la depreciación y el valor en libros de cada bien.'

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-[#E5E7EB] dark:border-white/10 p-4" style={{ boxShadow: '0px 2px 8px rgba(0,0,0,0.04)' }}>
          <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-1">Total invertido</p>
          <p className="text-xl font-mono font-bold text-[#1F2937] dark:text-[#E8E8E8] num-tabular">{fmt(totalValorCompra)}</p>
          <p className="text-xs text-[#9CA3AF] mt-0.5">{bienesEnUso.length} bien{bienesEnUso.length !== 1 ? 'es' : ''} en uso</p>
        </div>
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-[#E5E7EB] dark:border-white/10 p-4" style={{ boxShadow: '0px 2px 8px rgba(0,0,0,0.04)' }}>
          <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-1">Dep. acumulada</p>
          <p className="text-xl font-mono font-bold text-red-500 dark:text-red-400 num-tabular">-{fmt(totalDepAcumulada)}</p>
          <p className="text-xs text-[#9CA3AF] mt-0.5">Valor consumido</p>
        </div>
        <div className="rounded-2xl border p-4 bg-[#EAF7F0] dark:bg-[#0D1F14] border-[#BBF7D0] dark:border-emerald-900" style={{ boxShadow: '0px 2px 8px rgba(0,0,0,0.04)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1 text-brand-military-dark dark:text-[#6EBC8A]">Valor en libros</p>
          <p className="text-xl font-mono font-bold num-tabular text-brand-military dark:text-[#6EBC8A]">{fmt(totalValorLibros)}</p>
          <p className="text-xs mt-0.5 text-brand-military/60 dark:text-[#6EBC8A]/60">Valor residual actual</p>
        </div>
        <div className="bg-[#141414] dark:bg-[#0D0D0D] rounded-2xl border border-white/10 p-4" style={{ boxShadow: '0px 2px 8px rgba(0,0,0,0.04)' }}>
          <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-1">Dep. mensual</p>
          <p className="text-xl font-mono font-bold text-[#E8E8E8] num-tabular">{fmt(depMensualTotal)}</p>
          <p className="text-xs text-[#555] mt-0.5">Gasto fijo por depreciación</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <div className="flex flex-wrap gap-1 bg-[#F3F4F6] dark:bg-white/5 rounded-xl p-1">
          <button
            onClick={() => setFiltroCategoria('TODOS')}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={filtroCategoria === 'TODOS' ? { background: '#1B4332', color: 'white' } : { color: '#6b7280' }}
          >
            Todas
          </button>
          {CATEGORIAS.map(c => (
            <button
              key={c.value}
              onClick={() => setFiltroCategoria(c.value)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1"
              style={filtroCategoria === c.value ? { background: '#1B4332', color: 'white' } : { color: '#6b7280' }}
            >
              {c.icon} {c.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-[#F3F4F6] dark:bg-white/5 rounded-xl p-1">
          {[{ value: 'TODOS', label: 'Todos' }, ...ESTADOS].map(e => (
            <button
              key={e.value}
              onClick={() => setFiltroEstado(e.value)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={filtroEstado === e.value ? { background: '#1B4332', color: 'white' } : { color: '#6b7280' }}
            >
              {e.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-[#9CA3AF]">
          <div className="w-8 h-8 border-2 border-[#E5E7EB] border-t-brand-military rounded-full animate-spin mb-3" />
          <p className="text-sm">Cargando bienes...</p>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-[#9CA3AF]">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4 bg-brand-military-light">
            🏢
          </div>
          <p className="text-base font-medium text-[#6B7280] dark:text-[#D1D5DB] mb-1">
            {bienes.length === 0 ? 'Todavía no hay bienes registrados' : 'Sin resultados para este filtro'}
          </p>
          <p className="text-sm text-[#9CA3AF] mb-4 text-center max-w-xs">
            {bienes.length === 0
              ? 'Cuando registrás un gasto marcado como "bien de uso", aparece acá automáticamente'
              : 'Probá cambiando los filtros de categoría o estado'}
          </p>
          {bienes.length === 0 && (
            <button
              onClick={() => { setEditingBien(null); setShowForm(true) }}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-brand-military hover:bg-brand-military-dark transition-colors"
            >
              + Agregar primer bien
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtrados.map(b => (
            <BienCard
              key={b.id}
              bien={b}
              onEdit={() => handleEdit(b)}
              onDelete={() => handleDelete(b.id)}
            />
          ))}
        </div>
      )}

      {/* Consejo IA */}
      <div>
        <div className="flex items-center gap-2 mb-2.5 px-1">
          <div className="w-6 h-6 rounded-lg bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-600">
            <SparkleIcon />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">Consejo IA</span>
        </div>
        <div
          className="bg-white dark:bg-[#141414] rounded-xl border border-[#E5E7EB] dark:border-white/10 px-4 py-3.5"
          style={{ boxShadow: '0px 1px 4px rgba(0,0,0,0.04)' }}
        >
          <p className="text-sm text-[#4B5563] dark:text-[#B0B0B0] leading-relaxed">{aiTip}</p>
        </div>
      </div>

      {/* Modal formulario */}
      {showForm && (
        <BienForm
          editingBien={editingBien}
          accounts={accounts}
          onCancel={() => { setShowForm(false); setEditingBien(null) }}
          onSaved={async () => {
            setShowForm(false)
            setEditingBien(null)
            await reload()
          }}
        />
      )}
    </div>
  )
}
