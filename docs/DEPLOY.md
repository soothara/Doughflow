# DoughFlow v1 deployment

## Free stack
- Cloudflare Pages: static PWA hosting. Static asset requests are free and unlimited on the current free Pages plan. See the Cloudflare Pages pricing docs.
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

## 5. Deploy to Cloudflare Pages
You can deploy the `app/` directory as static assets using Cloudflare Pages Direct Upload or Git integration.

For Git integration, deploy the `app/` directory with no build command. The frontend pins `@supabase/supabase-js` to `2.117.3` for reproducible browser behavior.

## 6. WhatsApp
Post the resulting Cloudflare Pages URL in the existing WhatsApp group. On Android, open it and use Chrome → Add to Home screen. The PWA then opens like an app.

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

After the previous database migrations, run these two files in the Supabase SQL Editor:

1. `db/admin_inventory_history_2026_10_10.sql` — effective-date inventory ledger, production-date trigger, and Admin-only history/correction RPCs.
2. `db/pin_login_2026_10_10.sql` — per-user PIN credentials, username aliases, Admin PIN management, lockout rules, and the initial Admin PIN.

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

If the PIN function is not deployed yet, the login page shows a temporary password sign-in fallback. Deploy and test PIN sign-in before hiding that fallback.

## 9. Admin inventory corrections

Open **Stock → Date-wise inventory editor**, select a material and historical date, enter full physical packages plus any open remainder, and give a reason. Saving creates a dated, auditable correction transaction; it does not delete or rewrite the original inventory entries. Check the “current as of date” preview carefully before saving.

## Demo mode
Before Supabase is configured, the app runs in local demo mode. Demo data is stored only in that browser. Four role buttons are available so the interface can be tested without a backend.

### Stock display
Inventory is stored in exact base units, but the UI converts balances back into the configured physical package model. Examples include:
- Flour: 325 kg → 6.5 sacks
- Oil: 26.5 kg → 1 carton + 6.5 kg open
- Salt: 43 kg → 2 bundles + 3 pcs
- Sugar: 65 kg → 1 sack + 15 kg open
- Yeast: 10.293 kg → 1 box + 293 g open
Water remains recipe-only and is never shown as stock.

The package definitions are updated by `db/hardening_2026_10_08.sql` for an existing database.
