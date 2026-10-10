import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const app = read("./app/app.js");
const config = read("./app/config.js");
const edge = read("./supabase/functions/pin-login/index.ts");
const migration = read("./db/security_fixes_2026_10_11.sql");
const schema = read("./db/schema.sql");
const worker = read("./app/sw.js");

// Production must not silently degrade to a local app with hard-coded PINs.
assert.match(app, /const isDemo = CFG\.demoMode === true;/);
assert.match(app, /const configError = !isDemo && !hasLiveConfig;/);
assert.match(app, /DoughFlow configuration is missing/);
assert.match(config, /demoMode: false/);
assert.doesNotMatch(app, /legacyLoginForm|legacyLoginToggle|signInWithPassword/);

// Never place server credentials in assets delivered to browsers.
assert.doesNotMatch(app + config, /SUPABASE_SERVICE_ROLE_KEY|service_role\s*[:=]/i);

// PIN login failures must not reveal whether a username exists or is locked.
assert.match(edge, /Keep unknown usernames, wrong PINs, unconfigured PINs, and locked accounts/);
assert.match(edge, /return responseJson\(401, \{ error: "Username or PIN is incorrect" \}, origin\)/);
assert.doesNotMatch(edge, /retryAfterSeconds/);

// Validate the rules in the server-side migration, not only in the UI.
assert.match(migration, /p_production_date <> \(now\(\) at time zone 'Asia\/Bishkek'\)::date/);
assert.match(migration, /before insert or update on public\.inventory_transactions/i);
assert.match(migration, /Choose today or a past date/);
assert.match(migration, /inventory_transactions_qty_positive_chk/);
assert.match(migration, /Batch numbers must be sequential starting at 1/);
assert.match(migration, /Consumption contains duplicate materials/);
assert.match(migration, /Consumption contains an unknown material/);
assert.match(migration, /Recipe unit does not match the material base unit/);
assert.match(migration, /later daily inventory balance negative/);
assert.match(schema, /alter table public\.inventory_transactions enable row level security/i);
assert.match(schema, /create policy inventory_admin_insert/i);

// Old PWA caches must be retired to pick up the updated login and application code.
assert.match(worker, /doughflow-v13-20261011-aurora/);

const interactive = read("./app/interactive.css");
assert.match(app, /function uiIcon\(/);
assert.match(app, /function wireSimulatorInteractions\(/);
assert.match(app, /Visual simulation only/);
assert.match(app, /data-tilt/);
assert.match(app, /timeZone:'Asia\/Bishkek'/);
assert.match(interactive, /\.simulator-stage/);
assert.match(interactive, /\.sim-immersive/);
assert.match(interactive, /\.simulator-stage\.sim-immersive \.sim-world/);
assert.match(interactive, /prefers-reduced-motion:reduce/);
assert.match(worker, /doughflow-v13-20261011-aurora/);

console.log("DoughFlow static security and immersive UI smoke checks passed.");
