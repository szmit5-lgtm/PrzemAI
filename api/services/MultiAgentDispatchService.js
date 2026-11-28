"use strict";
const prisma = require("../../lib/prisma");
const { GENERAL_SOURCE, getAgentDefinition } = require("../../lib/agentCatalog");

const GENERAL_TASKS_PER_MINUTE = 12;
const GENERAL_WINDOW_MS = 60000;
const GENERAL_AGENTS = Object.freeze(["financial", "document", "investment"]);
const canDelegate = key => GENERAL_AGENTS.includes(key) || getAgentDefinition(key)?.mode === "TASK_DRAFT";

function validateDispatch(body, general = false) {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new Error("Podaj plan zadań.");
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (title.length < 5 || title.length > 160)
    throw new Error("Tytuł planu musi mieć od 5 do 160 znaków.");
  if (!Array.isArray(body.assignments) || body.assignments.length < 1 || body.assignments.length > 5)
    throw new Error("Plan musi zawierać od 1 do 5 zleceń.");
  const seen = new Set();
  const assignments = body.assignments.map(item => {
    const agentKey = typeof item?.agentKey === "string" ? item.agentKey.trim() : "";
    const instruction = typeof item?.instruction === "string" ? item.instruction.trim() : "";
    const def = getAgentDefinition(agentKey);
    if (!def || (general ? !canDelegate(agentKey) : def.mode !== "TASK_DRAFT"))
      throw new Error("Nieobsługiwany agent w planie.");
    if (instruction.length < 5 || instruction.length > 8000)
      throw new Error("Instrukcja musi mieć od 5 do 8000 znaków.");
    if (seen.has(agentKey))
      throw new Error("Każdego agenta można wskazać tylko raz w jednym planie.");
    seen.add(agentKey);
    return { agentKey, instruction };
  });
  return { title, assignments };
}

async function lockGeneralUser(tx, userId) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 71914))::text`;
}

async function dispatchPlan({ userId, payload, db = prisma, general = null }) {
  if (typeof userId !== "string" || !userId)
    throw new Error("Brak uwierzytelnionego użytkownika.");
  const plan = validateDispatch(payload, Boolean(general));
  // Transactional acceptance: either every agent gets a durable task, or none.
  // No model call, mail send, transfer, order, or external side effect here.
  const tasks = await db.$transaction(async tx => {
    if (general) {
      // The lock covers all conversations for this user, including concurrent retries.
      await lockGeneralUser(tx, userId);
      const existing = await tx.task.findMany({
        where: { userId, source: GENERAL_SOURCE, metadata: { path: ["planId"], equals: general.planId } },
        select: { id: true, status: true, metadata: true }
      });
      if (existing.length) return existing.map(task => ({
        id: task.id, status: task.status, agentKey: task.metadata.agentKey
      }));
      const recent = await tx.task.count({
        where: { userId, source: GENERAL_SOURCE, createdAt: { gte: new Date(Date.now() - GENERAL_WINDOW_MS) } }
      });
      if (recent + plan.assignments.length > GENERAL_TASKS_PER_MINUTE) {
        throw Object.assign(new Error("Limit analiz General Agenta. Spróbuj ponownie za minutę."),
          { code: "GENERAL_RATE_LIMIT" });
      }
    }
    const assigned = [];
    for (const [stage, { agentKey, instruction }] of plan.assignments.entries()) {
      const agent = await tx.agent.findFirst({
        where: { userId, key: agentKey, enabled: true },
        select: { id: true }
      });
      if (!agent) throw new Error("Agent " + agentKey + " jest wyłączony lub niedostępny.");
      const task = await tx.task.create({
        data: {
          userId, source: general ? GENERAL_SOURCE : "AGENT", priority: "MEDIUM",
          status: general?.sequential && stage > 0 ? "WAITING" : "TODO",
          title: instruction.replace(/\s+/g, " ").slice(0, 110),
          description: instruction, tags: [agentKey],
          metadata: {
            agentKey, planTitle: plan.title, resultStatus: "QUEUED",
            submittedAt: new Date().toISOString(), dispatchOrigin: general ? GENERAL_SOURCE : "MULTI_AGENT",
            ...(general && { conversationId: general.conversationId, planId: general.planId,
              organizationId: general.organizationId || "", parentPlanId: general.parentPlanId || null,
              ...(general.sequential && { stage }) })
          }
        },
        select: { id: true, status: true }
      });
      if (!general) await tx.agent.updateMany({
        where: { id: agent.id, userId, enabled: true, NOT: { status: "RUNNING" } },
        data: { nextRunAt: new Date(), status: "IDLE" }
      });
      assigned.push({ id: task.id, agentKey, status: task.status });
    }
    return assigned;
  });
  return { title: plan.title, assignments: tasks };
}

module.exports = {
  validateDispatch, dispatchPlan, lockGeneralUser,
  GENERAL_SOURCE, GENERAL_AGENTS, canDelegate, GENERAL_TASKS_PER_MINUTE, GENERAL_WINDOW_MS
};
