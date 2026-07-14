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
(np. umowa sprzedaży, umowa pośrednictwa, aneks...)

# ⭐ Ocena dokumentu
Ocena od 1 do 10 wraz z krótkim uzasadnieniem.

# 📋 Krótkie podsumowanie

(max. 5 zdań)

# ⚖️ Ocena prawna

- zgodność dokumentu
- potencjalne ryzyka
- czego brakuje

# 💰 Ocena finansowa

- zobowiązania
- płatności
- kary
- ryzyka finansowe

# 📈 Ocena biznesowa

- czy umowa jest korzystna
- na co uważać
- co warto negocjować

# 📅 Najważniejsze terminy

Lista terminów.

# 🚨 Największe ryzyka

Wypisz maksymalnie 5.

# ✍️ Co warto zmienić przed podpisaniem

Lista konkretnych zmian.

# ✅ Rekomendacja końcowa

Jedna z odpowiedzi:

✅ Podpisać

⚠️ Podpisać po poprawkach

❌ Nie podpisywać

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