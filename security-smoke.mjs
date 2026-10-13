import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const app = read("./app/app.js");
const config = read("./app/config.js");
const edge = read("./supabase/functions/pin-login/index.ts");
const migration = read("./db/security_fixes_2026_10_11.sql");
const inventoryFix = read("./db/fix_admin_inventory_snapshot_2026_10_11.sql");
const inventoryEnvironment = read("./db/inventory_environment_2026_10_13.sql");
const inventoryCorrectionAudit = read("./db/inventory_correction_audit_2026_10_13.sql");
const inventoryPrivilegeFix = read("./db/revoke_anon_inventory_admin_rpcs_20261013.sql");
const pinOnlyMigration = read("./db/pin_only_login_2026_10_11.sql");
const schema = read("./db/schema.sql");

// Recipe default must remain aligned in live UI defaults and fresh-install schema.
assert.match(app, /code:'yeast', name:'Yeast', qty:\.055, unit:'kg', note:'Default 55 g; operational range 35–55 g'/, "UI default yeast must be 55 g per mishok");
assert.match(schema, /'yeast',0\.055::numeric,'kg','Default 55 g; operational range 35–55 g\.'/ , "fresh-install schema must seed 55 g yeast");
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
assert.match(worker, /doughflow-v49-20261013-production-history-linked/);
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
assert.match(worker, /doughflow-v49-20261013-production-history-linked/);
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

assert.ok(app.includes("t('Pieces / mishok',lang)"), "Dashboard should show the pieces-per-mishok KPI instead of recipe version");
assert.ok(app.includes("Math.round(totalPieces/totalSacks)"), "Pieces-per-mishok KPI must be calculated from today’s production totals");
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

const heroImageSection = app.slice(app.indexOf("const heroImages=["), app.indexOf("const heroPhotoMarkup="));
assert.equal((heroImageSection.match(/\['/g) || []).length, 10, "hero carousel should contain ten photo slides");
assert.ok(heroImageSection.includes("01-baker-tandoor-hd-20261012.webp") && heroImageSection.includes("02-leposhka-closeup-hd-20261012.avif"), "HD hero gallery should use the available high-resolution images");
assert.match(worker, /doughflow-v49-20261013-production-history-linked/, "service worker cache version must change when the gallery changes");
for (const image of ["01-baker-tandoor-hd-20261012.webp","02-leposhka-closeup-hd-20261012.avif","03-bishkek-context.webp","04-bread-delivery-owner.webp","05-bread-delivery-worker.webp","06-van-bread-stock.webp","07-bakery-team.webp","08-bakery-team-selfie.webp","09-team-social.webp","10-oven-production.webp"]) assert.ok(worker.includes("./assets/doughflow-gallery/"+image), "service worker must precache gallery image "+image);
for (const image of ["01-baker-tandoor-hd-20261012.webp","02-leposhka-closeup-hd-20261012.avif"]) assert.ok(worker.includes("./assets/doughflow-gallery/"+image), "service worker must precache selected HD gallery image "+image);

assert.ok(app.includes("data-hero-carousel") && app.includes("data-hero-next") && app.includes("data-hero-prev"), "hero photo carousel controls should be interactive");
assert.ok(app.includes("showHeroPhoto(activeHero+1),3000"), "hero photos should rotate every three seconds");
assert.ok(app.includes("const heroImages=["), "hero must define its selected photo gallery");
for (const image of ["01-baker-tandoor-hd-20261012.webp","02-leposhka-closeup-hd-20261012.avif"]) assert.ok(app.includes(image), "selected hero gallery must include "+image);
for (const image of ["01-baker-tandoor-hd-20261012.webp","02-leposhka-closeup-hd-20261012.avif"]) assert.ok(worker.includes("./assets/doughflow-gallery/"+image), "service worker must precache selected authentic gallery image "+image);
assert.match(worker, /doughflow-v49-20261013-production-history-linked/, "service worker cache version must change when gallery assets are replaced");
assert.ok(app.includes("heroPhotoMarkup") && app.includes("heroDotsMarkup"), "hero slides and navigation dots should be generated from one gallery");
assert.ok(dashboardCss.includes("High-visibility mobile hero") && dashboardCss.includes("rgba(6,18,29,.78)"), "hero photo and text should remain clearly visible");
assert.ok(dashboardCss.includes(".dashboard-mode .portal-hero-photo.hero-slide.is-active{display:block}"), "only the active hero photo should be visible; do not blend photos");
assert.ok(dashboardCss.includes(".dashboard-mode .portal-hero::after{content:none!important;display:none!important}"), "decorative overlay photo must be disabled");
assert.ok(dashboardCss.includes("bakery.webp"), "production panel should use bakery photography");
assert.ok(app.includes("production-photo-sticker") && dashboardCss.includes("dfBreadStickerFloat"), "New Production should use an animated leposhka photo icon");
assert.ok(app.includes("Сделано Али") && !app.includes("Designed & built with care"), "creator banner should remove the generic sentence");
assert.doesNotMatch(app, /OpenAI Platform|openai-platform-badge/i, "OpenAI Platform badge should be removed");
assert.doesNotMatch(dashboardCss, /openai-platform|dfOpenAI/i, "unused OpenAI badge styles should be removed");
assert.ok(app.includes("leposhka-emblem.svg"), "New Production should use the new leposhka emblem");
assert.ok(worker.includes("./assets/leposhka-emblem.svg"), "the new emblem should be precached");
assert.ok(app.includes("Photo gallery · 10 bakery scenes · changes every 3 seconds"));
assert.ok(mobileCss.includes("@keyframes dfIosIconPop"));
assert.ok(mobileCss.includes("prefers-reduced-motion:reduce"));

assert.ok(worker.includes("./assets/bakery.webp") && worker.includes("./assets/leposhka-detail.svg") && worker.includes("./assets/leposhka-delivery.svg"), "real bakery photos should be precached for offline startup");
assert.ok(!dashboardCss.includes("Landscape_view%2C_Ala_Archa_National_Park") && !dashboardCss.includes("images.unsplash.com"), "the dashboard hero must not fall back to a blended mountain/photo background");
console.log("DoughFlow static security, inventory RPC, mobile UI, and no-simulator checks passed.");


// Fresh-start data must remain genuinely empty, with the yeast recipe presented as grams and stored in kg.
assert.match(app, /__emptyStartV1/);
assert.match(app, /data\.productions=\[\]/);
assert.match(app, /a\[m\.code\]=\{stock:0,tx:\[\]\}/);
assert.doesNotMatch(app, /db\.inventory\.flour\.stock=325|db\.inventory\.oil\.stock=26\.5|reason:'Opening balance'/, "demo startup must not create stock or fake opening ledger entries");
assert.match(app, /const yeast=it\.code==='yeast';const unit=yeast\?'g':it\.unit;const qty=yeast\?Number\(it\.qty\)\*1000:it\.qty/);
assert.match(app, /qty:it\.code==='yeast'\?entered\/1000:entered/);
console.log("DoughFlow fresh-empty inventory and 55 g yeast editor checks passed.");

assert.match(app, /admin_record_inventory_movement/, "manual inventory entries must use the admin-only validated RPC");
assert.match(app, /admin_inventory_activity/, "inventory ledger must support date range, material, movement type, and text filters");
assert.match(app, /admin_inventory_audit/, "admin must be able to inspect transaction edit/removal audit records");
assert.match(app, /admin_set_reorder_level/, "admin must be able to set low-stock thresholds");
assert.match(app, /admin_update_inventory_transaction/, "admin must be able to edit historical stock entries");
assert.match(app, /admin_delete_inventory_transaction/, "admin must be able to remove mistaken manual stock entries");
assert.match(app, /supplier_name/, "inventory records must support supplier/recipient details");
assert.match(app, /reference_code/, "inventory records must support delivery/invoice references");
assert.match(app, /Export CSV/, "admin inventory activity must be exportable");
assert.match(app, /stockOut/, "inventory screen must provide a stock-out / waste action");

assert.match(app, /value:'opening_balance'/, "admin must be able to set initial opening balances");
assert.match(app, /stockRemainderUnit/, "manual movements must support partial/open package quantities");
assert.match(app, /data-inventory-edit/, "manual inventory rows must expose an edit action");
assert.match(app, /data-inventory-delete/, "manual inventory rows must expose a remove action");
assert.match(inventoryEnvironment, /'opening_balance'/, "database movement type must permit opening balances");
assert.match(inventoryEnvironment, /admin_record_inventory_movement/, "database must validate and record manual movements server-side");
assert.match(inventoryEnvironment, /admin_inventory_activity/, "database must expose the admin-filtered inventory ledger");
assert.match(inventoryEnvironment, /admin_inventory_audit/, "database must expose the read-only admin audit log");
assert.match(inventoryCorrectionAudit, /inventory_transaction_audit/, "date-wise stock corrections must be audited");
assert.ok(inventoryPrivilegeFix.includes("revoke all on function public.admin_record_inventory_movement(text,text,text,numeric,date,text,numeric,text,text,text) from anon, public"), "anonymous role must not directly execute inventory mutation RPCs");
assert.ok(inventoryPrivilegeFix.includes("revoke all on function public.admin_update_inventory_transaction(uuid,text,text,numeric,date,text,numeric,text,text,text,text) from anon, public"), "anonymous role must not directly execute inventory edit RPCs");
assert.ok(inventoryPrivilegeFix.includes("revoke all on function public.admin_delete_inventory_transaction(uuid,text) from anon, public"), "anonymous role must not directly execute inventory delete RPCs");



assert.match(app, /Sacks recorded/, "notebook summary must count sacks");
assert.match(app, /piece-weight-day/, "notebook report must use responsive daily cards instead of a wide weight table");
assert.match(app, /base.push\(\['reports',NAV_ICONS.sales,'Reports'\]\)/, "Reports must replace Recipe in the bottom navigation");
assert.match(app, /\['recipe',NAV_ICONS.recipe,'Recipe','Edit the working recipe'\]/, "Recipe must remain available in More");
assert.match(mobileCss, /piece-weight-chips/, "sack count cards must have responsive styles");

assert.match(app, /Average pieces per sack/, "notebook summary must report pieces per sack");
assert.match(app, /Sack "\+String\(x\.sack\)/, "each notebook item must be labeled as a sack");
assert.match(app, /pieces_in_sack/, "notebook values must use piece counts, not gram weights");
assert.match(app, /notebook_sack_entries/, "notebook must use the semantically named table");
assert.doesNotMatch(app.slice(app.indexOf("async function renderReports(p){"), app.indexOf("async function renderUsers(p){")), /weight_g|piece weight|\bgrams\b|\bg\b/, "notebook sack counts must not be described as weights");

assert.match(app, /totalNotebookPieces/, "report top totals must be calculated from notebook sack entries");
assert.match(app, /Total pieces counted/, "report must display the total number of counted pieces");
assert.match(app, /Total pieces in these sacks/, "each date must show a combined piece total across its sacks");
assert.match(app, /<b>"\+fmt\(x\.pieces\)\+"<\/b>/, "each sack chip should show the count without repeating the word pieces");
assert.match(mobileCss, /piece-weight-daily-total/, "daily total piece count needs responsive styling");

assert.match(app, /dates\.map\(\(\[date,items\]\)/, "report history must fall back to daily notebook totals");
assert.match(app, /<th>Total pieces<\/th>/, "production history must show total pieces by day");
