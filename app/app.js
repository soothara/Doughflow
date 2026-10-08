import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import './config.js';
import { LANGUAGES, getSavedLang, saveLang, languageOptions, t, applyTranslations } from './i18n.js';

const CFG = window.DOUGHFLOW_CONFIG || { supabaseUrl:'', supabaseAnonKey:'', appName:'DoughFlow' };
const isDemo = !(CFG.supabaseUrl && CFG.supabaseAnonKey);
const supabase = isDemo ? null : createClient(CFG.supabaseUrl, CFG.supabaseAnonKey);

const MATERIALS = [
  {code:'flour', name:'Flour', unit:'kg', decimals:2, packages:[{label:'Bulk',qty:1}]},
  {code:'water', name:'Water', unit:'kg', decimals:2, packages:[{label:'Bulk',qty:1}]},
  {code:'oil', name:'Oil', unit:'kg', decimals:2, packages:[{label:'20 kg carton',qty:20}]},
  {code:'salt', name:'Salt', unit:'kg', decimals:3, packages:[{label:'1 kg packet',qty:1},{label:'750 g packet',qty:.75},{label:'20 × 1 kg bundle',qty:20}]},
  {code:'sugar', name:'Sugar', unit:'kg', decimals:2, packages:[{label:'Bulk',qty:1}]},
  {code:'yeast', name:'Yeast', unit:'kg', decimals:3, packages:[{label:'500 g packet',qty:.5},{label:'20 × 500 g box',qty:10}]}
];

const DEFAULT_RECIPE = [
  {code:'flour', name:'Flour', qty:50, unit:'kg', note:'1 operational mishok; actual batch can be 48–52 kg and is still counted as 1 mishok'},
  {code:'water', name:'Water', qty:31.2, unit:'kg', note:'Combined water; no hot/cold split'},
  {code:'oil', name:'Oil', qty:1, unit:'kg', note:'Standard 20 kg carton packaging'},
  {code:'yeast', name:'Yeast', qty:.045, unit:'kg', note:'Default 45 g; operational range 35–55 g'},
  {code:'salt', name:'Salt', qty:1.2, unit:'kg', note:'1 kg or 750 g packets'},
  {code:'sugar', name:'Sugar', qty:.5, unit:'kg', note:''}
];

const KEY='doughflow_demo_v1';
const uid=()=>crypto.randomUUID();
const today=()=>new Date().toISOString().slice(0,10);
const fmt=n=>Number(n||0).toLocaleString(undefined,{maximumFractionDigits:3});
const money=n=>Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function seed(){
  if(localStorage.getItem(KEY)) return JSON.parse(localStorage.getItem(KEY));
  const data={
    session:{user:{id:'demo-admin',name:'Admin'},role:'admin',lang:'en'},
    recipe:{version:1,updatedAt:new Date().toISOString(),updatedBy:'Admin',items:DEFAULT_RECIPE},
    productions:[],
    inventory:MATERIALS.reduce((a,m)=>{a[m.code]={stock:0,tx:[]};return a;},{}),
    users:[
      {id:'demo-admin',name:'Admin',role:'admin'},
      {id:'demo-hamurchi',name:'Hamurchi',role:'hamurchi'},
      {id:'demo-naan',name:'Naan/Leposhka Maker',role:'naan'},
      {id:'demo-sales',name:'Salesman',role:'sales'}
    ]
  };
  localStorage.setItem(KEY,JSON.stringify(data));
  return data;
}
let db = isDemo ? seed() : null;
let currentUser = null;
let lang = getSavedLang('guest');
let liveState = {recipe:null, productions:[], balances:[], users:[]};
let route='dashboard';

const app=document.getElementById('app');
const modalRoot=document.getElementById('modalRoot');

function saveDemo(){ if(isDemo) localStorage.setItem(KEY,JSON.stringify(db)); }
function roleName(r){return ({admin:t('Admin',lang),hamurchi:t('Hamurchi',lang),naan:t('Naan / Leposhka Maker',lang),sales:t('Salesman',lang)})[r]||r;}
function setLanguage(next){ lang=saveLang(currentUser?.id||'guest',next); if(currentUser) currentUser.lang=lang; if(isDemo && db?.session) { db.session.lang=lang; saveDemo(); } render(); if(!isDemo) { supabase.from('profiles').update({preferred_language:lang}).eq('id',currentUser.id).then(()=>{}); } }
function languageSwitcher(){ return `<select id="languageSelect" class="language-select" aria-label="Language">${languageOptions(lang)}</select>`; }
function applyCurrentLanguage(){ applyTranslations(document,lang); const sel=document.getElementById('languageSelect'); if(sel) sel.value=lang; document.documentElement.lang = lang==='ru'?'ru':lang==='ky'?'ky':'en'; }
function can(role, section){
  if(section==='more') return true;
  if(role==='admin') return true;
  if(role==='hamurchi') return ['dashboard','production','recipe'].includes(section);
  if(role==='naan') return ['dashboard','naan'].includes(section);
  if(role==='sales') return ['dashboard','sales'].includes(section);
  return false;
}
function navItems(role){
  const base=[['dashboard','⌂','Home']];
  if(role==='admin'||role==='hamurchi') base.push(['production','🥣','Production']);
  if(role==='admin') base.push(['inventory','📦','Stock']);
  if(role==='admin'||role==='hamurchi') base.push(['recipe','🧪','Recipe']);
  if(role==='naan') base.push(['naan','🫓','Naan']);
  if(role==='sales') base.push(['sales','💰','Sales']);
  base.push(['more','•••','More']);
  return base;
}
async function init(){
  if(!isDemo){
    const {data:{session}}=await supabase.auth.getSession();
    if(session) await loadUser(session.user);
    supabase.auth.onAuthStateChange(async (_e,s)=>{
      if(s){ await loadUser(s.user); await refreshLiveState(); render(); }
      else { currentUser=null; render(); }
    });
  } else {
    currentUser=db.session.user ? {...db.session.user,role:db.session.role,lang:db.session.lang||getSavedLang(db.session.user.id)} : null;
    lang=currentUser?.lang||lang;
  }
  if(!isDemo && currentUser) await refreshLiveState();
  render();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
}

async function loadUser(user){
  const {data,error}=await supabase.from('profiles')
    .select('id,full_name,role,preferred_language')
    .eq('id',user.id).single();
  if(error){
    currentUser={id:user.id,name:user.email||'User',role:'hamurchi',lang:getSavedLang(user.id)};
    lang=currentUser.lang;
  }else{
    currentUser={id:user.id,name:data.full_name||user.email||'User',role:data.role,lang:data.preferred_language||getSavedLang(user.id)};
    lang=currentUser.lang;
    saveLang(user.id,lang);
  }
}

async function refreshLiveState(){
  if(isDemo) return;
  const {data:rv}=await supabase.from('recipe_versions')
    .select('id,version_number,note,created_at,recipe_items(id,material_code,qty_per_mishok,unit,note,sort_order)')
    .eq('active',true).order('version_number',{ascending:false}).limit(1).maybeSingle();
  liveState.recipe=rv?{
    id:rv.id,version:rv.version_number,
    items:(rv.recipe_items||[]).sort((a,b)=>a.sort_order-b.sort_order).map(x=>({
      code:x.material_code,
      name:MATERIALS.find(m=>m.code===x.material_code)?.name||x.material_code,
      qty:Number(x.qty_per_mishok),unit:x.unit,note:x.note||''
    }))
  }:null;
  const {data:runs}=await supabase.from('production_runs')
    .select('id,production_date,created_by,mishok_count,recipe_version_id,created_at,production_batches(batch_no,mishok_fraction,pieces),production_materials(material_code,expected_qty,actual_qty,unit)')
    .order('created_at',{ascending:false}).limit(200);
  liveState.productions=runs||[];
  const {data:balances}=await supabase.from('inventory_balances').select('*');
  liveState.balances=balances||[];
  if(currentUser?.role==='admin'){
    const {data:users}=await supabase.from('profiles').select('id,full_name,role').order('full_name');
    liveState.users=users||[];
  }
}

function render(){
  if(!currentUser){ app.innerHTML=loginHTML(); wireLogin(); applyCurrentLanguage(); document.getElementById('languageSelect')?.addEventListener('change',e=>setLanguage(e.target.value)); return; }
  if(!can(currentUser.role,route)) route='dashboard';
  app.innerHTML=appShellHTML();
  document.querySelectorAll('[data-route]').forEach(b=>b.addEventListener('click',()=>{route=b.dataset.route;render();}));
  document.getElementById('logout')?.addEventListener('click',logout);
  renderPage();
  applyCurrentLanguage();
  document.getElementById('languageSelect')?.addEventListener('change',e=>setLanguage(e.target.value));
}

function loginHTML(){
  return `<div class="login-wrap"><div class="login-card"><div style="display:flex;justify-content:flex-end;margin-bottom:8px"><select id="languageSelect" class="language-select" aria-label="Language">${languageOptions(lang)}</select></div><div class="logo-large">DF</div><h1>DoughFlow</h1><p>Production + inventory management for your bakery workflow.</p>${isDemo?`<div class="alert info">Demo mode is active. Choose a role below. Real multi-user login is enabled after you connect Supabase.</div><div class="grid grid-2">${['admin','hamurchi','naan','sales'].map(r=>`<button class="btn ${r==='admin'?'primary':'secondary'} demo-login" data-role="${r}">${roleName(r)}</button>`).join('')}</div>`:`<form id="loginForm"><div class="field"><label>Email</label><input required type="email" name="email" autocomplete="username"></div><div class="field"><label>Password</label><input required type="password" name="password" autocomplete="current-password"></div><button class="btn primary" style="width:100%">Sign in</button><div id="loginError" class="small" style="margin-top:10px;color:#b91c1c"></div></form>`}</div></div>`;
}
function wireLogin(){
  if(isDemo){document.querySelectorAll('.demo-login').forEach(b=>b.addEventListener('click',()=>{db.session={user:{id:`demo-${b.dataset.role}`,name:roleName(b.dataset.role)},role:b.dataset.role,lang:getSavedLang(`demo-${b.dataset.role}`)};currentUser={id:db.session.user.id,name:db.session.user.name,role:b.dataset.role,lang:db.session.lang};lang=currentUser.lang;route='dashboard';saveDemo();render();}));return;}
  document.getElementById('loginForm')?.addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const {error}=await supabase.auth.signInWithPassword({email:f.get('email'),password:f.get('password')});if(error)document.getElementById('loginError').textContent=error.message;});
}
async function logout(){ if(isDemo){db.session=null;currentUser=null;lang=getSavedLang('guest');saveDemo();render();return;} await supabase.auth.signOut(); }

function appShellHTML(){
  const items=navItems(currentUser.role);
  const initials=String(currentUser.name||'U').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
  return `
    <div class="topbar">
      <div class="brand">
        <div class="brand-mark">DF</div>
        <div class="brand-copy"><strong>DoughFlow</strong><span>Bakery control</span></div>
      </div>
      <div class="top-actions">
        <div class="user-chip"><span class="avatar">${esc(initials)}</span><span class="user-meta"><b>${esc(currentUser.name)}</b><small>${roleName(currentUser.role)}</small></span></div>
        ${languageSwitcher()}
      </div>
    </div>
    <div class="layout">
      <aside class="sidebar">
        <div class="role-pill">${roleName(currentUser.role)}</div>
        <nav class="nav">${items.map(([r,ic,l])=>`<button data-route="${r}" class="${r===route?'active':''}" aria-label="${esc(l)}"><span class="nav-icon">${ic}</span><span>${l}</span></button>`).join('')}</nav>
      </aside>
      <main><div class="page" id="page"></div></main>
    </div>`;
}
function renderPage(){
  const p=document.getElementById('page');
  const pages={
    dashboard:renderDashboard,
    production:renderProduction,
    recipe:renderRecipe,
    inventory:renderInventory,
    reports:renderReports,
    users:renderUsers,
    naan:()=>placeholderPanel('Naan / Leposhka Maker','This panel is reserved for the exact workflow you will provide next.'),
    sales:()=>placeholderPanel('Salesman','This panel is reserved for the exact sales workflow you will provide next.'),
    more:renderMore
  };
  (pages[route]||renderDashboard)(p);
}
function renderMore(p){
  const extra=[];
  if(currentUser.role==='admin') extra.push(
    ['inventory','📦','Stock & inventory','See balances and stock movements'],
    ['reports','📊','Reports','Review production and usage'],
    ['users','👥','People','Manage staff and roles'],
    ['naan','🫓','Naan / Leposhka','Open the naan workflow'],
    ['sales','💰','Sales','Open the sales workspace'],
    ['recipe','🧪','Recipe','Edit the working recipe']
  );
  else if(currentUser.role==='hamurchi') extra.push(
    ['recipe','🧪','Recipe','Edit the working recipe']
  );
  else if(currentUser.role==='naan') extra.push(
    ['naan','🫓','Naan / Leposhka','Open the naan workflow']
  );
  else if(currentUser.role==='sales') extra.push(
    ['sales','💰','Sales','Open the sales workspace']
  );

  p.innerHTML=`
    <div class="page-head compact-head">
      <div><div class="eyebrow">More</div><h1>Everything else</h1><p>Keep the daily workflow focused. Less-used tools live here.</p></div>
    </div>
    <div class="more-grid">
      ${extra.map(([r,icon,title,desc])=>`<button class="more-card" data-more-route="${r}"><span class="more-icon">${icon}</span><span><b>${title}</b><small>${desc}</small></span><span class="chevron">›</span></button>`).join('')}
      <button class="more-card danger-card" id="moreLogout"><span class="more-icon">↪</span><span><b>Log out</b><small>Sign out from this device</small></span><span class="chevron">›</span></button>
    </div>`;
  p.querySelectorAll('[data-more-route]').forEach(b=>b.addEventListener('click',()=>{route=b.dataset.moreRoute;render();}));
  p.querySelector('#moreLogout')?.addEventListener('click',logout);
}
function renderDashboard(p){
  const prod=isDemo?db.productions:liveState.productions;
  const todayRuns=prod.filter(x=>(isDemo?x.date:x.production_date)===today());
  const totalM=todayRuns.reduce((a,b)=>a+Number(isDemo?b.mishokCount:b.mishok_count),0);
  const totalPieces=todayRuns.reduce((a,b)=>a+(isDemo?b.batches:(b.production_batches||[])).reduce((s,z)=>s+Number(z.pieces||0),0),0);
  const stockRows=MATERIALS.map(m=>{const s=getStock(m.code);return {...m,stock:s};});
  const firstName=esc(currentUser.name.split(' ')[0]);
  p.innerHTML=`
    <div class="welcome">
      <div><div class="eyebrow">${today()}</div><h1>Good day, ${firstName}</h1><p>Your bakery at a glance.</p></div>
      ${currentUser.role==='admin'?'<button class="btn primary hero-btn" id="quickProduction">＋ New production</button>':''}
    </div>
    <div class="stats-grid">
      <div class="stat-card emphasis"><span>Today</span><strong>${fmt(totalM)}</strong><small>mishoks</small></div>
      <div class="stat-card"><span>Output</span><strong>${fmt(totalPieces)}</strong><small>pieces</small></div>
      <div class="stat-card"><span>Runs</span><strong>${todayRuns.length}</strong><small>production runs</small></div>
      <div class="stat-card"><span>Recipe</span><strong>v${db?.recipe?.version||liveState.recipe?.version||1}</strong><small>active version</small></div>
    </div>
    <div class="section-head"><div><h2>Stock</h2><p>Current balance by material.</p></div>${currentUser.role==='admin'?'<button class="text-button" id="openInventory">View all</button>':''}</div>
    <div class="card stock-card"><div class="stock-list">
      ${stockRows.map(m=>`<div class="stock-row"><div class="stock-name"><span class="stock-dot ${m.stock<=0?'danger':m.stock<10?'warn':'ok'}"></span><b>${esc(m.name)}</b></div><span class="stock-value">${fmt(m.stock)} ${m.unit}</span></div>`).join('')}
    </div></div>
    <div class="quick-strip"><span class="quick-icon">✦</span><div><b>Keep it simple</b><small>1 full mishok = 1.0 · half = 0.5 · pieces are actual.</small></div></div>`;
  document.getElementById('quickProduction')?.addEventListener('click',()=>{route='production';render();});
  document.getElementById('openInventory')?.addEventListener('click',()=>{route='inventory';render();});
}
function roleDashboard(p){
  if(currentUser.role==='hamurchi') p.innerHTML=`<div class="grid grid-2"><div class="card"><h2>Today</h2><div class="kpi">${isDemo?fmt(db.productions.filter(x=>x.date===today()&&x.createdBy===currentUser.name).reduce((a,b)=>a+b.mishokCount,0)):'—'} mishok</div><div class="small">Enter your mishoks and actual pieces from the Production panel.</div></div><div class="card"><h2>Recipe</h2><div class="kpi">v${db?.recipe?.version||1}</div><div class="small">You may update the working recipe. Future production uses the new version.</div></div></div>`;
  else if(currentUser.role==='naan') p.innerHTML=`<div class="card"><h2>Naan / Leposhka</h2><div class="notice">Panel ready. We will add the exact process after you provide it.</div></div>`;
  else if(currentUser.role==='sales') p.innerHTML=`<div class="card"><h2>Sales</h2><div class="notice">Panel ready. We will add the exact sales process after you provide it.</div></div>`;
}

function batchesFor(mishokCount){
  const full=Math.floor(Number(mishokCount));
  const half=Number(mishokCount)-full;
  const out=[];
  for(let i=1;i<=full;i++) out.push({batchNo:i,mishok:1,pieces:''});
  if(half>0) out.push({batchNo:full+1,mishok:half,pieces:''});
  return out;
}

function renderProduction(p){
  const existing=isDemo?db.productions.filter(x=>x.date===today()):liveState.productions.filter(x=>x.production_date===today());
  const recipe=isDemo?db.recipe:liveState.recipe;
  p.innerHTML=`<div class="page-head compact-head"><div><div class="eyebrow">Daily workflow</div><h1>Production</h1><p>Choose the batch size, enter actual pieces, then complete.</p></div></div><div class="grid grid-2"><div class="card"><h2>New production</h2><div class="field"><label>Mishok count</label><div class="mishok-picker"><button type="button" class="mishok-choice active" data-mishok="1">1</button><button type="button" class="mishok-choice" data-mishok="1.5">1.5</button><button type="button" class="mishok-choice" data-mishok="2">2</button><button type="button" class="mishok-choice" data-mishok="3">3</button></div><input id="mishokCount" class="sr-only" type="number" min="0.5" step="0.5" value="1"></div><div id="batchEditor"></div><div style="height:10px"></div><h3>Material consumption</h3><div id="consumptionEditor"></div><div class="notice" style="margin:12px 0">Mishok is an operational unit. Full = 1.0, half = 0.5. Actual batch flour may be around 48–52 kg (or half-batch around 24–27 kg) without changing the mishok count.</div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" id="saveProduction">Complete production</button><button class="btn secondary" id="clearProduction">Clear</button></div></div><div class="card"><h2>Today’s production</h2>${existing.length?`<div class="table-wrap"><table><thead><tr><th>Time</th><th>Mishok</th><th>Pieces</th><th>Recipe</th></tr></thead><tbody>${existing.map(r=>{const bs=isDemo?r.batches:r.production_batches||[]; return `<tr><td>${esc(isDemo?r.timeLabel:new Date(r.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}))}</td><td>${fmt(isDemo?r.mishokCount:r.mishok_count)}</td><td>${fmt(bs.reduce((s,z)=>s+Number(z.pieces||0),0))}</td><td>v${isDemo?r.recipeVersion:(liveState.recipe?.version||'—')}</td></tr>`}).join('')}</tbody></table></div>`:'<div class="empty">No production saved today.</div>'}</div></div>`;
  const editor=document.getElementById('batchEditor');
  const consumption=document.getElementById('consumptionEditor');
  const rebuild=()=>{
    const m=Number(document.getElementById('mishokCount').value||0); const bs=batchesFor(m);
    editor.innerHTML=`<h3>Batches</h3>${bs.map((b,i)=>`<div class="batch-row"><div class="batch-index">#${i+1}</div><div class="batch-kind">${b.mishok===1?'1.0':'0.5'} mishok</div><input type="number" min="0" step="1" data-pieces="${i}" placeholder="Actual pieces"></div>`).join('')}`;
    consumption.innerHTML=(recipe?.items||[]).map(it=>{const expected=Number(it.qty||0)*m;return `<div class="field-row"><div class="field"><label>${esc(it.name)} expected (${esc(it.unit)})</label><input class="expected-consumption" data-code="${esc(it.code)}" value="${expected}" disabled></div><div class="field"><label>Actual (${esc(it.unit)})</label><input class="actual-consumption" data-code="${esc(it.code)}" type="number" min="0" step="0.001" value="${expected}"></div></div>`}).join('');
  };
  rebuild();
  document.getElementById('mishokCount').addEventListener('input',()=>{
    document.querySelectorAll('.mishok-choice').forEach(x=>x.classList.toggle('active',Number(x.dataset.mishok)===Number(document.getElementById('mishokCount').value)));
    rebuild();
  });
  document.querySelectorAll('.mishok-choice').forEach(x=>x.addEventListener('click',()=>{
    document.getElementById('mishokCount').value=x.dataset.mishok;
    document.querySelectorAll('.mishok-choice').forEach(y=>y.classList.toggle('active',y===x));
    rebuild();
  }));
  document.getElementById('clearProduction').addEventListener('click',()=>{document.getElementById('mishokCount').value=1;rebuild();});
  document.getElementById('saveProduction').addEventListener('click',async()=>{
    const count=Number(document.getElementById('mishokCount').value||0); if(!(count>0)){alert('Enter a valid mishok count.');return;}
    if(!recipe?.items?.length){alert('No active recipe found.');return;}
    const pieces=[...document.querySelectorAll('[data-pieces]')].map(x=>Number(x.value||0));
    if(pieces.some(x=>x<0)){alert('Piece counts cannot be negative.');return;}
    const consumptionItems=[...document.querySelectorAll('.actual-consumption')].map(el=>({code:el.dataset.code,actual:el.value}));
    if(consumptionItems.some(x=>!Number.isFinite(Number(x.actual))||Number(x.actual)<0)){alert('Consumption values must be valid non-negative numbers.');return;}
    if(isDemo){
      const batches=batchesFor(count).map((b,i)=>({...b,pieces:pieces[i]||0}));
      const now=new Date(); const run={id:uid(),date:today(),timeLabel:now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}),createdBy:currentUser.name,mishokCount:count,batches,recipeVersion:db.recipe.version,consumption:consumptionItems.map(x=>({code:x.code,actual:Number(x.actual)}))};
      db.productions.push(run); applyProductionConsumption(count,run.id,run.consumption); saveDemo(); alert(`Saved ${count} mishok.`); render();
    } else {
      const batchPayload=batchesFor(count).map((b,i)=>({batch_no:i+1,mishok_fraction:b.mishok,pieces:pieces[i]||0}));
      const payload=consumptionItems.map(x=>({material_code:x.code,actual_qty:Number(x.actual)}));
      const recipeId=await activeRecipeId(); const {error}=await supabase.rpc('complete_production',{p_production_date:today(),p_mishok_count:count,p_recipe_version_id:recipeId,p_batches:batchPayload,p_consumption:payload});
      if(error){alert(error.message);return;} await refreshLiveState(); alert('Production saved.'); render();
    }
  });
}

function applyProductionConsumption(count,productionId){
  db.recipe.items.forEach(item=>{
    const qty=Number(item.qty)*count;
    const inv=db.inventory[item.code]||{stock:0,tx:[]};
    inv.stock-=qty;
    inv.tx.push({id:uid(),dir:'out',qty,reason:'Production consumption',productionId,at:new Date().toISOString(),by:currentUser.name});
    db.inventory[item.code]=inv;
  });
}
function getStock(code){ if(isDemo) return Number(db?.inventory?.[code]?.stock||0); return Number(liveState.balances.find(x=>x.code===code)?.stock||0); }

function renderRecipe(p){
  const recipe=isDemo?db.recipe:liveState.recipe;
  if(!recipe){p.innerHTML='<div class="card"><h2>Recipe</h2><div class="alert warn">No active recipe found. Run the database seed SQL first.</div></div>';return;}
  p.innerHTML=`<div class="page-head"><div><h1>Recipe</h1><p>Working recipe per operational mishok. Authorized production users can edit it.</p></div></div><div class="grid grid-2"><div class="card"><h2>v${recipe.version}</h2>${recipe.items.map((it)=>`<div class="field-row" style="align-items:end"><div class="field"><label>${esc(it.name)} (${esc(it.unit)})</label><input class="recipe-qty" data-code="${esc(it.code)}" type="number" step="0.001" value="${it.qty}"><div class="small">${esc(it.note||'')}</div></div><div class="field"><label>Current standard</label><div class="notice">${fmt(it.qty)} ${esc(it.unit)} / mishok</div></div></div>`).join('')}<button class="btn primary" id="saveRecipe">Save as new recipe version</button></div><div class="card"><h2>Packaging rules</h2><div class="table-wrap"><table><thead><tr><th>Material</th><th>Purchase package</th></tr></thead><tbody>${MATERIALS.map(m=>`<tr><td>${esc(m.name)}</td><td>${m.packages.map(x=>esc(x.label)).join('<br>')}</td></tr>`).join('')}</tbody></table></div><div class="notice" style="margin-top:14px">Water is one material. Salt supports 1 kg and 750 g packets. Yeast supports 500 g packets and 20-packet boxes. Oil uses 20 kg cartons.</div></div></div>`;
  document.getElementById('saveRecipe').addEventListener('click',async()=>{
    const items=recipe.items.map((it,i)=>({...it,qty:Number(document.querySelector(`.recipe-qty[data-code="${it.code}"]`).value),sort_order:i}));
    if(items.some(x=>!Number.isFinite(x.qty)||x.qty<0)){alert('Recipe quantities must be valid non-negative numbers.');return;}
    if(isDemo){db.recipe.version+=1;db.recipe.updatedAt=new Date().toISOString();db.recipe.updatedBy=currentUser.name;db.recipe.items=items;saveDemo();alert(`Recipe saved as v${db.recipe.version}.`);render();}
    else {const {error}=await supabase.rpc('create_recipe_version',{p_items:items.map(x=>({code:x.code,qty:x.qty,unit:x.unit,note:x.note||'',sort_order:x.sort_order})),p_note:`Updated by ${currentUser.name}`});if(error){alert(error.message);return;}await refreshLiveState();alert(`Recipe saved as v${liveState.recipe.version}.`);render();}
  });
}

async function renderInventory(p){
  if(currentUser.role!=='admin'){p.innerHTML='<div class="card"><h2>Inventory</h2><div class="alert error">Admin access only.</div></div>';return;}
  if(!isDemo) await refreshLiveState();
  p.innerHTML=`<div class="page-head"><div><h1>Inventory</h1><p>Current theoretical stock plus package-aware receiving.</p></div><button class="btn primary" id="stockIn">+ Stock in</button></div><div class="grid grid-3">${MATERIALS.map(m=>`<div class="card"><div class="kpi-label">${esc(m.name)}</div><div class="kpi">${fmt(getStock(m.code))}</div><div class="small">${m.unit}</div></div>`).join('')}</div><div style="height:16px"></div><div class="card"><h2>Material details</h2><div class="table-wrap"><table><thead><tr><th>Material</th><th>Stock</th><th>Package options</th></tr></thead><tbody>${MATERIALS.map(m=>`<tr><td>${esc(m.name)}</td><td>${fmt(getStock(m.code))} ${m.unit}</td><td>${m.packages.map(x=>esc(x.label)).join(', ')}</td></tr>`).join('')}</tbody></table></div></div>`;
  document.getElementById('stockIn').addEventListener('click',()=>openStockModal());
}

function openStockModal(){
  const opts=MATERIALS.map(m=>`<option value="${m.code}">${esc(m.name)}</option>`).join('');
  modalRoot.innerHTML=`<div class="modal-backdrop show"><div class="modal"><div class="modal-head"><h2>Receive stock</h2><button id="closeModal">×</button></div><div class="field"><label>Material</label><select id="stockMaterial">${opts}</select></div><div id="packageChooser"></div><div class="field"><label>Notes</label><input id="stockNote" placeholder="Supplier / delivery note"></div><div class="modal-footer"><button class="btn secondary" id="cancelModal">Cancel</button><button class="btn primary" id="saveStock">Add stock</button></div></div></div>`;
  const update=()=>{const m=MATERIALS.find(x=>x.code===document.getElementById('stockMaterial').value);document.getElementById('packageChooser').innerHTML=`<div class="field"><label>Package</label><select id="stockPackage">${m.packages.map((x,i)=>`<option value="${i}">${esc(x.label)}</option>`).join('')} </select></div><div class="field"><label>Number of packages</label><input id="packageCount" type="number" min="0.001" step="1" value="1"></div><div class="small">The system will convert package quantity into the inventory base unit.</div>`;};
  update();document.getElementById('stockMaterial').addEventListener('change',update);document.getElementById('closeModal').addEventListener('click',closeModal);document.getElementById('cancelModal').addEventListener('click',closeModal);
  document.getElementById('saveStock').addEventListener('click',async()=>{const code=document.getElementById('stockMaterial').value;const m=MATERIALS.find(x=>x.code===code);const pi=Number(document.getElementById('stockPackage').value);const count=Number(document.getElementById('packageCount').value||0);if(!(count>0))return;const qty=m.packages[pi].qty*count;const reason=document.getElementById('stockNote').value||'Stock received';if(isDemo){const inv=db.inventory[code];inv.stock+=qty;inv.tx.push({id:uid(),dir:'in',qty,packages:count,packageLabel:m.packages[pi].label,reason,at:new Date().toISOString(),by:currentUser.name});saveDemo();closeModal();render();}else{const {error}=await supabase.from('inventory_transactions').insert({material_code:code,direction:'in',qty_base:qty,package_count:count,package_label:m.packages[pi].label,reason,created_by:currentUser.id});if(error){alert(error.message);return;}await refreshLiveState();closeModal();render();}});
}
function closeModal(){modalRoot.innerHTML='';}

function renderReports(p){
  const runs=isDemo?db.productions:liveState.productions; const total=runs.reduce((a,b)=>a+Number(isDemo?b.mishokCount:b.mishok_count),0); const pieces=runs.reduce((a,b)=>a+(isDemo?b.batches:(b.production_batches||[])).reduce((s,z)=>s+Number(z.pieces||0),0),0); const avg=total?pieces/total:0;
  p.innerHTML=`<div class="page-head"><div><h1>Reports</h1><p>Operational summary from saved production.</p></div></div><div class="grid grid-3"><div class="card"><div class="kpi-label">All-time mishoks</div><div class="kpi">${fmt(total)}</div></div><div class="card"><div class="kpi-label">All-time pieces</div><div class="kpi">${fmt(pieces)}</div></div><div class="card"><div class="kpi-label">Pieces / mishok</div><div class="kpi">${fmt(avg)}</div></div></div><div style="height:16px"></div><div class="card"><h2>Production history</h2><div class="table-wrap"><table><thead><tr><th>Date</th><th>Mishok</th><th>Pieces</th><th>Worker</th></tr></thead><tbody>${runs.length?runs.map(r=>`<tr><td>${esc(isDemo?r.date:r.production_date)}</td><td>${fmt(isDemo?r.mishokCount:r.mishok_count)}</td><td>${fmt((isDemo?r.batches:r.production_batches||[]).reduce((a,b)=>a+Number(b.pieces||0),0))}</td><td>${esc(isDemo?r.createdBy:r.created_by===currentUser.id?currentUser.name:'User')}</td></tr>`).join(''):'<tr><td colspan="4" class="empty">No production yet.</td></tr>'}</tbody></table></div></div>`;
}

async function renderUsers(p){
  if(currentUser.role!=='admin'){p.innerHTML='<div class="card"><h2>Users</h2><div class="alert error">Admin access only.</div></div>';return;}
  if(!isDemo) await refreshLiveState();
  const users=isDemo?db.users:liveState.users;
  p.innerHTML=`<div class="page-head"><div><h1>Users</h1><p>Four role model. User creation can be managed in Supabase Auth + profiles.</p></div></div><div class="card"><div class="table-wrap"><table><thead><tr><th>User</th><th>Role</th><th>Access</th></tr></thead><tbody>${users.map(u=>`<tr><td>${esc(isDemo?u.name:u.full_name)}</td><td><span class="status neutral">${roleName(u.role)}</span></td><td>${u.role==='admin'?'Full':'Role-limited'}</td></tr>`).join('')}</tbody></table></div></div>`;
}

function placeholderPanel(title,text){const p=document.getElementById('page');p.innerHTML=`<div class="page-head"><div><h1>${esc(title)}</h1><p>Panel is reserved and protected.</p></div></div><div class="card"><div class="notice">${esc(text)}</div></div>`;}

async function activeRecipeId(){ const {data}=await supabase.from('recipe_versions').select('id').eq('active',true).limit(1).single(); return data?.id; }

// Optional Supabase status helper: visible on demo build only.
window.DoughFlow={resetDemo(){localStorage.removeItem(KEY);location.reload();},isDemo};

if(isDemo){
  // Seed a few realistic stock quantities for an immediately useful preview.
  if(!db.__seededStock){db.inventory.flour.stock=1500;db.inventory.water.stock=4000;db.inventory.oil.stock=80;db.inventory.salt.stock=25;db.inventory.sugar.stock=40;db.inventory.yeast.stock=5;db.__seededStock=true;saveDemo();}
}

init();
