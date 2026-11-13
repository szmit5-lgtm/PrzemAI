CREATE TABLE "WhatsAppMessage" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "externalMessageId" TEXT NOT NULL,
  "phoneNumberId" TEXT NOT NULL,
  "contactWaId" TEXT NOT NULL,
  "direction" TEXT NOT NULL DEFAULT 'INBOUND',
  "messageType" TEXT NOT NULL,
  "text" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WhatsAppMessage_externalMessageId_key" ON "WhatsAppMessage"("externalMessageId");
CREATE INDEX "WhatsAppMessage_organizationId_receivedAt_idx" ON "WhatsAppMessage"("organizationId", "receivedAt");
CREATE INDEX "WhatsAppMessage_organizationId_contactWaId_receivedAt_idx" ON "WhatsAppMessage"("organizationId", "contactWaId", "receivedAt");
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
