# DoughFlow v1 deployment

## Free stack
- Cloudflare Workers: DoughFlow is hosted as a static PWA behind its existing Worker deployment.
- Supabase: Postgres + Auth + API. Check Supabase's current plan limits before production deployment.

## 1. Create Supabase project
Create a project at https://supabase.com/.

## 2. Run database schema
In Supabase: SQL Editor → New query → paste `db/schema.sql` → Run.

## 3. Create users
Use Supabase Authentication to create each user. Then insert/update the matching row in `public.profiles` with one of:
- `admin`
- `hamurchi`
- `naan`
- `sales`

For safety, create the first admin row using the Supabase SQL editor after creating the admin auth account.

## 4. Configure frontend
Copy `app/config.example.js` to `app/config.js` and set:
- `supabaseUrl`
- `supabaseAnonKey`

Use the browser-safe publishable key. NEVER use the service-role key in `config.js`. Supabase documents publishable keys as safe for frontend use when RLS and least-privilege grants are correctly configured.

## 5. Deploy to Cloudflare Workers
The existing DoughFlow Worker is connected to this GitHub repository. Keep the configured asset root at `app/`, build command `exit 0`, and deployment command as configured in the Cloudflare dashboard. Push changes to `main`, then verify that the newest deployment is receiving 100% of production traffic. The frontend pins `@supabase/supabase-js` to `2.117.3` for reproducible browser behavior.

Live portal: `https://doughflow.soothingrainofficial.workers.dev`.

## 6. WhatsApp
Post the Cloudflare Worker URL in the existing WhatsApp group. On Android, open it and use Chrome → Add to Home screen. The PWA then opens like an app.

## 7. Production hardening (existing installations)

After the original `db/schema.sql` has already been run, run **`db/hardening_2026_10_08.sql` once** in Supabase SQL Editor.

This patch:
- treats water as a recipe ingredient, not a stocked inventory item
- limits production to 0.5–9.5 sacks in 0.5 increments
- verifies that submitted batches exactly match the selected sack count
- prevents production from consuming more tracked stock than exists
- makes recipe versions immutable through the browser
- removes direct client-side production writes and routes them through atomic database functions
- locks down unauthenticated table access and function execution

The hardening file is additive; do not delete existing production data.

## 8. Four-digit PIN sign-in (existing installation)

After the existing schema and hardening migration, run these files in Supabase SQL Editor in order:

1. `db/admin_inventory_history_2026_10_10.sql` — effective-date inventory ledger, production-date trigger, and Admin-only history/correction RPCs.
2. `db/pin_login_2026_10_10.sql` — per-user PIN credentials, username aliases, Admin PIN management, lockout rules, and the initial Admin PIN.
3. `db/security_fixes_2026_10_11.sql` — server-side production-date/batch/consumption validation, recipe unit validation, and historical balance safety checks.
4. `db/fix_admin_inventory_snapshot_2026_10_11.sql` — restores the Admin-only inventory history/snapshot RPCs and reloads the Supabase API schema cache. Run this if Stock shows a missing `admin_inventory_snapshot(p_effective_date)` function error; it is safe to rerun and does not rewrite stock transactions.
5. `db/admin_inventory_transaction_management_2026_10_13.sql` — creates the protected before/after audit trail and admin-only edit/delete operations for manual stock movements.
6. `db/inventory_environment_2026_10_13.sql` — adds movement categories, supplier/reference metadata, low-stock thresholds, stock-out validation, date-range activity search, CSV export support, and audit-log reads.
7. `db/inventory_correction_audit_2026_10_13.sql` — records physical stock-count corrections in the same audit log.
8. `db/revoke_anon_inventory_admin_rpcs_20261013.sql` — removes direct anonymous execute privileges from admin-only inventory functions; signed-in calls remain restricted by each function's Admin-role check.

The inventory environment migration files are additive; apply them to the same Supabase project configured in `app/config.js`. Back up first and do not run schema files against an unrelated project.

Until that RPC migration has been applied, the new frontend can reconstruct the selected-date balance/activity in **read-only mode** when Admin ledger reads are available. Saving date corrections stays disabled until the server-side correction RPC is confirmed, so it never treats a missing snapshot as zero stock.

Back up the database first. These files are additive and must be applied to the same Supabase project used by the live site.

The PIN migration sets the existing Admin account whose Auth email is `askat@gmail.com` to username **`askat`** and initial PIN **`1214`**, but only when that account has not already configured a PIN. Change this PIN after initial access. Other accounts receive generated aliases; Admin can assign a memorable alias and set/reset each person's PIN in **More → People & PIN access**.

### Deploy the PIN Edge Function

The frontend never verifies PIN hashes itself. Supabase stores bcrypt PIN hashes and the Edge Function performs verification through the service-role-only `verify_pin_login` RPC, then issues a one-time magic-link token for a normal Supabase Auth session.

From a terminal with the Supabase CLI linked to the same project, run:

```sh
supabase functions deploy pin-login --no-verify-jwt
supabase secrets set APP_ORIGIN=https://doughflow.soothingrainofficial.workers.dev
```

Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions. The service-role key must remain server-side; never paste it into `app/config.js`. `APP_ORIGIN` should match the site's exact origin. If you later change the Cloudflare hostname, update this secret and redeploy/verify CORS.

The Edge Function rate-limits incorrect PINs. The database lockout escalates after five incorrect attempts. Each user has a separate PIN; a PIN is not a replacement for secure device access, so lock the app/device when leaving a shared workstation.

Production login intentionally does not fall back to email/password authentication when PIN login is unavailable. The screen will report that PIN login is temporarily unavailable; restore the Edge Function and its secrets rather than re-enabling an alternate production login path. Keep a separate, administrator-controlled recovery procedure for service outages.

Do not run the older `db/pin_inventory_history.sql` stub; it is superseded and kept only to prevent schema confusion.

## 9. Admin inventory operations

The Stock area is the admin inventory workbench:

- **Receive stock** records supplier purchases/deliveries, customer returns, initial opening balances, or other stock received. It stores the effective date, package count, supplier/recipient, invoice/delivery reference, and reason.
- **Issue / waste** records internal use, damaged/expired stock, or returns to a supplier. The database rejects an issue that would create a negative stock balance on the selected or a later date.
- **Date-wise inventory editor** records a physical-count correction for a selected material/date. It creates a dated adjustment, checks later balances, and preserves an audit record rather than rewriting historical transactions.
- **Inventory movement ledger** filters by date range, material, movement type, and text (reason/supplier/reference). It exports the filtered rows to CSV. Manual movements can be edited or removed from the ledger; the app asks for a deletion reason, preserves before/after audit values, and blocks direct edits/deletions of production-linked ingredient consumption.
- **Low-stock alerts** let Admin set a per-material threshold in base units (kg). Stock at or below the threshold is flagged on the inventory card.
- **Audit log** shows before/after values for admin edits, removals, and date-wise corrections.

To fix a mistake, open **Stock**, use the activity date range/search filters to locate the wrong entry, then choose **Edit** or **Remove**. If it is linked to production, correct the source production record instead of deleting the inventory movement directly. For a wrong physical balance rather than a wrong transaction, use the date-wise inventory editor. All quantities are stored in base units; the screen converts packages into kg and supports half-sacks.

## Demo mode
Demo mode is opt-in via `demoMode: true` in `app/config.js`. The checked-in production config sets `demoMode: false`; if live Supabase configuration is missing, the app fails closed instead of silently opening a local demo. For local interface testing, explicitly enable demo mode; data stays in that browser. Demo PINs are `askat / 1214`, `hamurchi / 2468`, `naan / 1357`, and `sales / 8642`. These credentials are for isolated local testing only and must never be reused for live accounts.

### Stock display
Inventory is stored in exact base units, but the UI converts balances back into the configured physical package model. Examples include:
- Flour: 325 kg → 6.5 sacks
- Oil: 26.5 kg → 1 carton + 6.5 kg open
- Salt: 43 kg → 2 bundles + 3 pcs
- Sugar: 65 kg → 1 sack + 15 kg open
- Yeast: 10.293 kg → 1 box + 293 g open
Water remains recipe-only and is never shown as stock.

The package definitions are updated by `db/hardening_2026_10_08.sql` for an existing database.
