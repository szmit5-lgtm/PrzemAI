-- CreateTable
CREATE TABLE "FinancialDocument" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT,
    "direction" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "invoiceNumber" TEXT,
    "ksefNumber" TEXT,
    "sellerName" TEXT,
    "sellerNip" TEXT,
    "buyerName" TEXT,
    "buyerNip" TEXT,
    "issueDate" TIMESTAMP(3),
    "saleDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'PLN',
    "netAmount" DECIMAL(18,2),
    "vatAmount" DECIMAL(18,2),
    "grossAmount" DECIMAL(18,2),
    "rawData" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,

    CONSTRAINT "FinancialDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinancialDocument_userId_source_externalId_key"
ON "FinancialDocument"("userId", "source", "externalId");

CREATE INDEX "FinancialDocument_userId_idx" ON "FinancialDocument"("userId");
CREATE INDEX "FinancialDocument_source_idx" ON "FinancialDocument"("source");
CREATE INDEX "FinancialDocument_status_idx" ON "FinancialDocument"("status");
CREATE INDEX "FinancialDocument_direction_idx" ON "FinancialDocument"("direction");
CREATE INDEX "FinancialDocument_sellerNip_idx" ON "FinancialDocument"("sellerNip");
CREATE INDEX "FinancialDocument_buyerNip_idx" ON "FinancialDocument"("buyerNip");
CREATE INDEX "FinancialDocument_issueDate_idx" ON "FinancialDocument"("issueDate");
CREATE INDEX "FinancialDocument_dueDate_idx" ON "FinancialDocument"("dueDate");
CREATE INDEX "FinancialDocument_projectId_idx" ON "FinancialDocument"("projectId");

-- AddForeignKey
ALTER TABLE "FinancialDocument"
ADD CONSTRAINT "FinancialDocument_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FinancialDocument"
ADD CONSTRAINT "FinancialDocument_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
