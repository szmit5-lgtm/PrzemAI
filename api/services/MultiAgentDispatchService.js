"use strict";
const prisma = require("../../lib/prisma");
const { getAgentDefinition } = require("../../lib/agentCatalog");

function validateDispatch(body) {
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
    if (!def || def.mode !== "TASK_DRAFT")
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

async function dispatchPlan({ userId, payload, db = prisma }) {
  if (typeof userId !== "string" || !userId)
    throw new Error("Brak uwierzytelnionego użytkownika.");
  const plan = validateDispatch(payload);
  // Transactional acceptance: either every agent gets a durable task, or none.
  // No model call, mail send, transfer, order, or external side effect here.
  const tasks = await db.$transaction(async tx => {
    const assigned = [];
    for (const { agentKey, instruction } of plan.assignments) {
      const agent = await tx.agent.findFirst({
        where: { userId, key: agentKey, enabled: true },
        select: { id: true }
      });
      if (!agent) throw new Error("Agent " + agentKey + " jest wyłączony lub niedostępny.");
      const task = await tx.task.create({
        data: {
          userId, source: "AGENT", priority: "MEDIUM", status: "TODO",
          title: instruction.replace(/\s+/g, " ").slice(0, 110),
          description: instruction, tags: [agentKey],
          metadata: {
            agentKey, planTitle: plan.title, resultStatus: "QUEUED",
            submittedAt: new Date().toISOString(), dispatchOrigin: "MULTI_AGENT"
          }
        },
        select: { id: true, status: true }
      });
      await tx.agent.updateMany({
        where: { id: agent.id, userId, enabled: true, NOT: { status: "RUNNING" } },
        data: { nextRunAt: new Date(), status: "IDLE" }
      });
      assigned.push({ id: task.id, agentKey, status: task.status });
    }
    return assigned;
  });
  return { title: plan.title, assignments: tasks };
}

module.exports = { validateDispatch, dispatchPlan };
