-- Additive only: legacy user-owned projects remain private until explicitly mapped.
ALTER TABLE "Project" ADD COLUMN "organizationId" TEXT;
CREATE INDEX "Project_organizationId_idx" ON "Project"("organizationId");
ALTER TABLE "Project" ADD CONSTRAINT "Project_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
