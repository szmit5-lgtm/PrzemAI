-- Additive company investment register; deliberately no financial-document access.
CREATE TABLE "OrganizationInvestment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT,
    "name" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NOT_SET',
    "progress" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrganizationInvestment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrganizationInvestment_organizationId_name_key"
  ON "OrganizationInvestment"("organizationId", "name");
CREATE INDEX "OrganizationInvestment_organizationId_status_idx"
  ON "OrganizationInvestment"("organizationId", "status");
ALTER TABLE "OrganizationInvestment"
  ADD CONSTRAINT "OrganizationInvestment_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationInvestment"
  ADD CONSTRAINT "OrganizationInvestment_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Owner explicitly requested two shared Dekonica investments for the team.
-- Seed reference entries with no invented progress, costs, dates or financial data.
INSERT INTO "OrganizationInvestment" ("id", "organizationId", "name", "description", "status", "source")
SELECT 'orginv_' || substr(md5(o.id || ':mielno'), 1, 25), o.id,
       'Mielno', 'Przedszkole i żłobek — wpis startowy do uzupełnienia przez zespół',
       'NOT_SET', 'INITIAL_REFERENCE'
FROM "Organization" o
WHERE o.status = 'ACTIVE' AND
      (lower(o.slug) LIKE '%dekonica%' OR lower(o.name) LIKE '%dekonica%')
ON CONFLICT ("organizationId", "name") DO NOTHING;

INSERT INTO "OrganizationInvestment" ("id", "organizationId", "name", "description", "status", "source")
SELECT 'orginv_' || substr(md5(o.id || ':zgorzelec'), 1, 25), o.id,
       'Zgorzelec', 'Instalacje sanitarne — wpis startowy do uzupełnienia przez zespół',
       'NOT_SET', 'INITIAL_REFERENCE'
FROM "Organization" o
WHERE o.status = 'ACTIVE' AND
      (lower(o.slug) LIKE '%dekonica%' OR lower(o.name) LIKE '%dekonica%')
ON CONFLICT ("organizationId", "name") DO NOTHING;
