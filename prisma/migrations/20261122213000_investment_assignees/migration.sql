ALTER TABLE "OrganizationInvestment" ADD COLUMN "assignedUserIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
