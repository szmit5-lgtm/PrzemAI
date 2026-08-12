-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL,
    "memoryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "historyEnabled" BOOLEAN NOT NULL DEFAULT true,
    "executiveMode" BOOLEAN NOT NULL DEFAULT true,
    "aiModel" TEXT NOT NULL DEFAULT 'gpt-5.5',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- CreateIndex
CREATE INDEX "UserSettings_userId_idx" ON "UserSettings"("userId");

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
