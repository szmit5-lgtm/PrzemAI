"use strict";

function redactText(value, limit = 8000) {
  return String(value ?? "")
    .replace(/-----BEGIN [^-\r\n]*PRIVATE KEY-----[\s\S]*?(?:-----END [^-\r\n]*PRIVATE KEY-----|$)/gi, "[ukryto klucz]")
    .replace(/\b[a-z][a-z\d+.-]*:\/\/[^\s"'<>]+/gi, "[ukryto URL]")
    .replace(/\b(?:Bearer|Basic)\s+[a-z\d+/=._~-]+/gi, "[ukryto autoryzację]")
    .replace(/\b(?:sk-[a-z\d_-]{8,}|gh[pousr]_[a-z\d_]{8,}|github_pat_[a-z\d_]{8,}|eyJ[a-z\d_-]+\.[a-z\d_-]+\.[a-z\d_-]+|\d{6,}:[a-z\d_-]{20,})\b/gi, "[ukryto token]")
    .replace(/(["']?\b[\w-]*(?:token|secret|password|passwd|api[_-]?key|authorization|credential|cookie|hasło)[\w-]*["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;<>}]+)/giu, "$1[ukryto wartość]")
    .slice(0, limit);
}

function keywords(value) {
  return new Set((redactText(value, 12000).toLowerCase().normalize("NFD")
    .replace(/\p{M}/gu, "").replace(/ł/g, "l").match(/[a-z0-9]{4,}/g) || []).slice(0, 128));
}

function relevantMemories(memories, message) {
  const query = keywords(message);
  if (!query.size) return memories;
  const overlap = tokens => [...query].filter(word => tokens.has(word)).length;
  return memories.map(memory => ({
    memory,
    score: 3 * overlap(keywords([memory.title, ...(memory.tags || [])].join(" "))) + overlap(keywords(memory.content))
  })).sort((a, b) => b.score - a.score).map(entry => entry.memory);
}

function documentReport(report) {
  const result = { summary: redactText(report?.summary, 1200) };
  for (const key of ["keyInformation", "dates", "risks", "recommendations"]) {
    if (Array.isArray(report?.[key])) {
      result[key] = report[key].filter(item => typeof item === "string")
        .slice(0, 5).map(item => redactText(item, 350));
    }
  }
  if (Array.isArray(report?.actionItems)) {
    result.actionItems = report.actionItems.filter(item => typeof item?.title === "string")
      .slice(0, 5).map(item => ({
        title: redactText(item.title, 200),
        description: redactText(item.description, 350),
        dueDate: redactText(item.dueDate, 30)
      }));
  }
  return result;
}

module.exports = { relevantMemories, redactText, documentReport };
