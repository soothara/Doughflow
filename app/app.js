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
const INVENTORY_MOVEMENT_TYPES=[
  {value:'purchase',label:'Supplier delivery / purchase',direction:'in'},
  {value:'customer_return',label:'Return from customer',direction:'in'},
  {value:'opening_balance',label:'Opening balance',direction:'in'},
  {value:'manual_receipt',label:'Other stock received',direction:'in'},
  {value:'manual_issue',label:'Internal use / stock issued',direction:'out'},
  {value:'waste',label:'Waste / damaged / expired',direction:'out'},
  {value:'supplier_return',label:'Return to supplier',direction:'out'},
  {value:'adjustment',label:'Inventory correction',direction:null},
  {value:'production',label:'Production consumption',direction:'out'}
];
const movementTypeLabel=type=>INVENTORY_MOVEMENT_TYPES.find(x=>x.value===type)?.label||'Manual movement';
const movementDirection=type=>INVENTORY_MOVEMENT_TYPES.find(x=>x.value===type)?.direction||'in';
const daysAgoDate=days=>{const d=new Date(today()+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-Number(days||0));return d.toISOString().slice(0,10);};


const DEFAULT_RECIPE = [
  {code:'flour', name:'Flour', qty:50, unit:'kg', note:'1 operational sack; actual batch can be 48–52 kg and is still counted as 1 sack'},
  {code:'water', name:'Water', qty:31.2, unit:'kg', note:'Combined water; no hot/cold split'},
  {code:'oil', name:'Oil', qty:1, unit:'kg', note:'Standard 20 kg carton packaging'},
  {code:'yeast', name:'Yeast', qty:.055, unit:'kg', note:'Default 55 g; operational range 35–55 g'},
  {code:'salt', name:'Salt', qty:1.2, unit:'kg', note:'1 kg or 750 g packets'},
  {code:'sugar', name:'Sugar', qty:.5, unit:'kg', note:''}
];

const DEFAULT_APP_SETTINGS={businessName:'DoughFlow',tagline:'Bakery control',accentColor:'#2477ee',defaultLanguage:'en',timezone:'Asia/Bishkek',currency:'KGS',weightUnit:'kg',pieceUnit:'pieces',sackLabel:'sacks',confirmDestructiveActions:true,lowStockAlerts:true,compactStockCards:true,homeSubtitle:'Let’s make great leposhka today!',contentOverrides:{},mediaOverrides:{}};
let appSettings={...DEFAULT_APP_SETTINGS};
const DEFAULT_SLIDESHOW = [
  {file:'01-baker-tandoor-hd-20261012.webp',label:'Baker beside the tandoor'},
  {file:'02-leposhka-closeup-hd-20261012.avif',label:'Fresh leposhka close-up'},
  {file:'03-bishkek-context.webp',label:'Bishkek street scene'},
  {file:'04-bread-delivery-owner.webp',label:'Bread delivery owner'},
  {file:'05-bread-delivery-worker.webp',label:'Bread delivery worker'},
  {file:'06-van-bread-stock.webp',label:'Van stocked with leposhka'},
  {file:'07-bakery-team.webp',label:'Bakery team'},
  {file:'08-bakery-team-selfie.webp',label:'Bakery team selfie'},
  {file:'09-team-social.webp',label:'Team social gathering'},
  {file:'10-oven-production.webp',label:'Bread production'}
];
const defaultSlideUrl=index=>'./assets/doughflow-gallery/'+DEFAULT_SLIDESHOW[index].file;
const defaultPageMediaUrl=key=>({mountainBackdrop:'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=85',breadBackdrop:'./assets/bakery.webp',loginBackdrop:'https://upload.wikimedia.org/wikipedia/commons/2/22/Bishkek.jpg',leposhkaEmblem:'./assets/leposhka-emblem.svg'}[key]||'./assets/bakery.webp');
const APP_SETTINGS_DEMO_KEY='doughflow_settings_demo_v1';
function siteText(key,fallback){const value=appSettings?.contentOverrides?.[key];return typeof value==='string'&&value.trim()?value.trim():fallback;}
function applyAppSettings(){
  try{document.documentElement.style.setProperty('--df-accent',/^#[0-9a-fA-F]{6}$/.test(appSettings.accentColor||'')?appSettings.accentColor:DEFAULT_APP_SETTINGS.accentColor);}catch{}
  const media=appSettings.mediaOverrides||{};
  [['mountainBackdrop','--df-mountain-image'],['breadBackdrop','--df-bread-image'],['loginBackdrop','--df-login-image']].forEach(([key,variable])=>{
    const value=typeof media[key]==='string'?media[key].trim():'';
    if(value&&(/^(https?:|data:image\/)/i).test(value))document.documentElement.style.setProperty(variable,'url("'+value.replace(/["\\\n\r]/g,'')+'")');
    else document.documentElement.style.removeProperty(variable);
  });
  const emblem=document.querySelector('.production-photo-sticker img');
  if(emblem)emblem.src=appSettings.mediaOverrides?.leposhkaEmblem||'./assets/leposhka-emblem.svg';
  const name=String(appSettings.businessName||'DoughFlow').trim()||'DoughFlow';
  document.querySelectorAll('.brand-copy strong,.hero-brand b,.login-brand-row strong,[data-app-business-name]').forEach(el=>{el.textContent=name;});
  document.body.dataset.lowStockAlerts=appSettings.lowStockAlerts?'true':'false';
  document.body.dataset.compactStockCards=appSettings.compactStockCards?'true':'false';
  const tagline=String(appSettings.tagline||'Bakery control').trim();
  document.querySelectorAll('.brand-copy span,.hero-brand small,.login-brand-row small,[data-app-tagline]').forEach(el=>{el.textContent=tagline;});
  document.title=name+' · '+tagline;
}
async function loadAppSettings(){
  if(isDemo){
    try{const saved=JSON.parse(localStorage.getItem(APP_SETTINGS_DEMO_KEY)||'{}');appSettings={...DEFAULT_APP_SETTINGS,...saved,timezone:'Asia/Bishkek'};}catch{appSettings={...DEFAULT_APP_SETTINGS};}
  }else{
    try{
      const {data,error}=await supabase.from('app_settings').select('setting_value').eq('setting_key','global').maybeSingle();
      if(!error&&data?.setting_value&&typeof data.setting_value==='object')appSettings={...DEFAULT_APP_SETTINGS,...data.setting_value,timezone:'Asia/Bishkek'};
    }catch{}
  }
  applyAppSettings();
}

const uid=()=>crypto.randomUUID();
const today=()=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:(appSettings?.timezone||'Asia/Bishkek'),year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`;}; const dateLocale=()=>lang==='ru'?'ru-RU':lang==='ky'?'ky-KG':'en-US'; const formatToday=()=>new Intl.DateTimeFormat(dateLocale(),{weekday:'short',month:'short',day:'numeric',year:'numeric',timeZone:(appSettings?.timezone||'Asia/Bishkek')}).format(new Date());
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
  if(kind==='sack'&&language==='en'&&String(appSettings?.sackLabel||'').trim()){
    const plural=String(appSettings.sackLabel).trim();
    return n===1?plural.replace(/s$/i,''):plural;
  }
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
    // One-time clean start: remove demo production/stock history and preserve the recipe except yeast.
    if(!data.__emptyStartV1){
      data.session=null;
      data.productions=[];
      data.inventory=MATERIALS.reduce((a,m)=>{a[m.code]={stock:0,tx:[]};return a;},{});
      if(data.recipe && Array.isArray(data.recipe.items)){
        data.recipe.items=data.recipe.items.map(it=>it.code==='yeast'
          ? {...it,qty:.055,unit:'kg',note:'Default 55 g; operational range 35–55 g'}
          : it);
      }else{
        data.recipe={version:1,updatedAt:new Date().toISOString(),updatedBy:'Admin',items:DEFAULT_RECIPE};
      }
      data.__emptyStartV1=true;
      data.__pinLoginV1=true;
      localStorage.setItem(KEY,JSON.stringify(data));
    }else if(!data.__pinLoginV1){
      data.session=null;
      data.__pinLoginV1=true;
      localStorage.setItem(KEY,JSON.stringify(data));
    }
    return data;
  }
  const data={
    session:null,
    __pinLoginV1:true,
    __emptyStartV1:true,
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
// Keep fixed notifications directly under body so transformed app containers cannot clip them.
if(toastRoot&&toastRoot.parentElement!==document.body)document.body.appendChild(toastRoot);

// Keep mobile bottom-sheet dialogs independently scrollable and prevent the page behind them from moving.
let modalScrollY=0;
let modalBodyStyles=null;
const syncModalScrollLock=()=>{
  const isOpen=!!modalRoot?.querySelector('.modal-backdrop.show');
  if(isOpen&&!document.documentElement.classList.contains('modal-open')){
    modalScrollY=window.scrollY||window.pageYOffset||0;
    modalBodyStyles={position:document.body.style.position,top:document.body.style.top,left:document.body.style.left,right:document.body.style.right,width:document.body.style.width,overflow:document.body.style.overflow};
    document.documentElement.classList.add('modal-open');
    document.body.classList.add('modal-open');
    document.body.style.position='fixed';
    document.body.style.top='-'+modalScrollY+'px';
    document.body.style.left='0';
    document.body.style.right='0';
    document.body.style.width='100%';
    document.body.style.overflow='hidden';
  }else if(!isOpen&&document.documentElement.classList.contains('modal-open')){
    document.documentElement.classList.remove('modal-open');
    document.body.classList.remove('modal-open');
    if(modalBodyStyles){
      Object.assign(document.body.style,{position:modalBodyStyles.position,top:modalBodyStyles.top,left:modalBodyStyles.left,right:modalBodyStyles.right,width:modalBodyStyles.width,overflow:modalBodyStyles.overflow});
      modalBodyStyles=null;
    }
    window.scrollTo(0,modalScrollY);
  }
};
if(modalRoot&&typeof MutationObserver!=='undefined'){
  new MutationObserver(syncModalScrollLock).observe(modalRoot,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
}



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
    chefHat:'<path d="M6 13a4 4 0 0 1-1-7.87A5 5 0 0 1 14 4a4 4 0 0 1 5 5.7A4 4 0 0 1 18 13v4a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-4Z"/><path d="M6 13h12M9 16h6"/>',
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
  if(currentUser){currentUser.lang=lang;currentUser.hasExplicitLanguage=true;}
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
function applyCurrentLanguage(){ applyTranslations(document,lang); const sel=document.getElementById('languageSelect'); if(sel) sel.value=lang; document.documentElement.lang = lang==='ru'?'ru':lang==='ky'?'ky':'en'; applyAppSettings(); }
function can(role, section){
  if(section==='more') return true;
  if(role==='admin') return true;
  if(role==='hamurchi') return ['dashboard','production','recipe','reports'].includes(section);
  if(role==='naan') return ['dashboard','naan'].includes(section);
  if(role==='sales') return ['dashboard','sales'].includes(section);
  return false;
}
function navItems(role){
  const base=[['dashboard',NAV_ICONS.home,'Home']];
  if(role==='admin'||role==='hamurchi') base.push(['production',NAV_ICONS.production,'Production']);
  if(role==='admin') base.push(['inventory',NAV_ICONS.stock,'Stock']);
  if(role==='admin'||role==='hamurchi') base.push(['reports',NAV_ICONS.sales,'Reports']);
  if(role==='naan') base.push(['naan',NAV_ICONS.naan,'Naan']);
  if(role==='sales') base.push(['sales',NAV_ICONS.sales,'Sales']);
  base.push(['more',NAV_ICONS.more,'More']);
  return base;
}
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'&&currentUser&&route==='reports'){
    const page=document.getElementById('page');if(page)renderReports(page);
  }
});
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
    const storedLang=db.session.user?(localStorage.getItem('doughflow_lang_v1_'+db.session.user.id)||localStorage.getItem('doughflow_lang_v1')):null;
    currentUser=db.session.user ? {...db.session.user,role:db.session.role,lang:db.session.lang||storedLang||appSettings.defaultLanguage||'en',hasExplicitLanguage:!!(db.session.lang||storedLang)} : null;
    lang=currentUser?.lang||lang;
  }
  if(currentUser){await loadAppSettings();if(!currentUser.hasExplicitLanguage){lang=appSettings.defaultLanguage||'en';currentUser.lang=lang;saveLang(currentUser.id||'guest',lang);currentUser.hasExplicitLanguage=true;}}
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

    const storedLang=localStorage.getItem('doughflow_lang_v1_'+user.id)||localStorage.getItem('doughflow_lang_v1');
    currentUser={id:user.id,name:data.full_name||user.email||'User',role:data.role,lang:data.preferred_language||storedLang||appSettings.defaultLanguage||'en',hasExplicitLanguage:!!(data.preferred_language||storedLang)};
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
function scrollAppToTop(){
  try{window.scrollTo({top:0,left:0,behavior:'auto'});}catch{}
  document.documentElement.scrollTop=0;document.body.scrollTop=0;
  const main=document.querySelector('.layout>main');if(main)main.scrollTop=0;
  const page=document.getElementById('page');if(page)page.scrollTop=0;
}
async function navigateTo(nextRoute){
  if(!currentUser||!can(currentUser.role,nextRoute))return;
  if(nextRoute===route){
    scrollAppToTop();
    const renderId=++routeRenderId;
    if(route==='dashboard'||route==='production'){
      void refreshLiveState().then(()=>{
        if(renderId===routeRenderId&&currentUser&&route===nextRoute)void renderPage();
      });
    }else{
      void renderPage();
    }
    return;
  }
  route=nextRoute;
  const renderId=++routeRenderId;
  document.body.classList.toggle('dashboard-mode',route==='dashboard');
  document.body.dataset.route=route;
  scrollAppToTop();
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
  scrollAppToTop();
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
  if(route!=='dashboard'&&window.doughFlowHeroTimer){
    window.clearInterval(window.doughFlowHeroTimer);
    window.doughFlowHeroTimer=null;
  }
  const p=document.getElementById('page');
  const pages={
    dashboard:renderDashboard,
    production:renderProduction,
    recipe:renderRecipe,
    inventory:renderInventory,
    reports:renderReports,
    users:renderUsers,
    settings:renderSettings,
    naan:renderNaan,
    sales:renderSales,
    more:renderMore
  };
  await (pages[route]||renderDashboard)(p);
}

async function renderSettings(p){
  if(currentUser.role!=='admin'){p.innerHTML="<div class='card'><h2>Settings</h2><div class='alert error'>Admin access only.</div></div>";return;}
  await loadAppSettings();
  const s=appSettings;
  const modules=[
    ['users','users','People & permissions','Staff accounts, roles and PIN resets'],
    ['inventory','package','Stock & inventory','Materials, balances, receipts and corrections'],
    ['recipe','book-open','Recipe & production standards','Ingredient quantities and version history'],
    ['reports','chart','Reports & notebook','Monthly reports, sack counts and production history'],
    ['production','clipboard','Production workflow','Daily production entries'],
    ['sales','trending-up','Sales workspace','Sales tools and related workflows'],
    ['naan','bread','Naan / Leposhka workflow','Bread count and dispatch workflow']
  ];
  const moduleIcons={users:'users',inventory:'package',recipe:'book-open',reports:'chart',production:'clipboard',sales:'trending-up',naan:'bread'};
  p.innerHTML=`<div class="page-head settings-page-head"><div><div class="eyebrow">ADMIN CONTROL CENTER</div><h1>⚙️ Settings</h1><p>Manage the business identity, workspace preferences, data safety and every operational module from one place.</p></div><span class="settings-admin-pill">🔐 Admin only</span></div>
  <div class="settings-hero"><div class="settings-hero-icon">⚙</div><div><b>System control center</b><p>Changes are saved to the shared workspace. Operational data is managed in its own module, with permissions and history.</p></div><span class="settings-live-dot">● Shared</span></div>
  <section class="settings-section"><div class="settings-section-heading"><span class="settings-section-icon">🏢</span><div><h2>Business identity</h2><p>Update the name and tagline shown across the app.</p></div></div>
    <div class="settings-form-grid"><div class="field"><label for="settingBusinessName">Business / workspace name</label><input id="settingBusinessName" maxlength="70" value="${esc(s.businessName)}" required></div><div class="field"><label for="settingTagline">Tagline</label><input id="settingTagline" maxlength="100" value="${esc(s.tagline)}"></div><div class="field"><label for="settingHomeSubtitle">Home screen welcome line</label><input id="settingHomeSubtitle" maxlength="140" value="${esc(s.homeSubtitle||DEFAULT_APP_SETTINGS.homeSubtitle)}"></div></div>
  </section>
  <section class="settings-section settings-slideshow-section"><div class="settings-section-heading"><span class="settings-section-icon">🖼️</span><div><h2>Home slideshow photos</h2><p>Replace any of the 10 home-screen carousel photos. Images are shared with all users. JPG, PNG, WebP and AVIF · max 8 MB each.</p></div></div>
    <div class="settings-slideshow-grid">${DEFAULT_SLIDESHOW.map((slide,index)=>{const custom=s.slideshow?.[index]?.url;const url=custom||defaultSlideUrl(index);return '<article class="settings-slide-editor"><div class="settings-slide-preview" style="background-image:url(&quot;'+esc(url)+'&quot;)" id="settingsSlidePreview'+index+'"><span class="settings-slide-number">SLIDE '+String(index+1).padStart(2,'0')+'</span><span class="settings-slide-custom" id="settingsSlideBadge'+index+'">'+(custom?'CUSTOM PHOTO':'DEFAULT PHOTO')+'</span></div><div class="settings-slide-details"><b>'+esc(slide.label)+'</b><label class="settings-upload-button" for="settingsSlideFile'+index+'">↥ Replace photo</label><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" id="settingsSlideFile'+index+'" data-slide-upload="'+index+'" class="settings-slide-file"><button type="button" class="settings-slide-reset" data-slide-reset="'+index+'" '+(custom?'':'disabled')+'>Restore default</button><small id="settingsSlideStatus'+index+'">Use a clear, landscape photo for best results.</small></div></article>';}).join('')}</div>
    <div class="settings-slide-note"><span>🔒</span><span><b>Admin-controlled shared media</b><small>Uploads go to DoughFlow storage. Only administrators can replace or restore slideshow photos.</small></span></div>
  </section>
  <section class="settings-section settings-page-media-editor"><div class="settings-section-heading"><span class="settings-section-icon">🖼️</span><div><h2>Other page background photos</h2><p>Replace the mountain, bakery and PIN-screen backgrounds. These shared images are separate from the 10-photo home slideshow.</p></div></div>
    <div class="settings-page-media-grid">
      ${[['mountainBackdrop','Mountain / workspace background','Mountain scene used behind selected panels'],['breadBackdrop','Bakery / bread background','Bread imagery used on production and bakery panels'],['loginBackdrop','PIN login background','Background shown on the PIN login screen'],['leposhkaEmblem','Production Leposhka emblem','Replace the bread emblem shown on the production panel']].map(([key,label,desc])=>{const customUrl=s.mediaOverrides?.[key]||'';const url=customUrl||defaultPageMediaUrl(key);return '<article class="settings-slide-editor"><div class="settings-slide-preview" style="background-image:url(&quot;'+esc(url)+'&quot;)" id="settingsMediaPreview'+key+'"><span class="settings-slide-number">PAGE PHOTO</span><span class="settings-slide-custom" id="settingsMediaBadge'+key+'">'+(customUrl?'CUSTOM PHOTO':'DEFAULT PHOTO')+'</span></div><div class="settings-slide-details"><b>'+esc(label)+'</b><small>'+esc(desc)+'</small><label class="settings-upload-button" for="settingsMediaFile'+key+'">↥ Replace photo</label><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" id="settingsMediaFile'+key+'" data-page-media-upload="'+key+'" class="settings-slide-file"><button type="button" class="settings-slide-reset" data-page-media-reset="'+key+'" '+(url?'':'disabled')+'>Restore default</button><small id="settingsMediaStatus'+key+'">JPG, PNG, WebP or AVIF · max 8 MB.</small></div></article>';}).join('')}
    </div>
  </section>
  <section class="settings-section settings-content-editor"><div class="settings-section-heading"><span class="settings-section-icon">✍️</span><div><h2>Page text editor</h2><p>Customize key headings and descriptions across the workspace. Leave a field blank to use the built-in translated text.</p></div></div>
    <div class="settings-form-grid">
      <div class="field"><label for="settingTextProductionTitle">Production title</label><input id="settingTextProductionTitle" maxlength="80" value="${esc(s.contentOverrides?.productionTitle||'')}" placeholder="New Production"></div>
      <div class="field"><label for="settingTextProductionSubtitle">Production description</label><input id="settingTextProductionSubtitle" maxlength="180" value="${esc(s.contentOverrides?.productionSubtitle||'')}" placeholder="Choose a batch and record actual pieces"></div>
      <div class="field"><label for="settingTextInventoryTitle">Inventory title</label><input id="settingTextInventoryTitle" maxlength="80" value="${esc(s.contentOverrides?.inventoryTitle||'')}" placeholder="Inventory"></div>
      <div class="field"><label for="settingTextInventorySubtitle">Inventory description</label><input id="settingTextInventorySubtitle" maxlength="180" value="${esc(s.contentOverrides?.inventorySubtitle||'')}" placeholder="Receive, issue, correct and audit ingredient movements"></div>
      <div class="field"><label for="settingTextRecipeTitle">Recipe title</label><input id="settingTextRecipeTitle" maxlength="80" value="${esc(s.contentOverrides?.recipeTitle||'')}" placeholder="Recipe"></div>
      <div class="field"><label for="settingTextRecipeSubtitle">Recipe description</label><input id="settingTextRecipeSubtitle" maxlength="180" value="${esc(s.contentOverrides?.recipeSubtitle||'')}" placeholder="Keep each ingredient consistent"></div>
      <div class="field"><label for="settingTextReportsTitle">Reports title</label><input id="settingTextReportsTitle" maxlength="80" value="${esc(s.contentOverrides?.reportsTitle||'')}" placeholder="Reports"></div>
      <div class="field"><label for="settingTextReportsSubtitle">Reports description</label><input id="settingTextReportsSubtitle" maxlength="180" value="${esc(s.contentOverrides?.reportsSubtitle||'')}" placeholder="Daily production inputs and notebook records"></div>
      <div class="field"><label for="settingTextSalesTitle">Sales title</label><input id="settingTextSalesTitle" maxlength="80" value="${esc(s.contentOverrides?.salesTitle||'')}" placeholder="Sales"></div>
      <div class="field"><label for="settingTextSalesSubtitle">Sales description</label><input id="settingTextSalesSubtitle" maxlength="180" value="${esc(s.contentOverrides?.salesSubtitle||'')}" placeholder="Record sales, collections and balances"></div>
      <div class="field"><label for="settingTextNaanTitle">Naan / Leposhka title</label><input id="settingTextNaanTitle" maxlength="80" value="${esc(s.contentOverrides?.naanTitle||'')}" placeholder="Naan / Leposhka"></div>
      <div class="field"><label for="settingTextNaanSubtitle">Naan / Leposhka description</label><input id="settingTextNaanSubtitle" maxlength="180" value="${esc(s.contentOverrides?.naanSubtitle||'')}" placeholder="Prepare and track dispatches"></div>
    </div>
  </section>
  <section class="settings-section"><div class="settings-section-heading"><span class="settings-section-icon">🎨</span><div><h2>Appearance & language</h2><p>Set the workspace accent and default language.</p></div></div>
    <div class="settings-form-grid"><div class="field"><label for="settingAccent">Accent color</label><div class="settings-color-row"><input id="settingAccent" type="color" value="${/^#[0-9a-fA-F]{6}$/.test(s.accentColor||'')?s.accentColor:'#2477ee'}"><span id="settingAccentValue">${esc(s.accentColor)}</span></div></div><div class="field"><label for="settingLanguage">Default language for new sessions</label><select id="settingLanguage"><option value="en" ${s.defaultLanguage==='en'?'selected':''}>English</option><option value="ru" ${s.defaultLanguage==='ru'?'selected':''}>Русский — Russian</option><option value="ky" ${s.defaultLanguage==='ky'?'selected':''}>Кыргызча — Kyrgyz</option></select></div><div class="field"><label for="settingTimezone">Business time zone (fixed for production dates)</label><select id="settingTimezone" disabled><option value="Asia/Bishkek" selected>Bishkek (UTC+6)</option></select></div><div class="field"><label for="settingCurrency">Currency code</label><select id="settingCurrency">${[['KGS','KGS — Kyrgyz som'],['PKR','PKR — Pakistani rupee'],['EUR','EUR — Euro'],['USD','USD — US dollar']].map(([v,l])=>'<option value="'+v+'" '+(s.currency===v?'selected':'')+'>'+l+'</option>').join('')}</select></div></div>
  </section>
  <section class="settings-section"><div class="settings-section-heading"><span class="settings-section-icon">🧰</span><div><h2>Operations preferences</h2><p>Set stock terminology and display preferences. Recipe quantities and package sizes stay in their own modules.</p></div></div><div class="settings-form-grid"><div class="field"><label for="settingWeightUnit">Inventory storage unit (fixed)</label><select id="settingWeightUnit" disabled><option value="kg" selected>Kilograms (kg) — database base unit</option></select></div><div class="field"><label for="settingPieceUnit">Bread count unit (fixed)</label><select id="settingPieceUnit" disabled><option value="pieces" selected>Pieces — actual count</option></select></div><div class="field"><label for="settingSackLabel">Sack terminology</label><input id="settingSackLabel" maxlength="24" value="${esc(s.sackLabel)}"></div></div>
    <div class="settings-toggle-list"><label class="settings-toggle"><span><b>Low-stock alert indicators</b><small>Show inventory reorder status and alerts.</small></span><input id="settingLowStock" type="checkbox" ${s.lowStockAlerts?'checked':''}></label><label class="settings-toggle"><span><b>Confirm destructive actions</b><small>Keep confirmation steps for deleting or replacing records.</small></span><input id="settingConfirm" type="checkbox" ${s.confirmDestructiveActions?'checked':''}></label><label class="settings-toggle"><span><b>Compact inventory cards</b><small>Use a space-saving stock overview on mobile.</small></span><input id="settingCompact" type="checkbox" ${s.compactStockCards?'checked':''}></label></div>
  </section>
  <div class="settings-savebar"><span id="settingsSaveStatus">Changes are not saved until you press Save.</span><button type="button" class="btn secondary" id="settingsReset">Reset form</button><button type="button" class="btn primary" id="settingsSave">✓ Save workspace settings</button></div>
  <section class="settings-section settings-modules"><div class="settings-section-heading"><span class="settings-section-icon">🧩</span><div><h2>Manage every module</h2><p>Open the correct module to edit its actual records, rather than changing a display-only copy.</p></div></div><div class="settings-module-grid">${modules.map(([r,icon,title,desc])=>'<button type="button" class="settings-module-card" data-settings-route="'+r+'"><span class="settings-module-icon">'+uiIcon(icon,22)+'</span><span><b>'+esc(title)+'</b><small>'+esc(desc)+'</small></span><span class="chevron">›</span></button>').join('')}</div></section>
  <section class="settings-section settings-backup"><div class="settings-section-heading"><span class="settings-section-icon">🛡️</span><div><h2>Data safety & backup</h2><p>Download a snapshot of available application data before making major changes. This export does not contain passwords or PINs.</p></div></div><div class="settings-backup-actions"><button type="button" class="btn secondary" id="settingsRefresh">↻ Refresh live data</button><button type="button" class="btn primary" id="settingsExport">↓ Export data backup (.json)</button></div><small class="settings-footnote">Backup export is read-only. Restoring a backup is not enabled here to prevent accidental overwrites of production or inventory history.</small></section>`;
  const original=()=>({...appSettings});
  const persistSlides=async slides=>{
    if(isDemo){appSettings={...appSettings,slideshow:slides};localStorage.setItem(APP_SETTINGS_DEMO_KEY,JSON.stringify(appSettings));}
    else{const {error}=await supabase.from('app_settings').upsert({setting_key:'global',setting_value:{...appSettings,slideshow:slides},updated_by:currentUser.id},{onConflict:'setting_key'});if(error)throw error;appSettings={...appSettings,slideshow:slides};}
    applyAppSettings();
  };
  const persistMediaOverrides=async mediaOverrides=>{
    if(isDemo){appSettings={...appSettings,mediaOverrides};localStorage.setItem(APP_SETTINGS_DEMO_KEY,JSON.stringify(appSettings));}
    else{const {error}=await supabase.from('app_settings').upsert({setting_key:'global',setting_value:{...appSettings,mediaOverrides},updated_by:currentUser.id},{onConflict:'setting_key'});if(error)throw error;appSettings={...appSettings,mediaOverrides};}
    applyAppSettings();
  };
  p.querySelectorAll('[data-page-media-upload]').forEach(input=>input.addEventListener('change',async()=>{
    const key=input.dataset.pageMediaUpload,file=input.files?.[0];if(!file)return;
    const status=p.querySelector('#settingsMediaStatus'+key),preview=p.querySelector('#settingsMediaPreview'+key),badge=p.querySelector('#settingsMediaBadge'+key);
    if(!['image/jpeg','image/png','image/webp','image/avif'].includes(file.type)){status.textContent='Choose a JPG, PNG, WebP or AVIF image.';input.value='';return;}
    if(file.size>8*1024*1024){status.textContent='Image must be 8 MB or smaller.';input.value='';return;}
    input.disabled=true;status.textContent='Uploading image…';
    try{
      let url;
      if(isDemo){url=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Could not read this image.'));reader.readAsDataURL(file);});}
      else{const ext=({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/avif':'avif'})[file.type];const path='page/'+key+'-'+Date.now()+'.'+ext;const {error}=await supabase.storage.from('doughflow-slideshow').upload(path,file,{cacheControl:'3600',upsert:true,contentType:file.type});if(error)throw error;url=supabase.storage.from('doughflow-slideshow').getPublicUrl(path).data.publicUrl;}
      const mediaOverrides={...(appSettings.mediaOverrides||{}),[key]:url};await persistMediaOverrides(mediaOverrides);
      preview.style.backgroundImage='url("'+url.replace(/["\\]/g,'')+'")';badge.textContent='CUSTOM PHOTO';p.querySelector('[data-page-media-reset="'+key+'"]').disabled=false;status.textContent='✓ Photo replaced and saved for all users.';showToast('Page background photo updated.','success');
    }catch(error){status.textContent='Upload failed: '+friendlyError(error);showToast('Photo upload failed.','error');}
    finally{input.disabled=false;input.value='';}
  }));
  p.querySelectorAll('[data-page-media-reset]').forEach(button=>button.addEventListener('click',async()=>{
    const key=button.dataset.pageMediaReset;if(button.disabled)return;
    if(appSettings.confirmDestructiveActions&&!confirm('Restore the default '+key+' photo?'))return;
    button.disabled=true;const status=p.querySelector('#settingsMediaStatus'+key);
    try{const mediaOverrides={...(appSettings.mediaOverrides||{})};delete mediaOverrides[key];await persistMediaOverrides(mediaOverrides);p.querySelector('#settingsMediaPreview'+key).style.backgroundImage='url("'+defaultPageMediaUrl(key).replace(/["\\]/g,'')+'")';p.querySelector('#settingsMediaBadge'+key).textContent='DEFAULT PHOTO';status.textContent='Default photo restored for all users.';showToast('Default background restored.','success');}
    catch(error){status.textContent='Could not restore: '+friendlyError(error);button.disabled=false;}
  }));
  p.querySelectorAll('[data-slide-upload]').forEach(input=>input.addEventListener('change',async()=>{
    const index=Number(input.dataset.slideUpload),file=input.files?.[0];if(!file)return;
    const status=p.querySelector('#settingsSlideStatus'+index),preview=p.querySelector('#settingsSlidePreview'+index),badge=p.querySelector('#settingsSlideBadge'+index);
    if(!['image/jpeg','image/png','image/webp','image/avif'].includes(file.type)){status.textContent='Choose a JPG, PNG, WebP or AVIF image.';input.value='';return;}
    if(file.size>8*1024*1024){status.textContent='Image must be 8 MB or smaller.';input.value='';return;}
    input.disabled=true;status.textContent='Uploading image…';
    try{
      let url;
      if(isDemo){url=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Could not read this image.'));reader.readAsDataURL(file);});}
      else{
        const ext=({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/avif':'avif'})[file.type];
        const path='home/slide-'+(index+1)+'-'+Date.now()+'.'+ext;
        const {error}=await supabase.storage.from('doughflow-slideshow').upload(path,file,{cacheControl:'3600',upsert:true,contentType:file.type});
        if(error)throw error;
        url=supabase.storage.from('doughflow-slideshow').getPublicUrl(path).data.publicUrl;
      }
      const slides=[...(appSettings.slideshow||[])];slides[index]={url,label:DEFAULT_SLIDESHOW[index].label,updatedAt:new Date().toISOString()};
      await persistSlides(slides);
      preview.style.backgroundImage='url("'+url.replace(/["\\]/g,'')+'")';badge.textContent='CUSTOM PHOTO';p.querySelector('[data-slide-reset="'+index+'"]').disabled=false;
      status.textContent='✓ Photo replaced and saved for all users.';showToast('Slideshow photo '+(index+1)+' updated.','success');
    }catch(error){status.textContent='Upload failed: '+friendlyError(error);showToast('Photo upload failed.','error');}
    finally{input.disabled=false;input.value='';}
  }));
  p.querySelectorAll('[data-slide-reset]').forEach(button=>button.addEventListener('click',async()=>{
    const index=Number(button.dataset.slideReset);if(button.disabled)return;
    if(appSettings.confirmDestructiveActions&&!confirm('Restore the original slideshow photo '+(index+1)+'?'))return;
    button.disabled=true;const status=p.querySelector('#settingsSlideStatus'+index);
    try{const slides=[...(appSettings.slideshow||[])];slides[index]=null;while(slides.length&&!slides[slides.length-1])slides.pop();await persistSlides(slides);p.querySelector('#settingsSlidePreview'+index).style.backgroundImage='url("'+defaultSlideUrl(index)+'")';p.querySelector('#settingsSlideBadge'+index).textContent='DEFAULT PHOTO';status.textContent='Original photo restored for all users.';showToast('Default photo restored.','success');}
    catch(error){status.textContent='Could not restore: '+friendlyError(error);button.disabled=false;}
  }));
  p.querySelector('#settingAccent')?.addEventListener('input',e=>{p.querySelector('#settingAccentValue').textContent=e.target.value;document.documentElement.style.setProperty('--df-accent',e.target.value);});
  p.querySelectorAll('[data-settings-route]').forEach(b=>b.addEventListener('click',()=>navigateTo(b.dataset.settingsRoute)));
  p.querySelector('#settingsReset')?.addEventListener('click',()=>renderSettings(p));
  p.querySelector('#settingsSave')?.addEventListener('click',async()=>{
    const button=p.querySelector('#settingsSave'),status=p.querySelector('#settingsSaveStatus');
    const businessName=p.querySelector('#settingBusinessName').value.trim();
    if(!businessName){status.textContent='Business name is required.';p.querySelector('#settingBusinessName').focus();return;}
    const next={businessName,tagline:p.querySelector('#settingTagline').value.trim(),homeSubtitle:p.querySelector('#settingHomeSubtitle').value.trim(),accentColor:p.querySelector('#settingAccent').value,defaultLanguage:p.querySelector('#settingLanguage').value,timezone:p.querySelector('#settingTimezone').value,currency:p.querySelector('#settingCurrency').value,weightUnit:p.querySelector('#settingWeightUnit').value,pieceUnit:p.querySelector('#settingPieceUnit').value,sackLabel:p.querySelector('#settingSackLabel').value.trim()||'sacks',lowStockAlerts:p.querySelector('#settingLowStock').checked,confirmDestructiveActions:p.querySelector('#settingConfirm').checked,compactStockCards:p.querySelector('#settingCompact').checked,slideshow:appSettings.slideshow||[],mediaOverrides:appSettings.mediaOverrides||{},contentOverrides:{productionTitle:p.querySelector('#settingTextProductionTitle').value.trim(),productionSubtitle:p.querySelector('#settingTextProductionSubtitle').value.trim(),inventoryTitle:p.querySelector('#settingTextInventoryTitle').value.trim(),inventorySubtitle:p.querySelector('#settingTextInventorySubtitle').value.trim(),recipeTitle:p.querySelector('#settingTextRecipeTitle').value.trim(),recipeSubtitle:p.querySelector('#settingTextRecipeSubtitle').value.trim(),reportsTitle:p.querySelector('#settingTextReportsTitle').value.trim(),reportsSubtitle:p.querySelector('#settingTextReportsSubtitle').value.trim(),salesTitle:p.querySelector('#settingTextSalesTitle').value.trim(),salesSubtitle:p.querySelector('#settingTextSalesSubtitle').value.trim(),naanTitle:p.querySelector('#settingTextNaanTitle').value.trim(),naanSubtitle:p.querySelector('#settingTextNaanSubtitle').value.trim()}};
    button.disabled=true;status.textContent='Saving shared settings…';
    try{
      if(isDemo){appSettings=next;localStorage.setItem(APP_SETTINGS_DEMO_KEY,JSON.stringify(next));}
      else{const {error}=await supabase.from('app_settings').upsert({setting_key:'global',setting_value:next,updated_by:currentUser.id},{onConflict:'setting_key'});if(error)throw error;appSettings=next;}
      applyAppSettings();status.textContent='✓ Saved successfully to '+(isDemo?'this demo device':'the shared workspace')+'.';showToast('Workspace settings saved.','success');
    }catch(error){status.textContent='Could not save: '+friendlyError(error);}
    finally{button.disabled=false;}
  });
  p.querySelector('#settingsExport')?.addEventListener('click',async()=>{
    const button=p.querySelector('#settingsExport');button.disabled=true;
    try{
      if(!isDemo)await refreshLiveState();
      const fetchAll=async buildQuery=>{
        const result=[];const batchSize=1000;
        for(let offset=0;offset<100000;offset+=batchSize){
          const {data,error}=await buildQuery().range(offset,offset+batchSize-1);
          if(error)throw error;
          result.push(...(data||[]));
          if(!data||data.length<batchSize)return result;
        }
        throw new Error('Backup stopped at the 100,000-row safety limit. Export smaller periods separately.');
      };
      let payload;
      if(isDemo){
        payload={format:'DoughFlow complete operational backup',version:4,exportedAt:new Date().toISOString(),business:appSettings,teamProfiles:(db.users||[]).map(u=>({id:u.id,full_name:u.name,role:u.role,preferred_language:u.lang||null})),production:db.productions||[],inventory:db.inventory||{},recipe:db.recipe||{},notebookSacks:[],sales:db.salesRecords||[],dispatches:db.naanDispatches||[],materials:STOCK_MATERIALS.map(m=>({code:m.code,name:m.name,packages:m.packages})),businessAudit:[],inventoryAudit:[],notice:'Demo backup; no credentials, PINs, hashes, or authentication tokens included.'};
      }else{
        const [production,inventoryTransactions,inventoryBalances,recipeVersions,notebookSacks,sales,dispatches,materials,settings,audit,teamProfiles]=await Promise.all([
          fetchAll(()=>supabase.from('production_runs').select('id,production_date,created_by,mishok_count,recipe_version_id,status,created_at,production_batches(batch_no,mishok_fraction,pieces),production_materials(material_code,expected_qty,actual_qty,unit)').order('production_date',{ascending:false})),
          fetchAll(()=>supabase.from('inventory_transactions').select('*').order('effective_date',{ascending:false}).order('created_at',{ascending:false})),
          fetchAll(()=>supabase.from('inventory_balances').select('*')),
          fetchAll(()=>supabase.from('recipe_versions').select('id,version_number,note,active,created_at,recipe_items(id,material_code,qty_per_mishok,unit,note,sort_order)').order('version_number',{ascending:false})),
          fetchAll(()=>supabase.from('notebook_sack_entries').select('record_date,sack_no,pieces_in_sack').order('record_date',{ascending:false}).order('sack_no',{ascending:true})),
          fetchAll(()=>supabase.from('sales_records').select('*').order('sale_date',{ascending:false})),
          fetchAll(()=>supabase.from('naan_dispatches').select('*').order('dispatch_date',{ascending:false})),
          fetchAll(()=>supabase.from('materials').select('*').order('code')),
          fetchAll(()=>supabase.from('app_settings').select('setting_key,setting_value,updated_at,updated_by')),
          fetchAll(()=>supabase.from('business_activity_audit').select('*').order('occurred_at',{ascending:false})),
          fetchAll(()=>supabase.from('profiles').select('id,full_name,role,preferred_language,created_at,updated_at').order('full_name'))
        ]);
        const inventoryAuditResult=await supabase.rpc('admin_inventory_audit',{p_from:'2000-01-01',p_to:today()});
        if(inventoryAuditResult.error)throw inventoryAuditResult.error;
        payload={format:'DoughFlow complete operational backup',version:4,exportedAt:new Date().toISOString(),business:settings,activeWorkspaceSettings:appSettings,teamProfiles,production,inventory:{balances:inventoryBalances,transactions:inventoryTransactions},recipeVersions,notebookSacks,sales,dispatches,materials,businessAudit:audit,inventoryAudit:inventoryAuditResult.data||[],notice:'Complete operational backup. Includes staff names, roles and language preferences, but excludes credentials, PINs, PIN hashes and auth tokens.'};
      }
      const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
      link.href=url;link.download='doughflow-complete-backup-'+today()+'.json';document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
      showToast('Complete operational backup downloaded.','success');
    }catch(error){showToast('Backup failed — no partial file was exported: '+friendlyError(error),'error');}
    finally{button.disabled=false;}
  });
  p.querySelector('#settingsRefresh')?.addEventListener('click',async()=>{const b=p.querySelector('#settingsRefresh');b.disabled=true;try{if(!isDemo)await refreshLiveState();showToast('Live data refreshed.','success');}catch(error){showToast(friendlyError(error),'error');}finally{b.disabled=false;}});
}
function renderMore(p){
  const extra=[];
  if(currentUser.role==='admin') extra.push(
    ['inventory',NAV_ICONS.stock,'Stock & inventory','See balances and stock movements'],
    ['users',uiIcon('users',24),'People','Manage staff and roles'],
    ['naan',NAV_ICONS.naan,'Naan / Leposhka','Open the naan workflow'],
    ['sales',NAV_ICONS.sales,'Sales','Open the sales workspace'],
    ['recipe',NAV_ICONS.recipe,'Recipe','Edit the working recipe'],
    ['settings',uiIcon('settings',24),'Settings','Business profile, appearance and system controls']
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
  // Prefer the server-side all-user aggregate so today's KPI never depends on the 200-row dashboard cache.
  const todaySummary=!isDemo?liveState.summaryToday:null;
  const totalSacks=todaySummary?Number(todaySummary.total_sacks):todayRuns.reduce((sum,run)=>sum+Number(isDemo?run.mishokCount:run.mishok_count||0),0);
  const totalPieces=todaySummary?Number(todaySummary.total_pieces):todayRuns.reduce((sum,run)=>sum+(isDemo?run.batches:(run.production_batches||[])).reduce((s,b)=>s+Number(b.pieces||0),0),0);
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
  const heroImages=DEFAULT_SLIDESHOW.map((slide,index)=>[appSettings.slideshow?.[index]?.url||defaultSlideUrl(index),slide.label]);
  const heroPhotoMarkup=heroImages.map(([src,label],index)=>'<div class="portal-hero-photo hero-slide'+(index===0?' is-active':'')+'" data-hero-photo="'+index+'" role="img" aria-label="'+esc(label)+'" style="background-image:url(&quot;'+esc(src)+'&quot;)"'+(index===0?'':' aria-hidden="true"')+'></div>').join('');
  const heroDotsMarkup=heroImages.map((_,index)=>'<button type="button" class="hero-slide-dot'+(index===0?' is-active':'')+'" data-hero-slide="'+index+'" aria-label="Show photo '+(index+1)+'" aria-current="'+(index===0?'true':'false')+'"></button>').join('');
  p.innerHTML =
    "<section class='portal-hero' data-hero-carousel aria-label='DoughFlow photo highlights'>"+
      heroPhotoMarkup+
      "<div class='portal-hero-shade'></div>"+
      "<div class='portal-hero-content'>"+
        "<div class='hero-topline'>"+
          "<div class='df-badge'>DF</div><div class='hero-brand'><b>DoughFlow</b><small>"+t('Bakery control',lang)+"</small></div><div class='hero-spacer'></div>"+
          "<label class='hero-language'><span>"+languageFlag()+"</span><select id='heroLanguageSelect' aria-label=\""+t('Language',lang)+"\">"+languageOptions(lang)+"</select><b>⌄</b></label>"+
          "<div class='hero-user'><span class='hero-avatar'>"+esc(Array.from(String(currentUser.name||'A').trim())[0]?.toUpperCase()||'A')+"</span><span><b class='no-translate'>"+esc(currentUser.name)+"</b><small>"+roleName(currentUser.role)+"</small></span></div>"+
        "</div>"+
        "<div class='hero-copy'><h1>"+t('Good day',lang)+", "+firstName+" <span>👋</span></h1><p>"+esc(appSettings.homeSubtitle||'Let’s make great leposhka today!')+"</p><div class='hero-date'>"+uiIcon('calendar',17)+" "+formatToday()+"</div></div>"+
      "</div>"+
      "<div class='hero-slide-controls' aria-label='Photo carousel controls'>"+
        "<button type='button' class='hero-slide-arrow' data-hero-prev aria-label='Previous photo'>‹</button>"+
        "<div class='hero-slide-dots'>"+heroDotsMarkup+"</div>"+
        "<button type='button' class='hero-slide-arrow' data-hero-next aria-label='Next photo'>›</button>"+
      "</div>"+
    "</section>"+
    syncBanner+
    "<section class='metric-grid'>"+
      "<div class='metric-card metric-green' data-tilt><div class='metric-head'><span class='metric-icon-svg'>"+uiIcon('sack',21)+"</span><b>"+t('Today’s Sacks',lang)+"</b></div><strong>"+fmt(totalSacks)+"</strong><i>"+uiIcon('trend',44)+"</i></div>"+
      "<div class='metric-card metric-orange' data-tilt><div class='metric-head'><span class='metric-icon-svg'>"+uiIcon('bread',21)+"</span><b>"+t('Today’s Pieces',lang)+"</b></div><strong>"+fmt(totalPieces)+"</strong><i>"+uiIcon('pieces',44)+"</i></div>"+
      "<div class='metric-card metric-purple' data-tilt><div class='metric-head'><span class='metric-icon-svg'>"+uiIcon('play',21)+"</span><b>"+t('Production Runs',lang)+"</b></div><strong>"+totalRuns+"</strong><i>"+uiIcon('layers',44)+"</i></div>"+
      "<div class='metric-card metric-blue' data-tilt><div class='metric-head'><span class='metric-icon-svg'>"+uiIcon('pieces',21)+"</span><b>"+t('Pieces / mishok',lang)+"</b></div><strong>"+(totalSacks>0?fmt(Math.round(totalPieces/totalSacks)):'—')+"</strong><i>"+uiIcon('trend',44)+"</i></div>"+
    "</section>"+
    "<section class='portal-panel production-panel'>"+
      "<div class='panel-photo-strip'><div class='panel-photo'></div><div class='panel-photo-shade'></div><div class='panel-title-wrap'><div class='panel-sticker production-photo-sticker' aria-hidden='true'><img src='"+esc(appSettings.mediaOverrides?.leposhkaEmblem||'./assets/leposhka-emblem.svg')+"' alt='' loading='eager'></div><div><h2>"+esc(siteText('productionTitle',t('New Production',lang)))+"</h2><p>"+esc(siteText('productionSubtitle',t('Select total sacks (you can add 0.5)',lang)))+"</p></div></div></div>"+
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
      "<a class='made-by-card made-by-link ali-showcase-banner' href='https://wa.me/996509512786' target='_blank' rel='noopener' aria-label='DoughFlow by Ali, contact on WhatsApp'>"+
        "<div class='made-by-symbol ali-monogram' aria-hidden='true'><span>A</span></div>"+
        "<div class='made-by-copy'><strong>Сделано Али</strong><span class='made-by-subtitle'>DOUGHFLOW · BAKERY CONTROL</span></div>"+
        "<div class='made-by-kyrgyz' aria-hidden='true'>🇰🇬</div>"+
      "</a>"+
      "<div class='photo-attribution'><a href='https://commons.wikimedia.org/wiki/File:Landscape_view,_Ala_Archa_National_Park,_Chuy_region,_Kyrgyzstan_01.jpg' target='_blank' rel='noopener'>Photo gallery · 10 bakery scenes · changes every 3 seconds</div>"+
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

  // One photo at a time—no overlapping or blended hero images.
  const heroCarousel=document.querySelector('[data-hero-carousel]');
  const heroSlides=[...(heroCarousel?.querySelectorAll('[data-hero-photo]')||[])];
  const heroDots=[...(heroCarousel?.querySelectorAll('[data-hero-slide]')||[])];
  if(window.doughFlowHeroTimer) window.clearInterval(window.doughFlowHeroTimer);
  let activeHero=0;
  const showHeroPhoto=(next)=>{
    if(!heroSlides.length) return;
    activeHero=(next+heroSlides.length)%heroSlides.length;
    heroSlides.forEach((slide,index)=>{
      const active=index===activeHero;
      slide.classList.toggle('is-active',active);
      slide.setAttribute('aria-hidden',String(!active));
    });
    heroDots.forEach((dot,index)=>{
      const active=index===activeHero;
      dot.classList.toggle('is-active',active);
      dot.setAttribute('aria-current',String(active));
    });
  };
  const startHeroRotation=()=>{
    if(window.doughFlowHeroTimer) window.clearInterval(window.doughFlowHeroTimer);
    if(heroSlides.length>1&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      window.doughFlowHeroTimer=window.setInterval(()=>showHeroPhoto(activeHero+1),3000);
    }
  };
  heroCarousel?.querySelector('[data-hero-prev]')?.addEventListener('click',()=>{showHeroPhoto(activeHero-1);startHeroRotation();});
  heroCarousel?.querySelector('[data-hero-next]')?.addEventListener('click',()=>{showHeroPhoto(activeHero+1);startHeroRotation();});
  heroDots.forEach((dot,index)=>dot.addEventListener('click',()=>{showHeroPhoto(index);startHeroRotation();}));
  startHeroRotation();
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
  p.innerHTML=`<div class="page-head compact-head"><div><div class="eyebrow">DAILY WORKFLOW</div><h1>${esc(siteText('productionTitle','Production'))}</h1><p>${esc(siteText('productionSubtitle','Choose a batch, record actual pieces, and finish with confidence.'))}</p></div></div><section class="workflow-progress-card" aria-live="polite"><div class="workflow-progress-top"><span class="workflow-step-icon">01</span><div class="workflow-progress-copy"><strong id="productionJourneyTitle">Choose your batch</strong><small id="productionJourneyText">Select total sacks to begin. Half-sacks are supported.</small></div><span class="workflow-step-count" id="productionJourneyCount">0 / 3</span></div><div class="workflow-progress-track"><span id="productionJourneyFill" style="width:0%"></span></div><div class="workflow-phase-list"><span>1 · Sacks</span><span>2 · Pieces</span><span>3 · Review</span></div></section><div class="grid grid-2"><div class="card production-work-card"><div class="workflow-heading"><span class="workflow-step-number">01</span><div><h2>New production</h2><p>Batch size and actual output</p></div></div><div class="field"><label>Sack count</label><div class="sack-picker"><button type="button" class="sack-choice" data-sack="1">1</button><button type="button" class="sack-choice " data-sack="2">2</button><button type="button" class="sack-choice " data-sack="3">3</button><button type="button" class="sack-choice " data-sack="4">4</button><button type="button" class="sack-choice " data-sack="5">5</button><button type="button" class="sack-choice " data-sack="6">6</button><button type="button" class="sack-choice " data-sack="7">7</button><button type="button" class="sack-choice " data-sack="8">8</button><button type="button" class="sack-choice " data-sack="9">9</button><button type="button" class="sack-choice half-choice" data-half="0.5">＋ 0.5</button></div><div class="sack-total"><span>Total sacks</span><strong id="sackTotal">0</strong><button type="button" class="reset-sack" id="resetSack">Reset</button></div><input id="sackCount" class="sr-only" type="number" min="0" max="9.5" step="0.5" value="0"></div><div id="batchEditor"></div><div style="height:10px"></div><h3>Material consumption</h3><div id="consumptionEditor"></div><div class="notice" style="margin:12px 0">A full sack = 1.0. The +0.5 button adds a half-sack, so 6 + 0.5 = 6.5. Maximum is 9.5 sacks.</div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" id="saveProduction">Complete production</button><button class="btn secondary" id="clearProduction">Clear</button></div></div><div class="card"><h2>Today’s production</h2>${existing.length?`<div class="table-wrap"><table><thead><tr><th>Time</th><th>Sacks</th><th>Pieces</th><th>Recipe</th></tr></thead><tbody>${existing.map(r=>{const bs=isDemo?r.batches:r.production_batches||[]; return `<tr><td>${esc(isDemo?r.timeLabel:new Date(r.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}))}</td><td>${fmt(isDemo?r.mishokCount:r.mishok_count)}</td><td>${fmt(bs.reduce((s,z)=>s+Number(z.pieces||0),0))}</td><td>v${isDemo?r.recipeVersion:(liveState.recipe?.version||'—')}</td></tr>`}).join('')}</tbody></table></div>`:'<div class="empty">No production saved today.</div>'}</div></div>`;
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
  p.innerHTML=`<div class="page-head compact-head"><div><div class="eyebrow">WORKING STANDARD</div><h1>${esc(siteText('recipeTitle','Recipe'))}</h1><p>${esc(siteText('recipeSubtitle','Keep each ingredient consistent. Saving creates a new version; previous production stays unchanged.'))}</p></div></div>
    <section class="recipe-guide-strip"><span class="recipe-guide-icon">${uiIcon('recipe',23)}</span><div><strong>Per operational sack</strong><small>Review quantity · check units · save a version</small></div><span class="recipe-version-pill">v${recipe.version}</span></section>
    <div class="grid grid-2 recipe-layout"><div class="card recipe-editor-card"><div class="workflow-heading"><span class="workflow-step-number">01</span><div><h2>Active recipe</h2><p>Quantities for one sack</p></div><span class="workflow-status" id="recipeStatusPill">Saved</span></div>${recipe.items.map((it)=>{const yeast=it.code==='yeast';const unit=yeast?'g':it.unit;const qty=yeast?Number(it.qty)*1000:it.qty;return `<div class="field-row recipe-item-row" style="align-items:end"><div class="field"><label>${esc(it.name)} (${esc(unit)})</label><input class="recipe-qty" data-code="${esc(it.code)}" type="number" step="${yeast?'1':'0.001'}" value="${qty}"><div class="small">${esc(it.note||'')}</div></div><div class="field"><label>Current standard</label><div class="notice recipe-standard-notice">${fmt(qty)} ${esc(unit)} / sack</div></div></div>`;}).join('')}<button class="btn primary recipe-save-button" id="saveRecipe">Save as new recipe version</button></div><div class="card recipe-packaging-card"><div class="workflow-heading compact"><span class="workflow-step-number neutral">02</span><div><h2>Packaging rules</h2><p>How stock is counted</p></div></div><div class="table-wrap"><table><thead><tr><th>Material</th><th>Purchase package</th></tr></thead><tbody>${STOCK_MATERIALS.map(m=>`<tr><td>${esc(m.name)}</td><td>${m.packages.map(x=>esc(x.label)).join('<br>')}</td></tr>`).join('')}</tbody></table></div><div class="notice" style="margin-top:14px">Water is a recipe input and is not tracked as stock. Salt supports 1 kg and 750 g packets. Yeast supports 500 g packets and 20-packet boxes. Oil uses 20 kg cartons.</div></div></div>`;
  document.querySelectorAll('.recipe-qty').forEach(input=>input.addEventListener('input',()=>{
    const pill=document.getElementById('recipeStatusPill');
    if(pill){pill.textContent='Unsaved changes';pill.classList.add('workflow-status-dirty');}
  }));
  document.getElementById('saveRecipe').addEventListener('click',async()=>{
    const recipeButton=document.getElementById('saveRecipe');
    recipeButton.disabled=true;recipeButton.textContent='Saving version…';
    const items=recipe.items.map((it,i)=>{const entered=Number(document.querySelector(`.recipe-qty[data-code="${it.code}"]`).value);return {...it,qty:it.code==='yeast'?entered/1000:entered,sort_order:i};});
    if(items.some(x=>!Number.isFinite(x.qty)||x.qty<0)){recipeButton.disabled=false;recipeButton.textContent='Save as new recipe version';showToast(t('Recipe quantities must be valid non-negative numbers.',lang),'error');return;}
    if(isDemo){db.recipe.version+=1;db.recipe.updatedAt=new Date().toISOString();db.recipe.updatedBy=currentUser.name;db.recipe.items=items;saveDemo();showToast(`${t('Recipe saved as',lang)} v${db.recipe.version}.`,'success');render();}
    else {const {error}=await supabase.rpc('create_recipe_version',{p_items:items.map(x=>({code:x.code,qty:x.qty,unit:x.unit,note:x.note||'',sort_order:x.sort_order})),p_note:`Updated by ${currentUser.name}`});if(error){recipeButton.disabled=false;recipeButton.textContent='Save as new recipe version';showToast(friendlyError(error),'error');return;}await refreshLiveState();showToast(`${t('Recipe saved as',lang)} v${liveState.recipe.version}.`,'success');render();}
  });
}

async function renderInventory(p){
  if(currentUser.role!=='admin'){p.innerHTML='<div class="card"><h2>'+t('Inventory',lang)+'</h2><div class="alert error">'+t('Admin access only.',lang)+'</div></div>';return;}
  // Keep route navigation independent of the full dashboard sync; refresh stock after first paint.
  const options=STOCK_MATERIALS.map(m=>'<option value="'+m.code+'">'+esc(t(m.name,lang))+'</option>').join('');
  const stockIcons={flour:'🌾',oil:'🫗',salt:'🧂',sugar:'🍚',yeast:'🧫'};
  const cards=STOCK_MATERIALS.map(m=>{const v=stockBreakdown(m,getStock(m.code),lang);return '<article class="card stock-card-premium" data-stock-card="'+m.code+'"><div class="stock-material-head"><span class="stock-material-icon" aria-hidden="true">'+(stockIcons[m.code]||'📦')+'</span><span class="stock-material-name">'+esc(t(m.name,lang))+'</span><span class="stock-material-dot" aria-hidden="true"></span></div><div class="kpi stock-primary">'+esc(v.primary)+'</div><div class="small stock-secondary">'+esc(v.secondary)+'</div><div class="stock-alert-line" data-stock-alert="'+m.code+'"><span class="stock-alert-status">⚙ Alert not set</span></div><button type="button" class="stock-reorder-button" data-set-reorder="'+m.code+'"><span aria-hidden="true">⚙</span> Set low-stock alert</button></article>';}).join('');
  p.innerHTML=
    '<div class="page-head"><div><div class="eyebrow">'+t('Admin tools',lang)+'</div><h1>'+esc(siteText('inventoryTitle',t('Inventory',lang)))+'</h1><p>'+esc(siteText('inventorySubtitle',t('Receive, issue, correct and audit every ingredient movement.',lang)))+'</p></div><div class="inventory-page-actions"><button class="btn primary" id="stockIn">＋ Receive stock</button><button class="btn secondary" id="stockOut">− Issue / waste</button></div></div>'+
    '<section class="stock-quick-actions" aria-label="Inventory shortcuts"><button type="button" class="stock-shortcut" id="jumpStockCorrection"><span>⚖</span><b>Fix a stock balance</b><small>Correct a past date</small><i>Open editor →</i></button><button type="button" class="stock-shortcut" id="jumpStockLedger"><span>▤</span><b>History &amp; edits</b><small>Find, edit or remove entries</small><i>Open ledger →</i></button></section>'+
    '<div class="stock-section-heading"><div><span class="eyebrow">LIVE OVERVIEW</span><h2>Ingredient balances</h2><p>Tap any alert to set its reorder level.</p></div><span class="stock-count-pill">'+STOCK_MATERIALS.length+' materials</span></div>'+
    '<div class="stock-material-grid">'+cards+'</div>'+
    '<section class="inventory-workflow-banner"><div class="inventory-workflow-icon">✓</div><div><b>Stock changes are traceable</b><small>Receipts, issues and dated corrections are recorded in your movement ledger.</small></div><span class="inventory-live-pill">'+t('Admin',lang)+' • 🔐</span></section>'+
    '<section class="card historical-editor-card"><div class="history-card-heading"><div><div class="eyebrow">'+t('Audit-safe correction',lang)+'</div><h2>🗓️ '+t('Date-wise inventory editor',lang)+'</h2><p>'+t('Set the correct stock balance as of a past date. The system records a correction instead of deleting history.',lang)+'</p></div></div>'+
    '<div class="history-filter-row"><div class="field"><label for="stockHistoryDate">'+t('Inventory date',lang)+'</label><input id="stockHistoryDate" type="date" max="'+today()+'" value="'+today()+'"></div><div class="field"><label for="stockEditMaterial">'+t('Material',lang)+'</label><select id="stockEditMaterial">'+options+'</select></div></div>'+
    '<div class="history-target-grid"><div class="field"><label for="stockEditPackage">'+t('Package / container',lang)+'</label><select id="stockEditPackage"></select></div><div class="field"><label for="stockEditPackages">'+t('Full packages',lang)+'</label><input id="stockEditPackages" type="number" min="0" step="1" value="0"></div><div class="field"><label for="stockEditRemainder">'+t('Open remainder',lang)+'</label><div class="unit-input-pair"><input id="stockEditRemainder" type="number" min="0" step="0.001" value="0"><select id="stockEditRemainderUnit" aria-label="'+t('Remainder unit',lang)+'"><option value="kg">kg</option><option value="g">g</option></select></div></div></div>'+
    '<div class="historical-preview"><span class="history-preview-icon">⚖</span><div><small>'+t('Target balance on selected date',lang)+'</small><strong id="stockTargetPreview">0 kg</strong></div><div class="historical-before"><small>'+t('Current as of date',lang)+'</small><b id="stockAsOfPreview">—</b></div></div>'+
    '<div class="history-form-footer"><small>🔒 '+t('Admin-only action. Every correction is dated and auditable.',lang)+'</small><button class="btn primary" id="saveStockByDate">✓ '+t('Save dated correction',lang)+'</button></div></section>'+
    '<section class="card inventory-history-card"><div class="history-card-heading"><div><h2>🧾 Inventory movement ledger</h2><p id="historyDateCaption"></p></div><div class="inventory-page-actions"><button type="button" class="btn secondary" id="exportHistoryCsv">Export CSV</button><button type="button" class="btn secondary" id="viewAuditLog">Audit log</button><button type="button" class="btn secondary" id="refreshHistory">↻ Refresh</button></div></div><div class="history-filters"><div class="field"><label for="historyFrom">From</label><input id="historyFrom" type="date" max="'+today()+'" value="'+daysAgoDate(6)+'"></div><div class="field"><label for="historyTo">To</label><input id="historyTo" type="date" max="'+today()+'" value="'+today()+'"></div><div class="field"><label for="historyMaterialFilter">Material</label><select id="historyMaterialFilter"><option value="">All materials</option>'+options+'</select></div><div class="field"><label for="historyTypeFilter">Movement type</label><select id="historyTypeFilter"><option value="">All movements</option>'+INVENTORY_MOVEMENT_TYPES.map(x=>'<option value="'+x.value+'">'+esc(x.label)+'</option>').join('')+'</select></div><div class="field"><label for="historySearch">Search note / supplier / ref</label><input id="historySearch" type="search" placeholder="Search inventory history"></div><button type="button" class="btn primary" id="applyHistoryFilters">Apply filters</button></div><div id="inventoryDatabaseNotice" class="inventory-database-notice" role="status" hidden></div><div id="inventoryHistorySummary" class="history-summary-strip"></div><div id="inventoryHistoryRows" class="table-wrap"><div class="empty">Loading inventory activity…</div></div></section>';

  p.querySelector('#jumpStockCorrection')?.addEventListener('click',()=>p.querySelector('.historical-editor-card')?.scrollIntoView({behavior:'smooth',block:'start'}));
  p.querySelector('#jumpStockLedger')?.addEventListener('click',()=>p.querySelector('.inventory-history-card')?.scrollIntoView({behavior:'smooth',block:'start'}));
  let reorderLevels={};
  const paintReorderLevel=code=>{
    const material=STOCK_MATERIALS.find(m=>m.code===code);
    const box=p.querySelector('[data-stock-alert="'+code+'"]');
    if(!material||!box)return;
    const min=Number(reorderLevels[code]||0),stock=Number(getStock(code)||0);
    if(min<=0){box.className='stock-alert-line';box.innerHTML='<span class="stock-alert-status">⚙ Reorder alert not set</span>';return;}
    const low=stock<=min;
    box.className='stock-alert-line '+(low?'low':'ok');
    box.innerHTML='<span class="stock-alert-status">'+(low?'⚠ LOW STOCK':'✓ Stock level OK')+'</span><small>Alert at '+formatInventoryNumber(min,lang)+' kg</small>';
  };
  const paintAllReorderLevels=()=>STOCK_MATERIALS.forEach(m=>paintReorderLevel(m.code));
  const openReorderLevel=code=>{
    const material=STOCK_MATERIALS.find(m=>m.code===code);if(!material)return;
    modalRoot.innerHTML=`<div class="modal-backdrop show"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="reorderTitle"><div class="modal-head"><div><div class="eyebrow">Inventory alert</div><h2 id="reorderTitle">Low-stock threshold</h2></div><button id="closeModal" type="button" aria-label="Close">×</button></div><p class="small">${esc(material.name)} uses kg as its inventory base unit. The app flags stock at or below this level.</p><div class="field"><label for="reorderLevelInput">Alert when stock is at or below (kg)</label><input id="reorderLevelInput" type="number" min="0" step="0.001" value="${Number(reorderLevels[code]||0)}"></div><div id="reorderError" class="inventory-database-notice error" hidden></div><div class="modal-footer"><button type="button" class="btn secondary" id="cancelModal">Cancel</button><button type="button" class="btn primary" id="saveReorderLevel">Save alert</button></div></section></div>`;
    const close=()=>closeModal();
    document.getElementById('closeModal').addEventListener('click',close);
    document.getElementById('cancelModal').addEventListener('click',close);
    document.getElementById('saveReorderLevel').addEventListener('click',async()=>{
      const input=document.getElementById('reorderLevelInput'),value=Number(input.value),err=document.getElementById('reorderError'),button=document.getElementById('saveReorderLevel');
      if(!Number.isFinite(value)||value<0){err.hidden=false;err.textContent='Enter a valid non-negative kg quantity.';return;}
      button.disabled=true;err.hidden=true;
      try{
        if(isDemo){db.reorderLevels=db.reorderLevels||{};db.reorderLevels[code]=value;saveDemo();}
        else{const {error}=await supabase.rpc('admin_set_reorder_level',{p_material_code:code,p_minimum_stock:value});if(error)throw error;}
        reorderLevels[code]=value;closeModal();paintReorderLevel(code);showToast('Low-stock alert saved.','success');
      }catch(error){err.hidden=false;err.textContent=friendlyError(error);button.disabled=false;}
    });
  };
  p.querySelectorAll('[data-set-reorder]').forEach(button=>button.addEventListener('click',()=>openReorderLevel(button.dataset.setReorder)));
  if(isDemo){reorderLevels={...(db.reorderLevels||{})};paintAllReorderLevels();}
  else{
    void supabase.from('materials').select('code,minimum_stock').eq('active',true).then(({data,error})=>{
      if(error||!Array.isArray(data)||document.body.dataset.route!=='inventory')return;
      reorderLevels=Object.fromEntries(data.map(x=>[x.code,Number(x.minimum_stock)||0]));paintAllReorderLevels();
    }).catch(()=>{});
  }
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
  let currentActivityRows=[];
  let currentActivityKind='movements';
  const drawHistory=(rows,rangeLabel)=>{
    currentActivityRows=rows||[];
    currentActivityKind='movements';
    $('historyDateCaption').textContent='Inventory movements · '+rangeLabel;
    $('inventoryHistorySummary').innerHTML='<div><small>Records</small><b>'+currentActivityRows.length+'</b></div><div><small>Period</small><b>'+esc(rangeLabel)+'</b></div><div><small>Materials</small><b>'+STOCK_MATERIALS.length+'</b></div>';
    if(!currentActivityRows.length){$('inventoryHistoryRows').innerHTML='<div class="empty">No inventory movements match these filters.</div>';return;}
    const body=currentActivityRows.map(row=>{
      const m=STOCK_MATERIALS.find(x=>x.code===row.material_code)||STOCK_MATERIALS[0];
      const value=stockBreakdown(m,Number(row.qty_base)||0,lang);
      const inc=row.direction==='in';
      const id=String(row.transaction_id||row.id||'');
      const type=row.movement_type||((row.reason||'').toLowerCase().includes('historical stock correction')?'adjustment':inc?'manual_receipt':'manual_issue');
      const actions=(row.production_run_id||type==='production')
        ? '<span class="small">Linked to production</span>'
        : '<div class="inventory-row-actions"><button type="button" class="btn secondary" data-inventory-edit="'+esc(id)+'">Edit</button><button type="button" class="btn danger" data-inventory-delete="'+esc(id)+'">Remove</button></div>';
      const source=[row.supplier_name,row.reference_code?'Ref: '+row.reference_code:''].filter(Boolean).join(' · ');
      return '<tr><td>'+esc(String(row.effective_date||'').slice(0,10))+'</td><td><b>'+esc(t(row.material_name||m.name,lang))+'</b><small class="table-secondary">'+esc(row.package_label||'')+'</small></td><td><span class="movement-pill '+(inc?'in':'out')+'">'+(inc?'＋ '+t('Stock in',lang):'− '+t('Stock out',lang))+'</span><small class="table-secondary">'+esc(movementTypeLabel(type))+'</small></td><td><b>'+esc(value.primary)+'</b><small class="table-secondary">'+esc(value.secondary)+'</small></td><td><small class="table-secondary">'+esc(source)+'</small></td><td>'+esc(row.created_by_name||'')+'</td><td>'+actions+'</td></tr>';
    }).join('');
    $('inventoryHistoryRows').innerHTML='<div class="table-wrap"><table><thead><tr><th>Date</th><th>Material</th><th>Movement</th><th>Quantity</th><th>Source / reference</th><th>Entered by</th><th>Admin actions</th></tr></thead><tbody>'+body+'</tbody></table></div>';
    $('inventoryHistoryRows').querySelectorAll('[data-inventory-edit]').forEach(button=>button.addEventListener('click',()=>{
      const row=currentActivityRows.find(x=>String(x.transaction_id||x.id||'')===button.dataset.inventoryEdit);
      if(row)openInventoryTransactionModal(row,async()=>{await refreshLiveState();await loadDate($('stockHistoryDate').value);await loadActivity();});
    }));
    $('inventoryHistoryRows').querySelectorAll('[data-inventory-delete]').forEach(button=>button.addEventListener('click',async()=>{
      const row=currentActivityRows.find(x=>String(x.transaction_id||x.id||'')===button.dataset.inventoryDelete);
      if(!row)return;
      const date=String(row.effective_date||'').slice(0,10);
      const label=(row.material_name||row.material_code)+' · '+movementTypeLabel(row.movement_type||'manual_receipt')+' · '+formatInventoryNumber(row.qty_base,lang)+' kg · '+date;
      if(appSettings.confirmDestructiveActions&&!window.confirm('Remove this historical stock entry?\n'+label+'\nThe action will be recorded in the admin audit log.'))return;
      const reason='Admin removed historical stock entry';
      button.disabled=true;
      try{
        if(isDemo){
          const inv=db.inventory[row.material_code];inv.tx=inv.tx.filter(x=>String(x.id)!==String(row.transaction_id||row.id));
          inv.stock=inv.tx.reduce((sum,x)=>sum+(x.dir==='out'?-Number(x.qty||0):Number(x.qty||0)),0);saveDemo();
        }else{
          const {error}=await supabase.rpc('admin_delete_inventory_transaction',{p_transaction_id:row.transaction_id||row.id,p_reason:reason.trim()});
          if(error)throw error;
        }
        await refreshLiveState();await loadDate($('stockHistoryDate').value);await loadActivity();
        showToast('Historical stock entry removed. Audit record retained.','success');render();
      }catch(error){showToast(friendlyError(error),'error');button.disabled=false;}
    }));
  };
  const drawAudit=(rows,rangeLabel)=>{
    currentActivityRows=rows||[];
    currentActivityKind='audit';
    $('historyDateCaption').textContent='Admin audit log · '+rangeLabel;
    $('inventoryHistorySummary').innerHTML='<div><small>Audit records</small><b>'+currentActivityRows.length+'</b></div><div><small>Period</small><b>'+esc(rangeLabel)+'</b></div><div><small>Scope</small><b>Admin edits / removals</b></div>';
    if(!currentActivityRows.length){$('inventoryHistoryRows').innerHTML='<div class="empty">No admin edits or removals in this period.</div>';return;}
    const body=currentActivityRows.map(row=>{
      const before=JSON.stringify(row.before_record||{},null,2);
      const after=JSON.stringify(row.after_record||{},null,2);
      return '<tr><td>'+esc(String(row.occurred_at||'').replace('T',' ').slice(0,19))+'</td><td><b>'+esc(row.action||'')+'</b></td><td>'+esc(String(row.transaction_id||''))+'</td><td>'+esc(row.note||'')+'</td><td><details><summary>Before</summary><pre>'+esc(before)+'</pre></details></td><td><details><summary>After</summary><pre>'+esc(after||'—')+'</pre></details></td></tr>';
    }).join('');
    $('inventoryHistoryRows').innerHTML='<div class="table-wrap"><table><thead><tr><th>Changed at</th><th>Action</th><th>Entry ID</th><th>Audit note</th><th>Original values</th><th>New values</th></tr></thead><tbody>'+body+'</tbody></table></div>';
  };
  const loadActivity=async()=>{
    const from=$('historyFrom').value,to=$('historyTo').value;
    if(!from||!to||from>to||to>today()){showInventoryNotice('Choose a valid activity date range ending today or earlier.','error');return;}
    const rangeLabel=from===to?from:from+' – '+to;
    showInventoryNotice('');
    if(isDemo){
      const query=$('historySearch').value.trim().toLowerCase();
      const material=$('historyMaterialFilter').value,type=$('historyTypeFilter').value;
      const rows=STOCK_MATERIALS.flatMap(m=>(db.inventory?.[m.code]?.tx||[]).map(x=>{
        const movement=x.movementType||((x.reason||'').toLowerCase().includes('historical stock correction')?'adjustment':x.dir==='out'?'manual_issue':'manual_receipt');
        return {id:x.id,transaction_id:x.id,production_run_id:x.productionRunId||null,effective_date:x.effectiveDate||String(x.at||'').slice(0,10),material_code:m.code,material_name:m.name,direction:x.dir==='out'?'out':'in',movement_type:movement,qty_base:x.qty,reason:x.reason,package_count:x.packages,package_label:x.packageLabel,supplier_name:x.supplierName,reference_code:x.referenceCode,created_by_name:x.by,created_at:x.at};
      })).filter(row=>row.effective_date>=from&&row.effective_date<=to&&(!material||row.material_code===material)&&(!type||row.movement_type===type)&&(!query||[row.reason,row.supplier_name,row.reference_code,row.material_name].join(' ').toLowerCase().includes(query))).sort((x,y)=>String(y.effective_date).localeCompare(String(x.effective_date))||String(y.created_at).localeCompare(String(x.created_at)));
      drawHistory(rows,rangeLabel);
    }else{
      const {data,error}=await supabase.rpc('admin_inventory_activity',{
        p_from:from,p_to:to,p_material_code:$('historyMaterialFilter').value||null,
        p_movement_type:$('historyTypeFilter').value||null,p_search:$('historySearch').value.trim()||null
      });
      if(error){showInventoryNotice(friendlyError(error),'error');$('inventoryHistoryRows').innerHTML='<div class="empty">Unable to load inventory activity. Check the database inventory migration and try again.</div>';return;}
      drawHistory(data||[],rangeLabel);
    }
  };
  const loadAuditLog=async()=>{
    const from=$('historyFrom').value,to=$('historyTo').value;
    if(!from||!to||from>to||to>today()){showInventoryNotice('Choose a valid audit date range ending today or earlier.','error');return;}
    const rangeLabel=from===to?from:from+' – '+to;
    if(isDemo){drawAudit([],rangeLabel);return;}
    const {data,error}=await supabase.rpc('admin_inventory_audit',{p_from:from,p_to:to});
    if(error){showInventoryNotice(friendlyError(error),'error');return;}
    drawAudit(data||[],rangeLabel);
  };
  const loadDate=async date=>{
    if(!date)return false;
    snapshotLoaded=false;
    historicalCorrectionRpcReady=true;
    updateCorrectionButton();
    if(isDemo){
      snapshotMap=Object.fromEntries(STOCK_MATERIALS.map(m=>[m.code,stockAtDemo(m.code,date)]));
      const rows=STOCK_MATERIALS.flatMap(m=>(db.inventory?.[m.code]?.tx||[]).filter(x=>(x.effectiveDate||String(x.at||'').slice(0,10))===date).map(x=>({transaction_id:x.id,id:x.id,production_run_id:null,effective_date:date,material_code:m.code,material_name:m.name,direction:x.dir,qty_base:x.qty,package_count:x.packages??null,package_label:x.packageLabel||'',reason:x.reason||'Inventory movement',created_by_name:x.by||'Admin',created_at:x.at}))).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
      // Date-wise correction snapshot loads independently of activity filters.
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
        // Activity rows are loaded by the filter panel, independently of the correction date.
        snapshotLoaded=true;
        historicalCorrectionRpcReady=true;
        showInventoryNotice('');
        updateCorrectionButton();
      }else{
        // Read-only fallback: Admin RLS permits reading the dated ledger. Reconstruct
        // the historical balance from today's authoritative view minus later movements.
        try{
          const selectFields='id,production_run_id,effective_date,material_code,direction,qty_base,reason,package_count,package_label,created_by,created_at';
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
          /* snapshot recovery uses the ledger; the separate activity query owns history rendering. */
          const recoveredHistoryRows=datedRows.map(row=>({
            ...row,
            material_name:STOCK_MATERIALS.find(m=>m.code===row.material_code)?.name||row.material_code,
            created_by_name:userName.get(row.created_by)||'Admin'
          }));
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
  $('applyHistoryFilters').addEventListener('click',()=>currentActivityKind==='audit'?loadAuditLog():loadActivity());
  $('refreshHistory').addEventListener('click',()=>currentActivityKind==='audit'?loadAuditLog():loadActivity());
  $('viewAuditLog').addEventListener('click',async()=>{
    if(currentActivityKind==='audit'){await loadActivity();$('viewAuditLog').textContent='Audit log';}
    else{await loadAuditLog();$('viewAuditLog').textContent='Movement ledger';}
  });
  $('exportHistoryCsv').addEventListener('click',()=>{
    if(!currentActivityRows.length){showToast('There are no rows to export.','error');return;}
    const columns=currentActivityKind==='audit'
      ? ['occurred_at','action','transaction_id','note','before_record','after_record']
      : ['effective_date','material_code','material_name','direction','movement_type','qty_base','package_label','supplier_name','reference_code','reason','created_by_name','created_at'];
    const cell=value=>{
      let text=value&&typeof value==='object'?JSON.stringify(value):String(value??'');
      if(/^[=+@\\-]/.test(text))text="'"+text;
      return '"'+text.replace(/"/g,'""')+'"';
    };
    const csv=[columns.join(','),...currentActivityRows.map(row=>columns.map(key=>cell(row[key])).join(','))].join('\r\n');
    const url=URL.createObjectURL(new Blob(['\ufeff',csv],{type:'text/csv;charset=utf-8;'}));
    const link=document.createElement('a');link.href=url;link.download=(currentActivityKind==='audit'?'doughflow-inventory-audit':'doughflow-inventory-ledger')+'-'+$('historyFrom').value+'-'+$('historyTo').value+'.csv';document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
  });
  $('saveStockByDate').addEventListener('click',async()=>{
    if(!snapshotLoaded||!historicalCorrectionRpcReady){showInventoryNotice('Date corrections are disabled until the inventory database migration is applied successfully. No stock was changed.','warning');return;}
    const date=$('stockHistoryDate').value,m=getMaterial(),pkg=getPackage();
    if(!date||date>today()){showToast(t('Choose today or a past date',lang),'error');return;}
    const count=Number($('stockEditPackages').value||0),raw=Number($('stockEditRemainder').value||0),rem=$('stockEditRemainderUnit').value==='g'?raw/1000:raw;
    const target=count*Number(pkg?.qty||0)+rem,reason='Admin stock correction';
    if(count<0||rem<0||!Number.isFinite(target)||!Number.isFinite(count)||!Number.isFinite(rem)){
      showInventoryNotice('Enter a valid stock quantity. No stock was changed.','error');
      if(!Number.isFinite(count)||count<0)$('stockEditPackages').focus();else $('stockEditRemainder').focus();
      return;
    }
    showInventoryNotice('');
    const prev=Number(snapshotMap[m.code]||0);
    if(isDemo && Number(db.inventory[m.code]?.stock||0)+(target-prev)<-0.00005){
      showToast(t('Historical correction would make current inventory negative; reconcile later transactions first.',lang),'error');return;
    }
    if(Math.abs(target-prev)<0.00005){showToast(t('No stock change required.',lang));return;}
    if(appSettings.confirmDestructiveActions&&!window.confirm('Confirm dated stock correction?\\n'+t(m.name,lang)+': '+formatInventoryNumber(prev,lang)+' kg → '+formatInventoryNumber(target,lang)+' kg on '+date+'.'))return;
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
      await refreshLiveState();await loadDate(date);
      showInventoryNotice('Stock corrected successfully for '+date+'.','success');showToast(t('Stock corrected for selected date.',lang),'success');render();
    }catch(error){showToast(friendlyError(error),'error');}
    finally{button.disabled=false;}
  });
  $('stockIn').addEventListener('click',()=>openStockModal('purchase'));
  $('stockOut').addEventListener('click',()=>openStockModal('manual_issue'));
  updatePackageOptions();
  // Load dated history after the page is visible so slow RPCs never block menu switching.
  void loadDate(today()).then(ok=>{if(ok&&document.body.dataset.route==='inventory'&&$('stockHistoryDate'))setTargetFromSnapshot();});
  void loadActivity();
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
      paintAllReorderLevels();
    }).catch(()=>{});
  }
}
function openInventoryTransactionModal(row,onSaved=()=>{}){
  if(currentUser?.role!=='admin'){showToast(t('Admin access only.',lang),'error');return;}
  const originalMaterial=STOCK_MATERIALS.find(m=>m.code===row.material_code)||STOCK_MATERIALS[0];
  const currentType=row.movement_type||((row.reason||'').toLowerCase().includes('historical stock correction')?'adjustment':row.direction==='out'?'manual_issue':'manual_receipt');
  const editableTypes=INVENTORY_MOVEMENT_TYPES.filter(x=>x.value!=='production');
  modalRoot.innerHTML=`<div class="modal-backdrop show"><section class="modal inventory-edit-modal" role="dialog" aria-modal="true" aria-labelledby="editStockTitle">
    <div class="modal-head"><div><div class="eyebrow">Admin inventory controls</div><h2 id="editStockTitle">Edit historical movement</h2></div><button type="button" id="closeModal" aria-label="Close">×</button></div>
    <p class="small">Changing a manual entry recalculates the ledger. The before/after values are saved to the admin audit log. Production-linked entries must be corrected through production history.</p>
    <div class="field"><label for="editStockMaterial">Material *</label><select id="editStockMaterial">${STOCK_MATERIALS.map(m=>'<option value="'+m.code+'" '+(m.code===originalMaterial.code?'selected':'')+'>'+esc(t(m.name,lang))+'</option>').join('')}</select></div>
    <div class="field"><label for="editStockMovementType">Movement type *</label><select id="editStockMovementType">${editableTypes.map(x=>'<option value="'+x.value+'" '+(x.value===currentType?'selected':'')+'>'+esc(x.label)+'</option>').join('')}</select></div>
    <div class="field"><label for="editStockDirection">Direction *</label><select id="editStockDirection"><option value="in" ${row.direction==='in'?'selected':''}>Stock in</option><option value="out" ${row.direction==='out'?'selected':''}>Stock out</option></select></div>
    <div class="field"><label for="editStockDate">Effective date *</label><input id="editStockDate" type="date" max="${today()}" value="${esc(String(row.effective_date||today()).slice(0,10))}"></div>
    <div class="field"><label for="editStockPackage">Package / container *</label><select id="editStockPackage"></select></div>
    <div class="field"><label for="editStockCount">Full packages *</label><input id="editStockCount" type="number" min="0" step="1" value="0"></div>
    <div class="field"><label for="editStockRemainder">Open remainder</label><div class="unit-input-pair"><input id="editStockRemainder" type="number" min="0" step="0.001" value="0"><select id="editStockRemainderUnit"><option value="kg">kg</option><option value="g">g</option></select></div></div>
    <div class="field"><label for="editStockSupplier">Supplier / recipient</label><input id="editStockSupplier" maxlength="120" value="${esc(row.supplier_name||'')}" placeholder="Supplier, customer or department"></div>
    <div class="field"><label for="editStockReference">Invoice / delivery reference</label><input id="editStockReference" maxlength="100" value="${esc(row.reference_code||'')}" placeholder="Invoice or delivery reference"></div>
    <div class="historical-preview"><span class="history-preview-icon">⚖</span><div><small>Quantity after edit</small><strong id="editStockPreview">0 kg</strong></div></div>
    <div class="field"><label for="editStockReason">Reason / audit note *</label><input id="editStockReason" required minlength="3" maxlength="180" value="${esc(row.reason||'')}" placeholder="Why is this entry changing?"></div>
    <div id="editStockError" class="inventory-database-notice error" role="alert" hidden></div>
    <div class="modal-footer"><button type="button" class="btn secondary" id="cancelModal">Cancel</button><button type="button" class="btn primary" id="saveStockEdit">Save changes</button></div>
  </section></div>`;
  const $=id=>document.getElementById(id);
  const getMaterial=()=>STOCK_MATERIALS.find(m=>m.code===$('editStockMaterial').value)||STOCK_MATERIALS[0];
  const getPackage=()=>{const m=getMaterial();return m.packages[Number($('editStockPackage').value)]||m.packages[0];};
  const showError=message=>{const el=$('editStockError');el.hidden=!message;el.textContent=message||'';};
  const syncDirection=()=>{
    const movement=$('editStockMovementType').value,fixed=movementDirection(movement);
    const direction=$('editStockDirection');
    if(movement==='adjustment'){direction.disabled=false;}
    else{direction.value=fixed;direction.disabled=true;}
  };
  const preview=()=>{
    const pkg=getPackage(),count=Math.max(0,Number($('editStockCount').value)||0),raw=Math.max(0,Number($('editStockRemainder').value)||0);
    const rem=$('editStockRemainderUnit').value==='g'?raw/1000:raw,qty=count*Number(pkg?.qty||0)+rem;
    $('editStockCount').step=pkg?.kind==='sack'?'0.5':'1';
    $('editStockPreview').textContent=stockBreakdown(getMaterial(),qty,lang).primary+' · '+formatInventoryNumber(qty,lang)+' kg';
  };
  const setPackageOptions=()=>{
    const m=getMaterial(),quantity=Number(row.qty_base)||0;
    $('editStockPackage').innerHTML=m.packages.filter(x=>x.kind!=='recipe').map(x=>'<option value="'+m.packages.indexOf(x)+'">'+esc(packageUnit(m,x,lang))+'</option>').join('');
    const selected=m.packages.findIndex(x=>x.label===row.package_label&&x.kind!=='recipe');
    $('editStockPackage').value=String(selected>=0?selected:m.packages.findIndex(x=>x.kind!=='recipe'));
    const pkg=getPackage(),size=Number(pkg?.qty||1);let count=Math.floor((quantity+0.000001)/size),rem=quantity-count*size;
    if(pkg?.kind==='sack'&&Math.abs(rem-size/2)<0.00001){count+=0.5;rem=0;}
    $('editStockCount').value=count;
    $('editStockRemainderUnit').value=rem>0&&rem<1?'g':'kg';
    $('editStockRemainder').value=Number((rem*($('editStockRemainderUnit').value==='g'?1000:1)).toFixed(3));
    $('editStockRemainderUnit').dataset.unit=$('editStockRemainderUnit').value;preview();
  };
  $('editStockMaterial').addEventListener('change',setPackageOptions);
  $('editStockPackage').addEventListener('change',setPackageOptions);
  $('editStockMovementType').addEventListener('change',()=>{syncDirection();});
  $('editStockCount').addEventListener('input',preview);$('editStockRemainder').addEventListener('input',preview);
  $('editStockRemainderUnit').addEventListener('change',()=>{
    const input=$('editStockRemainder'),old=input.dataset.unit||'kg',next=$('editStockRemainderUnit').value;
    if(old!==next)input.value=Number((Number(input.value||0)*(old==='g'?0.001:1000)).toFixed(3));
    input.dataset.unit=next;preview();
  });
  $('closeModal').addEventListener('click',closeModal);$('cancelModal').addEventListener('click',closeModal);
  syncDirection();setPackageOptions();
  $('saveStockEdit').addEventListener('click',async()=>{
    const m=getMaterial(),pkg=getPackage(),count=Number($('editStockCount').value||0),raw=Number($('editStockRemainder').value||0),
      rem=$('editStockRemainderUnit').value==='g'?raw/1000:raw,qty=count*Number(pkg?.qty||0)+rem,
      date=$('editStockDate').value,reason=$('editStockReason').value.trim(),movement=$('editStockMovementType').value,dir=$('editStockDirection').value;
    if(!date||date>today()){showError('Choose today or a past date.');return;}
    if(count<0||rem<0||!Number.isFinite(qty)||qty<=0||(pkg?.kind==='sack'&&Math.abs(count*2-Math.round(count*2))>0.000001)||(pkg?.kind!=='sack'&&Math.abs(count-Math.round(count))>0.000001)){showError('Enter a valid package quantity. Sack quantities may use half-sacks.');return;}
    if(reason.length<3){showError('Enter a reason of at least 3 characters.');$('editStockReason').focus();return;}
    if(movement!=='adjustment'&&dir!==movementDirection(movement)){showError('Movement type and direction do not match.');return;}
    const button=$('saveStockEdit');button.disabled=true;showError('');
    try{
      if(isDemo){
        const inv=db.inventory[row.material_code],entry=inv.tx.find(x=>String(x.id)===String(row.transaction_id||row.id));
        if(!entry)throw new Error('Inventory transaction not found');
        entry.dir=dir;entry.qty=qty;entry.effectiveDate=date;entry.reason=reason;entry.packageLabel=pkg.label;entry.packages=count;
        entry.movementType=movement;entry.supplierName=$('editStockSupplier').value.trim();entry.referenceCode=$('editStockReference').value.trim();
        inv.stock=inv.tx.reduce((sum,x)=>sum+(x.dir==='out'?-Number(x.qty||0):Number(x.qty||0)),0);saveDemo();
      }else{
        const {error}=await supabase.rpc('admin_update_inventory_transaction',{
          p_transaction_id:row.transaction_id||row.id,p_material_code:m.code,p_direction:dir,p_qty_base:Number(qty.toFixed(4)),
          p_effective_date:date,p_reason:reason,p_package_count:count||null,p_package_label:pkg.label,
          p_movement_type:movement,p_supplier_name:$('editStockSupplier').value.trim()||null,p_reference_code:$('editStockReference').value.trim()||null
        });
        if(error)throw error;
      }
      closeModal();showToast('Historical stock entry updated. Audit record retained.');await onSaved();
    }catch(error){showError(friendlyError(error));button.disabled=false;}
  });
}
function openStockModal(presetType='purchase'){
  if(currentUser?.role!=='admin'){showToast(t('Admin access only.',lang),'error');return;}
  const entryTypes=INVENTORY_MOVEMENT_TYPES.filter(x=>!['adjustment','production'].includes(x.value));
  const preferred=entryTypes.some(x=>x.value===presetType)?presetType:'purchase';
  const typeOptions=entryTypes.map(x=>'<option value="'+x.value+'" '+(x.value===preferred?'selected':'')+'>'+esc(x.label)+'</option>').join('');
  const opts=STOCK_MATERIALS.map(m=>'<option value="'+m.code+'">'+esc(t(m.name,lang))+'</option>').join('');
  modalRoot.innerHTML=`<div class="modal-backdrop show"><section class="modal receive-stock-modal" role="dialog" aria-modal="true" aria-labelledby="receiveStockTitle">
    <div class="modal-head"><div><div class="eyebrow">Inventory ledger</div><h2 id="receiveStockTitle">Record stock movement</h2></div><button type="button" id="closeModal" aria-label="Close">×</button></div>
    <p class="small">Every movement updates the balance and keeps a dated record. Use date-wise correction for a physical count.</p>
    <div class="field"><label for="stockMovementType">Movement type *</label><select id="stockMovementType">${typeOptions}</select></div>
    <div class="field"><label for="stockMaterial">Material *</label><select id="stockMaterial">${opts}</select></div>
    <div id="packageChooser"></div>
    <div class="field"><label for="stockRemainder">Open remainder</label><div class="unit-input-pair"><input id="stockRemainder" type="number" min="0" step="0.001" value="0"><select id="stockRemainderUnit" aria-label="Remainder unit"><option value="kg">kg</option><option value="g">g</option></select></div><small class="field-help">Use this for loose or partially opened stock.</small></div>
    <div class="field"><label for="stockEffectiveDate">Effective date *</label><input id="stockEffectiveDate" type="date" max="${today()}" value="${today()}"></div>
    <div class="field"><label for="stockSupplier">Supplier / recipient</label><input id="stockSupplier" maxlength="120" placeholder="Supplier, customer or department"></div>
    <div class="field"><label for="stockReference">Invoice / delivery reference</label><input id="stockReference" maxlength="100" placeholder="Invoice number, delivery note or reference"></div>
    <div id="stockMovementError" class="inventory-database-notice error" role="alert" hidden></div>
    <div class="historical-preview"><span class="history-preview-icon">⇄</span><div><small>Movement preview</small><strong id="stockMovementPreview">Stock in · 50 kg</strong><div id="stockMovementDirection" class="small">Adds to inventory</div></div></div>
    <div class="modal-footer"><button type="button" class="btn secondary" id="cancelModal">Cancel</button><button type="button" class="btn primary" id="saveStock">Save movement</button></div>
  </section></div>`;
  const $=id=>document.getElementById(id);
  const material=()=>STOCK_MATERIALS.find(x=>x.code===$('stockMaterial').value)||STOCK_MATERIALS[0];
  const pkg=()=>material().packages[Number($('stockPackage').value)]||material().packages[0];
  const type=()=> $('stockMovementType').value;
  const direction=()=>movementDirection(type());
  const showError=message=>{const el=$('stockMovementError');el.hidden=!message;el.textContent=message||'';};
  const updatePreview=()=>{
    const m=material(),p=pkg(),count=Number($('packageCount').value||0),raw=Number($('stockRemainder').value||0),rem=$('stockRemainderUnit').value==='g'?raw/1000:raw,qty=Number(p?.qty||0)*count+rem,dir=direction();
    $('packageCount').step=p?.kind==='sack'?'0.5':'1';
    $('stockMovementPreview').textContent=(dir==='in'?'Stock in · ':'Stock out · ')+stockBreakdown(m,qty,lang).primary+' · '+formatInventoryNumber(qty,lang)+' kg';
    $('stockMovementDirection').textContent=dir==='in'?'Adds to inventory':'Removes from inventory';
    $('saveStock').textContent=dir==='in'?'Save stock in':'Save stock out';
  };
  const updatePackages=()=>{
    const m=material();
    $('packageChooser').innerHTML='<div class="field"><label for="stockPackage">Package / container *</label><select id="stockPackage">'+m.packages.filter(x=>x.kind!=='recipe').map(x=>'<option value="'+m.packages.indexOf(x)+'">'+esc(packageUnit(m,x,lang))+'</option>').join('')+'</select></div><div class="field"><label for="packageCount">Number of packages *</label><input id="packageCount" type="number" min="0.001" step="'+(m.packages[0]?.kind==='sack'?'0.5':'1')+'" value="1"></div><div class="small">Quantity is converted automatically into the inventory base unit (kg).</div>';
    $('stockPackage').addEventListener('change',updatePreview);
    $('packageCount').addEventListener('input',updatePreview);
    $('stockRemainder').addEventListener('input',updatePreview);
    updatePreview();
  };
  $('stockMovementType').addEventListener('change',updatePreview);
  $('stockRemainderUnit').dataset.unit='kg';
  $('stockRemainderUnit').addEventListener('change',()=>{
    const input=$('stockRemainder'),old=input.dataset.unit||'kg',next=$('stockRemainderUnit').value;
    if(old!==next)input.value=Number((Number(input.value||0)*(old==='g'?0.001:1000)).toFixed(3));
    input.dataset.unit=next;updatePreview();
  });
  $('stockMaterial').addEventListener('change',updatePackages);
  $('closeModal').addEventListener('click',closeModal);
  $('cancelModal').addEventListener('click',closeModal);
  updatePackages();
  $('saveStock').addEventListener('click',async()=>{
    const m=material(),p=pkg(),count=Number($('packageCount').value||0),raw=Number($('stockRemainder').value||0),rem=$('stockRemainderUnit').value==='g'?raw/1000:raw,date=$('stockEffectiveDate').value,
      movement=type(),dir=direction(),reason=movementTypeLabel(movement),
      supplier=$('stockSupplier')?.value.trim()||'',reference=$('stockReference')?.value.trim()||'';
    const qty=Number(p?.qty||0)*count+rem;
    if(!date||date>today()){showError('Choose today or a past date. No stock was changed.');return;}
    if(count<0||rem<0||!Number.isFinite(qty)||qty<=0||(p?.kind==='sack'&&Math.abs(count*2-Math.round(count*2))>0.000001)||(p?.kind!=='sack'&&Math.abs(count-Math.round(count))>0.000001)){showError('Enter a valid package count and open remainder. Sack counts may use half-sacks.');return;}
    const save=$('saveStock');save.disabled=true;showError('');
    try{
      if(isDemo){
        const inv=db.inventory[m.code],tx=inv.tx||[];
        if(dir==='out'){
          const asOf=tx.filter(x=>(x.effectiveDate||String(x.at||'').slice(0,10))<=date).reduce((sum,x)=>sum+(x.dir==='out'?-Number(x.qty||0):Number(x.qty||0)),0);
          const current=tx.reduce((sum,x)=>sum+(x.dir==='out'?-Number(x.qty||0):Number(x.qty||0)),0);
          const dayBalances=new Map();tx.forEach(x=>{const d=x.effectiveDate||String(x.at||'').slice(0,10);dayBalances.set(d,(dayBalances.get(d)||0)+(x.dir==='out'?-Number(x.qty||0):Number(x.qty||0)));});
          let running=0,minLater=Infinity;[...dayBalances.entries()].sort((x,y)=>x[0].localeCompare(y[0])).forEach(([d,delta])=>{running+=delta;if(d>=date)minLater=Math.min(minLater,running);});
          if(asOf-qty<-0.00005||current-qty<-0.00005||(minLater!==Infinity&&minLater-qty<-0.00005))throw new Error('Insufficient stock for that date or a later balance.');
        }
        inv.stock+=dir==='in'?qty:-qty;
        inv.tx.push({id:uid(),dir,qty,packages:count>0?count:null,packageLabel:p.label,reason,effectiveDate:date,at:new Date().toISOString(),by:currentUser.name,movementType:movement,supplierName:supplier,referenceCode:reference});
        saveDemo();
      }else{
        const {error}=await supabase.rpc('admin_record_inventory_movement',{
          p_material_code:m.code,p_direction:dir,p_movement_type:movement,p_qty_base:Number(qty.toFixed(4)),
          p_effective_date:date,p_reason:reason,p_package_count:count>0?count:null,p_package_label:p.label,
          p_supplier_name:supplier||null,p_reference_code:reference||null
        });
        if(error)throw error;
      }
      closeModal();await refreshLiveState();render();showToast('Inventory movement saved.','success');
    }catch(error){showError(friendlyError(error));save.disabled=false;}
  });
}
function closeModal(){modalRoot.innerHTML='';}

async function renderReports(p){
  const requestId=(Number(p.dataset.reportRequest||0)+1);
  p.dataset.reportRequest=String(requestId);
  const currentReportMonth=p.dataset.reportMonth||'';
  const locale=lang==='ru'?'ru-RU':lang==='ky'?'ky-KG':'en-GB';
  const monthLabel=month=>new Date(month+'-01T12:00:00').toLocaleDateString(locale,{month:'long',year:'numeric'});
  let notebookRows=[],productionRows=[],notebookError='',productionError='';
  if(isDemo){
    notebookRows=[];
    productionRows=(db.productions||[]).map(r=>({
      id:r.id||uid(),production_date:r.date,created_by:r.createdBy,mishok_count:r.mishokCount,status:'completed',
      production_batches:(r.batches||[]).map((b,i)=>({batch_no:i+1,mishok_fraction:b.sack||1,pieces:b.pieces||0}))
    }));
  }else{
    const notebookPromise=supabase.from('notebook_sack_entries')
      .select('record_date,sack_no,pieces_in_sack')
      .order('record_date',{ascending:false}).order('sack_no',{ascending:true});
    const notebookResult=await notebookPromise;
    if(notebookResult.error)notebookError=friendlyError(notebookResult.error);
    else notebookRows=notebookResult.data||[];
    const pageSize=1000;
    try{
      for(let offset=0;offset<100000;offset+=pageSize){
        const {data,error}=await supabase.from('production_runs')
          .select('id,production_date,created_by,mishok_count,recipe_version_id,created_at,status,production_batches(batch_no,mishok_fraction,pieces),production_materials(material_code,expected_qty,actual_qty,unit)')
          .eq('status','completed').order('production_date',{ascending:false}).order('created_at',{ascending:false})
          .range(offset,offset+pageSize-1);
        if(error)throw error;
        productionRows.push(...(data||[]));
        if(!data||data.length<pageSize)break;
      }
    }catch(error){productionError=friendlyError(error);}
  }
  if(Number(p.dataset.reportRequest)!==requestId||document.body.dataset.route!=='reports')return;
  const notebookByDate=new Map();
  for(const row of notebookRows){
    const date=String(row.record_date);
    if(!notebookByDate.has(date))notebookByDate.set(date,[]);
    notebookByDate.get(date).push({sack:Number(row.sack_no),pieces:Number(row.pieces_in_sack),fraction:1});
  }
  const productionByDate=new Map();
  for(const run of productionRows){
    const date=String(run.production_date);
    if(!productionByDate.has(date))productionByDate.set(date,{runs:[],sacks:0,pieces:0,items:[],createdBy:[]});
    const day=productionByDate.get(date);
    day.runs.push(run);
    day.sacks+=Number(run.mishok_count||0);
    if(run.created_by&&!day.createdBy.includes(run.created_by))day.createdBy.push(run.created_by);
    const batches=[...(run.production_batches||[])].sort((x,y)=>Number(x.batch_no)-Number(y.batch_no));
    for(const batch of batches){
      const fraction=Number(batch.mishok_fraction||1);
      const itemPieces=Number(batch.pieces||0);
      day.pieces+=itemPieces;
      day.items.push({sack:day.items.length+1,pieces:itemPieces,fraction});
    }
  }
  const allDateKeys=[...new Set([...notebookByDate.keys(),...productionByDate.keys()])].filter(Boolean);
  const allMonths=[...new Set([...allDateKeys.map(date=>date.slice(0,7)),today().slice(0,7)])].sort().reverse();
  const selectedMonth=allMonths.includes(currentReportMonth)?currentReportMonth:today().slice(0,7);
  p.dataset.reportMonth=selectedMonth;
  const dailyMap=new Map();
  for(const date of allDateKeys){
    const notebook=notebookByDate.get(date)||[];
    const production=productionByDate.get(date);
    if(production){
      const notebookPieces=notebook.reduce((sum,item)=>sum+item.pieces,0);
      dailyMap.set(date,{
        date,source:'production',sacks:production.sacks,pieces:production.pieces,
        items:production.items,runs:production.runs.length,createdBy:production.createdBy,
        notebookSacks:notebook.length,notebookPieces,
        hasNotebook:notebook.length>0,
        mismatch:notebook.length>0&&(Math.abs(notebook.length-production.sacks)>0.001||notebookPieces!==production.pieces)
      });
    }else if(notebook.length){
      dailyMap.set(date,{
        date,source:'notebook',sacks:notebook.length,pieces:notebook.reduce((sum,item)=>sum+item.pieces,0),
        items:notebook,runs:0,createdBy:[],notebookSacks:notebook.length,notebookPieces:notebook.reduce((sum,item)=>sum+item.pieces,0),
        hasNotebook:true,mismatch:false
      });
    }
  }
  const todayProduction=productionRows.filter(run=>String(run.production_date)===today());
  const todayProductionSacks=todayProduction.reduce((sum,run)=>sum+Number(run.mishok_count||0),0);
  const todayProductionPieces=todayProduction.reduce((sum,run)=>sum+(run.production_batches||[]).reduce((acc,batch)=>acc+Number(batch.pieces||0),0),0);
  const todayInputByMaterial=new Map();
  todayProduction.forEach(run=>(run.production_materials||[]).forEach(item=>{
    const current=todayInputByMaterial.get(item.material_code)||{expected:0,actual:0,unit:item.unit||'kg'};
    current.expected+=Number(item.expected_qty)||0;current.actual+=Number(item.actual_qty)||0;
    todayInputByMaterial.set(item.material_code,current);
  }));
  const todayInputRows=todayInputByMaterial.size?[...todayInputByMaterial.entries()].map(([code,item])=>'<tr><td>'+esc(MATERIALS.find(m=>m.code===code)?.name||code)+'</td><td>'+fmt(item.expected)+' '+esc(item.unit)+'</td><td><b>'+fmt(item.actual)+' '+esc(item.unit)+'</b></td><td>'+fmt(item.actual-item.expected)+' '+esc(item.unit)+'</td></tr>').join(''):"<tr><td colspan='4' class='empty'>No ingredient input saved for today.</td></tr>";
  const allDaily=[...dailyMap.values()].sort((a,b)=>b.date.localeCompare(a.date));
  const monthDaily=allDaily.filter(day=>day.date.startsWith(selectedMonth));
  const monthlySacks=monthDaily.reduce((sum,day)=>sum+day.sacks,0);
  const monthlyPieces=monthDaily.reduce((sum,day)=>sum+day.pieces,0);
  const monthlyAverage=monthlySacks?monthlyPieces/monthlySacks:0;
  const allSacks=allDaily.reduce((sum,day)=>sum+day.sacks,0);
  const allPieces=allDaily.reduce((sum,day)=>sum+day.pieces,0);
  const allMonthsOptions=allMonths.map(month=>'<option value="'+esc(month)+'"'+(month===selectedMonth?' selected':'')+'>'+esc(monthLabel(month))+'</option>').join('');
  const cards=monthDaily.map(day=>{
    const items=day.items||[];
    const vals=items.map(item=>item.pieces);
    const average=day.sacks?day.pieces/day.sacks:0;
    const low=vals.length?Math.min(...vals):0,high=vals.length?Math.max(...vals):0;
    const details=items.map((item,index)=>{
      const label=item.fraction<1?'Half sack '+String(index+1).padStart(2,'0'):'Sack '+String(index+1).padStart(2,'0');
      return "<span class='piece-weight-chip'><small>"+esc(label)+"</small><b>"+fmt(item.pieces)+"</b></span>";
    }).join('');
    const displayDate=new Date(day.date+'T12:00:00').toLocaleDateString(locale,{day:'numeric',month:'short',year:'numeric'});
    const sourcePill=day.source==='production'?"<span class='report-source-pill production'>● Production input</span>":"<span class='report-source-pill notebook'>▤ Notebook entry</span>";
    const mismatch=day.mismatch?"<div class='report-reconcile-note'>⚠ Production and notebook entries differ. Monthly totals use the saved production record once, to avoid double-counting. Notebook: "+fmt(day.notebookSacks)+" sacks / "+fmt(day.notebookPieces)+" pieces.</div>":'';
    return "<article class='piece-weight-day'><div class='piece-weight-day-head'><div><span class='piece-weight-date'>"+esc(displayDate)+"</span><span class='piece-weight-day-sub'>"+sourcePill+"</span></div><span class='piece-weight-sack-count'><b>"+fmt(day.sacks)+"</b> sacks</span></div><div class='piece-weight-daily-total'><span>Total pieces recorded today</span><strong>"+fmt(day.pieces)+"</strong></div>"+(details?"<div class='piece-weight-chips'>"+details+"</div>":"")+"<div class='piece-weight-stats'><span><small>Avg. per sack</small><b>"+fmt(average)+"</b></span><span><small>Fewest</small><b>"+fmt(low)+"</b></span><span><small>Most</small><b>"+fmt(high)+"</b></span></div>"+mismatch+"</article>";
  }).join('');
  const monthOptions=allMonthsOptions||'<option value="'+esc(selectedMonth)+'">'+esc(monthLabel(selectedMonth))+'</option>';
  const historyRows=monthDaily.map(day=>"<tr><td>"+esc(day.date)+"</td><td>"+fmt(day.sacks)+"</td><td>"+fmt(day.pieces)+"</td><td>"+(day.source==='production'?"<span class='report-source-pill production'>Production"+(day.runs>1?" · "+day.runs+" runs":'')+"</span>":"<span class='report-source-pill notebook'>Notebook</span>")+"</td></tr>").join('');
  p.innerHTML=`<div class="page-head report-page-head"><div><div class="eyebrow">PRODUCTION INSIGHTS</div><h1>${esc(siteText('reportsTitle','Reports'))}</h1><p>${esc(siteText('reportsSubtitle','Daily production inputs and notebook sack records are connected here automatically.'))}</p></div><button type="button" class="btn secondary" id="refreshReports">↻ Refresh data</button></div>
  <section class="report-month-toolbar card"><div><span class="report-month-icon">▦</span><div><b>Monthly report</b><small>Updated from saved production and notebook entries</small></div></div><label for="reportMonthSelect">Report month<select id="reportMonthSelect">${monthOptions}</select></label></section>
  <section class="report-today-production card"><div class="report-section-heading"><div><div class="eyebrow">AUTO-LINKED INPUT</div><h2>Today's saved production</h2><p>${esc(formatToday())} · read directly from the Production form</p></div><span class="report-section-count">${fmt(todayProduction.length)} runs</span></div>
    <div class="report-today-stats"><div><small>Sacks</small><strong>${fmt(todayProductionSacks)}</strong></div><div><small>Total pieces</small><strong>${fmt(todayProductionPieces)}</strong></div><div><small>Production runs</small><strong>${fmt(todayProduction.length)}</strong></div></div>
    <div class="report-subheading"><b>Actual ingredient input today</b><small>Actual recorded consumption compared with recipe expectation.</small></div>
    <div class="table-wrap"><table><thead><tr><th>Ingredient</th><th>Expected</th><th>Actual used</th><th>Variance</th></tr></thead><tbody>${todayInputRows}</tbody></table></div>
  </section>
  <section class="report-production-summary">
    <article class="report-stat-card"><span class="report-stat-icon">▤</span><small>Sacks recorded this month</small><strong>${fmt(monthlySacks)}</strong></article>
    <article class="report-stat-card"><span class="report-stat-icon">◉</span><small>Total pieces this month</small><strong>${fmt(monthlyPieces)}</strong></article>
    <article class="report-stat-card"><span class="report-stat-icon">↗</span><small>Average pieces per sack</small><strong>${fmt(monthlyAverage)}</strong></article>
  </section>
  <section class="report-alltime-strip"><span>All-time combined totals</span><b>${fmt(allSacks)} sacks</b><b>${fmt(allPieces)} pieces</b></section>
  ${productionError?"<div class='notice warn'>Production history could not be loaded: "+esc(productionError)+". Report totals may be incomplete.</div>":""}
  ${notebookError?"<div class='notice warn'>Notebook history could not be loaded: "+esc(notebookError)+". Report totals may be incomplete.</div>":""}
  <section class="piece-weight-report card"><div class="piece-weight-report-title"><div><div class="eyebrow">DAILY BREAKDOWN</div><h2>${esc(monthLabel(selectedMonth))}: sacks &amp; pieces</h2><p>Formal production records take priority for a date with saved production. Notebook counts fill dates without production, so a day is never counted twice.</p></div><span class="piece-weight-period">${fmt(monthDaily.length)} days</span></div>
    <div class="piece-weight-overview"><div><small>Days with records</small><strong>${fmt(monthDaily.length)}</strong></div><div><small>Sacks total</small><strong>${fmt(monthlySacks)}</strong></div><div><small>Pieces total</small><strong>${fmt(monthlyPieces)}</strong></div></div>
    <div class="piece-weight-note"><span>ⓘ</span><p>Today’s Production form is linked automatically. The saved production record is used as the daily source when available; notebook records remain available as a comparison.</p></div>
    <div class="piece-weight-day-list">${cards||"<div class='empty'>No production or notebook entries found for "+esc(monthLabel(selectedMonth))+". Enter production today or choose another month.</div>"}</div>
  </section>
  <section class="card report-production-history"><div class="report-section-heading"><div><div class="eyebrow">DAILY TOTALS</div><h2>Production &amp; notebook history</h2></div><span class="report-section-count">${fmt(monthDaily.length)} days</span></div><div class="table-wrap"><table><thead><tr><th>Date</th><th>Sacks</th><th>Total pieces</th><th>Source</th></tr></thead><tbody>${historyRows||"<tr><td colspan='4' class='empty'>No daily entries for this month.</td></tr>"}</tbody></table></div></section>`;
  p.querySelector('#refreshReports')?.addEventListener('click',event=>{
    event.currentTarget.disabled=true;event.currentTarget.textContent='↻ Refreshing…';
    renderReports(p);
  });
  p.querySelector('#reportMonthSelect')?.addEventListener('change',event=>{
    p.dataset.reportMonth=event.target.value;
    renderReports(p);
  });
}
async function renderSales(p){
  if(!currentUser||!['admin','sales'].includes(currentUser.role)){p.innerHTML="<div class='card'><h2>Sales</h2><div class='alert error'>Sales access only.</div></div>";return;}
  const month=p.dataset.salesMonth||today().slice(0,7);
  const parts=month.split('-').map(Number),year=parts[0],monthNo=parts[1];
  const from=month+'-01',to=monthNo===12?String(year+1)+'-01-01':String(year)+'-'+String(monthNo+1).padStart(2,'0')+'-01';
  const defaultDate=month===today().slice(0,7)?today():from;
  let rows=[],dispatches=[],dataError='';
  if(isDemo){
    db.salesRecords=db.salesRecords||[];db.naanDispatches=db.naanDispatches||[];
    rows=db.salesRecords.filter(x=>String(x.sale_date||x.saleDate).startsWith(month)).sort((x,y)=>String(y.sale_date||y.saleDate).localeCompare(String(x.sale_date||x.saleDate)));
    dispatches=db.naanDispatches.filter(x=>x.status==='dispatched');
  }else{
    const [salesResult,dispatchResult]=await Promise.all([
      supabase.from('sales_records').select('id,sale_date,customer_name,product_name,quantity_pieces,unit_price,total_amount,paid_amount,payment_method,dispatch_id,notes,created_by,created_at').gte('sale_date',from).lt('sale_date',to).order('sale_date',{ascending:false}).order('created_at',{ascending:false}).limit(1000),
      supabase.from('naan_dispatches').select('id,dispatch_date,recipient_name,sack_count,total_pieces,status').eq('status','dispatched').order('dispatch_date',{ascending:false}).limit(300)
    ]);
    if(salesResult.error)dataError=friendlyError(salesResult.error);else rows=salesResult.data||[];
    if(!dispatchResult.error)dispatches=dispatchResult.data||[];
  }
  const curr=String(appSettings.currency||'KGS');
  const currencyFmt=value=>{try{return new Intl.NumberFormat(dateLocale(),{style:'currency',currency:curr,maximumFractionDigits:2}).format(Number(value||0));}catch{return curr+' '+money(value);}};
  const amount=row=>Number(row.total_amount??(Number(row.quantity_pieces||row.quantityPieces||0)*Number(row.unit_price||row.unitPrice||0)))||0;
  const paid=row=>Number(row.paid_amount??row.paidAmount)||0;
  const pieces=row=>Number(row.quantity_pieces??row.quantityPieces)||0;
  const totalSales=rows.reduce((sum,row)=>sum+amount(row),0);
  const totalPaid=rows.reduce((sum,row)=>sum+paid(row),0);
  const totalDue=Math.max(0,totalSales-totalPaid);
  const totalPieces=rows.reduce((sum,row)=>sum+pieces(row),0);
  const statusOf=row=>paid(row)>=amount(row)-0.005?'Paid':paid(row)>0?'Part paid':'Unpaid';
  const dispatchOptions=dispatches.map(row=>'<option value="'+esc(row.id)+'">'+esc(String(row.dispatch_date||'').slice(0,10))+' · '+esc(row.recipient_name||'Recipient')+' · '+fmt(row.sack_count)+' sacks</option>').join('');
  const history=rows.map(row=>{
    const id=String(row.id||'');
    const saleDate=String(row.sale_date||row.saleDate||'').slice(0,10);
    const customer=row.customer_name||row.customerName||'Walk-in';
    const product=row.product_name||row.productName||'Leposhka';
    const qty=pieces(row),unitPrice=Number(row.unit_price??row.unitPrice)||0,amountValue=amount(row),paidValue=paid(row);
    const canManage=currentUser.role==='admin'||String(row.created_by||'')===String(currentUser.id);
    const actions=canManage?'<div class="workflow-row-actions"><button type="button" class="btn secondary" data-sale-edit="'+esc(id)+'">Edit</button><button type="button" class="btn danger" data-sale-delete="'+esc(id)+'">Delete</button></div>':'<span class="small">Read only</span>';
    return '<tr><td>'+esc(saleDate)+'</td><td><b>'+esc(customer)+'</b><small class="table-secondary">'+esc(product)+'</small></td><td>'+fmt(qty)+'</td><td>'+currencyFmt(unitPrice)+'</td><td><b>'+currencyFmt(amountValue)+'</b></td><td>'+currencyFmt(paidValue)+'<small class="table-secondary">Due '+currencyFmt(Math.max(0,amountValue-paidValue))+'</small></td><td><span class="workflow-status-pill '+statusOf(row).toLowerCase().replace(/ /g,'-')+'">'+statusOf(row)+'</span></td><td>'+actions+'</td></tr>';
  }).join('');
  p.innerHTML='<div class="page-head workflow-page-head"><div><div class="eyebrow">DAILY CASHFLOW</div><h1>'+esc(siteText('salesTitle','Sales'))+'</h1><p>'+esc(siteText('salesSubtitle','Record Leposhka sales, money collected and unpaid balances. Totals update from saved sales.'))+'</p></div><span class="settings-admin-pill">'+(currentUser.role==='admin'?'Admin workspace':'Sales workspace')+'</span></div>'+
    '<section class="report-month-toolbar card"><div><span class="report-month-icon">↗</span><div><b>Sales report</b><small>Monthly totals from saved sales entries</small></div></div><label for="salesMonth">Report month<input id="salesMonth" type="month" value="'+esc(month)+'"></label></section>'+
    '<section class="report-production-summary workflow-kpi-grid"><article class="report-stat-card"><span class="report-stat-icon">₸</span><small>Sales total</small><strong>'+currencyFmt(totalSales)+'</strong></article><article class="report-stat-card"><span class="report-stat-icon">✓</span><small>Collected</small><strong>'+currencyFmt(totalPaid)+'</strong></article><article class="report-stat-card"><span class="report-stat-icon">!</span><small>Outstanding</small><strong>'+currencyFmt(totalDue)+'</strong></article></section>'+
    '<section class="workflow-summary-strip"><span>'+fmt(rows.length)+' sales entries</span><b>'+fmt(totalPieces)+' pieces sold</b></section>'+
    (dataError?'<div class="notice warn" role="alert">Could not load sales: '+esc(dataError)+'</div>':'')+
    '<section class="card workflow-editor-card"><div class="report-section-heading"><div><div class="eyebrow">ENTRY FORM</div><h2 id="saleFormTitle">Record a sale</h2><p>Amount is calculated automatically from pieces × unit price.</p></div></div><div id="salesFormError" class="alert error" hidden></div><div class="workflow-form-grid" id="salesForm">'+
      '<div class="field"><label for="saleDate">Sale date *</label><input id="saleDate" type="date" max="'+today()+'" value="'+defaultDate+'"></div>'+
      '<div class="field"><label for="saleCustomer">Customer / buyer *</label><input id="saleCustomer" maxlength="120" placeholder="Walk-in customer or name" value="Walk-in"></div>'+
      '<div class="field"><label for="saleProduct">Product *</label><input id="saleProduct" maxlength="80" value="Leposhka"></div>'+
      '<div class="field"><label for="salePieces">Pieces sold *</label><input id="salePieces" type="number" min="1" step="1" value="1"></div>'+
      '<div class="field"><label for="salePrice">Price per piece ('+esc(curr)+') *</label><input id="salePrice" type="number" min="0" step="0.01" value="0"></div>'+
      '<div class="field"><label for="salePaid">Amount collected ('+esc(curr)+')</label><input id="salePaid" type="number" min="0" step="0.01" value="0"></div>'+
      '<div class="field"><label for="salePaymentMethod">Payment method</label><select id="salePaymentMethod"><option value="cash">Cash</option><option value="transfer">Bank transfer</option><option value="credit">Credit / pay later</option><option value="other">Other</option></select></div>'+
      '<div class="field"><label for="saleDispatch">Link dispatched order (optional)</label><select id="saleDispatch"><option value="">No dispatch linked</option>'+dispatchOptions+'</select></div>'+
    '</div><div class="workflow-calculation"><span>Calculated sale total</span><strong id="saleTotalPreview">'+currencyFmt(0)+'</strong><small id="saleDuePreview">Outstanding: '+currencyFmt(0)+'</small></div><div class="workflow-form-actions"><button type="button" class="btn secondary" id="saleCancelEdit" hidden>Cancel edit</button><button type="button" class="btn primary" id="saleSave">＋ Save sale</button></div></section>'+
    '<section class="card workflow-history-card"><div class="report-section-heading"><div><div class="eyebrow">SAVED RECORDS</div><h2>'+esc(monthLabelForWorkflow(month))+' sales</h2></div><div class="workflow-row-actions"><button type="button" class="btn secondary" id="saleExport">Export CSV</button><button type="button" class="btn secondary" id="saleRefresh">↻ Refresh</button></div></div><div class="table-wrap"><table><thead><tr><th>Date</th><th>Customer / product</th><th>Pieces</th><th>Unit price</th><th>Total</th><th>Paid / due</th><th>Status</th><th>Actions</th></tr></thead><tbody>'+ (history||'<tr><td colspan="8" class="empty">No sales saved for this month yet.</td></tr>')+'</tbody></table></div></section>';
  let editingId='';
  const el=id=>p.querySelector('#'+id);
  const calculate=()=>{const qty=Number(el('salePieces').value||0),price=Number(el('salePrice').value||0),collected=Number(el('salePaid').value||0),saleTotal=qty*price;el('saleTotalPreview').textContent=currencyFmt(saleTotal);el('saleDuePreview').textContent='Outstanding: '+currencyFmt(Math.max(0,saleTotal-collected));};
  ['salePieces','salePrice','salePaid'].forEach(id=>el(id).addEventListener('input',calculate));
  el('salesMonth').addEventListener('change',()=>{p.dataset.salesMonth=el('salesMonth').value||today().slice(0,7);renderSales(p);});
  const resetForm=()=>{editingId='';el('saleDate').value=defaultDate;el('saleCustomer').value='Walk-in';el('saleProduct').value='Leposhka';el('salePieces').value='1';el('salePrice').value='0';el('salePaid').value='0';el('salePaymentMethod').value='cash';el('saleDispatch').value='';el('saleFormTitle').textContent='Record a sale';el('saleSave').textContent='＋ Save sale';el('saleCancelEdit').hidden=true;el('salesFormError').hidden=true;calculate();};
  el('saleCancelEdit').addEventListener('click',resetForm);
  el('saleSave').addEventListener('click',async()=>{
    const date=el('saleDate').value,customer=el('saleCustomer').value.trim(),product=el('saleProduct').value.trim(),qty=Number(el('salePieces').value),price=Number(el('salePrice').value),collected=Number(el('salePaid').value),total=qty*price;
    const note='',method=el('salePaymentMethod').value,dispatchId=el('saleDispatch').value||null;
    const err=el('salesFormError');
    const fail=msg=>{err.hidden=false;err.textContent=msg;};
    if(!date||date>today()){fail('Choose today or a past sale date.');return;}
    if(!customer||!product||!Number.isInteger(qty)||qty<1){fail('Enter a customer, product and whole-piece quantity greater than zero.');return;}
    if(!Number.isFinite(price)||price<0||!Number.isFinite(collected)||collected<0||collected>total+0.005){fail('Price and collected amount must be valid; collected cannot exceed the calculated total.');return;}
    el('saleSave').disabled=true;err.hidden=true;
    const payload={sale_date:date,customer_name:customer,product_name:product,quantity_pieces:qty,unit_price:Number(price.toFixed(2)),paid_amount:Number(collected.toFixed(2)),payment_method:method,dispatch_id:dispatchId,notes:note||null};
    try{
      if(isDemo){
        db.salesRecords=db.salesRecords||[];
        if(editingId){const index=db.salesRecords.findIndex(row=>String(row.id)===editingId);if(index<0)throw new Error('Sale not found');db.salesRecords[index]={...db.salesRecords[index],...payload};}
        else db.salesRecords.push({id:uid(),...payload,total_amount:total,created_by:currentUser.id,created_at:new Date().toISOString()});
        saveDemo();
      }else{
        let result;
        if(editingId)result=await supabase.from('sales_records').update(payload).eq('id',editingId);
        else result=await supabase.from('sales_records').insert({...payload,created_by:currentUser.id});
        if(result.error)throw result.error;
      }
      p.dataset.salesMonth=date.slice(0,7);await renderSales(p);showToast(editingId?'Sale updated.':'Sale saved.','success');
    }catch(error){fail(friendlyError(error));el('saleSave').disabled=false;}
  });
  p.querySelectorAll('[data-sale-edit]').forEach(button=>button.addEventListener('click',()=>{
    const row=rows.find(item=>String(item.id)===button.dataset.saleEdit);if(!row)return;
    editingId=String(row.id);el('saleDate').value=String(row.sale_date||row.saleDate).slice(0,10);el('saleCustomer').value=row.customer_name||row.customerName||'';el('saleProduct').value=row.product_name||row.productName||'Leposhka';el('salePieces').value=pieces(row);el('salePrice').value=Number(row.unit_price??row.unitPrice)||0;el('salePaid').value=paid(row);el('salePaymentMethod').value=row.payment_method||row.paymentMethod||'cash';el('saleDispatch').value=row.dispatch_id||'';el('saleFormTitle').textContent='Edit sale entry';el('saleSave').textContent='✓ Save changes';el('saleCancelEdit').hidden=false;calculate();el('salesForm').scrollIntoView({behavior:'smooth',block:'start'});
  }));
  p.querySelectorAll('[data-sale-delete]').forEach(button=>button.addEventListener('click',async()=>{
    const row=rows.find(item=>String(item.id)===button.dataset.saleDelete);if(!row)return;
    if(appSettings.confirmDestructiveActions&& !window.confirm('Delete this sale entry? This cannot be undone.'))return;
    button.disabled=true;
    try{if(isDemo){db.salesRecords=(db.salesRecords||[]).filter(item=>String(item.id)!==String(row.id));saveDemo();}else{const {error}=await supabase.from('sales_records').delete().eq('id',row.id);if(error)throw error;}await renderSales(p);showToast('Sale entry deleted.','success');}
    catch(error){showToast(friendlyError(error),'error');button.disabled=false;}
  }));
  el('saleRefresh').addEventListener('click',()=>renderSales(p));
  el('saleExport').addEventListener('click',()=>{
    const columns=['sale_date','customer_name','product_name','quantity_pieces','unit_price','total_amount','paid_amount','payment_method','dispatch_id','notes'];
    const cell=value=>'"'+String(value??'').replace(/"/g,'""')+'"';
    const csv=[columns.join(','),...rows.map(row=>columns.map(key=>cell(row[key])).join(','))].join('\r\n');
    const url=URL.createObjectURL(new Blob(['\ufeff',csv],{type:'text/csv;charset=utf-8;'})),link=document.createElement('a');link.href=url;link.download='doughflow-sales-'+month+'.csv';document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
  });
  calculate();
}

async function renderNaan(p){
  if(!currentUser||!['admin','naan'].includes(currentUser.role)){p.innerHTML="<div class='card'><h2>Naan / Leposhka</h2><div class='alert error'>Naan workflow access only.</div></div>";return;}
  const month=p.dataset.dispatchMonth||today().slice(0,7);
  const part=month.split('-').map(Number),year=part[0],monthNo=part[1],from=month+'-01',to=monthNo===12?String(year+1)+'-01-01':String(year)+'-'+String(monthNo+1).padStart(2,'0')+'-01';
  const defaultDate=month===today().slice(0,7)?today():from;
  let rows=[],capacities=[],dataError='';
  if(isDemo){
    db.naanDispatches=db.naanDispatches||[];db.productions=db.productions||[];
    rows=db.naanDispatches.filter(x=>String(x.dispatch_date||x.dispatchDate).startsWith(month)).sort((x,y)=>String(y.dispatch_date||y.dispatchDate).localeCompare(String(x.dispatch_date||x.dispatchDate)));
    const byProductionDate=new Map();
    db.productions.forEach(r=>{
      const date=String(r.date||r.production_date||'');if(!date)return;
      if(!byProductionDate.has(date))byProductionDate.set(date,{production_date:date,produced_sacks:0,produced_pieces:0,reserved_sacks:0,reserved_pieces:0});
      const cap=byProductionDate.get(date);cap.produced_sacks+=Number((r.mishokCount??r.mishok_count)||0);cap.produced_pieces+=(r.batches||r.production_batches||[]).reduce((sum,b)=>sum+Number(b.pieces||0),0);
    });
    (db.naanDispatches||[]).filter(d=>['prepared','dispatched'].includes(d.status)).forEach(d=>{
      const date=String(d.source_production_date||d.sourceProductionDate||d.dispatch_date||d.dispatchDate||'');const cap=byProductionDate.get(date);if(cap){cap.reserved_sacks+=Number((d.sack_count??d.sackCount)||0);cap.reserved_pieces+=Number((d.total_pieces??d.totalPieces)||0);}
    });
    capacities=[...byProductionDate.values()].map(x=>({...x,remaining_sacks:Math.max(0,x.produced_sacks-x.reserved_sacks),remaining_pieces:Math.max(0,x.produced_pieces-x.reserved_pieces)})).sort((x,y)=>y.production_date.localeCompare(x.production_date));
  }else{
    const [dispatchResult,capacityResult]=await Promise.all([
      supabase.from('naan_dispatches').select('id,dispatch_date,source_production_date,recipient_name,sack_count,total_pieces,vehicle_registration,driver_name,status,notes,created_by,created_at,updated_at').gte('dispatch_date',from).lt('dispatch_date',to).order('dispatch_date',{ascending:false}).order('created_at',{ascending:false}).limit(1000),
      supabase.rpc('available_production_for_dispatch',{})
    ]);
    if(dispatchResult.error)dataError=friendlyError(dispatchResult.error);else rows=dispatchResult.data||[];
    if(capacityResult.error)dataError=dataError||friendlyError(capacityResult.error);else capacities=capacityResult.data||[];
  }
  const preferredSourceDate=p.dataset.dispatchSourceDate||today();
  const selectedSourceDate=capacities.some(x=>x.production_date===preferredSourceDate)?preferredSourceDate:(capacities.some(x=>x.production_date===today())?today():(capacities[0]?.production_date||today()));
  p.dataset.dispatchSourceDate=selectedSourceDate;
  const selectedCapacity=capacities.find(x=>x.production_date===selectedSourceDate);
  const sourceDateOptions=capacities.map(x=>'<option value="'+esc(x.production_date)+'" '+(x.production_date===selectedSourceDate?'selected':'')+'>'+esc(x.production_date)+' · '+fmt(x.remaining_sacks)+' sacks / '+fmt(x.remaining_pieces)+' pieces available</option>').join('');
  const sacks=rows.filter(row=>(row.status||'')==='dispatched').reduce((sum,row)=>sum+Number(row.sack_count||0),0);
  const piecesOut=rows.filter(row=>(row.status||'')==='dispatched').reduce((sum,row)=>sum+Number(row.total_pieces||row.totalPieces||0),0);
  const pending=rows.filter(row=>(row.status||'prepared')==='prepared').length;
  const history=rows.map(row=>{
    const id=String(row.id),date=String(row.dispatch_date||row.dispatchDate||'').slice(0,10),status=row.status||'prepared';
    const canDelete=currentUser.role==='admin'||(currentUser.role==='naan'&&row.created_by===currentUser.id&&status==='prepared');
    const canEdit=currentUser.role==='admin'||(currentUser.role==='naan'&&row.created_by===currentUser.id);
    const statusLabel={prepared:'Prepared',dispatched:'Dispatched',returned:'Returned',cancelled:'Cancelled'}[status]||status;
    return '<tr><td>'+esc(date)+'</td><td><b>'+esc(row.recipient_name||row.recipientName||'')+'</b><small class="table-secondary">Production '+esc(row.source_production_date||row.sourceProductionDate||date)+' · '+esc(row.vehicle_registration||row.vehicleRegistration||'')+(row.driver_name||row.driverName?' · '+esc(row.driver_name||row.driverName):'')+'</small></td><td>'+fmt(row.sack_count||row.sackCount)+'</td><td>'+fmt(row.total_pieces||row.totalPieces)+'</td><td><span class="workflow-status-pill '+status+'">'+statusLabel+'</span></td><td><div class="workflow-row-actions">'+(canEdit?'<button type="button" class="btn secondary" data-dispatch-edit="'+esc(id)+'">Edit</button>':'')+(canDelete?'<button type="button" class="btn danger" data-dispatch-delete="'+esc(id)+'">Delete</button>':'')+'</div></td></tr>';
  }).join('');
  p.innerHTML='<div class="page-head workflow-page-head"><div><div class="eyebrow">LEPOSHKA FLOW</div><h1>'+esc(siteText('naanTitle','Naan / Leposhka'))+'</h1><p>'+esc(siteText('naanSubtitle','Prepare and track dispatches by date, recipient, sacks and piece count.'))+'</p></div><span class="settings-admin-pill">'+(currentUser.role==='admin'?'Admin workspace':'Dispatch workspace')+'</span></div>'+
    '<section class="report-month-toolbar card"><div><span class="report-month-icon">◈</span><div><b>Dispatch report</b><small>Track what is prepared, sent and returned</small></div></div><label for="dispatchMonth">Report month<input id="dispatchMonth" type="month" value="'+esc(month)+'"></label></section>'+
    '<section class="report-production-summary workflow-kpi-grid"><article class="report-stat-card"><span class="report-stat-icon">▤</span><small>Sacks dispatched</small><strong>'+fmt(sacks)+'</strong></article><article class="report-stat-card"><span class="report-stat-icon">◉</span><small>Pieces dispatched</small><strong>'+fmt(piecesOut)+'</strong></article><article class="report-stat-card"><span class="report-stat-icon">…</span><small>Awaiting dispatch</small><strong>'+fmt(pending)+'</strong></article></section>'+
    '<section class="naan-capacity-card"><div><span class="eyebrow">AVAILABLE PRODUCTION</span><h2 id="dispatchCapacityDate">'+(selectedCapacity?esc(selectedSourceDate):'No completed production found')+'</h2><p id="dispatchCapacityText">'+(selectedCapacity?'Produced '+fmt(selectedCapacity.produced_sacks)+' sacks / '+fmt(selectedCapacity.produced_pieces)+' pieces. Reserved: '+fmt(selectedCapacity.reserved_sacks)+' sacks / '+fmt(selectedCapacity.reserved_pieces)+' pieces.':'Complete a Production entry before preparing a dispatch.')+'</p></div><div class="naan-capacity-number"><small>Pieces left</small><strong id="dispatchCapacityRemaining">'+fmt(selectedCapacity?.remaining_pieces||0)+'</strong></div></section>'+
    (dataError?'<div class="notice warn" role="alert">Could not load dispatches: '+esc(dataError)+'</div>':'')+
    '<section class="card workflow-editor-card"><div class="report-section-heading"><div><div class="eyebrow">DISPATCH ENTRY</div><h2 id="dispatchFormTitle">Prepare a dispatch</h2><p>Use piece counts, not grams. Mark a dispatch as sent only when it has left the bakery.</p></div></div><div id="dispatchFormError" class="alert error" hidden></div><div class="workflow-form-grid" id="dispatchForm">'+
      '<div class="field"><label for="dispatchDate">Dispatch date *</label><input id="dispatchDate" type="date" max="'+today()+'" value="'+defaultDate+'"></div>'+
      '<div class="field"><label for="dispatchSourceDate">Source production date *</label><select id="dispatchSourceDate" '+(capacities.length?'':'disabled')+'>'+sourceDateOptions+'</select></div>'+
      '<div class="field"><label for="dispatchRecipient">Recipient / customer *</label><input id="dispatchRecipient" maxlength="120" placeholder="Shop, customer or delivery point"></div>'+
      '<div class="field"><label for="dispatchSacks">Sacks (may include 0.5) *</label><input id="dispatchSacks" type="number" min="0.5" step="0.5" value="1"></div>'+
      '<div class="field"><label for="dispatchPieces">Total pieces in dispatch *</label><input id="dispatchPieces" type="number" min="1" step="1" value="'+Math.min(260,Number(selectedCapacity?.remaining_pieces||260))+'"></div>'+
      '<div class="field"><label for="dispatchVehicle">Vehicle registration</label><input id="dispatchVehicle" maxlength="30" placeholder="Optional plate / van ID"></div>'+
      '<div class="field"><label for="dispatchDriver">Driver / responsible person</label><input id="dispatchDriver" maxlength="100" placeholder="Optional name"></div>'+
      '<div class="field"><label for="dispatchStatus">Status</label><select id="dispatchStatus"><option value="prepared">Prepared</option><option value="dispatched">Dispatched</option><option value="returned">Returned</option><option value="cancelled">Cancelled</option></select></div>'+
      '<div class="field workflow-form-span"><label for="dispatchNotes">Notes / reference</label><input id="dispatchNotes" maxlength="500" placeholder="Optional delivery note"></div>'+
    '</div><div class="workflow-form-actions"><button type="button" class="btn secondary" id="dispatchCancelEdit" hidden>Cancel edit</button><button type="button" class="btn primary" id="dispatchSave">＋ Save dispatch</button></div></section>'+
    '<section class="card workflow-history-card"><div class="report-section-heading"><div><div class="eyebrow">DISPATCH HISTORY</div><h2>'+esc(monthLabelForWorkflow(month))+' dispatches</h2></div><div class="workflow-row-actions"><button type="button" class="btn secondary" id="dispatchExport">Export CSV</button><button type="button" class="btn secondary" id="dispatchRefresh">↻ Refresh</button></div></div><div class="table-wrap"><table><thead><tr><th>Date</th><th>Recipient / vehicle</th><th>Sacks</th><th>Pieces</th><th>Status</th><th>Actions</th></tr></thead><tbody>'+(history||'<tr><td colspan="6" class="empty">No dispatches saved for this month.</td></tr>')+'</tbody></table></div></section>';
  let editingId='';
  const el=id=>p.querySelector('#'+id),err=el('dispatchFormError');
  const updateCapacityPreview=()=>{
    const source=el('dispatchSourceDate').value,cap=capacities.find(x=>x.production_date===source),old=rows.find(x=>String(x.id)===editingId);
    let availableSacks=Number(cap?.remaining_sacks||0),availablePieces=Number(cap?.remaining_pieces||0);
    if(old&&String(old.source_production_date||old.sourceProductionDate||old.dispatch_date)===source&&['prepared','dispatched'].includes(old.status)){
      availableSacks+=Number((old.sack_count??old.sackCount)||0);availablePieces+=Number((old.total_pieces??old.totalPieces)||0);
    }
    el('dispatchCapacityDate').textContent=cap?source:'No completed production found';
    el('dispatchCapacityText').textContent=cap?'Produced '+fmt(cap.produced_sacks)+' sacks / '+fmt(cap.produced_pieces)+' pieces. Available for this dispatch: '+fmt(availableSacks)+' sacks / '+fmt(availablePieces)+' pieces.':'Complete a Production entry before preparing a dispatch.';
    el('dispatchCapacityRemaining').textContent=fmt(availablePieces);
    el('dispatchSave').disabled=!cap;
  };
  el('dispatchSourceDate').addEventListener('change',()=>{p.dataset.dispatchSourceDate=el('dispatchSourceDate').value;updateCapacityPreview();});
  el('dispatchMonth').addEventListener('change',()=>{p.dataset.dispatchMonth=el('dispatchMonth').value||today().slice(0,7);renderNaan(p);});
  const resetForm=()=>{editingId='';el('dispatchDate').value=defaultDate;el('dispatchSourceDate').value=selectedSourceDate;el('dispatchRecipient').value='';el('dispatchSacks').value='1';el('dispatchPieces').value='0';el('dispatchVehicle').value='';el('dispatchDriver').value='';el('dispatchStatus').value='prepared';el('dispatchNotes').value='';el('dispatchFormTitle').textContent='Prepare a dispatch';el('dispatchSave').textContent='＋ Save dispatch';el('dispatchCancelEdit').hidden=true;err.hidden=true;};
  el('dispatchCancelEdit').addEventListener('click',resetForm);
  el('dispatchSave').addEventListener('click',async()=>{
    const date=el('dispatchDate').value,sourceDate=el('dispatchSourceDate').value,recipient=el('dispatchRecipient').value.trim(),sacks=Number(el('dispatchSacks').value),pieces=Number(el('dispatchPieces').value),status=el('dispatchStatus').value,capacity=capacities.find(x=>x.production_date===sourceDate),old=rows.find(x=>String(x.id)===editingId);
    const fail=message=>{err.hidden=false;err.textContent=message;};
    if(!date||date>today()){fail('Choose today or a past date.');return;}
    if(!recipient||!sourceDate||!Number.isFinite(sacks)||sacks<=0||Math.abs(sacks*2-Math.round(sacks*2))>0.000001||!Number.isInteger(pieces)||pieces<=0){fail('Enter a recipient, source production date, valid half-sack increment and positive whole-piece total.');return;}
    if(status!=='cancelled'&&status!=='returned'){
      let availableSacks=Number(capacity?.remaining_sacks||0),availablePieces=Number(capacity?.remaining_pieces||0);
      if(old&&String(old.source_production_date||old.sourceProductionDate||old.dispatch_date)===sourceDate&&['prepared','dispatched'].includes(old.status)){
        availableSacks+=Number((old.sack_count??old.sackCount)||0);availablePieces+=Number((old.total_pieces??old.totalPieces)||0);
      }
      if(!capacity||sacks>availableSacks||pieces>availablePieces){fail('This dispatch exceeds available production for the selected date.');return;}
    }
    el('dispatchSave').disabled=true;err.hidden=true;
    const payload={dispatch_date:date,source_production_date:sourceDate,recipient_name:recipient,sack_count:sacks,total_pieces:pieces,vehicle_registration:el('dispatchVehicle').value.trim()||null,driver_name:el('dispatchDriver').value.trim()||null,status,notes:el('dispatchNotes').value.trim()||null};
    try{
      if(isDemo){
        db.naanDispatches=db.naanDispatches||[];
        if(editingId){const index=db.naanDispatches.findIndex(row=>String(row.id)===editingId);if(index<0)throw new Error('Dispatch not found');db.naanDispatches[index]={...db.naanDispatches[index],...payload};}
        else db.naanDispatches.push({id:uid(),...payload,created_by:currentUser.id,created_at:new Date().toISOString()});
        saveDemo();
      }else{
        const result=editingId?await supabase.from('naan_dispatches').update(payload).eq('id',editingId):await supabase.from('naan_dispatches').insert({...payload,created_by:currentUser.id});
        if(result.error)throw result.error;
      }
      p.dataset.dispatchMonth=date.slice(0,7);p.dataset.dispatchSourceDate=sourceDate;await renderNaan(p);showToast(editingId?'Dispatch updated.':'Dispatch saved.','success');
    }catch(error){fail(friendlyError(error));el('dispatchSave').disabled=false;}
  });
  p.querySelectorAll('[data-dispatch-edit]').forEach(button=>button.addEventListener('click',()=>{
    const row=rows.find(item=>String(item.id)===button.dataset.dispatchEdit);if(!row)return;
    editingId=String(row.id);el('dispatchDate').value=String(row.dispatch_date||row.dispatchDate).slice(0,10);el('dispatchSourceDate').value=String(row.source_production_date||row.sourceProductionDate||row.dispatch_date||row.dispatchDate).slice(0,10);el('dispatchRecipient').value=row.recipient_name||row.recipientName||'';el('dispatchSacks').value=Number(row.sack_count??row.sackCount)||1;el('dispatchPieces').value=Number(row.total_pieces??row.totalPieces)||0;el('dispatchVehicle').value=row.vehicle_registration||row.vehicleRegistration||'';el('dispatchDriver').value=row.driver_name||row.driverName||'';el('dispatchStatus').value=row.status||'prepared';el('dispatchNotes').value=row.notes||'';el('dispatchFormTitle').textContent='Edit dispatch';el('dispatchSave').textContent='✓ Save changes';el('dispatchCancelEdit').hidden=false;updateCapacityPreview();el('dispatchForm').scrollIntoView({behavior:'smooth',block:'start'});
  }));
  p.querySelectorAll('[data-dispatch-delete]').forEach(button=>button.addEventListener('click',async()=>{
    const row=rows.find(item=>String(item.id)===button.dataset.dispatchDelete);if(!row)return;
    if(appSettings.confirmDestructiveActions&&!window.confirm('Delete this dispatch record?'))return;
    button.disabled=true;
    try{if(isDemo){db.naanDispatches=(db.naanDispatches||[]).filter(item=>String(item.id)!==String(row.id));saveDemo();}else{const {error}=await supabase.from('naan_dispatches').delete().eq('id',row.id);if(error)throw error;}await renderNaan(p);showToast('Dispatch deleted.','success');}
    catch(error){showToast(friendlyError(error),'error');button.disabled=false;}
  }));
  el('dispatchRefresh').addEventListener('click',()=>renderNaan(p));
  updateCapacityPreview();
  el('dispatchExport').addEventListener('click',()=>{
    const columns=['dispatch_date','recipient_name','sack_count','total_pieces','vehicle_registration','driver_name','status','notes'];
    const cell=value=>'"'+String(value??'').replace(/"/g,'""')+'"';
    const csv=[columns.join(','),...rows.map(row=>columns.map(key=>cell(row[key])).join(','))].join('\r\n');
    const url=URL.createObjectURL(new Blob(['\ufeff',csv],{type:'text/csv;charset=utf-8;'})),link=document.createElement('a');link.href=url;link.download='doughflow-dispatch-'+month+'.csv';document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
  });
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


// Start the application after all modules and page containers are ready.
init().catch(error => {
  console.error('DoughFlow startup failed:', error);
  if (app) {
    app.innerHTML = '<main style="max-width:640px;margin:10vh auto;padding:24px;font:16px/1.5 system-ui;color:#20242b"><h1>DoughFlow could not start</h1><p>The app encountered a startup error. Check your connection, then reload this page.</p><button type="button" onclick="location.reload()" style="padding:12px 18px;border:0;border-radius:10px;background:#244f3b;color:white;font-weight:700">Reload DoughFlow</button></main>';
  }
});
