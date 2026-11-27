ALTER TABLE "ChatConversation" ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'WEB';

CREATE TABLE "TelegramChatSelection" (
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "telegramUserId" TEXT NOT NULL,
    "organizationId" TEXT,
    CONSTRAINT "TelegramChatSelection_pkey" PRIMARY KEY ("userId", "telegramUserId")
);

CREATE TABLE "TelegramChatReceipt" (
    "telegramUserId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TelegramChatReceipt_pkey" PRIMARY KEY ("telegramUserId", "messageId")
);

CREATE INDEX "TelegramChatReceipt_userId_idx" ON "TelegramChatReceipt"("userId");
