-- Personal MT5 snapshots, isolated by authenticated userId, not by company.
CREATE TABLE "PersonalMt5Snapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'MT5_LOCAL',
    "mode" TEXT NOT NULL DEFAULT 'REAL',
    "currency" VARCHAR(3) NOT NULL,
    "balance" DECIMAL(20,5) NOT NULL,
    "equity" DECIMAL(20,5) NOT NULL,
    "positionCount" INTEGER NOT NULL,
    "positions" JSONB NOT NULL,
    CONSTRAINT "PersonalMt5Snapshot_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PersonalMt5Snapshot_userId_capturedAt_key" ON "PersonalMt5Snapshot"("userId", "capturedAt");
CREATE INDEX "PersonalMt5Snapshot_userId_receivedAt_idx" ON "PersonalMt5Snapshot"("userId", "receivedAt");
ALTER TABLE "PersonalMt5Snapshot" ADD CONSTRAINT "PersonalMt5Snapshot_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
