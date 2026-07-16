class FactExtractor {

    extract(text) {

        const facts = [];

        // Imię
        let match = text.match(/nazywam się\s+([A-Za-zÀ-Żà-ż]+)/i);

        if (match) {
            facts.push({
                name: "user_name",
                value: match[1]
            });
        }

        // Firma
        match = text.match(/(moja firma to|prowadzę firmę)\s+(.+)/i);

        if (match) {
            facts.push({
                name: "company",
                value: match[2].trim()
            });
        }

        // Email
        match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);

        if (match) {
            facts.push({
                name: "email",
                value: match[0]
            });
        }

        // Telefon
        match = text.match(/\+?\d[\d\s-]{7,}\d/);

        if (match) {
            facts.push({
                name: "phone",
                value: match[0]
            });
        }

        return facts;

    }

}

module.exports = FactExtractor;