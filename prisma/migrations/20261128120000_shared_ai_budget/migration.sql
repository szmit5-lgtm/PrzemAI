ALTER TABLE "OpenAIMonthlyBudget"
ADD COLUMN "claudeReservedMicroPln" BIGINT NOT NULL DEFAULT 0,
ADD CONSTRAINT "AiBudget_provider_and_total_limits" CHECK (
    "reservedMicroPln" >= 0 AND "claudeReservedMicroPln" BETWEEN 0 AND 50000000
    AND "reservedMicroPln" <= 200000000 - "claudeReservedMicroPln"
);
