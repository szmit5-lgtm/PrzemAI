const BrowserManager = require("./browser/BrowserManager");
const AIEngine = require("./ai/AIEngine");
const MemoryEngine = require("./memory/MemoryEngine");
const Logger = require("./logger/Logger");

class BaseAgent {

    constructor(name) {

        this.name = name;

        this.browser = new BrowserManager();

        this.ai = new AIEngine();

        this.memory = new MemoryEngine();

        this.logger = new Logger();

    }

    async start() {

        this.logger.info(`${this.name} started`);

        await this.browser.start();

    }

    async finish() {

        this.logger.info(`${this.name} finished`);

        await this.browser.close();

    }

}

module.exports = BaseAgent;