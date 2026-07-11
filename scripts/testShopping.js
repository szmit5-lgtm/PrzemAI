const ShoppingAgent = require("../agents/shopping/ShoppingAgent");

(async () => {

    const shopping = new ShoppingAgent();

    await shopping.run("koło bestway stitch");

})();