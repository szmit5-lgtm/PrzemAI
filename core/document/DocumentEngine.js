const fs = require("fs");
const path = require("path");
const pdf = require("pdf-parse");
const mammoth = require("mammoth");

class DocumentEngine {

    async extractText(filePath) {

        console.log("=== DocumentEngine ===");
        console.log("pdf:", pdf);
        console.log("typeof pdf:", typeof pdf);

        const extension = path.extname(filePath).toLowerCase();

        switch (extension) {

            case ".pdf":
                return await this.readPDF(filePath);

            case ".docx":
                return await this.readDOCX(filePath);

            case ".txt":
                return fs.readFileSync(filePath, "utf8");

            default:
                throw new Error(`Nieobsługiwany format: ${extension}`);

        }

    }

    async readPDF(filePath) {

        console.log("Reading PDF:", filePath);

        const buffer = fs.readFileSync(filePath);

        const result = await pdf(buffer);

        return result.text;

    }

    async readDOCX(filePath) {

        const result = await mammoth.extractRawText({
            path: filePath
        });

        return result.value;

    }

}

module.exports = DocumentEngine;