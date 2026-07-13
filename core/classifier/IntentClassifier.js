class IntentClassifier {

    constructor(ai) {
        this.ai = ai;
    }

    async classify(text) {

        const prompt = `
Jesteś klasyfikatorem wiadomości dla systemu PrzemAI.

Odpowiadasz WYŁĄCZNIE poprawnym JSON.

Dostępne moduły:

GENERAL
MEETING
LEGAL
FINANCE
SHOPPING
MAIL

Dostępne zadania:

CHAT
SUMMARIZE_MEETING
WRITE_EMAIL
ANALYZE_CONTRACT
ANALYZE_FINANCE
SEARCH_PRODUCT

Na podstawie wiadomości rozpoznaj również:

- project
- category
- tags

Format odpowiedzi:

{
    "module":"GENERAL",
    "task":"CHAT",
    "project":"GENERAL",
    "category":"GENERAL",
    "tags":["..."],
    "confidence":0.99
}

Wiadomość:

${text}
`;

        const response = await this.ai.ask(prompt);

        try {

            return JSON.parse(response);

        } catch {

            return {
                module: "GENERAL",
                task: "CHAT",
                project: "GENERAL",
                category: "GENERAL",
                tags: [],
                confidence: 0
            };

        }

    }

}

module.exports = IntentClassifier;