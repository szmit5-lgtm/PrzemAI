# Staging: safe home.pl mailbox activation

This checklist is for the PrzemAI **staging services only**. It does not authorize production access.

## Identify the correct Railway services

Railway project `passionate-freedom` currently contains `PrzemAI-staging`,
`PrzemAI-worker-staging`, `PrzemAI-frontend-staging`, and a separate
`PrzemAI` service. The Railway environment is named `production`, but
**the service name determines which application is being changed**. Never
apply these steps to the separate `PrzemAI` service or `api.przemai.pl`.

## Provision without starting a real mailbox sync

1. Confirm the staging API and worker have healthy deployments and the
   database migration state is clean.
2. Create an isolated staging user using the staging authentication flow.
   Registration email is not proof of mailbox ownership.
3. Obtain that user's internal database ID using an authorized, read-only
   administrative lookup. Do not substitute an email address for the ID.
4. Set `DEKONICA_MAIL_OWNER_USER_ID` on **both staging API and staging
   worker** through Railway's protected variables. Do not commit values.
5. Keep `DEKONICA_MAIL_PASSWORD` only in the staging worker's protected
   variables. Do not paste its value into logs, tickets, or chat.
6. Check the user's `HOME_PL` integration in the staging agent panel:
   it must be **disabled**. Credentials and an owner ID alone must not
   activate synchronization. Legacy `autoEnablePending` records are
   migrated to disabled state by `ensureDefaults`.
7. Only after explicit authorization to access real mail, manually enable
   the integration using the authorized account. The worker will then
   import attachment **metadata** for recent PDF/XML files; it does not
   store full attachment bytes in FinancialDocument.
8. Verify the agent run result, `lastSyncAt`, and new FinancialDocument
   records. Check that the user sees only their own documents.

## Abort / rollback

- First disable the integration from the authorized user's panel.
- If ownership or credentials may be compromised, remove the owner ID
  and rotate the mailbox credential via the external provider and Railway.
- Never print secrets while diagnosing IMAP errors.
- Confirm `blockedIntegrations` and agent run statuses in logs.
- A worker restart alone does **not** grant mailbox access.

## Known staging limitations

- Without a staging user, scheduled user agents cannot run.
- Without `DEKONICA_MAIL_OWNER_USER_ID`, the shared mailbox policy
  denies synchronization even when a password exists.
- The IMAP connector currently reads recent message metadata only; it
  does not parse invoice contents, calculate VAT, or send email.
- Full end-to-end validation requires a deliberately authorized staging
  account and explicit opt-in. Unit tests do not replace that validation.
