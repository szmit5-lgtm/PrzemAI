# PrzemAI White Label — implementation specification (2026-10-28)

Status: planned; not implemented. First pilot: DEKONICA AI at ai.dekonica.com. Keep przemai.pl as the main brand. Do not change production domains or DNS until explicit domain-owner verification.

## Scope
- Per-organization branding: display name, logo asset, accent color, optional custom hostname; never change the underlying product's security boundaries.
- Hostname resolution: verified host -> tenant record; unknown hosts rejected (no default tenant fallback). Use platform's domain ownership verification and HTTPS certificate provisioning.
- Domain options: ai.dekonica.com preferred for user-facing UI; api.dekonica.com reserved for API; dekonica.com/admin requires reverse proxy on existing website and is not default.
- Tenant-aware identity: membership table linking users to organizations, roles owner/admin/member; users may belong to multiple organizations with explicit active organization selection.
- Tenant data isolation: organizationId required on all tenant-scoped DB entities, queries, jobs, files, reports, histories, tasks, agents, integrations, mailboxes and finance documents. Enforce authorization on server, not only UI. Migration plan and audit required before enabling tenants.
- Secrets: integration credentials stored per organization with encryption, never exposed to frontend; no copying existing production credentials into tenant records automatically.
- Agents: per-tenant enablement, quotas, approval rules, access controls, and audit log.
- Branding: default PrzemAI branding for primary domain, tenant branding on verified custom domain; dynamic metadata, favicon and emails.

## Rollout gates
1. Inventory current Prisma models and API routes for tenant scoping; design backward-compatible migration.
2. Implement tenant-aware auth and server-side isolation with negative cross-tenant tests.
3. Add organization settings and logo upload with validation.
4. Add custom-domain ownership verification, DNS setup instructions and TLS handling.
5. Pilot on a staging domain and staging database; verify isolation and rollback.
6. Only then enable DEKONICA custom domain with explicit DNS approval.

## Acceptance criteria
- Two organizations can have different branding on distinct domains.
- A user from tenant A cannot access tenant B's records by changing IDs, URLs, headers or tokens.
- Unknown/unverified host cannot impersonate an organization.
- Existing przemai.pl accounts continue to function after migration.
- No production database mutation or domain reassignment during implementation without an approved deployment plan.
