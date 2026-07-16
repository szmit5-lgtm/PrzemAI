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

        // ==========================================
        // WYSZUKIWANIE W PAMIĘCI
        // ==========================================

        const lower = text.toLowerCase();

        if (
            lower.includes("pamiętasz") ||
            lower.includes("pamięć") ||
            lower.includes("analizowaliśmy") ||
            lower.includes("szukaj") ||
            lower.includes("znajdź") ||
            lower.includes("pokaż")
        ) {

            this.logger.info("Memory search...");

            const results = this.memory.search(text);

            if (results.length > 0) {

                let answer = `🧠 Znalazłem ${results.length} wpisów.\n\n`;

                for (const item of results.slice(-5).reverse()) {

                    answer +=
                        `📂 ${item.type || "inne"}\n` +
                        `${item.title || item.name || item.user || "-"}\n\n`;

                }

                return answer;

            }

        }

        // ==========================================
        // STANDARDOWA OBSŁUGA
        // ==========================================

        const intent = await this.classifier.classify(text);

        const plan = this.planner.createPlan(intent);

        const answer = await this.executor.execute(plan, text);

        this.memory.saveConversation(text, answer);

        return answer;

    }

}

module.exports = ExecutiveAgent;