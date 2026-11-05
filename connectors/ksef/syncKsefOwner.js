"use strict";

const { createHash } = require("node:crypto");
const { Prisma } = require("@prisma/client");
const { authorizeKsefReadOnly } = require("./KsefReadOnlyFlow");
const KsefClient = require("./KsefClient");
const { importKsefMetadata } = require("./importKsefMetadata");
const { analyzeKsefXml } = require("./analyzeKsefXml");

// Backfill historic windows in bounded batches; persist progress after each
// complete bidirectional window, so interrupted runs resume safely.
const DEFAULT_HISTORY_START = "2026-02-01T00:00:00.000Z";
const WINDOW_DAYS = 60;
const XML_BATCH = 15;
const MAX_HISTORY_WINDOWS = 6;
const MAX_XML_BATCH = 80;

function positiveInt(value, fallback, max) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > max) return fallback;
  return number;
}

function xmlRetryDelay(attempts, error) {
  // Back off failing documents so they do not monopolize every import run.
  if (/HTTP 40[134]/.test(String(error?.message || ""))) return 24 * 3600 * 1000;
  return Math.min(12 * 3600 * 1000, Math.max(5, 5 * 2 ** Math.min(attempts, 7)) * 60000);
}

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
  now = new Date(), authorize = authorizeKsefReadOnly, Client = KsefClient,
  historyWindowsPerRun = positiveInt(process.env.KSEF_BACKFILL_WINDOWS_PER_RUN, 1, MAX_HISTORY_WINDOWS),
  xmlBatchSize = positiveInt(process.env.KSEF_XML_BATCH_SIZE, XML_BATCH, MAX_XML_BATCH)
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
  let historicalWindows = 0;
  let historyComplete = false;

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
  let cursor = typeof config.ksefBackfillCursor === "string"
    ? config.ksefBackfillCursor : DEFAULT_HISTORY_START;
  for (let i = 0; agent && i < historyWindowsPerRun; i += 1) {
    const historical = nextHistoryWindow(cursor, recentStart);
    if (!historical) break;
    await syncRange(historical.from, historical.to);
    // The checkpoint is committed ONLY after both buyer/seller directions
    // have finished successfully, never while a partial window is in flight.
    await prisma.agent.update({
      where: { userId_key: { userId, key: "financial" } },
      data: { config: { ...config, ksefBackfillCursor: historical.to } }
    });
    cursor = historical.to;
    historicWindow = historical;
    historicalWindows += 1;
  }
  historyComplete = !nextHistoryWindow(cursor, recentStart);

  // Analyze existing XML as well as newly downloaded invoices, within owner scope.
  const projects = typeof prisma.project?.findMany === "function"
    ? await prisma.project.findMany({
        where: { userId, status: "ACTIVE" },
        select: { id: true, name: true, aliases: true, status: true, company: true },
        take: 300
      }) : [];
  // This pilot's KSeF credentials represent Dekonica only; never match
  // projects explicitly labeled as another business.
  const permittedProjects = projects.filter(project => !project.company ||
    /dekonica/i.test(project.company));
  const projectCatalogSignature = createHash("sha256").update(JSON.stringify(permittedProjects)).digest("hex").slice(0,16);
  // Query the *missing* XML records instead of only the newest 150 invoices.
  // A durable retry timestamp prevents a few unauthorized or invalid XMLs
  // from endlessly blocking later invoices.
  const missing = await prisma.financialDocument.findMany({
    where: { userId, source: "KSEF", rawData: { equals: Prisma.DbNull } },
    select: { id: true, ksefNumber: true, rawData: true, metadata: true, projectId: true, dueDate: true },
    orderBy: [{ issueDate: "asc" }, { id: "asc" }],
    take: 500
  });

  const fetchedDocuments = [];
  let attempted = 0;
  for (const item of missing) {
    if (attempted >= xmlBatchSize) break;
    if (!item.ksefNumber) continue;
    const state = item.metadata?.ksefXmlRetry;
    if (state?.nextRetryAt && Date.parse(state.nextRetryAt) > nowMs) continue;
    attempted += 1;
    try {
      const xml = await client.getInvoiceXml(item.ksefNumber);
      await prisma.financialDocument.updateMany({
        where: { id: item.id, userId, source: "KSEF" },
        data: { rawData: {
          xml, origin: "KSEF_OFFICIAL_XML", downloadedAt: new Date().toISOString()
        } }
      });
      fetchedDocuments.push({ ...item, rawData: { xml } });
      xmlFetched += 1;
    } catch (error) {
      xmlFailed += 1;
      // Save only bounded retry diagnostics; never log XML, invoice identifiers
      // or upstream response bodies, which can contain sensitive data.
      const attempts = Math.min(100, (Number(state?.attempts) || 0) + 1);
      const metadata = item.metadata && typeof item.metadata === "object" &&
        !Array.isArray(item.metadata) ? item.metadata : {};
      await prisma.financialDocument.updateMany({
        where: { id: item.id, userId, source: "KSEF" },
        data: { metadata: { ...metadata, ksefXmlRetry: {
          attempts, nextRetryAt: new Date(nowMs + xmlRetryDelay(attempts, error)).toISOString()
        } } }
      });
    }
  }

  // Newly fetched XML is analyzed immediately. Include older XML documents
  // imported by previous software versions to enrich their descriptions.
  const existing = typeof prisma.financialDocument.findMany === "function"
    ? await prisma.financialDocument.findMany({
        where: { userId, source: "KSEF", rawData: { not: Prisma.DbNull } },
        select: { id: true, ksefNumber: true, rawData: true, metadata: true, projectId: true, dueDate: true },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: 300
      }) : [];
  const processed = new Set();
  for (const item of [...fetchedDocuments, ...existing]) {
    if (processed.has(item.id)) continue;
    processed.add(item.id);
    const xml = item.rawData?.xml;
    if (typeof xml !== "string" || !xml) continue;
    if (item.metadata?.analysis?.version === 1 &&
        (item.metadata.analysis.projectDecision === "MANUAL" ||
         item.metadata.analysis.projectCatalogSignature === projectCatalogSignature)) continue;
    try {
      const analysis = analyzeKsefXml(xml, permittedProjects);
      const metadata = item.metadata && typeof item.metadata === "object" &&
        !Array.isArray(item.metadata) ? item.metadata : {};
      const analyzed = {
        version: 1,
        projectCatalogSignature,
        description: analysis.description,
        itemCount: analysis.itemCount,
        itemPreview: analysis.itemPreview,
        projectDecision: analysis.projectDecision,
        projectHint: analysis.projectHint,
        analyzedAt: new Date().toISOString()
      };
      const data = { metadata: { ...metadata, analysis: analyzed } };
      // Existing manually approved assignments must never be replaced.
      if (!item.projectId && analysis.projectId) data.projectId = analysis.projectId;
      if (!item.dueDate && analysis.dueDate) data.dueDate = analysis.dueDate;
      await prisma.financialDocument.updateMany({
        where: { id: item.id, userId, source: "KSEF" },
        data
      });
    } catch {
      // Leave the document available and retry parsing next cycle.
    }
  }
  return { created, duplicates, xmlFetched, xmlFailed, historicWindow, historicalWindows, historyComplete };
}

module.exports = { syncKsefOwner, nextHistoryWindow };
