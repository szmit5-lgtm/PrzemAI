"use strict";

// Synthetic investment fixtures. Never seed production with this module.
const PROJECT_NAMES = ["Mielno", "Zgorzelec", "Barwice"];
const TASK_TYPES = ["protocol", "schedule", "documents", "costs", "risk"];
function createInvestmentFixtures(organizationId = "tenant-demo-a") {
  if (typeof organizationId !== "string" || !/^tenant-demo-[a-z0-9-]+$/.test(organizationId)) {
    throw new Error("Only synthetic tenant identifiers are allowed");
  }
  const projects = PROJECT_NAMES.map((name, index) => ({
    id: `demo-project-${index + 1}`,
    organizationId,
    name,
    status: "PLANNED",
    synthetic: true
  }));
  const tasks = projects.flatMap((project) => TASK_TYPES.map((type, index) => ({
    id: `${project.id}-task-${index + 1}`,
    projectId: project.id,
    organizationId,
    type,
    status: "TODO",
    title: `Synthetic ${type} task`,
    synthetic: true
  })));
  const protocols = projects.map((project) => ({
    id: `${project.id}-protocol`,
    projectId: project.id,
    organizationId,
    status: "DRAFT",
    body: "Synthetic protocol — not a real acceptance document",
    synthetic: true
  }));
  return { projects, tasks, protocols };
}
function listTenantInvestments(data, organizationId) {
  return {
    projects: data.projects.filter((x) => x.organizationId === organizationId),
    tasks: data.tasks.filter((x) => x.organizationId === organizationId),
    protocols: data.protocols.filter((x) => x.organizationId === organizationId)
  };
}
module.exports = { createInvestmentFixtures, listTenantInvestments };
