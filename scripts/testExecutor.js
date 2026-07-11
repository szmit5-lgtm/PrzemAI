const AgentRegistry = require("../core/registry/AgentRegistry");
const Executor = require("../core/executor/Executor");
const MailAgent = require("../agents/mail/MailAgent");

(async () => {

    const registry = new AgentRegistry();

    registry.register("MAIL", new MailAgent());

    const executor = new Executor(registry);

    const result = await executor.execute(
        [
            {
                agent: "MAIL",
                action: "write"
            }
        ],
        "Napisz maila z podziękowaniem za spotkanie."
    );

    console.log(result);

})();