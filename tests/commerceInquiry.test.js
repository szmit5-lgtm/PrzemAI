"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { prepareCommerceInquiry } = require("../lib/commerceInquiry");
const valid = { customerName: "Jan Kowalski", customerEmail: "jan@example.com", productUrl: "https://allegro.pl/oferta/przykladowy-produkt-123", quantity: 2 };
test("inquiry is prepared for configured inbox without claiming delivery", () => {
  const x = prepareCommerceInquiry(valid);
  assert.equal(x.to, "biuro@misiowyswiat.pl");
  assert.equal(x.status, "EMAIL_NOT_SENT");
  assert.equal(x.orderStatus, "INQUIRY_ONLY");
  assert.match(x.body, /Ilosc: 2/);
});
test("rejects invalid quantity, URL and injected headers", () => {
  assert.throws(() => prepareCommerceInquiry({ ...valid, quantity: 0 }), /quantity/);
  assert.throws(() => prepareCommerceInquiry({ ...valid, productUrl: "https://allegro.pl.evil.example/oferta/123" }), /URL/);
  assert.throws(() => prepareCommerceInquiry({ ...valid, customerName: "Jan\nBcc: bad" }), /customerName/);
});
