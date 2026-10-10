# DoughFlow security hardening — 11 October 2026

## Changes in this branch

- Production mode no longer silently switches to a local demo if the Supabase configuration is missing. Local demo mode must be explicitly enabled with `demoMode: true`; production config sets it to `false`.
- Removed the hidden email/password login fallback so the normal production interface does not bypass the requested PIN-login flow when the PIN service is down.
- Production dates in the browser are calculated in the Asia/Bishkek timezone to match server-side validation.
- PIN login failures use a consistent status and message to reduce username/lock-state enumeration.
- Added server-side validation of today's production date, batch order/fractions/pieces, and consumption payloads.
- Historical stock corrections now check the minimum recorded daily balance after the correction, not just today's resulting stock.
- Bumped the service worker cache version.
- Added static regression checks and a GitHub Actions workflow.

## Required deployment steps

These source changes do not automatically change the running Cloudflare Worker or Supabase database.

1. Review and merge this branch after the checks pass.
2. In Supabase SQL Editor, review and run `db/security_fixes_2026_10_11.sql` **after** the schema, hardening, PIN-login, and date-wise inventory migrations already used by this installation. Take a database backup first.
3. Deploy the updated `supabase/functions/pin-login/index.ts` as the `pin-login` Edge Function. Confirm the server-side `SUPABASE_SERVICE_ROLE_KEY` is stored only as a Supabase secret, never in browser assets.
4. Deploy the updated `app/` assets to Cloudflare and verify the deployed files match this branch. Existing installed PWAs should update to the new service-worker cache after a successful network load.
5. Sign in with each test account; verify role-specific access, locked PIN behavior, inventory corrections, production submission and stock deduction. Do not use production inventory for destructive tests.

## Security notes

- The initial Admin PIN `1214` remains by design because it was explicitly requested. Treat it as a known initial credential and change it from the Admin PIN management panel after confirming account access.
- The published Supabase publishable key is intended for browser use; all data protection depends on effective RLS and server-side authorization.
- The SQL migration is additive and does not itself prove that existing Supabase policies or deployed functions match the repository. Verify the database after applying it.
- The checks in `security-smoke.mjs` are static regression checks, not a penetration test or a substitute for live database tests.
