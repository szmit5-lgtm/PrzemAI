"use strict";

/**
 * Explicit per-agent browsing policy. No blanket internet permissions.
 * This policy validates *navigation targets*; browser deployment must additionally
 * enforce outbound network isolation (DNS rebinding / subresource / redirects).
 */
const net = require("node:net");

function normalizeDomain(value) {
  if (typeof value !== "string") throw new TypeError("Domain must be a string");
  const domain = value.trim().toLowerCase().replace(/\.$/, "");
  if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(domain) ||
      !domain.includes(".") || domain.length > 253 || domain.includes("..") ||
      domain.split(".").some(label => label.length > 63 || label.startsWith("-") || label.endsWith("-")) ||
      net.isIP(domain)) throw new Error("Invalid allowed domain");
  return domain;
}

function assertAllowedNavigation(address, allowedDomains) {
  if (!Array.isArray(allowedDomains) || !allowedDomains.length)
    throw new Error("Browser access requires approved domains");
  if (typeof address !== "string" || address.length > 4096)
    throw new Error("Invalid navigation URL");
  let url;
  try { url = new URL(address); } catch { throw new Error("Invalid navigation URL"); }
  if (url.protocol !== "https:" || url.username || url.password ||
      url.port || net.isIP(url.hostname) || url.hostname === "localhost")
    throw new Error("Only public HTTPS URLs without credentials or custom ports are allowed");
  const domains = allowedDomains.map(normalizeDomain);
  // Subdomains must be explicitly listed. Do not allow suffix matching.
  if (!domains.includes(url.hostname.toLowerCase().replace(/\.$/, "")))
    throw new Error("Domain not approved for this agent");
  url.hash = "";
  return url.toString();
}

class BrowserAccessPolicy {
  constructor({ companyId, agentId, allowedDomains = [], mode = "READ_ONLY" } = {}) {
    if (typeof companyId !== "string" || !companyId.trim() ||
        typeof agentId !== "string" || !agentId.trim())
      throw new Error("A company and agent identity are required");
    if (mode !== "READ_ONLY" && mode !== "APPROVAL_REQUIRED")
      throw new Error("Unsupported browser access mode");
    this.companyId = companyId;
    this.agentId = agentId;
    this.mode = mode;
    this.allowedDomains = Object.freeze(allowedDomains.map(normalizeDomain));
  }
  navigate(url) { return assertAllowedNavigation(url, this.allowedDomains); }
  authorizeWrite({ approved = false } = {}) {
    if (this.mode === "READ_ONLY" || approved !== true)
      throw new Error("Publishing, messages, purchases and edits require explicit approval");
    return true;
  }
}

module.exports = { BrowserAccessPolicy, assertAllowedNavigation, normalizeDomain };
