const ExecutiveAgent = require("../agents/executive/ExecutiveAgent");
const readline = require("readline");

(async () => {

    const executive = new ExecutiveAgent();

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const ask = () => {

        rl.question("\nTy: ", async (text) => {

            if (text.toLowerCase() === "exit") {
                rl.close();
                process.exit(0);
            }

            try {

                const answer = await executive.process(text);

                console.log("\nPrzemAI:\n");
                console.log(answer);

            } catch (err) {

                console.error(err);

            }

            ask();

        });

    };

    ask();

})();