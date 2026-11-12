-- Tenant-scoped bank accounts and validated statement imports.
CREATE TABLE "BankAccount" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "iban" TEXT NOT NULL,
  "label" TEXT,
  "accountType" TEXT NOT NULL DEFAULT 'CURRENT',
  "currency" TEXT NOT NULL DEFAULT 'PLN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "BankAccount_organizationId_iban_key" ON "BankAccount"("organizationId","iban");
CREATE INDEX "BankAccount_organizationId_idx" ON "BankAccount"("organizationId");

CREATE TABLE "BankStatement" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "bankAccountId" TEXT NOT NULL REFERENCES "BankAccount"("id") ON DELETE CASCADE,
  "statementNumber" TEXT NOT NULL,
  "sourceHash" TEXT NOT NULL,
  "openingBalance" DECIMAL(18,2) NOT NULL,
  "closingBalance" DECIMAL(18,2) NOT NULL,
  "periodStart" TIMESTAMP(3),
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "importedByUserId" TEXT NOT NULL,
  "transactionCount" INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX "BankStatement_organizationId_sourceHash_bankAccountId_statementNumber_key" ON "BankStatement"("organizationId","sourceHash","bankAccountId","statementNumber");
CREATE INDEX "BankStatement_organizationId_bankAccountId_periodEnd_idx" ON "BankStatement"("organizationId","bankAccountId","periodEnd");

CREATE TABLE "BankTransaction" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "bankAccountId" TEXT NOT NULL REFERENCES "BankAccount"("id") ON DELETE CASCADE,
  "bankStatementId" TEXT NOT NULL REFERENCES "BankStatement"("id") ON DELETE CASCADE,
  "fingerprint" TEXT NOT NULL,
  "bookedAt" TIMESTAMP(3) NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "balanceAfter" DECIMAL(18,2),
  "description" TEXT NOT NULL DEFAULT '',
  "counterparty" TEXT,
  "reference" TEXT,
  "externalId" TEXT,
  "reviewStatus" TEXT NOT NULL DEFAULT 'UNMATCHED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "BankTransaction_organizationId_bankStatementId_fingerprint_key" ON "BankTransaction"("organizationId","bankStatementId","fingerprint");
CREATE INDEX "BankTransaction_organizationId_bookedAt_idx" ON "BankTransaction"("organizationId","bookedAt");
CREATE INDEX "BankTransaction_organizationId_bankAccountId_bookedAt_idx" ON "BankTransaction"("organizationId","bankAccountId","bookedAt");
