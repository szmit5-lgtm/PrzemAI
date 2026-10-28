# Multi-tenant Prisma audit — 2026-10-28

Verified schema: prisma/schema.prisma on feature/agent-runtime-finance-mail.

## Current state
- User owns History, Task, ChatConversation, Memory, Agent, Integration, Project and FinancialDocument via userId.
- UserSettings belongs to User; ChatMessage belongs to ChatConversation; AgentRun belongs to Agent.
- No Organization, Membership or Domain models in the inspected schema.
- Existing unique constraints include Agent(userId,key) and FinancialDocument(userId,source,externalId).

## Safe implementation sequence
1. Add Organization, OrganizationMembership and OrganizationDomain models with unique verified hostnames; do not migrate production yet.
2. Add nullable organizationId fields to top-level tenant-owned models, preserving userId and existing unique constraints during transition.
3. Create a reversible, reviewed migration and deterministic backfill for existing data. Require staging database and backup.
4. Resolve organization from authenticated membership and verified hostname, never from untrusted user-supplied organizationId alone.
5. Scope every query, nested read, job, file and integration to authorized organization; add cross-tenant negative tests.
6. Only after verification, enforce non-null organization ownership and update unique constraints.
7. Add per-organization branding and proactive-notification settings.

## Guardrails
No production database migration, DNS changes, or API changes in this audit commit. Do not assume existing userId checks alone provide organization isolation.
