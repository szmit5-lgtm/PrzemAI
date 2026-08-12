-- CreateTable
CREATE TABLE "Memory" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "importance" INTEGER NOT NULL DEFAULT 3,
    "tags" TEXT[],
    "metadata" JSONB,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Memory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Memory_userId_idx" ON "Memory"("userId");

-- CreateIndex
CREATE INDEX "Memory_type_idx" ON "Memory"("type");

-- CreateIndex
CREATE INDEX "Memory_source_idx" ON "Memory"("source");

-- CreateIndex
CREATE INDEX "Memory_importance_idx" ON "Memory"("importance");

-- CreateIndex
CREATE INDEX "Memory_archivedAt_idx" ON "Memory"("archivedAt");

-- CreateIndex
CREATE INDEX "Memory_createdAt_idx" ON "Memory"("createdAt");

-- AddForeignKey
ALTER TABLE "Memory" ADD CONSTRAINT "Memory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
