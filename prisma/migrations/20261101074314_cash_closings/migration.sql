-- CreateTable
CREATE TABLE "CashClosing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "systemBalance" REAL NOT NULL,
    "countedBalance" REAL NOT NULL,
    "difference" REAL NOT NULL,
    "note" TEXT,
    "closedBy" TEXT,
    "adjustmentTransactionId" TEXT,
    "accountId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CashClosing_adjustmentTransactionId_fkey" FOREIGN KEY ("adjustmentTransactionId") REFERENCES "Transaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CashClosing_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CashClosing_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CashClosing_adjustmentTransactionId_key" ON "CashClosing"("adjustmentTransactionId");

-- CreateIndex
CREATE INDEX "CashClosing_businessId_date_idx" ON "CashClosing"("businessId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "CashClosing_businessId_accountId_date_key" ON "CashClosing"("businessId", "accountId", "date");
