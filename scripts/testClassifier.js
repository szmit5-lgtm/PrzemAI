require("dotenv").config();

const AIEngine = require("../core/ai/AIEngine");
const IntentClassifier = require("../core/classifier/IntentClassifier");

(async () => {

    const ai = new AIEngine();

    const classifier = new IntentClassifier(ai);

    console.log(
        await classifier.classify(
            "Napisz maila do klienta z podziękowaniem za spotkanie."
        )
    );

})();