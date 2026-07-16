const BaseAgent = require("../../core/BaseAgent");

const IntentClassifier = require("../../core/classifier/IntentClassifier");
const Planner = require("../../core/planner/Planner");
const Executor = require("../../core/executor/Executor");
const Bootstrap = require("../../core/bootstrap/Bootstrap");

const FactExtractor = require("../../core/memory/FactExtractor");
const KnowledgeService = require("../../core/knowledge/KnowledgeService");

class ExecutiveAgent extends BaseAgent {

    constructor() {

        super("Executive");

        this.classifier = new IntentClassifier(this.ai);

        this.registry = Bootstrap.createRegistry();

        this.planner = new Planner();

        this.executor = new Executor(this.registry);

        this.factExtractor = new FactExtractor();

        this.knowledge = new KnowledgeService();

    }

    async process(text) {

        this.logger.info("Nowe polecenie: " + text);

        // ==========================================
        // ZAPIS FAKTÓW
        // ==========================================

        const facts = this.factExtractor.extract(text);

        for (const fact of facts) {

            this.memory.saveFact(
                fact.name,
                fact.value
            );

        }

        // ==========================================
        // ODPOWIEDŹ Z WIEDZY
        // ==========================================

        const knowledgeAnswer =
            this.knowledge.answer(text);

        if (knowledgeAnswer) {

            this.memory.saveConversation(
                text,
                knowledgeAnswer
            );

            return knowledgeAnswer;

        }

        // ==========================================
        // STANDARDOWA OBSŁUGA
        // ==========================================

        const intent =
            await this.classifier.classify(text);

        const plan =
            this.planner.createPlan(intent);

        const answer =
            await this.executor.execute(plan, text);

        this.memory.saveConversation(
            text,
            answer
        );

        return answer;

    }

}

module.exports = ExecutiveAgent;