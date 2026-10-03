-- CreateTable
CREATE TABLE "Articulo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'MERCADERIA',
    "categoria" TEXT,
    "subcategoria" TEXT,
    "marca" TEXT,
    "unidad" TEXT NOT NULL DEFAULT 'unidad',
    "precioVenta" REAL NOT NULL DEFAULT 0,
    "atributos" TEXT,
    "foto" TEXT,
    "fotoAt" DATETIME,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "businessId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Articulo_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Producto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "imagenUrl" TEXT,
    "tipo" TEXT NOT NULL DEFAULT 'MERCADERIA',
    "categoria" TEXT,
    "marca" TEXT,
    "unidad" TEXT NOT NULL DEFAULT 'unidad',
    "metodoCosteo" TEXT NOT NULL DEFAULT 'PROMEDIO',
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "precioVenta" REAL NOT NULL DEFAULT 0,
    "precioCosto" REAL NOT NULL DEFAULT 0,
    "stockActual" REAL NOT NULL DEFAULT 0,
    "enTransito" REAL NOT NULL DEFAULT 0,
    "alertaStock" REAL,
    "articuloId" TEXT,
    "atributos" TEXT,
    "precioPropio" BOOLEAN NOT NULL DEFAULT false,
    "codigoBarras" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "businessId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Producto_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "Articulo" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Producto_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Producto" ("activo", "alertaStock", "businessId", "categoria", "createdAt", "currency", "descripcion", "enTransito", "id", "imagenUrl", "marca", "metodoCosteo", "nombre", "precioCosto", "precioVenta", "stockActual", "tipo", "unidad", "updatedAt") SELECT "activo", "alertaStock", "businessId", "categoria", "createdAt", "currency", "descripcion", "enTransito", "id", "imagenUrl", "marca", "metodoCosteo", "nombre", "precioCosto", "precioVenta", "stockActual", "tipo", "unidad", "updatedAt" FROM "Producto";
DROP TABLE "Producto";
ALTER TABLE "new_Producto" RENAME TO "Producto";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Articulo_businessId_idx" ON "Articulo"("businessId");
