const ExecutiveAgent = require("../../../agents/executive/ExecutiveAgent");

class TextHandler {

    constructor(bot) {

        this.bot = bot;

        this.executive = new ExecutiveAgent();

    }

    async handle(chatId, text) {

        if (!text) return;

        const answer = await this.executive.process(text);

        const MAX = 4000;

        for (let i = 0; i < answer.length; i += MAX) {

            await this.bot.sendMessage(
                chatId,
                answer.substring(i, i + MAX)
            );

        }

    }

}

module.exports = TextHandler;