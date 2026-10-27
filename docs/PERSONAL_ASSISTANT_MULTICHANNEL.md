# PrzemAI Personal Assistant — multi-channel architecture (proposal)

Status: specification only; no channel integration or user provisioning is claimed.

## Goal
Every authenticated employee has one personal assistant and one permission-scoped context, reachable from the web app, Telegram and (after official provider setup) WhatsApp. Conversations can continue across channels, with user-visible provenance and a consistent task inbox.

## Identity and permissions
- Internal User ID is canonical; never use a phone number or Telegram handle as authorization.
- Link each channel using an authenticated one-time challenge, short expiry, single use and revocation controls.
- Require tenant/company isolation, role-based permissions, and project/document-level access checks on every retrieval and action.
- Do not automatically share private employee conversations with managers; separate personal context from company-owned shared records.
- Record consent and retention settings; support account unlinking, access review and audit logs.

## Processing flow
1. Web/Telegram/WhatsApp adapter verifies provider signature or session and resolves linked User ID.
2. Normalize incoming message into a channel-independent event; deduplicate provider message ID.
3. Executive Agent classifies intent and retrieves only authorized sources: tasks, projects, documents, email, CRM, KSeF.
4. Answer with source, timestamp and confidence. If no reliable source, say what is unknown.
5. Create a clarification request/task to the appropriate owner when authorized; notify requester on response.
6. Outbound messages, external recipients and sensitive changes use explicit approval or narrowly configured delegated permissions.

## Initial milestones
- M1: User profile + assistant chat in web app, permission-scoped retrieval, citations, source freshness.
- M2: Secure Telegram account linking and cross-channel thread continuity.
- M3: Clarification workflow (ask owner, track unanswered requests, notify originator).
- M4: Official WhatsApp Business Platform integration with opt-in, template/window constraints and webhook verification.
- M5: Admin permissions, observability, data retention, multi-company isolation, red-team tests.

## Acceptance tests
- User A cannot access User B's private messages or unauthorized company/project records.
- Unlinked Telegram/WhatsApp accounts cannot query company data.
- Duplicate provider events cause at most one task or outbound action.
- Missing evidence produces a question or escalation, not a fabricated answer.
- Channel unlinking immediately revokes access.
- Outbound actions are logged and approved according to policy.

## Constraints
No shared passwords in code, GitHub or logs. No scraping or unofficial WhatsApp automation. Production deployment and live external messaging require separate approval.
