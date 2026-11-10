"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { prepareSellerOnboarding, parseSellerUrl } = require("../lib/marketplaceSeller");
test("seller profile is accepted without pretending catalog was imported", () => {
  const x = prepareSellerOnboarding({ sellerUrl: "https://allegro.pl/uzytkownik/Misiowy_Swiat" });
  assert.equal(x.sellerName, "Misiowy_Swiat");
  assert.equal(x.published, false);
  assert.equal(x.status, "AWAITING_CONNECTION");
  assert.equal(x.catalogSync, "REQUIRES_AUTHORIZED_ALLEGRO_CONNECTION");
});
test("reject spoofed seller domains and invalid paths", () => {
  for (const url of ["https://allegro.pl.evil.example/uzytkownik/Misiowy_Swiat", "http://allegro.pl/uzytkownik/Misiowy_Swiat", "https://allegro.pl/oferta/123", "https://allegro.pl:8443/uzytkownik/Misiowy_Swiat"]) {
    assert.throws(() => parseSellerUrl(url), /invalid seller URL/);
  }
});
