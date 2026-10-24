-- CreateTable
CREATE TABLE "MercadoPagoConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mpUserId" TEXT NOT NULL,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "lastSyncAt" DATETIME,
    "connectedByUserId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MercadoPagoConnection_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MercadoPagoPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mpPaymentId" TEXT NOT NULL,
    "amountGross" REAL NOT NULL,
    "feeAmount" REAL NOT NULL DEFAULT 0,
    "amountNet" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "dateApproved" DATETIME NOT NULL,
    "description" TEXT,
    "paymentMethod" TEXT,
    "payerEmail" TEXT,
    "importStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "transactionId" TEXT,
    "businessId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MercadoPagoPayment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MercadoPagoPayment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "MercadoPagoConnection_businessId_key" ON "MercadoPagoConnection"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "MercadoPagoPayment_transactionId_key" ON "MercadoPagoPayment"("transactionId");

-- CreateIndex
CREATE INDEX "MercadoPagoPayment_businessId_importStatus_idx" ON "MercadoPagoPayment"("businessId", "importStatus");

-- CreateIndex
CREATE UNIQUE INDEX "MercadoPagoPayment_businessId_mpPaymentId_key" ON "MercadoPagoPayment"("businessId", "mpPaymentId");
