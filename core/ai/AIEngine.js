require("dotenv").config();

const OpenAI = require("openai");

class AIEngine {

    constructor() {

        this.client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

    }

    async ask(prompt) {

        const response = await this.client.responses.create({

            model: "gpt-5.5",

            input: prompt

        });

        return response.output_text;

    }

}

module.exports = AIEngine;