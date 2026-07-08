const { chromium } = require("playwright");

class BrowserEngine {

    constructor() {
        this.browser = null;
        this.page = null;
    }

    async start() {

        this.browser = await chromium.launchPersistentContext(
            "C:\\Users\\szmit\\AppData\\Local\\Google\\Chrome\\User Data\\Default",
            {
                headless: false,
                channel: "chrome"
            }
        );

        const pages = this.browser.pages();

        if (pages.length > 0) {
            this.page = pages[0];
        } else {
            this.page = await this.browser.newPage();
        }

        console.log("✅ Chrome uruchomiony z Twoim profilem");

    }

    async open(url) {

        console.log("🌍 Otwieram:", url);

        await this.page.goto(url);

    }

    async type(selector, text) {

        console.log("⌨️ Wpisuję:", text);

        await this.page.fill(selector, text);

    }

    async click(selector) {

        console.log("🖱 Klikam:", selector);

        await this.page.click(selector);

    }

    async press(key) {

        console.log("⌨️ Naciskam:", key);

        await this.page.keyboard.press(key);

    }

    async wait(seconds) {

        await this.page.waitForTimeout(seconds * 1000);

    }

    async screenshot(name) {

        await this.page.screenshot({
            path: `logs/${name}.png`,
            fullPage: true
        });

        console.log("📸 Zapisano:", name);

    }

    async close() {

        await this.browser.close();

        console.log("❌ Browser zamknięty");

    }

}

module.exports = BrowserEngine;