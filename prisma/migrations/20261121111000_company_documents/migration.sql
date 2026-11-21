-- Additive migration: durable, organization-scoped documents.
-- No existing personal document or finance tables are changed.
CREATE TABLE "OrganizationDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "uploadedById" TEXT,
    "name" VARCHAR(255) NOT NULL,
    "contentType" VARCHAR(120) NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "content" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrganizationDocument_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrganizationDocument_organizationId_sha256_key" ON "OrganizationDocument"("organizationId","sha256");
CREATE INDEX "OrganizationDocument_organizationId_createdAt_idx" ON "OrganizationDocument"("organizationId","createdAt");
ALTER TABLE "OrganizationDocument" ADD CONSTRAINT "OrganizationDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationDocument" ADD CONSTRAINT "OrganizationDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
