"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { STATES, createWhatsAppDraft, approveWhatsAppDraft } = require("../services/whatsappDraftPolicy");

test("drafts are inert and require explicit approval", () => {
  const draft = createWhatsAppDraft({ organizationId: "dekonica", contactWaId: "123", text: " Proszę o termin ", createdBy: "aneta" });
  assert.equal(draft.state, STATES.DRAFT);
  assert.equal(draft.text, "Proszę o termin");
  assert.equal(draft.approvedBy, null);
  assert.equal(Object.isFrozen(draft), true);
  const approved = approveWhatsAppDraft(draft, { organizationId: "dekonica", approvedBy: "owner" });
  assert.equal(approved.state, STATES.APPROVED);
  assert.equal(approved.approvedBy, "owner");
  assert.equal(draft.state, STATES.DRAFT);
});

test("approval rejects cross-company access, self-approval and re-approval", () => {
  const draft = createWhatsAppDraft({ organizationId: "dekonica", contactWaId: "123", text: "Hello", createdBy: "aneta" });
  assert.throws(() => approveWhatsAppDraft(draft, { organizationId: "deherus", approvedBy: "owner" }), /Cross-organization/);
  assert.throws(() => approveWhatsAppDraft(draft, { organizationId: "dekonica", approvedBy: "aneta" }), /self-approve/);
  const approved = approveWhatsAppDraft(draft, { organizationId: "dekonica", approvedBy: "owner" });
  assert.throws(() => approveWhatsAppDraft(approved, { organizationId: "dekonica", approvedBy: "owner2" }), /Only pending/);
});

test("invalid or oversized drafts are rejected", () => {
  assert.throws(() => createWhatsAppDraft({ organizationId: "", contactWaId: "123", text: "Hi", createdBy: "aneta" }), /organizationId/);
  assert.throws(() => createWhatsAppDraft({ organizationId: "dekonica", contactWaId: "123", text: "x".repeat(4097), createdBy: "aneta" }), /4096/);
});
