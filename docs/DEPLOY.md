# DoughFlow v1 deployment

## Free stack
- Cloudflare Pages: static PWA hosting. Static asset requests are free and unlimited on the current free Pages plan. See the Cloudflare Pages pricing docs.
- Supabase Free: Postgres + Auth + API. Current free quota includes 500 MB database, 50,000 monthly active users, 5 GB egress and 1 GB storage.

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

Use the browser-safe anon/publishable key. NEVER use the service-role key in `config.js`.

## 5. Deploy to Cloudflare Pages
You can deploy the `app/` directory as static assets using Cloudflare Pages Direct Upload or Git integration.

For Git integration, put the `app/` contents at the repository root. No build command is required.

## 6. WhatsApp
Post the resulting Cloudflare Pages URL in the existing WhatsApp group. On Android, open it and use Chrome → Add to Home screen. The PWA then opens like an app.

## Demo mode
Before Supabase is configured, the app runs in local demo mode. Demo data is stored only in that browser. Four role buttons are available so the interface can be tested without a backend.
