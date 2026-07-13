const BaseAgent = require("../../core/BaseAgent");

class DocumentAgent extends BaseAgent {

    constructor() {
        super("Document");
    }

    async process(text) {

        const prompt = `
Jesteś ekspertem od analizy dokumentów.

Na podstawie przesłanego tekstu przygotuj:

# 📋 Krótkie streszczenie

# ✅ Najważniejsze informacje

# ⚠ Ryzyka

# 📅 Terminy

# 💰 Zobowiązania finansowe

# 📌 Rekomendacje

Tekst:

${text}
`;

        return await this.ai.ask(prompt);

    }

}

module.exports = DocumentAgent;