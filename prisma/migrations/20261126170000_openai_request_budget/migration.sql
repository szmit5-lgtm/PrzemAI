CREATE TABLE "OpenAIRequestBudget" (
    "day" DATE NOT NULL,
    "requests" INTEGER NOT NULL,
    CONSTRAINT "OpenAIRequestBudget_pkey" PRIMARY KEY ("day")
);
