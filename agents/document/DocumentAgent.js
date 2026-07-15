const BaseAgent = require("../../core/BaseAgent");

class DocumentAgent extends BaseAgent {

    constructor() {
        super("Document");
    }

    async process(text) {

        console.log("=== DOCUMENT AGENT START ===");
        console.log("Document length:", text.length);

        const prompt = `
Jesteś doświadczonym:

- radcą prawnym,
- dyrektorem finansowym (CFO),
- przedsiębiorcą prowadzącym firmę.

Przeanalizuj dokument i przygotuj profesjonalny raport.

Odpowiedź ma mieć MAKSYMALNIE 3000 znaków.

Zwróć odpowiedź dokładnie w poniższym formacie.

# 📄 Rodzaj dokumentu

# ⭐ Ocena dokumentu

# 📋 Krótkie podsumowanie

# ⚖️ Ocena prawna

# 💰 Ocena finansowa

# 📈 Ocena biznesowa

# 📅 Najważniejsze terminy

# 🚨 Największe ryzyka

# ✍️ Co warto zmienić przed podpisaniem

# ✅ Rekomendacja końcowa

Dokument:

${text}
`;

        const answer = await this.ai.ask(prompt);

        console.log("=== DOCUMENT AGENT END ===");
        console.log("Answer length:", answer.length);

        // ==========================
        // ZAPIS DO PAMIĘCI
        // ==========================

        this.memory.saveDocument(

            "Analiza dokumentu",

            answer,

            {
                project: "DOCUMENTS",
                category: "LEGAL_ANALYSIS",
                source: "TELEGRAM",
                tags: ["document", "analysis"]
            }

        );

        return answer;

    }

}

module.exports = DocumentAgent;