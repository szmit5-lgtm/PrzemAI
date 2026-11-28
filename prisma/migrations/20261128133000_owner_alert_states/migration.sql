CREATE TABLE "OwnerAlertState" (
    "userId" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "snoozedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OwnerAlertState_pkey" PRIMARY KEY ("userId", "alertId"),
    CONSTRAINT "OwnerAlertState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OwnerAlertState_valid_status" CHECK (
        ("status" = 'SNOOZED' AND "snoozedUntil" IS NOT NULL)
        OR ("status" IN ('ACKNOWLEDGED', 'CLOSED') AND "snoozedUntil" IS NULL)
    )
);
