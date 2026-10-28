# Erste iBiznes24 Connect → PrzemAI

Status: proposed, not connected. Bank confirmation, agreement, credentials/certificates and approved data scope required.

Official documentation: https://www.erste.pl/korporacje/ibiznes24-connect
Erste lists account balances, transaction history and statements (PDF/CSV/XML/MT940) through iBiznes24 Connect, with XML ISO 20022 transport.

## Recommended MVP
- READ ONLY: account balances, transactions, statements; no payment initiation or approval credentials.
- Separate bank connection per organization, with authorized account allowlist and encrypted secrets/certificates.
- Daily scheduled synchronization with manual retry; last successful sync timestamp and stale-data warning.
- Import historical statements and deduplicate transactions using bank-provided IDs and account/date/amount checks.
- Match bank movements to KSeF invoices by account, amount, reference, counterparty, date; preserve confidence and manual review.
- Show bank balance vs cashflow forecast, overdue payables/receivables and per-project cost allocations.
- Reconcile opening/closing balances and transactions; flag gaps, reversals, duplicates and partial payments.
- Limit access by organization role; audit reads and changes; never log account secrets.

## Activation prerequisites
1. Confirm customer uses Erste iBiznes24 corporate banking and has eligible iBiznes24 Connect service.
2. Contact bank relationship manager to confirm pricing, setup, permitted read-only scope, documentation and certificates.
3. Build adapter against bank-provided test/sandbox specification.
4. Test with synthetic statements and then authorized test account; production only after explicit approval.

Fallback: manually uploaded CSV/XML/MT940 statements. Email ingestion only if bank offers an authenticated secure delivery channel and data handling is reviewed.

Do not scrape bank login or bypass MFA.
