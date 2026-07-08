const BrowserEngine = require("../../core/browser/BrowserEngine");

class ShoppingAgent {

    constructor() {
        this.browser = new BrowserEngine();
    }

    async run(product) {

        console.log("🛒 Szukam produktu:", product);

        await this.browser.start();

        await this.browser.open("https://allegro.pl");

        // Poczekaj aż strona się załaduje
        await this.browser.wait(5);

        // Wpisz nazwę produktu
        await this.browser.type('input[type="search"]', product);

        // Naciśnij Enter
        await this.browser.press("Enter");

        // Poczekaj na wyniki
        await this.browser.wait(10);

        // Zrób zrzut ekranu
        await this.browser.screenshot("wyniki_allegro");

        // Zamknij przeglądarkę
        await this.browser.close();

    }

}

module.exports = ShoppingAgent;