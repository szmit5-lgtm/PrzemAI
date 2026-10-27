# PrzemAI — KSeF 2.0 integration status (2026-10-27)

## Implemented on feature/agent-runtime-finance-mail

- `connectors/ksef/KsefClient.js` — read-only invoice metadata query via `POST /v2/invoices/query/metadata`.
- Only allowlisted KSeF TEST/production hosts; default TEST.
- Input validation: subject role, pagination (10–250), explicit UTC offsets and maximum 100-day date range.
- Request timeout (20 seconds); no logging of bearer tokens or response bodies.
- `tests/ksef-client.test.js` — mocked query, validation and HTTP 429 secret-leak tests.

This is a **client building block, not a completed KSeF integration**.
No KSeF authentication, certificate signing, token renewal, polling,
incremental pagination, persistence or live invoice retrieval is wired yet.
Do not claim that KSeF invoices have been fetched.

## Official documentation

- TEST OpenAPI: https://api-test.ksef.mf.gov.pl/docs/v2/index.html
- Production OpenAPI: https://api.ksef.mf.gov.pl/docs/v2/index.html
- Certificate overview: https://ksef.podatki.gov.pl/informacje-ogolne-ksef-20/certyfikaty-ksef/
- Integrator guide: https://github.com/CIRFMF/ksef-docs

The metadata endpoint requires `InvoiceRead` authorization. For
incremental polling, use `PermanentStorage` with ascending sorting,
handle `hasMore` / `isTruncated`, and limit each query window to 100 days.

## Before first live invoice read

1. Confirm the intended company/NIP and `InvoiceRead` permissions.
2. Complete token or certificate/XAdES authentication in a secure flow.
3. Store the secret in Railway variables/sealed secrets; never in GitHub,
   chat, logs or client-side code. Keep private keys out of the repo.
4. Verify isolation: the service named `PrzemAI-worker-staging` currently
   lives in a Railway environment named `production`. Do not assume it
   is a separate Railway staging environment or safe for real KSeF data.
5. Implement token lifecycle, bounded incremental polling, idempotent
   `FinancialDocument` upserts, retry-after handling, and tests.
6. Only then attempt a read-only live query with authorized credentials.

## Mail prerequisite observed on staging

At 2026-10-27 18:00:31 UTC, the deployed worker logged:
`[Worker] Cycle {"users":0,"due":0,"completed":0,"failed":0,"recovered":0}`.

The worker and DB connection are healthy, but with zero users no
`Financial Agent` or mail integration can run. Do not claim the mailbox
has been read until a real run appears in logs and AgentRun records.
