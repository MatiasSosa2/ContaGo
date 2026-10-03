'use client'

import { useEffect, useMemo, useState } from 'react'
import OperationTypeSelect from './ui/OperationTypeSelect'
import ProductOperationForm from './ProductOperationForm'
import ConceptOperationForm, { type ConceptKind } from './ConceptOperationForm'
import { Caption, IOS_FONT } from './ui/ios'
import type { Registrado } from '@/lib/registro'

export type Account = { id: string; name: string; currency: string; type: string }
export type Category = { id: string; name: string; type: string }
export type Subcategory = { id: string; name: string; categoryId: string }
export type Contact = { id: string; name: string; type: string }
export type AreaNegocio = { id: string; nombre: string }
export type Producto = {
  id: string
  nombre: string
  categoria: string | null
  marca: string | null
  precioVenta: number
  precioCosto: number
  stockActual: number
  tipo?: string
}
export type Empleado = { id: string; nombre: string; cargo: string | null }
export type BienDeUso = {
  id: string
  nombre: string
  categoria: string | null
  marca: string | null
  valorAdquisicion: number
  depreciacionAcumulada: number
}

type SubType =
  | 'SALE_PRODUCT' | 'SALE_BIEN_USO' | 'COBRO_CREDITO' | 'OTHER_INCOME'
  | 'PURCHASE_PRODUCT' | 'PURCHASE_BIEN_USO' | 'PAGO_DEUDA' | 'PAGO'

type Props = {
  accounts: Account[]
  categories: Category[]
  subcategories?: Subcategory[]
  contacts: Contact[]
  productos?: Producto[]
  empleados?: Empleado[]
  bienesDeUso?: BienDeUso[]
  initialType?: 'INCOME' | 'EXPENSE'
  initialSubType?: SubType
  initialCreditoPreset?: { linkedCreditoId: string; contactId: string; saldoMax: number } | null
  date: string
  /** Alta/baja de categorías propias. onAddCategory devuelve error o null. */
  onAddCategory?: (name: string, type: 'INCOME' | 'EXPENSE') => Promise<string | null>
  onDeleteCategory?: (id: string) => void
  /** Alta/baja de subcategorías. onAddSubcategory devuelve el id creado o un error. */
  onAddSubcategory?: (categoryId: string, name: string) => Promise<{ id: string } | { error: string }>
  onDeleteSubcategory?: (id: string) => void
  /** Registro hecho: el modal muestra la confirmación y el aviso con Deshacer */
  onDone: (registrado?: Registrado) => void
  /** Cliente/proveedor agregado desde el registro */
  onContactCreated?: (contact: Contact) => void
  /** Lugar al costado de la pestaña para el carrito de la venta */
  cartSlot?: HTMLElement | null
  /** Lugar debajo de la pestaña para la tarjeta del botón "Registrar…" */
  footerSlot?: HTMLElement | null
}

// Categorías que el sistema crea solo para cada tipo de operación: no se listan como propias.
const SYSTEM_CATEGORY_NAMES = new Set([
  'Ventas de mercadería', 'Ventas de servicios', 'Resultado por venta de bienes de uso',
  'Cobros de crédito', 'Compras', 'Otros ingresos', 'Otros egresos', 'Diferencias de caja',
])

// Categorías de egreso que vienen por defecto, en el orden en que se muestran
const DEFAULT_ORDER = ['Sueldos', 'Alquiler', 'Publicidad', 'Impuestos']

const defaultSubType = (t: 'INCOME' | 'EXPENSE'): SubType => (t === 'EXPENSE' ? 'PURCHASE_PRODUCT' : 'SALE_PRODUCT')

/**
 * Ingreso / egreso del "+": arriba la categoría y, según cuál, el formulario de productos
 * (varios ítems con carrito) o el de conceptos (monto + mismo bloque de pago).
 */
export default function TransactionForm({
  accounts,
  categories,
  subcategories = [],
  contacts,
  productos = [],
  empleados = [],
  bienesDeUso = [],
  initialType = 'INCOME',
  initialSubType,
  initialCreditoPreset = null,
  date,
  onAddCategory,
  onDeleteCategory,
  onAddSubcategory,
  onDeleteSubcategory,
  onDone,
  onContactCreated,
  cartSlot,
  footerSlot,
}: Props) {
  const type = initialType
  const isIngreso = type === 'INCOME'
  const [subType, setSubType] = useState<SubType>(initialSubType ?? defaultSubType(initialType))
  // Categoría propia elegida (subType pasa a OTHER_INCOME / PAGO)
  const [categoryId, setCategoryId] = useState('')
  const [subcategoryId, setSubcategoryId] = useState('')

  // Al cambiar de pestaña (ingreso/egreso) o de preset, vuelve a la categoría por defecto
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSubType(initialSubType ?? defaultSubType(initialType))
    setCategoryId('')
    setSubcategoryId('')
  }, [initialType, initialSubType])

  const customCategories = useMemo(
    () => categories
      .filter((c) => c.type === type && !SYSTEM_CATEGORY_NAMES.has(c.name))
      // Primero las que vienen por defecto, en su orden; después las demás alfabéticamente
      .sort((a, b) => {
        const ia = DEFAULT_ORDER.indexOf(a.name), ib = DEFAULT_ORDER.indexOf(b.name)
        if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
        return a.name.localeCompare(b.name, 'es')
      })
      .map((c) => ({
        id: c.id,
        name: c.name,
        subcategories: subcategories.filter((s) => s.categoryId === c.id),
      })),
    [categories, subcategories, type],
  )

  // El select devuelve un subtipo fijo o el id de una categoría propia
  const handleSubTypeChange = (value: string) => {
    setSubcategoryId('')
    if (customCategories.some((c) => c.id === value)) {
      setSubType(isIngreso ? 'OTHER_INCOME' : 'PAGO')
      setCategoryId(value)
    } else {
      setSubType(value as SubType)
      setCategoryId('')
    }
  }

  const handleSelectSubcategory = (catId: string, subId: string) => {
    if (catId !== categoryId) handleSubTypeChange(catId)
    setSubcategoryId(subId)
  }

  const handleAddCategory = async (name: string) => {
    if (!onAddCategory) return null
    return onAddCategory(name, type)
  }

  const handleAddSubcategory = async (catId: string, name: string) => {
    if (!onAddSubcategory) return null
    const result = await onAddSubcategory(catId, name)
    if ('error' in result) return result.error
    handleSelectSubcategory(catId, result.id)
    return null
  }

  const handleDeleteSubcategory = (id: string) => {
    if (!onDeleteSubcategory) return
    const sub = subcategories.find((s) => s.id === id)
    if (!window.confirm(`¿Eliminar la subcategoría "${sub?.name ?? ''}"? Los movimientos que la usan quedan solo con la categoría.`)) return
    if (subcategoryId === id) setSubcategoryId('')
    onDeleteSubcategory(id)
  }

  const handleDeleteCategory = (id: string) => {
    if (!onDeleteCategory) return
    const cat = customCategories.find((c) => c.id === id)
    if (!window.confirm(`¿Eliminar la categoría "${cat?.name ?? ''}"? Los movimientos que la usan quedan sin categoría.`)) return
    if (categoryId === id) handleSubTypeChange(defaultSubType(type))
    onDeleteCategory(id)
  }

  const isSaleProduct = subType === 'SALE_PRODUCT'
  const isPurchaseProduct = subType === 'PURCHASE_PRODUCT'
  const conceptKind: ConceptKind | null =
    subType === 'SALE_BIEN_USO' ? 'VENTA_BIEN'
      : subType === 'PURCHASE_BIEN_USO' ? 'COMPRA_BIEN'
      : subType === 'COBRO_CREDITO' ? 'COBRO'
      : subType === 'PAGO_DEUDA' ? 'PAGO_DEUDA'
      : categoryId ? (isIngreso ? 'OTRO_INGRESO' : 'OTRO_EGRESO')
      : null

  return (
    <div className={`flex h-full flex-col ${IOS_FONT}`}>
      <Caption>Categoría</Caption>
      <OperationTypeSelect
        variant="ios"
        value={categoryId || subType}
        subcategoryId={subcategoryId}
        onChange={handleSubTypeChange}
        onSelectSubcategory={handleSelectSubcategory}
        type={type}
        customCategories={customCategories}
        onAddCustom={onAddCategory ? handleAddCategory : undefined}
        onDeleteCustom={onDeleteCategory ? handleDeleteCategory : undefined}
        onAddSubcategory={onAddSubcategory ? handleAddSubcategory : undefined}
        onDeleteSubcategory={onDeleteSubcategory ? handleDeleteSubcategory : undefined}
      />
      {isSaleProduct || isPurchaseProduct ? (
        <ProductOperationForm
          key={isSaleProduct ? 'VENTA' : 'COMPRA'}
          tipo={isSaleProduct ? 'VENTA' : 'COMPRA'}
          accounts={accounts}
          contacts={contacts}
          empleados={empleados}
          productos={productos}
          date={date}
          onDone={onDone}
          onContactCreated={onContactCreated}
          cartSlot={cartSlot}
          footerSlot={footerSlot}
        />
      ) : conceptKind ? (
        <ConceptOperationForm
          key={`${conceptKind}-${categoryId}`}
          kind={conceptKind}
          accounts={accounts}
          bienesDeUso={bienesDeUso}
          date={date}
          categoryId={categoryId || undefined}
          subcategoryId={subcategoryId || undefined}
          preset={initialCreditoPreset ? { linkedCreditoId: initialCreditoPreset.linkedCreditoId, contactId: initialCreditoPreset.contactId } : null}
          onDone={onDone}
          footerSlot={footerSlot}
        />
      ) : null}
    </div>
  )
}
