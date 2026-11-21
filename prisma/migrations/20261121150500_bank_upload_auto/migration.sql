-- One-step bank uploads, preserving original file and transparent extraction status.
-- A CSV transaction export may not contain official statement balances; NULL
-- represents unknown, never zero. Existing statements remain unchanged.
ALTER TABLE "BankStatement" ALTER COLUMN "openingBalance" DROP NOT NULL;
ALTER TABLE "BankStatement" ALTER COLUMN "closingBalance" DROP NOT NULL;
ALTER TABLE "BankStatement" ADD COLUMN "sourceType" TEXT NOT NULL DEFAULT 'STATEMENT';

CREATE TABLE "BankImportFile" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "uploadedById" TEXT,
  "name" VARCHAR(255) NOT NULL,
  "mimeType" VARCHAR(80) NOT NULL,
  "size" INTEGER NOT NULL,
  "sha256" VARCHAR(64) NOT NULL,
  "content" BYTEA NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PROCESSING',
  "note" TEXT,
  "transactionCount" INTEGER NOT NULL DEFAULT 0,
  "parsedRows" JSONB,
  "statementId" TEXT,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BankImportFile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BankImportFile_organizationId_sha256_key" ON "BankImportFile"("organizationId","sha256");
CREATE INDEX "BankImportFile_organizationId_uploadedAt_idx" ON "BankImportFile"("organizationId","uploadedAt");
ALTER TABLE "BankImportFile" ADD CONSTRAINT "BankImportFile_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankImportFile" ADD CONSTRAINT "BankImportFile_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
