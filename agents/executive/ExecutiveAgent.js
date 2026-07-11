const BaseAgent = require("../../core/BaseAgent");

const IntentClassifier = require("../../core/classifier/IntentClassifier");
const Planner = require("../../core/planner/Planner");
const Executor = require("../../core/executor/Executor");
const Bootstrap = require("../../core/bootstrap/Bootstrap");

class ExecutiveAgent extends BaseAgent {

    constructor() {

        super("Executive");

        this.classifier = new IntentClassifier(this.ai);

        this.registry = Bootstrap.createRegistry();

        this.planner = new Planner();

        this.executor = new Executor(this.registry);

    }

    async process(text) {

        this.logger.info("Nowe polecenie: " + text);

        const intent = await this.classifier.classify(text);

        this.logger.info(JSON.stringify(intent));

        const plan = this.planner.createPlan(intent);

        this.logger.info(JSON.stringify(plan));

        const answer = await this.executor.execute(plan, text);

        this.memory.saveConversation(text, answer);

        return answer;

    }

}

module.exports = ExecutiveAgent;