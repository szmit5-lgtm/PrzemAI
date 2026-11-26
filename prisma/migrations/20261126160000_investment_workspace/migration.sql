ALTER TABLE "Task" ADD COLUMN "investmentId" TEXT;
ALTER TABLE "OrganizationDocument"
    ADD COLUMN "investmentId" TEXT,
    ADD COLUMN "isInvestmentReport" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Task_investmentId_idx" ON "Task"("investmentId");
CREATE INDEX "OrganizationDocument_investmentId_createdAt_idx"
    ON "OrganizationDocument"("investmentId", "createdAt");

ALTER TABLE "Task" ADD CONSTRAINT "Task_investmentId_fkey"
    FOREIGN KEY ("investmentId") REFERENCES "OrganizationInvestment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrganizationDocument" ADD CONSTRAINT "OrganizationDocument_investmentId_fkey"
    FOREIGN KEY ("investmentId") REFERENCES "OrganizationInvestment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
