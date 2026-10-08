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
