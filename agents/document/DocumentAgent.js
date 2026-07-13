const BaseAgent = require("../../core/BaseAgent");

class DocumentAgent extends BaseAgent {

    constructor() {
        super("Document");
    }

    async process(text) {

        const prompt = `
Jesteś ekspertem od analizy dokumentów biznesowych.

Przygotuj ZWIĘZŁĄ analizę.

CAŁA odpowiedź ma mieć maksymalnie 2500 znaków.

Odpowiedz dokładnie w tym formacie:

📋 STRESZCZENIE
(max. 5 zdań)

✅ KLUCZOWE INFORMACJE
- punkt
- punkt
- punkt

⚠ RYZYKA
- punkt
- punkt

📅 TERMINY
- punkt
- punkt

💰 FINANSE
- punkt
- punkt

📌 REKOMENDACJA

Napisz krótką rekomendację dla zarządu (maks. 5 zdań).

Dokument:

${text}
`;

        return await this.ai.ask(prompt);

    }

}

module.exports = DocumentAgent;