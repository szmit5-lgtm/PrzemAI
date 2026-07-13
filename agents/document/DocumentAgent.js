const BaseAgent = require("../../core/BaseAgent");

class DocumentAgent extends BaseAgent {

    constructor() {
        super("Document");
    }

    async process(text) {

        console.log("=== DOCUMENT AGENT START ===");
        console.log("Document length:", text.length);

        const prompt = `
Jesteś ekspertem od analizy dokumentów biznesowych.

Przygotuj krótką analizę dokumentu.

Odpowiedź ma mieć MAKSYMALNIE 1500 znaków.

Uwzględnij:
- Streszczenie
- Kluczowe informacje
- Ryzyka
- Terminy
- Rekomendację

Dokument:

${text}
`;

        const answer = await this.ai.ask(prompt);

        console.log("=== DOCUMENT AGENT END ===");
        console.log("Answer length:", answer.length);

        return answer;

    }

}

module.exports = DocumentAgent;