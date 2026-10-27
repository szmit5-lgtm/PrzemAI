# PrzemAI — staging frontend runbook

Updated: 2026-10-27. This describes **staging services only**, not the production service or `main`.

## URLs and services

- Frontend preview: https://przemai-frontend-staging-production.up.railway.app/preview
- Frontend login: https://przemai-frontend-staging-production.up.railway.app/login
- Backend API: https://przemai-staging-production.up.railway.app
- GitHub branch: `feature/agent-runtime-finance-mail`
- Railway project: `passionate-freedom` (`8b898b94-7bca-4a34-af28-8f114d776825`)
- Frontend service: `PrzemAI-frontend-staging` (`062e25de-e89f-42b5-bb1d-11ddbbf6ed47`)
- API service: `PrzemAI-staging` (`c38b4872-2d7c-4ec6-9422-cc560eb329fd`)
- Worker service: `PrzemAI-worker-staging` (`e0760856-81ba-48d9-898d-953b976ca5b1`)

**Important:** The Railway environment is named `production`, but it contains explicitly named staging services alongside the real production service `PrzemAI`. Never operate on the production service ID `8473a177-7172-4eb1-9d6f-96fe1df3f73d` without authorization. Confirm the target service ID for every operation.

## Frontend configuration

- Source: `szmit5-lgtm/PrzemAI`, feature branch above.
- Root directory: `/frontend`.
- Build: `npm run build`.
- Start: `npm run start -- -p ${PORT:-3000} -H 0.0.0.0`.
- Healthcheck: `/login`.
- Public domain is Railway-managed.
- `API_PROXY_TARGET` points to the staging API origin. `next.config.mjs` rewrites `/api/:path*` to this backend. The browser uses relative `/api` paths, avoiding cross-origin credentials and CORS configuration.
- `NEXT_PUBLIC_REGISTRATION_ENABLED=false` hides public registration links. The backend `ALLOW_PUBLIC_REGISTRATION=false` independently enforces the gate after the new API deployment.
- Watch paths: frontend `/frontend/**`; API and worker only their respective backend paths. Unrelated docs changes should not redeploy services.

## Checks before calling staging ready

1. Confirm the latest deployment SHA and `SUCCESS` for each of the three staging services.
2. Verify frontend build includes `/preview` and `/login`; the Railway healthcheck passes.
3. Verify the public `/preview` route has no access to private data and requires no login.
4. Test the same-origin API proxy using `/api/health` from the frontend origin.
5. Create a dedicated **staging** test account through an approved provisioning path (do not use leaked or real mailbox passwords).
6. Test login, logout, /chat, /finance, /agents, and per-user authorization.
7. Test disabled registration with a request to `POST /api/auth/register` (expected 403 when the flag is false).
8. Verify worker logs for unexpected errors and any actual scheduled jobs.
9. Audit frontend npm dependencies; the initial Railway install reported security advisories, including one critical. Do not mark production ready until triaged.

## Known limitations

- The worker reported `users: 0` before this deployment. No live mailbox sync, KSeF reads, or authenticated end-to-end UI test has been demonstrated.
- The public preview is **visual only** and clearly labeled; agent statuses are implementation stages, not live availability.
- API and worker staging share the Railway project/environment with a real production service. Database isolation must be verified before seeding users or performing schema/data migrations.
- The backend CORS policy allows a configured `FRONTEND_URL`; the new frontend avoids cross-origin browser requests by proxying via Next.js.
- A Railway `SUCCESS` deployment proves the process and healthcheck started; it does not prove business workflows.

## Rollback

Use Railway deployment history for the named staging service and redeploy the last known-good deployment. Do not roll back or restart the production `PrzemAI` service. Preserve logs and failing commit SHA before retrying.
