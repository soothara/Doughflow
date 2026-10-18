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
const productionTeamRead = read("./db/share_production_history_with_authenticated_team_2026_10_13.sql");
const productionSummaryMigration = read("./db/shared_production_summary_2026_10_13.sql");
const securityDefinerFix = read("./db/privilege_hardening_security_definer_2026_10_13.sql");
const pinOnlyMigration = read("./db/pin_only_login_2026_10_11.sql");
const schema = read("./db/schema.sql");

// Recipe default must remain aligned in live UI defaults and fresh-install schema.
assert.match(app, /code:'yeast', name:'Yeast', qty:\.055, unit:'kg', note:'Default 55 g; operational range 35–55 g'/, "UI default yeast must be 55 g per mishok");
assert.match(schema, /'yeast',0\.055::numeric,'kg','Default 55 g; operational range 35–55 g\.'/ , "fresh-install schema must seed 55 g yeast");
const worker = read("./app/sw.js");
const html = read("./app/index.html");
const stylesCss = read("./app/styles.css");
const dashboardCss = read("./app/dashboard.css");
const interactiveCss = read("./app/interactive.css");
const mobileCss = read("./app/mobile.css");
const i18n = read("./app/i18n.js");

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
assert.match(worker, /doughflow-v\d+-\d{8}-[a-z0-9-]+/);
const interactive = read("./app/interactive.css");
assert.match(app, /uiIcon\('users',24\)/, "More menu people icon must use the shared SVG icon helper");
assert.match(app, /Array\.from\(x\)\[0\]/, "Profile initials must handle Unicode names safely");
assert.match(read("./app/styles.css"), /more-icon svg/, "More menu SVG icons must have explicit dimensions");
assert.match(read("./app/styles.css"), /avatar::before,.avatar::after/, "Profile avatar must not inherit decorative overlay icons");

assert.match(app, /function uiIcon\(/);
assert.match(app, /function wireInteractiveCards\(/);
assert.doesNotMatch(app, /Bakery Simulator|simulatorHTML|renderSimulator|wireSimulatorInteractions|quest-panel|renderQuest|questPlay|questReward/i, "remove the simulator and fake quest game from the app");
assert.match(app, /data-tilt/);
assert.match(app, /timeZone:\(appSettings\?\.timezone\|\|'Asia\/Bishkek'\)/, "business time zone must come from saved settings with a safe default");
assert.doesNotMatch(interactive, /\.simulator-[\w-]+|\.sim-[\w-]+|\.quest-[\w-]+/i, "remove unused game styles to keep the mobile bundle lean");
assert.doesNotMatch(read("./app/styles.css"), /\.simulator-[\w-]+|\.sim-[\w-]+|\.quest-[\w-]+/i, "remove unused game styles from base CSS");
assert.match(worker, /doughflow-v\d+-\d{8}-[a-z0-9-]+/);
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
assert.match(app, /let dashboardSackSelection=0/, "Home sack selection must live outside the dashboard DOM");
assert.match(app, /let selected=dashboardSackSelection/, "rerendered dashboard must restore selected sack count");
assert.match(app, /dashboardSackSelection=selected/, "each sack selection must be saved to persistent in-page state");
assert.match(app, /if\(dashboardScrollY>0\)requestAnimationFrame\(/, "dashboard rerenders must restore the mobile scroll position");
assert.ok(dashboard.includes("<button type='button' class='dashboard-sack-btn' data-dashboard-sack='"), "Home sack choices must never submit a surrounding form");
assert.match(app, /navigateTo\(b\.dataset\.route\)/, "navigation buttons should use fast route switching");

const heroImageSection = app.slice(app.indexOf("const DEFAULT_SLIDESHOW ="), app.indexOf("const defaultSlideUrl="));
assert.equal((heroImageSection.match(/\{file:/g) || []).length, 10, "hero carousel should define ten default photo slides");
assert.ok(heroImageSection.includes("01-baker-tandoor-hd-20261012.webp") && heroImageSection.includes("02-leposhka-closeup-hd-20261012.avif"), "HD hero gallery should use the available high-resolution images");
assert.match(worker, /doughflow-v\d+-\d{8}-[a-z0-9-]+/, "service worker cache version must change when the gallery changes");
for (const image of ["01-baker-tandoor-hd-20261012.webp","02-leposhka-closeup-hd-20261012.avif","03-bishkek-context.webp","04-bread-delivery-owner.webp","05-bread-delivery-worker.webp","06-van-bread-stock.webp","07-bakery-team.webp","08-bakery-team-selfie.webp","09-team-social.webp","10-oven-production.webp"]) assert.ok(worker.includes("./assets/doughflow-gallery/"+image), "service worker must precache gallery image "+image);
for (const image of ["01-baker-tandoor-hd-20261012.webp","02-leposhka-closeup-hd-20261012.avif"]) assert.ok(worker.includes("./assets/doughflow-gallery/"+image), "service worker must precache selected HD gallery image "+image);

assert.ok(app.includes("data-hero-carousel") && app.includes("data-hero-next") && app.includes("data-hero-prev"), "hero photo carousel controls should be interactive");
assert.ok(app.includes("showHeroPhoto(activeHero+1),3000"), "hero photos should rotate every three seconds");
assert.ok(app.includes("const heroImages=DEFAULT_SLIDESHOW.map"), "hero must render its selected photo gallery from saved settings");
for (const image of ["01-baker-tandoor-hd-20261012.webp","02-leposhka-closeup-hd-20261012.avif"]) assert.ok(app.includes(image), "selected hero gallery must include "+image);
for (const image of ["01-baker-tandoor-hd-20261012.webp","02-leposhka-closeup-hd-20261012.avif"]) assert.ok(worker.includes("./assets/doughflow-gallery/"+image), "service worker must precache selected authentic gallery image "+image);
assert.match(worker, /doughflow-v\d+-\d{8}-[a-z0-9-]+/, "service worker cache version must change when gallery assets are replaced");
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



assert.match(app, /Sacks recorded this month/, "report must show selected-month sack totals");
assert.match(app, /productionByDate=new Map/, "report must map real production entries by date");
assert.match(app, /reportReconcileNote|notebookSacks/, "report must detect notebook/prod discrepancies rather than silently double-count");
assert.match(app, /Average pieces per sack/, "report must report the average piece count per sack");
assert.match(app, /const label=item\.fraction<1\?\x27Half sack \x27/, "production batch items must preserve half-sack labelling");
assert.match(app, /pieces_in_sack/, "notebook values must use piece counts, not gram weights");
assert.match(app, /notebook_sack_entries/, "notebook must use the semantically named table");
assert.doesNotMatch(app.slice(app.indexOf("async function renderReports(p){"), app.indexOf("async function renderUsers(p){")), /weight_g|Average piece weight|<small>g<\/small>/, "sack counts must not be rendered as weights");
assert.match(app, /selected-month|this month/, "monthly summary must be scoped to selected month");
assert.match(app, /dailyMap\.set\(date/, "report must merge daily notebook and production records");
assert.match(app, /Formal production records take priority/, "production takes priority on overlapping dates to avoid double-counting");
assert.match(app, /Total pieces recorded today/, "each daily card must show the sum of its sack piece counts");
assert.match(app, /report-alltime-strip/, "report must retain combined all-time totals");
assert.match(app, /reportMonthSelect/, "reports must support selecting a month");
assert.match(app, /allMonths/, "monthly reports must derive available months from all notebook records");
assert.match(app, /report-alltime-strip/, "monthly reports must retain all-time notebook totals");
assert.match(app, /jumpStockCorrection/, "stock tab must offer a shortcut to dated corrections");
assert.match(app, /jumpStockLedger/, "stock tab must offer a shortcut to movement history");
assert.match(mobileCss, /report-month-toolbar/, "monthly report selector needs responsive styling");
assert.match(mobileCss, /stock-quick-actions/, "stock shortcuts need responsive styling");

assert.match(app, /stock-material-grid/, "inventory should use the compact ingredient grid");
assert.match(app, /stock-section-heading/, "inventory should have a clear ingredient overview heading");
assert.match(app, /Fix a stock balance/, "inventory should surface quick stock correction actions");
assert.match(mobileCss, /stock-material-grid/, "compact stock grid must have responsive styling");
assert.match(mobileCss, /stock-material-icon/, "stock cards must display ingredient icons");

assert.match(app, /async function renderSettings\(p\)/, "admin settings page must exist");
assert.match(app, /settings:renderSettings/, "settings route must be registered");
assert.match(app, /from\('app_settings'\)\.upsert/, "workspace settings must persist in the shared database");
assert.match(app, /settingsExport/, "settings must provide operational data backup export");
assert.match(mobileCss, /settings-module-grid/, "settings module shortcuts need responsive styling");

assert.match(app, /settingHomeSubtitle/, "admin can edit the home welcome line");
assert.match(app, /homeSubtitle\|\|'Let’s make great leposhka today!'/, "home welcome line is read from saved settings");
assert.match(mobileCss, /data-low-stock-alerts="false"/, "low-stock alert preference controls the inventory UI");
assert.match(mobileCss, /data-compact-stock-cards="true"/, "compact stock preference controls inventory cards");

assert.match(app, /Home slideshow photos/, "admin settings must include the home slideshow editor");
assert.match(app, /data-slide-upload/, "admin can select replacement slideshow photos");
assert.match(app, /supabase\.storage\.from\('doughflow-slideshow'\)\.upload/, "slideshow uploads use shared storage");
assert.match(app, /data-slide-reset/, "admin can restore each default slideshow photo");
assert.match(app, /appSettings\.slideshow\?\.\[index\]\?\.url/, "home carousel renders admin-selected photos");
assert.match(mobileCss, /settings-slideshow-grid/, "slideshow editor is responsive");

assert.match(app, /const productionByDate=new Map\(\)/, "monthly reports must map saved production runs by date");
assert.match(app, /Formal production records take priority/, "reports must avoid double-counting dates with both production and notebook records");
assert.match(app, /supabase\.from\('production_runs'\)[\s\S]{0,350}\.range\(offset,offset\+pageSize-1\)/, "Reports must fetch dated production history beyond the dashboard's recent-record cache");
assert.match(app, /p\.dataset\.reportMonth=event\.target\.value/, "month selection must update the displayed report");
assert.match(app, /today\(\)\.slice\(0,7\)/, "current month must be available automatically");
assert.match(mobileCss, /report-reconcile-note/, "source mismatches must be visible rather than silently double-counted");

 
// Shared production records must feed every authenticated team report, without granting write access.
assert.ok(productionTeamRead.includes("production_runs_team_read") && productionTeamRead.includes("TO authenticated") && productionTeamRead.includes("USING (true)"), "authenticated team can read shared production runs");
assert.ok(productionTeamRead.includes("production_batches_team_read") && productionTeamRead.includes("FOR SELECT"), "team can read batch output for reports");
assert.ok(productionTeamRead.includes("production_materials_team_read") && productionTeamRead.includes("is_role('hamurchi'::app_role)"), "only Admin and Hamurchi can read ingredient input details");
assert.ok(app.includes("const todayProduction=productionRows.filter(run=>String(run.production_date)===today())"), "Reports must attach today's saved production automatically");
assert.ok(app.includes("todayProductionPieces=todayProduction.reduce"), "Reports must calculate today's actual pieces from saved batches");

assert.ok(productionSummaryMigration.includes("auth.uid() IS NOT NULL") && productionSummaryMigration.includes("REVOKE ALL ON FUNCTION public.production_summary(date,date) FROM PUBLIC, anon"), "production summary must require authentication and block anonymous execution");
assert.ok(productionSummaryMigration.includes("GRANT EXECUTE ON FUNCTION public.production_summary(date,date) TO authenticated, service_role"), "authenticated team members must be able to load aggregate production totals");
assert.ok(schema.includes("auth.uid() is not null") && schema.includes("from public, anon"), "fresh schema must use the same safe shared production summary");

assert.match(app, /function scrollAppToTop\(\)/, "page navigation must reset scroll position");
assert.match(app, /if\(nextRoute===route\)\{[\s\S]{0,250}return;/, "tapping the active route must not reset its in-progress form");
assert.match(app, /doughflow-production-form-draft/, "Production entries must survive form re-renders");
assert.match(app, /id="refreshReports"/, "Reports must provide a manual refresh action");
assert.match(app, /inventoryAuditResult=await supabase\.rpc\('admin_inventory_audit'/, "complete backup must include inventory audit history");
assert.match(app, /inventoryAudit:inventoryAuditResult\.data\|\|\[\]/, "backup must serialize inventory audit history");
assert.ok(securityDefinerFix.includes("REVOKE ALL ON FUNCTION public.verify_pin_login(text,text) FROM PUBLIC, anon, authenticated"), "PIN verification must be callable only by the server service role");
assert.ok(securityDefinerFix.includes("GRANT EXECUTE ON FUNCTION public.verify_pin_login(text,text) TO service_role"), "the PIN-login Edge Function service role must retain execute permission");
assert.ok(securityDefinerFix.includes("REVOKE ALL ON FUNCTION public.complete_production(date,numeric,uuid,jsonb,jsonb) FROM PUBLIC, anon"), "production save RPC must not be directly callable by anonymous users");

assert.doesNotMatch(app, /hero-shift-pill|Shift schedule|shiftStatus=shiftActive/, "Home dashboard should stay clean without the shift schedule widget");
assert.doesNotMatch(app, /dashboard-admin-notes|settingAdminNotes/, "redundant admin notes should not clutter Home or Settings");
assert.doesNotMatch(app, /stockNote|stockCorrectionReason|Why are you removing this entry\?/, "inventory forms should not require manual reason/note prompts");
assert.ok(app.includes("if(appSettings.confirmDestructiveActions&&!window.confirm('Remove this historical stock entry?"), "inventory deletion must respect the destructive-action setting");
assert.match(app, /confirmDestructiveActions&&!window\.confirm\('Confirm dated stock correction\?/, "date-wise stock corrections must respect confirmation settings");
assert.match(app, /confirmDestructiveActions&&!confirm\('Restore the original slideshow photo/, "slideshow restore must respect confirmation settings");

assert.match(app, /const todaySummary=!isDemo\?liveState\.summaryToday:null/, "Home daily production KPIs must use the all-user production aggregate when available");
assert.match(app, /todaySummary\?Number\(todaySummary\.total_sacks\)/, "Home sack total must use the connected daily aggregate");
assert.match(app, /todaySummary\?Number\(todaySummary\.total_pieces\)/, "Home piece total must use the connected daily aggregate");
assert.match(app, /fetchAll\(\(\)=>supabase\.from\('profiles'\)\.select\('id,full_name,role,preferred_language,created_at,updated_at'\)/, "full operational backup must include non-secret staff profile metadata");
assert.match(app, /version:4,exportedAt/, "operational backup schema must be versioned after adding staff metadata");

assert.ok(app.includes("contentOverrides:{productionTitle:"), "admin page text overrides must be stored in shared settings");
assert.ok(app.includes("siteText('reportsTitle','Reports')") && app.includes("siteText('salesTitle','Sales')") && app.includes("siteText('naanTitle','Naan / Leposhka')"), "Reports, Sales and Naan titles must use saved admin text overrides");
assert.ok(app.includes("data-page-media-upload") && app.includes("persistMediaOverrides"), "admin must be able to replace additional page background photos");
assert.ok(app.includes("mediaOverrides:appSettings.mediaOverrides||{}"), "settings saves must preserve media overrides");
assert.match(app, /--df-mountain-image/);
assert.match(app, /--df-bread-image/);
assert.match(app, /--df-login-image/);
assert.match(stylesCss, /var\(--df-mountain-image/);
assert.match(stylesCss, /var\(--df-bread-image/);
assert.match(dashboardCss, /var\(--df-bread-image/);
assert.match(interactiveCss, /var\(--df-login-image/);

assert.ok(app.includes("appSettings.mediaOverrides?.leposhkaEmblem||'./assets/leposhka-emblem.svg'"), "production emblem must use the saved admin media override");
assert.ok(app.includes("'leposhkaEmblem','Production Leposhka emblem'"), "Settings must expose the production emblem replacement");

assert.ok(app.includes("defaultPageMediaUrl(key)"), "restoring a page photo must return its preview to the original image");
assert.ok(app.includes("const defaultPageMediaUrl=key=>"), "each editable page background must have a defined default");


// Automatic mishok timetable: one anchor-time input drives the entire schedule.
assert.ok(app.includes('id="openAutoTimetable"'), "Production must provide a separate automatic timetable action without cluttering Home");
assert.ok(app.includes('id="timetableSecondTime"'), "Timetable must use one time input for the second mishok");
assert.ok(app.includes("index===0?anchorMinutes-120:anchorMinutes+(index-1)*90"), "First mishok must be two hours before the second; later mishoks must be spaced 90 minutes apart");
assert.ok(app.includes("localStorage.setItem('doughflow_auto_mishok_timetable_v1'"), "The chosen anchor time must be remembered automatically on the device");
assert.ok(app.includes('id="timetableMinuteHand"') && app.includes('id="timetableHourHand"'), "The timetable must include a live analog clock preview");
assert.ok(mobileCss.includes(".auto-timetable-overlay[hidden]") && mobileCss.includes("@media(max-width:640px)"), "The timetable must have hidden-state and mobile-responsive styling");
assert.ok(i18n.includes("'Automatic mishok timetable'") && i18n.includes("'Auto timetable'"), "The new timetable interface must include Russian and Kyrgyz translations");


// Automatic end-time estimate: a daily count of five means finish three hours after mishok 5 starts (the time of mishok 7).
assert.ok(app.includes('id="timetableMishokCount"'), "The automatic timetable must ask for today's mishok count");
assert.ok(app.includes("anchorMinutes+(mishokCount+1)*90"), "Estimated end time must be three hours after the counted mishok start");
assert.ok(app.includes("const endSlotNumber=mishokCount+2"), "End-time detail must identify the equivalent later mishok slot");
assert.ok(app.includes("id="+"\\"+"ttEndTime"+"\\"), "The automatic end time must be visibly rendered");
assert.ok(app.includes("addEventListener('input',renderAutoTimetable)"), "Changing the mishok count must instantly recalculate the end time");
assert.ok(mobileCss.includes(".auto-end-time-card") && mobileCss.includes(".auto-end-result"), "The end-time estimator must be professionally styled for mobile");
assert.ok(i18n.includes("'How many mishoks will you make today?'") && i18n.includes("'Бүгүн канча мишок жасайсыз?'"), "The end-time estimator must include English, Russian, and Kyrgyz UI text");
