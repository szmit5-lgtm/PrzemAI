const AgentRegistry = require("../registry/AgentRegistry");

const GeneralAgent = require("../../agents/general/GeneralAgent");
const MeetingAgent = require("../../agents/meeting/MeetingAgent");
const MailAgent = require("../../agents/mail/MailAgent");
const DocumentAgent = require("../../agents/document/DocumentAgent");

// Tymczasowo używamy GeneralAgent jako placeholder
// Docelowo każdy z tych agentów będzie miał własną klasę.
const LegalAgent = require("../../agents/general/GeneralAgent");
const FinanceAgent = require("../../agents/general/GeneralAgent");
const ShoppingAgent = require("../../agents/general/GeneralAgent");

class Bootstrap {

    static createRegistry() {

        const registry = new AgentRegistry();

        registry.register("GENERAL", new GeneralAgent());
        registry.register("MEETING", new MeetingAgent());
        registry.register("MAIL", new MailAgent());
        registry.register("DOCUMENT", new DocumentAgent());

        registry.register("LEGAL", new LegalAgent());
        registry.register("FINANCE", new FinanceAgent());
        registry.register("SHOPPING", new ShoppingAgent());

        return registry;

    }

}

module.exports = Bootstrap;