const BaseAgent = require("../../core/BaseAgent");

class GeneralAgent extends BaseAgent {

    constructor() {
        super("General");
    }

    async process(text) {

        const history = this.memory.search(text);

        let context = "";

        if (history.length > 0) {

            context = history
                .slice(-10)
                .map(item => {

                    switch (item.type) {

                        case "conversation":
                            return `ROZMOWA
Użytkownik: ${item.user}
Asystent: ${item.assistant}`;

                        case "document":
                            return `DOKUMENT
Tytuł: ${item.title}

${item.summary}`;

                        case "meeting":
                            return `SPOTKANIE
${item.summary}`;

                        case "fact":
                            return `FAKT
${item.name}: ${item.value}`;

                        default:
                            return JSON.stringify(item);

                    }

                })
                .join("\n\n----------------------\n\n");

        }

        const prompt = `
Masz do dyspozycji pamięć PrzemAI.

${context}

==========================

Aktualne pytanie użytkownika:

${text}

Jeżeli w pamięci znajdują się przydatne informacje,
wykorzystaj je.

Jeżeli nie ma nic przydatnego,
odpowiedz normalnie.
`;

        const answer = await this.ai.ask(prompt);

        this.memory.saveConversation(

            text,

            answer,

            {
                project: "GENERAL",
                category: "CHAT",
                source: "TELEGRAM",
                tags: ["conversation"]
            }

        );

        return answer;

    }

}

module.exports = GeneralAgent;