import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/+esm';
import './config.js';
import { LANGUAGES, getSavedLang, saveLang, languageOptions, t, applyTranslations } from './i18n.js';

const CFG = window.DOUGHFLOW_CONFIG || { supabaseUrl:'', supabaseAnonKey:'', appName:'DoughFlow' };
const isDemo = !(CFG.supabaseUrl && CFG.supabaseAnonKey);
const supabase = isDemo ? null : createClient(CFG.supabaseUrl, CFG.supabaseAnonKey);

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
const today=()=>{const d=new Date();const pad=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;}; const dateLocale=()=>lang==='ru'?'ru-RU':lang==='ky'?'ky-KG':'en-US'; const formatToday=()=>new Intl.DateTimeFormat(dateLocale(),{weekday:'short',month:'short',day:'numeric',year:'numeric'}).format(new Date());
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
let pinLocked = false;
let pinMode = 'unlock';
let pinStep = 'enter';
let pinAttempt = '';
let pinFirst = '';
let pinError = '';
let pinUnavailable = false;
let pinNoticeShown = false;
let pinReturnRoute = 'dashboard';
const PIN_LOCAL_PREFIX='doughflow_pin_v1:';
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


async function derivePinHash(pin,salt){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']);
 const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:120000,hash:'SHA-256'},key,256);
 return [...new Uint8Array(bits)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function saveLocalPin(userId,pin){
 const salt=[...crypto.getRandomValues(new Uint8Array(16))].map(b=>b.toString(16).padStart(2,'0')).join('');
 localStorage.setItem(PIN_LOCAL_PREFIX+userId,JSON.stringify({salt,hash:await derivePinHash(pin,salt),version:1}));
}
async function verifyLocalPin(userId,pin){
 try{const v=JSON.parse(localStorage.getItem(PIN_LOCAL_PREFIX+userId)||'null');return !!v&&await derivePinHash(pin,v.salt)===v.hash;}catch{return false;}
}
async function preparePinGate(){
 if(!currentUser){pinLocked=false;return;}
 pinLocked=true;pinMode='unlock';pinStep='enter';pinAttempt='';pinFirst='';pinError='';pinUnavailable=false;
 if(isDemo){
   let exists=!!localStorage.getItem(PIN_LOCAL_PREFIX+currentUser.id);
   if(!exists&&currentUser.role==='admin'){await saveLocalPin(currentUser.id,'1214');exists=true;}
   pinMode=exists?'unlock':'setup';return;
 }
 const {data:exists,error}=await supabase.rpc('my_pin_is_set');
 if(error){pinUnavailable=true;pinLocked=false;return;}
 if(!exists&&currentUser.role==='admin'){
   const {error:setError}=await supabase.rpc('set_my_pin',{p_pin:'1214'});
   if(setError){pinUnavailable=true;pinLocked=false;return;}
   pinMode='unlock';
 }else pinMode=exists?'unlock':'setup';
}
function pinGateHTML(){
 const setup=pinMode==='setup',change=pinMode==='change';
 let title=t('Enter your 4-digit PIN',lang),description=t('Your PIN protects this signed-in account on this device.',lang);
 if(setup){title=pinStep==='confirm'?t('Confirm your new PIN',lang):t('Create a 4-digit PIN',lang);description=t('Choose a private 4-digit PIN. Do not share it with coworkers.',lang);}
 else if(change&&pinStep==='verify'){title=t('Enter your current PIN',lang);description=t('Verify your current PIN before changing it.',lang);}
 else if(change&&pinStep==='confirm'){title=t('Confirm your new PIN',lang);description=t('Enter the new PIN again to confirm.',lang);}
 else if(change){title=t('Create a new PIN',lang);description=t('Choose a new private 4-digit PIN.',lang);}
 return `<div class="pin-portal"><div class="pin-backdrop"></div><div class="pin-card">
 <div class="pin-brand"><div class="pin-logo">${leposhkaIcon(48)}</div><div><b>DoughFlow</b><small>${t('Bakery control',lang)}</small></div><label class="pin-language">${languageFlag()}<select id="pinLanguageSelect" aria-label="${t('Language',lang)}">${languageOptions(lang)}</select></label></div>
 <div class="pin-orbit"><span class="pin-orbit-inner">${leposhkaIcon(70)}</span><span class="pin-orbit-spark">✦</span></div>
 <div class="pin-level-chip">${currentUser.role==='admin'?'👑':currentUser.role==='hamurchi'?'🥣':currentUser.role==='naan'?'🫓':'🪙'} ${esc(roleName(currentUser.role))}</div>
 <h1>${title}</h1><p class="pin-description">${description}</p>
 <input id="pinInput" class="pin-input-accessible" type="password" inputmode="numeric" autocomplete="one-time-code" maxlength="4" pattern="[0-9]{4}" aria-label="${t('PIN digits',lang)}">
 <div class="pin-dots" id="pinDots">${[0,1,2,3].map(i=>`<span class="pin-dot ${i<pinAttempt.length?'filled':''}"></span>`).join('')}</div><div class="pin-error" id="pinError" role="alert">${esc(pinError)}</div>
 <div class="pin-keypad">${[1,2,3,4,5,6,7,8,9].map(n=>`<button type="button" class="pin-key" data-pin-digit="${n}">${n}</button>`).join('')}<button type="button" class="pin-key pin-key-muted" id="pinClear">${t('Clear',lang)}</button><button type="button" class="pin-key" data-pin-digit="0">0</button><button type="button" class="pin-key pin-key-muted" id="pinBackspace" aria-label="${t('Delete last digit',lang)}">⌫</button></div>
 <button type="button" class="pin-switch" id="pinSwitchAccount">${t('Sign out and switch account',lang)}</button></div><div class="pin-footer">🇰🇬 Bishkek · ${t('Сделано Али',lang)}</div></div>`;
}
function updatePinGateUI(){
 const dots=document.getElementById('pinDots');if(dots)dots.querySelectorAll('.pin-dot').forEach((el,i)=>el.classList.toggle('filled',i<pinAttempt.length));
 const input=document.getElementById('pinInput');if(input&&input.value!==pinAttempt)input.value=pinAttempt;
 const error=document.getElementById('pinError');if(error)error.textContent=pinError;
}
function resetPinAttempt(message=''){
 pinAttempt='';pinError=message;updatePinGateUI();const input=document.getElementById('pinInput');if(input){input.value='';input.focus({preventScroll:true);}
}
async function savePinForCurrentUser(pin){
 if(isDemo){await saveLocalPin(currentUser.id,pin);return true;}
 const {error}=await supabase.rpc('set_my_pin',{p_pin:pin});if(error){pinError=friendlyError(error);updatePinGateUI();return false;}return true;
}
async function verifyPinForCurrentUser(pin){
 if(isDemo)return verifyLocalPin(currentUser.id,pin);
 const {data,error}=await supabase.rpc('verify_my_pin',{p_pin:pin});if(error){pinError=friendlyError(error);return false;}return data===true;
}
async function finishPinEntry(pin){
 pinAttempt='';
 if(pinMode==='setup'||(pinMode==='change'&&pinStep!=='verify')){
  if(pinStep==='create'){pinFirst=pin;pinStep='confirm';pinError='';renderPinGateContent();return;}
  if(pinFirst!==pin){pinFirst='';pinStep='create';resetPinAttempt(t('PINs do not match. Start again.',lang));return;}
  if(!await savePinForCurrentUser(pin))return;
  pinLocked=false;pinMode='unlock';pinStep='enter';pinFirst='';pinError='';showToast(t('PIN saved successfully.',lang),'success');render();return;
 }
 if(pinMode==='change'&&pinStep==='verify'){
  if(!await verifyPinForCurrentUser(pin)){resetPinAttempt(pinError||t('Incorrect PIN. Try again.',lang));return;}
  pinStep='create';pinError='';renderPinGateContent();return;
 }
 if(!await verifyPinForCurrentUser(pin)){resetPinAttempt(pinError||t('Incorrect PIN. Try again.',lang));return;}
 pinLocked=false;pinError='';pinAttempt='';pinMode='unlock';pinStep='enter';showToast(t('Welcome back!',lang),'success',1600);render();
}
function renderPinGateContent(){app.innerHTML=pinGateHTML();wirePinGate();applyCurrentLanguage();}
function wirePinGate(){
 const input=document.getElementById('pinInput');
 const commit=()=>{if(pinAttempt.length===4){const pin=pinAttempt;document.querySelectorAll('.pin-key').forEach(b=>b.disabled=true);setTimeout(()=>finishPinEntry(pin),80);}};
 document.querySelectorAll('[data-pin-digit]').forEach(b=>b.addEventListener('click',()=>{if(pinAttempt.length>=4)return;pinAttempt+=b.dataset.pinDigit;updatePinGateUI();commit();}));
 input?.addEventListener('input',()=>{pinAttempt=String(input.value||'').replace(/\\D/g,'').slice(0,4);updatePinGateUI();commit();});
 document.getElementById('pinBackspace')?.addEventListener('click',()=>{pinAttempt=pinAttempt.slice(0,-1);pinError='';updatePinGateUI();});
 document.getElementById('pinClear')?.addEventListener('click',()=>{pinAttempt='';pinError='';updatePinGateUI();});
 document.getElementById('pinLanguageSelect')?.addEventListener('change',e=>setLanguage(e.target.value));
 document.getElementById('pinSwitchAccount')?.addEventListener('click',async()=>{if(isDemo){db.session=null;currentUser=null;pinLocked=false;saveDemo();render();return;}await supabase.auth.signOut({scope:'local'});currentUser=null;pinLocked=false;pinError='';render();});
 input?.focus({preventScroll:true});
}
function startPinChange(){pinLocked=true;pinMode='change';pinStep='verify';pinAttempt='';pinFirst='';pinError='';render();}

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
        <div class="login-logo">${leposhkaIcon(42)}</div>
        <div><strong>DoughFlow</strong><small>${t('Bakery control',lang)}</small></div>
        <div class="login-lang">${languageFlag()} ${languageSwitcher()}</div>
      </div>
      <div class="login-main-card">
        <div class="login-badge">${leposhkaIcon(42)}</div>
        <div class="eyebrow login-eyebrow">${t('Kyrgyz bakery portal',lang)}</div>
        <h1>${t('Welcome back',lang)} 👋</h1>
        <p>${t('Enter your username and four-digit PIN.',lang)}</p>
        <form id="loginForm" class="modern-login-form pin-login-form">
          <div class="field">
            <label for="loginAlias">${t('Username',lang)}</label>
            <input required id="loginAlias" type="text" name="login" value="askat" placeholder="askat" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="32">
          </div>
          <div class="field">
            <label for="loginPin">${t('4-digit PIN',lang)}</label>
            <div class="pin-display-wrap">
              <input required id="loginPin" class="pin-input" type="password" name="pin" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="one-time-code" placeholder="••••" aria-describedby="pinHint">
              <button type="button" class="pin-visibility" id="togglePin" aria-label="${t('Show PIN',lang)}">◉</button>
            </div>
            <small id="pinHint" class="pin-hint">${t('Your PIN is personal. Five failed attempts temporarily lock the account.',lang)}</small>
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
    const username=String(document.getElementById('loginAlias')?.value||'').trim().toLowerCase();
    const pin=pinInput.value;
    if(!/^[a-z0-9][a-z0-9._-]{1,31}$/.test(username)||! /^\d{4}$/.test(pin)){
      pinError.textContent=t('Enter a valid username and four-digit PIN.',lang);return;
    }
    const submit=e.currentTarget.querySelector('button[type="submit"]');
    if(submit) submit.disabled=true;
    pinError.textContent='';
    try{
      if(isDemo){
        const user=(db.users||[]).find(u=>String(u.loginAlias||'').toLowerCase()===username);
        if(!user||!user.pin||user.pin!==pin){
          pinError.textContent=t('Username or PIN is incorrect',lang);return;
        }
        db.session={user:{id:user.id,name:user.name},role:user.role,lang:getSavedLang(user.id)};
        currentUser={id:user.id,name:user.name,role:user.role,lang:db.session.lang};
        lang=currentUser.lang;authError='';route='dashboard';saveDemo();render();return;
      }
      const endpoint=CFG.supabaseUrl.replace(/\/$/,'')+'/functions/v1/pin-login';
      const response=await fetch(endpoint,{
        method:'POST',
        headers:{'Content-Type':'application/json','apikey':CFG.supabaseAnonKey,'Authorization':'Bearer '+CFG.supabaseAnonKey},
        body:JSON.stringify({username,pin}),
        cache:'no-store'
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok){
        const key=response.status===429?'Too many attempts. Try again later.':(payload.error==='Username or PIN is incorrect'?'Username or PIN is incorrect':payload.error||'Username or PIN is incorrect');
        pinError.textContent=t(key,lang);
        return;
      }
      if(!payload.token_hash) throw new Error('Secure session token was not returned.');
      const {error}=await supabase.auth.verifyOtp({type:'magiclink',token_hash:payload.token_hash});
      if(error) throw error;
    }catch(error){
      pinError.textContent=friendlyError(error);
    }finally{
      if(submit) submit.disabled=false;
    }
  });
}
async function logout(){ if(isDemo){db.session=null;currentUser=null;authError='';lang=getSavedLang('guest');saveDemo();render();return;} await supabase.auth.signOut({scope:'local'}); }

function appShellHTML(){
  const items=navItems(currentUser.role);
  const initials=String(currentUser.name||'U').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
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
  const todaySummary=!isDemo?liveState.summaryToday:null;
  const totalSacks=todaySummary?Number(todaySummary.total_sacks):todayRuns.reduce((a,b)=>a+Number(isDemo?b.mishokCount:b.mishok_count),0);
  const totalPieces=todaySummary?Number(todaySummary.total_pieces):todayRuns.reduce((a,b)=>a+(isDemo?b.batches:(b.production_batches||[])).reduce((s,z)=>s+Number(z.pieces||0),0),0);
  const totalRuns=todaySummary?Number(todaySummary.run_count):todayRuns.length;
  const stockRows=STOCK_MATERIALS.map(m=>({...m,stock:getStock(m.code)}));
  const recipe=isDemo?db.recipe:liveState.recipe;
  const firstName=esc(currentUser.name.split(' ')[0]);
  const syncBanner=!isDemo&&liveState.syncError?"<div class='sync-banner' role='alert'>⚠️ <div><b>"+t('Data sync issue',lang)+"</b><small>"+t('Some data may be temporarily out of date.',lang)+"</small></div></div>":"";
  const recipeCards=(recipe?.items||[]).map(it=>"<div class='recipe-photo-card'><div class='recipe-visual "+esc(it.code)+"'><span>"+materialIcon(it.code)+"</span></div><b>"+esc(t(it.name,lang))+"</b><strong>"+fmt(it.qty)+" "+esc(it.unit)+"</strong></div>").join('');
  const stockCards=stockRows.map(m=>{
    const tag=currentUser.role==='admin'?'button':'div';
    const attrs=currentUser.role==='admin'?" type='button' data-stock-open='inventory'":'';
    const view=stockBreakdown(m,m.stock,lang);
    return "<"+tag+" class='stock-item"+(currentUser.role==='admin'?' stock-open':'')+"'"+attrs+"><div class='stock-item-icon "+esc(m.code)+"'>"+materialIcon(m.code)+"</div><div class='stock-item-copy'><b>"+esc(t(m.name,lang))+"</b><strong class='"+(m.stock<=0?'empty-stock':'')+"'>"+esc(view.primary)+(m.stock<=0?" <em>!</em>":"")+"</strong><small>"+esc(view.secondary)+"</small></div><span>›</span></"+tag+">";
  }).join('');
  p.innerHTML =
    "<section class='portal-hero'>"+
      "<div class='portal-hero-photo'></div><div class='portal-hero-shade'></div>"+
      "<div class='portal-hero-content'>"+
        "<div class='hero-topline'>"+
          "<div class='df-badge'>DF</div><div class='hero-brand'><b>DoughFlow</b><small>"+t('Bakery control',lang)+"</small></div><div class='hero-spacer'></div>"+
          "<label class='hero-language'><span>"+languageFlag()+"</span><select id='heroLanguageSelect' aria-label=\""+t('Language',lang)+"\">"+languageOptions(lang)+"</select><b>⌄</b></label>"+
          "<div class='hero-user'><span class='hero-avatar'>"+esc(String(currentUser.name||'A')[0].toUpperCase())+"</span><span><b class='no-translate'>"+esc(currentUser.name)+"</b><small>"+roleName(currentUser.role)+"</small></span></div>"+
        "</div>"+
        "<div class='hero-copy'><div class='hero-date'>🇰🇬 "+formatToday()+"</div><h1>"+t('Good day',lang)+", "+firstName+" <span>👋</span></h1><p>"+t('Let’s make great leposhka today!',lang)+"</p></div>"+
      "</div>"+
    "</section>"+
    syncBanner+
    "<section class='metric-grid'>"+
      "<div class='metric-card metric-green'><div class='metric-head'><span>🧺</span><b>"+t('Today’s Sacks',lang)+"</b></div><strong>"+fmt(totalSacks)+"</strong><i>▥</i></div>"+
      "<div class='metric-card metric-orange'><div class='metric-head'><span>🥯</span><b>"+t('Today’s Pieces',lang)+"</b></div><strong>"+fmt(totalPieces)+"</strong><i>◔</i></div>"+
      "<div class='metric-card metric-purple'><div class='metric-head'><span>▶</span><b>"+t('Production Runs',lang)+"</b></div><strong>"+totalRuns+"</strong><i>▥</i></div>"+
      "<div class='metric-card metric-blue'><div class='metric-head'><span>▦</span><b>"+t('Recipe Version',lang)+"</b></div><strong>v"+(db?.recipe?.version||liveState.recipe?.version||1)+"</strong><i>⟳</i></div>"+
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
    route='production';render();
    setTimeout(()=>{
      const input=document.getElementById('sackCount');
      if(input){input.value=selected||0;input.dispatchEvent(new Event('input',{bubbles:true}));}
    },0);
  };
  document.getElementById('dashboardStart')?.addEventListener('click',openProduction);
  document.querySelectorAll('[data-stock-open]').forEach(b=>b.addEventListener('click',()=>{route='inventory';render();}));
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
    inv.tx.push({id:uid(),dir:'out',qty,reason:'Production consumption',productionId,at:new Date().toISOString(),by:currentUser.name});
    db.inventory[item.code]=inv;
  });
}
function getStock(code){ if(isDemo) return Number(db?.inventory?.[code]?.stock||0); return Number(liveState.balances.find(x=>x.code===code)?.stock||0); }

function renderRecipe(p){
  const recipe=isDemo?db.recipe:liveState.recipe;
  if(!recipe){p.innerHTML='<div class="card"><h2>Recipe</h2><div class="alert warn">No active recipe found. Run the database seed SQL first.</div></div>';return;}
  p.innerHTML=`<div class="page-head"><div><h1>Recipe</h1><p>Working recipe per operational sack. Authorized production users can edit it.</p></div></div><div class="grid grid-2"><div class="card"><h2>v${recipe.version}</h2>${recipe.items.map((it)=>`<div class="field-row" style="align-items:end"><div class="field"><label>${esc(it.name)} (${esc(it.unit)})</label><input class="recipe-qty" data-code="${esc(it.code)}" type="number" step="0.001" value="${it.qty}"><div class="small">${esc(it.note||'')}</div></div><div class="field"><label>Current standard</label><div class="notice">${fmt(it.qty)} ${esc(it.unit)} / sack</div></div></div>`).join('')}<button class="btn primary" id="saveRecipe">Save as new recipe version</button></div><div class="card"><h2>Packaging rules</h2><div class="table-wrap"><table><thead><tr><th>Material</th><th>Purchase package</th></tr></thead><tbody>${STOCK_MATERIALS.map(m=>`<tr><td>${esc(m.name)}</td><td>${m.packages.map(x=>esc(x.label)).join('<br>')}</td></tr>`).join('')}</tbody></table></div><div class="notice" style="margin-top:14px">Water is a recipe input and is not tracked as stock. Salt supports 1 kg and 750 g packets. Yeast supports 500 g packets and 20-packet boxes. Oil uses 20 kg cartons.</div></div></div>`;
  document.getElementById('saveRecipe').addEventListener('click',async()=>{
    const items=recipe.items.map((it,i)=>({...it,qty:Number(document.querySelector(`.recipe-qty[data-code="${it.code}"]`).value),sort_order:i}));
    if(items.some(x=>!Number.isFinite(x.qty)||x.qty<0)){showToast(t('Recipe quantities must be valid non-negative numbers.',lang),'error');return;}
    if(isDemo){db.recipe.version+=1;db.recipe.updatedAt=new Date().toISOString();db.recipe.updatedBy=currentUser.name;db.recipe.items=items;saveDemo();showToast(`${t('Recipe saved as',lang)} v${db.recipe.version}.`,'success');render();}
    else {const {error}=await supabase.rpc('create_recipe_version',{p_items:items.map(x=>({code:x.code,qty:x.qty,unit:x.unit,note:x.note||'',sort_order:x.sort_order})),p_note:`Updated by ${currentUser.name}`});if(error){showToast(friendlyError(error),'error');return;}await refreshLiveState();showToast(`${t('Recipe saved as',lang)} v${liveState.recipe.version}.`,'success');render();}
  });
}

async function renderInventory(p){
  if(currentUser.role!=='admin'){p.innerHTML='<div class="card"><h2>Inventory</h2><div class="alert error">Admin access only.</div></div>';return;}
  if(!isDemo) await refreshLiveState();
  p.innerHTML=`<div class="page-head"><div><h1>${t('Inventory',lang)}</h1><p>${t('Current theoretical stock plus package-aware receiving.',lang)}</p></div><button class="btn primary" id="stockIn">+ ${t('Stock in',lang)}</button></div><div class="grid grid-3">${STOCK_MATERIALS.map(m=>{const v=stockBreakdown(m,getStock(m.code),lang);return `<div class="card stock-card-premium"><div class="kpi-label">${esc(t(m.name,lang))}</div><div class="kpi stock-primary">${esc(v.primary)}</div><div class="small stock-secondary">${esc(v.secondary)}</div></div>`;}).join('')}</div><div style="height:16px"></div><div class="card"><h2>${t('Material details',lang)}</h2><div class="table-wrap"><table><thead><tr><th>${t('Material',lang)}</th><th>${t('Stock',lang)}</th><th>${t('Package options',lang)}</th></tr></thead><tbody>${STOCK_MATERIALS.map(m=>{const v=stockBreakdown(m,getStock(m.code),lang);return `<tr><td>${esc(t(m.name,lang))}</td><td><b>${esc(v.primary)}</b><small class="table-secondary">${esc(v.secondary)}</small></td><td>${m.packages.map(x=>esc(packageUnit(m,x,lang))).join('<br>')}</td></tr>`;}).join('')}</tbody></table></div></div>`;
  document.getElementById('stockIn').addEventListener('click',()=>openStockModal());
}

function openStockModal(){
  const opts=STOCK_MATERIALS.map(m=>`<option value="${m.code}">${esc(t(m.name,lang))}</option>`).join('');
  modalRoot.innerHTML=`<div class="modal-backdrop show"><div class="modal"><div class="modal-head"><h2>${t('Receive stock',lang)}</h2><button id="closeModal">×</button></div><div class="field"><label>${t('Material',lang)}</label><select id="stockMaterial">${opts}</select></div><div id="packageChooser"></div><div class="field"><label>${t('Notes',lang)}</label><input id="stockNote" placeholder="${t('Supplier / delivery note',lang)}"></div><div class="modal-footer"><button class="btn secondary" id="cancelModal">${t('Cancel',lang)}</button><button class="btn primary" id="saveStock">${t('Add stock',lang)}</button></div></div></div>`;
  const update=()=>{const m=STOCK_MATERIALS.find(x=>x.code===document.getElementById('stockMaterial').value);document.getElementById('packageChooser').innerHTML=`<div class="field"><label>${t('Package',lang)}</label><select id="stockPackage">${m.packages.map((x,i)=>`<option value="${i}">${esc(packageUnit(m,x,lang))}</option>`).join('')} </select></div><div class="field"><label>${t('Number of packages',lang)}</label><input id="packageCount" type="number" min="0.001" step="1" value="1"></div><div class="small">${t('The system will convert package quantity into the inventory base unit.',lang)}</div>`;};
  update();document.getElementById('stockMaterial').addEventListener('change',update);document.getElementById('closeModal').addEventListener('click',closeModal);document.getElementById('cancelModal').addEventListener('click',closeModal);
  document.getElementById('saveStock').addEventListener('click',async()=>{const code=document.getElementById('stockMaterial').value;const m=STOCK_MATERIALS.find(x=>x.code===code);const pi=Number(document.getElementById('stockPackage').value);const count=Number(document.getElementById('packageCount').value||0);if(!(count>0))return;const qty=m.packages[pi].qty*count;const reason=document.getElementById('stockNote').value||'Stock received';if(isDemo){const inv=db.inventory[code];inv.stock+=qty;inv.tx.push({id:uid(),dir:'in',qty,packages:count,packageLabel:m.packages[pi].label,reason,at:new Date().toISOString(),by:currentUser.name});saveDemo();closeModal();render();}else{const {error}=await supabase.from('inventory_transactions').insert({material_code:code,direction:'in',qty_base:qty,package_count:count,package_label:m.packages[pi].label,reason,created_by:currentUser.id});if(error){showToast(friendlyError(error),'error');return;}await refreshLiveState();closeModal();render();}});
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
  if(currentUser.role!=='admin'){p.innerHTML='<div class="card"><h2>Users</h2><div class="alert error">Admin access only.</div></div>';return;}
  if(!isDemo) await refreshLiveState();
  const users=isDemo?db.users:liveState.users;
  p.innerHTML=`<div class="page-head"><div><h1>Users</h1><p>Four role model. User creation can be managed in Supabase Auth + profiles.</p></div></div><div class="card"><div class="table-wrap"><table><thead><tr><th>User</th><th>Role</th><th>Access</th></tr></thead><tbody>${users.map(u=>`<tr><td>${esc(isDemo?u.name:u.full_name)}</td><td><span class="status neutral">${roleName(u.role)}</span></td><td>${u.role==='admin'?'Full':'Role-limited'}</td></tr>`).join('')}</tbody></table></div></div>`;
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
}

init();
