class DocumentClassifier {

    classify(text) {

        const t = text.toLowerCase();

        if (t.includes("faktura") || t.includes("invoice")) {
            return "FINANCE";
        }

        if (
            t.includes("umowa") ||
            t.includes("agreement") ||
            t.includes("kontrakt")
        ) {
            return "LEGAL";
        }

        if (
            t.includes("oferta") ||
            t.includes("proposal") ||
            t.includes("quotation")
        ) {
            return "BUSINESS";
        }

        if (
            t.includes("protokół") ||
            t.includes("spotkanie") ||
            t.includes("meeting")
        ) {
            return "MEETING";
        }

        return "GENERAL";

    }

}

module.exports = DocumentClassifier;