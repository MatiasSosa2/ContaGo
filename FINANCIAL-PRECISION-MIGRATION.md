# Diseño de precisión financiera

## Estado y alcance

Este documento define una estrategia candidata; **no cambia el esquema ni migra datos**.
La base real y las migraciones existentes quedan fuera de alcance hasta que una prueba
en una copia temporal demuestre compatibilidad y se apruebe la reconciliación.

El esquema actual de [Prisma](./prisma/schema.prisma) contiene 33 campos `Float` con
semánticas distintas. No corresponde sustituirlos todos por un mismo tipo.

## Prototipo de conversión en aplicación

Se implementaron helpers puros en `src/lib/money.ts` para convertir cadenas decimales
en unidades mínimas `BigInt` y volver a cadenas decimales canónicas. Aplican
`ROUND_HALF_UP`, exponentes de 0 a 18 y límites de entero con signo de 64 bits. Sus siete
pruebas cubren escalas 0/2/3, valores positivos y negativos, redondeo por línea, ida y
vuelta, límites, y entradas inválidas.

Estos helpers todavía no se usan en los flujos productivos, no cambian el esquema ni
resuelven la moneda de cada campo. El prototipo no debe tratarse como aprobación de
migración.

## Evidencia del prototipo

Se usaron valores sintéticos en un cliente libSQL en memoria:

- `Prisma.Decimal` calculó `0.1 + 0.2` exactamente como `0.3`.
- Un valor insertado en columna `DECIMAL` terminó con afinidad `REAL` en SQLite/libSQL.
  Por ello, la aritmética exacta de Decimal en memoria no garantiza persistencia exacta
  al usar ese tipo de columna.
- El valor canónico guardado en una columna `TEXT` volvió exactamente, pero `SUM(TEXT)`
  convirtió los datos a `REAL`: el agregado SQL fue `123456792.02345678`, frente al
  resultado Decimal exacto `123456792.02345679`.
- El orden de `TEXT` es lexicográfico, no numérico.
- Los enteros en unidades mínimas se almacenaron como `INTEGER` y se sumaron exactamente.
- Se validaron escalas sintéticas de 0, 2 y 3 decimales, así como cálculo de precio por
  cantidad fraccionaria y conversión FX con Decimal.
- Con Prisma 7.4.1 y `PrismaLibSql`, un modelo Prisma tipado con campos `BigInt` preservó
  exactamente `9007199254740993n` al leer, agregar y actualizar atómicamente cuando se
  configuró `intMode: 'bigint'`. Con el modo por defecto (`number`), la lectura del mismo
  entero falló porque excedía el rango seguro de JavaScript. La configuración actual del
  adaptador en `src/lib/prisma.ts` no establece `intMode`; habría que cambiarla junto con
  una migración a campos `BigInt`.
- Un segundo experimento con el cliente generado desde el esquema actual mostró que
  `intMode: 'bigint'` por sí solo no basta: una lectura raw del valor
  `9007199254740993` devolvió `Number` redondeado a `9007199254740992`, porque el esquema
  actual no declara un campo Prisma `BigInt`. Por eso, la prueba tipada exitosa usó un
  esquema de prueba separado; no se debe habilitar el modo entero en el cliente actual
  como sustituto de migrar y regenerar el esquema.

La prueba fue local y en memoria; **no certifica una versión remota de Turso ni el
comportamiento integral del adaptador Prisma**.

## Estrategia recomendada: representación híbrida

1. **Importes contabilizados:** enteros `BigInt` en unidades mínimas de su moneda.
   Esto conserva sumas e incrementos atómicos de base de datos. La moneda determina su
   exponente; no se debe asumir que todas tienen dos decimales.
2. **Precios y costos unitarios, y cotizaciones:** texto decimal canónico (`String` en
   Prisma) leído y calculado con `Prisma.Decimal`. No usarlos en agregados ni ordenamientos
   numéricos SQL. Redondear solo al materializar un importe contabilizado.
3. **Cantidades y stock:** mantenerlos separados del dinero. No convertirlos a unidades
   monetarias ni imponer una escala global sin acordar precisión por unidad de medida.
   La precisión de inventario queda como trabajo separado; las cantidades actuales son
   `Float` y mantienen un riesgo de precisión propio.
4. **Moneda explícita:** cada importe debe tener una moneda inequívoca. El libro diario
   debe balancear en la moneda funcional del negocio y conservar, cuando corresponda,
   el importe y la moneda de origen, la cotización y el equivalente funcional.
5. **Límites de API:** `BigInt` no debe convertirse silenciosamente a `number`. Exponer
   importes exactos como cadenas decimales o DTO formateados con Decimal.

La conversión a unidades mínimas se hace con la escala asociada al código de moneda.
La política de redondeo, el punto de redondeo (línea o comprobante), monedas de
redondeo de efectivo y el manejo de criptoactivos requieren reglas explícitas. No se
presupone aquí una política fiscal o contable.

## Reglas de dominio acordadas

- La moneda funcional será configurable por negocio; ARS es la configuración inicial
  para ContaGo Argentina.
- Cada operación tendrá una sola moneda. Se permiten pagos divididos en distintas
  monedas solo si cada pago registra su moneda y conversión explícita.
- Cada línea se redondea a la unidad mínima de su moneda; el total de la operación es la
  suma de sus líneas ya redondeadas.
- Los empates de redondeo se resuelven alejándose de cero (`ROUND_HALF_UP`).
- Para el prototipo, la cotización será manual y quedará guardada como snapshot en cada
  operación/pago, con fecha efectiva igual a la fecha del movimiento.
- La diferencia cambiaria se reconocerá en cuentas separadas de ganancia o pérdida
  cambiaria, no incorporada silenciosamente al importe del pago.
- Antes de implementar esos asientos aún debe definirse el sentido/par de la cotización,
  su cuenta de contrapartida y cómo obtener el valor contable de la deuda original.

## Clasificación de los 33 campos actuales

| Modelo / campo | Clasificación y representación propuesta | Moneda / condición |
|---|---|---|
| `MercadoPagoPayment.amountGross`, `feeAmount`, `amountNet` | `BigInt` en unidades mínimas | Usar `currency`, ya presente. Verificar que neto, bruto y comisión reconcilien en esa moneda. |
| `Account.currentBalance` | `BigInt` en unidades mínimas | Moneda de `Account.currency`; conservar incrementos/decrementos atómicos. |
| `Operacion.subtotal`, `descuento`, `total` | `BigInt` en unidades mínimas | Añadir moneda de operación. Definir cómo se expresan pagos parciales en otras monedas. |
| `OperacionItem.subtotal` | `BigInt` en unidades mínimas | Moneda de la operación; validar que los artículos respeten esa moneda o tengan conversión explícita. |
| `OperacionItem.precioUnitario`, `costoUnitario` | Texto decimal + `Prisma.Decimal` | Precio/costo unitario en moneda explícita. Preservar precisión antes del subtotal redondeado. |
| `CashTransfer.amountFrom`, `amountTo` | `BigInt` en unidades mínimas | Escalas independientes según moneda de caja de origen y destino. Guardar ambas monedas como snapshot. |
| `CashTransfer.exchangeRate` | Texto decimal + `Prisma.Decimal` | Guardar par, sentido de cotización y precisión; redondear el destino según su moneda. |
| `Transaction.amount` | `BigInt` en unidades mínimas | `Transaction.currency`, ya presente. |
| `Transaction.exchangeRate` | Texto decimal + `Prisma.Decimal` | Definir par, dirección y moneda funcional a la que convierte. |
| `Transaction.precioUnitario` | Texto decimal + `Prisma.Decimal` | Añadir o derivar una moneda inequívoca; no inferirla si producto y transacción difieren. |
| `Producto.precioVenta`, `precioCosto`, `costoFijo` | Texto decimal + `Prisma.Decimal` | `Producto.currency`, ya presente. Los valores son por unidad y pueden requerir más precisión que el importe final. |
| `Producto.stockActual`, `enTransito`, `alertaStock` | Cantidades; mantener separadas del cambio monetario | `alertaStock` y existencias deben conservar la unidad de medida del producto. Definir escala de inventario aparte. |
| `BienDeUso.valorAdquisicion`, `valorResidual`, `depreciacionAcumulada` | `BigInt` en unidades mínimas | Añadir moneda del activo o fijar explícitamente que todos son importes en moneda funcional. |
| `Articulo.precioVenta` | Texto decimal + `Prisma.Decimal` | Añadir moneda o imponer y validar que sus variantes compartan moneda. |
| `MovimientoStock.precio`, `costoUnitario` | Texto decimal + `Prisma.Decimal` | Moneda del producto asociada; el costo unitario puede conservar precisión extendida. |
| `MovimientoStock.cantidad` | Cantidad; mantener separada del cambio monetario | Misma unidad y política de precisión que el producto. |
| `JournalLine.debit`, `credit` | `BigInt` en unidades mínimas funcionales | La moneda funcional debe ser explícita y los asientos balancearse en ella. Para partidas en moneda extranjera, guardar también importe/moneda original y cotización. |
| `OperacionItem.cantidad`, `Transaction.cantidad` | Cantidades; mantener separadas del cambio monetario | No asignar escala financiera. Acordar escala por unidad antes de corregir precisión de inventario. |

Las 16 columnas propuestas como importes contabilizados son las tres de Mercado Pago,
el saldo de cuenta, los tres totales de operación, el subtotal de ítem, los dos importes
de transferencia, el importe de transacción, los tres valores de bienes de uso y las dos
columnas del asiento. Las restantes se clasifican como 9 precios/costos unitarios,
2 cotizaciones y 6 cantidades.

## Brechas de moneda y contabilidad que bloquean la migración

- `Operacion` no registra moneda; `OperacionItem` tampoco y sus productos sí pueden
  tenerla. Definir si una operación exige moneda única o convierte cada ítem.
- `BienDeUso` no registra moneda. No se puede inferirla con seguridad al migrar valores
  históricos.
- `JournalLine` no declara moneda. En transferencias entre cuentas de monedas distintas,
  hoy se crean líneas por `amountTo` y `amountFrom`; esos números nominales no son
  necesariamente iguales. Definir moneda funcional, importes de origen/destino y el
  tratamiento de diferencias de cambio antes de exigir balance estricto.
- Hoy la transferencia contempla explícitamente ARS/USD y redondea a dos decimales.
  Una tabla o registro de monedas debe definir código, exponente contable y reglas de
  redondeo sin asumir dos decimales para todas.
- Los montos históricos `Float` ya pudieron perder su decimal original. La migración no
  puede reconstruirlo: debe detectar valores fuera de escala y reportar diferencias, no
  redondearlos silenciosamente.

## Impacto conocido en código

- Hay 15 usos de `_sum` financieros en `src/server/accounting/balance.ts`,
  `src/server/db/credits.ts`, `src/server/db/dashboard.ts`,
  `src/server/db/registro.ts` y `src/server/db/transactions.ts`. Mantenerlos exactos con
  enteros implica convertir sumas, restas y umbrales a `BigInt`/unidades menores.
- Los saldos de cuenta y el stock usan operaciones atómicas y filtros de rango (`gte`).
  Mantener saldos monetarios en `BigInt` permite conservar ese patrón; una columna texto
  no. Los campos de cantidad deben evaluarse aparte para no perder esas garantías.
- `Math.round(x * 100) / 100`, umbrales como `0.001` y `number` en los límites actuales
  deben reemplazarse por reglas basadas en escala monetaria, no copiarse al nuevo modelo.
- Los DTO, formularios, reportes, dashboards, exportaciones, seed y pruebas deben acordar
  cómo reciben y presentan `BigInt` y decimales exactos. Ninguna conversión a `number`
  debe estar en una ruta de cálculo contable.

## Fases y puertas de seguridad

1. **Cerrar reglas de dominio:** moneda funcional del negocio, monedas soportadas,
   exponentes, redondeo, moneda de operación/activo y política para asientos FX.
2. **Probar compatibilidad en base temporal:** generar un esquema mínimo con Prisma
   `BigInt` y `String`, configurar `PrismaLibSql` con `intMode: 'bigint'`, migrarlo con la
   versión real de Prisma/adaptador y probar inserts, lecturas, agregados BigInt, filtros
   e incrementos atómicos en SQLite/libSQL. Repetir en entorno Turso de prueba autorizado
   antes de certificar producción.
3. **Crear pruebas de dominio:** importes grandes, monedas con 0/2/3 decimales, límites
   de escala, división y redondeo, cantidad × precio, FX en ambos sentidos, operaciones
   con pagos divididos, créditos, reversos, stock e igualdad contable.
4. **Migrar de forma aditiva en copia:** añadir columnas nuevas, convertir cada fila
   usando moneda y escala verificadas, conservar columnas originales y emitir un reporte
   de anomalías por fila, negocio y moneda.
5. **Reconciliar:** comparar conteos, importes por moneda, saldos, créditos pendientes,
   inventario valorizado y asientos. Revisar cualquier valor que requiera redondeo.
6. **Ensayar corte y restauración:** verificar backup y rollback antes de un cambio
   productivo. Solo después de aprobar los resultados se prepara el cambio de lectura y
   escritura; no se borra la representación anterior hasta completar la validación.

**Criterio de no avance:** no generar ni aplicar una migración sobre datos reales mientras
falten moneda explícita en los modelos indicados, compatibilidad de `BigInt` con el
adaptador objetivo, política de redondeo aprobada o reconciliación sin diferencias
inexplicadas.
