const DocumentAgent = require("../../../agents/document/DocumentAgent");
const DocumentEngine = require("../../../core/document/DocumentEngine");

class DocumentHandler {

    constructor(bot, fileService) {

        this.bot = bot;

        this.fileService = fileService;

        this.document = new DocumentEngine();

        this.documentAgent = new DocumentAgent();

    }

    async handle(chatId, document) {

        await this.bot.sendMessage(
            chatId,
            "📄 Otrzymałem dokument.\n\n⬇️ Pobieram..."
        );

        const filePath = await this.fileService.download(
            document.file_id,
            "documents"
        );

        await this.bot.sendMessage(
            chatId,
            "📖 Odczytuję dokument..."
        );

        const text = await this.document.extractText(filePath);

        await this.bot.sendMessage(
            chatId,
            "🤖 Analizuję dokument..."
        );

        const answer = await this.documentAgent.process(text);

        const MAX = 4000;

        for (let i = 0; i < answer.length; i += MAX) {

            await this.bot.sendMessage(
                chatId,
                answer.substring(i, i + MAX)
            );

        }

    }

}

module.exports = DocumentHandler;
