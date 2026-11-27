ALTER TABLE "FinancialDocument" ADD COLUMN "invoiceType" TEXT;

CREATE TABLE "InvoicePayment" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "invoiceId" TEXT NOT NULL REFERENCES "FinancialDocument"("id") ON DELETE NO ACTION ON UPDATE CASCADE,
  "bankTransactionId" TEXT NOT NULL UNIQUE REFERENCES "BankTransaction"("id") ON DELETE NO ACTION ON UPDATE CASCADE,
  "confirmedById" TEXT NOT NULL,
  "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "InvoicePayment_organizationId_invoiceId_idx" ON "InvoicePayment"("organizationId","invoiceId");

CREATE TABLE "InvoiceCorrection" (
  "correctionId" TEXT PRIMARY KEY REFERENCES "FinancialDocument"("id") ON DELETE NO ACTION ON UPDATE CASCADE,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "invoiceId" TEXT NOT NULL REFERENCES "FinancialDocument"("id") ON DELETE NO ACTION ON UPDATE CASCADE,
  "confirmedById" TEXT NOT NULL,
  "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ("invoiceId" <> "correctionId")
);
CREATE INDEX "InvoiceCorrection_organizationId_invoiceId_idx" ON "InvoiceCorrection"("organizationId","invoiceId");
