const prisma = require("../../lib/prisma");
const HomePlMailConnector = require("../../connectors/mail/HomePlMailConnector");

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
                for (const attachment of message.attachments) {
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

                    const externalId = [
                        message.messageId ||
                            `uid-${message.uid}`,
                        filename
                    ].join(":");

                    const exists =
                        await prisma.financialDocument.findFirst({
                            where: {
                                userId,
                                source: "MAIL",
                                externalId
                            },
                            select: {
                                id: true
                            }
                        });

                    if (exists) {
                        continue;
                    }

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
                                filename,
                                contentType:
                                    attachment.contentType,
                                size:
                                    attachment.size
                            }
                        }
                    });

                    newDocuments += 1;
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

        return {
            summary:
                `Financial Agent: wiadomości ${checkedMessages}, nowe dokumenty ${newDocuments}.`,
            metadata: {
                integrations: integrations.length,
                checkedMessages,
                newDocuments
            }
        };
    }
}

module.exports = FinancialAgent;
