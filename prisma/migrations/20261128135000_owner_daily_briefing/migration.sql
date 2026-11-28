CREATE TABLE "OwnerBriefingSchedule" (
    "userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "localTime" TEXT NOT NULL CHECK ("localTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);
CREATE TABLE "OwnerDailyBriefing" (
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "day" DATE NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "snapshot" JSONB,
    PRIMARY KEY ("userId", "day")
);
