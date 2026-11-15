"use strict";

// Pure, offline lead normalization. Does not contact a CRM or send messages.
// The organization is always part of the deduplication key.
const crypto = require("node:crypto");
const STAGES = Object.freeze(["NEW", "CONTACTED", "OFFER", "NEGOTIATION", "SIGNED", "INSTALLATION", "DONE", "LOST"]);

function leadFingerprint({ organizationId, email, phone }) {
  if (typeof organizationId !== "string" || !organizationId.trim()) throw new TypeError("organizationId required");
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const normalizedPhone = typeof phone === "string" ? phone.replace(/[^0-9+]/g, "") : "";
  if (!normalizedEmail && !normalizedPhone) throw new TypeError("email or phone required");
  const identifier = normalizedEmail ? "email:" + normalizedEmail : "phone:" + normalizedPhone;
  return crypto.createHash("sha256").update(JSON.stringify([organizationId, identifier])).digest("hex");
}

function deduplicateLeads(leads) {
  if (!Array.isArray(leads)) throw new TypeError("leads must be an array");
  const seen = new Set();
  const unique = [];
  const duplicates = [];
  for (const lead of leads) {
    const fingerprint = leadFingerprint(lead);
    if (seen.has(fingerprint)) duplicates.push(lead);
    else { seen.add(fingerprint); unique.push(lead); }
  }
  return { unique, duplicates };
}

function summarizePipeline(leads, organizationId) {
  if (!organizationId) throw new TypeError("organizationId required");
  const counts = Object.fromEntries(STAGES.map(stage => [stage, 0]));
  for (const lead of leads) {
    if (lead.organizationId !== organizationId) continue;
    if (!STAGES.includes(lead.stage)) throw new TypeError("invalid lead stage");
    counts[lead.stage]++;
  }
  return counts;
}

module.exports = { STAGES, leadFingerprint, deduplicateLeads, summarizePipeline };
