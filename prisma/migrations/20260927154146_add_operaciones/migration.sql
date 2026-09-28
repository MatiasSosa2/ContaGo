-- CreateTable
CREATE TABLE "Operacion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tipo" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "subtotal" REAL NOT NULL,
    "descuento" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL,
    "contactId" TEXT,
    "empleadoId" TEXT,
    "businessId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Operacion_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Operacion_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Operacion_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OperacionItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "operacionId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" REAL NOT NULL,
    "precioUnitario" REAL NOT NULL,
    "subtotal" REAL NOT NULL,
    "costoUnitario" REAL,
    CONSTRAINT "OperacionItem_operacionId_fkey" FOREIGN KEY ("operacionId") REFERENCES "Operacion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OperacionItem_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "description" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "exchangeRate" REAL DEFAULT 1,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "esCredito" BOOLEAN NOT NULL DEFAULT false,
    "estado" TEXT NOT NULL DEFAULT 'COBRADO',
    "fechaVencimiento" DATETIME,
    "invoiceType" TEXT,
    "invoiceNumber" TEXT,
    "invoiceFileUrl" TEXT,
    "accountId" TEXT NOT NULL,
    "categoryId" TEXT,
    "subcategoryId" TEXT,
    "operacionId" TEXT,
    "cuotaNumero" INTEGER,
    "cuotasTotal" INTEGER,
    "contactId" TEXT,
    "areaNegocioId" TEXT,
    "subType" TEXT,
    "productoId" TEXT,
    "cantidad" REAL,
    "precioUnitario" REAL,
    "bienDeUsoId" TEXT,
    "linkedCreditoId" TEXT,
    "empleadoId" TEXT,
    "businessId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "Subcategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_operacionId_fkey" FOREIGN KEY ("operacionId") REFERENCES "Operacion" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_areaNegocioId_fkey" FOREIGN KEY ("areaNegocioId") REFERENCES "AreaNegocio" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_bienDeUsoId_fkey" FOREIGN KEY ("bienDeUsoId") REFERENCES "BienDeUso" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_linkedCreditoId_fkey" FOREIGN KEY ("linkedCreditoId") REFERENCES "Transaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" ("accountId", "amount", "areaNegocioId", "bienDeUsoId", "businessId", "cantidad", "categoryId", "contactId", "createdAt", "currency", "date", "description", "empleadoId", "esCredito", "estado", "exchangeRate", "fechaVencimiento", "id", "invoiceFileUrl", "invoiceNumber", "invoiceType", "linkedCreditoId", "precioUnitario", "productoId", "subType", "subcategoryId", "type", "updatedAt") SELECT "accountId", "amount", "areaNegocioId", "bienDeUsoId", "businessId", "cantidad", "categoryId", "contactId", "createdAt", "currency", "date", "description", "empleadoId", "esCredito", "estado", "exchangeRate", "fechaVencimiento", "id", "invoiceFileUrl", "invoiceNumber", "invoiceType", "linkedCreditoId", "precioUnitario", "productoId", "subType", "subcategoryId", "type", "updatedAt" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
CREATE INDEX "Transaction_businessId_date_createdAt_idx" ON "Transaction"("businessId", "date", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Operacion_businessId_date_idx" ON "Operacion"("businessId", "date");

-- CreateIndex
CREATE INDEX "OperacionItem_operacionId_idx" ON "OperacionItem"("operacionId");
