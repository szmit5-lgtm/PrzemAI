require("dotenv").config();

const prisma = require("./lib/prisma");
const AgentRunner = require("./core/agents/AgentRunner");
const AgentService = require("./api/services/AgentService");

const runner = new AgentRunner();
const service = new AgentService();

const CYCLE_MS = 60000;
const STALE_RUN_MS = 90 * 60000;
const MAX_AGENTS_PER_CYCLE = 50;
const ownerScope = process.env.WORKER_OWNER_USER_ID === undefined
  ? null : require("./lib/workerOwnerScope").workerOwnerScope();

let busy = false;
let stopping = false;
let cycleNumber = 0;
let interval;
let warnedNoUsers = false;
let ownerBootRunQueued = false;

async function recoverStaleRuns() {
  const cutoff = new Date(Date.now() - STALE_RUN_MS);
  const stale = await prisma.agent.findMany({
    where: { status: "RUNNING", updatedAt: { lt: cutoff },
      ...(ownerScope ? { userId: ownerScope } : {}) },
    select: { id: true },
    // Process oldest abandoned runs first without monopolizing the scheduler.
    orderBy: { updatedAt: "asc" },
    take: MAX_AGENTS_PER_CYCLE
  });

  let recovered = 0;
  for (const agent of stale) {
    // Do not begin a new recovery write once a shutdown is underway.
    if (stopping) break;
    try {
      const now = new Date();
      const lock = await prisma.agent.updateMany({
        where: {
          id: agent.id,
          status: "RUNNING",
          updatedAt: { lt: cutoff }
        },
        data: { status: "ERROR", nextRunAt: now }
      });

      if (lock.count !== 1) continue;

      // A failed audit write must not stop recovery of other agents or
      // prevent the scheduler from processing healthy users.
      try {
        await prisma.agentRun.updateMany({
          where: { agentId: agent.id, status: "RUNNING" },
          data: {
            status: "FAILED",
            finishedAt: now,
            error: "Przerwane uruchomienie; odzyskano po utracie workera."
          }
        });
      } catch (error) {
        console.error("[Worker] Failed to update stale run audit", agent.id, error.message);
      }

      recovered += 1;
      console.warn("[Worker] Recovered stale run", agent.id);
    } catch (error) {
      console.error("[Worker] Failed to recover stale agent", agent.id, error.message);
    }
  }

  return recovered;
}

const { discoverPublicLeads } = require("./publicLeadDiscovery");
const { searchPublicCompanies } = require("./publicCompanySearch");
const { buildSalesLeadReport } = require("./salesLeadPipeline");

async function processKaldevaJobs() {
  const jobs = await prisma.history.findMany({
    where: { type: "KALDEVA_SALES", ...(ownerScope ? { userId: ownerScope } : {}) },
    orderBy: { createdAt: "asc" }, take: 100,
    select: { id: true, userId: true, report: true }
  });
  let processed = 0;
  for (const row of jobs) {
    const job = row.report;
    if (job?.status !== "queued" || job.actorId !== row.userId ||
        job.companyId !== "kaldeva:" + row.userId || typeof job.query !== "string") continue;
    const running = { ...job, status: "running" };
    await prisma.history.update({ where: { id: row.id }, data: { report: running } });
    let result;
    try {
      const found = await discoverPublicLeads({
        companyId: job.companyId, actorId: job.actorId, query: job.query,
        search: searchPublicCompanies, maxResults: 20
      });
      const leads = found.leads.map(lead => ({
        companyId: lead.companyId, name: lead.name, website: lead.url,
        category: lead.snippet, source: lead.source, status: lead.status
      }));
      result = { ...running, status: "completed", report: buildSalesLeadReport({
        companyId: job.companyId, actorId: job.actorId, leads
      }), error: null };
    } catch (error) {
      result = { ...running, status: "failed", error: String(error?.message || "search_failed").slice(0, 150) };
    }
    await prisma.history.update({ where: { id: row.id }, data: { report: result } });
    processed++;
    if (processed >= 5 || stopping) break;
  }
  return processed;
}

async function cycle() {
  if (busy || stopping) return;
  busy = true;

  try {
    let recovered = 0;
    try {
      recovered = await recoverStaleRuns();
    } catch (error) {
      // A failed stale-run scan must not prevent healthy agents from running.
      console.error("[Worker] Stale run scan failed", error.message);
    }
    try { const jobs = await processKaldevaJobs(); if (jobs) console.log("[Worker] Kaldeva jobs processed", jobs); }
    catch (error) { console.error("[Worker] Kaldeva queue failed", error?.message || "unknown"); }
    // A SIGTERM during the stale scan must not start user provisioning.
    if (stopping) return;
    const users = await prisma.user.findMany({
      ...(ownerScope ? { where: { id: ownerScope } } : {}),
      select: { id: true }
    });

    if (users.length === 0 && !warnedNoUsers) {
      console.warn("[Worker] No users in this database. Scheduled user agents cannot run until a staging user is provisioned.");
      warnedNoUsers = true;
    } else if (users.length > 0) {
      warnedNoUsers = false;
    }

    for (const user of users) {
      if (stopping) break;
      try {
        await service.ensureDefaults(user.id);
      } catch (error) {
        // A single broken account must not prevent other users' agents
        // from running during this cycle.
        console.error("[Worker] Failed to ensure default agents for a user", error.message);
      }
    }

    // Explicit deployment-only kick-off for the verified production KSeF owner.
    // This never runs for ordinary users, the staging worker, or disabled KSeF.
    if (!ownerBootRunQueued && ownerScope &&
        process.env.KSEF_OWNER_BOOT_RUN === "true" &&
        process.env.KSEF_SYNC_ENABLED === "true" &&
        process.env.KSEF_OWNER_USER_ID === ownerScope) {
      ownerBootRunQueued = true;
      const queued = await prisma.agent.updateMany({
        where: { userId: ownerScope, key: "financial",
          type: "FINANCIAL", enabled: true, NOT: { status: "RUNNING" } },
        data: { nextRunAt: new Date(), status: "IDLE" }
      });
      console.log("[Worker] Verified owner financial analysis queued at startup", queued.count);
    }

    const due = stopping ? [] : await prisma.agent.findMany({
      where: {
        enabled: true,
        ...(ownerScope ? { userId: ownerScope } : {}),
        OR: [
          { nextRunAt: null },
          { nextRunAt: { lte: new Date() } }
        ],
        NOT: { status: "RUNNING" }
      },
      orderBy: { nextRunAt: "asc" },
      // Avoid unbounded reads when many agents become due simultaneously.
      take: MAX_AGENTS_PER_CYCLE
    });

    let completed = 0;
    let failed = 0;

    for (const agent of due) {
      if (stopping) break;

      // Recheck the due condition when claiming the agent. Another
      // worker may have finished and rescheduled it after findMany.
      let lock;
      try {
        lock = await prisma.agent.updateMany({
          where: {
            id: agent.id,
            enabled: true,
            NOT: { status: "RUNNING" },
            OR: [
              { nextRunAt: null },
              { nextRunAt: { lte: new Date() } }
            ]
          },
          data: { status: "RUNNING" }
        });
      } catch (error) {
        // A transient database error claiming one agent must not prevent
        // other due agents from running in the same scheduler cycle.
        failed += 1;
        console.error("[Worker] Failed to claim agent", agent.key, error.message);
        continue;
      }

      if (lock.count !== 1) continue;

      // SIGTERM can arrive while the claim query is in flight. Do not start
      // a new agent after shutdown begins; release this unused claim so the
      // next worker can schedule it without waiting for stale-run recovery.
      if (stopping) {
        try {
          await prisma.agent.updateMany({
            where: { id: agent.id, status: "RUNNING" },
            data: { status: "IDLE", nextRunAt: new Date() }
          });
        } catch (error) {
          console.error("[Worker] Failed to release claim during shutdown", agent.key, error.message);
        }
        break;
      }

      // AgentRunner heartbeats both scheduled and manual executions.
      try {
        await runner.run({ ...agent, status: "RUNNING" }, "SCHEDULE");
        completed += 1;
      } catch (error) {
        failed += 1;
        console.error("[Worker] Agent failed", agent.key, error.message);
      }
    }

    cycleNumber += 1;
    if (cycleNumber === 1 || cycleNumber % 15 === 0 ||
        completed || failed || recovered) {
      console.log("[Worker] Cycle", JSON.stringify({
        users: users.length,
        due: due.length,
        completed,
        failed,
        recovered
      }));
    }
  } catch (error) {
    console.error("[Worker] Cycle failed", error.message);
  } finally {
    busy = false;
  }
}

async function shutdown() {
  if (stopping) return;
  stopping = true;
  clearInterval(interval);

  // Railway sends SIGTERM during deployments. Give the active
  // cycle a short chance to finish before disconnecting.
  const deadline = Date.now() + 25000;
  while (busy && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  if (busy) {
    console.warn("[Worker] Shutdown deadline reached while a cycle is active; unfinished runs will be recovered by the stale-run watchdog.");
  }

  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

if (process.env.DEKONICA_MAIL_PASSWORD && !process.env.DEKONICA_MAIL_OWNER_USER_ID?.trim()) {
  console.warn("[Worker] Shared mailbox secret is configured but DEKONICA_MAIL_OWNER_USER_ID is missing. Mail access remains disabled until an authorized staging user is configured.");
}

// Opt-in, read-only home.pl IMAP connectivity diagnostic. No message bodies are read.
if (process.env.DEKONICA_IMAP_SMOKE_TEST === "true") {
  (async () => {
    const { ImapFlow } = require("imapflow");
    const password = process.env.DEKONICA_MAIL_PASSWORD;
    if (!password || !process.env.DEKONICA_MAIL_OWNER_USER_ID?.trim()) {
      console.warn("[IMAP-SMOKE] SKIPPED: missing mailbox credential or owner");
      return;
    }
    for (const host of ["imap.home.pl", "dekonica.com"]) {
      const client = new ImapFlow({
        host, port: 993, secure: true,
        auth: { user: "office@dekonica.com", pass: password },
        logger: false,
        connectionTimeout: 12000,
        greetingTimeout: 12000,
        socketTimeout: 18000,
        disableAutoIdle: true
      });
      try {
        await client.connect();
        const lock = await client.getMailboxLock("INBOX", { readOnly: true });
        try {
          console.log("[IMAP-SMOKE] SUCCESS: login and read-only INBOX access, host=" + host);
        } finally { lock.release(); }
        await client.logout();
        return;
      } catch (error) {
        // Never print error text: some servers echo addresses or sensitive details.
        console.warn("[IMAP-SMOKE] FAILED: host=" + host + " category=" +
          (error.authenticationFailed ? "AUTH" : error.code === "ETIMEDOUT" ? "TIMEOUT" : "CONNECTION"));
        try { client.close(); } catch (_) {}
      }
    }
    console.warn("[IMAP-SMOKE] FAILED: no verified IMAP connection");
  })().catch(() => console.warn("[IMAP-SMOKE] FAILED: unexpected diagnostic error"));
}

// One-shot, owner-authorized, read-only overdue-payment discovery diagnostic.
// Only enabled explicitly in the staging worker; never sends or modifies mail.
if (process.env.DEKONICA_MAIL_REVIEW_ONCE === "true" &&
    process.env.DEKONICA_MAIL_PASSWORD &&
    process.env.DEKONICA_MAIL_OWNER_USER_ID?.trim()) {
  (async () => {
    const { ImapFlow } = require("imapflow");
    const { simpleParser } = require("mailparser");
    const client = new ImapFlow({
      host: "dekonica.com", port: 993, secure: true,
      auth: { user: "office@dekonica.com", pass: process.env.DEKONICA_MAIL_PASSWORD },
      logger: false, connectionTimeout: 12000, greetingTimeout: 12000,
      socketTimeout: 45000, disableAutoIdle: true
    });
    const since = new Date("2026-10-28T00:00:00+01:00");
    const re = /wezwan|zapłat|platn|płatn|zaległ|zalegl|przetermin|windykac|ponaglen|przypomnien|należno|nalezn|zadłuż|zadluz|overdue|outstanding|payment reminder|past due|final notice|unpaid|debt collection|faktur|invoice/i;
    try {
      await client.connect();
      const lock = await client.getMailboxLock("INBOX", { readOnly: true });
      try {
        const ids = await client.search({ since }, { uid: true });
        console.log("[MAIL-REVIEW] RANGE=2026-10-28..2026-11-11; INBOX_COUNT=" + ids.length);
        let checked = 0, matched = 0;
        for (const uid of ids.slice(-250)) {
          if (checked >= 250 || matched >= 45) break;
          checked++;
          const msg = await client.fetchOne(uid, { envelope: true, source: true }, { uid: true });
          if (!msg?.source) continue;
          const parsed = await simpleParser(msg.source, { skipHtmlToText: false, skipImageLinks: true });
          const subject = String(parsed.subject || "").replace(/[\r\n]/g, " ").slice(0,220);
          const body = String(parsed.text || "").replace(/\s+/g, " ").trim();
          const text = subject + " " + body.slice(0, 10000);
          if (!re.test(text)) continue;
          matched++;
          const from = (parsed.from?.value || []).map(x => x.address).join(", ").slice(0,180);
          const report = { n: matched, uid, date: parsed.date?.toISOString() || null,
            from, subject, snippet: body.slice(0, 1250) };
          console.log("[MAIL-REVIEW] MATCH " + JSON.stringify(report));
        }
        console.log("[MAIL-REVIEW] DONE checked=" + checked + " matches=" + matched);
      } finally { lock.release(); }
      await client.logout();
    } catch (error) {
      console.warn("[MAIL-REVIEW] FAILED category=" +
        (error.authenticationFailed ? "AUTH" : error.code === "ETIMEDOUT" ? "TIMEOUT" : "SCAN"));
      try { client.close(); } catch (_) {}
    }
  })().catch(() => console.warn("[MAIL-REVIEW] FAILED unexpected"));
}

// Explicit one-time authorized sender. Guarded by a persistent unique database task ID.
require("./scripts/sendSpecpozOnce")().catch(() => console.warn("[SPECPOZ-SEND] unexpected failure"));

console.log("PrzemAI Worker active", JSON.stringify({commit: process.env.RAILWAY_GIT_COMMIT_SHA || "unknown", mode: process.env.NODE_ENV || "unset"}));
cycle();
interval = setInterval(cycle, CYCLE_MS);

// Staging deployment marker: Claude API smoke test is configured as a one-time pre-deploy check.
