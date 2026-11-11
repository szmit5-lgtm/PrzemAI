"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { evaluateOutbound } = require("../api/services/WhatsAppPolicy");

const approved = {
  contactApproved: true, conversationEnabled: true,
  withinCustomerServiceWindow: true, globalPaused: false
};

test("default policy fails closed", () => {
  const outcome = evaluateOutbound({ text: "Czy oferta jest gotowa?" });
  assert.equal(outcome.decision, "NEEDS_APPROVAL_OR_BLOCKED");
  assert.ok(outcome.reasons.includes("GLOBAL_PAUSE"));
  assert.equal(outcome.sendAuthorized, false);
});

test("routine message is eligible but does not authorize sending", () => {
  const outcome = evaluateOutbound({ ...approved, text: "Czy oferta jest już gotowa?" });
  assert.equal(outcome.decision, "ROUTINE_ELIGIBLE");
  assert.equal(outcome.sendAuthorized, false);
});

test("binding commitments and financial topics require approval", () => {
  for (const text of ["Zapłacimy jutro", "Akceptuję ofertę", "We will pay tomorrow", "Proszę o numer rachunku bankowego"]) {
    assert.ok(evaluateOutbound({ ...approved, text }).reasons.includes("OWNER_APPROVAL_REQUIRED"), text);
  }
});

test("human takeover and opt out stop routine automation", () => {
  assert.ok(evaluateOutbound({ ...approved, humanTakeover: true, text: "Dziękuję" }).reasons.includes("HUMAN_TAKEOVER"));
  assert.ok(evaluateOutbound({ ...approved, optedOut: true, text: "Dziękuję" }).reasons.includes("CONTACT_OPTED_OUT"));
});

test("outside 24h window requires approved template", () => {
  const { withinCustomerServiceWindow, ...notInWindow } = approved;
  assert.ok(evaluateOutbound({ ...notInWindow, text: "Dzień dobry" }).reasons.includes("WHATSAPP_WINDOW"));
});

test("explicit Polish consent and English approval require owner approval", () => {
  for (const text of ["Wyrażamy zgodę", "Udzielamy zgody", "Zatwierdzamy", "We approve the terms", "I approve"]) {
    const outcome = evaluateOutbound({ ...approved, text });
    assert.ok(outcome.reasons.includes("OWNER_APPROVAL_REQUIRED"), text);
    assert.equal(outcome.sendAuthorized, false);
  }
});
