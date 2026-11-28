CREATE TABLE "OrganizationMemory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "investmentId" TEXT,
    "kind" TEXT NOT NULL,
    "counterparty" TEXT,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrganizationMemory_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OrganizationMemory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrganizationMemory_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "OrganizationInvestment"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OrganizationMemory_kind_check" CHECK ("kind" IN ('DECISION', 'AGREEMENT'))
);
CREATE INDEX "OrganizationMemory_organizationId_updatedAt_idx" ON "OrganizationMemory"("organizationId", "updatedAt");
CREATE INDEX "OrganizationMemory_investmentId_idx" ON "OrganizationMemory"("investmentId");
