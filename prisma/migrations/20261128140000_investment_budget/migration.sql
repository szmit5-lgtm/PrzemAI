CREATE TABLE "InvestmentBudget" (
    "investmentId" TEXT NOT NULL REFERENCES "OrganizationInvestment"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "year" INTEGER NOT NULL CHECK ("year" BETWEEN 2020 AND 2100),
    "currency" TEXT NOT NULL CHECK ("currency" ~ '^[A-Z]{3}$'),
    "plannedNet" DECIMAL(18,2),
    "forecastNet" DECIMAL(18,2),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    PRIMARY KEY ("investmentId", "year", "currency"),
    CHECK (COALESCE("plannedNet", 0) >= 0 AND COALESCE("forecastNet", 0) >= 0)
);
