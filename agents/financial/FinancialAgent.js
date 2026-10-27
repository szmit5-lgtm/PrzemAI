const prisma = require("../../lib/prisma");

class FinancialAgent {
  async run({ userId }) {
    const integrations = await prisma.integration.findMany({
      where: { userId, enabled: true }
    });

    return {
      summary: "Financial Agent uruchomiony poprawnie.",
      metadata: {
        enabledIntegrations: integrations.length
      }
    };
  }
}

module.exports = FinancialAgent;
