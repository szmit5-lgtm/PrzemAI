const AgentRegistry = require("../registry/AgentRegistry");

const MailAgent = require("../../agents/mail/MailAgent");
const MeetingAgent = require("../../agents/meeting/MeetingAgent");
const GeneralAgent = require("../../agents/general/GeneralAgent");

class Bootstrap {

    static createRegistry() {

        const registry = new AgentRegistry();

        registry.register("MAIL", new MailAgent());
        registry.register("MEETING", new MeetingAgent());
        registry.register("GENERAL", new GeneralAgent());

        return registry;

    }

}

module.exports = Bootstrap;