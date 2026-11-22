"use strict";

/**
 * Pure ClickUp CRM payload mapper. No network, secrets, or customer writes.
 * Callers MUST authorize the organization and list before invoking this mapper.
 */
const STAGES = Object.freeze({
  NEW: "Nowy lead",
  CONTACT: "Do kontaktu",
  DISCUSSION: "W trakcie rozmów",
  OFFER: "Oferta wysłana",
  WON: "Wygrany",
  LOST: "Utracony"
});

function mapLeadToClickUpTask(lead, options) {
  if (!lead || typeof lead !== "object" || Array.isArray(lead)) throw new TypeError("lead required");
  if (!options || typeof options !== "object") throw new TypeError("options required");
  const organizationId = String(lead.organizationId || "").trim();
  const authorizedOrganizationId = String(options.authorizedOrganizationId || "").trim();
  if (!organizationId || !authorizedOrganizationId || organizationId !== authorizedOrganizationId) {
    throw new Error("organization access denied");
  }
  const listId = String(options.listId || "").trim();
  const allowedListId = String(options.allowedListId || "").trim();
  if (!listId || !allowedListId || listId !== allowedListId || !/^\\d+$/.test(listId)) {
    throw new Error("ClickUp list not authorized");
  }
  const stage = String(lead.stage || "NEW").toUpperCase();
  if (!Object.hasOwn(STAGES, stage)) throw new Error("invalid lead stage");
  const name = String(lead.name || "").trim();
  if (!name || name.length > 180) throw new Error("invalid lead name");
  const assignee = lead.assigneeId == null ? null : String(lead.assigneeId);
  if (assignee !== null && !/^\\d+$/.test(assignee)) throw new Error("invalid assignee");
  return {
    list_id: listId,
    name: name,
    description: "PrzemAI Kaldeva CRM — status: " + STAGES[stage],
    ...(assignee ? { assignees: [Number(assignee)] } : {})
  };
}

module.exports = { STAGES, mapLeadToClickUpTask };
