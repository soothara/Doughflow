import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/+esm';
import './config.js';
import { LANGUAGES, getSavedLang, saveLang, languageOptions, t, applyTranslations } from './i18n.js';

const CFG = window.DOUGHFLOW_CONFIG || { supabaseUrl:'', supabaseAnonKey:'', appName:'DoughFlow' };
const isDemo = !(CFG.supabaseUrl && CFG.supabaseAnonKey);
const supabase = isDemo ? null : createClient(CFG.supabaseUrl, CFG.supabaseAnonKey);

const MATERIALS = [
  {code:'flour', name:'Flour', unit:'kg', decimals:2, packages:[{label:'Bulk',qty:1}]},
  {code:'water', name:'Water', unit:'kg', decimals:2, packages:[{label:'Bulk',qty:1}], inventoryTracked:false},
  {code:'oil', name:'Oil', unit:'kg', decimals:2, packages:[{label:'20 kg carton',qty:20}]},
  {code:'salt', name:'Salt', unit:'kg', decimals:3, packages:[{label:'1 kg packet',qty:1},{label:'750 g packet',qty:.75},{label:'20 × 1 kg bundle',qty:20}]},
  {code:'sugar', name:'Sugar', unit:'kg', decimals:2, packages:[{label:'Bulk',qty:1}]},
  {code:'yeast', name:'Yeast', unit:'kg', decimals:3, packages:[{label:'500 g packet',qty:.5},{label:'20 × 500 g box',qty:10}]}
];
const STOCK_MATERIALS=MATERIALS.filter(m=>m.inventoryTracked!==false);

const DEFAULT_RECIPE = [
  {code:'flour', name:'Flour', qty:50, unit:'kg', note:'1 operational sack; actual batch can be 48–52 kg and is still counted as 1 sack'},
  {code:'water', name:'Water', qty:31.2, unit:'kg', note:'Combined water; no hot/cold split'},
  {code:'oil', name:'Oil', qty:1, unit:'kg', note:'Standard 20 kg carton packaging'},
  {code:'yeast', name:'Yeast', qty:.045, unit:'kg', note:'Default 45 g; operational range 35–55 g'},
  {code:'salt', name:'Salt', qty:1.2, unit:'kg', note:'1 kg or 750 g packets'},
  {code:'sugar', name:'Sugar', qty:.5, unit:'kg', note:''}
];

const KEY='doughflow_demo_v1';
const uid=()=>crypto.randomUUID();
const today=()=>{const d=new Date();const pad=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;}; const dateLocale=()=>lang==='ru'?'ru-RU':lang==='ky'?'ky-KG':'en-US'; const formatToday=()=>new Intl.DateTimeFormat(dateLocale(),{weekday:'short',month:'short',day:'numeric',year:'numeric'}).format(new Date());
const fmt=n=>Number(n||0).toLocaleString(undefined,{maximumFractionDigits:3});
const money=n=>Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function friendlyError(error){
  const raw=String(error?.message||error||'').trim();
  const lower=raw.toLowerCase();
  if(lower.includes('invalid login credentials')) return t('Invalid login credentials',lang);
  if(lower.includes('email not confirmed')) return t('Email is not confirmed',lang);
  if(lower.includes('not authorized')) return t('Not authorized',lang);
  if(lower.includes('insufficient stock')) return t('Insufficient stock',lang);
  if(lower.includes('recipe version is not active')) return t('Recipe version is not active',lang);
  if(lower.includes('sack count')) return t('Sack count must be between 0.5 and 9.5.',lang);
  return raw || t('Something went wrong',lang);
}

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
let authError = '';
let lang = getSavedLang('guest');
let liveState = {recipe:null, productions:[], balances:[], users:[]};
let route='dashboard';

const app=document.getElementById('app');
const modalRoot=document.getElementById('modalRoot');

function saveDemo(){ if(isDemo) localStorage.setItem(KEY,JSON.stringify(db)); }
const ICONS={flour:'🌾',water:'💧',oil:'🫒',yeast:'🧫',salt:'🧂',sugar:'🍚'};
function materialIcon(code){return ICONS[code]||'📦';}
function roleName(r){return ({admin:t('Admin',lang),hamurchi:t('Hamurchi',lang),naan:t('Naan / Leposhka Maker',lang),sales:t('Salesman',lang)})[r]||r;}
function setLanguage(next){ lang=saveLang(currentUser?.id||'guest',next); if(currentUser) currentUser.lang=lang; if(isDemo && db?.session) { db.session.lang=lang; saveDemo(); } render(); if(!isDemo) { supabase.from('profiles').update({preferred_language:lang}).eq('id',currentUser.id).then(()=>{}); } }
function languageFlag(){ return lang==='ru'?'🇷🇺':lang==='ky'?'🇰🇬':'🇬🇧'; }
function languageName(){ return LANGUAGES[lang]||'English'; }
function languageSwitcher(){ return `<select id="languageSelect" class="language-select" aria-label="${t('Language',lang)}">${languageOptions(lang)}</select>`; }
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
    supabase.auth.onAuthStateChange((event,s)=>{
      if(!['SIGNED_IN','SIGNED_OUT','USER_UPDATED'].includes(event)) return;
      setTimeout(async()=>{
        if(s){
          await loadUser(s.user);
          if(currentUser){ await refreshLiveState(); render(); }
          else render();
        } else { currentUser=null; authError=''; render(); }
      },0);
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
  if(error || !data){
    currentUser=null;
    authError=friendlyError(error)||t('Unable to load your profile.',lang);
    return;
  }else{
    authError='';

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

async function render(){
  document.body.classList.toggle('dashboard-mode', !!currentUser && route==='dashboard');
  if(!currentUser){ app.innerHTML=loginHTML(); wireLogin(); applyCurrentLanguage(); document.getElementById('languageSelect')?.addEventListener('change',e=>setLanguage(e.target.value)); document.getElementById('loginError')?.setAttribute('data-auth-error','1'); if(authError) document.getElementById('loginError').textContent=authError; return; }
  if(!can(currentUser.role,route)) route='dashboard';
  app.innerHTML=appShellHTML();
  document.querySelectorAll('[data-route]').forEach(b=>b.addEventListener('click',()=>{route=b.dataset.route;render();}));
  document.getElementById('logout')?.addEventListener('click',logout);
  await renderPage();
  applyCurrentLanguage();
  document.getElementById('languageSelect')?.addEventListener('change',e=>setLanguage(e.target.value));
  document.getElementById('heroLanguageSelect')?.addEventListener('change',e=>setLanguage(e.target.value));
}

function loginHTML(){
  return `<div class="login-portal">
    <div class="login-photo"></div><div class="login-shade"></div>
    <div class="login-shell">
      <div class="login-brand-row">
        <div class="login-logo">DF</div>
        <div><strong>DoughFlow</strong><small>Bakery control</small></div>
        <div class="login-lang">${languageFlag()} ${languageSwitcher()}</div>
      </div>
      <div class="login-main-card">
        <div class="login-badge">🥖</div>
        <div class="eyebrow login-eyebrow">${t('Kyrgyz bakery portal',lang)}</div>
        <h1>${t('Welcome back',lang)} 👋</h1>
        <p>${t('Sign in to manage production, recipes and stock.',lang)}</p>
        ${isDemo?`
          <div class="login-note">${t('Demo mode is active. Choose a role below.',lang)}</div>
          <div class="login-role-grid">${['admin','hamurchi','naan','sales'].map(r=>`<button class="login-role-btn ${r==='admin'?'featured':''} demo-login" data-role="${r}"><span>${r==='admin'?'👑':r==='hamurchi'?'🥣':r==='naan'?'🫓':'💰'}</span>${roleName(r)}<b>›</b></button>`).join('')}</div>
        `:`
          <form id="loginForm" class="modern-login-form">
            <div class="field"><label>${t('Username',lang)}</label><input required type="text" name="login" value="askat" placeholder="askat" autocomplete="username" autocapitalize="none" spellcheck="false"></div>
            <div class="field password-field"><label>${t('Password',lang)}</label><div class="password-wrap"><input required id="loginPassword" type="password" name="password" autocomplete="current-password"><button type="button" class="password-toggle" id="togglePassword" aria-label="${t('Show password',lang)}">◉</button></div></div>
            <button class="login-submit" type="submit"><span>↪</span>${t('Sign in',lang)}<b>›</b></button>
            <div id="loginError" class="login-error"></div>
          </form>
        `}
        <div class="login-footer-line"><span>🇰🇬 Bishkek</span><span>•</span><span>DoughFlow</span></div>
      </div>
      <div class="login-credit"><span>✦</span> Сделано Али</div>
    </div>
  </div>`;
}
function wireLogin(){
  document.getElementById('togglePassword')?.addEventListener('click',()=>{
    const input=document.getElementById('loginPassword');
    const button=document.getElementById('togglePassword');
    if(!input||!button) return;
    const show=input.type==='password';
    input.type=show?'text':'password';
    button.textContent=show?'◉':'○';
    button.setAttribute('aria-label',t(show?'Hide password':'Show password',lang));
  });
  if(isDemo){
    document.querySelectorAll('.demo-login').forEach(b=>b.addEventListener('click',()=>{
      db.session={user:{id:`demo-${b.dataset.role}`,name:roleName(b.dataset.role)},role:b.dataset.role,lang:getSavedLang(`demo-${b.dataset.role}`)};
      currentUser={id:db.session.user.id,name:db.session.user.name,role:b.dataset.role,lang:db.session.lang};
      lang=currentUser.lang;authError='';route='dashboard';saveDemo();render();
    }));
    return;
  }
  document.getElementById('loginForm')?.addEventListener('submit',async e=>{
    e.preventDefault();
    const f=new FormData(e.currentTarget);
    const raw=String(f.get('login')||'').trim();
    const email=raw.includes('@')?raw:`${raw}@gmail.com`;
    const {error}=await supabase.auth.signInWithPassword({email,password:f.get('password')});
    if(error) document.getElementById('loginError').textContent=friendlyError(error);
  });
}
async function logout(){ if(isDemo){db.session=null;currentUser=null;authError='';lang=getSavedLang('guest');saveDemo();render();return;} await supabase.auth.signOut({scope:'local'}); }

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
async function renderPage(){
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
  await (pages[route]||renderDashboard)(p);
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
  const totalSacks=todayRuns.reduce((a,b)=>a+Number(isDemo?b.mishokCount:b.mishok_count),0);
  const totalPieces=todayRuns.reduce((a,b)=>a+(isDemo?b.batches:(b.production_batches||[])).reduce((s,z)=>s+Number(z.pieces||0),0),0);
  const stockRows=STOCK_MATERIALS.map(m=>({...m,stock:getStock(m.code)}));
  const recipe=isDemo?db.recipe:liveState.recipe;
  const firstName=esc(currentUser.name.split(' ')[0]);
  const recipeCards=(recipe?.items||[]).map(it=>"<div class='recipe-photo-card'><div class='recipe-visual "+esc(it.code)+"'><span>"+materialIcon(it.code)+"</span></div><b>"+esc(t(it.name,lang))+"</b><strong>"+fmt(it.qty)+" "+esc(it.unit)+"</strong></div>").join('');
  const stockCards=stockRows.map(m=>"<div class='stock-item'><div class='stock-item-icon "+esc(m.code)+"'>"+materialIcon(m.code)+"</div><div><b>"+esc(t(m.name,lang))+"</b><strong class='"+(m.stock<=0?'empty-stock':'')+"'>"+fmt(m.stock)+" "+m.unit+" <em>!</em></strong></div><span>›</span></div>").join('');
  p.innerHTML =
    "<section class='portal-hero'>"+
      "<div class='portal-hero-photo'></div><div class='portal-hero-shade'></div>"+
      "<div class='portal-hero-content'>"+
        "<div class='hero-topline'>"+
          "<div class='df-badge'>DF</div><div class='hero-brand'><b>DoughFlow</b><small>"+t('Bakery control',lang)+"</small></div><div class='hero-spacer'></div>"+
          "<label class='hero-language'><span>"+languageFlag()+"</span><select id='heroLanguageSelect' aria-label=\""+t('Language',lang)+"\">"+languageOptions(lang)+"</select><b>⌄</b></label>"+
          "<div class='hero-user'><span class='hero-avatar'>"+esc(String(currentUser.name||'A')[0].toUpperCase())+"</span><span><b>"+esc(currentUser.name)+"</b><small>"+roleName(currentUser.role)+"</small></span></div>"+
        "</div>"+
        "<div class='hero-copy'><div class='hero-date'>🇰🇬 "+formatToday()+"</div><h1>"+t('Good day',lang)+", "+firstName+" <span>👋</span></h1><p>"+t('Let’s make great leposhka today!',lang)+"</p></div>"+
      "</div>"+
    "</section>"+
    "<section class='metric-grid'>"+
      "<div class='metric-card metric-green'><div class='metric-head'><span>🧺</span><b>"+t('Today’s',lang)+"<br>"+t('Sacks',lang)+"</b></div><strong>"+fmt(totalSacks)+"</strong><i>▥</i></div>"+
      "<div class='metric-card metric-orange'><div class='metric-head'><span>🥯</span><b>"+t('Today’s',lang)+"<br>"+t('Pieces',lang)+"</b></div><strong>"+fmt(totalPieces)+"</strong><i>◔</i></div>"+
      "<div class='metric-card metric-purple'><div class='metric-head'><span>▶</span><b>"+t('Production',lang)+"<br>"+t('Runs',lang)+"</b></div><strong>"+todayRuns.length+"</strong><i>▥</i></div>"+
      "<div class='metric-card metric-blue'><div class='metric-head'><span>▦</span><b>"+t('Recipe',lang)+"<br>"+t('Version',lang)+"</b></div><strong>v"+(db?.recipe?.version||liveState.recipe?.version||1)+"</strong><i>⟳</i></div>"+
    "</section>"+
    "<section class='portal-panel production-panel'>"+
      "<div class='panel-photo-strip'><div class='panel-photo'></div><div class='panel-photo-shade'></div><div class='panel-title-wrap'><div class='panel-sticker coral'>🍞</div><div><h2>"+t('New Production',lang)+"</h2><p>"+t('Select total sacks (you can add 0.5)',lang)+"</p></div></div></div>"+
      "<div class='portal-panel-inner'>"+
        "<div class='portal-section-title'><div class='section-icon green'>🧺</div><div><h3>"+t('Sack Count',lang)+"</h3><span>ⓘ 1–9 "+t('Sacks',lang)+" + 0.5</span></div></div>"+
        "<div class='dashboard-sack-grid'>"+Array.from({length:9},(_,i)=>"<button class='dashboard-sack-btn' data-dashboard-sack='"+(i+1)+"'>"+(i+1)+"</button>").join('')+"</div>"+
        "<div class='dashboard-sack-row'><button class='dashboard-half-btn' id='dashboardHalf'>＋ <b>0.5</b></button><div class='dashboard-total'><small>"+t('Total',lang)+"</small><strong id='dashboardTotal'>0</strong></div><button class='dashboard-reset' id='dashboardReset'>↻ <span>"+t('Reset',lang)+"</span></button></div>"+
        "<div class='portal-section-title recipe-title'><div class='section-icon mint'>▦</div><div><h3>"+t('Recipe',lang)+" <small>("+t('per 1 sack',lang)+")</small></h3><span>"+t('Automatically calculated',lang)+" ⚙</span></div></div>"+
        "<div class='recipe-photo-grid'>"+recipeCards+"</div>"+
        "<button class='start-production-button' id='dashboardStart'>▶ <span>"+t('Start Production',lang)+"<small>"+t('Calculate ingredients and enter pieces',lang)+"</small></span><b>›</b></button>"+
      "</div>"+
    "</section>"+
    "<section class='portal-panel stock-panel'>"+
      "<div class='portal-section-title stock-title'><div class='section-icon brown'>📦</div><div><h3>"+t('Stock Overview',lang)+"</h3><span>"+t('Current available stock in inventory',lang)+"</span></div>"+
      (currentUser.role==='admin'?"<button class='stock-view-all' id='openInventory'>"+t('View All',lang)+" »</button>":"")+
      "</div><div class='stock-grid'>"+stockCards+"</div>"+
    "</section>"+
    "<div class='made-by-wrap'>"+
      "<a class='made-by-card made-by-link' href='https://wa.me/996509512786' target='_blank' rel='noopener' aria-label='WhatsApp Ali'>"+
        "<div class='made-by-symbol'>✦</div><div><small>"+t('Designed & built with care',lang)+"</small><strong>Сделано Али</strong></div><div class='made-by-kyrgyz'>🇰🇬</div>"+
      "</a>"+
      "<div class='photo-attribution'><a href='https://commons.wikimedia.org/wiki/File:%D0%9A%D1%8B%D1%80%D0%B3%D0%B7%D1%81%D1%82%D0%B0%D0%BD%2C_%D0%91%D0%B8%D1%88%D0%BA%D0%B5%D0%BA%2C_%D0%9E%D1%88%D1%81%D0%BA%D0%B8%D0%B9_%D0%B1%D0%B0%D0%B7%D0%B0%D1%80%2C_%D1%82%D0%B0%D0%BD%D0%B4%D1%8B%D1%80%D0%BD%D1%8B%D0%B5_%D0%BB%D0%B5%D0%BF%D0%B5%D1%88%D0%BA%D0%B8_%281%29.jpg' target='_blank' rel='noopener'>Photo: ElenaLitera / Wikimedia Commons</a> · <a href='https://creativecommons.org/licenses/by-sa/4.0/' target='_blank' rel='noopener'>CC BY-SA 4.0</a></div>"+
    "</div>";

  let selected=0;
  const sync=()=>{
    const totalEl=document.getElementById('dashboardTotal');
    totalEl.textContent=selected;
    document.querySelectorAll('[data-dashboard-sack]').forEach(b=>b.classList.toggle('selected',Number(b.dataset.dashboardSack)===Math.floor(selected)));
    document.getElementById('dashboardHalf')?.classList.toggle('selected',selected%1===0.5);
    totalEl.classList.remove('total-pop'); void totalEl.offsetWidth; totalEl.classList.add('total-pop');
  };
  document.querySelectorAll('[data-dashboard-sack]').forEach(b=>b.addEventListener('click',()=>{selected=Number(b.dataset.dashboardSack);sync();}));
  document.getElementById('dashboardHalf')?.addEventListener('click',()=>{selected=Math.min(9.5,Math.round((selected+0.5)*2)/2);sync();});
  document.getElementById('dashboardReset')?.addEventListener('click',()=>{selected=0;sync();});
  const openProduction=()=>{
    route='production';render();
    setTimeout(()=>{
      const input=document.getElementById('sackCount');
      if(input){input.value=selected||0;input.dispatchEvent(new Event('input',{bubbles:true}));}
    },0);
  };
  document.getElementById('dashboardStart')?.addEventListener('click',openProduction);
  document.getElementById('openInventory')?.addEventListener('click',()=>{route='inventory';render();});
}
function roleDashboard(p){
  if(currentUser.role==='hamurchi') p.innerHTML=`<div class="grid grid-2"><div class="card"><h2>Today</h2><div class="kpi">${isDemo?fmt(db.productions.filter(x=>x.date===today()&&x.createdBy===currentUser.name).reduce((a,b)=>a+b.mishokCount,0)):'—'} sack</div><div class="small">Enter your sacks and actual pieces from the Production panel.</div></div><div class="card"><h2>Recipe</h2><div class="kpi">v${db?.recipe?.version||1}</div><div class="small">You may update the working recipe. Future production uses the new version.</div></div></div>`;
  else if(currentUser.role==='naan') p.innerHTML=`<div class="card"><h2>Naan / Leposhka</h2><div class="notice">Panel ready. We will add the exact process after you provide it.</div></div>`;
  else if(currentUser.role==='sales') p.innerHTML=`<div class="card"><h2>Sales</h2><div class="notice">Panel ready. We will add the exact sales process after you provide it.</div></div>`;
}

function batchesFor(mishokCount){
  const count=Number(mishokCount);
  const full=Math.floor(count);
  const half=Math.round((count-full)*2)/2;
  const out=[];
  for(let i=1;i<=full;i++) out.push({batchNo:i,sack:1,pieces:''});
  if(half===0.5) out.push({batchNo:full+1,sack:0.5,pieces:''});
  return out;
}
function normalizeSackCount(value){
  const n=Number(value);
  if(!Number.isFinite(n)) return 0;
  return Math.max(0,Math.min(9.5,Math.round(n*2)/2));
}

function renderProduction(p){
  const existing=isDemo?db.productions.filter(x=>x.date===today()):liveState.productions.filter(x=>x.production_date===today());
  const recipe=isDemo?db.recipe:liveState.recipe;
  p.innerHTML=`<div class="page-head compact-head"><div><div class="eyebrow">Daily workflow</div><h1>Production</h1><p>Select sacks, add a half-sack when needed, enter actual pieces, then complete.</p></div></div><div class="grid grid-2"><div class="card"><h2>New production</h2><div class="field"><label>Sack count</label><div class="sack-picker"><button type="button" class="sack-choice" data-sack="1">1</button><button type="button" class="sack-choice " data-sack="2">2</button><button type="button" class="sack-choice " data-sack="3">3</button><button type="button" class="sack-choice " data-sack="4">4</button><button type="button" class="sack-choice " data-sack="5">5</button><button type="button" class="sack-choice " data-sack="6">6</button><button type="button" class="sack-choice " data-sack="7">7</button><button type="button" class="sack-choice " data-sack="8">8</button><button type="button" class="sack-choice " data-sack="9">9</button><button type="button" class="sack-choice half-choice" data-half="0.5">＋ 0.5</button></div><div class="sack-total"><span>Total sacks</span><strong id="sackTotal">0</strong><button type="button" class="reset-sack" id="resetSack">Reset</button></div><input id="sackCount" class="sr-only" type="number" min="0" max="9.5" step="0.5" value="0"></div><div id="batchEditor"></div><div style="height:10px"></div><h3>Material consumption</h3><div id="consumptionEditor"></div><div class="notice" style="margin:12px 0">A full sack = 1.0. The +0.5 button adds a half-sack, so 6 + 0.5 = 6.5. Maximum is 9.5 sacks.</div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" id="saveProduction">Complete production</button><button class="btn secondary" id="clearProduction">Clear</button></div></div><div class="card"><h2>Today’s production</h2>${existing.length?`<div class="table-wrap"><table><thead><tr><th>Time</th><th>Sacks</th><th>Pieces</th><th>Recipe</th></tr></thead><tbody>${existing.map(r=>{const bs=isDemo?r.batches:r.production_batches||[]; return `<tr><td>${esc(isDemo?r.timeLabel:new Date(r.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}))}</td><td>${fmt(isDemo?r.mishokCount:r.mishok_count)}</td><td>${fmt(bs.reduce((s,z)=>s+Number(z.pieces||0),0))}</td><td>v${isDemo?r.recipeVersion:(liveState.recipe?.version||'—')}</td></tr>`}).join('')}</tbody></table></div>`:'<div class="empty">No production saved today.</div>'}</div></div>`;
  const editor=document.getElementById('batchEditor');
  const consumption=document.getElementById('consumptionEditor');
  const rebuild=()=>{
    const m=normalizeSackCount(document.getElementById('sackCount').value); document.getElementById('sackCount').value=m; const bs=batchesFor(m); document.getElementById('sackTotal').textContent=m;
    editor.innerHTML=`<h3>Batches</h3>${bs.map((b,i)=>`<div class="batch-row"><div class="batch-index">#${i+1}</div><div class="batch-kind">${b.sack===1?'1.0':'0.5'} sack</div><input type="number" min="0" step="1" data-pieces="${i}" placeholder="Actual pieces"></div>`).join('')}`;
    consumption.innerHTML=(recipe?.items||[]).map(it=>{const expected=Number(it.qty||0)*m;return `<div class="field-row"><div class="field"><label>${esc(it.name)} expected (${esc(it.unit)})</label><input class="expected-consumption" data-code="${esc(it.code)}" value="${expected}" disabled></div><div class="field"><label>Actual (${esc(it.unit)})</label><input class="actual-consumption" data-code="${esc(it.code)}" type="number" min="0" step="0.001" value="${expected}"></div></div>`}).join('');
  };
  const syncSackChoices=()=>{
    const total=Number(document.getElementById('sackCount').value||0);
    document.querySelectorAll('.sack-choice').forEach(y=>y.classList.toggle('active',Number(y.dataset.sack)===Math.floor(total)));
    document.querySelector('[data-half]')?.classList.toggle('active',total%1===0.5);
  };
  rebuild();
  syncSackChoices();
  document.getElementById('sackCount').addEventListener('input',()=>{
    document.getElementById('sackCount').value=normalizeSackCount(document.getElementById('sackCount').value);
    rebuild();
    syncSackChoices();
  });
  document.querySelectorAll('.sack-choice').forEach(x=>x.addEventListener('click',()=>{
    const current=normalizeSackCount(document.getElementById('sackCount').value);
    document.getElementById('sackCount').value=x.dataset.sack ? Number(x.dataset.sack) : Math.min(9.5,Math.round((current+0.5)*2)/2);
    rebuild();
    syncSackChoices();
  }));
  document.getElementById('resetSack').addEventListener('click',()=>{document.getElementById('sackCount').value=0;rebuild();syncSackChoices();});
  document.getElementById('clearProduction').addEventListener('click',()=>{document.getElementById('sackCount').value=0;rebuild();syncSackChoices();});
  document.getElementById('saveProduction').addEventListener('click',async()=>{
    const count=normalizeSackCount(document.getElementById('sackCount').value); if(!(count>=0.5&&count<=9.5)){alert(t('Sack count must be between 0.5 and 9.5.',lang));return;}
    if(!recipe?.items?.length){alert(t('No active recipe found.',lang));return;}
    const pieces=[...document.querySelectorAll('[data-pieces]')].map(x=>Number(x.value||0));
    if(pieces.some(x=>x<0)){alert(t('Piece counts cannot be negative.',lang));return;}
    const consumptionItems=[...document.querySelectorAll('.actual-consumption')].map(el=>({code:el.dataset.code,actual:el.value}));
    if(consumptionItems.some(x=>!Number.isFinite(Number(x.actual))||Number(x.actual)<0)){alert(t('Consumption values must be valid non-negative numbers.',lang));return;}
    if(isDemo){
      const batches=batchesFor(count).map((b,i)=>({...b,pieces:pieces[i]||0}));
      const now=new Date(); const run={id:uid(),date:today(),timeLabel:now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}),createdBy:currentUser.name,mishokCount:count,batches,recipeVersion:db.recipe.version,consumption:consumptionItems.map(x=>({code:x.code,actual:Number(x.actual)}))};
      db.productions.push(run); applyProductionConsumption(count,run.id,run.consumption); saveDemo(); alert(`${t('Saved',lang)} ${count} ${t('Sack',lang)}.`); render();
    } else {
      const batchPayload=batchesFor(count).map((b,i)=>({batch_no:i+1,mishok_fraction:b.sack,pieces:pieces[i]||0}));
      const payload=consumptionItems.filter(x=>x.code!=='water').map(x=>({material_code:x.code,actual_qty:Number(x.actual)}));
      const recipeId=await activeRecipeId(); const {error}=await supabase.rpc('complete_production',{p_production_date:today(),p_mishok_count:count,p_recipe_version_id:recipeId,p_batches:batchPayload,p_consumption:payload});
      if(error){alert(friendlyError(error));return;} await refreshLiveState(); alert(t('Production saved.',lang)); render();
    }
  });
}

function applyProductionConsumption(count,productionId,consumption=[]){
  const actualMap=new Map((consumption||[]).map(x=>[x.code,Number(x.actual)]));
  db.recipe.items.filter(item=>item.code!=='water').forEach(item=>{
    const expected=Number(item.qty)*count;
    const qty=actualMap.has(item.code) && Number.isFinite(actualMap.get(item.code))
      ? actualMap.get(item.code)
      : expected;
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
  p.innerHTML=`<div class="page-head"><div><h1>Recipe</h1><p>Working recipe per operational sack. Authorized production users can edit it.</p></div></div><div class="grid grid-2"><div class="card"><h2>v${recipe.version}</h2>${recipe.items.map((it)=>`<div class="field-row" style="align-items:end"><div class="field"><label>${esc(it.name)} (${esc(it.unit)})</label><input class="recipe-qty" data-code="${esc(it.code)}" type="number" step="0.001" value="${it.qty}"><div class="small">${esc(it.note||'')}</div></div><div class="field"><label>Current standard</label><div class="notice">${fmt(it.qty)} ${esc(it.unit)} / sack</div></div></div>`).join('')}<button class="btn primary" id="saveRecipe">Save as new recipe version</button></div><div class="card"><h2>Packaging rules</h2><div class="table-wrap"><table><thead><tr><th>Material</th><th>Purchase package</th></tr></thead><tbody>${MATERIALS.map(m=>`<tr><td>${esc(m.name)}</td><td>${m.packages.map(x=>esc(x.label)).join('<br>')}</td></tr>`).join('')}</tbody></table></div><div class="notice" style="margin-top:14px">Water is one material. Salt supports 1 kg and 750 g packets. Yeast supports 500 g packets and 20-packet boxes. Oil uses 20 kg cartons.</div></div></div>`;
  document.getElementById('saveRecipe').addEventListener('click',async()=>{
    const items=recipe.items.map((it,i)=>({...it,qty:Number(document.querySelector(`.recipe-qty[data-code="${it.code}"]`).value),sort_order:i}));
    if(items.some(x=>!Number.isFinite(x.qty)||x.qty<0)){alert(t('Recipe quantities must be valid non-negative numbers.',lang));return;}
    if(isDemo){db.recipe.version+=1;db.recipe.updatedAt=new Date().toISOString();db.recipe.updatedBy=currentUser.name;db.recipe.items=items;saveDemo();alert(`${t('Recipe saved as',lang)} v${db.recipe.version}.`);render();}
    else {const {error}=await supabase.rpc('create_recipe_version',{p_items:items.map(x=>({code:x.code,qty:x.qty,unit:x.unit,note:x.note||'',sort_order:x.sort_order})),p_note:`Updated by ${currentUser.name}`});if(error){alert(friendlyError(error));return;}await refreshLiveState();alert(`${t('Recipe saved as',lang)} v${liveState.recipe.version}.`);render();}
  });
}

async function renderInventory(p){
  if(currentUser.role!=='admin'){p.innerHTML='<div class="card"><h2>Inventory</h2><div class="alert error">Admin access only.</div></div>';return;}
  if(!isDemo) await refreshLiveState();
  p.innerHTML=`<div class="page-head"><div><h1>Inventory</h1><p>Current theoretical stock plus package-aware receiving.</p></div><button class="btn primary" id="stockIn">+ Stock in</button></div><div class="grid grid-3">${STOCK_MATERIALS.map(m=>`<div class="card"><div class="kpi-label">${esc(m.name)}</div><div class="kpi">${fmt(getStock(m.code))}</div><div class="small">${m.unit}</div></div>`).join('')}</div><div style="height:16px"></div><div class="card"><h2>Material details</h2><div class="table-wrap"><table><thead><tr><th>Material</th><th>Stock</th><th>Package options</th></tr></thead><tbody>${STOCK_MATERIALS.map(m=>`<tr><td>${esc(m.name)}</td><td>${fmt(getStock(m.code))} ${m.unit}</td><td>${m.packages.map(x=>esc(x.label)).join(', ')}</td></tr>`).join('')}</tbody></table></div></div>`;
  document.getElementById('stockIn').addEventListener('click',()=>openStockModal());
}

function openStockModal(){
  const opts=STOCK_MATERIALS.map(m=>`<option value="${m.code}">${esc(m.name)}</option>`).join('');
  modalRoot.innerHTML=`<div class="modal-backdrop show"><div class="modal"><div class="modal-head"><h2>Receive stock</h2><button id="closeModal">×</button></div><div class="field"><label>Material</label><select id="stockMaterial">${opts}</select></div><div id="packageChooser"></div><div class="field"><label>Notes</label><input id="stockNote" placeholder="Supplier / delivery note"></div><div class="modal-footer"><button class="btn secondary" id="cancelModal">Cancel</button><button class="btn primary" id="saveStock">Add stock</button></div></div></div>`;
  const update=()=>{const m=STOCK_MATERIALS.find(x=>x.code===document.getElementById('stockMaterial').value);document.getElementById('packageChooser').innerHTML=`<div class="field"><label>Package</label><select id="stockPackage">${m.packages.map((x,i)=>`<option value="${i}">${esc(x.label)}</option>`).join('')} </select></div><div class="field"><label>Number of packages</label><input id="packageCount" type="number" min="0.001" step="1" value="1"></div><div class="small">The system will convert package quantity into the inventory base unit.</div>`;};
  update();document.getElementById('stockMaterial').addEventListener('change',update);document.getElementById('closeModal').addEventListener('click',closeModal);document.getElementById('cancelModal').addEventListener('click',closeModal);
  document.getElementById('saveStock').addEventListener('click',async()=>{const code=document.getElementById('stockMaterial').value;const m=STOCK_MATERIALS.find(x=>x.code===code);const pi=Number(document.getElementById('stockPackage').value);const count=Number(document.getElementById('packageCount').value||0);if(!(count>0))return;const qty=m.packages[pi].qty*count;const reason=document.getElementById('stockNote').value||'Stock received';if(isDemo){const inv=db.inventory[code];inv.stock+=qty;inv.tx.push({id:uid(),dir:'in',qty,packages:count,packageLabel:m.packages[pi].label,reason,at:new Date().toISOString(),by:currentUser.name});saveDemo();closeModal();render();}else{const {error}=await supabase.from('inventory_transactions').insert({material_code:code,direction:'in',qty_base:qty,package_count:count,package_label:m.packages[pi].label,reason,created_by:currentUser.id});if(error){alert(friendlyError(error));return;}await refreshLiveState();closeModal();render();}});
}
function closeModal(){modalRoot.innerHTML='';}

function renderReports(p){
  const runs=isDemo?db.productions:liveState.productions; const total=runs.reduce((a,b)=>a+Number(isDemo?b.mishokCount:b.mishok_count),0); const pieces=runs.reduce((a,b)=>a+(isDemo?b.batches:(b.production_batches||[])).reduce((s,z)=>s+Number(z.pieces||0),0),0); const avg=total?pieces/total:0;
  p.innerHTML=`<div class="page-head"><div><h1>Reports</h1><p>Operational summary from saved production.</p></div></div><div class="grid grid-3"><div class="card"><div class="kpi-label">All-time sacks</div><div class="kpi">${fmt(total)}</div></div><div class="card"><div class="kpi-label">All-time pieces</div><div class="kpi">${fmt(pieces)}</div></div><div class="card"><div class="kpi-label">Pieces / sack</div><div class="kpi">${fmt(avg)}</div></div></div><div style="height:16px"></div><div class="card"><h2>Production history</h2><div class="table-wrap"><table><thead><tr><th>Date</th><th>Sacks</th><th>Pieces</th><th>Worker</th></tr></thead><tbody>${runs.length?runs.map(r=>`<tr><td>${esc(isDemo?r.date:r.production_date)}</td><td>${fmt(isDemo?r.mishokCount:r.mishok_count)}</td><td>${fmt((isDemo?r.batches:r.production_batches||[]).reduce((a,b)=>a+Number(b.pieces||0),0))}</td><td>${esc(isDemo?r.createdBy:r.created_by===currentUser.id?currentUser.name:'User')}</td></tr>`).join(''):'<tr><td colspan="4" class="empty">No production yet.</td></tr>'}</tbody></table></div></div>`;
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
  if(!db.__seededStock){db.inventory.flour.stock=1500;db.inventory.oil.stock=80;db.inventory.salt.stock=25;db.inventory.sugar.stock=40;db.inventory.yeast.stock=5;db.__seededStock=true;saveDemo();}
}

init();
