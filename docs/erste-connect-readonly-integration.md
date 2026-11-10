# Erste iBiznes24 Connect — Dekonica (read-only integration)

Status: preparation only. No live bank requests, production deployment, or credential upload authorized by this document.

## Confirmed manually on 2026-11-10
- Bank UI shows a valid transport certificate for Dekonica, expiry 2027-11-09.
- Bank UI shows a valid application certificate, expiry 2028-10-29.
- Local transport keystore was verified as a PKCS12 file containing a PrivateKeyEntry under alias `dekonica`.
- The bank told the operator that permissions are self-managed. **Read-only permissions have not yet been independently verified for the Connect integration.**
- The application certificate is self-signed (Owner = Issuer). Its registration in the bank UI is not proof of account authorization.

## Required security gates before live integration
1. Obtain official Connect API specification (endpoints, message signatures, transport/application certificate requirements, environment URLs, and authorization model).
2. Confirm whether a separate Connect technical user is supported and verify its access to Dekonica accounts is strictly read-only. Avoid changing the owner's normal banking permissions.
3. Allow only documented account inquiry, balance, history and statement operations. Do not implement payment creation, import, signing, authorization, or transfer endpoints.
4. Independently validate bank TLS/CA trust using bank-confirmed root CA fingerprint. Do not disable TLS validation.
5. Keep `.jks`, `.p12`, private keys and passwords out of Git, logs, support tickets and chat. Use an approved secrets manager and minimal-access runtime identity.
6. Test against the bank sandbox or documented non-production environment first, with no production account requests.
7. Add automated tests that reject any operation outside an explicit read-only allowlist, including unknown operations.
8. Require separate approval before adding production secrets, contacting live accounts, or deploying production services.

## Expected user-visible features (not yet implemented)
- Account balances and account list.
- Transaction history and optional statements.
- Monthly and quarterly inflow/outflow reports with company and investment tagging.

## Current blockers
- Official API contract and exact operation names/authorization linkage not yet validated against the bank's documentation.
- Read-only permission assignment for the Connect identity is not confirmed.
- Bank root CA fingerprint must be independently verified.
