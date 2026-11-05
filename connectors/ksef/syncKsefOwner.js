"use strict";

const { Prisma } = require("@prisma/client");
const { authorizeKsefReadOnly } = require("./KsefReadOnlyFlow");
const KsefClient = require("./KsefClient");
const { importKsefMetadata } = require("./importKsefMetadata");

// One historical window per scheduled execution. Progress is persisted in the
// owner's Financial Agent configuration only after both directions complete.
const DEFAULT_HISTORY_START = "2026-02-01T00:00:00.000Z";
const WINDOW_DAYS = 60;
const XML_BATCH = 15;

function nextHistoryWindow(cursor, recentStart) {
  const start = new Date(cursor);
  const cutoff = new Date(recentStart);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(cutoff.getTime()) ||
      start.getTime() < Date.parse(DEFAULT_HISTORY_START) ||
      start >= cutoff) return null;
  const end = new Date(Math.min(start.getTime() + WINDOW_DAYS * 86400000, cutoff.getTime()));
  return { from: start.toISOString(), to: end.toISOString() };
}

async function syncKsefOwner({
  userId, prisma, token, nip, environment = "production",
  now = new Date(), authorize = authorizeKsefReadOnly, Client = KsefClient
} = {}) {
  if (typeof userId !== "string" || !userId.trim() || userId !== userId.trim() ||
      !prisma?.financialDocument || !prisma?.agent) {
    throw new Error("Invalid owner KSeF sync configuration.");
  }
  const nowMs = new Date(now).getTime();
  if (!Number.isFinite(nowMs)) throw new Error("Invalid KSeF sync time.");
  const recentStart = new Date(nowMs - 86400000).toISOString();

  const accessToken = await authorize({ token, nip, environment });
  const client = new Client({ environment, accessToken });
  let created = 0;
  let duplicates = 0;
  let xmlFetched = 0;
  let xmlFailed = 0;
  let historicWindow = null;

  async function syncRange(from, to) {
    for (const [subjectType, direction] of [["Subject2", "INCOMING"], ["Subject1", "OUTGOING"]]) {
      for await (const invoices of client.iterateInvoiceMetadata({
        subjectType, dateType: "PermanentStorage", from, to, pageSize: 100, maxPages: 40
      })) {
        const result = await importKsefMetadata({ userId, invoices, prisma, direction });
        created += result.created;
        duplicates += result.duplicates;
      }
    }
  }

  await syncRange(recentStart, new Date(nowMs).toISOString());

  // Existing agents retain other config fields and already-completed cursor.
  const agent = await prisma.agent.findUnique({
    where: { userId_key: { userId, key: "financial" } },
    select: { config: true }
  });
  const config = agent?.config && !Array.isArray(agent.config) &&
    typeof agent.config === "object" ? agent.config : {};
  const requested = typeof config.ksefBackfillCursor === "string"
    ? config.ksefBackfillCursor : DEFAULT_HISTORY_START;
  const historical = nextHistoryWindow(requested, recentStart);
  if (historical && agent) {
    await syncRange(historical.from, historical.to);
    await prisma.agent.update({
      where: { userId_key: { userId, key: "financial" } },
      data: { config: { ...config, ksefBackfillCursor: historical.to } }
    });
    historicWindow = historical;
  }

  // Metadata-only rows from earlier versions are picked up as well.
  // Never transmit the XML through logs or the bulk invoice-list endpoint.
  const documents = await prisma.financialDocument.findMany({
    where: { userId, source: "KSEF", rawData: { equals: Prisma.DbNull } },
    select: { id: true, ksefNumber: true },
    orderBy: [{ issueDate: "desc" }, { id: "desc" }],
    take: XML_BATCH
  });
  for (const item of documents) {
    if (!item.ksefNumber) continue;
    try {
      const xml = await client.getInvoiceXml(item.ksefNumber);
      await prisma.financialDocument.updateMany({
        where: { id: item.id, userId, source: "KSEF" },
        data: { rawData: { xml, origin: "KSEF_OFFICIAL_XML", downloadedAt: new Date().toISOString() } }
      });
      xmlFetched += 1;
    } catch {
      // Preserve verified monetary metadata even if XML is temporarily unavailable.
      xmlFailed += 1;
    }
  }
  return { created, duplicates, xmlFetched, xmlFailed, historicWindow };
}

module.exports = { syncKsefOwner, nextHistoryWindow };
