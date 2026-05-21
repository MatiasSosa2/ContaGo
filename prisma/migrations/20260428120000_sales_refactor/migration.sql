-- AddColumn: Producto.tipo (MERCADERIA | SERVICIO)
ALTER TABLE "Producto" ADD COLUMN "tipo" TEXT NOT NULL DEFAULT 'MERCADERIA';

-- AddColumn: Transaction.bienDeUsoId + linkedCreditoId
ALTER TABLE "Transaction" ADD COLUMN "bienDeUsoId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "linkedCreditoId" TEXT;

-- CreateTable: BienDeUso (activos fijos)
CREATE TABLE "BienDeUso" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "categoria" TEXT,
    "marca" TEXT,
    "valorAdquisicion" REAL NOT NULL DEFAULT 0,
    "valorResidual" REAL NOT NULL DEFAULT 0,
    "fechaAdquisicion" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vidaUtilMeses" INTEGER,
    "depreciacionAcumulada" REAL NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "businessId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BienDeUso_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "BienDeUso_businessId_activo_idx" ON "BienDeUso"("businessId", "activo");

-- RedefineTables: Transaction (agregar FKs a BienDeUso y self-FK linkedCredito)
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
    CONSTRAINT "Transaction_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_areaNegocioId_fkey" FOREIGN KEY ("areaNegocioId") REFERENCES "AreaNegocio" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_bienDeUsoId_fkey" FOREIGN KEY ("bienDeUsoId") REFERENCES "BienDeUso" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_linkedCreditoId_fkey" FOREIGN KEY ("linkedCreditoId") REFERENCES "Transaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" (
    "id","description","amount","currency","exchangeRate","date","type","esCredito","estado","fechaVencimiento",
    "invoiceType","invoiceNumber","invoiceFileUrl","accountId","categoryId","contactId","areaNegocioId",
    "subType","productoId","cantidad","precioUnitario","bienDeUsoId","linkedCreditoId","empleadoId",
    "businessId","createdAt","updatedAt"
)
SELECT
    "id","description","amount","currency","exchangeRate","date","type","esCredito","estado","fechaVencimiento",
    "invoiceType","invoiceNumber","invoiceFileUrl","accountId","categoryId","contactId","areaNegocioId",
    "subType","productoId","cantidad","precioUnitario","bienDeUsoId","linkedCreditoId","empleadoId",
    "businessId","createdAt","updatedAt"
FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
CREATE INDEX "Transaction_businessId_date_createdAt_idx" ON "Transaction"("businessId", "date", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
