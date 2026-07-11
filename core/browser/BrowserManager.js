const BrowserEngine = require("./BrowserEngine");

class BrowserManager {

    constructor() {
        this.browser = new BrowserEngine();
        this.tabs = [];
        this.currentTab = null;
    }

    async start() {

        await this.browser.start();

        this.currentTab = this.browser.page;

        this.tabs.push(this.currentTab);

        console.log("✅ BrowserManager uruchomiony");

    }

    async open(url) {
        return await this.browser.open(url);
    }

    async newTab(url = null) {

        const page = await this.browser.browser.newPage();

        if (url) {
            await page.goto(url);
        }

        this.tabs.push(page);

        this.currentTab = page;

        return page;
    }

    async switchTab(index) {

        if (!this.tabs[index]) return;

        this.currentTab = this.tabs[index];
    }

    async closeTab(index) {

        if (!this.tabs[index]) return;

        await this.tabs[index].close();

        this.tabs.splice(index, 1);

        this.currentTab = this.tabs[0] || null;
    }

    listTabs() {
        console.log("📑 Liczba kart:", this.tabs.length);
    }

    async type(selector, text) {
        return await this.browser.type(selector, text);
    }

    async click(selector) {
        return await this.browser.click(selector);
    }

    async press(key) {
        return await this.browser.press(key);
    }

    async wait(seconds) {
        return await this.browser.wait(seconds);
    }

    async screenshot(name) {
        return await this.browser.screenshot(name);
    }

    async searchGoogle(query) {
        return await this.browser.searchGoogle(query);
    }

    async getTitle() {
        return await this.browser.getTitle();
    }

    async close() {
        return await this.browser.close();
    }

}

module.exports = BrowserManager;