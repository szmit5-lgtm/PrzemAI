# PrzemAI — KSeF 2.0 integration status (2026-10-27)

## Implemented on feature/agent-runtime-finance-mail

- `connectors/ksef/KsefClient.js` — read-only invoice metadata query via `POST /v2/invoices/query/metadata` and bounded async pagination (`iterateInvoiceMetadata`).
- Only allowlisted KSeF TEST/production hosts; default TEST.
- Input validation: subject role, pagination (10–250), explicit UTC offsets and maximum 100-day date range.
- Request timeout (20 seconds); no logging of bearer tokens or response bodies.
- `tests/ksef-client.test.js` — mocked query, pagination, truncation guard, validation and HTTP 429 secret-leak tests.
- `npm test` — runs KSeF and mail-identity regression tests locally.

This is a **client building block, not a completed KSeF integration**.
No KSeF authentication, certificate signing, token renewal, polling,
incremental checkpoint persistence or live invoice retrieval is wired yet. Pagination
is implemented as a bounded iterator but is not connected to the Financial Agent.
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

## Mail metadata ingestion hardening (2026-10-27)

- Mail attachments now receive stable, opaque SHA-256 identities scoped to the
  integration, message and attachment index. Two attachments with the same
  filename in one email no longer collide; identical Message-IDs in different
  mailboxes are isolated.
- IMAP UIDVALIDITY is captured for the UID fallback when Message-ID is missing.
- Database uniqueness is the source of truth; concurrent imports handle Prisma
  P2002 conflicts without creating duplicates.
- The current mail importer stores **metadata only**, not the PDF/XML contents.
  It cannot yet extract invoice numbers, amounts or due dates from attachments.
- These changes are staged-code improvements, not evidence of a successful
  mailbox connection. The worker still reports zero users in the staging DB.
- When rolling this into a database that contains documents imported with the
  previous externalId format, plan a one-time identity migration or deduplication
  review before enabling automatic imports to avoid a one-time reimport.

## Shared mailbox authorization hardening (2026-10-27)

The `office@dekonica.com` mailbox uses one shared Railway secret.
**Do not auto-provision it for every self-registered user.**
Registration currently does not verify email ownership, so email-based
allowlisting alone is unsafe.

- Set `DEKONICA_MAIL_OWNER_USER_ID` on the **worker staging service**
  to the exact, already-created internal PrzemAI user ID authorized to
  receive this company's mail metadata.
- `AgentService.ensureDefaults` only creates the Dekonica integration
  for that ID; `FinancialAgent` checks authorization again before
  opening IMAP, including for older integrations.
- If the variable is missing, access fails closed. Do not set an arbitrary
  or guessed ID. Do not copy mailbox passwords or private keys to GitHub.
- The staging worker still reports zero users, so no mailbox has been
  accessed. An authorized account must be created and the owner ID
  configured before an end-to-end test.
- This is authorization for a **shared company mailbox**, not a complete
  multi-tenant permissions model. Add verified identity, audit logs and
  tenant-scoped secrets before enabling more companies.
