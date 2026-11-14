"use strict";

/**
 * Pure draft gate for WhatsApp assistant responses.
 * This module never calls Meta APIs or sends messages.
 */
const STATES = Object.freeze({
  DRAFT: "DRAFT",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
});

function createWhatsAppDraft({ organizationId, contactWaId, text, createdBy }) {
  for (const [name, value] of Object.entries({ organizationId, contactWaId, text, createdBy })) {
    if (typeof value !== "string" || !value.trim()) {
      throw new TypeError(name + " must be a non-empty string");
    }
  }
  if (text.length > 4096) throw new RangeError("WhatsApp draft exceeds 4096 characters");
  return Object.freeze({
    organizationId,
    contactWaId,
    text: text.trim(),
    createdBy,
    state: STATES.DRAFT,
    approvedBy: null,
  });
}

function approveWhatsAppDraft(draft, { organizationId, approvedBy }) {
  if (!draft || draft.state !== STATES.DRAFT) throw new Error("Only pending drafts can be approved");
  if (!organizationId || draft.organizationId !== organizationId) {
    throw new Error("Cross-organization draft approval denied");
  }
  if (typeof approvedBy !== "string" || !approvedBy.trim()) {
    throw new TypeError("approvedBy must be a non-empty string");
  }
  if (draft.createdBy === approvedBy) {
    throw new Error("Draft creator cannot self-approve");
  }
  return Object.freeze({ ...draft, state: STATES.APPROVED, approvedBy });
}

module.exports = { STATES, createWhatsAppDraft, approveWhatsAppDraft };
