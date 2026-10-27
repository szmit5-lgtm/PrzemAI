"use strict";

// Read-only KSeF 2.0 metadata client. Authentication is separate.
// Official API: https://api-test.ksef.mf.gov.pl/docs/v2/index.html
const BASE_URLS = Object.freeze({
  test: "https://api-test.ksef.mf.gov.pl/v2",
  production: "https://api.ksef.mf.gov.pl/v2"
});
const SUBJECT_TYPES = new Set(["Subject1", "Subject2", "Subject3", "SubjectAuthorized"]);
const DATE_TYPES = new Set(["Issue", "Invoicing", "PermanentStorage"]);
const OFFSET_DATE = /(?:Z|[+-]\d{2}:\d{2})$/i;
const MAX_RANGE_MS = 100 * 24 * 60 * 60 * 1000;

class KsefClient {
  constructor({ environment = "test", accessToken, fetchImpl = globalThis.fetch } = {}) {
    if (!BASE_URLS[environment]) throw new Error("Unknown KSeF environment.");
    if (typeof accessToken !== "string" || !accessToken.trim()) {
      throw new Error("KSeF access token is required.");
    }
    if (typeof fetchImpl !== "function") throw new Error("A fetch implementation is required.");
    this.baseUrl = BASE_URLS[environment];
    this.accessToken = accessToken;
    this.fetchImpl = fetchImpl;
  }

  async queryInvoiceMetadata({
    subjectType = "Subject2",
    dateType = "PermanentStorage",
    from,
    to,
    pageSize = 100,
    pageOffset = 0,
    sortOrder = "Asc"
  } = {}) {
    if (!SUBJECT_TYPES.has(subjectType) || !DATE_TYPES.has(dateType)) {
      throw new Error("Invalid KSeF invoice query filters.");
    }
    if (!["Asc", "Desc"].includes(sortOrder) ||
        !Number.isInteger(pageSize) || pageSize < 10 || pageSize > 250 ||
        !Number.isInteger(pageOffset) || pageOffset < 0) {
      throw new Error("Invalid KSeF pagination parameters.");
    }
    if (typeof from !== "string" || typeof to !== "string" ||
        !OFFSET_DATE.test(from) || !OFFSET_DATE.test(to)) {
      throw new Error("KSeF date range requires ISO 8601 dates with UTC offsets.");
    }
    const fromMs = Date.parse(from);
    const toMs = Date.parse(to);
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) ||
        fromMs > toMs || toMs - fromMs > MAX_RANGE_MS) {
      throw new Error("KSeF date range must be valid and at most 100 days.");
    }

    const url = new URL(this.baseUrl + "/invoices/query/metadata");
    url.searchParams.set("sortOrder", sortOrder);
    url.searchParams.set("pageOffset", String(pageOffset));
    url.searchParams.set("pageSize", String(pageSize));

    const response = await this.fetchImpl(url.toString(), {
      method: "POST",
      headers: {
        Authorization: "Bearer " + this.accessToken,
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Error-Format": "problem-details"
      },
      body: JSON.stringify({ subjectType, dateRange: { dateType, from, to } }),
      signal: AbortSignal.timeout(20000)
    });

    if (!response.ok) {
      // Never log response bodies, invoice data or bearer tokens.
      const retryAfter = response.headers?.get?.("retry-after");
      const suffix = response.status === 429 && retryAfter
        ? " Retry after " + retryAfter + " seconds."
        : "";
      throw new Error("KSeF metadata HTTP " + response.status + "." + suffix);
    }
    const data = await response.json();
    if (!data || !Array.isArray(data.invoices) ||
        typeof data.hasMore !== "boolean") {
      throw new Error("Unexpected KSeF metadata response.");
    }
    return data;
  }
  // Bounded, streaming pagination. Never silently accept a truncated
  // response: the caller must split the date window to avoid missing invoices.
  async *iterateInvoiceMetadata({ maxPages = 40, ...filters } = {}) {
    if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 40) {
      throw new Error("KSeF maxPages must be an integer between 1 and 40.");
    }

    const firstOffset = filters.pageOffset ?? 0;
    if (!Number.isInteger(firstOffset) || firstOffset < 0) {
      throw new Error("Invalid KSeF starting page offset.");
    }

    for (let page = 0; page < maxPages; page += 1) {
      const response = await this.queryInvoiceMetadata({
        ...filters,
        pageOffset: firstOffset + page
      });

      if (response.isTruncated === true) {
        throw new Error(
          "KSeF metadata results truncated. Narrow the date range and retry."
        );
      }
      if (response.hasMore && response.invoices.length === 0) {
        throw new Error(
          "KSeF metadata pagination stalled on an empty page."
        );
      }

      yield response.invoices;
      if (!response.hasMore) return;
    }

    throw new Error(
      "KSeF metadata page limit reached. Resume with a narrower date range."
    );
  }

}

module.exports = KsefClient;
