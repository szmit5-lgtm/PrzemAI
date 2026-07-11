const BaseAgent = require("../../core/BaseAgent");

class GeneralAgent extends BaseAgent {

    constructor() {
        super("General");
    }

    async chat(prompt) {

        return await this.ai.ask(prompt);

    }

}

module.exports = GeneralAgent;