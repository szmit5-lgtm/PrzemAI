ALTER TABLE "Task" ADD COLUMN "investmentScoped" BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE "Task" SET "investmentScoped" = TRUE WHERE "investmentId" IS NOT NULL;
