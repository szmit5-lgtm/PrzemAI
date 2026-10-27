# PrzemAI — agent delivery tracker

Updated: 2026-10-27. Scope: `feature/agent-runtime-finance-mail` / Railway staging only. This is an implementation tracker, **not** a production-readiness claim.

## Implementation inventory

| Agent | Implementation status | Next acceptance test |
| --- | --- | --- |
| Executive | Existing basic implementation | End-to-end routing, permissions, audit trail |
| Document | Existing implementation; quality unverified | PDF/DOCX fixture parsing and faithful cited summary |
| Meeting | Existing implementation; quality unverified | Short and 2h+ recording, transcript accuracy, task extraction |
| General | Existing basic implementation | Regression suite and graceful fallback |
| Financial | In progress | Import, classification, deduplication, project assignment |
| KSeF | In progress | Secure auth and read-only invoice synchronization |
| Mail | In progress | Read-only IMAP, attachment parsing, no automatic sending |
| Legal | Planned | Contract risk analysis with human review |
| Shopping | Planned | Product research with source links |
| Task Manager | Planned | Assignments, reminders, idempotent execution |
| Communication | Planned | Authorized mail/WhatsApp ingestion and task extraction |
| Secretary | Planned | Telephony, consent, scheduling |
| Construction | Planned | Progress, costs, schedules, protocols |
| Investment | Planned | Cost model, profitability, scenarios |
| Sales | Planned | CRM, follow-ups, pipeline |
| Offer | Planned | Approved templates and human-approved sending |
| Research | Planned | Source-grounded supplier/market research |
| Trading | Planned | Backtesting and paper trading only; no live orders |

## Immediate workstream priorities

1. **Reliability:** validate staging health, worker shutdown, idempotent retries and isolated test fixtures.
2. **Quality:** add reproducible Document and Meeting agent tests before marking them ready.
3. **Integrations:** set up least-privilege mailbox and KSeF credentials through Railway secrets, never repository files or chat transcripts. Verify staging test user provisioning; no real inbox reads until configured.
4. **UI:** implement responsive dark navy/neon-blue dashboard, motion with reduced-motion support, and honest per-agent statuses.
5. **Next capabilities:** Task Manager, Communication, Offer; remaining agents incrementally.

## Security and release gates

- Never commit passwords, mailbox credentials, KSeF keys or private client data.
- Credentials disclosed in chat should be rotated before use; prefer dedicated app passwords and staging-only test accounts.
- Never modify `main`, production Railway service or `api.przemai.pl` without explicit authorization.
- External sending, purchases, irreversible actions and live-money trading require separate explicit approval.
- Status `SUCCESS` in Railway proves a deployment completed, not that every agent passed functional tests.
- Every report should identify changed files, commit SHA, tests run, deployment status and outstanding blockers.
