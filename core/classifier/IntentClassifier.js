class IntentClassifier {

    constructor(ai) {
        this.ai = ai;
    }

    async classify(text) {

        const prompt = `
Jesteś klasyfikatorem poleceń.

Zwróć WYŁĄCZNIE poprawny JSON.

Dostępne moduły:

GENERAL
MEETING
LEGAL
FINANCE
SHOPPING

Dostępne zadania:

CHAT
SUMMARIZE_MEETING
WRITE_EMAIL
ANALYZE_CONTRACT
ANALYZE_FINANCE
SEARCH_PRODUCT

Format:

{
  "module":"GENERAL",
  "task":"CHAT",
  "confidence":0.99
}

Polecenie:

${text}
`;

        const response = await this.ai.ask(prompt);

        try {
            return JSON.parse(response);
        } catch {

            return {
                module: "GENERAL",
                task: "CHAT",
                confidence: 0
            };

        }

    }

}

module.exports = IntentClassifier;