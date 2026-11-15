"use strict";

// Offline preflight only. Never imports Anthropic, reads secret values, or makes network calls.
const MAX_BUDGET_PLN = 50;
function assessClaudeSafety(config = {}) {
  const reasons = [];
  const env = String(config.RAILWAY_ENVIRONMENT_NAME || config.RAILWAY_ENVIRONMENT || "").trim().toLowerCase();
  const enabled = config.CLAUDE_DEV_ENABLED === "true";
  const amount = String(config.CLAUDE_MONTHLY_BUDGET_PLN ?? "").trim();
  const budget = /^\d+(?:\.\d{1,2})?$/.test(amount) ? Number(amount) : NaN;
  if (env !== "staging") reasons.push("environment_not_verified_staging");
  if (!Number.isFinite(budget) || budget <= 0 || budget > MAX_BUDGET_PLN)
    reasons.push("invalid_monthly_budget");
  if (!config.ANTHROPIC_API_KEY) reasons.push("missing_api_key");
  if (!enabled) reasons.push("claude_disabled");
  // Attestations alone cannot prove DB isolation or enforce a provider spending cap.
  if (config.CLAUDE_ISOLATION_VERIFIED !== "true") reasons.push("isolation_not_attested");
  if (config.CLAUDE_PROVIDER_SPEND_CAP_VERIFIED !== "true") reasons.push("provider_spend_cap_not_attested");
  return { eligibleForHumanReview: reasons.length === 0, automaticApiCallAllowed: false,
    budgetPln: Number.isFinite(budget) ? budget : null, reasons };
}
if (require.main === module) {
  const report = assessClaudeSafety(process.env);
  process.stdout.write(JSON.stringify(report) + "\n");
  process.exitCode = report.eligibleForHumanReview ? 0 : 1;
}
module.exports = { assessClaudeSafety };
