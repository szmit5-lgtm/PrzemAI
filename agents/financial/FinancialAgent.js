const prisma = require("../../lib/prisma");
const HomePlMailConnector = require("../../connectors/mail/HomePlMailConnector");

class FinancialAgent {
    async run({ userId }) {
        const integrations = await prisma.integration.findMany({
            where: {
                userId,
                enabled: true
            }
        });

        const mailChecks = [];

        for (const integration of integrations) {
            if (
                integration.type === "MAIL" &&
                integration.provider === "HOME_PL"
            ) {
                const config = integration.config || {};
                const passwordEnv = config.passwordEnv;

                if (!passwordEnv || !process.env[passwordEnv]) {
                    mailChecks.push({
                        integrationId: integration.id,
                        name: integration.name,
                        status: "MISSING_SECRET"
                    });
                    continue;
                }

                const connector = new HomePlMailConnector({
                    email: config.email,
                    password: process.env[passwordEnv],
                    imapHost: config.imapHost,
                    imapPort: config.imapPort || 993
                });

                const result = await connector.checkInbox();

                mailChecks.push({
                    integrationId: integration.id,
                    name: integration.name,
                    status: "OK",
                    unread: result.unread
                });

                await prisma.integration.update({
                    where: { id: integration.id },
                    data: { lastSyncAt: new Date() }
                });
            }
        }

        return {
            summary: `Financial Agent sprawdził ${mailChecks.length} integracji.`,
            metadata: {
                mailChecks
            }
        };
    }
}

module.exports = FinancialAgent;
