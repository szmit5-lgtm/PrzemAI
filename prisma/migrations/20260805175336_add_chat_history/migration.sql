-- CreateTable
CREATE TABLE "ChatConversation" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Nowa rozmowa',
    "archivedAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ChatConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversationId" TEXT NOT NULL,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatConversation_userId_idx" ON "ChatConversation"("userId");

-- CreateIndex
CREATE INDEX "ChatConversation_userId_lastMessageAt_idx" ON "ChatConversation"("userId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "ChatConversation_archivedAt_idx" ON "ChatConversation"("archivedAt");

-- CreateIndex
CREATE INDEX "ChatMessage_conversationId_idx" ON "ChatMessage"("conversationId");

-- CreateIndex
CREATE INDEX "ChatMessage_conversationId_createdAt_idx" ON "ChatMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "History_type_idx" ON "History"("type");

-- CreateIndex
CREATE INDEX "History_createdAt_idx" ON "History"("createdAt");

-- AddForeignKey
ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
