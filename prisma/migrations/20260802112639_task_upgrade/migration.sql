-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "owner" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "tags" TEXT[];

-- CreateIndex
CREATE INDEX "Task_source_idx" ON "Task"("source");

-- CreateIndex
CREATE INDEX "Task_dueDate_idx" ON "Task"("dueDate");
