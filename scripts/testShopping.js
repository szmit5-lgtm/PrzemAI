console.log("1. Program wystartował");

const ShoppingAgent = require("../agents/shopping/ShoppingAgent");

console.log("2. Załadowano ShoppingAgent");

(async () => {

    console.log("3. Tworzę agenta");

    const agent = new ShoppingAgent();

    console.log("4. Uruchamiam agenta");

    await agent.run("Koło Bestway Stitch");

    console.log("5. Koniec");

})();