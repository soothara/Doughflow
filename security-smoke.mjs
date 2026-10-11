import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const app = read("./app/app.js");
const config = read("./app/config.js");
const edge = read("./supabase/functions/pin-login/index.ts");
const migration = read("./db/security_fixes_2026_10_11.sql");
const inventoryFix = read("./db/fix_admin_inventory_snapshot_2026_10_11.sql");
const pinOnlyMigration = read("./db/pin_only_login_2026_10_11.sql");
const schema = read("./db/schema.sql");
const worker = read("./app/sw.js");
const html = read("./app/index.html");
const dashboardCss = read("./app/dashboard.css");
const mobileCss = read("./app/mobile.css");

// Production must not silently degrade to a local app with hard-coded PINs.
assert.match(app, /const isDemo = CFG\.demoMode === true;/);
assert.match(app, /const configError = !isDemo && !hasLiveConfig;/);
assert.match(app, /DoughFlow configuration is missing/);
assert.match(config, /demoMode: false/);
assert.doesNotMatch(app, /legacyLoginForm|legacyLoginToggle|signInWithPassword/);

// Never place server credentials in assets delivered to browsers.
assert.doesNotMatch(app + config, /SUPABASE_SERVICE_ROLE_KEY|service_role\s*[:=]/i);

// PIN login failures must not reveal whether a username exists or is locked.
assert.match(edge, /verify_pin_only/);
assert.match(edge, /p_client_key: clientKey/);
assert.match(edge, /return responseJson\(401, \{ error: "PIN is incorrect" \}, origin\)/);
assert.doesNotMatch(edge, /verify_pin_login|p_alias|body\.username/);
assert.match(pinOnlyMigration, /create or replace function public\.verify_pin_only\(p_pin text, p_client_key text\)/i);
assert.match(pinOnlyMigration, /pin_login_throttle/);
assert.match(pinOnlyMigration, /grant execute on function public\.verify_pin_only\(text, text\) to service_role/i);
const loginMarkup = app.slice(app.indexOf("function loginHTML()"), app.indexOf("function ensureDemoPins()"));
assert.doesNotMatch(loginMarkup, /loginAlias|Username|askat/);
assert.match(loginMarkup, /id="togglePin"/);
assert.match(app, /body:JSON\.stringify\(\{pin\}\)/);
assert.match(app, /matches\.length!==1/);
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
assert.match(worker, /doughflow-v25-20261011-authentic-tandyr-bakery/);
const interactive = read("./app/interactive.css");
assert.match(app, /uiIcon\('users',24\)/, "More menu people icon must use the shared SVG icon helper");
assert.match(app, /Array\.from\(x\)\[0\]/, "Profile initials must handle Unicode names safely");
assert.match(read("./app/styles.css"), /more-icon svg/, "More menu SVG icons must have explicit dimensions");
assert.match(read("./app/styles.css"), /avatar::before,.avatar::after/, "Profile avatar must not inherit decorative overlay icons");

assert.match(app, /function uiIcon\(/);
assert.match(app, /function wireInteractiveCards\(/);
assert.doesNotMatch(app, /Bakery Simulator|simulatorHTML|renderSimulator|wireSimulatorInteractions|quest-panel|renderQuest|questPlay|questReward/i, "remove the simulator and fake quest game from the app");
assert.match(app, /data-tilt/);
assert.match(app, /timeZone:'Asia\/Bishkek'/);
assert.doesNotMatch(interactive, /\.simulator-[\w-]+|\.sim-[\w-]+|\.quest-[\w-]+/i, "remove unused game styles to keep the mobile bundle lean");
assert.doesNotMatch(read("./app/styles.css"), /\.simulator-[\w-]+|\.sim-[\w-]+|\.quest-[\w-]+/i, "remove unused game styles from base CSS");
assert.match(worker, /doughflow-v25-20261011-authentic-tandyr-bakery/);
assert.match(app, /Inventory database update required\. Run db\/fix_admin_inventory_snapshot_2026_10_11\.sql in Supabase SQL Editor, then refresh\./);
assert.match(inventoryFix, /create or replace function public\.admin_inventory_snapshot\(p_effective_date date\)/i);
assert.match(inventoryFix, /create or replace function public\.admin_inventory_history\(p_effective_date date\)/i);
assert.match(inventoryFix, /revoke all on function public\.admin_inventory_snapshot\(date\) from public/i);
assert.match(inventoryFix, /grant execute on function public\.admin_inventory_snapshot\(date\) to authenticated/i);
assert.match(inventoryFix, /notify pgrst, 'reload schema'/i);




assert.match(read("./app/styles.css"), /v16 screenshot-match mode/, "legacy screenshot compatibility comment should remain findable during migration");
assert.match(html, /href="dashboard\.css"/, "dashboard design layer must load in the app shell");
assert.match(worker, /'\.\/dashboard\.css'/, "dashboard stylesheet should be cached for offline startup");
assert.match(worker, /'\/dashboard\.css'/, "dashboard stylesheet should be refreshed network-first");
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

assert.ok(app.includes("const recipeVersion=isDemo?db?.recipe?.version:liveState.recipe?.version;"), "Dashboard recipe version must come from the active runtime");
assert.ok(app.includes("recipeVersion??'—'"), "Dashboard must not invent a recipe version when live data is missing");
assert.ok(app.includes("Array.from(String(currentUser.name||'A').trim())[0]?.toUpperCase()||'A'"), "Avatar initials should support Unicode names");


assert.ok(html.includes('href="mobile.css"'), "phone-first styles must load in the app shell");
assert.ok(worker.includes("'./mobile.css'"), "phone-first styles must be cached for offline startup");
assert.ok(worker.includes("'/mobile.css'"), "phone-first styles must be refreshed network-first");
assert.ok(app.includes("document.body.dataset.route=currentUser?route:'login'"), "active route should scope responsive behavior");
assert.ok(app.includes("const updateJourney=()=>"), "production should provide actual workflow progress feedback");
assert.ok(app.includes("recipeStatusPill"), "recipe should indicate unsaved changes");
assert.ok(app.includes("const fetchLedger=async(mode)"), "inventory should try a safe read-only ledger recovery when RPCs are missing");
assert.ok(app.includes("if(!snapshotLoaded||!historicalCorrectionRpcReady)"), "date corrections must remain disabled without a trusted snapshot and RPC");
assert.doesNotMatch(app, /inventory-game-banner|inventory-game-icon/, "inventory control should not be labelled as a game");
assert.ok(mobileCss.includes('body[data-route="production"] .sack-picker'), "production layout must be tuned for phones");
assert.ok(mobileCss.includes('body[data-route="recipe"] .recipe-item-row'), "recipe layout must be tuned for phones");
assert.ok(mobileCss.includes("env(safe-area-inset-bottom)"), "mobile navigation should respect device safe areas");

let mobileBraceDepth = 0;
for (const char of mobileCss) {
  if (char === "{") mobileBraceDepth++;
  if (char === "}") mobileBraceDepth--;
  assert.ok(mobileBraceDepth >= 0, "mobile CSS has an unexpected closing brace");
}
assert.equal(mobileBraceDepth, 0, "mobile CSS rules must have balanced braces");
assert.doesNotMatch(app, /Bakery Simulator|simulatorHTML|renderSimulator|wireSimulatorInteractions|quest-panel|renderQuest|questPlay|questReward/i, "no simulator/quest code should remain");

assert.doesNotMatch(app.slice(app.indexOf("async function renderInventory(p)"), app.indexOf("const options=STOCK_MATERIALS.map")), /await refreshLiveState\(\)/, "Stock route must not wait for the full dashboard refresh");
assert.match(app, /void loadDate\(today\(\)\)/, "inventory history should load after first paint");
assert.match(app, /for\(let offset=0;offset<5000;offset\+=1000\)/, "read-only fallback work must be bounded");

assert.match(app, /dashboard data must never gate sign-in/, "session restore should not wait for dashboard data");
assert.match(app, /async function navigateTo\(nextRoute\)/, "menu switching should reuse the app shell");
assert.match(app, /navigateTo\(b\.dataset\.route\)/, "navigation buttons should use fast route switching");

assert.ok(dashboardCss.includes("Landscape_view%2C_Ala_Archa_National_Park%2C_Chuy_region%2C_Kyrgyzstan_01"));
assert.ok(dashboardCss.includes("/commons/thumb/4/47/Tandir_nonlarini_ko%E2%80%98rsatayotgan_novvoy.jpg/1280px-Tandir_nonlarini_ko%E2%80%98rsatayotgan_novvoy.jpg"));
assert.ok(!dashboardCss.includes("images.unsplash.com/photo-1464822759023-fed622ff2c3b"));
assert.ok(!dashboardCss.includes("images.unsplash.com/photo-1509440159596"));
assert.ok(app.includes("chefHat:'<path"));
assert.ok(app.includes("uiIcon('chefHat',26)"));
assert.ok(app.includes("Mountains: Vilya Shoni / Wikimedia Commons"));
assert.ok(app.includes("Tandyr baker: AIDEPCUL / Wikimedia Commons"));
assert.ok(mobileCss.includes("@keyframes dfIosIconPop"));
assert.ok(mobileCss.includes("prefers-reduced-motion:reduce"));

assert.ok(app.includes("https://creativecommons.org/licenses/by/4.0/"));
console.log("DoughFlow static security, inventory RPC, mobile UI, and no-simulator checks passed.");
