# PrzemAI Mobile — voice-first executive assistant

Status: proposed architecture, not yet implemented. User direction: voice and chat as the primary interface; meeting recording; one assistant coordinating all specialist agents.

## UX
- Home screen: large Talk button, text chat, Record Meeting, Upload Document, Tasks.
- Conversation-first: user need not choose specialist agent. Executive orchestrator routes requests and aggregates results with source links, confidence and action status.
- Voice: streaming two-way conversation with interruption, clear mute/stop controls, visible microphone state, transcript and optional text fallback.
- Meeting capture: explicit start/stop, recording indication, consent/information flow, transcription, summary, decisions, task proposals; permissioned retention and deletion.
- Actions: read-only actions may execute under user's role; external emails, calls, financial edits and commitments require appropriate approvals and audit.
- Progress: long-running jobs have queued/running/completed/failed states; never present queued work as completed.
- Multi-tenant: organization-specific agents, data, branding and permissions, including future white-label domain.
- Security: scoped auth tokens, encryption, access logs, tenant isolation, storage limits, data retention policy.

## Delivery stages
1. Responsive mobile-first chat and unified Executive orchestration, including status updates.
2. PWA installability, push notifications and voice input/output with fallback.
3. Meeting recording, transcription and task extraction.
4. Telephony provider integration with per-call approval and compliance.
5. Native app only if OS-level needs justify it.

## Acceptance
- User can ask about construction progress and outstanding invoices in one chat, with answers grounded in authorized data.
- Voice session can be interrupted and stopped.
- Recording never starts silently.
- Users cannot access another tenant's conversations, recordings or documents.
- Failed/queued work is clearly labeled, and sensitive external actions require approval.
