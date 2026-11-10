"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { prepareMarketplaceDraft, parseAllegroUrl } = require("../lib/marketplaceDraft");
const valid = { url: "https://allegro.pl/oferta/produkt-123", title: "Nowy produkt", description: "Opis własnego produktu do sprzedaży", priceGrosz: 19999, rightsConfirmed: true };
test("only exact Allegro domains are accepted", () => {
  for (const url of ["https://allegro.pl.evil.example/item", "http://allegro.pl/item", "https://evil.example/item", "https://allegro.pl:8443/item", "https://user:pass@allegro.pl/item"]) {
    assert.throws(() => parseAllegroUrl(url), /invalid Allegro URL/);
  }
});
test("draft is never published and requires review", () => {
  const result = prepareMarketplaceDraft(valid);
  assert.equal(result.published, false);
  assert.equal(result.status, "DRAFT_REVIEW_REQUIRED");
  assert.deepEqual(result.channels, ["OLX", "FACEBOOK_MARKETPLACE"]);
  assert.equal(Object.isFrozen(result), true);
});
test("seller rights, price and channels are checked", () => {
  assert.throws(() => prepareMarketplaceDraft({ ...valid, rightsConfirmed: false }), /rights/);
  assert.throws(() => prepareMarketplaceDraft({ ...valid, priceGrosz: -1 }), /price/);
  assert.throws(() => prepareMarketplaceDraft({ ...valid, channels: ["UNKNOWN"] }), /channel/);
});
