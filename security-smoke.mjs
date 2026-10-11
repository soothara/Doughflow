import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const app = read("./app/app.js");
const config = read("./app/config.js");
const edge = read("./supabase/functions/pin-login/index.ts");
const migration = read("./db/security_fixes_2026_10_11.sql");
const schema = read("./db/schema.sql");
const worker = read("./app/sw.js");
const html = read("./app/index.html");
const dashboardCss = read("./app/dashboard.css");

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
assert.match(worker, /doughflow-v17-20261011-dashboard-polish/);
const interactive = read("./app/interactive.css");
assert.match(app, /uiIcon\('users',24\)/, "More menu people icon must use the shared SVG icon helper");
assert.match(app, /Array\.from\(x\)\[0\]/, "Profile initials must handle Unicode names safely");
assert.match(read("./app/styles.css"), /more-icon svg/, "More menu SVG icons must have explicit dimensions");
assert.match(read("./app/styles.css"), /avatar::before,.avatar::after/, "Profile avatar must not inherit decorative overlay icons");

assert.match(app, /function uiIcon\(/);
assert.match(app, /function wireSimulatorInteractions\(/);
assert.match(app, /Visual simulation only/);
assert.match(app, /data-tilt/);
assert.match(app, /timeZone:'Asia\/Bishkek'/);
assert.match(interactive, /\.simulator-stage/);
assert.match(interactive, /\.sim-immersive/);
assert.match(interactive, /\.simulator-stage\.sim-immersive \.sim-world/);
assert.match(interactive, /prefers-reduced-motion:reduce/);
assert.match(worker, /doughflow-v17-20261011-dashboard-polish/);




assert.match(read("./app/styles.css"), /v16 screenshot-match mode/, "legacy screenshot compatibility comment should remain findable during migration");
assert.match(read("./app/styles.css"), /dashboard-mode \.simulator-panel\{display:none\}/, "simulator visibility should be scoped to the dashboard route");
assert.match(html, /href="dashboard\.css"/, "dashboard design layer must load in the app shell");
assert.match(worker, /'\.\/dashboard\.css'/, "dashboard stylesheet should be cached for offline startup");
assert.match(worker, /'\/dashboard\.css'/, "dashboard stylesheet should be refreshed network-first");
assert.match(app, /function renderQuest\(p\)/, "Bakery Quest should remain available outside the dashboard");
assert.match(app, /function renderSimulator\(p\)/, "visual simulator should remain available outside the dashboard");
assert.match(app, /\['quest',uiIcon\('spark',24\)/, "More menu should expose Bakery Quest with an SVG icon");
assert.match(app, /\['simulator',uiIcon\('cube',24\)/, "More menu should expose the simulator with an SVG icon");
assert.match(app, /inventoryTracked===false\?\{primary:t\('Recipe only',lang\),secondary:t\('Not tracked as inventory',lang\)\}/, "water must not be displayed as tracked zero inventory");
const dashboard = app.slice(app.indexOf("function renderDashboard(p){"), app.indexOf("function roleDashboard(p)"));
const sequence = ["portal-hero", "metric-grid", "portal-panel production-panel", "portal-panel stock-panel"];
let last = -1;
for (const marker of sequence) {
  const next = dashboard.indexOf(marker);
  assert.ok(next > last, "dashboard sections must follow the reference order: " + marker);
  last = next;
}
assert.doesNotMatch(dashboard, /quest-panel|simulator-panel/, "quest and simulator must not interrupt the dashboard");
assert.ok(dashboardCss.includes(".dashboard-mode .metric-grid"), "screenshot styles must exist");
let braceDepth = 0;
for (const char of dashboardCss) {
  if (char === "{") braceDepth++;
  if (char === "}") braceDepth--;
  assert.ok(braceDepth >= 0, "dashboard CSS has an unexpected closing brace");
}
assert.equal(braceDepth, 0, "dashboard CSS rules must have balanced braces");

assert.match(app, /const canStartProduction=currentUser\\.role==='admin'\\|\\|currentUser\\.role==='hamurchi'/, "Quest must respect production role permissions");
assert.match(app, /if\\(!canStartProduction\\)return;/, "Quest production handler must enforce role checks");
assert.match(app, /const recipeVersion=isDemo\\?db\\?\\.recipe\\?\\.version:liveState\\.recipe\\?\\.version;/, "Dashboard recipe version must come from the active runtime");
assert.match(app, /recipeVersion\\?\\?['"]—['"]/, "Dashboard must not invent a recipe version when live data is missing");
assert.match(app, /Array\\.from\\(String\\(currentUser\\.name\\|\\|'A'\\)\\.trim\\(\\)\\)\\[0\\]/, "Avatar initials should support Unicode names");

console.log("DoughFlow static security and immersive UI smoke checks passed.");
