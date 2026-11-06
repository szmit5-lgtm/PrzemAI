-- Additive owner-scoped financial pilot binding. Do not modify old invoices.
ALTER TABLE "OrganizationMembership"
  ADD COLUMN "financeAccess" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "OrganizationFinanceLink" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "nip" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationFinanceLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationFinanceLink_organizationId_key"
  ON "OrganizationFinanceLink"("organizationId");
CREATE UNIQUE INDEX "OrganizationFinanceLink_ownerUserId_nip_key"
  ON "OrganizationFinanceLink"("ownerUserId", "nip");
CREATE INDEX "OrganizationFinanceLink_ownerUserId_idx"
  ON "OrganizationFinanceLink"("ownerUserId");
CREATE INDEX "OrganizationFinanceLink_nip_idx"
  ON "OrganizationFinanceLink"("nip");

ALTER TABLE "OrganizationFinanceLink" ADD CONSTRAINT
  "OrganizationFinanceLink_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganizationFinanceLink" ADD CONSTRAINT
  "OrganizationFinanceLink_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
