const { ImapFlow } = require("imapflow");
const { simpleParser } = require("mailparser");

class HomePlMailConnector {
    constructor(config) {
        this.config = config;
    }

    createClient() {
        const secretName = this.config.passwordEnv;
        const password = secretName
            ? process.env[secretName]
            : null;

        if (!password) {
            throw new Error(
                `Brak sekretu Railway: ${secretName || "MAIL_PASSWORD"}`
            );
        }

        return new ImapFlow({
            host: this.config.imapHost,
            port: Number(this.config.imapPort || 993),
            secure: true,
            auth: {
                user: this.config.email,
                pass: password
            },
            logger: false
        });
    }

    async fetchRecentMessages(limit = 30) {
        const client = this.createClient();

        try {
            await client.connect();

            const lock = await client.getMailboxLock("INBOX");

            try {
                const total = client.mailbox.exists || 0;
                const uidValidity = client.mailbox.uidValidity?.toString() || null;

                if (!total) {
                    return [];
                }

                const start = Math.max(1, total - limit + 1);
                const messages = [];

                for await (
                    const message of client.fetch(
                        `${start}:*`,
                        {
                            uid: true,
                            envelope: true,
                            source: true,
                            internalDate: true
                        }
                    )
                ) {
                    const parsed = await simpleParser(message.source);

                    messages.push({
                        uid: message.uid,
                        uidValidity,
                        messageId: parsed.messageId || null,
                        subject: parsed.subject || "",
                        from:
                            parsed.from?.value?.[0]?.address ||
                            "",
                        date:
                            parsed.date ||
                            message.internalDate ||
                            null,
                        text: parsed.text || "",
                        attachments: (parsed.attachments || []).map(
                            attachment => ({
                                filename:
                                    attachment.filename ||
                                    "attachment",
                                contentType:
                                    attachment.contentType,
                                size:
                                    attachment.size ||
                                    attachment.content?.length ||
                                    0,
                                content:
                                    attachment.content
                            })
                        )
                    });
                }

                return messages;
            }
            finally {
                lock.release();
            }
        }
        finally {
            await client.logout().catch(() => {});
        }
    }
}

module.exports = HomePlMailConnector;
