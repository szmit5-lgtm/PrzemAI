const BaseAgent = require("../../core/BaseAgent");

class ShoppingAgent extends BaseAgent {

    constructor() {
        super("Shopping");
    }

    async run(product) {

        await this.start();

        console.log("🛒 Szukam:", product);

        await this.browser.searchGoogle(product);

        const title = await this.browser.getTitle();

        console.log("📄", title);

        await this.browser.screenshot("google_search");

        await this.finish();

    }

}

module.exports = ShoppingAgent;