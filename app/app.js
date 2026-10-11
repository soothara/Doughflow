import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/+esm';
import './config.js';
import { LANGUAGES, getSavedLang, saveLang, languageOptions, t, applyTranslations } from './i18n.js';

const CFG = window.DOUGHFLOW_CONFIG || {};
const isDemo = CFG.demoMode === true;
const hasLiveConfig = Boolean(CFG.supabaseUrl && CFG.supabaseAnonKey);
const configError = !isDemo && !hasLiveConfig;
const supabase = (!isDemo && hasLiveConfig) ? createClient(CFG.supabaseUrl, CFG.supabaseAnonKey) : null;

const MATERIALS = [
  {code:'flour', name:'Flour', unit:'kg', decimals:2, packages:[{label:'50 kg sack',qty:50,kind:'sack'}]},
  {code:'water', name:'Water', unit:'kg', decimals:2, packages:[{label:'Recipe only',qty:1,kind:'recipe'}], inventoryTracked:false},
  {code:'oil', name:'Oil', unit:'kg', decimals:2, packages:[{label:'20 kg carton',qty:20,kind:'carton'}]},
  {code:'salt', name:'Salt', unit:'kg', decimals:3, packages:[{label:'20 × 1 kg bundle',qty:20,kind:'bundle'},{label:'1 kg packet',qty:1,kind:'piece'},{label:'750 g packet',qty:.75,kind:'piece'}]},
  {code:'sugar', name:'Sugar', unit:'kg', decimals:2, packages:[{label:'50 kg sack',qty:50,kind:'sack'}]},
  {code:'yeast', name:'Yeast', unit:'kg', decimals:3, packages:[{label:'20 × 500 g box',qty:10,kind:'box'},{label:'500 g packet',qty:.5,kind:'piece'}]}
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
const today=()=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bishkek',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`;}; const dateLocale=()=>lang==='ru'?'ru-RU':lang==='ky'?'ky-KG':'en-US'; const formatToday=()=>new Intl.DateTimeFormat(dateLocale(),{weekday:'short',month:'short',day:'numeric',year:'numeric',timeZone:'Asia/Bishkek'}).format(new Date());
const fmt=n=>Number(n||0).toLocaleString(undefined,{maximumFractionDigits:3});
const money=n=>Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function formatInventoryNumber(value,language=lang){
  const locale=language==='ru'?'ru-RU':language==='ky'?'ky-KG':'en-US';
  return Number(value||0).toLocaleString(locale,{maximumFractionDigits:3});
}
function packageUnit(material,pkg,language=lang){
  const kind=pkg.kind||'piece';
  const q=Number(pkg.qty);
  if(kind==='sack') return language==='ru'?`${formatInventoryNumber(q,language)} кг мешок`:language==='ky'?`${formatInventoryNumber(q,language)} кг кап`:`${formatInventoryNumber(q,language)} kg sack`;
  if(kind==='carton') return language==='ru'?`${formatInventoryNumber(q,language)} кг коробка`:language==='ky'?`${formatInventoryNumber(q,language)} кг куту`:`${formatInventoryNumber(q,language)} kg carton`;
  if(kind==='bundle') return language==='ru'?`${formatInventoryNumber(q,language)} кг связка`:language==='ky'?`${formatInventoryNumber(q,language)} кг боо`:`${formatInventoryNumber(q,language)} kg bundle`;
  if(kind==='box') return language==='ru'?`20 × 500 г коробка`:language==='ky'?`20 × 500 г куту`:`20 × 500 g box`;
  const grams=q<1 ? Math.round(q*1000) : q*1000;
  return q<1 ? (language==='ru'?`${formatInventoryNumber(grams,language)} г пакет`:language==='ky'?`${formatInventoryNumber(grams,language)} г пакет`:`${formatInventoryNumber(grams,language)} g packet`) : (language==='ru'?`${formatInventoryNumber(q,language)} кг пакет`:language==='ky'?`${formatInventoryNumber(q,language)} кг пакет`:`${formatInventoryNumber(q,language)} kg packet`);
}
function inventoryCountLabel(kind,count,language=lang){
  const n=Number(count);
  if(language==='ky'){
    if(kind==='sack') return 'кап'; if(kind==='carton'||kind==='box') return 'куту'; if(kind==='bundle') return 'боо'; return 'даана';
  }
  if(language==='ru'){
    if(kind==='sack') return n%10===1&&n%100!==11?'мешок':(n%10>=2&&n%10<=4&&(n%100<10||n%100>=20)?'мешка':'мешков');
    if(kind==='carton'||kind==='box') return n%10===1&&n%100!==11?'коробка':(n%10>=2&&n%10<=4&&(n%100<10||n%100>=20)?'коробки':'коробок');
    if(kind==='bundle') return n===1?'связка':'связки';
    return 'шт.';
  }
  if(kind==='sack') return n===1?'sack':'sacks';
  if(kind==='carton') return n===1?'carton':'cartons';
  if(kind==='box') return n===1?'box':'boxes';
  if(kind==='bundle') return n===1?'bundle':'bundles';
  return n===1?'pc':'pcs';
}
function packageCombination(remainder,packages,language=lang){
  const usable=packages.filter(p=>Number(p.qty)>0);
  if(!usable.length) return {items:[],used:0};
  const unit=usable.some(p=>Number(p.qty)%0.001!==0)?0.001:0.001;
  const max=Math.max(0,Math.floor(remainder*1000+0.0001));
  const step=1;
  const dp=Array(max+1).fill(null); dp[0]={used:0,totalCount:0,counts:Array(usable.length).fill(0)};
  for(let g=0;g<=max;g++){
    if(!dp[g]) continue;
    usable.forEach((p,i)=>{
      const w=Math.max(1,Math.round(Number(p.qty)*1000));
      const ng=g+w; if(ng>max) return;
      const next={used:dp[g].used+Number(p.qty),totalCount:dp[g].totalCount+1,counts:dp[g].counts.slice()};
      next.counts[i]++;
      if(!dp[ng] || next.totalCount<dp[ng].totalCount) dp[ng]=next;
    });
  }
  let best=null;
  for(let g=max;g>=0;g--){if(dp[g]){best=dp[g];break;}}
  if(!best || best.used<0.000001) return {items:[],used:0};
  const items=[];
  usable.forEach((p,i)=>{if(best.counts[i]) items.push({count:best.counts[i],kind:p.kind||'piece',text:formatInventoryNumber(best.counts[i],language)+' '+inventoryCountLabel(p.kind||'piece',best.counts[i],language)});});
  return {items,used:best.used};
}
function stockBreakdown(material,stock,language=lang){
  const qty=Math.max(0,Number(stock)||0); const eps=0.000001; let remaining=qty; const parts=[];
  const packages=[...(material.packages||[])].filter(p=>p.kind!=='recipe'&&Number(p.qty)>0).sort((a,b)=>Number(b.qty)-Number(a.qty));
  const largest=packages[0];
  if(largest){
    const size=Number(largest.qty); const count=Math.floor((remaining+eps)/size);
    if(count>0){
      parts.push({count,kind:largest.kind||'piece',text:formatInventoryNumber(count,language)+' '+inventoryCountLabel(largest.kind||'piece',count,language)});
      remaining=Math.max(0,remaining-count*size);
    }
  }
  if(largest?.kind==='sack' && remaining>eps){
    const size=Number(largest.qty);
    if(Math.abs(remaining-size/2)<eps){
      const last=parts.pop(); const count=(last?.count||0)+0.5;
      parts.push({count,kind:'sack',text:formatInventoryNumber(count,language)+' '+inventoryCountLabel('sack',count,language)}); remaining=0;
    }
  }
  if(remaining>eps){
    const smaller=packages.slice(1);
    const combo=packageCombination(remaining,smaller,language);
    if(combo.items.length){parts.push(...combo.items); remaining=Math.max(0,remaining-combo.used);}
  }
  if(remaining>eps){
    const remLabel=formatBaseRemainder(remaining,material,language);
    const open=language==='ru'?'остаток':language==='ky'?'калдык':'open';
    if(remLabel) parts.push({count:null,kind:'remainder',text:remLabel+' '+open});
  }
  return {primary:parts.length?parts.map(p=>p.text).join(' + '):'0',secondary:formatInventoryNumber(qty,language)+' '+material.unit,parts};
}
function formatBaseRemainder(kg,material,language=lang){
  const n=Math.max(0,Number(kg)||0); if(n<0.001) return '';
  if(material.unit==='kg' && n<1) return formatInventoryNumber(n*1000,language)+' g';
  return formatInventoryNumber(n,language)+' '+material.unit;
}
function formatSackUnit(value,language=lang){
  const n=Number(value);
  if(language==='ru'){
    if(Math.abs(n%1)>0.001) return 'мешка';
    const i=Math.round(n);
    if(i%10===1 && i%100!==11) return 'мешок';
    if(i%10>=2 && i%10<=4 && (i%100<10 || i%100>=20)) return 'мешка';
    return 'мешков';
  }
  if(language==='ky') return 'кап';
  return Math.abs(n-1)<0.001 ? 'sack' : 'sacks';
}
function friendlyError(error){
  const raw=String(error?.message||error||'').trim();
  const lower=raw.toLowerCase();
  if((lower.includes('admin_inventory_snapshot')||lower.includes('admin_inventory_history'))&&(lower.includes('schema cache')||lower.includes('could not find the function')||error?.code==='PGRST202')) return 'Inventory database update required. Run db/fix_admin_inventory_snapshot_2026_10_11.sql in Supabase SQL Editor, then refresh.';
  if(lower.includes('invalid login credentials')) return t('Invalid login credentials',lang);
  if(lower.includes('email not confirmed')) return t('Email is not confirmed',lang);
  if(lower.includes('not authorized')) return t('Not authorized',lang);
  if(lower.includes('insufficient stock')) return t('Insufficient stock',lang);
  if(lower.includes('recipe version is not active')) return t('Recipe version is not active',lang);
  if(lower.includes('recipe cannot be empty')) return t('Recipe cannot be empty',lang);
  if(lower.includes('duplicate materials')) return t('Recipe contains duplicate materials',lang);
  if(lower.includes('recipe quantities cannot be negative')) return t('Recipe quantities cannot be negative',lang);
  if(lower.includes('unknown material')) return t('Recipe contains an unknown material',lang);
  if(lower.includes('unit does not match')) return t('Recipe unit does not match the material base unit',lang);
  if(lower.includes('batches do not match')) return t('Batches do not match the selected sack count',lang);
  if(lower.includes('each batch must be')) return t('Each batch must be 1.0 or 0.5 sack',lang);
  if(lower.includes('batch numbers must be sequential')) return t('Batch numbers must be sequential starting at 1',lang);
  if(lower.includes('consumption contains duplicate')) return t('Consumption contains duplicate materials',lang);
  if(lower.includes('consumption contains an unknown')) return t('Consumption contains an unknown material',lang);
  if(lower.includes('actual consumption cannot be negative')) return t('Actual consumption cannot be negative',lang);
  if(lower.includes('sack count')) return t('Sack count must be between 0.5 and 9.5.',lang);
  if(!raw) return t('Something went wrong',lang);
  return lang==='en' ? raw : t('Something went wrong',lang);
}

function seed(){
  const saved=localStorage.getItem(KEY);
  if(saved){
    const data=JSON.parse(saved);
    // Force one PIN login when upgrading from the old auto-admin demo session.
    if(!data.__pinLoginV1){
      data.session=null;
      data.__pinLoginV1=true;
      localStorage.setItem(KEY,JSON.stringify(data));
    }
    return data;
  }
  const data={
    session:null,
    __pinLoginV1:true,
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
let liveState = {recipe:null, productions:[], balances:[], users:[], summaryToday:null, summaryAll:null, syncError:null};
let summaryRpcAvailable=true;
let route='dashboard';

const app=document.getElementById('app');
const modalRoot=document.getElementById('modalRoot');
const toastRoot=document.getElementById('toastRoot');


function showToast(message,type='info',duration=2600){
  if(!toastRoot) return;
  const toast=document.createElement('div');
  toast.className='toast '+type;
  toast.setAttribute('role',type==='error'?'alert':'status');
  const icon=type==='success'?'✓':type==='error'?'!':'i';
  toast.innerHTML=`<span class="toast-icon">${icon}</span><span class="toast-text"></span><button class="toast-close" aria-label="${esc(t('Close',lang))}">×</button>`;
  toast.querySelector('.toast-text').textContent=String(message);
  toast.querySelector('.toast-close').addEventListener('click',()=>toast.remove());
  toastRoot.appendChild(toast);
  requestAnimationFrame(()=>toast.classList.add('show'));
  window.setTimeout(()=>{toast.classList.remove('show');window.setTimeout(()=>toast.remove(),220);},duration);
}


function saveDemo(){ if(isDemo) localStorage.setItem(KEY,JSON.stringify(db)); }
function leposhkaIcon(size=48){
  return '<svg class="leposhka-svg" width="'+size+'" height="'+size+'" viewBox="0 0 64 64" aria-hidden="true">'+
    '<defs><radialGradient id="lpBread" cx="35%" cy="28%"><stop offset="0" stop-color="#ffe8a4"/><stop offset=".52" stop-color="#e9a23b"/><stop offset="1" stop-color="#a95816"/></radialGradient></defs>'+
    '<ellipse cx="32" cy="35" rx="25" ry="17" fill="rgba(0,0,0,.13)"/>'+
    '<ellipse cx="32" cy="30" rx="24" ry="18" fill="url(#lpBread)" stroke="#8c4615" stroke-width="1.5"/>'+
    '<ellipse cx="32" cy="30" rx="18" ry="11" fill="none" stroke="#b86a1f" stroke-width="2.5" opacity=".75"/>'+
    '<path d="M24 23c2 5 2 10 0 14M40 23c-2 5-2 10 0 14M18 29c4 1 7 1 10 0M46 29c-4 1-7 1-10 0" fill="none" stroke="#8f4d19" stroke-width="2" stroke-linecap="round" opacity=".7"/>'+
    '<g fill="#fff2bd"><ellipse cx="20" cy="24" rx="1.4" ry=".8" transform="rotate(-24 20 24)"/><ellipse cx="29" cy="20" rx="1.5" ry=".8" transform="rotate(18 29 20)"/><ellipse cx="39" cy="22" rx="1.4" ry=".8" transform="rotate(-13 39 22)"/><ellipse cx="46" cy="27" rx="1.4" ry=".8" transform="rotate(20 46 27)"/><ellipse cx="25" cy="33" rx="1.3" ry=".8" transform="rotate(14 25 33)"/><ellipse cx="36" cy="35" rx="1.4" ry=".8" transform="rotate(-20 36 35)"/></g>'+
    '</svg>';
}
const ICONS={
  flour:'<svg class="material-svg" viewBox="0 0 64 64" aria-hidden="true"><path d="M20 19h24l5 8v25H15V27l5-8Z" fill="#e3c697"/><path d="M20 19h24l5 8H15l5-8Z" fill="#f4ddb0"/><path d="M22 19v-5h20v5" fill="none" stroke="#9b6e3b" stroke-width="3" stroke-linecap="round"/><path d="M21 35h22M21 41h16" stroke="#a6773d" stroke-width="2.5" stroke-linecap="round"/></svg>',
  water:'<svg class="material-svg" viewBox="0 0 64 64" aria-hidden="true"><path d="M32 8C25 19 16 28 16 39a16 16 0 0 0 32 0C48 28 39 19 32 8Z" fill="#70cfff" stroke="#2494d0" stroke-width="2"/><path d="M23 40c0-5 3-9 6-13" fill="none" stroke="#e9f9ff" stroke-width="4" stroke-linecap="round"/></svg>',
  oil:'<svg class="material-svg" viewBox="0 0 64 64" aria-hidden="true"><path d="M28 10h8v7h5v35H23V17h5Z" fill="#f3c94f" stroke="#bd8b1c" stroke-width="2"/><path d="M27 25h12M25 47h14" stroke="#fff1a7" stroke-width="3" stroke-linecap="round"/><path d="M29 10h6" stroke="#8c6514" stroke-width="3" stroke-linecap="round"/></svg>',
  yeast:'<svg class="material-svg" viewBox="0 0 64 64" aria-hidden="true"><rect x="20" y="14" width="24" height="37" rx="7" fill="#c5a6ff" stroke="#7854b8" stroke-width="2"/><path d="M19 18h26v-6H19z" fill="#7452b3"/><circle cx="32" cy="34" r="8" fill="#fff4d9"/><circle cx="29" cy="31" r="2" fill="#9a6c28"/><circle cx="35" cy="36" r="2" fill="#9a6c28"/></svg>',
  salt:'<svg class="material-svg" viewBox="0 0 64 64" aria-hidden="true"><path d="M17 31h30l-4 20H21l-4-20Z" fill="#f9fbff" stroke="#bdc4ce" stroke-width="2"/><ellipse cx="32" cy="31" rx="15" ry="6" fill="#fff" stroke="#c9cfd8" stroke-width="2"/><path d="M23 20h18v7H23z" fill="#dfe4ea" stroke="#aeb6c1" stroke-width="2"/><circle cx="28" cy="22" r="1" fill="#9aa3ae"/><circle cx="33" cy="22" r="1" fill="#9aa3ae"/><circle cx="38" cy="22" r="1" fill="#9aa3ae"/></svg>',
  sugar:'<svg class="material-svg" viewBox="0 0 64 64" aria-hidden="true"><path d="M17 31h30l-4 20H21l-4-20Z" fill="#fffdfa" stroke="#bdb7af" stroke-width="2"/><ellipse cx="32" cy="31" rx="15" ry="6" fill="#fff" stroke="#d5cec4" stroke-width="2"/><path d="M23 20h18v7H23z" fill="#ebe5dc" stroke="#b9b0a4" stroke-width="2"/></svg>'
};
function materialIcon(code){return ICONS[code]||'<svg class="material-svg" viewBox="0 0 64 64"><rect x="14" y="14" width="36" height="36" rx="10" fill="#d8dde4"/></svg>';}
const NAV_ICONS={
  home:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 10.5 12 3l8.5 7.5"/><path d="M5.5 9.5v10h13v-10"/><path d="M9 19.5v-6h6v6"/></svg>',
  production:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5h16M6.5 4v3.5M17.5 4v3.5"/><rect x="4" y="7.5" width="16" height="12.5" rx="2"/><path d="M8 12h8M8 15.5h5"/></svg>',
  stock:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="M4 7v10l8 4 8-4V7M12 11v10"/></svg>',
  recipe:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4.5A2.5 2.5 0 0 1 8.5 2H20v18H8.5A2.5 2.5 0 0 0 6 22V4.5Z"/><path d="M6 4.5A2.5 2.5 0 0 0 3.5 2H4v18h4.5A2.5 2.5 0 0 1 11 22"/></svg>',
  naan:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14c1.8-5.5 7.2-8.6 12.6-7.8 1.8.3 3.2 1.1 3.9 2.3-1.3 4.6-5 8-9.3 8.4-3.1.3-5.7-.9-7.2-2.9Z"/><path d="M9 10.5h.01M14 12.5h.01M12 15h.01"/></svg>',
  sales:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19.5h16M6 17V10M10 17V6M14 17v-3M18 17V4"/><path d="m15.5 5 2.5-1 1 2.5"/></svg>',
  more:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none"/></svg>'
};

function uiIcon(name,size=20){
  const paths={
    sack:'<path d="M9 3h6l-1 3 4 3-1 11H7L6 9l4-3-1-3Z"/><path d="M9 11c2 1 4 1 6 0M10 15h4"/>',
    bread:'<path d="M4 12c-1-3 1-6 4-6 1-3 7-3 8 0 3 0 5 3 4 6l-1 6H5l-1-6Z"/><path d="m9 9 1 2m4-3 1 2"/>',
    play:'<path d="m8 5 11 7-11 7V5Z" fill="currentColor" stroke="none"/>',
    recipe:'<path d="M6 4h13v16H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z"/><path d="M8 8h7M8 12h7M8 16h4"/>',
    trend:'<path d="m3 17 5-5 4 3 8-9"/><path d="M15 6h5v5"/>',
    pieces:'<circle cx="12" cy="12" r="8"/><path d="M12 4v16M4 12h16M6.5 6.5l11 11m0-11-11 11"/>',
    layers:'<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
    spark:'<path d="m12 2 2.2 6.2L20 10l-5.8 2.1L12 18l-2.2-5.9L4 10l5.8-1.8L12 2Z"/><path d="m19 15 .9 2.7L22 19l-2.1.8L19 22l-.8-2.2L16 19l2.2-1.3L19 15Z"/>',
    cube:'<path d="m12 3 9 5v10l-9 5-9-5V8l9-5Z"/><path d="m3 8 9 5 9-5M12 13v10"/>',
    activity:'<path d="M3 12h4l3-8 5 16 3-8h4"/>',
    gauge:'<path d="M4 18a9 9 0 1 1 16 0"/><path d="m12 13 4-5M6 18h12"/>',
    factory:'<path d="M4 20V9l6 4V9l6 4V5h4v15H4Z"/><path d="M7 17h2m3 0h2m3-7h1"/>',
    package:'<path d="m12 3 9 5v10l-9 5-9-5V8l9-5Z"/><path d="m3 8 9 5 9-5M12 13v10"/>',
    mouse:'<rect x="7" y="3" width="10" height="18" rx="5"/><path d="M12 3v5"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
    home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10Z"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01"/>',
    shield:'<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>',
    users:'<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    minus:'<path d="M5 12h14"/>',
    search:'<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/>',
    filter:'<path d="M4 5h16l-6 7v5l-4 2v-7L4 5Z"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15.1 21 16.2l-1.6 2.7-1.8-.7a8 8 0 0 1-1.8 1l-.3 1.8h-3l-.3-1.8a8 8 0 0 1-1.8-1l-1.8.7L7 16.2l1.6-1.1a7 7 0 0 1 0-2L7 12l1.6-2.7 1.8.7a8 8 0 0 1 1.8-1l.3-1.8h3l.3 1.8a8 8 0 0 1 1.8 1l1.8-.7L21 12l-1.6 1.1a7 7 0 0 1 0 2Z"/>',
    bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    download:'<path d="M12 3v12m-5-5 5 5 5-5M4 20h16"/>',
    upload:'<path d="M12 16V4m-5 5 5-5 5 5M4 20h16"/>',
    history:'<path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
    refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.5 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.5-3"/>',
    wrench:'<path d="M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18l3 3 5.3-5.3a5 5 0 0 0 6.4-6.4L14 13l-3-3 3.7-3.7Z"/>',
    chart:'<path d="M4 19V5M4 19h17"/><path d="m7 15 4-4 3 2 5-7"/>',
    truck:'<path d="M3 6h11v12H3zM14 10h4l3 3v5h-7z"/><circle cx="7.5" cy="19" r="1.5"/><circle cx="17.5" cy="19" r="1.5"/>',
    clipboard:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M8 10h8M8 14h8M8 18h4"/>',
    target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
    moon:'<path d="M20.9 13A8.5 8.5 0 0 1 11 3.1 8.5 8.5 0 1 0 20.9 13Z"/>',
    wifi:'<path d="M5 12.5a11 11 0 0 1 14 0M8 16a6.5 6.5 0 0 1 8 0m-5 3h2M2 9a16 16 0 0 1 20 0"/>',
    lock:'<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/>',
    eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    alert:'<path d="M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4m0 3h.01"/>',
    packageOpen:'<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="M3 8v9l9 5 9-5V8M12 13v9M7 5.8l9 5"/>',
    thermometer:'<path d="M14 14.8V5a3 3 0 0 0-6 0v9.8a5 5 0 1 0 6 0Z"/><path d="M11 11v6"/>',
    sparkles:'<path d="m12 3 1.9 5.8L20 11l-6.1 2.1L12 19l-1.9-5.9L4 11l6.1-2.2L12 3Z"/><path d="m19 14 1 2.5 2 1-2 1-1 2.5-1-2.5-2-1 2-1 1-2.5Z"/>',
    sliders:'<path d="M4 7h10m4 0h2M4 17h2m4 0h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
    more:'<circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/>',
    chevron:'<path d="m9 5 7 7-7 7"/>'
  };
  return '<svg class="df-icon" width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[name]||paths.spark)+'</svg>';
}
function wireInteractiveCards(){
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  if(!reduced && window.matchMedia?.('(pointer:fine)')?.matches){
    document.querySelectorAll('[data-tilt]').forEach(card=>{
      if(card.dataset.tiltWired==='1')return;
      card.dataset.tiltWired='1';
      card.addEventListener('pointermove',e=>{
        const r=card.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;
        card.style.setProperty('--card-rx',(-y*3).toFixed(2)+'deg');
        card.style.setProperty('--card-ry',(x*4).toFixed(2)+'deg');
      });
      card.addEventListener('pointerleave',()=>{card.style.setProperty('--card-rx','0deg');card.style.setProperty('--card-ry','0deg');});
      card.addEventListener('focus',()=>card.classList.add('tilt-focused'));
      card.addEventListener('blur',()=>card.classList.remove('tilt-focused'));
    });
  }
}

function roleName(r){return ({admin:t('Admin',lang),hamurchi:t('Hamurchi',lang),naan:t('Naan / Leposhka Maker',lang),sales:t('Salesman',lang)})[r]||r;}
function captureRouteDraft(){
  if(route==='dashboard'){
    return {type:'dashboard',selected:Number(document.getElementById('dashboardTotal')?.textContent||0)};
  }
  if(route==='production'){
    return {
      type:'production',
      sackCount:document.getElementById('sackCount')?.value||'0',
      pieces:[...document.querySelectorAll('[data-pieces]')].map(x=>x.value),
      consumption:[...document.querySelectorAll('.actual-consumption')].map(x=>({code:x.dataset.code,value:x.value}))
    };
  }
  if(route==='recipe'){
    return {
      type:'recipe',
      quantities:[...document.querySelectorAll('.recipe-qty')].map(x=>({code:x.dataset.code,value:x.value}))
    };
  }
  return null;
}
function restoreRouteDraft(draft){
  if(!draft) return;
  if(draft.type==='dashboard'){
    const selected=Number(draft.selected||0);
    const full=Math.floor(selected);
    if(full>0) document.querySelector(`[data-dashboard-sack="${full}"]`)?.click();
    if(selected%1===0.5) document.getElementById('dashboardHalf')?.click();
    return;
  }
  if(draft.type==='production'){
    const input=document.getElementById('sackCount');
    if(input){
      input.value=draft.sackCount;
      input.dispatchEvent(new Event('input',{bubbles:true}));
      [...document.querySelectorAll('[data-pieces]')].forEach((el,i)=>{if(draft.pieces[i]!==undefined) el.value=draft.pieces[i];});
      draft.consumption.forEach(item=>{
        const el=document.querySelector(`.actual-consumption[data-code="${CSS.escape(item.code)}"]`);
        if(el) el.value=item.value;
      });
    }
  }else if(draft.type==='recipe'){
    draft.quantities.forEach(item=>{
      const el=document.querySelector(`.recipe-qty[data-code="${CSS.escape(item.code)}"]`);
      if(el) el.value=item.value;
    });
  }
}
async function setLanguage(next){
  const draft=captureRouteDraft();
  const scrollY=window.scrollY;
  lang=saveLang(currentUser?.id||'guest',next);
  if(currentUser) currentUser.lang=lang;
  if(isDemo && db?.session){ db.session.lang=lang; saveDemo(); }
  await render();
  restoreRouteDraft(draft);
  window.scrollTo(0,scrollY);
  if(!isDemo && currentUser){
    const {error}=await supabase.rpc('set_preferred_language',{p_language:lang});
    if(error) console.warn('Language preference could not be saved:',error);
  }
}
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
  const base=[['dashboard',NAV_ICONS.home,'Home']];
  if(role==='admin'||role==='hamurchi') base.push(['production',NAV_ICONS.production,'Production']);
  if(role==='admin') base.push(['inventory',NAV_ICONS.stock,'Stock']);
  if(role==='admin'||role==='hamurchi') base.push(['recipe',NAV_ICONS.recipe,'Recipe']);
  if(role==='naan') base.push(['naan',NAV_ICONS.naan,'Naan']);
  if(role==='sales') base.push(['sales',NAV_ICONS.sales,'Sales']);
  base.push(['more',NAV_ICONS.more,'More']);
  return base;
}
async function init(){
  if(configError){
    authError='DoughFlow configuration is missing. Contact the administrator.';
  } else if(!isDemo){
    // Render as soon as the profile is known; dashboard data must never gate sign-in.
    const sessionPromise=supabase.auth.getSession();
    supabase.auth.onAuthStateChange((event,s)=>{
      if(!['SIGNED_IN','SIGNED_OUT','USER_UPDATED'].includes(event)) return;
      setTimeout(async()=>{
        if(s){
          await loadUser(s.user);
          render();
          if(currentUser) void refreshLiveState().then(()=>{if(currentUser)refreshVisiblePageData();});
        } else { currentUser=null; authError=''; render(); }
      },0);
    });
    const {data:{session}}=await sessionPromise;
    if(session) await loadUser(session.user);
  } else {
    currentUser=db.session.user ? {...db.session.user,role:db.session.role,lang:db.session.lang||getSavedLang(db.session.user.id)} : null;
    lang=currentUser?.lang||lang;
  }
  render();
  if(!isDemo && currentUser) void refreshLiveState().then(()=>refreshVisiblePageData());
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
function refreshVisiblePageData(){
  if(!currentUser)return;
  if(route==='dashboard'){
    const p=document.getElementById('page');
    if(p)renderDashboard(p);
  }else if(route==='production'){
    const p=document.getElementById('page');
    if(p)renderProduction(p);
  }
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
  try{
    const usersQuery=currentUser?.role==='admin'
      ? supabase.from('profiles').select('id,full_name,role').order('full_name')
      : Promise.resolve({data:[],error:null});
    const summaryQueries=summaryRpcAvailable
      ? [
          supabase.rpc('production_summary',{p_from:today(),p_to:today()}),
          supabase.rpc('production_summary',{p_from:null,p_to:null})
        ]
      : [Promise.resolve({data:null,error:null}),Promise.resolve({data:null,error:null})];
    const [recipeRes,runsRes,balancesRes,usersRes,todaySummaryRes,allSummaryRes]=await Promise.all([
      supabase.from('recipe_versions')
        .select('id,version_number,note,created_at,recipe_items(id,material_code,qty_per_mishok,unit,note,sort_order)')
        .eq('active',true).order('version_number',{ascending:false}).limit(1).maybeSingle(),
      supabase.from('production_runs')
        .select('id,production_date,created_by,mishok_count,recipe_version_id,created_at,production_batches(batch_no,mishok_fraction,pieces),production_materials(material_code,expected_qty,actual_qty,unit)')
        .order('created_at',{ascending:false}).limit(200),
      supabase.from('inventory_balances').select('*'),
      usersQuery,
      ...summaryQueries
    ]);

    if(recipeRes.error) throw recipeRes.error;
    if(runsRes.error) throw runsRes.error;
    if(balancesRes.error) throw balancesRes.error;
    if(usersRes.error) throw usersRes.error;

    const rv=recipeRes.data;
    liveState.recipe=rv?{
      id:rv.id,version:rv.version_number,
      items:(rv.recipe_items||[]).sort((a,b)=>a.sort_order-b.sort_order).map(x=>({
        code:x.material_code,
        name:MATERIALS.find(m=>m.code===x.material_code)?.name||x.material_code,
        qty:Number(x.qty_per_mishok),unit:x.unit,note:x.note||''
      }))
    }:null;

    liveState.productions=runsRes.data||[];
    liveState.balances=balancesRes.data||[];
    liveState.users=usersRes.data||[];

    if(summaryRpcAvailable && (todaySummaryRes.error || allSummaryRes.error)){
      summaryRpcAvailable=false;
    }
    liveState.summaryToday=summaryRpcAvailable && Array.isArray(todaySummaryRes.data)?(todaySummaryRes.data[0]||null):null;
    liveState.summaryAll=summaryRpcAvailable && Array.isArray(allSummaryRes.data)?(allSummaryRes.data[0]||null):null;
    liveState.syncError=null;
  }catch(error){
    liveState.syncError=friendlyError(error);
  }
}
async function render(){
  document.body.classList.toggle('dashboard-mode', !!currentUser && route==='dashboard');
  document.body.dataset.route=currentUser?route:'login';
  if(!currentUser){
    app.innerHTML=loginHTML(); wireLogin(); applyCurrentLanguage();
    document.getElementById('languageSelect')?.addEventListener('change',e=>setLanguage(e.target.value));
    document.getElementById('loginError')?.setAttribute('data-auth-error','1');
    if(configError){
      const errorNode=document.getElementById('loginError');
      if(errorNode) errorNode.textContent=t('DoughFlow configuration is missing. Contact the administrator.',lang);
      document.querySelectorAll('#loginForm input, #loginForm button').forEach(el=>{el.disabled=true;});
    } else if(authError) document.getElementById('loginError').textContent=authError;
    return;
  }
  if(!can(currentUser.role,route)) route='dashboard';
  app.innerHTML=appShellHTML();
  document.querySelectorAll('[data-route]').forEach(b=>b.addEventListener('click',()=>navigateTo(b.dataset.route)));
  document.getElementById('logout')?.addEventListener('click',logout);
  await renderPage();
  applyCurrentLanguage();
  document.getElementById('languageSelect')?.addEventListener('change',e=>setLanguage(e.target.value));
  document.getElementById('heroLanguageSelect')?.addEventListener('change',e=>setLanguage(e.target.value));
}
let routeRenderId=0;
async function navigateTo(nextRoute){
  if(!currentUser||!can(currentUser.role,nextRoute)||nextRoute===route)return;
  route=nextRoute;
  const renderId=++routeRenderId;
  document.body.classList.toggle('dashboard-mode',route==='dashboard');
  document.body.dataset.route=route;
  document.querySelectorAll('[data-route]').forEach(button=>{
    const active=button.dataset.route===route;
    button.classList.toggle('active',active);
    if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
  });
  const page=document.getElementById('page');
  if(!page)return;
  page.innerHTML='<div class="page-loading" role="status"><span class="inline-spinner" aria-hidden="true"></span><span>'+esc(t('Loading…',lang))+'</span></div>';
  await renderPage();
  if(renderId!==routeRenderId||document.body.dataset.route!==route)return;
  applyCurrentLanguage();
  document.getElementById('languageSelect')?.addEventListener('change',e=>setLanguage(e.target.value));
  document.getElementById('heroLanguageSelect')?.addEventListener('change',e=>setLanguage(e.target.value));
}

function loginHTML(){
  return `<div class="login-portal">
    <div class="login-photo"></div><div class="login-shade"></div>
    <div class="login-shell">
      <div class="login-brand-row">
        <div class="login-logo">${leposhkaIcon(42)}</div>
        <div><strong>DoughFlow</strong><small>${t('Bakery control',lang)}</small></div>
        <div class="login-lang">${languageFlag()} ${languageSwitcher()}</div>
      </div>
      <div class="login-main-card">
        <div class="login-badge">${leposhkaIcon(42)}</div>
        <div class="eyebrow login-eyebrow">${t('Kyrgyz bakery portal',lang)}</div>
        <h1>${t('Welcome back',lang)} 👋</h1>
        <p>${t('Enter your four-digit PIN.',lang)}</p>
        <form id="loginForm" class="modern-login-form pin-login-form">
          <div class="field">
            <label for="loginPin">${t('4-digit PIN',lang)}</label>
            <div class="pin-display-wrap">
              <input required id="loginPin" class="pin-input" type="password" name="pin" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="one-time-code" placeholder="••••" aria-describedby="pinHint">
              <button type="button" class="pin-visibility" id="togglePin" aria-label="${t('Show PIN',lang)}">◉</button>
            </div>
            <small id="pinHint" class="pin-hint">${t('Your PIN is personal. Five failed attempts temporarily pause sign-in.',lang)}</small>
          </div>
          <div class="pin-keypad" aria-label="${t('PIN keypad',lang)}">
            ${[1,2,3,4,5,6,7,8,9,'clear',0,'back'].map(k=>k==='clear'
              ? `<button type="button" class="pin-key utility" data-pin-key="clear">${t('Clear',lang)}</button>`
              : k==='back'
                ? `<button type="button" class="pin-key utility" data-pin-key="back" aria-label="${t('Delete last digit',lang)}">⌫</button>`
                : `<button type="button" class="pin-key" data-pin-key="${k}">${k}</button>`).join('')}
          </div>
          <button class="login-submit" type="submit"><span>⌁</span>${t('Unlock DoughFlow',lang)}<b>›</b></button>
          <div id="loginError" class="login-error">${esc(authError)}</div>
        </form>
        <div class="login-footer-line"><span>🇰🇬 ${t('Bishkek',lang)}</span><span>•</span><span>DoughFlow</span></div>
      </div>
      <div class="login-credit"><span>✦</span> Сделано Али</div>
    </div>
  </div>`;
}
function ensureDemoPins(){
  if(!isDemo||!db) return;
  const initial=[
    {role:'admin',alias:'askat',pin:'1214'},
    {role:'hamurchi',alias:'hamurchi',pin:'2468'},
    {role:'naan',alias:'naan',pin:'1357'},
    {role:'sales',alias:'sales',pin:'8642'}
  ];
  db.users=(db.users||[]).map(user=>{
    const defaults=initial.find(x=>x.role===user.role);
    return {...user,loginAlias:user.loginAlias||defaults?.alias||String(user.name||user.role).toLowerCase().replace(/[^a-z0-9._-]/g,'').slice(0,32),pin:user.pin||defaults?.pin||''};
  });
  saveDemo();
}
function wireLogin(){
  const pinInput=document.getElementById('loginPin');
  const pinError=document.getElementById('loginError');
  document.getElementById('togglePin')?.addEventListener('click',()=>{
    if(!pinInput) return;
    pinInput.type=pinInput.type==='password'?'text':'password';
  });
  pinInput?.addEventListener('input',()=>{
    pinInput.value=pinInput.value.replace(/\D/g,'').slice(0,4);
  });
  document.querySelectorAll('[data-pin-key]').forEach(button=>button.addEventListener('click',()=>{
    if(!pinInput) return;
    const key=button.dataset.pinKey;
    if(key==='clear') pinInput.value='';
    else if(key==='back') pinInput.value=pinInput.value.slice(0,-1);
    else if(pinInput.value.length<4) pinInput.value+=key;
    pinInput.dispatchEvent(new Event('input',{bubbles:true}));
    pinInput.focus();
  }));
  if(isDemo) ensureDemoPins();

  document.getElementById('loginForm')?.addEventListener('submit',async e=>{
    e.preventDefault();
    if(!pinInput||!pinError) return;
    const pin=pinInput.value;
    if(!/^\d{4}$/.test(pin)){
      pinError.textContent=t('Enter your four-digit PIN.',lang);return;
    }
    const submit=e.currentTarget.querySelector('button[type="submit"]');
    if(submit) submit.disabled=true;
    pinError.textContent='';
    try{
      if(isDemo){
        const matches=(db.users||[]).filter(u=>String(u.pin||'')===pin);
        if(matches.length!==1){
          pinError.textContent=t('PIN is incorrect or not unique. Contact the administrator.',lang);return;
        }
        const user=matches[0];
        db.session={user:{id:user.id,name:user.name},role:user.role,lang:getSavedLang(user.id)};
        currentUser={id:user.id,name:user.name,role:user.role,lang:db.session.lang};
        lang=currentUser.lang;authError='';route='dashboard';saveDemo();render();return;
      }
      const endpoint=CFG.supabaseUrl.replace(/\/$/,'')+'/functions/v1/pin-login';
      const response=await fetch(endpoint,{
        method:'POST',
        headers:{'Content-Type':'application/json','apikey':CFG.supabaseAnonKey,'Authorization':'Bearer '+CFG.supabaseAnonKey},
        body:JSON.stringify({pin}),
        cache:'no-store'
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok){
        if(response.status===404||response.status>=500){
          pinError.textContent=t('PIN login is temporarily unavailable. Please contact the administrator.',lang);
          return;
        }
        const key=response.status===429?'Too many attempts. Try again later.':(payload.error||'PIN is incorrect');
        pinError.textContent=t(key,lang);
        return;
      }
      if(!payload.token_hash) throw new Error('Secure session token was not returned.');
      const {error}=await supabase.auth.verifyOtp({type:'magiclink',token_hash:payload.token_hash});
      if(error) throw error;
    }catch(error){
      const message=String(error?.message||'');
      if(/fetch|network|load failed/i.test(message)){
        pinError.textContent=t('PIN login is temporarily unavailable. Please contact the administrator.',lang);
      }else pinError.textContent=friendlyError(error);
    }finally{
      if(submit) submit.disabled=false;
    }
  });
}
async function logout(){ if(isDemo){db.session=null;currentUser=null;authError='';lang=getSavedLang('guest');saveDemo();render();return;} await supabase.auth.signOut({scope:'local'}); }

function appShellHTML(){
  const items=navItems(currentUser.role);
  const initials=String(currentUser.name||'U').trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>Array.from(x)[0]).join('').toUpperCase()||'U';
  return `
    <div class="topbar">
      <div class="brand">
        <div class="brand-mark">${leposhkaIcon(30)}</div>
        <div class="brand-copy"><strong>DoughFlow</strong><span>Bakery control</span></div>
      </div>
      <div class="top-actions">
        <div class="user-chip"><span class="avatar">${esc(initials)}</span><span class="user-meta"><b class="no-translate">${esc(currentUser.name)}</b><small>${roleName(currentUser.role)}</small></span></div>
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
    ['inventory',NAV_ICONS.stock,'Stock & inventory','See balances and stock movements'],
    ['reports',NAV_ICONS.sales,'Reports','Review production and usage'],
    ['users',uiIcon('users',24),'People','Manage staff and roles'],
    ['naan',NAV_ICONS.naan,'Naan / Leposhka','Open the naan workflow'],
    ['sales',NAV_ICONS.sales,'Sales','Open the sales workspace'],
    ['recipe',NAV_ICONS.recipe,'Recipe','Edit the working recipe']
  );
  else if(currentUser.role==='hamurchi') extra.push(['recipe',NAV_ICONS.recipe,'Recipe','Edit the working recipe']);
  else if(currentUser.role==='naan') extra.push(['naan',NAV_ICONS.naan,'Naan / Leposhka','Open the naan workflow']);
  else if(currentUser.role==='sales') extra.push(['sales',NAV_ICONS.sales,'Sales','Open the sales workspace']);
  p.innerHTML=`
    <div class="page-head compact-head"><div><div class="eyebrow">${t('More',lang)}</div><h1>${t('Everything else',lang)}</h1><p>${t('Keep the daily workflow focused. Less-used tools live here.',lang)}</p></div></div>
    <div class="more-grid">
      ${extra.map(([r,icon,title,desc])=>`<button class="more-card" data-more-route="${r}"><span class="more-icon">${icon}</span><span><b>${t(title,lang)}</b><small>${t(desc,lang)}</small></span><span class="chevron">›</span></button>`).join('')}
      <button class="more-card danger-card" id="moreLogout"><span class="more-icon">${uiIcon('shield',24)}</span><span><b>${t('Log out',lang)}</b><small>${t('Sign out from this device',lang)}</small></span><span class="chevron">›</span></button>
    </div>`;
  p.querySelectorAll('[data-more-route]').forEach(b=>b.addEventListener('click',()=>navigateTo(b.dataset.moreRoute)));
  p.querySelector('#moreLogout')?.addEventListener('click',logout);
}
function renderDashboard(p){
  const prod=isDemo?db.productions:liveState.productions;
  const todayRuns=prod.filter(x=>(isDemo?x.date:x.production_date)===today());
  const todaySummary=!isDemo?liveState.summaryToday:null;
  const totalSacks=todaySummary?Number(todaySummary.total_sacks):todayRuns.reduce((a,b)=>a+Number(isDemo?b.mishokCount:b.mishok_count),0);
  const totalPieces=todaySummary?Number(todaySummary.total_pieces):todayRuns.reduce((a,b)=>a+(isDemo?b.batches:(b.production_batches||[])).reduce((s,z)=>s+Number(z.pieces||0),0),0);
  const totalRuns=todaySummary?Number(todaySummary.run_count):todayRuns.length;
  const stockRows=MATERIALS.map(m=>({...m,stock:m.inventoryTracked===false?null:getStock(m.code)}));
  const recipe=isDemo?db.recipe:liveState.recipe;
  const recipeVersion=isDemo?db?.recipe?.version:liveState.recipe?.version;
  const firstName=esc(currentUser.name.split(' ')[0]);
  const syncBanner=!isDemo&&liveState.syncError?"<div class='sync-banner' role='alert'>⚠️ <div><b>"+t('Data sync issue',lang)+"</b><small>"+t('Some data may be temporarily out of date.',lang)+"</small></div></div>":"";
  const recipeCards=(recipe?.items||[]).map(it=>"<div class='recipe-photo-card' data-tilt tabindex='0'><div class='recipe-visual "+esc(it.code)+"'><span>"+materialIcon(it.code)+"</span></div><b>"+esc(t(it.name,lang))+"</b><strong>"+fmt(it.qty)+" "+esc(it.unit)+"</strong></div>").join('');
  const stockCards=stockRows.map(m=>{
    const canOpen=currentUser.role==='admin'&&m.inventoryTracked!==false;
    const tag=canOpen?'button':'div';
    const attrs=canOpen?" type='button' data-stock-open='inventory'":'';
    const view=m.inventoryTracked===false?{primary:t('Recipe only',lang),secondary:t('Not tracked as inventory',lang)}:stockBreakdown(m,m.stock,lang);
    const empty=m.inventoryTracked!==false&&m.stock<=0;
    return `<${tag} class="stock-item${canOpen?' stock-open':''}" data-tilt${attrs}><div class="stock-item-icon ${esc(m.code)}">${materialIcon(m.code)}</div><div class="stock-item-copy"><b>${esc(t(m.name,lang))}</b><strong class="${empty?'empty-stock':''}">${esc(view.primary)}${empty?' <em>!</em>':''}</strong><small>${esc(view.secondary)}</small></div><span class="stock-chevron">${uiIcon('chevron',16)}</span></${tag}>`;
  }).join('');
  p.innerHTML =
    "<section class='portal-hero'>"+
      "<div class='portal-hero-photo'></div><div class='portal-hero-shade'></div>"+
      "<div class='portal-hero-content'>"+
        "<div class='hero-topline'>"+
          "<div class='df-badge'>DF</div><div class='hero-brand'><b>DoughFlow</b><small>"+t('Bakery control',lang)+"</small></div><div class='hero-spacer'></div>"+
          "<label class='hero-language'><span>"+languageFlag()+"</span><select id='heroLanguageSelect' aria-label=\""+t('Language',lang)+"\">"+languageOptions(lang)+"</select><b>⌄</b></label>"+
          "<div class='hero-user'><span class='hero-avatar'>"+esc(Array.from(String(currentUser.name||'A').trim())[0]?.toUpperCase()||'A')+"</span><span><b class='no-translate'>"+esc(currentUser.name)+"</b><small>"+roleName(currentUser.role)+"</small></span></div>"+
        "</div>"+
        "<div class='hero-copy'><h1>"+t('Good day',lang)+", "+firstName+" <span>👋</span></h1><p>"+t('Let’s make great leposhka today!',lang)+"</p><div class='hero-date'>"+uiIcon('calendar',17)+" "+formatToday()+"</div></div>"+
      "</div>"+
    "</section>"+
    syncBanner+
    "<section class='metric-grid'>"+
      "<div class='metric-card metric-green' data-tilt><div class='metric-head'><span class='metric-icon-svg'>"+uiIcon('sack',21)+"</span><b>"+t('Today’s Sacks',lang)+"</b></div><strong>"+fmt(totalSacks)+"</strong><i>"+uiIcon('trend',44)+"</i></div>"+
      "<div class='metric-card metric-orange' data-tilt><div class='metric-head'><span class='metric-icon-svg'>"+uiIcon('bread',21)+"</span><b>"+t('Today’s Pieces',lang)+"</b></div><strong>"+fmt(totalPieces)+"</strong><i>"+uiIcon('pieces',44)+"</i></div>"+
      "<div class='metric-card metric-purple' data-tilt><div class='metric-head'><span class='metric-icon-svg'>"+uiIcon('play',21)+"</span><b>"+t('Production Runs',lang)+"</b></div><strong>"+totalRuns+"</strong><i>"+uiIcon('layers',44)+"</i></div>"+
      "<div class='metric-card metric-blue' data-tilt><div class='metric-head'><span class='metric-icon-svg'>"+uiIcon('recipe',21)+"</span><b>"+t('Recipe Version',lang)+"</b></div><strong>v"+(recipeVersion??'—')+"</strong><i>"+uiIcon('spark',44)+"</i></div>"+
    "</section>"+
    "<section class='portal-panel production-panel'>"+
      "<div class='panel-photo-strip'><div class='panel-photo'></div><div class='panel-photo-shade'></div><div class='panel-title-wrap'><div class='panel-sticker coral'>"+leposhkaIcon(34)+"</div><div><h2>"+t('New Production',lang)+"</h2><p>"+t('Select total sacks (you can add 0.5)',lang)+"</p></div></div></div>"+
      "<div class='portal-panel-inner'>"+
        "<div class='portal-section-title'><div class='section-icon green'>"+leposhkaIcon(30)+"</div><div><h3>"+t('Sack Count',lang)+"</h3><span>ⓘ 1–9 "+t('Sacks',lang)+" + 0.5</span></div></div>"+
        "<div class='dashboard-sack-grid'>"+Array.from({length:9},(_,i)=>"<button class='dashboard-sack-btn' data-dashboard-sack='"+(i+1)+"'>"+(i+1)+"</button>").join('')+"</div>"+
        "<div class='dashboard-sack-row'><button class='dashboard-half-btn' id='dashboardHalf'>＋ <b>0.5</b></button><div class='dashboard-total'><small>"+t('Total',lang)+"</small><strong id='dashboardTotal'>0</strong></div><button class='dashboard-reset' id='dashboardReset'>↻ <span>"+t('Reset',lang)+"</span></button></div>"+
        "<div class='portal-section-title recipe-title'><div class='section-icon mint'>▦</div><div><h3>"+t('Recipe',lang)+" <small>("+t('per 1 sack',lang)+")</small></h3><span>"+t('Automatically calculated',lang)+" ⚙</span></div></div>"+
        "<div class='recipe-photo-grid'>"+recipeCards+"</div>"+
        "<button class='start-production-button' id='dashboardStart'>▶ <span>"+t('Start Production',lang)+"<small>"+t('Calculate ingredients and enter pieces',lang)+"</small></span><b>›</b></button>"+
      "</div>"+
    "</section>"+
    "<section class='portal-panel stock-panel'>"+
      "<div class='portal-section-title stock-title'><div class='section-icon brown'>"+materialIcon('flour')+"</div><div><h3>"+t('Stock Overview',lang)+"</h3><span>"+t('Current available stock in inventory',lang)+"</span></div>"+
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
    const initialCount=selected||1;
    route='production';render();
    setTimeout(()=>{
      const input=document.getElementById('sackCount');
      if(input){input.value=initialCount;input.dispatchEvent(new Event('input',{bubbles:true}));}
    },0);
  };
  document.getElementById('dashboardStart')?.addEventListener('click',openProduction);
  document.querySelectorAll('[data-stock-open]').forEach(b=>b.addEventListener('click',()=>{route='inventory';render();}));
  document.getElementById('openInventory')?.addEventListener('click',()=>{route='inventory';render();});
  wireInteractiveCards();
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
  p.innerHTML=`<div class="page-head compact-head"><div><div class="eyebrow">DAILY WORKFLOW</div><h1>Production</h1><p>Choose a batch, record actual pieces, and finish with confidence.</p></div></div><section class="workflow-progress-card" aria-live="polite"><div class="workflow-progress-top"><span class="workflow-step-icon">01</span><div class="workflow-progress-copy"><strong id="productionJourneyTitle">Choose your batch</strong><small id="productionJourneyText">Select total sacks to begin. Half-sacks are supported.</small></div><span class="workflow-step-count" id="productionJourneyCount">0 / 3</span></div><div class="workflow-progress-track"><span id="productionJourneyFill" style="width:0%"></span></div><div class="workflow-phase-list"><span>1 · Sacks</span><span>2 · Pieces</span><span>3 · Review</span></div></section><div class="grid grid-2"><div class="card production-work-card"><div class="workflow-heading"><span class="workflow-step-number">01</span><div><h2>New production</h2><p>Batch size and actual output</p></div></div><div class="field"><label>Sack count</label><div class="sack-picker"><button type="button" class="sack-choice" data-sack="1">1</button><button type="button" class="sack-choice " data-sack="2">2</button><button type="button" class="sack-choice " data-sack="3">3</button><button type="button" class="sack-choice " data-sack="4">4</button><button type="button" class="sack-choice " data-sack="5">5</button><button type="button" class="sack-choice " data-sack="6">6</button><button type="button" class="sack-choice " data-sack="7">7</button><button type="button" class="sack-choice " data-sack="8">8</button><button type="button" class="sack-choice " data-sack="9">9</button><button type="button" class="sack-choice half-choice" data-half="0.5">＋ 0.5</button></div><div class="sack-total"><span>Total sacks</span><strong id="sackTotal">0</strong><button type="button" class="reset-sack" id="resetSack">Reset</button></div><input id="sackCount" class="sr-only" type="number" min="0" max="9.5" step="0.5" value="0"></div><div id="batchEditor"></div><div style="height:10px"></div><h3>Material consumption</h3><div id="consumptionEditor"></div><div class="notice" style="margin:12px 0">A full sack = 1.0. The +0.5 button adds a half-sack, so 6 + 0.5 = 6.5. Maximum is 9.5 sacks.</div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" id="saveProduction">Complete production</button><button class="btn secondary" id="clearProduction">Clear</button></div></div><div class="card"><h2>Today’s production</h2>${existing.length?`<div class="table-wrap"><table><thead><tr><th>Time</th><th>Sacks</th><th>Pieces</th><th>Recipe</th></tr></thead><tbody>${existing.map(r=>{const bs=isDemo?r.batches:r.production_batches||[]; return `<tr><td>${esc(isDemo?r.timeLabel:new Date(r.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}))}</td><td>${fmt(isDemo?r.mishokCount:r.mishok_count)}</td><td>${fmt(bs.reduce((s,z)=>s+Number(z.pieces||0),0))}</td><td>v${isDemo?r.recipeVersion:(liveState.recipe?.version||'—')}</td></tr>`}).join('')}</tbody></table></div>`:'<div class="empty">No production saved today.</div>'}</div></div>`;
  const editor=document.getElementById('batchEditor');
  const consumption=document.getElementById('consumptionEditor');
  const updateJourney=()=>{
    const count=normalizeSackCount(document.getElementById('sackCount').value);
    const countReady=count>=0.5&&count<=9.5;
    const pieces=[...editor.querySelectorAll('[data-pieces]')];
    const piecesReady=countReady&&pieces.length>0&&pieces.every(x=>x.value.trim()!==''&&Number.isInteger(Number(x.value))&&Number(x.value)>0);
    const quantities=[...consumption.querySelectorAll('.actual-consumption')];
    const quantitiesValid=quantities.length>0&&quantities.every(x=>x.value.trim()!==''&&Number.isFinite(Number(x.value))&&Number(x.value)>=0);
    const step=!countReady?0:!piecesReady?1:!quantitiesValid?2:3;
    const titles=['Choose your batch','Enter actual pieces','Review material use','Ready to complete'];
    const details=['Select total sacks to begin. Half-sacks are supported.','Enter actual whole-piece count for every batch.','Check actual ingredient use before saving.','Everything is valid. Review once, then complete production.'];
    const title=document.getElementById('productionJourneyTitle');
    const detail=document.getElementById('productionJourneyText');
    const countLabel=document.getElementById('productionJourneyCount');
    const fill=document.getElementById('productionJourneyFill');
    if(title)title.textContent=titles[step];
    if(detail)detail.textContent=details[step];
    if(countLabel)countLabel.textContent=step+' / 3';
    if(fill)fill.style.width=(step/3*100)+'%';
    const stepIcon=document.querySelector('.workflow-progress-card .workflow-step-icon');
    if(stepIcon)stepIcon.textContent=String(Math.min(step+1,3)).padStart(2,'0');
  };
  editor.addEventListener('input',updateJourney);
  consumption.addEventListener('input',updateJourney);
  const rebuild=()=>{
    const m=normalizeSackCount(document.getElementById('sackCount').value); document.getElementById('sackCount').value=m; const bs=batchesFor(m); document.getElementById('sackTotal').textContent=m;
    editor.innerHTML=`<h3>Batches</h3>${bs.map((b,i)=>`<div class="batch-row"><div class="batch-index">#${i+1}</div><div class="batch-kind">${b.sack===1?'1.0':'0.5'} sack</div><input type="number" min="0" step="1" data-pieces="${i}" placeholder="Actual pieces"></div>`).join('')}`;
    consumption.innerHTML=(recipe?.items||[]).map(it=>{const expected=Number(it.qty||0)*m;return `<div class="field-row"><div class="field"><label>${esc(it.name)} expected (${esc(it.unit)})</label><input class="expected-consumption" data-code="${esc(it.code)}" value="${expected}" disabled></div><div class="field"><label>Actual (${esc(it.unit)})</label><input class="actual-consumption" data-code="${esc(it.code)}" type="number" min="0" step="0.001" value="${expected}"></div></div>`}).join('');
    updateJourney();
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
    const count=normalizeSackCount(document.getElementById('sackCount').value); if(!(count>=0.5&&count<=9.5)){showToast(t('Sack count must be between 0.5 and 9.5.',lang),'error');return;}
    if(!recipe?.items?.length){showToast(t('No active recipe found.',lang),'error');return;}
    const pieceInputs=[...document.querySelectorAll('[data-pieces]')];
    if(pieceInputs.some(x=>x.value.trim()==='' || !Number.isInteger(Number(x.value)) || Number(x.value)<1)){
      showToast(t('Every batch needs a positive whole-number piece count.',lang),'error');return;
    }
    const pieces=pieceInputs.map(x=>Number(x.value));
    const consumptionItems=[...document.querySelectorAll('.actual-consumption')].map(el=>({code:el.dataset.code,actual:el.value}));
    if(consumptionItems.some(x=>!Number.isFinite(Number(x.actual))||Number(x.actual)<0)){showToast(t('Consumption values must be valid non-negative numbers.',lang),'error');return;}
    if(isDemo){
      const actualByCode=new Map(consumptionItems.map(x=>[x.code,Number(x.actual)]));
      for(const item of db.recipe.items.filter(item=>item.code!=='water')){
        const required=actualByCode.get(item.code);
        if(Number.isFinite(required) && required>getStock(item.code)){
          showToast(t('Insufficient stock',lang)+': '+t(item.name,lang),'error');
          return;
        }
      }
      const batches=batchesFor(count).map((b,i)=>({...b,pieces:pieces[i]}));
      const now=new Date(); const run={id:uid(),date:today(),timeLabel:now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}),createdBy:currentUser.name,mishokCount:count,batches,recipeVersion:db.recipe.version,consumption:consumptionItems.map(x=>({code:x.code,actual:Number(x.actual)}))};
      db.productions.push(run); applyProductionConsumption(count,run.id,run.consumption); saveDemo(); showToast(t('Saved',lang)+' '+count+' '+formatSackUnit(count,lang)+'.','success'); render();
    } else {
      const batchPayload=batchesFor(count).map((b,i)=>({batch_no:i+1,mishok_fraction:b.sack,pieces:pieces[i]||0}));
      const payload=consumptionItems.filter(x=>x.code!=='water').map(x=>({material_code:x.code,actual_qty:Number(x.actual)}));
      const recipeId=await activeRecipeId(); const {error}=await supabase.rpc('complete_production',{p_production_date:today(),p_mishok_count:count,p_recipe_version_id:recipeId,p_batches:batchPayload,p_consumption:payload});
      if(error){showToast(friendlyError(error),'error');return;} await refreshLiveState(); showToast(t('Production saved.',lang),'success'); render();
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
    inv.tx.push({id:uid(),dir:'out',qty,reason:'Production consumption',productionId,effectiveDate:today(),at:new Date().toISOString(),by:currentUser.name});
    db.inventory[item.code]=inv;
  });
}
function getStock(code){ if(isDemo) return Number(db?.inventory?.[code]?.stock||0); return Number(liveState.balances.find(x=>x.code===code)?.stock||0); }

function renderRecipe(p){
  const recipe=isDemo?db.recipe:liveState.recipe;
  if(!recipe){p.innerHTML='<div class="card"><h2>Recipe</h2><div class="alert warn">No active recipe found. Run the database seed SQL first.</div></div>';return;}
  p.innerHTML=`<div class="page-head compact-head"><div><div class="eyebrow">WORKING STANDARD</div><h1>Recipe</h1><p>Keep each ingredient consistent. Saving creates a new version; previous production stays unchanged.</p></div></div>
    <section class="recipe-guide-strip"><span class="recipe-guide-icon">${uiIcon('recipe',23)}</span><div><strong>Per operational sack</strong><small>Review quantity · check units · save a version</small></div><span class="recipe-version-pill">v${recipe.version}</span></section>
    <div class="grid grid-2 recipe-layout"><div class="card recipe-editor-card"><div class="workflow-heading"><span class="workflow-step-number">01</span><div><h2>Active recipe</h2><p>Quantities for one sack</p></div><span class="workflow-status" id="recipeStatusPill">Saved</span></div>${recipe.items.map((it)=>`<div class="field-row recipe-item-row" style="align-items:end"><div class="field"><label>${esc(it.name)} (${esc(it.unit)})</label><input class="recipe-qty" data-code="${esc(it.code)}" type="number" step="0.001" value="${it.qty}"><div class="small">${esc(it.note||'')}</div></div><div class="field"><label>Current standard</label><div class="notice recipe-standard-notice">${fmt(it.qty)} ${esc(it.unit)} / sack</div></div></div>`).join('')}<button class="btn primary recipe-save-button" id="saveRecipe">Save as new recipe version</button></div><div class="card recipe-packaging-card"><div class="workflow-heading compact"><span class="workflow-step-number neutral">02</span><div><h2>Packaging rules</h2><p>How stock is counted</p></div></div><div class="table-wrap"><table><thead><tr><th>Material</th><th>Purchase package</th></tr></thead><tbody>${STOCK_MATERIALS.map(m=>`<tr><td>${esc(m.name)}</td><td>${m.packages.map(x=>esc(x.label)).join('<br>')}</td></tr>`).join('')}</tbody></table></div><div class="notice" style="margin-top:14px">Water is a recipe input and is not tracked as stock. Salt supports 1 kg and 750 g packets. Yeast supports 500 g packets and 20-packet boxes. Oil uses 20 kg cartons.</div></div></div>`;
  document.querySelectorAll('.recipe-qty').forEach(input=>input.addEventListener('input',()=>{
    const pill=document.getElementById('recipeStatusPill');
    if(pill){pill.textContent='Unsaved changes';pill.classList.add('workflow-status-dirty');}
  }));
  document.getElementById('saveRecipe').addEventListener('click',async()=>{
    const recipeButton=document.getElementById('saveRecipe');
    recipeButton.disabled=true;recipeButton.textContent='Saving version…';
    const items=recipe.items.map((it,i)=>({...it,qty:Number(document.querySelector(`.recipe-qty[data-code="${it.code}"]`).value),sort_order:i}));
    if(items.some(x=>!Number.isFinite(x.qty)||x.qty<0)){recipeButton.disabled=false;recipeButton.textContent='Save as new recipe version';showToast(t('Recipe quantities must be valid non-negative numbers.',lang),'error');return;}
    if(isDemo){db.recipe.version+=1;db.recipe.updatedAt=new Date().toISOString();db.recipe.updatedBy=currentUser.name;db.recipe.items=items;saveDemo();showToast(`${t('Recipe saved as',lang)} v${db.recipe.version}.`,'success');render();}
    else {const {error}=await supabase.rpc('create_recipe_version',{p_items:items.map(x=>({code:x.code,qty:x.qty,unit:x.unit,note:x.note||'',sort_order:x.sort_order})),p_note:`Updated by ${currentUser.name}`});if(error){recipeButton.disabled=false;recipeButton.textContent='Save as new recipe version';showToast(friendlyError(error),'error');return;}await refreshLiveState();showToast(`${t('Recipe saved as',lang)} v${liveState.recipe.version}.`,'success');render();}
  });
}

async function renderInventory(p){
  if(currentUser.role!=='admin'){p.innerHTML='<div class="card"><h2>'+t('Inventory',lang)+'</h2><div class="alert error">'+t('Admin access only.',lang)+'</div></div>';return;}
  // Keep route navigation independent of the full dashboard sync; refresh stock after first paint.
  const options=STOCK_MATERIALS.map(m=>'<option value="'+m.code+'">'+esc(t(m.name,lang))+'</option>').join('');
  const cards=STOCK_MATERIALS.map(m=>{const v=stockBreakdown(m,getStock(m.code),lang);return '<div class="card stock-card-premium" data-stock-card="'+m.code+'"><div class="kpi-label">'+esc(t(m.name,lang))+'</div><div class="kpi stock-primary">'+esc(v.primary)+'</div><div class="small stock-secondary">'+esc(v.secondary)+'</div></div>';}).join('');
  p.innerHTML=
    '<div class="page-head"><div><div class="eyebrow">'+t('Admin tools',lang)+'</div><h1>'+t('Inventory',lang)+'</h1><p>'+t('Track stock in packages and correct old balances by date.',lang)+'</p></div><button class="btn primary" id="stockIn">＋ '+t('Stock in',lang)+'</button></div>'+
    '<div class="grid grid-3">'+cards+'</div>'+
    '<section class="inventory-workflow-banner"><div class="inventory-workflow-icon">◈</div><div><b>'+t('Inventory control center',lang)+'</b><small>'+t('Choose a date, set the correct physical quantity, and preserve an audit trail.',lang)+'</small></div><span class="inventory-live-pill">'+t('Admin',lang)+' • 🔐</span></section>'+
    '<section class="card historical-editor-card"><div class="history-card-heading"><div><div class="eyebrow">'+t('Audit-safe correction',lang)+'</div><h2>🗓️ '+t('Date-wise inventory editor',lang)+'</h2><p>'+t('Set the correct stock balance as of a past date. The system records a correction instead of deleting history.',lang)+'</p></div></div>'+
    '<div class="history-filter-row"><div class="field"><label for="stockHistoryDate">'+t('Inventory date',lang)+'</label><input id="stockHistoryDate" type="date" max="'+today()+'" value="'+today()+'"></div><div class="field"><label for="stockEditMaterial">'+t('Material',lang)+'</label><select id="stockEditMaterial">'+options+'</select></div></div>'+
    '<div class="history-target-grid"><div class="field"><label for="stockEditPackage">'+t('Package / container',lang)+'</label><select id="stockEditPackage"></select></div><div class="field"><label for="stockEditPackages">'+t('Full packages',lang)+'</label><input id="stockEditPackages" type="number" min="0" step="1" value="0"></div><div class="field"><label for="stockEditRemainder">'+t('Open remainder',lang)+'</label><div class="unit-input-pair"><input id="stockEditRemainder" type="number" min="0" step="0.001" value="0"><select id="stockEditRemainderUnit" aria-label="'+t('Remainder unit',lang)+'"><option value="kg">kg</option><option value="g">g</option></select></div></div></div>'+
    '<div class="historical-preview"><span class="history-preview-icon">⚖</span><div><small>'+t('Target balance on selected date',lang)+'</small><strong id="stockTargetPreview">0 kg</strong></div><div class="historical-before"><small>'+t('Current as of date',lang)+'</small><b id="stockAsOfPreview">—</b></div></div>'+
    '<div class="field"><label for="stockCorrectionReason">'+t('Reason for correction',lang)+'</label><input id="stockCorrectionReason" maxlength="180" placeholder="'+t('Example: physical count found a different balance',lang)+'"></div>'+
    '<div class="history-form-footer"><small>🔒 '+t('Admin-only action. Every correction is dated and auditable.',lang)+'</small><button class="btn primary" id="saveStockByDate">✓ '+t('Save dated correction',lang)+'</button></div></section>'+
    '<section class="card inventory-history-card"><div class="history-card-heading"><div><h2>🧾 '+t('Inventory activity',lang)+'</h2><p id="historyDateCaption"></p></div><button type="button" class="btn secondary" id="refreshHistory">↻ '+t('Refresh',lang)+'</button></div><div id="inventoryDatabaseNotice" class="inventory-database-notice" role="status" hidden></div><div id="inventoryHistorySummary" class="history-summary-strip"></div><div id="inventoryHistoryRows" class="table-wrap"><div class="empty">Loading inventory activity…</div></div></section>';

  let snapshotMap={};
  let snapshotLoaded=false;
  let historicalCorrectionRpcReady=true;
  const $=id=>document.getElementById(id);
  const showInventoryNotice=(message,kind='warning')=>{
    const notice=$('inventoryDatabaseNotice');
    if(!notice)return;
    notice.hidden=!message;
    notice.className='inventory-database-notice '+kind;
    notice.textContent=message||'';
  };
  const updateCorrectionButton=()=>{
    const button=$('saveStockByDate');
    if(button)button.disabled=!(snapshotLoaded&&historicalCorrectionRpcReady);
  };
  const getMaterial=()=>STOCK_MATERIALS.find(m=>m.code===$('stockEditMaterial').value)||STOCK_MATERIALS[0];
  const getPackage=()=>getMaterial().packages[Number($('stockEditPackage').value)]||getMaterial().packages[0];
  const kgLabel=n=>formatInventoryNumber(n,lang)+' kg';
  const stockAtDemo=(code,date)=>(db.inventory?.[code]?.tx||[]).reduce((sum,x)=>{
    const day=x.effectiveDate||String(x.at||'').slice(0,10);
    return day>date?sum:sum+(x.dir==='out'?-Number(x.qty||0):Number(x.qty||0));
  },0);
  const updateAsOf=()=>{const m=getMaterial();$('stockAsOfPreview').textContent=stockBreakdown(m,Number(snapshotMap[m.code]||0),lang).primary;};
  const updatePreview=()=>{
    const m=getMaterial(),pkg=getPackage();
    const count=Math.max(0,Number($('stockEditPackages').value)||0),raw=Math.max(0,Number($('stockEditRemainder').value)||0);
    const rem=$('stockEditRemainderUnit').value==='g'?raw/1000:raw,target=count*Number(pkg?.qty||0)+rem;
    $('stockEditPackages').step=pkg?.kind==='sack'?'0.5':'1';
    $('stockTargetPreview').textContent=stockBreakdown(m,target,lang).primary+' · '+kgLabel(target);
    updateAsOf();
  };
  const setTargetFromSnapshot=()=>{
    const m=getMaterial(),pkg=getPackage(),qty=Math.max(0,Number(snapshotMap[m.code]||0)),size=Number(pkg?.qty||1);
    let count=Math.floor((qty+0.000001)/size),rem=qty-count*size;
    if(pkg?.kind==='sack'&&Math.abs(rem-size/2)<0.00001){count+=0.5;rem=0;}
    $('stockEditPackages').value=count;
    if(rem>0&&rem<1){$('stockEditRemainderUnit').value='g';$('stockEditRemainder').value=Number((rem*1000).toFixed(3));}
    else{$('stockEditRemainderUnit').value='kg';$('stockEditRemainder').value=Number(rem.toFixed(3));}
    $('stockEditRemainderUnit').dataset.unit=$('stockEditRemainderUnit').value;
    updatePreview();
  };
  const drawHistory=(rows,date)=>{
    $('historyDateCaption').textContent=t('Transactions for selected date',lang)+' · '+date;
    $('inventoryHistorySummary').innerHTML='<div><small>'+t('Transactions',lang)+'</small><b>'+rows.length+'</b></div><div><small>'+t('Correction date',lang)+'</small><b>'+esc(date)+'</b></div><div><small>'+t('Tracked materials',lang)+'</small><b>'+STOCK_MATERIALS.length+'</b></div>';
    if(!rows.length){$('inventoryHistoryRows').innerHTML='<div class="empty">'+t('No inventory transactions on this date.',lang)+'</div>';return;}
    const body=rows.map(row=>{
      const m=STOCK_MATERIALS.find(x=>x.code===row.material_code)||STOCK_MATERIALS[0],v=stockBreakdown(m,Number(row.qty_base)||0,lang),inc=row.direction==='in';
      return '<tr><td><b>'+esc(t(row.material_name||m.name,lang))+'</b><small class="table-secondary">'+esc(row.package_label||'')+'</small></td><td><span class="movement-pill '+(inc?'in':'out')+'">'+(inc?'＋ '+t('Stock in',lang):'− '+t('Stock out',lang))+'</span></td><td><b>'+esc(v.primary)+'</b><small class="table-secondary">'+esc(v.secondary)+'</small></td><td><span class="history-reason">'+esc(row.reason||'')+'</span></td><td>'+esc(row.created_by_name||'')+'</td></tr>';
    }).join('');
    $('inventoryHistoryRows').innerHTML='<table><thead><tr><th>'+t('Material',lang)+'</th><th>'+t('Movement',lang)+'</th><th>'+t('Quantity',lang)+'</th><th>'+t('Reason / audit note',lang)+'</th><th>'+t('Entered by',lang)+'</th></tr></thead><tbody>'+body+'</tbody></table>';
  };
  const loadDate=async date=>{
    if(!date)return false;
    snapshotLoaded=false;
    historicalCorrectionRpcReady=true;
    updateCorrectionButton();
    if(isDemo){
      snapshotMap=Object.fromEntries(STOCK_MATERIALS.map(m=>[m.code,stockAtDemo(m.code,date)]));
      const rows=STOCK_MATERIALS.flatMap(m=>(db.inventory?.[m.code]?.tx||[]).filter(x=>(x.effectiveDate||String(x.at||'').slice(0,10))===date).map(x=>({effective_date:date,material_code:m.code,material_name:m.name,direction:x.dir,qty_base:x.qty,reason:x.reason||'Inventory movement',package_label:x.packageLabel||'',created_by_name:x.by||'Admin',created_at:x.at}))).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
      drawHistory(rows,date);
      snapshotLoaded=true;
      showInventoryNotice('');
      updateCorrectionButton();
    }else{
      const [snap,hist]=await Promise.all([
        supabase.rpc('admin_inventory_snapshot',{p_effective_date:date}),
        supabase.rpc('admin_inventory_history',{p_effective_date:date})
      ]);
      if(document.body.dataset.route!=='inventory')return false;
      if(!snap.error&&!hist.error){
        snapshotMap=Object.fromEntries((snap.data||[]).map(x=>[x.material_code,Number(x.stock||0)]));
        drawHistory(hist.data||[],date);
        snapshotLoaded=true;
        historicalCorrectionRpcReady=true;
        showInventoryNotice('');
        updateCorrectionButton();
      }else{
        // Read-only fallback: Admin RLS permits reading the dated ledger. Reconstruct
        // the historical balance from today's authoritative view minus later movements.
        try{
          const selectFields='id,effective_date,material_code,direction,qty_base,reason,package_count,package_label,created_by,created_at';
          const fetchLedger=async(mode)=>{
            const all=[];
            for(let offset=0;offset<5000;offset+=1000){
              let query=supabase.from('inventory_transactions').select(selectFields)
                .order('effective_date',{ascending:true}).order('created_at',{ascending:true})
                .range(offset,offset+999);
              query=mode==='after'?query.gt('effective_date',date):query.eq('effective_date',date);
              const {data,error}=await query;
              if(error)throw error;
              const rows=data||[];
              all.push(...rows);
              if(rows.length<1000)return all;
            }
            throw new Error('Inventory history is too large for safe client-side recovery. Restore the inventory RPC migration for fast loading.');
          };
          const [datedRows,laterRows]=await Promise.all([fetchLedger('on'),fetchLedger('after')]);
          if(document.body.dataset.route!=='inventory')return false;
          const current=new Map((liveState.balances||[]).map(row=>[row.code,Number(row.stock)||0]));
          const laterDelta=new Map();
          for(const row of laterRows){
            const qty=Number(row.qty_base)||0;
            const delta=row.direction==='in'?qty:row.direction==='out'?-qty:qty;
            laterDelta.set(row.material_code,(laterDelta.get(row.material_code)||0)+delta);
          }
          snapshotMap=Object.fromEntries(STOCK_MATERIALS.map(m=>[m.code,(current.get(m.code)||0)-(laterDelta.get(m.code)||0)]));
          const userName=new Map((liveState.users||[]).map(u=>[u.id,u.full_name||u.name||'Admin']));
          drawHistory(datedRows.map(row=>({
            ...row,
            material_name:STOCK_MATERIALS.find(m=>m.code===row.material_code)?.name||row.material_code,
            created_by_name:userName.get(row.created_by)||'Admin'
          })),date);
          snapshotLoaded=true;
          historicalCorrectionRpcReady=false;
          showInventoryNotice('Read-only recovery is active: balances and activity were reconstructed from the inventory ledger. To enable safe date corrections, run db/fix_admin_inventory_snapshot_2026_10_11.sql in Supabase SQL Editor, then refresh. No stock was changed.','warning');
          updateCorrectionButton();
        }catch(fallbackError){
          snapshotMap={};
          snapshotLoaded=false;
          historicalCorrectionRpcReady=false;
          const message='Inventory history functions are missing and the ledger fallback could not run. Apply db/fix_admin_inventory_snapshot_2026_10_11.sql in the connected Supabase project, then refresh.';
          $('inventoryHistoryRows').innerHTML='<div class="empty">'+esc(message)+'</div>';
          showInventoryNotice(message,'error');
          updateCorrectionButton();
          return false;
        }
      }
    }
    updateAsOf();
    updateCorrectionButton();
    return snapshotLoaded;
  };
  const updatePackageOptions=()=>{
    const m=getMaterial();
    $('stockEditPackage').innerHTML=m.packages.filter(x=>x.kind!=='recipe').map(x=>'<option value="'+m.packages.indexOf(x)+'">'+esc(packageUnit(m,x,lang))+'</option>').join('');
    if(snapshotLoaded)setTargetFromSnapshot();
  };
  $('stockEditMaterial').addEventListener('change',updatePackageOptions);
  $('stockEditPackage').addEventListener('change',setTargetFromSnapshot);
  $('stockEditPackages').addEventListener('input',updatePreview);
  $('stockEditRemainder').addEventListener('input',updatePreview);
  $('stockEditRemainderUnit').dataset.unit='kg';
  $('stockEditRemainderUnit').addEventListener('change',()=>{
    const input=$('stockEditRemainder'),old=input.dataset.unit||'kg',next=$('stockEditRemainderUnit').value;
    if(old!==next)input.value=Number((Number(input.value||0)*(old==='g'?0.001:1000)).toFixed(3));
    input.dataset.unit=next;updatePreview();
  });
  $('stockHistoryDate').addEventListener('change',async()=>{if(await loadDate($('stockHistoryDate').value))setTargetFromSnapshot();});
  $('refreshHistory').addEventListener('click',()=>loadDate($('stockHistoryDate').value));
  $('saveStockByDate').addEventListener('click',async()=>{
    if(!snapshotLoaded||!historicalCorrectionRpcReady){showInventoryNotice('Date corrections are disabled until the inventory database migration is applied successfully. No stock was changed.','warning');return;}
    const date=$('stockHistoryDate').value,m=getMaterial(),pkg=getPackage();
    if(!date||date>today()){showToast(t('Choose today or a past date',lang),'error');return;}
    const count=Number($('stockEditPackages').value||0),raw=Number($('stockEditRemainder').value||0),rem=$('stockEditRemainderUnit').value==='g'?raw/1000:raw;
    const target=count*Number(pkg?.qty||0)+rem,reason=$('stockCorrectionReason').value.trim();
    if(count<0||rem<0||!Number.isFinite(target)||reason.length<3){showToast(t('Enter a valid quantity and reason.',lang),'error');return;}
    const prev=Number(snapshotMap[m.code]||0);
    if(isDemo && Number(db.inventory[m.code]?.stock||0)+(target-prev)<-0.00005){
      showToast(t('Historical correction would make current inventory negative; reconcile later transactions first.',lang),'error');return;
    }
    if(Math.abs(target-prev)<0.00005){showToast(t('No stock change required.',lang));return;}
    const button=$('saveStockByDate');button.disabled=true;
    try{
      if(isDemo){
        const delta=target-prev,inv=db.inventory[m.code];inv.stock+=delta;
        inv.tx.push({id:uid(),dir:delta>0?'in':'out',qty:Math.abs(delta),reason:'Historical stock correction: '+reason,effectiveDate:date,at:new Date().toISOString(),by:currentUser.name,packageLabel:'Manual correction'});
        saveDemo();
      }else{
        const {error}=await supabase.rpc('admin_set_stock_as_of_date',{p_material_code:m.code,p_effective_date:date,p_target_stock:Number(target.toFixed(4)),p_reason:reason});
        if(error)throw error;
      }
      $('stockCorrectionReason').value='';await refreshLiveState();await loadDate(date);
      showToast(t('Stock corrected for selected date.',lang),'success');render();
    }catch(error){showToast(friendlyError(error),'error');}
    finally{button.disabled=false;}
  });
  $('stockIn').addEventListener('click',()=>openStockModal());
  updatePackageOptions();
  // Load dated history after the page is visible so slow RPCs never block menu switching.
  void loadDate(today()).then(ok=>{if(ok&&document.body.dataset.route==='inventory'&&$('stockHistoryDate'))setTargetFromSnapshot();});
  if(!isDemo){
    void supabase.from('inventory_balances').select('*').then(({data,error})=>{
      if(error||!Array.isArray(data)||document.body.dataset.route!=='inventory')return;
      liveState.balances=data;
      data.forEach(row=>{
        const card=p.querySelector('[data-stock-card="'+row.code+'"]');
        const material=STOCK_MATERIALS.find(m=>m.code===row.code);
        if(!card||!material)return;
        const breakdown=stockBreakdown(material,Number(row.stock)||0,lang);
        const primary=card.querySelector('.stock-primary'),secondary=card.querySelector('.stock-secondary');
        if(primary)primary.textContent=breakdown.primary;
        if(secondary)secondary.textContent=breakdown.secondary;
      });
    }).catch(()=>{});
  }
}
function openStockModal(){
  const opts=STOCK_MATERIALS.map(m=>`<option value="${m.code}">${esc(t(m.name,lang))}</option>`).join('');
  modalRoot.innerHTML=`<div class="modal-backdrop show"><div class="modal"><div class="modal-head"><h2>${t('Receive stock',lang)}</h2><button id="closeModal">×</button></div><div class="field"><label>${t('Material',lang)}</label><select id="stockMaterial">${opts}</select></div><div id="packageChooser"></div><div class="field"><label>${t('Effective date',lang)}</label><input id="stockEffectiveDate" type="date" max="${today()}" value="${today()}"></div><div class="field"><label>${t('Notes',lang)}</label><input id="stockNote" placeholder="${t('Supplier / delivery note',lang)}"></div><div class="modal-footer"><button class="btn secondary" id="cancelModal">${t('Cancel',lang)}</button><button class="btn primary" id="saveStock">${t('Add stock',lang)}</button></div></div></div>`;
  const update=()=>{const m=STOCK_MATERIALS.find(x=>x.code===document.getElementById('stockMaterial').value);document.getElementById('packageChooser').innerHTML=`<div class="field"><label>${t('Package',lang)}</label><select id="stockPackage">${m.packages.map((x,i)=>`<option value="${i}">${esc(packageUnit(m,x,lang))}</option>`).join('')} </select></div><div class="field"><label>${t('Number of packages',lang)}</label><input id="packageCount" type="number" min="0.001" step="1" value="1"></div><div class="small">${t('The system will convert package quantity into the inventory base unit.',lang)}</div>`;};
  update();document.getElementById('stockMaterial').addEventListener('change',update);document.getElementById('closeModal').addEventListener('click',closeModal);document.getElementById('cancelModal').addEventListener('click',closeModal);
  document.getElementById('saveStock').addEventListener('click',async()=>{const code=document.getElementById('stockMaterial').value;const m=STOCK_MATERIALS.find(x=>x.code===code);const pi=Number(document.getElementById('stockPackage').value);const count=Number(document.getElementById('packageCount').value||0);const date=document.getElementById('stockEffectiveDate').value;if(!(count>0)||!Number.isFinite(count))return;if(!date||date>today()){showToast(t('Choose today or a past date',lang),'error');return;}const qty=m.packages[pi].qty*count;const reason=(document.getElementById('stockNote').value||'').trim()||t('Stock received',lang);if(isDemo){const inv=db.inventory[code];inv.stock+=qty;inv.tx.push({id:uid(),dir:'in',qty,packages:count,packageLabel:m.packages[pi].label,reason,effectiveDate:date,at:new Date().toISOString(),by:currentUser.name});saveDemo();closeModal();render();}else{const {error}=await supabase.from('inventory_transactions').insert({material_code:code,direction:'in',qty_base:qty,package_count:count,package_label:m.packages[pi].label,reason,created_by:currentUser.id,effective_date:date});if(error){showToast(friendlyError(error),'error');return;}await refreshLiveState();closeModal();render();}});
}
function closeModal(){modalRoot.innerHTML='';}

function renderReports(p){
  const runs=isDemo?db.productions:liveState.productions;
  const summary=!isDemo?liveState.summaryAll:null;
  const total=summary?Number(summary.total_sacks):runs.reduce((a,b)=>a+Number(isDemo?b.mishokCount:b.mishok_count),0);
  const pieces=summary?Number(summary.total_pieces):runs.reduce((a,b)=>a+(isDemo?b.batches:(b.production_batches||[])).reduce((s,z)=>s+Number(z.pieces||0),0),0);
  const avg=total?pieces/total:0;
  p.innerHTML=`<div class="page-head"><div><h1>Reports</h1><p>Operational summary from saved production.</p></div></div><div class="grid grid-3"><div class="card"><div class="kpi-label">All-time sacks</div><div class="kpi">${fmt(total)}</div></div><div class="card"><div class="kpi-label">All-time pieces</div><div class="kpi">${fmt(pieces)}</div></div><div class="card"><div class="kpi-label">Pieces / sack</div><div class="kpi">${fmt(avg)}</div></div></div><div style="height:16px"></div><div class="card"><h2>Production history</h2><div class="table-wrap"><table><thead><tr><th>Date</th><th>Sacks</th><th>Pieces</th><th>Worker</th></tr></thead><tbody>${runs.length?runs.map(r=>`<tr><td>${esc(isDemo?r.date:r.production_date)}</td><td>${fmt(isDemo?r.mishokCount:r.mishok_count)}</td><td>${fmt((isDemo?r.batches:r.production_batches||[]).reduce((a,b)=>a+Number(b.pieces||0),0))}</td><td>${esc(isDemo?r.createdBy:r.created_by===currentUser.id?currentUser.name:'User')}</td></tr>`).join(''):'<tr><td colspan="4" class="empty">No production yet.</td></tr>'}</tbody></table></div></div>`;
}

async function renderUsers(p){
  if(currentUser.role!=='admin'){
    p.innerHTML="<div class='card'><h2>"+t('Users',lang)+"</h2><div class='alert error'>"+t('Admin access only.',lang)+"</div></div>";
    return;
  }
  let users=[];
  if(isDemo){
    ensureDemoPins();
    users=(db.users||[]).map(u=>({...u,pin_configured:!!u.pin}));
  }else{
    const {data,error}=await supabase.rpc('admin_list_pin_users');
    if(error){
      p.innerHTML="<div class='card'><h2>"+t('People & PIN access',lang)+"</h2><div class='alert error'>"+esc(friendlyError(error))+"</div><p>"+t('Apply the PIN login database migration to enable PIN management.',lang)+"</p></div>";
      return;
    }
    users=data||[];
  }
  const rows=users.map(u=>{
    const name=isDemo?u.name:u.full_name;
    const alias=String(u.loginAlias||u.login_alias||'');
    const configured=isDemo?!!u.pin:!!u.pin_configured;
    const locked=!!(u.locked_until&&new Date(u.locked_until)>new Date());
    return "<tr><td><b>"+esc(name)+"</b><small class='table-secondary'>"+esc(alias)+"</small></td>"+
      "<td><span class='status neutral'>"+esc(roleName(u.role))+"</span></td>"+
      "<td><span class='pin-status "+(configured?'configured':'not-configured')+"'>"+(configured?'● '+t('PIN configured',lang):'○ '+t('PIN not set',lang))+"</span>"+(locked?"<small class='table-secondary'>"+t('Temporarily locked',lang)+"</small>":"")+"</td>"+
      "<td><button type='button' class='btn secondary pin-manage-button' data-pin-user='"+esc(u.user_id||u.id)+"'>"+(configured?t('Reset PIN',lang):t('Set PIN',lang))+" ⚙</button></td></tr>";
  }).join('');
  p.innerHTML="<div class='page-head'><div><div class='eyebrow'>"+t('Secure access',lang)+"</div><h1>👥 "+t('People & PIN access',lang)+"</h1><p>"+t('Each user has a unique username and four-digit PIN. PINs are hashed; Admin can set or reset them here.',lang)+"</p></div></div>"+
    "<div class='pin-admin-banner'><div class='pin-admin-symbol'>🔐</div><div><b>"+t('Individual access controls',lang)+"</b><small>"+t('Five failed PIN attempts trigger a temporary account lock.',lang)+"</small></div><span>"+users.filter(u=>isDemo?!!u.pin:!!u.pin_configured).length+" / "+users.length+" "+t('ready',lang)+"</span></div>"+
    "<div class='card'><div class='table-wrap'><table><thead><tr><th>"+t('User',lang)+"</th><th>"+t('Role',lang)+"</th><th>"+t('PIN status',lang)+"</th><th>"+t('Manage',lang)+"</th></tr></thead><tbody>"+rows+"</tbody></table></div></div>"+
    "<div class='small pin-security-note'>🛡️ "+t('Use a different PIN for every person. The admin PIN 1214 is only for the Admin account.',lang)+"</div>";
  p.querySelectorAll('[data-pin-user]').forEach(button=>button.addEventListener('click',()=>{
    const user=users.find(x=>String(x.user_id||x.id)===button.dataset.pinUser);
    if(user) openPinUserModal(user,isDemo);
  }));
}
function openPinUserModal(user,demo){
  const alias=String(user.loginAlias||user.login_alias||'');
  const name=String(demo?user.name:user.full_name||'');
  modalRoot.innerHTML="<div class='modal-backdrop show'><div class='modal pin-manage-modal'><div class='modal-head'><div><div class='eyebrow'>"+t('Secure access',lang)+"</div><h2>🔐 "+t('Set user PIN',lang)+"</h2></div><button id='closePinModal' aria-label='"+t('Close',lang)+"'>×</button></div>"+
    "<p class='pin-modal-user'>"+esc(name)+" · "+esc(roleName(user.role))+"</p>"+
    "<div class='field'><label for='pinUsername'>"+t('Username',lang)+"</label><input id='pinUsername' type='text' maxlength='32' autocomplete='off' value='"+esc(alias)+"' autocapitalize='none' spellcheck='false'></div>"+
    "<div class='field'><label for='pinNewValue'>"+t('New 4-digit PIN',lang)+"</label><input id='pinNewValue' type='password' inputmode='numeric' maxlength='4' pattern='[0-9]{4}' autocomplete='new-password' placeholder='••••'></div>"+
    "<div class='field'><label for='pinConfirmValue'>"+t('Confirm PIN',lang)+"</label><input id='pinConfirmValue' type='password' inputmode='numeric' maxlength='4' pattern='[0-9]{4}' autocomplete='new-password' placeholder='••••'></div>"+
    "<div id='pinManageError' class='login-error'></div><div class='modal-footer'><button class='btn secondary' id='cancelPinModal'>"+t('Cancel',lang)+"</button><button class='btn primary' id='saveUserPin'>✓ "+t('Save PIN',lang)+"</button></div></div></div>";
  const digits=id=>{const el=document.getElementById(id);el.value=el.value.replace(/\D/g,'').slice(0,4);};
  ['pinNewValue','pinConfirmValue'].forEach(id=>document.getElementById(id).addEventListener('input',()=>digits(id)));
  const close=()=>{modalRoot.innerHTML='';};
  document.getElementById('closePinModal').addEventListener('click',close);
  document.getElementById('cancelPinModal').addEventListener('click',close);
  document.getElementById('saveUserPin').addEventListener('click',async()=>{
    const loginAlias=document.getElementById('pinUsername').value.trim().toLowerCase();
    const pin=document.getElementById('pinNewValue').value;
    const confirmation=document.getElementById('pinConfirmValue').value;
    const err=document.getElementById('pinManageError');
    if(!/^[a-z0-9][a-z0-9._-]{1,31}$/.test(loginAlias)){err.textContent=t('Enter a valid username (2–32 characters).',lang);return;}
    if(!/^\d{4}$/.test(pin)){err.textContent=t('PIN must contain exactly four digits.',lang);return;}
    if(pin!==confirmation){err.textContent=t('PINs do not match.',lang);return;}
    const button=document.getElementById('saveUserPin');button.disabled=true;err.textContent='';
    try{
      if(demo){
        const target=db.users.find(x=>x.id===user.id);
        if(!target) throw new Error('Profile not found');
        target.loginAlias=loginAlias;target.pin=pin;saveDemo();
      }else{
        const {error}=await supabase.rpc('admin_set_user_pin',{p_user_id:user.user_id,p_pin:pin,p_login_alias:loginAlias});
        if(error) throw error;
      }
      close();showToast(t('User PIN saved successfully.',lang),'success');await render();
    }catch(error){err.textContent=friendlyError(error);button.disabled=false;}
  });
}
function placeholderPanel(title,text){
  const p=document.getElementById('page');
  p.innerHTML=`<div class="page-head"><div><h1>${esc(t(title,lang))}</h1><p>${t('Panel is reserved and protected.',lang)}</p></div></div><div class="card"><div class="notice">${esc(t(text,lang))}</div></div>`;
}

async function activeRecipeId(){ const {data}=await supabase.from('recipe_versions').select('id').eq('active',true).limit(1).single(); return data?.id; }

// Optional Supabase status helper: visible on demo build only.
window.DoughFlow={resetDemo(){localStorage.removeItem(KEY);location.reload();},isDemo};

if(isDemo){
  // Seed a few realistic stock quantities for an immediately useful preview.
  if(!db.__seededStock){db.inventory.flour.stock=325;db.inventory.oil.stock=26.5;db.inventory.salt.stock=43;db.inventory.sugar.stock=65;db.inventory.yeast.stock=10.293;db.__seededStock=true;saveDemo();}
  if(db.__seededHistory){
    let migrated=false;
    STOCK_MATERIALS.forEach(m=>{
      (db.inventory[m.code]?.tx||[]).forEach(tx=>{
        if(tx.reason==='Opening balance' && tx.effectiveDate!=='2026-01-01'){
          tx.effectiveDate='2026-01-01';migrated=true;
        }
      });
    });
    if(migrated) saveDemo();
  }
  if(db.__seededHistory){
    let migrated=false;
    STOCK_MATERIALS.forEach(m=>{
      (db.inventory[m.code]?.tx||[]).forEach(tx=>{
        if(tx.reason==='Opening balance' && tx.effectiveDate!=='2026-01-01'){
          tx.effectiveDate='2026-01-01';migrated=true;
        }
      });
    });
    if(migrated) saveDemo();
  }
  if(!db.__seededHistory){
    STOCK_MATERIALS.forEach(m=>{
      const inv=db.inventory[m.code]||{stock:0,tx:[]};
      inv.tx=inv.tx||[];
      const ledger=inv.tx.reduce((sum,x)=>sum+(x.dir==='out'?-Number(x.qty||0):Number(x.qty||0)),0);
      const missing=Number(inv.stock||0)-ledger;
      if(Math.abs(missing)>0.00005) inv.tx.push({id:uid(),dir:missing>0?'in':'out',qty:Math.abs(missing),reason:'Opening balance',effectiveDate:'2026-01-01',at:new Date().toISOString(),by:'System',packageLabel:'Opening balance'});
      db.inventory[m.code]=inv;
    });
    db.__seededHistory=true;saveDemo();
  }
}

init();
