const { ImapFlow } = require("imapflow");
const { simpleParser } = require("mailparser");

class HomePlMailConnector {
    constructor(config) {
        this.config = config;
    }

    createClient() {
        // Never resolve arbitrary environment variables supplied by a
        // database-backed integration. That would let a forged mailbox
        // configuration send e.g. JWT_SECRET to an attacker-controlled IMAP.
        const mailbox = typeof this.config?.email === "string"
            ? this.config.email.trim().toLowerCase()
            : "";
        if (mailbox !== "office@dekonica.com" ||
            this.config?.passwordEnv !== "DEKONICA_MAIL_PASSWORD") {
            throw new Error("Mailbox credentials are not provisioned.");
        }

        const password = process.env.DEKONICA_MAIL_PASSWORD;
        if (!password) {
            throw new Error("Mailbox credentials are not provisioned.");
        }

        // IMAP destination is set by trusted Railway configuration, never
        // by Integration.config. home.pl hosts vary by hosting account.
        const host = (process.env.DEKONICA_MAIL_IMAP_HOST || "dekonica.com").trim();
        if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(host)) {
            throw new Error("Mailbox server configuration is invalid.");
        }

        return new ImapFlow({
            host,
            port: 993,
            secure: true,
            tls: { servername: host, rejectUnauthorized: true },
            // Bound stalled IMAP handshakes and idle sockets on the worker.
            connectionTimeout: 20000,
            greetingTimeout: 15000,
            socketTimeout: 60000,
            auth: {
                user: this.config.email,
                pass: password
            },
            logger: false
        });
    }

    async fetchRecentMessages(limit = 30) {
        if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
            throw new Error("Mail fetch limit must be an integer from 1 to 50.");
        }
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
                        // Only attachment metadata is used by FinancialAgent.
                        // Do not retain potentially huge message bodies/buffers
                        // across the entire mailbox batch.
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
                                    0
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
