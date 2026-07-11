const BrowserManager = require("../core/browser/BrowserManager");

(async () => {

    console.log("🚀 Start BrowserManager");

    const browser = new BrowserManager();

    await browser.start();

    await browser.open("https://www.google.pl");

    await browser.newTab("https://www.wikipedia.org");

    await browser.newTab("https://www.onet.pl");

    browser.listTabs();

})();