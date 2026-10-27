const prisma = require("../../lib/prisma");
const HomePlMailConnector = require("../../connectors/mail/HomePlMailConnector");
const mailDocumentId = require("../../lib/mailDocumentId");

class FinancialAgent {
    async run({ userId }) {
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

        for (const integration of integrations) {
            const connector = new HomePlMailConnector(
                integration.config || {}
            );

            const messages =
                await connector.fetchRecentMessages(30);

            checkedMessages += messages.length;

            for (const message of messages) {
                for (const [attachmentIndex, attachment] of
                    message.attachments.entries()) {
                    const filename =
                        attachment.filename || "attachment";

                    const lower =
                        filename.toLowerCase();

                    const supported =
                        lower.endsWith(".pdf") ||
                        lower.endsWith(".xml");

                    if (!supported) {
                        continue;
                    }

                    const externalId = mailDocumentId({
                        integrationId: integration.id,
                        messageId: message.messageId,
                        uid: message.uid,
                        uidValidity: message.uidValidity,
                        filename,
                        attachmentIndex
                    });

                    // The unique (userId, source, externalId) index is
                    // the concurrency-safe deduplication mechanism.
                    try {
                            await prisma.financialDocument.create({
                            data: {
                                userId,
                                source: "MAIL",
                                externalId,
                                status: "NEW",
                                issueDate: message.date
                                    ? new Date(message.date)
                                    : null,
                                rawData: {
                                    mailbox: integration.name,
                                    subject: message.subject,
                                    from: message.from,
                                    messageId: message.messageId,
                                    uid: message.uid,
                                    uidValidity: message.uidValidity,
                                    filename,
                                    contentType:
                                        attachment.contentType,
                                    size:
                                        attachment.size
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
                where: {
                    id: integration.id
                },
                data: {
                    lastSyncAt: new Date()
                }
            });
        }

        const summary =
            `Financial Agent: wiadomości ${checkedMessages}, nowe dokumenty ${newDocuments}.`;

        console.log("[FinancialAgent]", summary);

        return {
            summary,
            metadata: {
                integrations: integrations.length,
                checkedMessages,
                newDocuments
            }
        };
    }
}

module.exports = FinancialAgent;
