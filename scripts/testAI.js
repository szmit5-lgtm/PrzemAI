const AIEngine = require("../core/ai/AIEngine");

(async () => {

    const ai = new AIEngine();

    const answer = await ai.ask("Napisz jedno zdanie: Witaj PrzemAI.");

    console.log();
    console.log(answer);

})();