# Infrastructure and WWW audit — 2026-11-15

## Verified Railway inventory (read-only)
Project: `passionate-freedom`.
The services `PrzemAI`, `PrzemAI-staging`, `PrzemAI-worker-staging`,
`PrzemAI-worker-production` and `PrzemAI-frontend-staging` are all
in the actual Railway environment `production`, tracking
`feature/agent-runtime-finance-mail`. Service names are not environments.
A commit on that branch triggered multiple successful production-environment
deployments on 2026-11-15. The main API's pre-deploy command is
`npx prisma migrate deploy`. Do not push experimental changes there.

Actual `staging` has an independent `Postgres-Vycl`, a
`passionate-learning` service, and `PrzemAI-isolated-api-test`.
The last one is LIVE as of this audit and tracks another agent's
`safety/whatsapp-worker-ci-20261115` branch. This is not this
agent's test target; coordinate ownership before changes.

## Findings and blockers
- `server.js`: GET `/health` returns static success, not DB/worker readiness.
- `server.js`: CORS currently uses one `FRONTEND_URL` fallback.
- `api/routes/adminRoutes.js`: admin middleware checks DB role and an
  exact privileged email; this is not a full authorization review.
- JWT, tenant isolation, worker startup and Next.js routes need focused
  regression tests. No claims of end-to-end validation yet.
- Do not use live production or staging DB data for test fixtures.
- Do not enable PostHog or send SDK events until EU project, approved
  retention/privacy settings, network destination and isolated environment
  are independently verified.

## Telemetry preparation
`lib/safeTelemetry.js` is an inert, allowlisted event formatter.
It does **not** initialize PostHog or send events. It fails closed unless
Railway environment name is exactly `staging`, the opt-in flag is true,
and host is exactly `https://eu.i.posthog.com`. Only enumerated
low-cardinality values may pass. No user identifiers, URLs, document contents,
invoice data, email addresses, IPs or message text.

## Smoke checks pending
Run offline `node --test tests/safeTelemetry.test.js`, existing unit suite,
then dedicated API smoke tests with synthetic identities and isolated DB.
Review staging environment variables **by name only**, startup side effects,
dependency health and cost before any deployment. No production writes.
