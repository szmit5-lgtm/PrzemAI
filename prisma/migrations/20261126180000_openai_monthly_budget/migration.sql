CREATE TABLE "OpenAIMonthlyBudget" (
    "month" DATE NOT NULL,
    "reservedMicroPln" BIGINT NOT NULL CHECK ("reservedMicroPln" >= 0 AND "reservedMicroPln" <= 200000000),
    CONSTRAINT "OpenAIMonthlyBudget_pkey" PRIMARY KEY ("month")
);
