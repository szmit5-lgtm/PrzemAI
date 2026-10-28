"use strict";

const prisma = require("../../lib/prisma");
const HomePlMailConnector = require("../../connectors/mail/HomePlMailConnector");
const mailDocumentId = require("../../lib/mailDocumentId");
const { canSyncMailIntegration } = require("../../lib/mailAccessPolicy");

class FinancialAgent {
  async run({ userId } = {}) {
    // Prisma omits undefined filters. Never allow a missing userId to
    // turn a tenant-scoped mailbox lookup into a cross-user query.
    if (typeof userId !== "string" || !userId.trim() || userId !== userId.trim()) {
      throw new Error("Financial Agent requires an authenticated user ID.");
    }

    const integrations = await prisma.integration.findMany({
      where: {
        userId,
        enabled: true,
        type: "MAIL",
        provider: "HOME_PL"
      }
    });

    let checkedMessages = 0;
    let newDocuments = 0;
    let blockedIntegrations = 0;
    let failedIntegrations = 0;

    for (const integration of integrations) {
      // Defense in depth: also reject pre-existing enabled integrations
      // created before the provisioning policy was tightened.
      if (!canSyncMailIntegration(userId, integration)) {
        blockedIntegrations += 1;
        console.warn("[FinancialAgent] Blocked unauthorized shared mailbox integration");
        continue;
      }
      try {
      const connector = new HomePlMailConnector(integration.config || {});
      const messages = await connector.fetchRecentMessages(30);
      checkedMessages += messages.length;

      for (const message of messages) {
        for (const [attachmentIndex, attachment] of
          message.attachments.entries()) {
          const filename = attachment.filename || "attachment";
          const lower = filename.toLowerCase();
          if (!lower.endsWith(".pdf") && !lower.endsWith(".xml")) continue;

          const externalId = mailDocumentId({
            integrationId: integration.id,
            messageId: message.messageId,
            uid: message.uid,
            uidValidity: message.uidValidity,
            filename,
            attachmentIndex
          });

          // An email timestamp is NOT the invoice issue date. Keep it as
          // provenance metadata until an actual invoice parser verifies it.
          const receivedDate = message.date ? new Date(message.date) : null;
          const receivedAt = receivedDate && Number.isFinite(receivedDate.getTime())
            ? receivedDate.toISOString() : null;

          // Unique (userId, source, externalId) guarantees idempotency
          // even when two workers try to import the same attachment.
          try {
            await prisma.financialDocument.create({
              data: {
                userId,
                source: "MAIL",
                externalId,
                status: "NEW",
                issueDate: null,
                rawData: {
                  mailbox: integration.name,
                  receivedAt,
                  subject: message.subject,
                  from: message.from,
                  messageId: message.messageId,
                  uid: message.uid,
                  uidValidity: message.uidValidity,
                  filename,
                  contentType: attachment.contentType,
                  size: attachment.size
                }
              }
            });
            newDocuments += 1;
          } catch (error) {
            if (error?.code !== "P2002") throw error;
          }
        }
      }

      await prisma.integration.update({
        where: { id: integration.id },
        data: { lastSyncAt: new Date() }
      });
      } catch {
        // A failing mailbox must not prevent other authorized mailboxes
        // from importing. Never log upstream IMAP errors: they can contain
        // credentials or message details. Do not advance lastSyncAt.
        failedIntegrations += 1;
        console.warn("[FinancialAgent] Mailbox synchronization failed");
      }
    }

    const summary =
      `Financial Agent: wiadomości ${checkedMessages}, nowe dokumenty ${newDocuments}, zablokowane integracje ${blockedIntegrations}, błędne synchronizacje ${failedIntegrations}.`;
    console.log("[FinancialAgent]", summary);

    // Preserve a failed run status and the retry schedule in AgentRunner,
    // while allowing healthy integrations to finish first.
    if (failedIntegrations > 0) {
      throw new Error(`Financial Agent: ${failedIntegrations} mailbox synchronization(s) failed.`);
    }

    return {
      summary,
      metadata: {
        integrations: integrations.length,
        checkedMessages,
        newDocuments,
        blockedIntegrations,
        failedIntegrations
      }
    };
  }
}

module.exports = FinancialAgent;
