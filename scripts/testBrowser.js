const BrowserEngine = require("../core/browser/BrowserEngine");

(async () => {

    const browser = new BrowserEngine();

    await browser.start();

    await browser.open("https://www.google.pl");

    await browser.wait(2);

    await browser.screenshot("google");

    await browser.close();

})();