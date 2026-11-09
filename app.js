'use strict';
const K='pickleMix.v1',$=s=>document.querySelector(s);
const LANG_KEY='pickleMix.language';
const LANGS={
 es:{home:'Inicio',party:'Partido',clubs:'Clubes',activity:'Actividad',profile:'Perfil',admin:'Administración',settings:'Configuración',backProfile:'Volver a Mi perfil',publicName:'Nombre público',uniqueAlias:'Alias único',requiredAlias:'Obligatorio. Entre 3 y 20 caracteres: letras minúsculas, números y guion bajo.',country:'País',city:'Ciudad',locationHelp:'Indica tu ubicación manualmente. No se utiliza el GPS.',statsVisibility:'Quién puede ver tus estadísticas',historyVisibility:'Quién puede ver tu historial',locationVisibility:'Quién puede ver tu ubicación',everyone:'Todo el mundo',friends:'Solo amigos',nobody:'Nadie',saveProfile:'Guardar perfil',logout:'Cerrar sesión',language:'Idioma',languageHelp:'Elige el idioma de Pickle&Mix.',spanish:'Español',english:'English'},
 en:{home:'Home',party:'Match',clubs:'Clubs',activity:'Activity',profile:'Profile',admin:'Administration',settings:'Settings',backProfile:'Back to My profile',publicName:'Display name',uniqueAlias:'Unique username',requiredAlias:'Required. 3–20 characters: lowercase letters, numbers and underscores.',country:'Country',city:'City',locationHelp:'Enter your location manually. GPS is not used.',statsVisibility:'Who can see your statistics',historyVisibility:'Who can see your history',locationVisibility:'Who can see your location',everyone:'Everyone',friends:'Friends only',nobody:'Nobody',saveProfile:'Save profile',logout:'Sign out',language:'Language',languageHelp:'Choose your Pickle&Mix language.',spanish:'Español',english:'English'}
};
let APP_LANG='es';try{const saved=localStorage.getItem(LANG_KEY);if(saved==='en'||saved==='es')APP_LANG=saved}catch(e){}document.documentElement.lang=APP_LANG;
const tr=k=>(LANGS[APP_LANG]&&LANGS[APP_LANG][k])||LANGS.es[k]||k;
async function setAppLanguage(value){
 if(value!=='es'&&value!=='en')return;
 const previous=APP_LANG;APP_LANG=value;try{localStorage.setItem(LANG_KEY,value)}catch(e){}
 document.documentElement.lang=value;
 if(AU.user&&sbc){
  const {data,error}=await sbc.from('profiles').update({preferred_language:value}).eq('id',AU.user.id).select('id,display_name,alias,avatar_url,stats_visibility,history_visibility,location_visibility,preferred_language').single();
  if(error){APP_LANG=previous;try{localStorage.setItem(LANG_KEY,previous)}catch(e){}document.documentElement.lang=previous;toast(previous==='en'?'Could not save your language preference.':'No se ha podido guardar el idioma.');console.warn('[language] save:',error.message);return}
  AU.profile={...AU.profile,...data};
 }
 render();
}

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fresh=()=>({players:[],settings:{courts:1,points:11,cycles:3,mode:'rot',pairing:'random'},matches:[],started:false,nid:1,teams:[],draft:[]});
function valid(d){return d&&Array.isArray(d.players)&&Array.isArray(d.matches)&&d.settings&&d.players.every(p=>p&&typeof p.id=='number'&&typeof p.name=='string')&&d.matches.every(m=>m&&Array.isArray(m.a)&&Array.isArray(m.b)&&m.a.length==2&&m.b.length==2&&['pending','done','skipped'].includes(m.status))&&(d.settings.mode!=='fixed'||Array.isArray(d.teams))&&['courts','points','cycles'].every(k=>Number.isInteger(d.settings[k])&&d.settings[k]>0)}
let S=fresh();try{const d=JSON.parse(localStorage.getItem(K));if(valid(d)){S=d;if(!S.started&&S.settings.points===7)S.settings.points=11}}catch(e){}
const save=()=>{try{localStorage.setItem(K,JSON.stringify(S))}catch(e){}};
const ROUTE_TO_VIEW={inicio:'home',preparar:'setup',partido:'game',jugadores:'more',resumen:'final',perfil:'profile',ajustes:'settings',amigos:'friends',historial:'history',quedadas:'sessions',clubes:'clubs',actividad:'activity',admin:'admin'};
const VIEW_TO_ROUTE={home:'inicio',setup:'preparar',game:'partido',more:'jugadores',final:'resumen',profile:'perfil',settings:'ajustes',friends:'amigos',history:'historial',sessions:'quedadas','session-detail':'quedadas','user-profile':'amigos',clubs:'clubes','club-detail':'clubes',activity:'actividad',admin:'admin'};
const initialRoute=location.hash.replace(/^#\/?/,'').toLowerCase();
const SETTINGS_ROUTE_TO_TAB={privacidad:'privacy',notificaciones:'notifications',cuenta:'account',idioma:'language',ayuda:'help',acerca:'about'};
const initialSettingsTab=initialRoute.startsWith('ajustes/')?(SETTINGS_ROUTE_TO_TAB[initialRoute.split('/')[1]]||'main'):'main';
const initialClubId=initialRoute.startsWith('clubes/')?decodeURIComponent(initialRoute.slice(7)):null;
const profileRouteId=initialRoute.startsWith('jugadores/')?decodeURIComponent(initialRoute.slice(10)):null;
let initialProfileId=profileRouteId;try{if(!initialProfileId)initialProfileId=sessionStorage.getItem('pickleMix.publicProfileRoute')}catch(e){}
let view=initialClubId?'club-detail':initialProfileId?'user-profile':(initialSettingsTab!=='main'?'settings':(ROUTE_TO_VIEW[initialRoute]||(S.started?'game':'home'))),tmp=null,msg='',err='',nerr='',ed=null,ct=1,SC={};
const nameErrBox=()=>nerr?`<div class="err">${esc(nerr)}</div>`:'';

/* ---------- Algoritmo de rotación ---------- */
const key=(x,y)=>x<y?x+'-'+y:y+'-'+x;
function trial(ids,count,done,courts,base){
  const g={},pt={},op={},qd={},sets=[];let s=0;const m=[];
  ids.forEach(i=>g[i]=0);
  const reg=(a,b)=>{const all=[...a,...b];pt[key(...a)]=(pt[key(...a)]||0)+1;pt[key(...b)]=(pt[key(...b)]||0)+1;
    a.forEach(x=>b.forEach(y=>op[key(x,y)]=(op[key(x,y)]||0)+1));
    const q=all.slice().sort((x,y)=>x-y).join();qd[q]=(qd[q]||0)+1;all.forEach(x=>{if(x in g)g[x]++});sets.push(new Set(all))};
  done.forEach(x=>reg(x.a,x.b));
  const per=Math.max(1,Math.floor(ids.length/4));
  for(let i=0;i<count;i++){
    const rec=new Set();sets.slice(-courts).forEach(st=>st.forEach(x=>rec.add(x)));
    const pool=ids.map(id=>({id,k:g[id]*100+(rec.has(id)?60:0)+Math.random()*30})).sort((x,y)=>x.k-y.k).slice(0,10).map(x=>x.id);
    const minSum=pool.map(x=>g[x]).sort((x,y)=>x-y).slice(0,4).reduce((x,y)=>x+y,0);
    let bc=null,bs=1e9;
    for(let a=0;a<pool.length;a++)for(let b=a+1;b<pool.length;b++)for(let c=b+1;c<pool.length;c++)for(let d=c+1;d<pool.length;d++){
      const q=[pool[a],pool[b],pool[c],pool[d]],extra=q.reduce((x,y)=>x+g[y],0)-minSum;
      const rc=q.filter(x=>rec.has(x)).length*60,qk=q.slice().sort((x,y)=>x-y).join();
      for(const [p1,p2] of [[[q[0],q[1]],[q[2],q[3]]],[[q[0],q[2]],[q[1],q[3]]],[[q[0],q[3]],[q[1],q[2]]]]){
        let sc=extra*1000+rc+(pt[key(...p1)]||0)*100+(pt[key(...p2)]||0)*100+(qd[qk]||0)*40+Math.random()*3;
        p1.forEach(x=>p2.forEach(y=>sc+=(op[key(x,y)]||0)*10));
        if(sc<bs){bs=sc;bc=[p1,p2]}}}
    s+=bs;reg(bc[0],bc[1]);
    m.push({id:0,cycle:Math.floor((base+i)/per)+1,court:(base+i)%courts+1,a:bc[0],b:bc[1],status:'pending',sa:null,sb:null});
  }
  return{m,s};
}
function gen(ids,count,done,courts,base){
  let best=null,bs=1e18;
  for(let t=0;t<40;t++){const r=trial(ids,count,done,courts,base);if(r.s<bs){bs=r.s;best=r.m}}
  return best;
}
/* Parejas rotatorias: «Ciclos» = partidos que juega cada persona.
   Total = ceil(jugadores·ciclos/4). Si no es exacto, (4·total − jugadores·ciclos) jugadores juegan 1 partido más (diferencia máxima: 1). */
function trialQ(ids,c,courts,pre){
  const n=ids.length,M=Math.ceil(n*c/4),ex=4*M-n*c,need={},pt={},op={},qd={},m=[],last=[],have=(pre&&pre.have)||{};let s=0;
  /* los puestos extra van a quien menos partidos lleva (sin historial previo, al azar) */
  ids.map(id=>({id,k:(have[id]||0)+Math.random()})).sort((x,y)=>x.k-y.k).forEach((o,i)=>need[o.id]=c+(i<ex?1:0));
  /* historial ya jugado: para evitar repetir parejas y rivales */
  if(pre&&pre.done)pre.done.forEach(x=>{pt[key(...x.a)]=(pt[key(...x.a)]||0)+1;pt[key(...x.b)]=(pt[key(...x.b)]||0)+1;
    x.a.forEach(u=>x.b.forEach(v=>op[key(u,v)]=(op[key(u,v)]||0)+1));
    const q=[...x.a,...x.b].sort((u,v)=>u-v).join();qd[q]=(qd[q]||0)+1});
  for(let i=0;i<M;i++){
    const left=M-i-1,win=new Set(),prev=new Set();
    if(courts>1)last.slice(-(courts-1)).forEach(st=>st.forEach(x=>win.add(x)));
    if(last.length)last[last.length-1].forEach(x=>prev.add(x));
    const cand=ids.filter(id=>need[id]>0).map(id=>({id,k:-need[id]*100+(win.has(id)?150:0)+(prev.has(id)?40:0)+Math.random()*30})).sort((x,y)=>x.k-y.k).map(x=>x.id);
    if(cand.length<4)break;
    let bc=null,bs=1e18;
    for(const lim of[10,cand.length]){
      const pool=cand.slice(0,lim);
      for(let a=0;a<pool.length;a++)for(let b=a+1;b<pool.length;b++)for(let e=b+1;e<pool.length;e++)for(let d=e+1;d<pool.length;d++){
        const q=[pool[a],pool[b],pool[e],pool[d]],sel=new Set(q);let mx=0;
        for(const id of ids){const v=need[id]-(sel.has(id)?1:0);if(v>mx)mx=v}
        if(mx>left)continue; /* debe seguir siendo posible cuadrar el reparto */
        const rc=q.filter(x=>win.has(x)).length*5000+q.filter(x=>prev.has(x)).length*200,qk=q.slice().sort((x,y)=>x-y).join();
        for(const[p1,p2]of[[[q[0],q[1]],[q[2],q[3]]],[[q[0],q[2]],[q[1],q[3]]],[[q[0],q[3]],[q[1],q[2]]]]){
          let sc=rc+(pt[key(...p1)]||0)*100+(pt[key(...p2)]||0)*100+(qd[qk]||0)*40+Math.random()*3;
          p1.forEach(x=>p2.forEach(y=>sc+=(op[key(x,y)]||0)*10));
          if(sc<bs){bs=sc;bc=[p1,p2]}}}
      if(bc)break;
    }
    if(!bc){const q=cand.slice(0,4);bc=[[q[0],q[1]],[q[2],q[3]]];bs+=1e6}
    const[p1,p2]=bc,all=[...p1,...p2];
    pt[key(...p1)]=(pt[key(...p1)]||0)+1;pt[key(...p2)]=(pt[key(...p2)]||0)+1;
    p1.forEach(x=>p2.forEach(y=>op[key(x,y)]=(op[key(x,y)]||0)+1));
    const q=all.slice().sort((x,y)=>x-y).join();qd[q]=(qd[q]||0)+1;
    all.forEach(x=>need[x]--);last.push(new Set(all));s+=bs<1e17?bs:0;
    m.push({id:0,cycle:Math.min(c,Math.floor(i*4/n)+1),court:i%courts+1,a:p1,b:p2,status:'pending',sa:null,sb:null});
  }
  return{m,s:s+(m.length<M?1e9:0)};
}
function genQ(ids,c,courts,pre){
  const M=Math.ceil(ids.length*c/4),T=M>40?15:40;let best=null,bs=1e18;
  for(let t=0;t<T;t++){const r=trialQ(ids,c,courts,pre);if(r.s<bs){bs=r.s;best=r.m}}
  return best;
}
const active=()=>S.players.filter(p=>p.status!=='rest'&&p.status!=='out');
function rebuild(count){
  const keep=S.matches.filter(m=>m.status!=='pending'),ids=active().map(p=>p.id);
  if(ids.length<4){S.matches=keep;return false}
  const nm=gen(ids,count,keep.filter(m=>m.status==='done'),S.settings.courts,keep.length);
  nm.forEach(m=>m.id=S.nid++);S.matches=keep.concat(nm);return true;
}
const pending=()=>S.matches.filter(m=>m.status==='pending');
/* Partidos que se juegan a la vez: los primeros pendientes (hasta nº de pistas) sin jugadores repetidos. Cuando una pista queda libre, entra el siguiente. */
function live(){
  const C=S.settings.courts,out=[],busy=new Set(),used=new Set();
  for(const m of pending()){if(out.length>=C)break;const ps=[...m.a,...m.b];if(ps.some(i=>busy.has(i)))continue;out.push(m);ps.forEach(i=>busy.add(i))}
  out.forEach(m=>{if(m.court>=1&&m.court<=C&&!used.has(m.court))used.add(m.court);else m.court=0});
  out.forEach(m=>{if(!m.court){let c=1;while(used.has(c))c++;m.court=c;used.add(c)}});
  return out.sort((a,b)=>a.court-b.court)}
const nameOf=id=>{const p=S.players.find(p=>p.id===id);return p?p.name:'?'};
const FX=()=>S.settings.mode==='fixed';
/* ---------- Parejas fijas ---------- */
/* Torneo: fase de grupos (todos contra todos dentro de cada grupo) + eliminatorias */
const fxPlan=T=>({G:T<=4?1:Math.ceil(T/4),Q:T<=2?0:T<=3?2:T<=11?4:8});
const KOL={1:'Final',2:'Semifinal',4:'Cuartos'},grpL=g=>'Grupo '+String.fromCharCode(65+(g||0));
const fxMk=(x,y,extra)=>{const T=id=>S.teams.find(t=>t.id===id);S.matches.push(Object.assign({id:S.nid++,cycle:1,court:S.matches.length%S.settings.courts+1,a:T(x).p.slice(),b:T(y).p.slice(),ta:x,tb:y,status:'pending',sa:null,sb:null},extra))};
function fxBuild(){
  const{G}=fxPlan(S.teams.length),R=[];
  S.teams.forEach((t,i)=>t.g=i%G);
  for(let g=0;g<G;g++){const ids=S.teams.filter(t=>t.g===g).map(t=>t.id);if(ids.length%2)ids.push(0);
    const n=ids.length;let a=ids.slice();
    for(let r=0;r<n-1;r++){(R[r]=R[r]||[]);for(let i=0;i<n/2;i++){const x=a[i],y=a[n-1-i];if(x&&y)R[r].push([x,y,g])}
      a=[a[0],a[n-1],...a.slice(1,n-1)]}}
  R.forEach(r=>r.forEach(([x,y,g])=>fxMk(x,y,{ph:'g',lbl:grpL(g)})));
}
function fxAdvance(){
  if(!FX()||pending().length)return;
  const T=S.teams.length,Q=fxPlan(T).Q;if(!Q)return;
  const ko=S.matches.filter(m=>m.ph==='ko');let pairs=[],n;
  if(!ko.length){
    const st=stats(),by=id=>st.find(s=>s.p.id===id),cmp=(x,y)=>rate(y)-rate(x)||dif(y)-dif(x)||y.pf-y.pa-(x.pf-x.pa),gp={};
    S.teams.forEach(t=>(gp[t.g||0]=gp[t.g||0]||[]).push(by(t.id)));
    const seeds=[];Object.values(gp).forEach(l=>l.sort(cmp).forEach((s,i)=>{s.gp=i;seeds.push(s)}));
    seeds.sort((x,y)=>x.gp-y.gp||cmp(x,y));const q=seeds.slice(0,Q).map(s=>s.p.id);
    const ord={2:[[0,1]],4:[[0,3],[1,2]],8:[[0,7],[3,4],[1,6],[2,5]]}[Q];
    pairs=ord.map(([i,j])=>[q[i],q[j]]);n=Q/2;
  }else{
    const last=ko[ko.length-1].ko;if(last<2)return;
    const w=ko.filter(m=>m.ko===last).map(m=>m.sa>m.sb?m.ta:m.tb);
    for(let i=0;i<w.length;i+=2)pairs.push([w[i],w[i+1]]);n=last/2;
  }
  pairs.forEach(([x,y])=>fxMk(x,y,{ph:'ko',ko:n,lbl:KOL[n]}));
}
/* Gráfico del torneo: grupos → eliminatorias */
function fxFlow(fin){
  const real=S.started&&S.teams.length,T=real?S.teams.length:Math.floor(S.players.length/2);if(T<2)return'';
  const{G,Q}=fxPlan(T),nm=t=>t.p.map(nameOf).join(' / ');let gr='';
  if(real){const st=stats();gr=Array.from({length:G},(_,g)=>{const l=st.filter(s=>(S.teams.find(t=>t.id===s.p.id).g||0)===g).sort((x,y)=>rate(y)-rate(x)||dif(y)-dif(x));
    return`<div class="grp"><h4>${grpL(g)}</h4>${l.map(s=>`<div class="ln"><span>${esc(s.p.name.replace(/ y /g,' / '))}</span><b>${s.w}-${s.l}</b></div>`).join('')}</div>`}).join('')}
  else gr=Array.from({length:G},(_,g)=>{const z=Math.floor(T/G)+(g<T%G?1:0);return`<div class="grp"><h4>${grpL(g)}</h4><div class="ln"><span>${z} parejas · todas contra todas</span></div></div>`}).join('');
  let cols='';
  for(let n=Q/2;n>=1;n/=2){const ms=S.matches.filter(m=>m.ph==='ko'&&m.ko===n),sh=t=>esc(nm(S.teams.find(x=>x.id===t)).slice(0,40));
    cols+=`<div class="kc"><h4>${{1:'Final',2:'Semifinales',4:'Cuartos'}[n]}</h4>${ms.length?ms.map(m=>`<div class="bm">${[[m.ta,m.sa,m.sa>m.sb],[m.tb,m.sb,m.sb>m.sa]].map(([t,s,w])=>`<div${m.status==='done'&&w?' class="w"':''}><span>${sh(t)}</span><b>${m.status==='done'?s:''}</b></div>`).join('')}</div>`).join(''):Array.from({length:n},()=>'<div class="bm ph"><div><span>por definir</span></div><div><span>por definir</span></div></div>').join('')}</div>`}
  const fm=S.matches.find(m=>m.ph==='ko'&&m.ko===1&&m.status==='done'),cp=fm?S.teams.find(t=>t.id===(fm.sa>fm.sb?fm.ta:fm.tb)):null;
  const e=Q?`<div class="fl">▶</div><div class="kc"><h4>Campeón</h4>${cp?`<div class="bm" style="text-align:center"><div class="w" style="display:block">🏆 ${esc(nm(cp).slice(0,40))}</div></div>`:'<div class="bm ph" style="text-align:center">🏆</div>'}</div>`:'';
  return`<div class="card"><h3>${fin?'Cuadro del torneo':'Cómo se juega el torneo'}</h3><p class="mut">1) Fase de grupos: cada pareja juega contra las de su grupo. ${Q?`2) Pasan las ${Q} mejores a eliminatorias directas (el que pierde, fuera).`:''}</p>
  <div class="flow"><div class="kc"><h4>Grupos</h4>${gr}</div>${Q?`<div class="fl">▶</div>${cols}${e}`:''}</div></div>`}
const fxTotal=T=>{const{G,Q}=fxPlan(T);let t=Q?Q-1:0;for(let g=0;g<G;g++){const z=Math.floor(T/G)+(g<T%G?1:0);t+=z*(z-1)/2}return t};
function ensureDraft(){const T=Math.floor(S.players.length/2),ids=new Set(S.players.map(p=>p.id));
  S.draft=(S.draft||[]).slice(0,T).map(r=>r.map(i=>ids.has(i)?i:0));while(S.draft.length<T)S.draft.push([0,0])}
const modeSel=()=>{const m=S.settings,b=(k,cur,v,t,sub)=>`<button data-${k}="${v}" aria-selected="${cur===v}"><b>${t}</b><small>${sub}</small></button>`;
  return`<div class="ctabs" role="tablist" aria-label="Tipo de juego">${b('mode',m.mode||'rot','rot','Parejas rotatorias','Ranking individual')}${b('mode',m.mode||'rot','fixed','Parejas fijas','Ranking por pareja')}</div>`
  +(FX()?`<div class="ctabs" role="tablist" aria-label="Formación de parejas">${b('pm',m.pairing||'random','random','Aleatorias','sorteo')}${b('pm',m.pairing||'random','manual','Manuales','las eliges tú')}</div>`:'')};
const pairsCard=()=>{if(!FX()||S.settings.pairing!=='manual')return'';ensureDraft();const used=new Set(S.draft.flat());
  const sel=(i,j)=>`<select data-dr="${i}-${j}" aria-label="Pareja ${i+1}, jugador ${j+1}"><option value="0">—</option>${S.players.filter(p=>p.id===S.draft[i][j]||!used.has(p.id)).map(p=>`<option value="${p.id}"${p.id===S.draft[i][j]?' selected':''}>${esc(p.name)}</option>`).join('')}</select>`;
  return`<div class="card"><h3>Parejas</h3>${S.draft.length?S.draft.map((r,i)=>`<div class="row" style="margin:8px 0"><b class="fix">${i+1}</b>${sel(i,0)}${sel(i,1)}</div>`).join(''):'<p class="mut">Añade jugadores para formar parejas.</p>'}${S.players.length%2?'<p class="err">Hace falta un número par de jugadores.</p>':''}</div>`};
const fxMore=()=>`<div class="card">${S.teams.map(t=>`<div style="margin:10px 0"><span class="tag">Pareja ${t.id}</span><div class="row" style="margin-top:6px">${t.p.map(i=>`<input value="${esc(nameOf(i))}" data-ren="${i}" aria-label="Nombre">`).join('')}</div></div>`).join('')}</div>`;
function stats(){
  if(FX()){const st={};(S.teams||[]).forEach(t=>st[t.id]={p:{id:t.id,name:t.p.map(nameOf).join(' y ')},g:0,w:0,l:0,pf:0,pa:0,pt:new Set()});
    S.matches.filter(m=>m.status==='done').forEach(m=>[[m.ta,m.sa,m.sb],[m.tb,m.sb,m.sa]].forEach(([t,f,c])=>{const s=st[t];if(!s)return;s.g++;s.pf+=f;s.pa+=c;f>c?s.w++:s.l++}));
    const ko=S.matches.filter(m=>m.ph==='ko');Object.values(st).forEach(s=>s.lv=5);
    ko.forEach(m=>[m.ta,m.tb].forEach(t=>{if(st[t]&&st[t].lv>4)st[t].lv=4}));
    ko.filter(m=>m.status==='done').forEach(m=>{const w=m.sa>m.sb?m.ta:m.tb,l=m.sa>m.sb?m.tb:m.ta;if(st[l])st[l].lv=m.ko===1?1:m.ko===2?2:3;if(m.ko===1&&st[w])st[w].lv=0});
    return Object.values(st)}
  const st={};S.players.forEach(p=>st[p.id]={p,g:0,w:0,l:0,pf:0,pa:0,pt:new Set()});
  S.matches.filter(m=>m.status==='done').forEach(m=>{
    [[m.a,m.sa,m.sb],[m.b,m.sb,m.sa]].forEach(([t,f,c])=>t.forEach(id=>{const s=st[id];if(!s)return;s.g++;s.pf+=f;s.pa+=c;f>c?s.w++:s.l++;s.pt.add(t[0]===id?t[1]:t[0])}));});
  return Object.values(st);
}
const rate=s=>s.g?s.w/s.g:0,dif=s=>s.g?(s.pf-s.pa)/s.g:0;
const rk=s=>s.lv<=3?'L'+s.lv:(s.lv||0)+'|'+rate(s).toFixed(3)+'|'+dif(s).toFixed(3);
function ranking(){return stats().sort((x,y)=>(x.lv||0)-(y.lv||0)||rate(y)-rate(x)||dif(y)-dif(x)||y.pf-x.pf)}

/* ---------- Vistas ---------- */
const bar=()=>{const t=S.matches.length,d=S.matches.filter(m=>m.status!=='pending').length;return`<div class="bar"><i style="width:${t?d/t*100:0}%"></i></div><span class="mut">${d} de ${t} partidos resueltos</span>`};
/* Pie de página: visible en todas las pestañas */
const foot=()=>`<p class="mut foot">Plataforma para pickleballers creada por <a href="https://kikebarcelodg.github.io/" target="_blank" rel="noopener">KBDG</a></p>`;
let routeInitialized=false,lastRenderedRoute=null;
function render(){
  if(view==='user-profile'&&PUB.id){try{sessionStorage.setItem('pickleMix.publicProfileRoute',PUB.id)}catch(e){}}
  else{try{sessionStorage.removeItem('pickleMix.publicProfileRoute')}catch(e){}}
  const SETTINGS_TAB_TO_ROUTE={privacy:'privacidad',notifications:'notificaciones',account:'cuenta',language:'idioma',help:'ayuda',about:'acerca'};
  const route=view==='club-detail'&&CL.selectedId?'#clubes/'+encodeURIComponent(CL.selectedId):view==='user-profile'&&PUB.id?'#jugadores/'+encodeURIComponent(PUB.id):view==='settings'&&SETTINGS_TAB!=='main'?'#ajustes/'+(SETTINGS_TAB_TO_ROUTE[SETTINGS_TAB]||'privacidad'):'#'+(VIEW_TO_ROUTE[view]||'inicio');
  const routeChanged=lastRenderedRoute!==null&&lastRenderedRoute!==route;
  const internalRouteChange=location.hash!==route;
  if(internalRouteChange){
    const url=location.pathname+location.search+route;
    if(!routeInitialized){history.replaceState({__pmScrollY:0},'',url);routeInitialized=true}
    else{
      try{history.replaceState({...history.state,__pmScrollY:window.scrollY},'',location.href)}catch(e){}
      history.pushState({__pmScrollY:0},'',url);
    }
  }else routeInitialized=true;
  if(routeChanged&&internalRouteChange&&typeof window!=='undefined')window.scrollTo(0,0);
  lastRenderedRoute=route;
  const f={home:vHome,activity:vActivity,setup:vSetup,game:vGame,more:vMore,final:vFinal,profile:vProfile,settings:vSettings,friends:vFriends,history:vHistory,sessions:vSessions,'session-detail':vSessionDetail,'user-profile':vUserProfile,clubs:vClubs,'club-detail':vClubDetail,admin:vAdmin}[view];
  $('#app').innerHTML=header()+f()+(err?`<div class="err">${esc(err)}</div>`:'')+bottomNavigation();translateDOM();err='';nerr='';if(view==='home')initPong('pong',null,true);
  if(view==='activity'&&AU.user&&!ACT.loading&&!ACT.loaded)loadActivity(true);
  if(msg){toast(msg);msg=''}
}
let PG={u:0,c:0};
const HIST={items:[],sessions:[],selectedSessionId:null,invites:[],inviteBusy:'',stats:{played:0,wins:0,losses:0,winRate:0,pointsFor:0,pointsAgainst:0,sessions:0},loading:false,error:'',loaded:false};
const PUB={id:initialProfileId,profile:null,stats:null,history:[],achievements:null,clubs:[],clubsLoading:!!initialProfileId,clubTab:'member',clubsExpanded:false,error:'',loading:!!initialProfileId,statsHidden:false,historyHidden:false};
const ACH={summary:null,loading:false,error:'',open:false,publicMode:false,notifications:[],notificationsOpen:false};
const ACT={items:[],filter:'all',loading:false,loaded:false,error:'',hasMore:false};
const FR={items:[],people:[],query:'',results:[],loading:false,searching:false,error:'',loaded:false,ranking:[],rankingLoading:false,activity:[],activityLoading:false,busy:'',panel:''};
const CL={items:[],members:[],memberCounts:{},people:[],selectedId:initialClubId,section:'mine',directoryGroup:null,tab:'info',openPostId:null,openEventId:null,loading:false,error:'',busy:'',createOpen:false,requests:[],invitations:[],links:[],events:[],registrations:[],posts:[],comments:[],postOpen:false,inviteUrl:'',eventOpen:false,settingsOpen:false,inviteRedeemBusy:false,myRequest:null,incomingInvites:[]};
const ADMIN={isAdmin:false,role:'',tab:'dashboard',users:[],clubs:[],admins:[],audit:[],activity:[],messages:[],pendingMessages:0,pendingOfficialClubs:0,activityTag:'all',analytics:null,analyticsRange:30,page:1,busy:false,error:''};
const SUPPORT={tickets:[],selected:null,replies:[],loaded:false,loading:false,adminSelected:null,adminReplies:[],adminLoading:false};
const MATCH_CLUBS={items:[],loading:false,loaded:false,open:false,busy:false,selected:''};
const ACH_BADGES=[
{id:'first_match',title:'Primera pala',desc:'Completa tu primer partido',group:'Deporte',mark:'01'},
{id:'matches_25',title:'Ritmo de pista',desc:'Completa 25 partidos',group:'Deporte',mark:'25'},
{id:'matches_75',title:'Jugador constante',desc:'Completa 75 partidos',group:'Deporte',mark:'75'},
{id:'matches_150',title:'Veterano de pista',desc:'Completa 150 partidos',group:'Deporte',mark:'150'},
{id:'matches_500',title:'Leyenda de la pista',desc:'Completa 500 partidos',group:'Deporte',mark:'500'},
{id:'first_win',title:'Primera victoria',desc:'Gana tu primer partido',group:'Deporte',mark:'01'},
{id:'wins_25',title:'Instinto ganador',desc:'Consigue 25 victorias',group:'Deporte',mark:'25'},
{id:'wins_100',title:'Dominador',desc:'Consigue 100 victorias',group:'Deporte',mark:'100'},
{id:'first_tournament',title:'Debutante',desc:'Participa en tu primer torneo',group:'Deporte',mark:'01'},
{id:'tournaments_5',title:'Competidor',desc:'Participa en 5 torneos',group:'Deporte',mark:'05'},
{id:'tournaments_15',title:'Circuito habitual',desc:'Participa en 15 torneos',group:'Deporte',mark:'15'},
{id:'friends_5',title:'Buena compañía',desc:'Consigue 5 amigos',group:'Comunidad',mark:'05'},
{id:'friends_15',title:'Red de jugadores',desc:'Consigue 15 amigos',group:'Comunidad',mark:'15'},
{id:'friends_30',title:'Conector',desc:'Consigue 30 amigos',group:'Comunidad',mark:'30'},
{id:'clubs_2',title:'En equipo',desc:'Pertenece a 2 clubes',group:'Comunidad',mark:'02'},
{id:'clubs_5',title:'Vida de club',desc:'Pertenece a 5 clubes',group:'Comunidad',mark:'05'},
{id:'club_founder',title:'Fundador',desc:'Crea tu primer club',group:'Comunidad',mark:'★'},
{id:'organizer_3',title:'Organizador',desc:'Organiza 3 quedadas con resultados',group:'Comunidad',mark:'03'},
{id:'organizer_10',title:'Impulsor',desc:'Organiza 10 quedadas con resultados',group:'Comunidad',mark:'10'},
{id:'organizer_25',title:'Motor de la comunidad',desc:'Organiza 25 quedadas con resultados',group:'Comunidad',mark:'25'}
];
const ACH_LEVELS=[{name:'Principiante',min:0},{name:'Aprendiz',min:100},{name:'Aficionado',min:300},{name:'Jugador habitual',min:600},{name:'Experimentado',min:1000},{name:'Avanzado',min:1800},{name:'Experto',min:3000},{name:'Leyenda',min:5000}];
function achievementPanel(summary,publicMode){
  if(!summary)return '';
  const xp=Math.max(0,Number(summary.xp)||0),level=Math.max(1,Math.min(8,Number(summary.level)||1)),cur=ACH_LEVELS[level-1],next=ACH_LEVELS[level]||null;
  const earned=new Map((summary.earned||[]).map(x=>[x.id,x.earned_at]));
  const unlocked=ACH_BADGES.filter(b=>earned.has(b.id)),progress=next?Math.max(0,Math.min(100,(xp-cur.min)/(next.min-cur.min)*100)):100;
  const shown=unlocked.slice(0,3).map(b=>'<span class="achievement-profile-badge"><i>'+esc(b.mark)+'</i><b>'+esc(b.title)+'</b></span>').join('');
  const extra=unlocked.length>3?'<span class="achievement-profile-extra">+'+(unlocked.length-3)+'</span>':'';
  return '<section class="card achievement-profile-card"><button type="button" class="achievement-profile-launch" data-a="'+(publicMode?'publicAchievements':'achievements')+'" aria-label="Ver nivel y colección de insignias">'+
    '<span class="achievement-profile-main"><span class="achievement-profile-copy"><b>Progreso y logros</b><small>Nivel '+level+' · '+esc(cur.name)+'</small></span><span class="achievement-profile-xp">'+xp.toLocaleString(APP_LANG==='en'?'en-US':'es-ES')+' XP</span>'+
    '<span class="achievement-profile-progress" role="progressbar" aria-label="Progreso al siguiente nivel" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+Math.round(progress)+'"><i style="width:'+progress+'%"></i></span>'+
    '<span class="achievement-profile-next">'+(next?(next.min-xp).toLocaleString(APP_LANG==='en'?'en-US':'es-ES')+' XP para '+esc(next.name):'Has alcanzado el nivel máximo')+'</span></span>'+
    '<span class="achievement-profile-side"><span class="achievement-profile-list">'+(shown||'<span class="achievement-profile-empty">Tu primera insignia te espera</span>')+extra+'</span><span class="achievement-profile-count">'+unlocked.length+'/'+ACH_BADGES.length+' insignias <b>Ver colección ›</b></span></span></button></section>';
}
function achievementCatalog(summary,publicMode){
  if(!ACH.open||ACH.publicMode!==publicMode||!summary)return '';
  const xp=Math.max(0,Number(summary.xp)||0),level=Math.max(1,Math.min(8,Number(summary.level)||1)),cur=ACH_LEVELS[level-1],next=ACH_LEVELS[level]||null;
  const earned=new Map((summary.earned||[]).map(x=>[x.id,x.earned_at]));
  const progress=next?Math.max(0,Math.min(100,(xp-cur.min)/(next.min-cur.min)*100)):100;
  const groups=[...new Set(ACH_BADGES.map(b=>b.group))],earnedCount=ACH_BADGES.filter(b=>earned.has(b.id)).length;
  return '<div class="achievement-modal-backdrop" data-a="achievementsClose"><section class="achievement-modal" role="dialog" aria-modal="true" aria-labelledby="achievement-modal-title" data-achievement-modal><header class="achievement-modal-head"><div><span class="section-kicker">PICKLE &amp; MIX</span><h3 id="achievement-modal-title">Tu progreso</h3><p>Juega, conoce gente y participa en la comunidad para seguir avanzando.</p></div><button type="button" class="achievement-modal-close" data-a="achievementsClose" aria-label="Cerrar">×</button></header>'+
    '<div class="achievement-level-summary"><div><small>NIVEL '+String(level).padStart(2,'0')+'</small><b>'+esc(cur.name)+'</b><span>'+xp.toLocaleString(APP_LANG==='en'?'en-US':'es-ES')+' XP acumulados</span></div><strong>'+earnedCount+'<small> / '+ACH_BADGES.length+' logros</small></strong></div>'+
    '<div class="achievement-progress"><i style="width:'+progress+'%"></i></div><div class="achievement-progress-caption"><span>'+(next?Math.round(progress)+'% del nivel':'Nivel máximo alcanzado')+'</span><b>'+(next?(next.min-xp).toLocaleString(APP_LANG==='en'?'en-US':'es-ES')+' XP para '+esc(next.name):'¡Enhorabuena!')+'</b></div>'+
    groups.map(group=>{const items=ACH_BADGES.filter(b=>b.group===group).sort((a,b)=>Number(earned.has(b.id))-Number(earned.has(a.id)));const count=items.filter(b=>earned.has(b.id)).length;return '<section class="achievement-group"><h4>'+esc(group)+' <span>'+count+'/'+items.length+'</span></h4><div class="achievement-catalog-grid">'+items.map(b=>{const at=earned.get(b.id),ok=!!at;return '<article class="achievement-catalog-item '+(ok?'is-earned':'is-locked')+'"><span class="achievement-medal '+(ok?'earned':'locked')+'"><b>'+esc(b.mark)+'</b></span><div><b>'+esc(b.title)+'</b><small>'+esc(b.desc)+'</small><em>'+(ok?'Conseguida · '+new Date(at).toLocaleDateString(APP_LANG==='en'?'en-US':'es-ES'):'Por desbloquear')+'</em></div></article>'}).join('')+'</div></section>'}).join('')+'</section></div>';
}
function notificationsPanel(){
  const items=ACH.notifications||[],unread=items.filter(n=>!n.read_at).length;
  return '<section class="notification-popover" role="dialog" aria-label="Notificaciones"><header class="notification-popover-head"><div><b>Notificaciones</b><small>'+(unread?unread+' sin leer':'Estás al día')+'</small></div><button type="button" data-a="notificationsToggle" aria-label="Cerrar notificaciones">×</button></header><div class="notification-popover-list">'+(items.length?items.map(n=>{const clubNotice=n.notification_type==='club_post_created'||n.notification_type==='club_event_created',friendNotice=n.notification_type==='friend_request_received',supportNotice=n.notification_type==='support_reply_received',actionable=clubNotice||friendNotice||supportNotice,symbol=supportNotice?'✉':n.notification_type==='achievement_unlocked'?'✦':n.notification_type==='club_post_created'?'▤':n.notification_type==='club_event_created'?'◷':friendNotice?'♧':'•',inner='<span class="notification-symbol">'+symbol+'</span><div><b>'+esc(n.title)+'</b><p>'+esc(n.body)+'</p><small>'+new Date(n.created_at).toLocaleDateString(APP_LANG==='en'?'en-US':'es-ES',{day:'numeric',month:'short',year:'numeric'})+'</small></div>';return actionable?'<button type="button" class="notification-item notification-link '+(n.read_at?'is-read':'is-unread')+'" data-notification-open="'+n.notification_type+'" data-id="'+esc(n.reference_id)+'">'+inner+'<span class="notification-open-arrow">›</span></button>':'<article class="notification-item '+(n.read_at?'is-read':'is-unread')+'">'+inner+'</article>'}).join(''):'<p class="notification-empty">Todavía no tienes notificaciones. Cuando haya novedades, aparecerán aquí.</p>')+'</div>'+(unread?'<footer class="notification-popover-foot"><button type="button" data-a="notificationsReadAll">Marcar todas como leídas</button></footer>':'')+'</section>';
}
let profileNotificationChannel=null;
function watchProfileNotifications(userId){if(profileNotificationChannel){sbc.removeChannel(profileNotificationChannel);profileNotificationChannel=null}if(!sbc||!userId)return;profileNotificationChannel=sbc.channel('profile-notifications-'+userId).on('postgres_changes',{event:'INSERT',schema:'public',table:'profile_notifications',filter:'user_id=eq.'+userId},payload=>{const n=payload&&payload.new;if(!n)return;ACH.notifications=[n,...(ACH.notifications||[]).filter(x=>x.id!==n.id)].slice(0,20);paintAuth();if(n.notification_type==='club_post_created'||n.notification_type==='club_event_created'||n.notification_type==='friend_request_received'||n.notification_type==='support_reply_received')toast(n.title)}).subscribe()}
async function openFriendRequestNotification(id){
  if(!sbc||!AU.user)return;
  try{
    if(id)await sbc.from('profile_notifications').update({read_at:new Date().toISOString()}).eq('user_id',AU.user.id).eq('notification_type','friend_request_received').eq('reference_id',id).is('read_at',null);
    ACH.notifications=(ACH.notifications||[]).map(n=>n.notification_type==='friend_request_received'&&n.reference_id===id?{...n,read_at:n.read_at||new Date().toISOString()}:n);
    ACH.notificationsOpen=false;view='friends';await loadFriends();toast('Aquí tienes tus solicitudes de amistad.');
  }catch(error){console.warn('[notifications] open friend request:',error&&error.message);view='friends';await loadFriends()}
}
async function openClubNotification(type,id){if(!sbc||!AU.user||!id)return;const table=type==='club_post_created'?'club_posts':type==='club_event_created'?'club_events':null;if(!table)return;try{const {data,error}=await sbc.from(table).select('club_id').eq('id',id).maybeSingle();if(error)throw error;if(!data){toast('Esta novedad ya no está disponible.');return}await sbc.from('profile_notifications').update({read_at:new Date().toISOString()}).eq('user_id',AU.user.id).eq('notification_type',type).eq('reference_id',id).is('read_at',null);ACH.notifications=(ACH.notifications||[]).map(n=>n.notification_type===type&&n.reference_id===id?{...n,read_at:n.read_at||new Date().toISOString()}:n);ACH.notificationsOpen=false;CL.selectedId=data.club_id;CL.tab='info';CL.openPostId=null;CL.openEventId=null;view='club-detail';render();await loadClubs()}catch(e){console.warn('[notifications] open club item:',e&&e.message);toast('No se ha podido abrir esta novedad.')}}
async function openSupportReplyNotification(id,fromPush=false){
 if(!sbc||!AU.user||!id||!/^[0-9a-f-]{36}$/i.test(id))return;
 ACH.notificationsOpen=false;SETTINGS_TAB='help';view='settings';SUPPORT.selected=id;SUPPORT.loaded=false;SUPPORT.replies=[];render();
 try{
  const {error}=await sbc.from('profile_notifications').update({read_at:new Date().toISOString()}).eq('user_id',AU.user.id).eq('notification_type','support_reply_received').eq('reference_id',id).is('read_at',null);
  if(error)throw error;
  ACH.notifications=(ACH.notifications||[]).map(n=>n.notification_type==='support_reply_received'&&n.reference_id===id?{...n,read_at:n.read_at||new Date().toISOString()}:n);
  if(fromPush){const params=new URLSearchParams(location.search);params.delete('support_ticket');history.replaceState(history.state,'',location.pathname+(params.toString()?'?'+params.toString():'')+location.hash)}
  await loadMySupport();
 }catch(error){console.warn('[notifications] open support reply:',error&&error.message);toast('No se ha podido abrir esta consulta.');}
}
async function markNotificationsRead(){
  if(!sbc||!AU.user)return;
  const {error}=await sbc.from('profile_notifications').update({read_at:new Date().toISOString()}).eq('user_id',AU.user.id).is('read_at',null);
  if(error){toast('No se han podido marcar las notificaciones como leídas.');console.warn('[notifications] read:',error.message);return}
  ACH.notifications=(ACH.notifications||[]).map(n=>({...n,read_at:n.read_at||new Date().toISOString()}));paintAuth();
}
async function loadMyAchievements(){
  if(!sbc||!AU.user)return;
  ACH.loading=true;ACH.error='';
  try{const {data,error}=await sbc.rpc('sync_my_profile_achievements');if(error)throw error;ACH.summary=data||null}
  catch(error){console.warn('[achievements] load:',error&&error.message);ACH.error='No se han podido actualizar tus logros.'}
  finally{ACH.loading=false;try{const {data,error}=await sbc.from('profile_notifications').select('id,notification_type,reference_id,title,body,created_at,read_at').order('created_at',{ascending:false}).limit(20);if(error)throw error;ACH.notifications=data||[]}catch(error){console.warn('[notifications] load:',error&&error.message);ACH.notifications=[]}paintAuth()}
}

function initPong(cid,hid,pre){
  const c=document.getElementById(cid);if(!c)return;const x=c.getContext('2d'),d=window.devicePixelRatio||1,hint=hid&&document.getElementById(hid);
  let W=0,H=0,k=1,PW,PH,UY,CY,NY,RI,RP;if(!pre)PG.u=PG.c=0;const WIN=7,HIT=()=>PW/2+s.r*.7,s={m:'idle',bx:0,by:0,vx:0,vy:0,r:0,a:0,sp:300,ux:0,cx:0,t:0,dir:-1,err:0};
  const V=()=>Math.min(2.2,Math.max(1,H/300)),say=t=>{if(hint)hint.textContent=t},idle=()=>{s.bx=W/2;s.by=H*.64};
  function fit(){const w=c.clientWidth,h=c.clientHeight;if(!w||!h||(w===W&&h===H))return;const first=!W;W=w;H=h;c.width=W*d;c.height=H*d;x.setTransform(d,0,0,d,0,0);
    k=Math.max(1,Math.min(1.8,H/380));PW=Math.max(44,Math.min(58*k,W*.17));PH=12*k;UY=H-26*k;CY=26*k;NY=H/2;RI=34*k;RP=14*k;
    if(first){s.ux=s.cx=W/2;s.r=RI}if(first||s.m==='idle'||s.m==='over')idle();s.ux=Math.min(Math.max(s.ux,PW/2),W-PW/2)}
  say('Toca la pelota para jugar contra el ordenador (a 7 puntos)');
  const ptr=e=>{const q=c.getBoundingClientRect();s.ux=Math.max(PW/2,Math.min(W-PW/2,e.clientX-q.left));return[e.clientX-q.left,e.clientY-q.top]};
  if(!pre){c.addEventListener('pointermove',ptr);
    c.addEventListener('pointerdown',e=>{const[px,py]=ptr(e);if((s.m==='idle'||s.m==='over')&&Math.hypot(px-s.bx,py-s.by)<s.r+24*k){if(s.m==='over')PG.u=PG.c=0;start(-1)}})}
  function start(dir){s.m='play';s.sp=300;const n=Math.random()-.5,v=s.sp*V();s.vx=n*v;s.vy=dir*Math.sqrt(v*v-s.vx*s.vx);s.err=0;say('Mueve tu pala (la de abajo) con el dedo o el ratón')}
  function point(u){u?PG.u++:PG.c++;
    if(PG.u>=WIN||PG.c>=WIN){s.m='over';idle();s.vx=s.vy=0;saveMiniGameScore('pong',PG.u);say(PG.u>PG.c?`¡Ganaste ${PG.u}-${PG.c}! Toca la pelota para jugar otra vez`:`Gana el ordenador ${PG.c}-${PG.u}. Toca la pelota para la revancha`);return}
    s.m='wait';s.t=.8;s.bx=W/2;s.by=H/2;s.vx=s.vy=0;s.dir=u?-1:1}
  function step(dt){
    s.a+=dt*(s.m==='play'?4:.3);
    s.r+=((s.m==='idle'||s.m==='over'?RI:RP)-s.r)*Math.min(1,dt*8);
    if(s.m==='wait'){s.t-=dt;if(s.t<=0)start(s.dir);return}
    const tx=s.m==='play'&&s.vy<0?s.bx+s.err:W/2,mv=(90+s.sp*.6)*V()*dt;s.cx+=Math.max(-mv,Math.min(mv,tx-s.cx));s.cx=Math.max(PW/2,Math.min(W-PW/2,s.cx));
    if(s.m!=='play')return;
    s.bx+=s.vx*dt;s.by+=s.vy*dt;
    if(s.bx<s.r){s.bx=s.r;s.vx=Math.abs(s.vx)}if(s.bx>W-s.r){s.bx=W-s.r;s.vx=-Math.abs(s.vx)}
    const bounce=(px,dir)=>{const n=Math.max(-1,Math.min(1,(s.bx-px)/(PW/2)));s.sp=Math.min(640,s.sp+22);const v=s.sp*V();s.vx=n*v*.75;s.vy=dir*Math.sqrt(v*v-s.vx*s.vx);if(dir<0){const f=1.24+.2*Math.min(1,Math.max(0,(s.sp-300)/340));s.err=(Math.random()-.5)*2*HIT()*f}};
    if(s.vy>0&&s.by+s.r>=UY-PH/2&&s.by<UY+PH&&Math.abs(s.bx-s.ux)<HIT())bounce(s.ux,-1);
    if(s.vy<0&&s.by-s.r<=CY+PH/2&&s.by>CY-PH&&Math.abs(s.bx-s.cx)<HIT())bounce(s.cx,1);
    if(s.by>H+s.r)point(0);else if(s.by<-s.r)point(1)}
  const pad=(px,py)=>{x.beginPath();x.roundRect?x.roundRect(px-PW/2,py-PH/2,PW,PH,7):x.rect(px-PW/2,py-PH/2,PW,PH);x.fillStyle='#ff5fa2';x.fill();x.lineWidth=3;x.strokeStyle='#f8e81c';x.stroke()};
  function ball(){const r=s.r,g=x.createRadialGradient(s.bx-r*.3,s.by-r*.3,r*.1,s.bx,s.by,r);g.addColorStop(0,'#e8ff7a');g.addColorStop(1,'#a9c81d');
    x.fillStyle=g;x.beginPath();x.arc(s.bx,s.by,r,0,7);x.save();x.translate(s.bx,s.by);x.rotate(s.a);const u=r/50;
    const h=(px,py,rx,ry,a)=>{x.moveTo((px+rx*Math.cos(a))*u,(py+rx*Math.sin(a))*u);x.ellipse(px*u,py*u,rx*u,ry*u,a,0,7)};
    h(0,0,7,9,0);for(let i=0;i<6;i++){const a=i/6*6.2832;h(23*Math.cos(a),23*Math.sin(a),6,9,a)}
    for(let i=0;i<10;i++){const a=(i+.5)/10*6.2832;h(38*Math.cos(a),38*Math.sin(a),4,7,a)}x.restore();x.fill('evenodd')}
  function draw(){
    x.clearRect(0,0,W,H);x.fillStyle='#2a62ad';x.fillRect(0,0,W,NY);x.fillStyle='#2f6fbd';x.fillRect(0,NY,W,H-NY);
    x.fillStyle='rgba(255,255,255,.8)';x.fillRect(W*.08,H*.06,W*.84,3);x.fillRect(W*.08,H*.94-3,W*.84,3);
    const g=12*k;x.fillStyle='rgba(14,28,51,.18)';x.fillRect(0,NY-g,W,g*2.8);x.strokeStyle='rgba(14,28,51,.55)';x.lineWidth=1.5;x.beginPath();
    for(let i=0;i<W;i+=g){x.moveTo(i,NY-g*.7);x.lineTo(i,NY+g*1.8)}for(let j=NY-g*.7;j<=NY+g*1.8;j+=g){x.moveTo(0,j);x.lineTo(W,j)}x.stroke();
    x.fillStyle='#fff';x.fillRect(0,NY-g,W,g/2);pad(s.cx,CY);pad(s.ux,UY);
    x.font=`900 ${22*k}px "Arial Black",sans-serif`;x.textAlign='left';x.fillStyle='rgba(255,255,255,.9)';x.fillText('PC '+PG.c,12,NY-g*1.8);x.fillText('TÚ '+PG.u,12,NY+g*4.2);
    if(s.m==='over'){const w=PG.u>PG.c;x.fillStyle='rgba(14,28,51,.78)';x.fillRect(0,0,W,H);x.textAlign='center';
      x.fillStyle='#d4f53c';x.font=`900 ${34*k}px "Arial Black",sans-serif`;x.fillText(w?'¡GANASTE!':'GANA EL PC',W/2,H*.26);
      x.fillStyle='#fff';x.font=`900 ${64*k}px "Arial Black",sans-serif`;x.fillText(PG.u+' - '+PG.c,W/2,H*.26+72*k);
      x.font=`700 ${Math.min(15*k,W/20)}px "Trebuchet MS",sans-serif`;x.fillText('Toca la pelota para jugar otra vez',W/2,H*.26+104*k);x.textAlign='left'}
    ball()}
  let last=performance.now();
  (function f(now){if(!document.body.contains(c))return;fit();if(W){const dt=Math.min(.033,(now-last)/1000);step(dt);draw()}last=now;requestAnimationFrame(f)})(last);
}
function partySubnav(){
  const items=S.started?[['go','Partido','game'],['more','Jugadores','more'],['final','Resumen','final']]:[['setup','Preparar','setup'],['final','Resumen','final']];
  const current={setup:'setup',game:'go',more:'more',final:'final'}[view];
  return `<nav class="party-subnav party-subnav-${items.length}" aria-label="Secciones de Partido">${items.map(x=>`<button data-a="${x[0]}"${x[0]===current?' aria-current="page"':''}>${x[1]}</button>`).join('')}</nav>`;
}
function header(){
  const inParty=['setup','game','more','final'].includes(view);
  const t=[['home',tr('home')],['party',tr('party')],['clubs',tr('clubs')],['activity',tr('activity')]],cur={home:'home',setup:'party',game:'party',more:'party',final:'party',clubs:'clubs','club-detail':'clubs'}[view];
  return`<header class="top"><div class="top-main"><div class="mark">PICKLE<b>&amp;MIX</b></div><div class="who" id="authchip">${authChipIn()}</div></div><nav class="tabs" aria-label="Navegación principal">${t.map(x=>`<button data-a="${x[0]}"${x[0]===cur?' aria-current="page"':''}>${x[1]}</button>`).join('')}${ADMIN.isAdmin?`<button data-a="admin"${view==='admin'?' aria-current="page"':''}>${tr('admin')}</button>`:''}</nav>${inParty?partySubnav():''}</header>`}
function bottomNavigation(){
  const current={home:'home',activity:'activity',setup:'party',game:'party',more:'party',final:'party',clubs:'clubs','club-detail':'clubs',profile:'profile',settings:'profile',friends:'profile',history:'profile',sessions:'profile','session-detail':'profile','user-profile':'profile',admin:'admin'}[view]||'home';
  const items=[['home',tr('home'),'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg>'],['party',tr('party'),'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3 4 7l3 4 3-4-3-4Zm10 10-3 4 3 4 3-4-3-4ZM8 9l8 6M5 19l4-4m6-6 4-4"/></svg>'],['clubs',tr('clubs'),'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m7-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>'],['activity',tr('activity'),'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h4l3-8 4 16 3-8h4"/></svg>'],['profile',tr('profile'),'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>']];
  if(ADMIN.isAdmin)items.push(['admin',tr('admin'),'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 6v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z"/><path d="m9 12 2 2 4-4"/></svg>']);
  return '<nav class="bottom-nav" aria-label="Navegación principal">'+items.map(([id,label,svg])=>'<button type="button" data-a="'+id+'"'+(current===id?' aria-current="page"':'')+'>'+svg+'<span>'+label+'</span></button>').join('')+'</nav>';
}
const GT={
pong:`<svg viewBox="0 0 160 96" aria-hidden="true"><rect width="160" height="96" fill="#2f6fbd"/><rect x="6" y="6" width="148" height="84" rx="4" fill="none" stroke="#fff" stroke-width="2" opacity=".8"/><path d="M6 48H154" stroke="#fff" stroke-width="2" stroke-dasharray="6 5" opacity=".8"/><rect x="56" y="12" width="46" height="8" rx="4" fill="#ff6a4d"/><rect x="66" y="76" width="46" height="8" rx="4" fill="#fff"/><circle cx="84" cy="62" r="4" fill="#d4f53c" opacity=".35"/><circle cx="92" cy="54" r="7" fill="#d4f53c" stroke="#0e1c33" stroke-width="2"/></svg>`,
kitchen:`<svg viewBox="0 0 160 96" aria-hidden="true"><rect width="160" height="96" fill="#12325e"/><polygon points="44,10 116,10 148,90 12,90" fill="#2f7bff" stroke="#fff" stroke-width="2"/><polygon points="31,56 129,56 140,78 20,78" fill="#d4f53c" opacity=".35"/><path d="M80 10V56M80 78V90" stroke="#fff" stroke-width="2"/><rect x="26" y="40" width="108" height="9" rx="3" fill="#0e1c33" opacity=".7"/><rect x="24" y="38" width="112" height="3" rx="1.5" fill="#fff"/><circle cx="98" cy="68" r="7" fill="#d4f53c" stroke="#0e1c33" stroke-width="2"/></svg>`,
dink:`<svg viewBox="0 0 160 96" aria-hidden="true"><rect width="160" height="96" fill="#12325e"/><rect x="48" y="6" width="64" height="84" rx="4" fill="#2f6fbd" stroke="#fff" stroke-width="2"/><rect x="48" y="40" width="64" height="26" fill="#4a8fe0"/><path d="M42 52H118" stroke="#0e1c33" stroke-width="5" stroke-linecap="round"/><path d="M42 52H118" stroke="#fff" stroke-width="2" stroke-dasharray="3 3"/><circle cx="88" cy="22" r="15" fill="#fff" stroke="#ff6a4d" stroke-width="3"/><circle cx="88" cy="22" r="8" fill="#ff6a4d"/><circle cx="88" cy="22" r="3.4" fill="#f8e81c"/><path d="M70 80Q62 52 86 28" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="2 5" stroke-linecap="round"/><circle cx="70" cy="80" r="6" fill="#d4f53c" stroke="#0e1c33" stroke-width="2"/></svg>`,
pairs:`<svg viewBox="0 0 160 96" aria-hidden="true"><rect width="160" height="96" fill="#12325e"/><g stroke="#fff" stroke-opacity=".3" stroke-width="2"><rect x="25" y="12" width="30" height="34" rx="6" fill="#2a62ad"/><rect x="105" y="12" width="30" height="34" rx="6" fill="#2a62ad"/><rect x="65" y="54" width="30" height="34" rx="6" fill="#2a62ad"/><rect x="105" y="54" width="30" height="34" rx="6" fill="#2a62ad"/></g><g fill="#d4f53c"><circle cx="40" cy="29" r="5"/><circle cx="120" cy="29" r="5"/><circle cx="80" cy="71" r="5"/><circle cx="120" cy="71" r="5"/></g><g fill="#fff" stroke="#d4f53c" stroke-width="2.5"><rect x="65" y="12" width="30" height="34" rx="6"/><rect x="25" y="54" width="30" height="34" rx="6"/></g><g fill="#f8e81c" stroke="#0e1c33" stroke-width="2"><circle cx="80" cy="29" r="10"/><circle cx="40" cy="71" r="10"/></g></svg>`};
const GM=[['pong','Pong','Duelo contra el ordenador a 7 puntos','play'],['pairs','Pickle Pairs','Memoria: encuentra las parejas, de 1 a 4 jugadores','pairs'],['kitchen','Kitchen Rush','Reflejos: espera el bote en la Kitchen','kitchen'],['dink','Dink Shot','Puntería: apunta a la diana con viento','dink']];
const gameCard=g=>{const gated=(g[0]==='kitchen'||g[0]==='dink'),locked=gated&&!AU.user;return `<button class="gc ${locked?'gc-registered':''}" data-a="${g[3]}" aria-label="${locked?'Juego para usuarios registrados: ':''}Jugar a ${g[1]}"><span class="th">${GT[g[0]]}</span><span class="tx"><b>${g[1]}</b><span>${g[2]}</span></span>${locked?'<span class="gc-lock"><span class="gc-lock-icon" aria-hidden="true">🔒</span><b>Gratis con registro</b></span>':''}</button>`};
const gamesGrid=()=>`<section class="games-section"><h2 class="gt">Minijuegos</h2><p class="lead">Para pasar el rato mientras te toca descansar.</p><div class="games games-open">${GM.slice(0,2).map(gameCard).join('')}</div><div class="games-registered-heading"><span>Más juegos para la comunidad</span>${AU.user?'':'<small>GRATIS AL REGISTRARTE</small>'}</div><div class="games games-registered ${AU.user?'games-registered-unlocked':''}">${GM.slice(2).map(gameCard).join('')}</div></section>`;
function vHome(){const n=S.players.length,c=S.settings;
  return`<p class="sub tagline">Elige tu modo de juego, disfruta con tus amigos y consigue <b>tu ranking</b> automáticamente</p>
  <div class="card"><div class="big">${n}</div><div>jugadores inscritos</div><div class="chips" style="margin-top:12px"><span class="chip">${c.courts} pista${c.courts>1?'s':''}</span><span class="chip">a ${c.points} puntos</span>${FX()?'':`<span class="chip">${c.cycles} ciclos</span>`}<span class="chip">${FX()?'grupos + eliminatorias':'parejas rotatorias'}</span></div></div>
  ${S.started?'<button class="btn ball" data-a="go">Continuar la quedada</button>':''}
  <button class="btn ghost" data-a="${S.started?'more':'setup'}">Gestionar participantes</button>
  ${gamesGrid()}`}
function profileMini(p){return '<div class="friend-person">'+(p.avatar_url?'<img class="av" src="'+esc(p.avatar_url)+'" alt="">':'<span class="av">'+esc((p.display_name||'?').slice(0,1).toUpperCase())+'</span>')+'<div class="friend-person-info"><b>'+esc(p.display_name||'Jugador')+'</b><span class="mut">@'+esc(p.alias||'')+'</span></div></div>'}
function profileLink(p){return '<button type="button" class="friend-profile-link" data-up="'+p.id+'">'+profileMini(p)+'</button>'}
function friendState(id){const f=FR.items.find(x=>x.requester_id===id||x.addressee_id===id);if(!f)return null;if(f.status==='accepted')return'friend';return f.requester_id===AU.user.id?'sent':'received'}
async function loadFriendLeaderboard(){
  if(!sbc||!AU.user)return;
  FR.rankingLoading=true;paintFriends();
  const people=[{id:AU.user.id,display_name:AU.profile?.display_name||auName(AU.user),avatar_url:AU.profile?.avatar_url||null,isMe:true},
    ...FR.items.filter(f=>f.status==='accepted').map(f=>{const id=f.requester_id===AU.user.id?f.addressee_id:f.requester_id;return FR.people.find(p=>p.id===id)}).filter(Boolean)];
  try{
    const rows=await Promise.all(people.map(async p=>{
      const {data,error}=await sbc.rpc('get_user_stats',{p_user_id:p.id});
      if(error||!data||!data.played)return null;
      return{...p,stats:data};
    }));
    FR.ranking=rows.filter(Boolean).sort((a,b)=>b.stats.win_rate-a.stats.win_rate||b.stats.wins-a.stats.wins||b.stats.played-a.stats.played);
  }catch(error){console.warn('[friends] ranking:',error&&error.message);FR.ranking=[]}
  finally{FR.rankingLoading=false;paintFriends()}
}
function vFriends(){
  if(!AU.user)return '<h2>Amigos</h2><p class="lead">Inicia sesión con Google para encontrar jugadores y crear tu red de amigos.</p><div class="card acct">'+authInner()+'</div>';
  if(!AU.profile)return '<h2>Amigos</h2><div class="card"><p class="hint">Necesitamos cargar tu perfil para gestionar tus amistades.</p><button class="btn" data-a="reloadProfile">Reintentar</button></div>';
  const incoming=FR.items.filter(f=>f.status==='pending'&&f.addressee_id===AU.user.id);
  const outgoing=FR.items.filter(f=>f.status==='pending'&&f.requester_id===AU.user.id);
  const accepted=FR.items.filter(f=>f.status==='accepted');
  const byId=id=>FR.people.find(p=>p.id===id)||{id,display_name:'Jugador',alias:''};
  const search=FR.results.filter(p=>p.id!==AU.user.id);
  const results=search.map(p=>{const s=friendState(p.id),req=FR.items.find(f=>f.status==='pending'&&f.requester_id===p.id&&f.addressee_id===AU.user.id),busy=FR.busy===('accept:'+((req&&req.id)||''))||FR.busy===('send:'+p.id);return '<div class="friend-row">'+profileLink(p)+(s==='friend'?'<span class="tag">Amigos</span>':s==='sent'?'<span class="tag">Enviada</span>':s==='received'?'<button class="btn sm" data-fa="accept" data-id="'+(req?req.id:'')+'" '+(!req||busy?'disabled':'')+'>Aceptar</button>':'<button class="btn sm" data-fa="send" data-id="'+p.id+'" '+(busy?'disabled':'')+'>Añadir</button>')+'</div>'}).join('');
  const requests=incoming.map(f=>{const busy=FR.busy==='accept:'+f.id||FR.busy==='reject:'+f.id;return '<div class="friend-row">'+profileLink(byId(f.requester_id))+'<div class="friend-actions"><button class="btn sm" data-fa="accept" data-id="'+f.id+'" '+(busy?'disabled':'')+'>Aceptar</button><button class="btn sm ghost" data-fa="reject" data-id="'+f.id+'" '+(busy?'disabled':'')+'>Rechazar</button></div></div>'}).join('');
  const sent=outgoing.map(f=>'<div class="friend-row">'+profileLink(byId(f.addressee_id))+'<button class="btn sm ghost" data-fa="cancel" data-id="'+f.id+'">Cancelar</button></div>').join('');
  const friends=accepted.map(f=>{const id=f.requester_id===AU.user.id?f.addressee_id:f.requester_id;return '<div class="friend-row">'+profileLink(byId(id))+'<button class="btn sm ghost" data-fa="remove" data-id="'+f.id+'">Eliminar</button></div>'}).join('');
  const ranking=FR.rankingLoading?'<p class="mut">Calculando clasificación…</p>':FR.ranking.length?FR.ranking.map((p,i)=>'<div class="friend-row leaderboard-row"><span class="leader-position">'+(i+1)+'</span>'+profileLink(p)+'<span class="leader-stats"><b>'+Math.round(p.stats.win_rate*100)+'%</b><small>'+p.stats.wins+'V · '+p.stats.played+' PJ</small></span></div>').join(''):'<p class="mut">Todavía no hay partidos guardados suficientes para crear una clasificación. Guarda tus quedadas y las de tus amigos.</p>';
  return '<div class="friends-dashboard"><section class="card friends-hero"><div class="friends-hero-copy"><span class="section-kicker">PICKLE &amp; MIX · COMUNIDAD</span><h2>Juega en compañía.</h2><p>Encuentra jugadores, conecta con tus amigos y sigue vuestra evolución.</p></div><div class="friends-overview"><button type="button" data-community-panel="friends" aria-pressed="'+(FR.panel==='friends')+'"><b>'+accepted.length+'</b><span>Amigos</span><small>Ver lista ›</small></button><button type="button" data-community-panel="requests" aria-pressed="'+(FR.panel==='requests')+'"><b>'+incoming.length+'</b><span>Solicitudes</span><small>Gestionar ›</small></button></div></section>'+
    '<form class="card friend-search friends-section" data-f="friend-search"><label for="friend-query">Buscar jugadores</label><div class="row"><input id="friend-query" name="q" maxlength="40" placeholder="Nombre o @alias" value="'+esc(FR.query)+'" autocomplete="off"><button class="btn sm" type="submit" '+(FR.searching?'disabled':'')+'>'+(FR.searching?'Buscando…':'Buscar')+'</button></div><small>Para aparecer en las búsquedas, cada usuario debe elegir un alias en su configuración de perfil.</small></form>'+
    (FR.panel==='friends'?'<section class="card friends-section community-detail-panel"><div class="friends-section-head"><h3>Mis amigos</h3><span class="friends-total">'+accepted.length+'</span></div>'+(friends||'<p class="mut">Todavía no tienes amigos añadidos.</p>')+'</section>':'')+
    (FR.error?'<div class="err" role="alert">'+esc(FR.error)+'</div>':'')+
    (FR.query?'<section class="card friends-section"><div class="friends-section-head"><h3>Resultados</h3><span class="section-kicker">BÚSQUEDA</span></div>'+(FR.searching?'<p class="hint">Buscando jugadores…</p>':results||'<p class="empty">No hemos encontrado usuarios con ese nombre o alias.</p>')+'</section>':'')+
    (FR.panel==='requests'?'<section class="card friends-section community-detail-panel"><div class="friends-section-head"><h3>Solicitudes recibidas '+(incoming.length?'<span class="tag">'+incoming.length+'</span>':'')+'</h3><span class="section-kicker">PENDIENTES</span></div>'+(FR.loading?'<p class="hint">Cargando…</p>':requests||'<p class="mut">No tienes solicitudes pendientes.</p>')+'</section><section class="card friends-section community-detail-panel"><div class="friends-section-head"><h3>Solicitudes enviadas</h3><span class="section-kicker">ENVIADAS</span></div>'+(sent||'<p class="mut">No tienes solicitudes enviadas.</p>')+'</section>':'')+
    '<section class="card friends-section friends-ranking"><div class="friends-section-head"><h3>Clasificación</h3><span class="section-kicker">ENTRE AMIGOS</span></div>'+ranking+'</section>'+
    '<button class="btn ghost friends-back" data-a="profile">← Volver a Mi perfil</button></div>';
}

/* ---------- Clubes ---------- */
function paintClubs(){if(view!=='clubs'&&view!=='club-detail')return;const root=document.querySelector('#app');if(!root)return;try{root.innerHTML=header()+(view==='club-detail'?vClubDetail():vClubs())+bottomNavigation();translateDOM(root)}catch(error){console.error('[clubs] render error:',error);if(view==='club-detail'&&CL.openPostId){CL.openPostId=null;try{root.innerHTML=header()+vClubDetail()+bottomNavigation();translateDOM(root);toast('No se ha podido abrir la publicación. El club sigue disponible.');return}catch(fallbackError){console.error('[clubs] fallback render error:',fallbackError)}}root.innerHTML=header()+'<section class="card" style="margin:20px;padding:20px"><h3>No se ha podido mostrar esta sección</h3><p>Se ha producido un error al cargar el contenido. Vuelve a intentarlo.</p><button class="btn" type="button" data-a="clubs">Volver a clubes</button></section>'+bottomNavigation()}}
async function loadClubs(){
  if(!sbc||!AU.user)return;
  CL.loading=true;CL.error='';paintClubs();
  try{
    const [clubs,members,invitations,counts]=await Promise.all([
      sbc.from('clubs').select('id,name,description,city,created_by,created_at,avatar_url,banner_url,access_mode,club_type,official_status,official_address,official_province,official_email,official_phone,official_website').order('created_at',{ascending:false}),
      sbc.from('club_members').select('club_id,user_id,role,joined_at').order('joined_at',{ascending:true}),
      sbc.from('club_invitations').select('id,club_id,invited_by,created_at').eq('invited_user_id',AU.user.id).eq('status','pending').order('created_at',{ascending:false}),
      sbc.rpc('get_club_member_counts')
    ]);
    if(clubs.error)throw clubs.error;if(members.error)throw members.error;if(invitations.error)throw invitations.error;if(counts.error)throw counts.error;
    CL.items=clubs.data||[];CL.members=members.data||[];CL.memberCounts=Object.fromEntries((counts.data||[]).map(row=>[row.club_id,Number(row.member_count)]));CL.incomingInvites=invitations.data||[];
    const ids=[...new Set(CL.members.map(m=>m.user_id))];
    if(ids.length){const p=await sbc.from('profiles').select('id,display_name,alias,avatar_url').in('id',ids);if(p.error)throw p.error;CL.people=p.data||[]}else CL.people=[];
  }catch(error){console.warn('[clubs] load:',error&&error.message);CL.error='No se han podido cargar los clubes. Inténtalo de nuevo.'}
  finally{CL.loading=false;paintClubs();if(view==='club-detail'&&CL.selectedId&&CL.items.some(c=>c.id===CL.selectedId))loadClubData(CL.selectedId)}
}
function clubPerson(id){return CL.people.find(p=>p.id===id)||{id,display_name:'Jugador',alias:''}}
function clubMember(clubId,userId){return CL.members.find(m=>m.club_id===clubId&&m.user_id===userId)}
function clubAdmin(id){const m=clubMember(id,AU.user&&AU.user.id);return !!m&&m.role==='admin'}
function clubDate(v){return v?new Date(v).toLocaleString(APP_LANG==='en'?'en-US':'es-ES',{dateStyle:'medium',timeStyle:'short'}):''}
function clubEventType(t){return t==='training'?'Entrenamiento':t==='tournament'?'Torneo':'Quedada'}
async function openActivityClubItem(kind,itemId,clubId){
  if(!sbc||!AU.user||!clubId||!itemId)return;
  if(kind!=='event'&&kind!=='post')return;
  // Primero carga el directorio y las membresías: la vista de detalle depende de ambos.
  CL.selectedId=clubId;CL.tab=kind==='event'?'events':'posts';CL.openPostId=null;CL.openEventId=null;CL.settingsOpen=false;CL.eventOpen=false;CL.postOpen=false;CL.inviteUrl='';
  view='clubs';render();
  await loadClubs();
  if(CL.selectedId!==clubId)return;
  if(!CL.items.some(c=>c.id===clubId)){CL.selectedId=null;toast('Este club ya no está disponible.');return;}
  view='club-detail';render();
  await loadClubData(clubId);
  if(CL.selectedId!==clubId||view!=='club-detail')return;
  if(kind==='event'){
    if(CL.events.some(x=>x.id===itemId)){CL.openEventId=itemId;paintClubs()}
    else toast('Este evento ya no está disponible.');
  }else{
    if(CL.posts.some(x=>x.id===itemId)){CL.openPostId=itemId;paintClubs()}
    else toast('Esta publicación ya no está disponible.');
  }
}
async function loadClubData(id){
 if(!sbc||!AU.user)return;const mine=clubMember(id,AU.user.id);
 try{const [req,inv,events,links,posts]=await Promise.all([
 mine&&mine.role==='admin'?sbc.from('club_join_requests').select('*').eq('club_id',id).eq('status','pending').order('created_at'):Promise.resolve({data:[],error:null}),
 mine&&mine.role==='admin'?sbc.from('club_invitations').select('*').eq('club_id',id).eq('status','pending'):sbc.from('club_invitations').select('*').eq('club_id',id).eq('invited_user_id',AU.user.id).eq('status','pending'),
 mine?sbc.from('club_events').select('*').eq('club_id',id).order('starts_at'):Promise.resolve({data:[],error:null}),
 mine&&mine.role==='admin'?sbc.from('club_invite_links').select('*').eq('club_id',id).is('revoked_at',null).order('created_at',{ascending:false}):Promise.resolve({data:[],error:null}),mine?sbc.from('club_posts').select('*').eq('club_id',id).order('created_at',{ascending:false}):Promise.resolve({data:[],error:null})]);
 for(const x of [req,inv,events,links,posts])if(x.error)throw x.error;
 CL.requests=req.data||[];CL.invitations=inv.data||[];CL.events=events.data||[];CL.links=links.data||[];CL.posts=posts.data||[];CL.comments=[];CL.myRequest=null;
 if(!mine){const mr=await sbc.from('club_join_requests').select('id,status,created_at').eq('club_id',id).eq('user_id',AU.user.id).eq('status','pending').maybeSingle();if(mr.error)throw mr.error;CL.myRequest=mr.data||null}
 const postIds=CL.posts.map(x=>x.id);if(postIds.length){const cr=await sbc.from('club_post_comments').select('*').in('post_id',postIds).order('created_at');if(cr.error)throw cr.error;CL.comments=cr.data||[]}const eids=CL.events.map(x=>x.id);if(eids.length){const rr=await sbc.from('club_event_registrations').select('*').in('event_id',eids).order('created_at');if(rr.error)throw rr.error;CL.registrations=rr.data||[]}else CL.registrations=[];
 const ids=[...new Set([...CL.requests.map(x=>x.user_id),...CL.invitations.flatMap(x=>[x.invited_by,x.invited_user_id]),...CL.registrations.map(x=>x.user_id),...CL.posts.map(x=>x.created_by),...CL.comments.map(x=>x.user_id)])].filter(x=>!CL.people.some(p=>p.id===x));
 if(ids.length){const p=await sbc.from('profiles').select('id,display_name,alias,avatar_url').in('id',ids);if(p.error)throw p.error;CL.people=[...CL.people,...(p.data||[])]}
 }catch(e){console.warn('[clubs] detail load',e);toast('No se ha podido actualizar toda la información del club.')}finally{paintClubs()}
}
async function cancelClubJoinRequest(){if(!CL.myRequest)return;const {error}=await sbc.from('club_join_requests').delete().eq('id',CL.myRequest.id);if(error){toast('No se ha podido cancelar la solicitud.');return}CL.myRequest=null;await loadClubData(CL.selectedId);toast('Solicitud cancelada.')}
async function respondClubRequest(id,accept){try{const {error}=await sbc.rpc('respond_club_join_request',{p_request_id:id,p_accept:accept});if(error)throw error;toast(accept?'Solicitud aceptada.':'Solicitud rechazada.');await loadClubs();await loadClubData(CL.selectedId);loadMyAchievements()}catch(e){toast(e.message||'No se ha podido responder a la solicitud.')}}
async function respondClubInvite(id,accept){try{const {error}=await sbc.rpc('respond_club_invitation',{p_invitation_id:id,p_accept:accept});if(error)throw error;toast(accept?'Ya formas parte del club.':'Invitación rechazada.');await loadClubs();if(CL.selectedId)await loadClubData(CL.selectedId);loadMyAchievements()}catch(e){toast(e.message||'No se ha podido responder a la invitación.')}}
async function manageClubMember(userId,action){if(!confirm(action==='remove'?'¿Expulsar a este miembro?':action==='promote'?'¿Nombrar administrador?':'¿Retirar el rol de administrador?'))return;try{const {error}=await sbc.rpc('manage_club_member',{p_club_id:CL.selectedId,p_user_id:userId,p_action:action});if(error)throw error;await loadClubs();await loadClubData(CL.selectedId);loadMyAchievements();toast('Miembros actualizados.')}catch(e){toast(e.message||'No se ha podido modificar el miembro.')}}
async function saveClubSettings(form){
 const fd=new FormData(form),name=String(fd.get('name')||'').trim(),city=String(fd.get('city')||'').trim(),type=String(fd.get('club_type')||'friends'),current=CL.items.find(x=>x.id===CL.selectedId),address=String(fd.get('official_address')||'').trim(),province=String(fd.get('official_province')||'').trim(),email=String(fd.get('official_email')||'').trim(),phone=String(fd.get('official_phone')||'').trim(),website=String(fd.get('official_website')||'').trim();
 if(name.length<3||name.length>50){toast('El nombre debe tener entre 3 y 50 caracteres.');return}
 if(type==='official'&&(!city||!address||(!email&&!phone&&!website))){toast('Para un Club Oficial indica ciudad, dirección y al menos un medio de contacto.');return}
 if(website&&!(website.startsWith('https://')||website.startsWith('http://'))){toast('La página web debe comenzar por http:// o https://.');return}
 try{const status=type==='friends'?(current&&current.official_status==='pending'?'none':current&&current.official_status||'none'):current&&current.official_status==='verified'?'verified':'pending';
 const {error}=await sbc.from('clubs').update({name,description:String(fd.get('description')||'').trim(),city,access_mode:String(fd.get('access_mode')||'open'),club_type:type,members_can_create_events:fd.has('members_can_create_events'),members_can_create_posts:fd.has('members_can_create_posts'),official_status:status,official_address:type==='official'?address:null,official_province:type==='official'?province:null,official_email:type==='official'?email:null,official_phone:type==='official'?phone:null,official_website:type==='official'?website:null}).eq('id',CL.selectedId);
 if(error)throw error;CL.settingsOpen=false;await loadClubs();await loadClubData(CL.selectedId);toast(type==='official'&&status==='pending'?'Solicitud de Club Oficial enviada o actualizada.':'Configuración guardada.');
 }catch(e){toast(e.message||'No se han podido guardar los cambios.')}
}
async function inviteClubMember(form){
 const alias=String(new FormData(form).get('alias')||'').trim().replace(/^@/,'').toLowerCase();if(!alias)return;
 try{const p=await sbc.from('profiles').select('id,alias').eq('alias',alias).maybeSingle();if(p.error)throw p.error;if(!p.data){toast('No se ha encontrado ese alias.');return}
 if(p.data.id===AU.user.id||clubMember(CL.selectedId,p.data.id)){toast('Ese jugador ya es miembro o no puede ser invitado.');return}
 const old=await sbc.from('club_invitations').select('id,status').eq('club_id',CL.selectedId).eq('invited_user_id',p.data.id).maybeSingle();if(old.error)throw old.error;
 if(old.data&&old.data.status==='pending'){toast('Ya existe una invitación pendiente.');return}
 if(old.data){const del=await sbc.from('club_invitations').delete().eq('id',old.data.id);if(del.error)throw del.error}
 const ins=await sbc.from('club_invitations').insert({club_id:CL.selectedId,invited_user_id:p.data.id,invited_by:AU.user.id,status:'pending'});if(ins.error)throw ins.error;
 form.reset();toast('Invitación enviada.');await loadClubData(CL.selectedId)
 }catch(e){toast(e.message||'No se ha podido enviar la invitación.')}}
async function createClubInviteLink(){try{const {data,error}=await sbc.from('club_invite_links').insert({club_id:CL.selectedId,created_by:AU.user.id}).select('token').single();if(error)throw error;CL.inviteUrl=location.origin+location.pathname+'?club_invite='+data.token;paintClubs();toast('Enlace creado.');await loadClubData(CL.selectedId)}catch(e){toast(e.message||'No se ha podido crear el enlace.')}}
async function revokeClubInvitation(id){const {error}=await sbc.from('club_invitations').delete().eq('id',id);if(error){toast('No se ha podido revocar la invitación.');return}toast('Invitación revocada.');await loadClubData(CL.selectedId)}
async function revokeClubInviteLink(id){if(!confirm('¿Revocar este enlace?'))return;const {error}=await sbc.from('club_invite_links').update({revoked_at:new Date().toISOString()}).eq('id',id);if(error){toast('No se ha podido revocar.');return}await loadClubData(CL.selectedId)}
async function createClubEvent(form){
 const fd=new FormData(form),start=new Date(String(fd.get('starts_at')||'')),endRaw=String(fd.get('ends_at')||''),end=endRaw?new Date(endRaw):null;
 if(Number.isNaN(start.getTime())||start<=new Date()||(end&&Number.isNaN(end.getTime()))){toast('Comprueba las fechas.');return}
 const payload={club_id:CL.selectedId,created_by:AU.user.id,title:String(fd.get('title')||'').trim(),description:String(fd.get('description')||''),event_type:String(fd.get('event_type')||'meetup'),location:String(fd.get('location')||''),starts_at:start.toISOString(),ends_at:end?end.toISOString():null,capacity:fd.get('capacity')?Number(fd.get('capacity')):null};
 try{const {error}=await sbc.from('club_events').insert(payload);if(error)throw error;CL.eventOpen=false;form.reset();toast('Evento publicado.');await loadClubData(CL.selectedId)}catch(e){toast(e.message||'No se ha podido crear el evento.')}}
async function createClubPost(form){const fd=new FormData(form),title=String(fd.get('title')||'').trim(),body=String(fd.get('body')||'').trim();if(title.length<3||title.length>150||!body||body.length>5000){toast('Revisa el titular y el contenido de la publicación.');return}try{const {error}=await sbc.from('club_posts').insert({club_id:CL.selectedId,created_by:AU.user.id,title,body,comments_enabled:fd.has('comments_enabled')});if(error)throw error;CL.postOpen=false;toast('Publicación creada.');await loadClubData(CL.selectedId)}catch(e){toast(e.message||'No se ha podido crear la publicación.')}}
async function createClubComment(form){const fd=new FormData(form),post_id=String(fd.get('post_id')||''),body=String(fd.get('body')||'').trim();if(!post_id||!body||body.length>1200)return;try{const {error}=await sbc.from('club_post_comments').insert({post_id,user_id:AU.user.id,body});if(error)throw error;form.reset();await loadClubData(CL.selectedId)}catch(e){toast(e.message||'No se ha podido publicar el comentario.')}}
async function toggleClubPostComments(id,enabled){const {error}=await sbc.from('club_posts').update({comments_enabled:!enabled}).eq('id',id).eq('club_id',CL.selectedId);if(error){toast('No se ha podido cambiar la configuración de comentarios.');return}await loadClubData(CL.selectedId)}
async function updateClubPost(form){const fd=new FormData(form),id=String(fd.get('post_id')||''),title=String(fd.get('title')||'').trim(),body=String(fd.get('body')||'').trim();if(!id||title.length<3||title.length>150||!body||body.length>5000){toast('Revisa el titular y el contenido de la publicación.');return}try{const {error}=await sbc.from('club_posts').update({title,body,comments_enabled:fd.has('comments_enabled')}).eq('id',id).eq('created_by',AU.user.id);if(error)throw error;CL.editingPostId=null;toast('Publicación actualizada.');await loadClubData(CL.selectedId)}catch(e){toast(e.message||'No se ha podido actualizar la publicación.')}}
async function deleteClubPost(id){if(!confirm('¿Eliminar esta publicación y todos sus comentarios?'))return;const {error}=await sbc.from('club_posts').delete().eq('id',id);if(error){toast('No se ha podido eliminar la publicación.');return}CL.openPostId=null;CL.editingPostId=null;await loadClubData(CL.selectedId)}
async function deleteClubComment(id){if(!confirm('¿Eliminar este comentario?'))return;const {error}=await sbc.from('club_post_comments').delete().eq('id',id);if(error){toast('No se ha podido eliminar el comentario.');return}await loadClubData(CL.selectedId)}
async function registerClubEvent(id){try{const {data,error}=await sbc.rpc('register_club_event',{p_event_id:id});if(error)throw error;toast(data==='waitlist'?'Te has añadido a la lista de espera.':'¡Te has apuntado!');await loadClubData(CL.selectedId)}catch(e){toast(e.message||'No se ha podido completar la inscripción.')}}
async function cancelClubEventRegistration(id){try{const {error}=await sbc.rpc('cancel_club_event_registration',{p_event_id:id});if(error)throw error;toast('Inscripción cancelada.');await loadClubData(CL.selectedId)}catch(e){toast(e.message||'No se ha podido cancelar.')}}
async function deleteClubEvent(id){if(!confirm('¿Eliminar este evento y sus inscripciones?'))return;const {error}=await sbc.from('club_events').delete().eq('id',id);if(error){toast('No se ha podido eliminar.');return}await loadClubData(CL.selectedId)}
let IMAGE_EDITOR=null;
function closeImageEditor(){if(IMAGE_EDITOR&&IMAGE_EDITOR.url)URL.revokeObjectURL(IMAGE_EDITOR.url);document.querySelector('[data-image-editor]')?.remove();IMAGE_EDITOR=null}
function openImageEditor(file,opts){
 closeImageEditor();const url=URL.createObjectURL(file),img=new Image();
 IMAGE_EDITOR={url,img,opts,zoom:1,panX:0,panY:0,drag:null,viewW:320,viewH:opts.kind==='banner'?106.67:320};
 img.onload=()=>{
  const st=IMAGE_EDITOR;if(!st||st.url!==url)return;
  const aspect=opts.kind==='banner'?3:1,outW=960,outH=Math.round(outW/aspect);
  document.body.insertAdjacentHTML('beforeend','<div class="image-editor-backdrop" data-image-editor><section class="image-editor" role="dialog" aria-modal="true" aria-labelledby="image-editor-title"><div class="image-editor-head"><div><span class="section-kicker">VISTA PREVIA</span><h3 id="image-editor-title">'+esc(opts.title||'Ajustar imagen')+'</h3></div><button type="button" class="image-editor-close" data-image-editor-action="cancel" aria-label="Cerrar">×</button></div><p class="image-editor-help">Arrastra la imagen para encuadrarla y utiliza el control para ampliar o reducir.</p><div class="image-editor-stage '+(opts.kind==='banner'?'wide':'square')+'"><canvas data-image-editor-canvas width="'+outW+'" height="'+outH+'"></canvas></div><label class="image-editor-zoom">Zoom <input type="range" min="1" max="3" step="0.01" value="1" data-image-editor-zoom></label><div class="image-editor-actions"><button type="button" class="btn ghost" data-image-editor-action="cancel">Cancelar</button><button type="button" class="btn" data-image-editor-action="apply">Usar esta imagen</button></div></section></div>');
  const canvas=document.querySelector('[data-image-editor-canvas]'),ctx=canvas.getContext('2d');
  const draw=()=>{const w=st.viewW,h=st.viewH,scale=Math.max(w/img.width,h/img.height)*st.zoom,iw=img.width*scale,ih=img.height*scale,bx=(w-iw)/2,by=(h-ih)/2,x=Math.max(w-iw,Math.min(0,bx+st.panX)),y=Math.max(h-ih,Math.min(0,by+st.panY));st.panX=x-bx;st.panY=y-by;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,x*3,y*3,iw*3,ih*3)};
  st.draw=draw;draw();
  canvas.addEventListener('pointerdown',e=>{st.drag={x:e.clientX,y:e.clientY,px:st.panX,py:st.panY};canvas.setPointerCapture(e.pointerId)});
  canvas.addEventListener('pointermove',e=>{if(!st.drag)return;const r=canvas.getBoundingClientRect(),k=st.viewW/r.width;st.panX=st.drag.px+(e.clientX-st.drag.x)*k;st.panY=st.drag.py+(e.clientY-st.drag.y)*k;draw()});
  const end=()=>st.drag=null;canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
  document.querySelector('[data-image-editor-zoom]').addEventListener('input',e=>{st.zoom=Number(e.target.value);draw()});
 };
 img.onerror=()=>{closeImageEditor();toast('No se ha podido abrir esta imagen.')};img.src=url;
}
async function applyImageEditor(){
 const st=IMAGE_EDITOR;if(!st)return;const canvas=document.querySelector('[data-image-editor-canvas]');if(!canvas)return;
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.9));if(!blob){toast('No se ha podido preparar la imagen.');return}
 const fn=st.opts.onConfirm;closeImageEditor();await fn(blob);
}
async function uploadClubImage(file,kind){
 if(!file)return;
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){toast('Usa JPG, PNG o WebP de máximo 5 MB.');return}
 const id=CL.selectedId;
 openImageEditor(file,{kind:kind==='banner'?'banner':'square',title:kind==='banner'?'Ajustar banner del club':'Ajustar foto del club',onConfirm:async blob=>{
  const path=id+'/'+kind+'.jpg';
  try{const {error}=await sbc.storage.from('club-assets').upload(path,blob,{upsert:true,contentType:'image/jpeg',cacheControl:'3600'});if(error)throw error;
   const {data}=sbc.storage.from('club-assets').getPublicUrl(path),field=kind==='avatar'?'avatar_url':'banner_url';
   const up=await sbc.from('clubs').update({[field]:data.publicUrl+'?v='+Date.now()}).eq('id',id).select('id').maybeSingle();if(up.error)throw up.error;if(!up.data)throw new Error('No se ha podido guardar la imagen: comprueba que sigues siendo administrador de este club.');
   await loadClubs();await loadClubData(id);toast('Imagen actualizada.');
  }catch(e){toast(e.message||'No se ha podido subir la imagen.')}
 }});
}
async function redeemClubInviteFromUrl(){
 const params=new URLSearchParams(location.search),token=params.get('club_invite');if(!token||!AU.user||CL.inviteRedeemBusy)return;CL.inviteRedeemBusy=true;
 try{const {data,error}=await sbc.rpc('redeem_club_invite_link',{p_token:token});if(error)throw error;params.delete('club_invite');history.replaceState(null,'',location.pathname+(params.toString()?'?'+params.toString():'')+location.hash);await loadClubs();CL.selectedId=data;view='club-detail';render();await loadClubData(data);toast('Te has unido al club mediante invitación.');loadMyAchievements()}
 catch(e){toast(e.message||'El enlace de invitación no es válido.')}finally{CL.inviteRedeemBusy=false}}
function vClubs(){
 if(!AU.user)return vAuthLanding();
 const card=c=>{const mine=clubMember(c.id,AU.user.id),count=CL.memberCounts[c.id]??CL.members.filter(m=>m.club_id===c.id).length,mode=c.access_mode||'open',type=c.club_type||'friends',status=c.official_status||'none',typeLabel=type==='official'?'Club Oficial':'Club de amigos',verify=type==='official'?(status==='verified'?' · Verificado':status==='pending'?' · Pendiente de verificación':status==='rejected'?' · Verificación rechazada':''):'',searchText=esc([c.name,c.description,c.city,c.official_province,c.official_address,c.official_email,c.official_phone].filter(Boolean).join(' ').toLocaleLowerCase('es'));
 return '<article class="club-card '+(type==='official'?'official':'friends')+'" data-club-search-text="'+searchText+'"><div class="club-card-main"><div class="club-avatar">'+(c.avatar_url?'<img src="'+esc(c.avatar_url)+'" alt="">':'⌂')+'</div><div class="club-card-copy"><div class="club-card-labels"><div class="club-card-type '+(type==='official'?'official':'friends')+'">'+typeLabel+verify+'</div><span class="club-card-access '+(mode==='open'?'open':mode==='approval'?'approval':'private')+'">'+(mode==='open'?'Abierto':mode==='approval'?'Con aprobación':'Privado')+'</span></div><b>'+esc(c.name)+'</b><span>'+(c.city?esc(c.city)+' · ':'')+count+' '+(count===1?'miembro':'miembros')+'</span><p>'+esc(c.description||'Sin descripción.')+'</p></div></div><div class="club-card-actions">'+(mine?'<span class="tag">'+(mine.role==='admin'?'Administrador':'Miembro')+'</span>':'<span class="tag">'+(mode==='open'?'Acceso libre':mode==='approval'?'Solicitud':'Por invitación')+'</span>')+'<button class="btn sm" data-club-open="'+c.id+'">Ver club</button></div></article>'};
 const group=(type,label,desc,list,empty,preview=false)=>{const shown=preview?list.slice(0,3):list,remaining=list.length-shown.length;return '<section class="club-type-section" data-club-group="'+type+'"><div class="club-type-heading"><div><h3>'+label+'</h3>'+(desc?'<p>'+desc+'</p>':'')+'</div><span>'+list.length+'</span></div>'+(shown.length?shown.map(card).join(''):'<div class="club-empty-state"><span class="club-empty-mark">⌂</span><b>'+empty+'</b></div>')+(preview&&remaining>0?'<button type="button" class="club-directory-more" data-club-directory="'+type+'">Ver todos los clubes <span>'+list.length+'</span><b aria-hidden="true">›</b></button>':'')+'</section>'};
 const createForm=CL.createOpen?'<section class="card club-create-card"><div class="friends-section-head"><h3>Crear un club</h3><span class="section-kicker">NUEVA COMUNIDAD</span></div><form data-f="club-create"><label>Tipo de club</label><select name="club_type" data-club-type><option value="friends">Club de amigos · azul</option><option value="official">Club Oficial · naranja</option></select><label>Nombre del club</label><input name="name" maxlength="50" minlength="3" required placeholder="Ej. Pickleball Warriors"><label>Descripción</label><textarea name="description" maxlength="500" rows="3" placeholder="¿Qué caracteriza a vuestro club?"></textarea><label>Ciudad o zona</label><input name="city" data-club-city maxlength="80" placeholder="Ej. Madrid"><div class="club-official-fields" data-club-official-fields hidden><div class="club-official-note">Los Clubes Oficiales muestran sus datos de contacto y localización. La etiqueta naranja quedará pendiente de verificación hasta que Pickle&Mix la apruebe.</div><label>Dirección</label><input name="official_address" maxlength="180" placeholder="Dirección de las instalaciones"><label>Provincia</label><input name="official_province" maxlength="80" placeholder="Ej. Málaga"><label>Email de contacto</label><input name="official_email" type="email" maxlength="180" placeholder="club@ejemplo.es"><label>Teléfono</label><input name="official_phone" type="tel" maxlength="40" placeholder="Teléfono de contacto"><label>Página web</label><input name="official_website" type="url" maxlength="240" placeholder="https://..."><small>Indica al menos un medio de contacto: email, teléfono o web.</small></div><label>Acceso al club</label><select name="access_mode"><option value="open">Abierto · cualquiera puede unirse</option><option value="approval">Con aprobación · el administrador acepta solicitudes</option><option value="private">Privado · solo mediante invitación</option></select><button class="btn" type="submit" '+(CL.busy==='create'?'disabled':'')+'>'+(CL.busy==='create'?'Creando…':'Crear club')+'</button></form></section>':'';
 const inbox=CL.incomingInvites.map(i=>{const c=CL.items.find(x=>x.id===i.club_id);return '<div class="club-incoming-invite"><div><b>'+esc(c?c.name:'Un club')+'</b><small>Te han invitado a formar parte de este club.</small></div><button class="btn xs" data-club-invitation="accept" data-id="'+i.id+'">Aceptar</button><button class="btn xs ghost" data-club-invitation="reject" data-id="'+i.id+'">Rechazar</button></div>'}).join('');
 const myClubs=CL.items.filter(c=>!!clubMember(c.id,AU.user.id)),adminClubs=myClubs.filter(c=>clubMember(c.id,AU.user.id).role==='admin'),memberClubs=myClubs.filter(c=>clubMember(c.id,AU.user.id).role!=='admin');
 const officialClubs=CL.items.filter(c=>(c.club_type||'friends')==='official'),friendsClubs=CL.items.filter(c=>(c.club_type||'friends')==='friends');
 const directory=['official','friends','managed','member'].includes(CL.directoryGroup);
 const directoryList=CL.directoryGroup==='managed'?adminClubs:CL.directoryGroup==='member'?memberClubs:CL.directoryGroup==='official'?officialClubs:friendsClubs;
 const directoryTitle=CL.directoryGroup==='managed'?'Clubes que administro':CL.directoryGroup==='member'?'Clubes a los que pertenezco':CL.directoryGroup==='official'?'Clubes Oficiales':'Clubes de amigos';
 const listing=CL.loading?'<div class="card"><p class="hint">Cargando clubes…</p></div>':CL.error?'<div class="card err" role="alert">'+esc(CL.error)+'</div>':(!directory&&CL.section==='mine')?'<div class="clubs-list">'+group('managed','Clubes que administro','Gestiona tus comunidades y sus miembros.',adminClubs,'Todavía no administras ningún club.',true)+group('member','Clubes a los que pertenezco','Comunidades de las que formas parte.',memberClubs,'Todavía no perteneces a ningún otro club.')+'</div>':directory?'<section class="clubs-list clubs-directory"><button type="button" class="clubs-directory-back" data-club-directory-back>← '+(CL.directoryGroup==='managed'?'Volver a Mis Clubes':'Volver a Explorar Clubes')+'</button><div class="clubs-list-head"><div><h3>'+directoryTitle+'</h3><p>Todos los clubes de esta categoría.</p></div><input aria-label="Buscar clubes" data-club-search placeholder="Buscar por nombre o ciudad"></div>'+group(CL.directoryGroup,directoryTitle,'',directoryList,CL.directoryGroup==='managed'?'Todavía no administras ningún club.':CL.directoryGroup==='official'?'Todavía no hay Clubes Oficiales.':'Todavía no hay Clubes de amigos.')+'</section>':'<section class="clubs-list"><div class="clubs-list-head"><div><h3>Encuentra tu comunidad</h3><p>Explora clubes oficiales y grupos de jugadores.</p></div></div>'+group('official','Clubes Oficiales','Clubes y entidades deportivas con información pública de contacto y localización.',officialClubs,'Todavía no hay Clubes Oficiales.',true)+group('friends','Clubes de amigos','Grupos y comunidades para organizarse y jugar juntos.',friendsClubs,'Todavía no hay Clubes de amigos.',true)+'</section>';
 return '<div class="clubs-page"><div class="clubs-hero"><div><span class="section-kicker">PICKLE &amp; MIX · COMUNIDAD</span><h2>Clubes</h2><p>Tu espacio para gestionar tus clubes y descubrir nuevas comunidades.</p></div><span class="clubs-hero-mark">⌂</span></div>'+(inbox?'<section class="card club-inbox"><h3>Invitaciones recibidas</h3>'+inbox+'</section>':'')+'<div class="clubs-section-tabs" role="tablist" aria-label="Secciones de clubes"><button type="button" role="tab" aria-selected="'+(CL.section==='mine'?'true':'false')+'" class="'+(CL.section==='mine'?'active':'')+'" data-club-section="mine"><span>Mis Clubes</span><small>'+myClubs.length+'</small></button><button type="button" role="tab" aria-selected="'+(CL.section==='explore'?'true':'false')+'" class="'+(CL.section==='explore'?'active':'')+'" data-club-section="explore"><span>Explorar Clubes</span></button></div><div class="clubs-create-row"><span>¿Quieres crear una comunidad?</span><button class="btn sm ghost" type="button" data-club-create-toggle aria-expanded="'+(CL.createOpen?'true':'false')+'">'+(CL.createOpen?'− Cancelar':'＋ Crear un club')+'</button></div>'+createForm+listing+'</div>';
}
function vClubDetail(){
  const c=CL.items.find(x=>x.id===CL.selectedId);if(!c)return vClubs();
  const mine=clubMember(c.id,AU.user&&AU.user.id),admin=mine&&mine.role==='admin',members=CL.members.filter(m=>m.club_id===c.id),memberCount=CL.memberCounts[c.id]??members.length,mode=c.access_mode||'open',type=c.club_type||'friends',officialStatus=c.official_status||'none';if(!mine||(!admin&&CL.tab==='manage'))CL.tab='info';
  const people=members.map(m=>{const p=clubPerson(m.user_id),owner=m.user_id===c.created_by,canManage=admin&&!owner&&m.user_id!==AU.user.id;return '<div class="club-member-item"><div class="club-member-row"><button type="button" class="club-member-profile" data-up="'+m.user_id+'" aria-label="Ver perfil de '+esc(p.display_name||'Jugador')+'">'+(p.avatar_url?'<img class="av" src="'+esc(p.avatar_url)+'" alt="">':'<span class="av">'+esc((p.display_name||'?').slice(0,1).toUpperCase())+'</span>')+'<span class="club-member-identity"><b>'+esc(p.display_name||'Jugador')+(owner?' · Propietario':'')+'</b><small>'+(p.alias?'@'+esc(p.alias):'')+'</small></span></button><span class="tag">'+(m.role==='admin'?'Administrador':'Miembro')+'</span>'+(canManage?'<button type="button" class="club-member-menu-trigger" data-club-member-menu aria-label="Más opciones para '+esc(p.display_name||'este miembro')+'" aria-haspopup="menu" aria-expanded="false" title="Más opciones"><span class="club-member-menu-dots" aria-hidden="true">⋮</span></button>':'')+'</div>'+(canManage?'<div class="club-member-menu-popover" role="menu" aria-label="Acciones de administración" aria-hidden="true"><button type="button" role="menuitem" data-club-member-action="'+(m.role==='admin'?'demote':'promote')+'" data-id="'+m.user_id+'">'+(m.role==='admin'?'Retirar administrador':'Hacer administrador')+'</button><button type="button" class="danger" role="menuitem" data-club-member-action="remove" data-id="'+m.user_id+'">Expulsar del club</button></div>':'')+'</div>'}).join('');
  const requests=CL.requests.map(r=>{const p=clubPerson(r.user_id);return '<div class="club-request-row"><div><b>'+esc(p.display_name||'Jugador')+'</b><small>'+(p.alias?'@'+esc(p.alias)+' · ':'')+clubDate(r.created_at)+'</small></div><button class="btn xs" data-club-request="accept" data-id="'+r.id+'">Aceptar</button><button class="btn xs ghost" data-club-request="reject" data-id="'+r.id+'">Rechazar</button></div>'}).join('');
  const invited=CL.invitations.map(i=>{const p=clubPerson(i.invited_by),target=clubPerson(i.invited_user_id);return admin?'<div class="club-request-row"><div><b>'+esc(target.display_name||'Jugador invitado')+'</b><small>Invitación pendiente · '+(target.alias?'@'+esc(target.alias):'')+'</small></div><button class="btn xs red" data-club-invite-revoke="'+i.id+'">Revocar</button></div>':'<div class="club-request-row"><div><b>Te han invitado a este club</b><small>Por '+esc(p.display_name||'un administrador')+'</small></div><button class="btn xs" data-club-invitation="accept" data-id="'+i.id+'">Aceptar</button><button class="btn xs ghost" data-club-invitation="reject" data-id="'+i.id+'">Rechazar</button></div>'}).join('');
  const links=CL.links.map(l=>'<div class="club-request-row"><div><b>Enlace de invitación</b><small>'+l.uses_count+' usos'+(l.expires_at?' · Caduca '+clubDate(l.expires_at):' · Sin caducidad')+'</small></div><button class="btn xs ghost" data-club-link-copy="'+l.token+'">Copiar</button><button class="btn xs red" data-club-link-revoke="'+l.id+'">Revocar</button></div>').join('');
  const eventCards=CL.events.map(ev=>{
    const regs=CL.registrations.filter(r=>r.event_id===ev.id),registered=regs.filter(r=>r.status==='registered'),wait=regs.filter(r=>r.status==='waitlist');
    return '<article class="club-event-card"><div class="club-event-card-main"><div class="club-event-top"><span class="tag">'+clubEventType(ev.event_type)+'</span>'+(ev.status==='cancelled'?'<span class="tag">Cancelado</span>':'')+'</div><h4>'+esc(ev.title)+'</h4><div class="club-event-meta"><span>◷ '+clubDate(ev.starts_at)+'</span>'+(ev.location?'<span>⌖ '+esc(ev.location)+'</span>':'')+'<span>♟ '+registered.length+(ev.capacity?' / '+ev.capacity:'')+' inscritos'+(wait.length?' · '+wait.length+' en espera':'')+'</span></div></div><button type="button" class="club-event-open" data-club-event-open="'+ev.id+'">Ver evento <span aria-hidden="true">→</span></button></article>';
  }).join('');
  const selectedEvent=CL.events.find(ev=>ev.id===CL.openEventId);
  const eventModal=selectedEvent?(()=>{
    const ev=selectedEvent,regs=CL.registrations.filter(r=>r.event_id===ev.id),registered=regs.filter(r=>r.status==='registered'),wait=regs.filter(r=>r.status==='waitlist'),mineReg=regs.find(r=>r.user_id===AU.user.id),full=!!(ev.capacity&&registered.length>=ev.capacity),spots=ev.capacity?Math.max(0,ev.capacity-registered.length):null,ended=new Date(ev.starts_at)<new Date(),statusLabel=ev.status==='cancelled'?'Cancelado':ended?'Finalizado':'Próximo';
    const participantRows=list=>list.length?list.map(r=>{const p=clubPerson(r.user_id),initial=String(p.display_name||'J').trim().charAt(0).toUpperCase();return '<div class="club-event-person">'+(p.avatar_url?'<img src="'+esc(p.avatar_url)+'" alt="">':'<span class="club-event-person-fallback">'+esc(initial)+'</span>')+'<span><b>'+esc(p.display_name||'Jugador')+'</b>'+(p.alias?'<small>@'+esc(p.alias)+'</small>':'')+'</span></div>'}).join(''):'<p class="club-event-people-empty">Todavía no hay jugadores en esta lista.</p>';
    return '<div class="club-event-modal" data-club-event-close role="presentation"><section class="club-event-dialog" role="dialog" aria-modal="true" aria-labelledby="club-event-modal-title"><header class="club-event-modal-head"><div><span class="club-event-modal-kicker">EVENTO DEL CLUB · '+esc(c.name)+'</span><div class="club-event-modal-labels"><span class="tag">'+clubEventType(ev.event_type)+'</span><span class="club-event-status '+(ev.status==='cancelled'?'cancelled':ended?'ended':'upcoming')+'">'+statusLabel+'</span></div></div><button type="button" class="club-event-modal-close" data-club-event-close aria-label="Cerrar evento">×</button></header><div class="club-event-modal-content"><h2 id="club-event-modal-title">'+esc(ev.title)+'</h2><div class="club-event-facts"><div class="club-event-fact"><span>Fecha y hora</span><b>'+clubDate(ev.starts_at)+'</b></div>'+(ev.ends_at?'<div class="club-event-fact"><span>Finaliza</span><b>'+clubDate(ev.ends_at)+'</b></div>':'')+(ev.location?'<div class="club-event-fact club-event-fact-wide"><span>Ubicación</span><b>'+esc(ev.location)+'</b></div>':'')+'<div class="club-event-fact"><span>Plazas</span><b>'+(ev.capacity?registered.length+' / '+ev.capacity+' ocupadas':'Sin límite de plazas')+'</b>'+(ev.capacity?'<small>'+(spots?spots+' disponibles':'Aforo completo')+'</small>':'')+'</div><div class="club-event-fact"><span>Lista de espera</span><b>'+wait.length+' '+(wait.length===1?'persona':'personas')+'</b></div></div><section class="club-event-modal-section"><h3>Descripción</h3><p class="club-event-description">'+(ev.description?esc(ev.description).replace(/\n/g,'<br>'):'Este evento no tiene descripción adicional.')+'</p></section><section class="club-event-modal-section"><div class="club-event-people-heading"><h3>Participantes</h3><span>'+registered.length+'</span></div><div class="club-event-people-list">'+participantRows(registered)+'</div></section>'+(wait.length?'<section class="club-event-modal-section"><div class="club-event-people-heading"><h3>Lista de espera</h3><span>'+wait.length+'</span></div><div class="club-event-people-list">'+participantRows(wait)+'</div></section>':'')+'</div><footer class="club-event-modal-footer">'+(ev.status==='scheduled'&&!mineReg?'<button class="btn club-event-primary-action" data-club-event-register="'+ev.id+'">'+(full?'Apuntarme a lista de espera':'Apuntarme al evento')+'</button>':'')+(mineReg?'<button class="btn ghost club-event-primary-action" data-club-event-cancel="'+ev.id+'">'+(mineReg.status==='waitlist'?'Salir de la lista de espera':'Cancelar mi inscripción')+'</button>':'')+(admin?'<button class="btn red club-event-delete-action" data-club-event-delete="'+ev.id+'">Eliminar evento</button>':'')+'</footer></section></div>';
  })():'';
  const settings=admin?'<section class="card club-admin-section"><div class="friends-section-head"><h3>Configuración del club</h3><button class="btn xs ghost" data-club-settings-toggle>'+(CL.settingsOpen?'Cerrar':'Editar')+'</button></div>'+(CL.settingsOpen?'<form data-f="club-settings" class="club-admin-form"><label>Tipo de club</label><select name="club_type" data-club-type><option value="friends" '+(type==='friends'?'selected':'')+'>Club de amigos</option><option value="official" '+(type==='official'?'selected':'')+'>Club Oficial</option></select><label>Nombre</label><input name="name" maxlength="50" required value="'+esc(c.name)+'"><label>Descripción</label><textarea name="description" maxlength="500" rows="3">'+esc(c.description||'')+'</textarea><label>Ciudad o zona</label><input name="city" data-club-city maxlength="80" value="'+esc(c.city||'')+'"><div class="club-official-fields" data-club-official-fields '+(type==='official'?'':'hidden')+'><div class="club-official-note">La información de un Club Oficial es pública. Estado: '+(officialStatus==='verified'?'verificado':officialStatus==='pending'?'pendiente de verificación':officialStatus==='rejected'?'verificación rechazada':'sin verificar')+'.</div><label>Dirección</label><input name="official_address" maxlength="180" value="'+esc(c.official_address||'')+'"><label>Provincia</label><input name="official_province" maxlength="80" value="'+esc(c.official_province||'')+'"><label>Email de contacto</label><input name="official_email" type="email" maxlength="180" value="'+esc(c.official_email||'')+'"><label>Teléfono</label><input name="official_phone" type="tel" maxlength="40" value="'+esc(c.official_phone||'')+'"><label>Página web</label><input name="official_website" type="url" maxlength="240" value="'+esc(c.official_website||'')+'"><small>Indica al menos un medio de contacto: email, teléfono o web.</small></div><div class="club-permission-settings"><h4>Permisos de participación</h4><label class="club-permission-option"><input type="checkbox" name="members_can_create_events" '+(c.members_can_create_events?'checked':'')+'><span><b>Permitir que los miembros creen eventos</b><small>Si está desactivado, solo los administradores podrán hacerlo.</small></span></label><label class="club-permission-option"><input type="checkbox" name="members_can_create_posts" '+(c.members_can_create_posts?'checked':'')+'><span><b>Permitir que los miembros creen publicaciones</b><small>Si está desactivado, solo los administradores podrán publicar noticias.</small></span></label></div><label>Acceso</label><select name="access_mode"><option value="open" '+(mode==='open'?'selected':'')+'>Abierto</option><option value="approval" '+(mode==='approval'?'selected':'')+'>Con aprobación</option><option value="private" '+(mode==='private'?'selected':'')+'>Privado · solo invitación</option></select><button class="btn" type="submit">Guardar cambios</button></form>':'<p class="mut">Acceso: '+(mode==='open'?'Abierto':mode==='approval'?'Con aprobación':'Privado')+'. Puedes cambiarlo y personalizar la imagen y el banner.</p>')+'</section>':'';
  const adminTools=admin?'<section class="card club-admin-section"><h3>Invitar jugadores</h3><form data-f="club-invite" class="club-inline-form"><input name="alias" placeholder="@alias del jugador" required><button class="btn sm" type="submit">Enviar invitación</button></form><button class="btn sm ghost" data-club-link-create>＋ Crear enlace de invitación</button>'+(invited?'<div class="club-admin-list"><h4>Invitaciones pendientes</h4>'+invited+'</div>':'')+(CL.inviteUrl?'<div class="club-share-link"><input readonly value="'+esc(CL.inviteUrl)+'"><button class="btn sm" data-club-copy-current>Copiar enlace</button></div>':'')+(links?'<div class="club-admin-list">'+links+'</div>':'')+'</section>'+(CL.requests.length?'<section class="card club-admin-section"><h3>Solicitudes pendientes <span class="friends-total">'+CL.requests.length+'</span></h3>'+requests+'</section>':''):'';
  const canCreateEvents=admin||!!c.members_can_create_events,canCreatePosts=admin||!!c.members_can_create_posts;
  const postForm=canCreatePosts&&CL.postOpen?'<form data-f="club-post" class="club-admin-form club-post-form"><label>Titular</label><input name="title" maxlength="150" required placeholder="Ej. Nuevos horarios de entrenamiento"><label>Contenido</label><textarea name="body" maxlength="5000" rows="5" required placeholder="Comparte una noticia o información de interés para el club…"></textarea><label class="club-permission-option"><input type="checkbox" name="comments_enabled" checked><span><b>Permitir comentarios</b><small>Los miembros podrán responder a esta publicación.</small></span></label><div class="club-post-form-actions"><button class="btn" type="submit">Publicar noticia</button><button class="btn ghost" type="button" data-club-post-toggle>Cancelar</button></div></form>':'';
  const postFullCards=CL.posts.map(post=>{const author=clubPerson(post.created_by),comments=CL.comments.filter(x=>x.post_id===post.id),own=!!AU.user&&post.created_by===AU.user.id,initial=String(author.display_name||'M').trim().charAt(0).toUpperCase();return '<article class="club-post-card" data-club-post-expanded="true"><div class="club-post-head"><div class="club-post-author">'+(author.avatar_url?'<img class="club-post-avatar" src="'+esc(author.avatar_url)+'" alt="">':'<span class="club-post-avatar club-post-avatar-fallback">'+esc(initial)+'</span>')+'<div class="club-post-author-meta"><b>'+esc(author.display_name||'Miembro del club')+'</b><small>'+clubDate(post.created_at)+'</small></div><span class="club-post-kicker">PUBLICACIÓN</span></div>'+(admin||own?'<div class="club-post-actions"><button type="button" class="club-post-menu btn xs ghost" data-club-post-menu aria-label="Opciones de la publicación" aria-haspopup="menu" aria-expanded="false">⋯</button><div class="club-post-menu-popover" role="menu" aria-hidden="true">'+(own?'<button type="button" role="menuitem" data-club-post-edit="'+post.id+'">Editar</button>':'')+((admin||own)?'<button type="button" class="danger" role="menuitem" data-club-post-delete="'+post.id+'">Eliminar</button>':'')+'</div></div>':'')+'</div>'+(CL.editingPostId===post.id&&own?'<form data-f="club-post-edit" class="club-admin-form club-post-form club-post-edit-form"><input type="hidden" name="post_id" value="'+post.id+'"><label>Titular</label><input name="title" maxlength="150" required value="'+esc(post.title)+'"><label>Contenido</label><textarea name="body" maxlength="5000" rows="5" required>'+esc(post.body)+'</textarea><label class="club-permission-option"><input type="checkbox" name="comments_enabled" '+(post.comments_enabled?'checked':'')+'><span><b>Permitir comentarios</b><small>Los miembros podrán responder a esta publicación.</small></span></label><div class="club-post-form-actions"><button class="btn" type="submit">Guardar cambios</button><button class="btn ghost" type="button" data-club-post-edit-cancel>Cancelar</button></div></form>':'<h4 class="club-post-title">'+esc(post.title)+'</h4><p class="club-post-body">'+esc(post.body)+'</p>')+'<div class="club-post-footer"><span class="club-post-comment-count">▤ '+comments.length+' '+(comments.length===1?'comentario':'comentarios')+'</span>'+(admin?'<button class="btn xs ghost" data-club-post-comments="'+post.id+'" data-enabled="'+(post.comments_enabled?'true':'false')+'">'+(post.comments_enabled?'Desactivar comentarios':'Activar comentarios')+'</button>':'')+'<span class="club-post-comment-status">'+(post.comments_enabled?'Comentarios abiertos':'Comentarios cerrados')+'</span></div>'+'<div class="club-post-comments">'+(comments.map(cm=>{const cp=clubPerson(cm.user_id);const initial=String(cp.display_name||'J').trim().charAt(0).toUpperCase();return '<div class="club-post-comment"><div class="club-comment-topline"><button type="button" class="club-comment-author" data-up="'+esc(cp.id)+'" aria-label="Ver perfil de '+esc(cp.display_name||'miembro')+'">'+(cp.avatar_url?'<img class="club-comment-avatar" src="'+esc(cp.avatar_url)+'" alt="">':'<span class="club-comment-avatar club-comment-avatar-fallback">'+esc(initial)+'</span>')+'<span class="club-comment-author-meta"><b>'+esc(cp.display_name||'Miembro')+'</b>'+(cp.alias?'<small>@'+esc(cp.alias)+'</small>':'')+'</span></button><div class="club-comment-meta-actions"><small class="club-comment-date">'+clubDate(cm.created_at)+'</small>'+((admin||(AU.user&&cm.user_id===AU.user.id))?'<div class="club-comment-admin-actions"><button type="button" class="club-comment-menu-trigger" data-club-comment-menu aria-label="Opciones del comentario" aria-haspopup="menu" aria-expanded="false">⋮</button><div class="club-comment-menu-popover" role="menu" aria-hidden="true"><button type="button" class="danger" role="menuitem" data-club-comment-delete="'+cm.id+'">Eliminar comentario</button></div></div>':'')+'</div></div><p>'+esc(cm.body)+'</p>'}).join('')||'<p class="club-post-no-comments">'+(post.comments_enabled?'Todavía no hay comentarios. ¡Sé el primero!':'Los comentarios están desactivados.')+'</p>')+(post.comments_enabled?'<form data-f="club-comment" class="club-comment-form"><input type="hidden" name="post_id" value="'+post.id+'"><textarea name="body" rows="2" maxlength="1200" required placeholder="Escribe un comentario…"></textarea><button class="btn sm" type="submit">Responder</button></form>':'')+'</div>'+'</article>'}).join('');
   const postCards=CL.posts.map(post=>{const author=clubPerson(post.created_by),comments=CL.comments.filter(x=>x.post_id===post.id),initial=String(author.display_name||'M').trim().charAt(0).toUpperCase(),excerpt=String(post.body||'').trim();return '<article class="club-post-preview" data-club-post-open="'+post.id+'"><div class="club-post-head"><div class="club-post-author">'+(author.avatar_url?'<img class="club-post-avatar" src="'+esc(author.avatar_url)+'" alt="">':'<span class="club-post-avatar club-post-avatar-fallback">'+esc(initial)+'</span>')+'<div class="club-post-author-meta"><b>'+esc(author.display_name||'Miembro del club')+'</b><small>'+clubDate(post.created_at)+'</small></div><span class="club-post-kicker">PUBLICACIÓN</span></div></div><h4 class="club-post-title">'+esc(post.title)+'</h4><p class="club-post-preview-body">'+esc(excerpt.slice(0,190))+(excerpt.length>190?'…':'')+'</p><div class="club-post-preview-footer"><span>▤ '+comments.length+' '+(comments.length===1?'comentario':'comentarios')+'</span><button type="button" data-club-post-open="'+post.id+'">Abrir publicación <span aria-hidden="true">→</span></button></div></article>'}).join('');
   const selectedPost=CL.posts.find(post=>post.id===CL.openPostId);
   const selectedPostAuthor=selectedPost?clubPerson(selectedPost.created_by):null;
   const selectedPostOwn=!!(selectedPost&&AU.user&&selectedPost.created_by===AU.user.id);
   const selectedPostComments=selectedPost?CL.comments.filter(comment=>comment.post_id===selectedPost.id):[];
   const postModal=selectedPost?(()=>{
    const author=selectedPostAuthor||{},initial=String(author.display_name||'M').trim().charAt(0).toUpperCase();
    const authorBlock=(author.avatar_url?'<img class="club-post-avatar" src="'+esc(author.avatar_url)+'" alt="">':'<span class="club-post-avatar club-post-avatar-fallback">'+esc(initial)+'</span>')+'<div class="club-post-author-meta"><b>'+esc(author.display_name||'Miembro del club')+'</b><small>'+clubDate(selectedPost.created_at)+'</small></div>';
    const actions=(admin||selectedPostOwn)?'<div class="club-post-actions"><button type="button" class="club-post-menu btn xs ghost" data-club-post-menu aria-label="Opciones de la publicación" aria-haspopup="menu" aria-expanded="false">⋯</button><div class="club-post-menu-popover" role="menu" aria-hidden="true">'+(selectedPostOwn?'<button type="button" role="menuitem" data-club-post-edit="'+selectedPost.id+'">Editar</button>':'')+'<button type="button" class="danger" role="menuitem" data-club-post-delete="'+selectedPost.id+'">Eliminar</button></div></div>':'';
    const comments=selectedPostComments.map(comment=>{const person=clubPerson(comment.user_id),ci=String(person.display_name||'J').trim().charAt(0).toUpperCase();return '<div class="club-post-comment"><div class="club-comment-topline"><button type="button" class="club-comment-author" data-up="'+esc(person.id)+'" aria-label="Ver perfil de '+esc(person.display_name||'miembro')+'">'+(person.avatar_url?'<img class="club-comment-avatar" src="'+esc(person.avatar_url)+'" alt="">':'<span class="club-comment-avatar club-comment-avatar-fallback">'+esc(ci)+'</span>')+'<span class="club-comment-author-meta"><b>'+esc(person.display_name||'Miembro')+'</b>'+(person.alias?'<small>@'+esc(person.alias)+'</small>':'')+'</span></button><div class="club-comment-meta-actions"><small class="club-comment-date">'+clubDate(comment.created_at)+'</small>'+((admin||(AU.user&&comment.user_id===AU.user.id))?'<div class="club-comment-admin-actions"><button type="button" class="club-comment-menu-trigger" data-club-comment-menu aria-label="Opciones del comentario" aria-haspopup="menu" aria-expanded="false">⋮</button><div class="club-comment-menu-popover" role="menu" aria-hidden="true"><button type="button" class="danger" role="menuitem" data-club-comment-delete="'+comment.id+'">Eliminar comentario</button></div></div>':'')+'</div></div><p>'+esc(comment.body)+'</p></div>'}).join('')||'<p class="club-post-no-comments">'+(selectedPost.comments_enabled?'Todavía no hay comentarios. ¡Sé el primero!':'Los comentarios están desactivados.')+'</p>';
    const commentForm=selectedPost.comments_enabled?'<form data-f="club-comment" class="club-comment-form"><input type="hidden" name="post_id" value="'+selectedPost.id+'"><textarea name="body" rows="2" maxlength="1200" required placeholder="Escribe un comentario…"></textarea><button class="btn sm" type="submit">Responder</button></form>':'';
    const editForm=CL.editingPostId===selectedPost.id&&selectedPostOwn?'<form data-f="club-post-edit" class="club-admin-form club-post-form club-post-edit-form"><input type="hidden" name="post_id" value="'+selectedPost.id+'"><label>Titular</label><input name="title" maxlength="150" required value="'+esc(selectedPost.title)+'"><label>Contenido</label><textarea name="body" maxlength="5000" rows="5" required>'+esc(selectedPost.body)+'</textarea><label class="club-permission-option"><input type="checkbox" name="comments_enabled" '+(selectedPost.comments_enabled?'checked':'')+'><span><b>Permitir comentarios</b><small>Los miembros podrán responder a esta publicación.</small></span></label><div class="club-post-form-actions"><button class="btn" type="submit">Guardar cambios</button><button class="btn ghost" type="button" data-club-post-edit-cancel>Cancelar</button></div></form>':'';
    return '<div class="club-post-modal" data-club-post-close role="presentation"><section class="club-post-dialog" role="dialog" aria-modal="true" aria-labelledby="club-post-modal-title"><header class="club-post-modal-head"><div><span class="club-post-modal-kicker">PUBLICACIÓN DEL CLUB · '+esc(c.name)+'</span><span class="club-post-modal-subtitle">Noticias e información de la comunidad</span></div><button type="button" class="club-post-modal-close" data-club-post-close aria-label="Cerrar publicación">×</button></header><div class="club-post-detail-content"><div class="club-post-detail-author">'+authorBlock+actions+'</div>'+(editForm||'<h2 class="club-post-detail-title" id="club-post-modal-title">'+esc(selectedPost.title||'Publicación')+'</h2><div class="club-post-detail-text">'+esc(selectedPost.body||'')+'</div>')+'<div class="club-post-detail-comments"><div class="club-post-detail-comments-heading">Comentarios <span>'+selectedPostComments.length+'</span></div>'+comments+commentForm+'</div></div></section></div>';
   })():'';

  const eventForm=canCreateEvents&&CL.eventOpen?'<form data-f="club-event" class="club-admin-form"><label>Nombre del evento</label><input name="title" maxlength="90" required placeholder="Ej. Quedada del sábado"><label>Tipo</label><select name="event_type"><option value="meetup">Quedada</option><option value="training">Entrenamiento</option><option value="tournament">Torneo</option></select><label>Descripción</label><textarea name="description" maxlength="1200" rows="3"></textarea><label>Fecha y hora de inicio</label><input type="datetime-local" name="starts_at" required><label>Fecha y hora de fin (opcional)</label><input type="datetime-local" name="ends_at"><label>Lugar</label><input name="location" maxlength="180" placeholder="Pistas, dirección…"><label>Plazas (vacío = sin límite)</label><input type="number" name="capacity" min="2" max="500" placeholder="Ej. 16"><button class="btn" type="submit">Publicar evento</button></form>':'';
  const headerBanner='<div class="club-cover '+(admin?'editable':'')+'" '+(c.banner_url?'style="background-image:url(&quot;'+esc(c.banner_url)+'&quot;)"':'')+'>'+(admin?'<label class="club-image-edit club-banner-edit"><span>✎</span> Cambiar banner<input class="sr" type="file" accept="image/jpeg,image/png,image/webp" data-club-image-file data-club-image="banner"></label>':'')+'</div>';
  const clubTypeLabel=type==='official'?'Club Oficial':'Club de amigos';
  const clubVerification=type==='official'?(officialStatus==='verified'?' · Verificado':officialStatus==='pending'?' · Pendiente de verificación':officialStatus==='rejected'?' · Verificación rechazada':' · Sin verificar'):'';
  const clubAccessLabel=mode==='open'?'Abierto':mode==='approval'?'Con aprobación':'Privado';
  const clubInitial=String(c.name||'C').trim().charAt(0).toUpperCase();
  const contactRows=(c.official_address?'<div class="club-contact-row"><span>Dirección</span><b>'+esc(c.official_address)+'</b></div>':'')+'<div class="club-contact-row"><span>Localidad</span><b>'+esc([c.city,c.official_province].filter(Boolean).join(', ')||'No indicada')+'</b></div>'+(c.official_email?'<div class="club-contact-row"><span>Email</span><a href="mailto:'+esc(c.official_email)+'">'+esc(c.official_email)+'</a></div>':'')+(c.official_phone?'<div class="club-contact-row"><span>Teléfono</span><a href="tel:'+esc(c.official_phone)+'">'+esc(c.official_phone)+'</a></div>':'')+(c.official_website&&(String(c.official_website).startsWith('https://')||String(c.official_website).startsWith('http://'))?'<div class="club-contact-row"><span>Página web</span><a href="'+esc(c.official_website)+'" target="_blank" rel="noopener noreferrer">'+esc(c.official_website)+'</a></div>':'');
  return '<div class="clubs-page club-detail-page" data-club-tab="'+(CL.tab||'info')+'"><button class="btn sm ghost sessions-back" data-a="clubs">← Volver a clubes</button><div class="club-detail-top">'+headerBanner+'<section class="clubs-hero club-detail-hero '+(type==='official'?'official':'friends')+'"><div class="club-detail-identity">'+(admin?'<label class="club-avatar-edit" aria-label="Cambiar foto del club">'+(c.avatar_url?'<img class="club-detail-avatar" src="'+esc(c.avatar_url)+'" alt="">':'<span class="club-detail-avatar club-detail-avatar-fallback">'+esc(clubInitial)+'</span>')+'<span class="club-avatar-edit-icon">✎</span><input class="sr" type="file" accept="image/jpeg,image/png,image/webp" data-club-image-file data-club-image="avatar"></label>':(c.avatar_url?'<img class="club-detail-avatar" src="'+esc(c.avatar_url)+'" alt="">':'<span class="club-detail-avatar club-detail-avatar-fallback">'+esc(clubInitial)+'</span>'))+'<div class="club-detail-title"><h2>'+esc(c.name)+'</h2><p>'+esc(c.city||'Comunidad de pickleball')+'</p></div></div></section>'+
  '<section class="club-detail-status"><div class="club-detail-labels"><span class="club-detail-type '+(type==='official'?'official':'friends')+'">'+clubTypeLabel+clubVerification+'</span><span class="club-detail-access '+(mode==='open'?'open':mode==='approval'?'approval':'private')+'">'+clubAccessLabel+'</span></div><div class="club-detail-status-stats"><span><b>'+memberCount+'</b> '+(members.length===1?'miembro':'miembros')+'</span><span>En Pickle & Mix desde '+new Date(c.created_at).toLocaleDateString(APP_LANG==='en'?'en-US':'es-ES',{month:'short',year:'numeric'})+'</span></div></section></div>'+
  '<nav class="club-detail-tabs" role="tablist" aria-label="Secciones del club"><button type="button" role="tab" data-club-tab="info" aria-selected="'+((CL.tab||'info')==='info')+'">Información</button>'+(mine?'<button type="button" role="tab" data-club-tab="events" aria-selected="'+(CL.tab==='events')+'">Eventos</button><button type="button" role="tab" data-club-tab="posts" aria-selected="'+(CL.tab==='posts')+'">Publicaciones</button><button type="button" role="tab" data-club-tab="members" aria-selected="'+(CL.tab==='members')+'">Miembros</button>':'')+(admin?'<button type="button" role="tab" data-club-tab="manage" aria-selected="'+(CL.tab==='manage')+'">Gestionar</button>':'')+'</nav><section class="card club-description" data-club-panel="info"><div class="club-section-heading"><span class="club-section-kicker">CONOCE EL CLUB</span><h3>Sobre el club</h3></div><p>'+esc(c.description||'Este club todavía no tiene descripción.')+'</p></section>'+
  (type==='official'?'<section class="card club-official-contact" data-club-panel="info"><div class="club-section-heading"><span class="club-section-kicker">DÓNDE ENCONTRARNOS</span><h3>Contacto y localización</h3></div><div class="club-contact-list">'+contactRows+'</div></section>':'')+
  (invited&&!admin?'<section class="card club-admin-section club-invitation-panel" data-club-panel="info"><h3>Invitación pendiente</h3>'+invited+'</section>':'')+
  (!mine&&!invited?'<section class="card club-join-card" data-club-panel="info"><span class="club-section-kicker">FORMA PARTE</span><h3>Únete a este club</h3><p>'+(mode==='open'?'Este club permite el acceso libre.':mode==='approval'?'Envía una solicitud; el administrador tendrá que aceptarla.':'Este club es privado. Necesitas un enlace o una invitación directa.')+'</p>'+(mode==='private'?'<span class="tag">Acceso por invitación</span>':CL.myRequest?'<div class="club-pending-request"><span class="tag">Solicitud pendiente</span><button class="btn xs ghost" data-club-request-cancel>Cancelar solicitud</button></div>':'<button class="btn" data-club-join="'+c.id+'">'+(mode==='open'?'Unirme al club':'Solicitar unirme')+'</button>')+'</section>':'')+
  (mine?'<section class="card club-admin-section club-posts-section" data-club-panel="posts"><div class="club-section-heading-row"><div class="club-section-heading"><span class="club-section-kicker">NOVEDADES</span><h3>Publicaciones</h3><p>Noticias e información de interés para los miembros.</p></div>'+(canCreatePosts?'<button class="btn sm" data-club-post-toggle>＋ Crear publicación</button>':'')+'</div>'+postForm+(postCards||'<p class="mut">Todavía no hay publicaciones. Aquí aparecerán las noticias del club.</p>')+'</section><section class="card club-admin-section club-events-section" data-club-panel="events"><div class="club-section-heading-row"><div class="club-section-heading"><span class="club-section-kicker">ACTIVIDAD</span><h3>Eventos del club</h3></div>'+(canCreateEvents?'<button class="btn sm" data-club-event-toggle>＋ Crear evento</button>':'')+'</div>'+eventForm+(eventCards||'<p class="mut">Todavía no hay eventos publicados.</p>')+'</section>'+
  '<section class="card club-members" data-club-panel="members"><div class="club-section-heading-row"><div class="club-section-heading"><span class="club-section-kicker">LA COMUNIDAD</span><h3>Miembros</h3></div><span class="friends-total">'+memberCount+'</span></div>'+(!mine&&mode==='approval'?'<p class="mut">La lista de miembros solo está disponible para miembros del club.</p>':(people||'<p class="mut">Aún no hay miembros.</p>'))+'</section>'+
  (admin?'<div class="club-admin-zone" data-club-panel="manage"><div class="club-admin-zone-heading"><span class="club-section-kicker">SOLO ADMINISTRADORES</span><h3>Gestión del club</h3><p>Herramientas para organizar y mantener el club.</p></div>'+adminTools+settings+'<section class="club-danger-zone"><div><b>Zona de administración</b><small>Acciones permanentes sobre este club.</small></div><button class="btn red" data-club-delete="'+c.id+'">Eliminar club</button></section></div>':'<button class="btn ghost club-leave-action" data-club-panel="manage" data-club-leave="'+c.id+'">Salir del club</button>'):'')+'</div>'+postModal+eventModal;
}
async function createClub(form){
  if(!sbc||!AU.user||CL.busy)return;
  const fd=new FormData(form),name=String(fd.get('name')||'').trim(),description=String(fd.get('description')||'').trim(),city=String(fd.get('city')||'').trim(),access_mode=String(fd.get('access_mode')||'open'),club_type=String(fd.get('club_type')||'friends');
  const official_address=String(fd.get('official_address')||'').trim(),official_province=String(fd.get('official_province')||'').trim(),official_email=String(fd.get('official_email')||'').trim(),official_phone=String(fd.get('official_phone')||'').trim(),official_website=String(fd.get('official_website')||'').trim();
  if(name.length<3||name.length>50){toast('El nombre debe tener entre 3 y 50 caracteres.');form.querySelector('[name="name"]')?.focus();return}
  if(club_type==='official'&&(!city||!official_address||(!official_email&&!official_phone&&!official_website))){toast('Para solicitar un Club Oficial, indica ciudad, dirección y al menos un medio de contacto.');return}
  if(official_website&&!(official_website.startsWith('https://')||official_website.startsWith('http://'))){toast('La página web debe comenzar por http:// o https://.');return}
  CL.busy='create';
  const btn=form.querySelector('button[type="submit"]');
  if(btn){btn.disabled=true;btn.textContent='Creando club…'}
  try{
    const {data,error}=await sbc.rpc('create_club',{p_name:name,p_description:description,p_city:city});
    if(error)throw error;
    if(!data)throw new Error('Supabase no devolvió el identificador del club.');
    await loadClubs();
    CL.selectedId=typeof data==='string'?data:data.id;CL.tab='info';CL.openPostId=null;CL.openEventId=null;
    if(!CL.selectedId)throw new Error('No se recibió el identificador del club creado.');
    const clubUpdate=await sbc.from('clubs').update({access_mode,club_type,official_status:club_type==='official'?'pending':'none',official_address:club_type==='official'?official_address:null,official_province:club_type==='official'?official_province:null,official_email:club_type==='official'?official_email:null,official_phone:club_type==='official'?official_phone:null,official_website:club_type==='official'?official_website:null}).eq('id',CL.selectedId);
    if(clubUpdate.error)throw clubUpdate.error;
    await loadClubs();
    CL.createOpen=false;view='club-detail';render();await loadClubData(CL.selectedId);toast(club_type==='official'?'Solicitud de Club Oficial enviada. Pendiente de verificación.':'Club creado. ¡Ya eres su administrador!');
    loadMyAchievements();
  }catch(error){
    console.warn('[clubs] create:',error&&error.code,error&&error.message,error&&error.details);
    const message=String(error&&error.message||'');
    toast(message.includes('nombre')?message:message.includes('iniciar sesión')?'Tu sesión ha caducado. Inicia sesión de nuevo.':message.includes('row-level security')?'No tienes permisos para crear el club. Cierra sesión y vuelve a entrar.':'No se ha podido crear el club: '+(message.slice(0,130)||'comprueba la conexión.'));
    if(btn){btn.disabled=false;btn.textContent='Crear club'}
  }finally{CL.busy=''}
}
async function joinClub(id){
  if(!sbc||!AU.user||CL.busy)return;
  CL.busy='join:'+id;paintClubs();
  try{const {data,error}=await sbc.rpc('join_club',{p_club_id:id});if(error)throw error;await loadClubs();CL.selectedId=id;CL.tab='info';CL.openPostId=null;CL.openEventId=null;view='club-detail';render();await loadClubData(id);toast(data==='requested'?'Solicitud enviada al administrador.':data==='member'?'Ya perteneces a este club.':'Te has unido al club.');loadMyAchievements()}
  catch(error){console.warn('[clubs] join:',error&&error.message);toast(error.message||'No se ha podido completar la solicitud.')}
  finally{CL.busy='';paintClubs()}
}
async function leaveClub(id){
  if(!sbc||!AU.user||CL.busy||!confirm('¿Quieres salir de este club?'))return;
  CL.busy='leave:'+id;
  try{const {error}=await sbc.from('club_members').delete().eq('club_id',id).eq('user_id',AU.user.id);if(error)throw error;await loadClubs();view='clubs';CL.selectedId=null;render();toast('Has salido del club.');loadMyAchievements()}
  catch(error){console.warn('[clubs] leave:',error&&error.message);toast('No se ha podido salir del club.')}
  finally{CL.busy='';paintClubs()}
}
async function deleteClub(id){
  if(!sbc||!AU.user||CL.busy||!confirm('¿Eliminar este club? Se eliminará también su lista de miembros. Esta acción no se puede deshacer.'))return;
  CL.busy='delete:'+id;
  try{const {error}=await sbc.from('clubs').delete().eq('id',id);if(error)throw error;await loadClubs();view='clubs';CL.selectedId=null;render();toast('Club eliminado.')}
  catch(error){console.warn('[clubs] delete:',error&&error.message);toast('No se ha podido eliminar el club.')}
  finally{CL.busy='';paintClubs()}
}

function vUserProfile(){
  if(!AU.user)return '<h2>Perfil</h2><div class="card acct">'+authInner()+'</div>';
  if(PUB.loading)return '<h2>Perfil</h2><div class="card"><p class="hint">Cargando perfil…</p></div>';
  if(PUB.error||!PUB.profile)return '<h2>Perfil</h2><div class="card"><p class="hint">'+esc(PUB.error||'No se ha podido cargar el perfil.')+'</p><button class="btn ghost" data-a="friends">Volver a Amigos</button></div>';
  const p=PUB.profile,rel=friendState(p.id),request=FR.items.find(f=>(f.requester_id===p.id&&f.addressee_id===AU.user.id)||(f.addressee_id===p.id&&f.requester_id===AU.user.id));
  const action=rel==='friend'?'<span class="profile-friend-status is-friend">Ya es amigo</span><button class="btn sm ghost profile-remove-friend" data-fa="remove" data-id="'+request.id+'" '+(FR.busy==='remove:'+request.id?'disabled':'')+'>'+(FR.busy==='remove:'+request.id?'Eliminando…':'Eliminar amigo')+'</button>':rel==='sent'?'<span class="profile-friend-status">Solicitud enviada</span>':rel==='received'?'<button class="btn sm" data-fa="accept" data-id="'+request.id+'" '+(FR.busy==='accept:'+request.id?'disabled':'')+'>'+(FR.busy==='accept:'+request.id?'Aceptando…':'Aceptar solicitud')+'</button>':'<button class="btn sm" data-fa="send" data-id="'+p.id+'" '+(FR.busy==='send:'+p.id?'disabled':'')+'>'+(FR.busy==='send:'+p.id?'Enviando…':'Solicitar amistad')+'</button>';
  const pointBalance=PUB.stats?PUB.stats.points_for-PUB.stats.points_against:0;
  const stat=PUB.stats?'<div class="profile-public-stats"><div class="profile-metrics"><div class="card profile-metric"><b>'+PUB.stats.sessions+'</b><span>'+(APP_LANG==='en'?'Sessions played':'Quedadas jugadas')+'</span></div><div class="card profile-metric"><b>'+PUB.stats.wins+'</b><span>'+(APP_LANG==='en'?'Matches won':'Partidos ganados')+'</span></div><div class="card profile-metric"><b>'+Math.round(PUB.stats.win_rate*100)+'%</b><span>'+(APP_LANG==='en'?'% of matches won':'% de partidos ganados')+'</span></div></div><div class="profile-point-balance"><div><b>'+(APP_LANG==='en'?'Point balance':'Balance de puntos')+'</b><small>'+(APP_LANG==='en'?'Points scored minus points conceded':'Puntos anotados menos puntos recibidos')+'</small></div><strong>'+(pointBalance>0?'+':'')+pointBalance+'</strong></div></div>':PUB.statsHidden?'<p class="mut">Este usuario no comparte sus estadísticas contigo.</p>':'<p class="mut">Todavía no hay estadísticas registradas.</p>';
    const memberClubs=PUB.clubs.filter(c=>c.role!=='admin'),managedClubs=PUB.clubs.filter(c=>c.role==='admin'),selectedClubs=PUB.clubTab==='managed'?managedClubs:memberClubs,clubCount=PUB.clubs.length,shownClubs=PUB.clubsExpanded?selectedClubs:selectedClubs.slice(0,3),remainingClubs=selectedClubs.length-shownClubs.length;
    const clubRows=shownClubs.map(c=>'<button type="button" class="profile-club-row" data-club-open="'+c.id+'" aria-label="Abrir el club '+esc(c.name)+'"><span class="profile-club-avatar">'+(c.avatar_url?'<img src="'+esc(c.avatar_url)+'" alt="">':'<b>'+esc((c.name||'C').trim().slice(0,1).toUpperCase())+'</b>')+'</span><span class="profile-club-info"><b>'+esc(c.name)+'</b>'+(c.city?'<small class="profile-club-city">'+esc(c.city)+'</small>':'')+'<span class="profile-club-badges"><span class="profile-club-type '+(c.club_type==='official'?'official':'friends')+'">'+(c.club_type==='official'?'Club oficial':'Club de amigos')+'</span><span class="profile-club-role '+(c.role==='admin'?'admin':'')+'">'+(c.role==='admin'?'Administrador':'Miembro')+'</span></span></span><span class="profile-club-arrow" aria-hidden="true">›</span></button>').join('');
    const clubs=PUB.clubsLoading?'<div class="profile-clubs-state"><span class="profile-clubs-state-mark">…</span><div><b>Cargando clubes</b><small>Estamos consultando sus membresías.</small></div></div>':'<div class="ctabs profile-club-tabs" role="tablist" aria-label="Clubes del jugador"><button type="button" data-profile-club-tab="member" role="tab" aria-selected="'+(PUB.clubTab==='member')+'"><b>'+(APP_LANG==='en'?'Member':'Es miembro')+'</b><small>'+memberClubs.length+'</small></button><button type="button" data-profile-club-tab="managed" role="tab" aria-selected="'+(PUB.clubTab==='managed')+'"><b>'+(APP_LANG==='en'?'Administers':'Administra')+'</b><small>'+managedClubs.length+'</small></button></div>'+(selectedClubs.length?'<div class="profile-clubs-list">'+clubRows+'</div>':'<div class="profile-clubs-state"><span class="profile-clubs-state-mark">＋</span><div><b>'+(PUB.clubTab==='managed'?(APP_LANG==='en'?'No clubs administered':'No administra ningún club'):(APP_LANG==='en'?'No clubs yet':'No pertenece a ningún club'))+'</b><small>'+(APP_LANG==='en'?'There are no clubs in this category.':'No hay clubes en esta categoría.')+'</small></div></div>')+(remainingClubs>0?'<button type="button" class="club-directory-more profile-clubs-more" data-profile-club-more>'+(APP_LANG==='en'?'View all clubs':'Ver todos')+' <span>'+selectedClubs.length+'</span><b aria-hidden="true">›</b></button>':'');
    return '<section class="card acct profile-public-hero"><div class="profile-public-identity"><div class="profile-public-avatar">'+(p.avatar_url?'<img class="av" src="'+esc(p.avatar_url)+'" alt="">':'<span class="av">'+esc((p.display_name||'?').slice(0,1).toUpperCase())+'</span>')+'</div><div class="profile-public-name"><span class="tag d">Jugador de PICKLE &amp; MIX</span><h2>'+esc(p.display_name)+'</h2><span class="mut">@'+esc(p.alias)+'</span></div></div><div class="profile-public-social-row"><div class="profile-public-friends" aria-label="Número de amigos"><span class="profile-friend-count-number">'+(PUB.friendCount===null?'—':PUB.friendCount)+'</span><span class="profile-friend-count-label">Amigos</span></div><div class="profile-public-actions">'+action+'</div></div></section>'+
    '<p class="mut">'+(!PUB.locationHidden&&(p.city||p.country)?esc([p.city,p.country].filter(Boolean).join(', ')):'')+'</p>'+achievementPanel(PUB.achievements,true)+achievementCatalog(PUB.achievements,true)+'<section class="card profile-clubs-card"><div class="profile-clubs-heading"><div><h3>Clubes</h3><p>Comunidad a la que pertenece este jugador</p></div><span class="profile-clubs-count">'+(PUB.clubsLoading?'…':clubCount+(clubCount===1?' club':' clubes'))+'</span></div>'+clubs+'</section><h3 class="profile-section-title profile-public-stats-title">'+(APP_LANG==='en'?'Statistics':'Estadísticas')+'</h3>'+stat+
        '<button class="btn ghost" data-a="friends">Volver a Amigos</button>';
}
async function openUserProfile(id){
  if(!sbc||!AU.user)return;
  PUB.id=id;PUB.clubTab='member';PUB.clubsExpanded=false;try{sessionStorage.setItem('pickleMix.publicProfileRoute',id)}catch(e){}PUB.profile=null;PUB.stats=null;PUB.history=[];PUB.achievements=null;PUB.friendCount=null;PUB.clubs=[];PUB.clubsLoading=true;PUB.error='';PUB.loading=true;PUB.statsHidden=false;PUB.historyHidden=false;view='user-profile';render();
  try{
    const {data,error}=await sbc.from('profiles').select('id,display_name,alias,avatar_url,stats_visibility,history_visibility,location_visibility,preferred_language').eq('id',id).single();
    if(error)throw error;
    const location=await sbc.rpc('get_profile_location',{p_user_id:id});
    if(location.error)throw location.error;
    PUB.profile={...data,...(location.data||{})};PUB.locationHidden=!location.data;
    const friendCountResult=await sbc.rpc('get_profile_friend_count',{p_user_id:id});
    if(!friendCountResult.error)PUB.friendCount=Number(friendCountResult.data)||0;
    const memberships=await sbc.from('club_members').select('club_id,role').eq('user_id',id);
    if(memberships.error)throw memberships.error;
    const clubIds=(memberships.data||[]).map(m=>m.club_id);
    if(clubIds.length){const clubsResult=await sbc.from('clubs').select('id,name,city,club_type,avatar_url').in('id',clubIds);if(clubsResult.error)throw clubsResult.error;PUB.clubs=(clubsResult.data||[]).map(c=>({...c,role:memberships.data.find(m=>m.club_id===c.id)?.role||'member'})).sort((a,b)=>a.name.localeCompare(b.name,'es'))}else PUB.clubs=[];
    PUB.clubsLoading=false;
    const isSelf=id===AU.user.id,isFriend=friendState(id)==='friend';
    const canStats=isSelf||data.stats_visibility==='everyone'||(data.stats_visibility==='friends'&&isFriend);
    if(canStats){
      const ach=await sbc.rpc('get_profile_achievement_summary',{p_user_id:id});
      if(!ach.error)PUB.achievements=ach.data;
      const r=await sbc.rpc('get_user_stats',{p_user_id:id});if(r.error)throw r.error;PUB.stats=r.data;
    }else{PUB.statsHidden=true;PUB.achievements=null;}
      }catch(error){console.warn('[public profile] load:',error&&error.message);PUB.error='No se ha podido cargar este perfil o sus datos públicos.'}
  finally{PUB.loading=false;PUB.clubsLoading=false;if(view==='user-profile')render()}
}
const ACT_I18N={
 es:{player:'Jugador',sessionFinished:'ha terminado una quedada',newEvent:'Nuevo evento',newPost:'Nueva publicación',title:'Actividad',intro:'Inicia sesión para descubrir lo que comparten tus amigos y los clubes a los que perteneces.',subtitle:'Lo último que está pasando en tu comunidad.',filters:['Todo','Amigos','Clubes'],refresh:'Actualizar actividad',loading:'Cargando actividad…',emptyTitle:'Aún no hay actividad',emptyText:'Cuando tus amigos terminen quedadas o tus clubes publiquen novedades y eventos, aparecerán aquí.',more:'Cargar más',loadingMore:'Cargando…',club:'Club',players:'jugadores',place:'posición'},
 en:{player:'Player',sessionFinished:'finished a session',newEvent:'New event',newPost:'New post',title:'Activity',intro:'Sign in to discover what your friends and clubs are sharing.',subtitle:'The latest updates from your community.',filters:['All','Friends','Clubs'],refresh:'Refresh activity',loading:'Loading activity…',emptyTitle:'No activity yet',emptyText:'When your friends finish sessions or your clubs publish updates and events, they will appear here.',more:'Load more',loadingMore:'Loading…',club:'Club',players:'players',place:'place'}
};
const act=k=>(ACT_I18N[APP_LANG]||ACT_I18N.es)[k]||ACT_I18N.es[k]||k;
function activityDate(value){
  return value?new Date(value).toLocaleString(APP_LANG==='en'?'en-US':'es-ES',{dateStyle:'medium',timeStyle:'short'}):'';
}
function activityCard(item){
  const avatar=item.actor_avatar?'<img class="activity-avatar" src="'+esc(item.actor_avatar)+'" alt="">':'<span class="activity-avatar activity-avatar-fallback">'+esc((item.actor_name||act('player')).slice(0,1).toUpperCase())+'</span>';
  const identity='<span class="activity-identity"><b>'+esc(item.actor_name||act('player'))+'</b>'+(item.actor_alias?'<small>@'+esc(item.actor_alias)+'</small>':'')+'</span>';
  const when='<time>'+activityDate(item.created_at)+'</time>';
  if(item.source==='friends'){
    const details=item.details||{},players=Number(details.player_count)||0,position=Number(details.position)||0;
    const ordinal=position?(APP_LANG==='en'?(position%100>=11&&position%100<=13?position+'th':position+(position%10===1?'st':position%10===2?'nd':position%10===3?'rd':'th')):position+'.ª'):'';
    const positionLabel=position?(APP_LANG==='en'?'Finished in':'Ha quedado en'):'';
    return '<button type="button" class="activity-card activity-card--session" data-up="'+esc(item.actor_id)+'"><span class="activity-card-top">'+avatar+identity+when+'</span><span class="activity-card-kind"><span class="activity-kind-icon activity-kind-icon--session">↗</span>'+act('sessionFinished')+'</span><span class="activity-card-title">'+esc(item.title||'Quedada')+'</span><span class="activity-session-stats">'+(players?'<span class="activity-stat"><span class="activity-stat-value">'+players+'</span><span class="activity-stat-label">'+act('players')+'</span></span>':'')+(position?'<span class="activity-stat activity-stat--position"><span class="activity-stat-value">'+ordinal+'</span><span class="activity-stat-label">'+positionLabel+' '+act('place')+'</span></span>':'')+'</span><span class="activity-card-open">'+(APP_LANG==='en'?'View player profile':'Ver perfil del jugador')+' <span aria-hidden="true">↗</span></span></button>';
  }
  const event=item.kind==='club_event';
  const kindLabel=event?act('newEvent'):act('newPost');
  const meta=event&&item.details&&item.details.starts_at?'<span class="activity-card-meta"><span aria-hidden="true">◷</span>'+activityDate(item.details.starts_at)+(item.details.location?'<span class="activity-meta-separator">·</span>'+esc(item.details.location):'')+'</span>':'';
  return '<button type="button" class="activity-card activity-card--club '+(event?'activity-card--event':'activity-card--post')+'" data-activity-club-item="'+(event?'event':'post')+'" data-item-id="'+esc(event?(item.details||{}).event_id:(item.details||{}).post_id)||''+'" data-club-open="'+esc(item.club_id)+'"><span class="activity-card-top">'+avatar+identity+when+'</span><span class="activity-card-kind"><span class="activity-kind-icon">'+(event?'◷':'✎')+'</span>'+kindLabel+'<span class="activity-kind-club">'+esc(item.club_name||act('club'))+'</span></span><span class="activity-card-title">'+esc(item.title||'')+'</span>'+(item.summary?'<span class="activity-card-summary">'+esc(item.summary)+'</span>':'')+meta+'<span class="activity-card-open">'+(APP_LANG==='en'?'Open club':'Ver club')+' <span aria-hidden="true">↗</span></span></button>';
}
function vActivity(){
  if(!AU.user)return vAuthLanding();
  const filters=[['all',act('filters')[0]],['friends',act('filters')[1]],['clubs',act('filters')[2]]];
  const list=ACT.items.length?ACT.items.map(activityCard).join(''):'';
  return '<section class="activity-page"><div class="activity-filters" role="tablist" aria-label="'+act('title')+'">'+filters.map(([v,label])=>'<button type="button" role="tab" data-feed-filter="'+v+'" aria-selected="'+(ACT.filter===v)+'">'+label+'</button>').join('')+'</div>'+(ACT.error?'<div class="err">'+esc(ACT.error)+'</div>':'')+(ACT.loading&&!ACT.items.length?'<div class="card activity-empty"><span class="activity-loader"></span><b>'+act('loading')+'</b></div>':list?'<div class="activity-list">'+list+'</div>':'<div class="card activity-empty"><span class="activity-empty-mark">↗</span><b>'+act('emptyTitle')+'</b><p>'+act('emptyText')+'</p></div>')+(ACT.hasMore?'<button type="button" class="btn ghost activity-more" data-feed-more '+(ACT.loading?'disabled':'')+'>'+(ACT.loading?act('loadingMore'):act('more'))+'</button>':'')+'</section>';
}
function paintActivity(){if(view==='activity'){const root=document.querySelector('#app');if(root){root.innerHTML=header()+vActivity()+bottomNavigation();translateDOM(root)}}}
let activityRequestId=0;
async function loadActivity(reset){
  if(!sbc||!AU.user)return;
  const requestId=++activityRequestId,filterAtRequest=ACT.filter;
  if(reset){ACT.items=[];ACT.hasMore=false;ACT.error='';ACT.loaded=false}
  const last=reset?null:ACT.items[ACT.items.length-1];
  ACT.loading=true;paintActivity();
  try{
    const {data,error}=await sbc.rpc('get_activity_feed',{p_filter:filterAtRequest,p_before:last?last.created_at:null,p_before_id:last?last.id:null,p_limit:20});
    if(error)throw error;
    let rows=Array.isArray(data)?data:(typeof data==='string'?JSON.parse(data):[]);
    if(!Array.isArray(rows))rows=[];
    if(requestId!==activityRequestId||filterAtRequest!==ACT.filter)return;
    ACT.hasMore=rows.length>20;
    const page=rows.slice(0,20);
    ACT.items=reset?page:ACT.items.concat(page);
    ACT.loaded=true;
  }catch(error){
    if(requestId!==activityRequestId)return;
    console.warn('[activity] load:',error&&error.message);
    ACT.error=APP_LANG==='en'?'Could not load activity. Please try again.':'No se ha podido cargar la actividad. Inténtalo de nuevo.';
    ACT.hasMore=false;ACT.loaded=true;
  }finally{
    if(requestId===activityRequestId){ACT.loading=false;paintActivity()}
  }
}
function friendActivityRow(item){
  return '<div class="history-row"><div><b>'+esc(item.friendName)+' · '+esc(item.session_title||'Quedada')+'</b><span class="mut">'+new Date(item.played_at).toLocaleDateString(APP_LANG==='en'?'en-US':'es-ES')+' · '+(item.won?'Victoria':'Derrota')+'</span><small>'+esc((item.teammates||[]).join(' / '))+' vs '+esc((item.opponents||[]).join(' / '))+'</small></div><strong class="'+(item.won?'win':'loss')+'">'+item.own_score+'–'+item.opponent_score+'</strong></div>';
}
async function loadFriendActivity(){
  if(!sbc||!AU.user)return;
  const friends=FR.items.filter(f=>f.status==='accepted').map(f=>f.requester_id===AU.user.id?f.addressee_id:f.requester_id);
  FR.activityLoading=true;
  try{
    const rows=await Promise.all(friends.slice(0,20).map(async id=>{
      const person=FR.people.find(p=>p.id===id);if(!person)return[];
      const {data,error}=await sbc.rpc('get_user_history',{p_user_id:id,p_limit:3});
      if(error)return[];
      return (Array.isArray(data)?data:[]).map(h=>({...h,friendName:person.display_name||'Amigo'}));
    }));
    FR.activity=rows.flat().sort((a,b)=>new Date(b.played_at)-new Date(a.played_at)).slice(0,10);
  }catch(error){console.warn('[friends] activity:',error&&error.message);FR.activity=[]}
  finally{FR.activityLoading=false;if(view==='profile')paintAuth()}
}
async function loadFriends(){
  if(!sbc||!AU.user)return;
  FR.loading=true;FR.error='';paintFriends();
  try{
    const uid=AU.user.id;
    const {data,error}=await sbc.from('friendships').select('id,requester_id,addressee_id,status,created_at').or('requester_id.eq.'+uid+',addressee_id.eq.'+uid).order('created_at',{ascending:false});
    if(error)throw error;
    FR.items=data||[];
    const ids=[...new Set(FR.items.flatMap(f=>[f.requester_id,f.addressee_id]).filter(id=>id!==uid))];
    if(ids.length){const {data:people,error:pe}=await sbc.from('profiles').select('id,display_name,alias,avatar_url').in('id',ids);if(pe)throw pe;FR.people=people||[]}else FR.people=[];
    FR.loaded=true;
  }catch(error){console.warn('[friends] load:',error&&error.message);FR.error='No se han podido cargar tus amistades. Comprueba la conexión e inténtalo de nuevo.'}
  finally{FR.loading=false;paintFriends();paintFriendBadge();loadFriendLeaderboard();if(view==='profile'){render();loadFriendActivity()}}
}
function paintFriends(){if(view==='friends'){const root=document.querySelector('#app');if(root){root.innerHTML=header()+vFriends()+bottomNavigation();translateDOM(root)}}}
async function searchFriends(form){
  const q=String(form.querySelector('[name="q"]').value||'').trim().replace(/^@/,'').slice(0,40);FR.query=q;FR.results=[];FR.error='';
  if(!q){paintFriends();return}
  if(!AU.user||!sbc)return;
  FR.searching=true;paintFriends();
  try{
    const safe=q.replace(/[,%()]/g,' ').trim();if(!safe){FR.results=[];return}
    const {data,error}=await sbc.from('profiles').select('id,display_name,alias,avatar_url').or('alias.ilike.%'+safe+'%,display_name.ilike.%'+safe+'%').neq('id',AU.user.id).not('alias','is',null).limit(20);
    if(error)throw error;FR.results=data||[];
  }catch(error){console.warn('[friends] search:',error&&error.message);FR.error='No se ha podido realizar la búsqueda. Inténtalo de nuevo.'}
  finally{FR.searching=false;paintFriends()}
}
async function friendAction(action,id){
  if(!sbc||!AU.user||!id||FR.busy)return;
  if(action==='remove'&&!confirm('¿Eliminar esta amistad?'))return;
  FR.busy=action+':'+id;paintFriends();if(view==='user-profile')render();
  let completed=false;
  try{
    let result;
    if(action==='send')result=await sbc.rpc('send_friend_request',{p_addressee_id:id});
    else if(action==='accept')result=await sbc.rpc('respond_friend_request',{p_request_id:id,p_accept:true});
    else if(action==='reject')result=await sbc.rpc('respond_friend_request',{p_request_id:id,p_accept:false});
    else if(action==='cancel')result=await sbc.rpc('cancel_friend_request',{p_request_id:id});
    else if(action==='remove')result=await sbc.rpc('remove_friend',{p_friendship_id:id});
    if(result&&result.error){
      // Si el servidor confirmó el cambio en la base de datos pero la respuesta
      // se perdió, comprobamos el estado real antes de mostrar un error.
      if(action==='accept'){
        const check=await sbc.from('friendships').select('status').eq('id',id).eq('addressee_id',AU.user.id).maybeSingle();
        if(!check.error&&check.data&&check.data.status==='accepted')completed=true;
        else throw result.error;
      }else throw result.error;
    }else completed=true;
    if(!completed)throw new Error('No se pudo confirmar el estado de la solicitud.');
    toast(({send:'Solicitud enviada.',accept:'Solicitud aceptada.',reject:'Solicitud rechazada.',cancel:'Solicitud cancelada.',remove:'Amistad eliminada.'})[action]||'Actualizado.');
    // Los refrescos son secundarios: un fallo al actualizar la interfaz no debe
    // convertir una operación ya completada en un falso error de acción.
    try{await loadFriends()}catch(error){console.warn('[friends] refresh after action:',error&&error.message)}
    loadMyAchievements();
    if(view==='user-profile'&&PUB.id){try{await openUserProfile(PUB.id)}catch(error){console.warn('[friends] profile refresh:',error&&error.message)}}
  }catch(error){
    const msg=String(error&&error.message||'');console.warn('[friends] action:',error);
    if(/ya existe una solicitud|already exists/i.test(msg)){toast('Ya existe una solicitud o amistad con este jugador.');try{await loadFriends()}catch(_){}}
    else{FR.error=/alias/i.test(msg)?'Elige un alias en Configuración antes de enviar solicitudes.':/solicitud inexistente|ya respondida|sin permisos|no puedes/i.test(msg)?'Esta solicitud ya no está disponible. Actualiza la lista para ver su estado.':'No se ha podido completar la acción. Revisa tu conexión e inténtalo de nuevo.';paintFriends()}
  }finally{FR.busy='';paintFriends();if(view==='user-profile')render()}
}
function historyRow(item){
  return '<div class="history-row"><div><b>'+esc(item.sessionTitle)+'</b><span class="mut">'+new Date(item.playedAt).toLocaleDateString(APP_LANG==='en'?'en-US':'es-ES')+' · Partido '+item.matchNumber+'</span><small>'+esc(item.teammates.join(' / '))+' vs '+esc(item.opponents.join(' / '))+'</small></div><strong class="'+(item.won?'win':'loss')+'">'+item.ownScore+'–'+item.oppScore+'</strong></div>';
}
function vSessions(){
  if(!AU.user)return '<h2>Mis quedadas</h2><p class="lead">Inicia sesión para consultar tus quedadas guardadas.</p><div class="card acct">'+authInner()+'</div>';
  if(HIST.loading)return '<h2>Mis quedadas</h2><div class="card"><p class="hint">Cargando tus quedadas…</p></div>';
  if(HIST.error)return '<h2>Mis quedadas</h2><div class="card err">'+esc(HIST.error)+'</div><button class="btn ghost" data-a="profile">Volver a Mi perfil</button>';
  const cards=HIST.sessions.map(s=>'<button class="session-grid-card" data-session-open="'+s.id+'"><span class="session-grid-date">'+(s.createdAt?new Date(s.createdAt).toLocaleDateString(APP_LANG==='en'?'en-US':'es-ES',{day:'numeric',month:'short',year:'numeric'}):'Fecha no disponible')+'</span><b>'+esc(s.title)+'</b><span class="session-grid-meta">'+s.played+' partidos · '+s.wins+' victorias</span><span class="session-grid-bottom"><span class="tag">'+(s.mode==='fixed'?'Parejas fijas':'Parejas rotatorias')+'</span><span class="session-grid-arrow">›</span></span></button>').join('');
  return '<div class="sessions-page"><div class="sessions-page-head"><div><h2>Mis quedadas</h2><p class="lead">Tu registro de quedadas, con sus resultados y participantes.</p></div><span class="sessions-total">'+HIST.sessions.length+'</span></div>'+(cards?'<div class="session-grid">'+cards+'</div>':'<div class="card empty"><b>Aún no tienes quedadas guardadas</b><br>Cuando guardes una quedada, aparecerá aquí.</div>')+'<button class="btn ghost" data-a="profile">Volver a Mi perfil</button></div>';
}
function vSessionDetail(){
  const s=HIST.sessions.find(x=>x.id===HIST.selectedSessionId);if(!s)return vSessions();
  return '<div class="sessions-page"><button class="btn sm ghost sessions-back" data-a="sessions">← Todas las quedadas</button><section class="card session-detail-hero"><span class="section-kicker">DETALLE DE LA QUEDADA</span><h2>'+esc(s.title)+'</h2><p class="lead">'+(s.createdAt?new Date(s.createdAt).toLocaleDateString(APP_LANG==='en'?'en-US':'es-ES',{day:'numeric',month:'long',year:'numeric'}):'Fecha no disponible')+' · '+(s.mode==='fixed'?'Parejas fijas':'Parejas rotatorias')+'</p><div class="session-detail-stats"><div><b>'+s.played+'</b><span>Partidos</span></div><div><b>'+s.wins+'</b><span>Victorias</span></div><div><b>'+s.losses+'</b><span>Derrotas</span></div></div></section><section class="card session-detail-matches"><div class="profile-card-heading"><h3>Resultados</h3><span class="section-kicker">'+s.matches.length+' PARTIDOS</span></div>'+(s.matches.length?s.matches.map(m=>'<article class="session-match-row"><div class="session-match-info"><b>Partido '+m.matchNumber+'</b><small>'+m.sideA.map(esc).join(' / ')+' <span>vs</span> '+m.sideB.map(esc).join(' / ')+'</small></div><strong>'+(m.scoreA??'—')+'–'+(m.scoreB??'—')+'</strong></article>').join(''):'<p class="empty">Esta quedada no tiene partidos registrados.</p>')+'</section><button class="btn ghost" data-a="sessions">Volver al registro</button></div>';
}
function vHistory(){
  if(!AU.user)return '<h2>Mi historial</h2><p class="lead">Inicia sesión para consultar tus partidos guardados.</p><div class="card acct">'+authInner()+'</div>';
  return '<h2>Mi historial</h2><p class="lead">Tus partidos guardados en PICKLE &amp; MIX.</p>'+
    (HIST.loading?'<div class="card"><p class="hint">Cargando historial…</p></div>':HIST.error?'<div class="card err">'+esc(HIST.error)+'</div>':HIST.items.length?'<div class="card"><div class="profile-metrics"><div class="profile-metric"><b>'+HIST.stats.played+'</b><span>Partidos</span></div><div class="profile-metric"><b>'+HIST.stats.wins+'</b><span>Victorias</span></div><div class="profile-metric"><b>'+Math.round(HIST.stats.winRate*100)+'%</b><span>Victorias</span></div></div>'+HIST.items.map(historyRow).join('')+'</div>':'<div class="card"><p>Aún no tienes partidos guardados. Cuando termines una quedada, podrás guardarla en tu historial.</p></div>')+
    '<button class="btn ghost" data-a="profile">Volver a Mi perfil</button>';
}
function sessionSavePanel(){
  const done=S.matches.filter(m=>m.status==='done');
  if(!S.started||pending().length||!done.length)return '';
  if(S.savedSessionId)return '<div class="card session-saved"><b>Quedada guardada en tu historial</b><span class="mut">Ya has guardado estos resultados en tu perfil.</span></div>';
  if(!AU.user)return '<div class="card"><h3>Guardar en tu historial</h3><p>Inicia sesión con Google para guardar esta quedada y consultar tus estadísticas desde cualquier dispositivo.</p><button class="btn" data-a="profile">Iniciar sesión / Mi perfil</button></div>';
  const players=S.players.filter(p=>done.some(m=>[...m.a,...m.b].includes(p.id)));
  const title='Quedada · '+new Date().toLocaleDateString(APP_LANG==='en'?'en-US':'es-ES');
  const selfOptions=players.filter(p=>!p.userId||p.userId===AU.user.id).map(p=>'<option value="'+p.id+'" '+(p.userId===AU.user.id?'selected':'')+'>'+esc(p.name)+(p.userId===AU.user.id?' · tú':'')+'</option>').join('');
  return '<form class="card session-save" data-f="save-session"><h3>Guardar quedada</h3><p class="mut">Tu cuenta y las cuentas de los amigos vinculados con @ guardarán sus partidos en sus respectivos historiales. Los invitados aparecerán en el resultado, pero no acumularán estadísticas personales.</p><label for="session-title">Nombre de la quedada</label><input id="session-title" name="title" maxlength="80" required value="'+esc(title)+'"><label for="session-self">¿Cuál de estos jugadores eres tú?</label><select id="session-self" name="self_player_id" required><option value="">Selecciona tu jugador</option>'+selfOptions+'</select><button class="btn ball" type="submit">Guardar quedada</button></form>';
}
async function savePlaySession(form){
  if(!sbc||!AU.user)return;
  if(S.savedSessionId){toast('Esta quedada ya está guardada.');return}
  const selfId=Number(form.querySelector('[name="self_player_id"]').value),title=String(form.querySelector('[name="title"]').value||'').trim();
  const done=S.matches.filter(m=>m.status==='done');
  if(!selfId||!S.players.some(p=>p.id===selfId)||!done.length){toast('Selecciona tu jugador y comprueba que haya resultados.');return}
  const players=S.players.map(p=>{const team=(S.teams||[]).find(t=>t.p.includes(p.id));return{local_id:p.id,player_name:p.name,user_id:p.userId||(p.id===selfId?AU.user.id:null),team_id:team?team.id:null}});
  const matches=done.map(m=>({match_number:S.matches.indexOf(m)+1,cycle:m.cycle||null,court:m.court||null,phase:m.ph==='g'?'group':m.ph==='ko'?'knockout':'rot',side_a_score:m.sa,side_b_score:m.sb,side_a_player_ids:m.a,side_b_player_ids:m.b}));
  const btn=form.querySelector('button[type="submit"]');if(btn){btn.disabled=true;btn.textContent='Guardando…'}
  try{
    const {data,error}=await sbc.rpc('save_play_session',{p_title:title,p_mode:FX()?'fixed':'rot',p_points:S.settings.points,p_courts:S.settings.courts,p_self_player_id:selfId,p_players:players,p_matches:matches});
    if(error)throw error;
    S.savedSessionId=data;save();const invited=players.filter(p=>p.user_id&&p.user_id!==AU.user.id).length;toast(invited?'Quedada guardada. Se ha avisado a '+invited+' amigo'+(invited===1?'':'s')+' para confirmar su participación.':'Quedada guardada en tu historial.');render();loadMyHistory();loadMyAchievements();
  }catch(error){console.warn('[history] save:',error&&error.message);if(btn){btn.disabled=false;btn.textContent='Guardar quedada'}toast('No se ha podido guardar la quedada. Comprueba la conexión e inténtalo de nuevo.')}
}
async function loadSessionInvitations(uid){
  try{
    const {data:rows,error}=await sbc.from('play_session_players').select('id,session_id,player_name').eq('user_id',uid).eq('approval_status','pending');
    if(error)throw error;
    if(!rows||!rows.length){HIST.invites=[];return}
    const sessionIds=[...new Set(rows.map(x=>x.session_id))];
    const {data:sessions,error:se}=await sbc.from('play_sessions').select('id,title,owner_id,created_at').in('id',sessionIds);
    if(se)throw se;
    const owners=[...new Set((sessions||[]).map(x=>x.owner_id).filter(Boolean))];
    const {data:profiles,error:pe}=owners.length?await sbc.from('profiles').select('id,display_name,alias').in('id',owners):{data:[],error:null};
    if(pe)throw pe;
    const sm=new Map((sessions||[]).map(x=>[x.id,x])),pm=new Map((profiles||[]).map(x=>[x.id,x]));
    HIST.invites=rows.map(x=>{const session=sm.get(x.session_id),owner=session&&pm.get(session.owner_id);return{id:x.id,sessionId:x.session_id,playerName:x.player_name,title:session?.title||'Quedada',createdAt:session?.created_at||null,organizer:owner?.display_name||owner?.alias||'Un amigo'}}).filter(x=>sm.has(x.sessionId)).sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));
  }catch(error){console.warn('[history] invitations:',error&&error.message);HIST.invites=[]}
}
function sessionInvitesPanel(){
  if(!HIST.invites.length)return '';
  return '<section class="card session-invites"><div class="profile-card-heading"><h3>Participaciones pendientes</h3><span class="community-count">'+HIST.invites.length+'</span></div><p class="mut">Te han incluido en estas quedadas. Confirma si quieres que sus resultados aparezcan en tu perfil y cuenten para tus estadísticas.</p>'+HIST.invites.map(x=>'<article class="session-invite-card"><div><b>'+esc(x.title)+'</b><span class="mut">'+esc(x.organizer)+' · '+(x.createdAt?new Date(x.createdAt).toLocaleDateString(APP_LANG==='en'?'en-US':'es-ES'):'Fecha no disponible')+'</span><small>Jugador: '+esc(x.playerName)+'</small></div><div class="row invite-actions"><button class="btn ball" data-session-response="accept" data-id="'+x.id+'" '+(HIST.inviteBusy===x.id?'disabled':'')+'>Aceptar</button><button class="btn ghost" data-session-response="reject" data-id="'+x.id+'" '+(HIST.inviteBusy===x.id?'disabled':'')+'>Rechazar</button></div></article>').join('')+'</section>';
}
async function respondSessionInvitation(action,id){
  if(!sbc||!AU.user||!id||HIST.inviteBusy)return;
  HIST.inviteBusy=id;paintAuth();
  try{
    const {data,error}=await sbc.rpc('respond_play_session_invitation',{p_player_id:id,p_accept:action==='accept'});
    if(error)throw error;
    toast(action==='accept'?'Torneo añadido a tu perfil.':'Participación rechazada.');
    await loadMyHistory();loadMyAchievements();
  }catch(error){console.warn('[history] invitation response:',error&&error.message);toast('No se ha podido guardar tu respuesta. Actualiza el perfil e inténtalo de nuevo.')}
  finally{HIST.inviteBusy='';paintAuth()}
}
async function loadMyHistory(){
  if(!sbc||!AU.user)return;
  const uid=AU.user.id;HIST.loading=true;HIST.error='';HIST.loaded=false;await loadSessionInvitations(uid);
  if(['history','sessions','session-detail'].includes(view))render();else paintAuth();
  try{
    const {data:mine,error:e1}=await sbc.from('play_session_players').select('id,session_id,player_name').eq('user_id',uid).eq('approval_status','accepted');
    if(e1)throw e1;
    if(!mine||!mine.length){HIST.items=[];HIST.sessions=[];HIST.stats={played:0,wins:0,losses:0,winRate:0,pointsFor:0,pointsAgainst:0,sessions:0};HIST.loaded=true;return}
    const playerIds=mine.map(x=>x.id),sessionIds=[...new Set(mine.map(x=>x.session_id))];
    const [linksResult,sessionsResult]=await Promise.all([sbc.from('play_match_players').select('match_id,session_player_id,side').in('session_player_id',playerIds),sbc.from('play_sessions').select('id,title,mode,created_at').in('id',sessionIds)]);
    if(linksResult.error)throw linksResult.error;if(sessionsResult.error)throw sessionsResult.error;
    const mineLinks=linksResult.data||[],sessionRows=sessionsResult.data||[],matchIds=[...new Set(mineLinks.map(x=>x.match_id))];
    if(!matchIds.length){HIST.items=[];HIST.sessions=sessionRows.map(s=>({id:s.id,title:s.title||'Quedada',mode:s.mode,createdAt:s.created_at,matches:[],played:0,wins:0,losses:0}));HIST.stats={played:0,wins:0,losses:0,winRate:0,pointsFor:0,pointsAgainst:0,sessions:sessionIds.length};HIST.loaded=true;return}
    const [mr,lr]=await Promise.all([sbc.from('play_session_matches').select('id,session_id,match_number,cycle,court,phase,side_a_score,side_b_score,played_at').in('session_id',sessionIds).order('played_at',{ascending:false}),sbc.from('play_match_players').select('match_id,session_player_id,side').in('match_id',matchIds)]);
    for(const x of [mr,lr])if(x.error)throw x.error;
    const allMatchIds=(mr.data||[]).map(x=>x.id),{data:allMatchLinks,error:allLinksError}=await sbc.from('play_match_players').select('match_id,session_player_id,side').in('match_id',allMatchIds),allLinks=allMatchLinks||[],{data:playerRows,error:playerError}=await sbc.from('play_session_players').select('id,player_name,user_id').in('id',[...new Set(allLinks.map(x=>x.session_player_id))]);
    if(allLinksError)throw allLinksError;if(playerError)throw playerError;
    const playerMap=new Map((playerRows||[]).map(x=>[x.id,x]));
    const items=(mr.data||[]).map(m=>{
      const mineLink=mineLinks.find(x=>x.match_id===m.id);if(!mineLink)return null;
      const ownSide=mineLink.side,won=ownSide==='a'?m.side_a_score>m.side_b_score:m.side_b_score>m.side_a_score;
      const peers=allLinks.filter(x=>x.match_id===m.id&&x.session_player_id!==mineLink.session_player_id);
      const teammates=peers.filter(x=>x.side===ownSide).map(x=>playerMap.get(x.session_player_id)?.player_name||'Jugador'),opponents=peers.filter(x=>x.side!==ownSide).map(x=>playerMap.get(x.session_player_id)?.player_name||'Jugador');
      return{matchId:m.id,sessionId:m.session_id,sessionTitle:sessionRows.find(s=>s.id===m.session_id)?.title||'Quedada',matchNumber:m.match_number,playedAt:m.played_at,scoreA:m.side_a_score,scoreB:m.side_b_score,ownSide,ownScore:ownSide==='a'?m.side_a_score:m.side_b_score,oppScore:ownSide==='a'?m.side_b_score:m.side_a_score,won,teammates,opponents};
    }).filter(Boolean);
    const wins=items.filter(x=>x.won).length,losses=items.length-wins;HIST.items=items;
    HIST.sessions=sessionRows.map(s=>{const matches=(mr.data||[]).filter(m=>m.session_id===s.id).map(m=>{const links=allLinks.filter(x=>x.match_id===m.id),sideA=links.filter(x=>x.side==='a').map(x=>playerMap.get(x.session_player_id)?.player_name||'Jugador'),sideB=links.filter(x=>x.side==='b').map(x=>playerMap.get(x.session_player_id)?.player_name||'Jugador');return{matchNumber:m.match_number,playedAt:m.played_at,sideA,sideB,scoreA:m.side_a_score,scoreB:m.side_b_score}}),mine=items.filter(x=>x.sessionId===s.id),w=mine.filter(x=>x.won).length;return{id:s.id,title:s.title||'Quedada',mode:s.mode,createdAt:s.created_at,matches,played:mine.length,wins:w,losses:mine.length-w}}).sort((x,y)=>new Date(y.createdAt||0)-new Date(x.createdAt||0));
    HIST.stats={played:items.length,wins,losses,winRate:items.length?wins/items.length:0,pointsFor:items.reduce((n,x)=>n+x.ownScore,0),pointsAgainst:items.reduce((n,x)=>n+x.oppScore,0),sessions:sessionIds.length};HIST.loaded=true;
  }catch(error){console.warn('[history] load:',error&&error.message);HIST.error='No se ha podido cargar tu historial guardado.';HIST.loaded=true}
  finally{HIST.loading=false;if(['history','sessions','session-detail'].includes(view))render();else paintAuth()}
}
function vAuthLanding(){return '<div id="authbox" class="auth-landing">'+authInner()+'</div>'}
function vProfile(){return vAuthLanding()}
let SETTINGS_TAB=initialSettingsTab;
const NOTIF_DEFAULTS={in_app_enabled:true,push_enabled:false,friend_requests_enabled:true,club_posts_enabled:true,club_events_enabled:true,achievements_enabled:true,support_replies_enabled:true};
let NOTIF_PREFS={...NOTIF_DEFAULTS,loaded:false,loading:false,saving:false};
async function loadNotificationPreferences(){
 if(!AU.user||!sbc){NOTIF_PREFS={...NOTIF_DEFAULTS,loaded:true,loading:false,saving:false};render();return}
 NOTIF_PREFS.loading=true;NOTIF_PREFS.loaded=false;render();
 try{
  const {data,error}=await sbc.from('profile_notification_preferences').select('in_app_enabled,push_enabled,friend_requests_enabled,club_posts_enabled,club_events_enabled,achievements_enabled,support_replies_enabled').eq('user_id',AU.user.id).maybeSingle();
  if(error)throw error;
  NOTIF_PREFS={...NOTIF_DEFAULTS,...(data||{}),loaded:true,loading:false,saving:false};
 }catch(error){
  NOTIF_PREFS.loading=false;NOTIF_PREFS.loaded=true;
  console.warn('[notifications] preferences load:',error&&error.message);
  toast('No se han podido cargar tus preferencias de notificación.');
 }
 if(view==='settings'&&SETTINGS_TAB==='notifications')render();
}
async function saveNotificationPreference(key,value){
 if(!AU.user||!sbc||!Object.prototype.hasOwnProperty.call(NOTIF_DEFAULTS,key))return;
 const previous=NOTIF_PREFS[key];NOTIF_PREFS[key]=!!value;NOTIF_PREFS.saving=true;render();
 try{
  const payload={user_id:AU.user.id,in_app_enabled:NOTIF_PREFS.in_app_enabled,push_enabled:NOTIF_PREFS.push_enabled,friend_requests_enabled:NOTIF_PREFS.friend_requests_enabled,club_posts_enabled:NOTIF_PREFS.club_posts_enabled,club_events_enabled:NOTIF_PREFS.club_events_enabled,achievements_enabled:NOTIF_PREFS.achievements_enabled,support_replies_enabled:NOTIF_PREFS.support_replies_enabled,updated_at:new Date().toISOString()};
  const {error}=await sbc.from('profile_notification_preferences').upsert(payload,{onConflict:'user_id'});
  if(error)throw error;
  toast('Preferencias guardadas.');
 }catch(error){
  NOTIF_PREFS[key]=previous;
  toast('No se ha podido guardar el ajuste. Inténtalo de nuevo.');
  console.warn('[notifications] preferences save:',error&&error.message);
 }finally{
  NOTIF_PREFS.saving=false;
  if(view==='settings'&&SETTINGS_TAB==='notifications')render();
 }
}

const PUSH_VAPID_PUBLIC_KEY='BA0ugLtufmV4ZUsDkFf7xcdx55cwcfCumQTO4H3IY28QmXG5Dr2hSaUhR_zvT9FhlOtLgxXLBGxzu83O1L1PhLY';
function pushBase64ToBytes(value){const pad='='.repeat((4-value.length%4)%4);const raw=atob((value+pad).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(raw,c=>c.charCodeAt(0))}
async function setPushEnabled(enabled){
 if(!AU.user||!sbc){toast('Inicia sesión para activar las notificaciones push.');render();return}
 try{
  if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window))throw new Error('Este navegador no admite notificaciones push.');
  if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window))throw new Error('Este navegador no admite notificaciones push.');
  if(enabled){
   let permission=Notification.permission;
   if(permission==='default')permission=await Notification.requestPermission();
   if(permission!=='granted')throw new Error('No se ha concedido permiso para mostrar notificaciones.');
  }
  const reg=await navigator.serviceWorker.ready;
  let subscription=await reg.pushManager.getSubscription();
  if(enabled){
   if(!subscription)subscription=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:pushBase64ToBytes(PUSH_VAPID_PUBLIC_KEY)});
   const data=subscription.toJSON(),keys=data.keys||{};
   if(!data.endpoint||!keys.p256dh||!keys.auth)throw new Error('No se ha podido registrar este dispositivo.');
   const {error}=await sbc.from('push_subscriptions').upsert({user_id:AU.user.id,endpoint:data.endpoint,p256dh:keys.p256dh,auth:keys.auth,user_agent:navigator.userAgent,updated_at:new Date().toISOString()},{onConflict:'endpoint'});
   if(error)throw error;
  }else if(subscription){
   const endpoint=subscription.endpoint;
   const {error}=await sbc.from('push_subscriptions').delete().eq('endpoint',endpoint);
   if(error)throw error;
   await subscription.unsubscribe();
  }
  await saveNotificationPreference('push_enabled',!!enabled);
 }catch(error){
  NOTIF_PREFS.push_enabled=!enabled;render();
  toast(error&&error.message?error.message:'No se ha podido actualizar la configuración push.');
  console.warn('[push] setup:',error&&error.message);
 }
}

function settingsBack(){return '<div class="settings-page-head"><button type="button" class="settings-back" data-a="'+(SETTINGS_TAB==='main'?'profile':'settingsHome')+'"><span aria-hidden="true">‹</span> '+(SETTINGS_TAB==='main'?'Mi perfil':'Ajustes')+'</button><span class="settings-head-label">AJUSTES</span></div>'}
function settingsRow(icon,title,desc,action){return '<button type="button" class="settings-row" data-a="'+action+'"><span class="settings-row-icon">'+icon+'</span><span class="settings-row-copy"><b>'+title+'</b><small>'+desc+'</small></span><span class="settings-row-arrow" aria-hidden="true">›</span></button>'}
function vSettings(){const tab=SETTINGS_TAB;
 if(tab==='privacy'){
  if(!AU.user||!AU.profile)return '<div class="settings-page">'+settingsBack()+'<h2>Privacidad</h2><div class="card"><p>Inicia sesión para gestionar la privacidad de tu perfil.</p></div></div>';
  const p=AU.profile,opt=(k,v,t)=>'<option value="'+v+'"'+(p[k]===v?' selected':'')+'>'+t+'</option>';
  return '<div class="settings-page">'+settingsBack()+'<div class="settings-intro"><span>PRIVACIDAD</span><h2>Tu privacidad</h2><p>Decide quién puede consultar la información de tu perfil.</p></div><form class="card settings-form" data-f="privacy">'+
   '<label for="settings-stats">Estadísticas</label><small>Controla quién puede ver tus resultados y rendimiento.</small><select id="settings-stats" name="stats_visibility">'+opt('stats_visibility','everyone','Todo el mundo')+opt('stats_visibility','friends','Solo amigos')+opt('stats_visibility','nobody','Nadie')+'</select>'+
   '<label for="settings-history">Historial</label><small>Controla quién puede consultar tus partidos y quedadas guardadas.</small><select id="settings-history" name="history_visibility">'+opt('history_visibility','everyone','Todo el mundo')+opt('history_visibility','friends','Solo amigos')+opt('history_visibility','nobody','Nadie')+'</select>'+
   '<label for="settings-location">Ubicación</label><small>Controla quién puede ver la ciudad y ubicación de tu perfil.</small><select id="settings-location" name="location_visibility">'+opt('location_visibility','everyone','Todo el mundo')+opt('location_visibility','friends','Solo amigos')+opt('location_visibility','nobody','Nadie')+'</select><button class="btn" type="submit">Guardar privacidad</button></form></div>';
 }
 if(tab==='notifications'){
  if(!AU.user)return '<div class="settings-page">'+settingsBack()+'<div class="settings-intro"><span>NOTIFICACIONES</span><h2>Preferencias de avisos</h2><p>Configura qué avisos quieres recibir y cómo.</p></div><section class="card settings-pref-note"><b>Necesitas una cuenta</b><p>Inicia sesión o crea una cuenta para guardar tus preferencias de notificación.</p><button type="button" class="btn" data-a="profile">Iniciar sesión</button></section></div>';
  if(NOTIF_PREFS.loading||!NOTIF_PREFS.loaded)return '<div class="settings-page">'+settingsBack()+'<div class="settings-intro"><span>NOTIFICACIONES</span><h2>Preferencias de avisos</h2><p>Cargando tus preferencias…</p></div></div>';
  const pref=(key,title,desc)=>'<label class="settings-pref-row"><span class="settings-pref-copy"><b>'+title+'</b><small>'+desc+'</small></span><input type="checkbox" data-notification-pref="'+key+'" '+(NOTIF_PREFS[key]?'checked':'')+((!NOTIF_PREFS.in_app_enabled||NOTIF_PREFS.saving)?' disabled':'')+' aria-label="'+title+'"></label>';
  return '<div class="settings-page">'+settingsBack()+'<div class="settings-intro"><span>NOTIFICACIONES</span><h2>Preferencias de avisos</h2><p>Elige qué novedades quieres recibir dentro de Pickle&amp;Mix.</p></div>'+
   '<section class="card settings-pref-card"><div class="settings-pref-section-head"><div><b>Notificaciones dentro de Pickle&amp;Mix</b><small>Avisos que aparecen en la campana de la aplicación.</small></div><span class="settings-pref-status">DISPONIBLE</span></div>'+
   '<label class="settings-pref-master"><span><b>Activar notificaciones</b><small>Desactiva este ajuste para dejar de recibir todos los avisos.</small></span><input type="checkbox" data-notification-pref="in_app_enabled" '+(NOTIF_PREFS.in_app_enabled?'checked':'')+(NOTIF_PREFS.saving?' disabled':'')+' aria-label="Activar notificaciones dentro de Pickle&Mix"></label>'+
   '<div class="settings-pref-divider"></div><div class="settings-pref-subtitle">TIPOS DE AVISO</div>'+
   pref('friend_requests_enabled','Solicitudes de amistad','Cuando alguien quiera conectar contigo.')+
   pref('club_posts_enabled','Publicaciones de clubes','Cuando se publique una noticia en uno de tus clubes.')+
   pref('club_events_enabled','Eventos de clubes','Cuando se anuncie un nuevo evento en uno de tus clubes.')+
   pref('achievements_enabled','Logros y medallas','Cuando desbloquees una nueva insignia.')+
   pref('support_replies_enabled','Respuestas a tus consultas','Cuando el equipo de Pickle&Mix responda a una consulta que hayas abierto.')+
   (NOTIF_PREFS.saving?'<p class="settings-pref-saving">Guardando preferencias…</p>':'<p class="settings-pref-autosave">Los cambios se guardan automáticamente.</p>')+'</section>'+
   '<section class="card settings-pref-card"><div class="settings-pref-section-head"><div><b>Notificaciones push</b><small>Recibe avisos del dispositivo aunque Pickle&amp;Mix esté cerrada.</small></div><span class="settings-pref-status">DISPONIBLE</span></div>'+
   '<label class="settings-pref-master"><span><b>Activar notificaciones push</b><small>Necesitas permitir las notificaciones en este dispositivo. Puedes desactivarlas cuando quieras.</small></span><input type="checkbox" data-notification-pref="push_enabled" '+(NOTIF_PREFS.push_enabled?'checked':'')+(NOTIF_PREFS.saving?' disabled':'')+' aria-label="Activar notificaciones push"></label>'+
   '<p class="settings-pref-autosave">Solo para cuentas registradas. En iPhone, la app debe estar añadida a la pantalla de inicio.</p></section>'+
   '<section class="card settings-pref-card"><div class="settings-pref-section-head"><div><b>Correo electrónico</b><small>Recibir novedades en tu dirección de email.</small></div><span class="settings-pref-status">PRÓXIMAMENTE</span></div></section></div>';
 }
 if(tab==='account')return '<div class="settings-page">'+settingsBack()+'<div class="settings-intro"><span>CUENTA</span><h2>Tu cuenta</h2><p>Gestiona tus datos personales y el acceso a Pickle&amp;Mix.</p></div><section class="card settings-account-card">'+(AU.user?'<div class="me">'+auAvatar(AU.user)+'<div><b>'+esc(auName(AU.user))+'</b><small>'+esc(AU.user.email||'')+'</small></div></div><button class="btn ghost" data-a="profileSettings">Editar datos del perfil</button><button class="btn ghost settings-logout" data-a="logout">Cerrar sesión</button>':'<p>Estás utilizando Pickle&Mix sin una cuenta registrada.</p><button class="btn" data-a="profile">Iniciar sesión o crear cuenta</button>')+'</section></div>';
 if(tab==='language')return '<div class="settings-page">'+settingsBack()+'<div class="settings-intro"><span>PREFERENCIAS</span><h2>Idioma</h2><p>Selecciona el idioma en el que quieres utilizar Pickle&amp;Mix.</p></div><section class="card settings-form settings-language-card"><label for="settings-language">Idioma de la aplicación</label><select id="settings-language" data-language-select><option value="es"'+(APP_LANG==='es'?' selected':'')+'>Español</option><option value="en"'+(APP_LANG==='en'?' selected':'')+'>English</option></select><small>El cambio se aplica inmediatamente.</small></section></div>';
 if(tab==='help'){
  const en=APP_LANG==='en',name=AU.profile?.display_name||'',email=AU.user?.email||'';
  const labels={problem:en?'Problem or error':'Problema o error',suggestion:en?'Suggestion':'Sugerencia',question:en?'Question':'Consulta',other:en?'Other':'Otro'};
  const states={pending:en?'Pending':'Pendiente',reviewing:en?'In review':'En revisión',awaiting_user:en?'Your reply needed':'Esperando tu respuesta',awaiting_admin:en?'Waiting for support':'Esperando al equipo',resolved:en?'Resolved':'Resuelta'};
  const base='<div class="settings-page">'+settingsBack()+'<div class="settings-intro"><span>'+(en?'HELP & INFORMATION':'AYUDA E INFORMACIÓN')+'</span><h2>'+(en?'Help & contact':'Ayuda y contacto')+'</h2><p>'+(en?'Get help with a question, problem or suggestion.':'Abre una consulta y podrás seguir la conversación desde aquí.')+'</p></div>';
  if(!AU.user)return base+'<section class="card support-email-card"><div><b>'+(en?'Contact us by email':'Contacta por email')+'</b><p>'+(en?'Guest users can contact us by email.':'Si utilizas Pickle&Mix como invitado, puedes contactar con nosotros por correo electrónico.')+'</p></div><a class="btn" href="mailto:pickleandmixapp@gmail.com?subject=Pickle%26Mix%20-%20Support">pickleandmixapp@gmail.com</a></section></div>';
  if(SUPPORT.selected){
    const t=SUPPORT.tickets.find(x=>x.id===SUPPORT.selected);
    if(!t){SUPPORT.selected=null}
    else{
      const replies=SUPPORT.replies.map(x=>'<article class="support-chat-bubble '+(x.sender_role==='admin'?'from-admin':'from-user')+'"><small>'+(x.sender_role==='admin'?(en?'Pickle&Mix support':'Soporte Pickle&Mix'):(en?'You':'Tú'))+' · '+adate(x.created_at)+'</small><p>'+esc(x.message)+'</p></article>').join('');
      const first='<article class="support-chat-bubble from-user"><small>'+(en?'You · original message':'Tú · mensaje inicial')+' · '+adate(t.created_at)+'</small><p>'+esc(t.message)+'</p></article>';
      const replyForm=t.status==='awaiting_user'?'<form class="card settings-form support-reply-form" data-f="support-reply-user" data-id="'+t.id+'"><label>'+(en?'Your reply':'Tu respuesta')+'</label><textarea name="message" rows="4" maxlength="5000" required placeholder="'+(en?'Write one reply…':'Escribe tu respuesta…')+'"></textarea><button class="btn" type="submit">'+(en?'Send reply':'Enviar respuesta')+'</button></form>':t.status==='resolved'?'<p class="support-locked-note">'+(en?'This conversation is closed. You can still read its history.':'Esta consulta está resuelta y cerrada. Puedes seguir consultando el historial.')+'</p>':'<p class="support-locked-note">'+(en?'Your message has been received. You can reply when support responds.':'Tu mensaje está enviado. Podrás responder cuando el equipo te conteste.')+'</p>';
      return base+'<button class="btn ghost sm support-back-btn" type="button" data-support-back>'+(en?'← My enquiries':'← Mis consultas')+'</button><section class="card support-thread-head"><span class="admin-meta-chip">'+esc(labels[t.category]||t.category)+'</span><span class="support-admin-status status-'+esc(t.status)+'">'+esc(states[t.status]||t.status)+'</span><h3>'+esc(t.subject)+'</h3><small>'+(en?'Created':'Creada')+' · '+adate(t.created_at)+'</small></section><div class="support-chat-thread">'+first+replies+'</div>'+replyForm+'</div>';
    }
  }
  const tickets=SUPPORT.tickets.map(t=>'<button type="button" class="support-ticket-row" data-support-open="'+t.id+'"><span><b>'+esc(t.subject)+'</b><small>'+adate(t.updated_at||t.created_at)+'</small></span><span class="support-admin-status status-'+esc(t.status)+'">'+esc(states[t.status]||t.status)+'</span><i>›</i></button>').join('');
  return base+'<form class="card settings-form support-contact-form" data-f="support-message"><label>'+(en?'What can we help you with?':'¿En qué podemos ayudarte?')+'</label><select name="category" required><option value="problem">'+labels.problem+'</option><option value="suggestion">'+labels.suggestion+'</option><option value="question">'+labels.question+'</option><option value="other">'+labels.other+'</option></select><label for="support-subject">'+(en?'Subject':'Asunto')+'</label><input id="support-subject" name="subject" maxlength="120" minlength="3" required placeholder="'+(en?'Briefly describe your message':'Resume brevemente tu consulta')+'"><label for="support-message">'+(en?'Message':'Mensaje')+'</label><textarea id="support-message" name="message" rows="5" maxlength="5000" minlength="10" required placeholder="'+(en?'Write your message here…':'Explícanos qué ha ocurrido o qué necesitas…')+'"></textarea><input type="hidden" name="email" value="'+esc(email)+'"><input type="hidden" name="sender_name" value="'+esc(name)+'"><small class="support-contact-note">'+(en?'Your enquiry will be linked to your account. You can follow replies here.':'La consulta quedará asociada a tu cuenta. Podrás seguir las respuestas desde esta pantalla.')+'</small><button class="btn" type="submit">'+(en?'Open enquiry':'Enviar consulta')+'</button></form><section class="support-ticket-list"><div class="support-list-heading"><h3>'+(en?'My enquiries':'Mis consultas')+'</h3><button class="btn ghost sm" type="button" data-support-refresh>'+(en?'Refresh':'Actualizar')+'</button></div>'+(SUPPORT.loading?'<p class="mut">Cargando…</p>':tickets||'<p class="mut">'+(en?'You have not opened any enquiries yet.':'Todavía no has abierto ninguna consulta.')+'</p>')+'</section><section class="card support-email-card"><div><b>'+(en?'Prefer email?':'¿Prefieres el correo electrónico?')+'</b><p>'+(en?'You can also contact us directly.':'También puedes escribirnos directamente.')+'</p></div><a class="btn ghost" href="mailto:pickleandmixapp@gmail.com?subject=Pickle%26Mix%20-%20Support">pickleandmixapp@gmail.com</a></section></div>';
 }
 if(tab==='about')return '<div class="settings-page">'+settingsBack()+'<section class="card settings-about"><div class="settings-about-mark">P&amp;M</div><h2>Pickle&amp;Mix</h2><p class="settings-about-tagline">La comunidad para disfrutar del pickleball.</p><div class="settings-about-meta"><span>Desarrollado por</span><b>KBDG</b></div><p class="settings-about-credit">Plataforma para pickleballers creada por <a href="https://kikebarcelodg.github.io/" target="_blank" rel="noopener">KBDG</a>.</p></section></div>';
 return '<div class="settings-page">'+settingsBack()+'<div class="settings-intro"><span>CONFIGURACIÓN</span><h2>Ajustes</h2><p>Gestiona tu cuenta y personaliza tu experiencia en Pickle&amp;Mix.</p></div><section class="settings-group"><h3>CUENTA</h3>'+settingsRow('◉','Datos de la cuenta','Información personal y acceso','settingsAccount')+'</section><section class="settings-group"><h3>PREFERENCIAS</h3>'+settingsRow('文','Idioma','Cambia el idioma de la aplicación','settingsLanguage')+'</section><section class="settings-group"><h3>PRIVACIDAD</h3>'+settingsRow('◇','Privacidad','Controla qué información compartes','settingsPrivacy')+'</section><section class="settings-group"><h3>NOTIFICACIONES</h3>'+settingsRow('♧','Notificaciones','Elige qué avisos recibir y cómo','settingsNotifications')+'</section><section class="settings-group"><h3>AYUDA E INFORMACIÓN</h3>'+settingsRow('?','Ayuda y contacto','Sugerencias, consultas y errores','settingsHelp')+settingsRow('ⓘ','Acerca de Pickle&amp;Mix','Información de la aplicación y créditos','settingsAbout')+'</section></div>';
}
/* Resumen del modo rotatorio: reparto por jugador y duración estimada (valores medios orientativos) */
const CMAX=20; /* máximo de ciclos (partidos por jugador) que admite el campo «Ciclos» */
const DUR={7:11,9:14,11:18,15:25};
function durOf(p){if(DUR[p])return DUR[p];const k=[7,9,11,15];let a,b;
  if(p<7){a=7;b=9}else if(p>15){a=11;b=15}else{a=k.filter(x=>x<p).pop();b=k.find(x=>x>p)}
  return Math.max(4,DUR[a]+(DUR[b]-DUR[a])*(p-a)/(b-a))}
function rotInfo(n,c,courts,points){
  if(n<4)return null;
  const M=Math.ceil(n*c/4),ex=4*M-n*c,P=Math.max(1,Math.min(courts,Math.floor(n/4))),
  rounds=Math.max(Math.ceil(M/P),c+(ex?1:0)),dur=durOf(points);
  let up=c+1;while(n*up%4)up++;let dn=c-1;while(dn>=1&&n*dn%4)dn--;
  return{n,c,M,ex,P,rounds,dur,tot:rounds*dur+(rounds-1)*2,up:up<=CMAX?up:0,dn:dn>=1?dn:0}}
const fmtMin=t=>{t=Math.max(5,Math.round(t/5)*5);const h=Math.floor(t/60),m=t%60;return h?h+' h'+(m?' '+m+' min':''):m+' min'};
function rotSummary(){
  const s=S.settings,r=rotInfo(S.players.length,s.cycles,s.courts,s.points);
  if(!r)return'<div class="card"><h3>Resumen</h3><p class="mut">Añade al menos 4 jugadores para ver el reparto previsto.</p></div>';
  const jug=k=>k===1?'1 jugador jugará':k+' jugadores jugarán',pa=k=>k+(k===1?' partido':' partidos'),ok=!r.ex,alts=[r.up,r.dn].filter(Boolean);
  return`<div class="card"><h3>Resumen</h3>
  <div class="sl"><span class="ic">🎾</span><div><b>${pa(r.M)} previstos</b></div></div>
  <div class="sl"><span class="ic">👥</span><div>${ok?`Todos los jugadores jugarán <b>${pa(r.c)}</b>.`:`<b>${jug(r.n-r.ex)} ${pa(r.c)}</b> y <b>${r.ex===1?'1 jugará':r.ex+' jugarán'} ${r.c+1}</b>.`}</div></div>
  ${ok?'':`<div class="err">⚠️ Reparto desigual: algunos jugadores disputarán un partido más que otros. ${alts.length?`Para igualar el reparto, prueba con ${alts.join(' o ')} ciclos. `:''}Puedes empezar igualmente.</div>`}
  <div class="sl"><span class="ic">⏱</span><div>Duración estimada: <b>aprox. ${fmtMin(r.tot)}</b><br><span class="mut">${r.rounds} turnos de ~${Math.round(r.dur)} min + 2 min de transición, con ${r.P} partido${r.P>1?'s':''} a la vez. Estimación aproximada, no una garantía.</span></div></div></div>`}
function matchClubPicker(){if(!AU.user)return'';return '<section class="card match-club-import player-source-card"><span class="player-source-icon">CLUB</span><div class="player-source-copy"><b>Añadir desde un club</b><small>Incorpora de una vez a los miembros de uno de tus clubes (máximo 40).</small><button type="button" class="btn sm ghost" data-match-club-toggle>'+(MATCH_CLUBS.open?'Cerrar selector':'＋ Elegir club')+'</button></div>'+(MATCH_CLUBS.open?MATCH_CLUBS.loading?'<p class="hint">Cargando tus clubes…</p>':MATCH_CLUBS.items.length?'<div class="player-club-picker"><select data-match-club-select aria-label="Selecciona un club"><option value="">Selecciona un club</option>'+MATCH_CLUBS.items.map(c=>'<option value="'+c.club_id+'" '+(MATCH_CLUBS.selected===c.club_id?'selected':'')+' '+(Number(c.member_count)>40?'disabled':'')+'>'+esc(c.club_name)+' · '+c.member_count+' miembros'+(Number(c.member_count)>40?' · supera el límite':'')+'</option>').join('')+'</select><button type="button" class="btn sm" data-match-club-import '+(!MATCH_CLUBS.selected||MATCH_CLUBS.busy?'disabled':'')+'>'+(MATCH_CLUBS.busy?'Añadiendo…':'Añadir miembros')+'</button></div><p class="hint">Solo aparecen clubes de los que ya formas parte. Los clubes con más de 40 miembros no se pueden importar.</p>':'<p class="hint">No perteneces a ningún club todavía.</p>':'')+'</section>'}
async function loadMatchClubs(){if(!sbc||!AU.user)return;MATCH_CLUBS.loading=true;if(view==='setup')render();try{const {data,error}=await sbc.rpc('get_my_match_clubs');if(error)throw error;MATCH_CLUBS.items=data||[];MATCH_CLUBS.loaded=true;if(!MATCH_CLUBS.items.some(c=>c.club_id===MATCH_CLUBS.selected))MATCH_CLUBS.selected=''}catch(e){toast(e.message||'No se han podido cargar tus clubes.')}finally{MATCH_CLUBS.loading=false;if(view==='setup')render()}}
async function importMatchClub(){
  const select=document.querySelector('[data-match-club-select]');
  const selected=select?select.value:MATCH_CLUBS.selected;
  if(!AU.user||!selected||MATCH_CLUBS.busy)return;
  MATCH_CLUBS.selected=selected;
  const club=MATCH_CLUBS.items.find(c=>String(c.club_id)===String(selected));
  if(club&&Number(club.member_count)>40){toast('Este club supera el límite de 40 miembros.');return}
  MATCH_CLUBS.busy=true;
  const button=document.querySelector('[data-match-club-import]');
  if(button){button.disabled=true;button.textContent='Añadiendo…'}
  try{
    if(!sbc)throw new Error('No se ha podido conectar con el servicio. Recarga la página e inténtalo de nuevo.');
    const {data,error}=await sbc.rpc('get_match_club_players',{p_club_id:selected});
    if(error)throw error;
    const people=Array.isArray(data)?data:[];
    if(!people.length)throw new Error('Este club no tiene miembros disponibles para importar.');
    let added=0,linked=0,skipped=0;
    people.forEach(p=>{
      if(S.players.some(x=>x.userId===p.user_id)){skipped++;return}
      const base=String(p.display_name||p.alias||'Jugador').trim().slice(0,24)||'Jugador';
      let existing=S.players.find(x=>!x.userId&&normName(x.name)===normName(base));
      if(existing){existing.userId=p.user_id;linked++;return}
      let name=base;
      if(nameTaken(name)){
        const suffix=p.alias?' (@'+p.alias+')':' '+(added+1);
        name=(base.slice(0,Math.max(1,24-suffix.length))+suffix).slice(0,24);
        let n=2;
        while(nameTaken(name)){const extra=' '+n++;name=(base.slice(0,24-extra.length)+extra).slice(0,24)}
      }
      S.players.push({id:S.nid++,name,userId:p.user_id,status:'active'});added++;
    });
    save();
    MATCH_CLUBS.open=false;
    toast('Club importado: '+(added+linked)+' jugadores añadidos'+(skipped?', '+skipped+' ya estaban en la lista':'')+'.');
    render();
  }catch(e){
    toast(e.message||'No se han podido importar los jugadores.');
  }finally{
    MATCH_CLUBS.busy=false;
    if(view==='setup'){
      const btn=document.querySelector('[data-match-club-import]');
      if(btn){btn.disabled=!MATCH_CLUBS.selected;btn.textContent='Añadir miembros'}
    }
  }
}
function vSetup(){const c=S.settings,n=S.players.length,T=Math.floor(n/2),tot=FX()?fxTotal(T):(n>=4?Math.ceil(n*c.cycles/4):0),selfAdded=!!(AU.user&&S.players.some(p=>p.userId===AU.user.id));
  return`${modeSel()}
  <section class="player-builder">
    <div class="player-builder-heading"><div><span class="player-builder-kicker">PREPARACIÓN</span><h3>Jugadores</h3><p>Añade a las personas que van a participar en la quedada.</p></div><span class="player-total">${n}<small>${n===1?'jugador':'jugadores'}</small></span></div>
    <form class="card player-add" data-f="add">
      <div class="player-section-title"><span class="player-step">1</span><div><b>Añadir un jugador</b><small>Busca un amigo o añade un invitado.</small></div></div>
      <div class="player-add-controls"><input name="n" autocomplete="off" placeholder="Nombre o @alias"><button class="btn sm fix">Añadir</button></div>
      <div id="player-suggestions" class="player-suggestions" hidden></div>
      <p class="hint">Usa <b>@alias</b> para vincular a un amigo, o un nombre para añadir un invitado. También puedes escribir <b>@yo</b> o tu propio alias.</p>
      ${nameErrBox()}
    </form>
    ${AU.user?`<div class="player-source-grid">
      <section class="player-source-card player-self-card"><span class="player-source-icon">TÚ</span><div class="player-source-copy"><b>${selfAdded?'Ya estás en la quedada':'Añadirte a ti'}</b><small>${selfAdded?'Tu perfil ya está vinculado a la lista.':'Vincula tus resultados directamente a tu perfil.'}</small></div><button type="button" class="btn sm ${selfAdded?'ghost':'fix'}" data-addself ${selfAdded?'disabled':''}>${selfAdded?'Añadido':'＋ Añadirme'}</button></section>
      ${matchClubPicker()}
    </div>`:''}
    <section class="card player-roster">
      <div class="player-roster-head"><div class="player-section-title"><span class="player-step">2</span><div><b>Lista de participantes</b><small>${n?'Revisa los nombres antes de generar los partidos.':'Aquí aparecerán los jugadores que añadas.'}</small></div></div><span class="player-roster-count">${n}</span></div>
      ${n?S.players.map(p=>`<div class="row player-entry"><span class="player-avatar ${p.userId?'linked':''}">${esc((p.name||'?').trim().charAt(0).toUpperCase())}</span><input value="${esc(p.name)}" data-ren="${p.id}" aria-label="Nombre"><span class="player-account ${p.userId?'linked':''}">${p.userId?'Vinculado':'Invitado'}</span><button class="btn sm red fix" data-del="${p.id}" aria-label="Eliminar ${esc(p.name)}">✕</button></div>`).join(''):'<div class="empty">👥<br><b>Aún no hay jugadores</b><br>Añade al menos 4 para empezar.</div>'}
    </section>
  </section>
  ${pairsCard()}
  <div class="card"><div class="row"><label>Pistas<input type="number" min="1" max="4" value="${c.courts}" data-set="courts"></label><label>Puntos<input type="number" min="3" max="21" value="${c.points}" data-set="points"></label>${FX()?'':`<label>Ciclos<input type="number" min="1" max="${CMAX}" value="${c.cycles}" data-set="cycles"></label>`}</div>${FX()?'':'<p class="hint">🔁 <b>Ciclos</b> = partidos que juega cada persona.</p>'}</div>
  ${FX()?fxFlow():rotSummary()}
  <div class="ok"><div class="stats"><div class="stat"><b>${n}</b><span>jugadores</span></div>${FX()?'':`<div class="stat"><b>${c.cycles}</b><span>ciclos</span></div>`}<div class="stat"><b>${tot}</b><span>partidos previstos</span></div></div><p class="mut" style="margin:8px 0 0">ℹ️ Planificación orientativa: no garantiza el mismo descanso para todos.</p></div>
  <button class="btn ball" data-a="start" ${n<4?'disabled':''}>Generar partidos</button>
  <button class="btn ghost" data-a="home">Volver</button>`}
function vGame(){
  const lv=live(),em=ed&&S.matches.find(x=>x.id===ed),m=em||lv.find(x=>x.court===ct)||lv[0];if(m&&!em)ct=m.court;
  if(!m)return`<div class="logo">¡FIN!</div><div class="note tip"><b>🎉 No quedan partidos pendientes.</b><br>Mira el resumen final o empieza una nueva quedada.</div><button class="btn ball" data-a="final">Ver resumen final</button>${S.started&&S.matches.length?'<button class="btn ghost" data-a="repeat">Repetir con los mismos jugadores</button><button class="btn red" data-a="reset">Nueva quedada (borra todo)</button>':''}<nav><button class="btn ghost sm" data-a="more">Jugadores</button></nav>`;
  tmp=SC[m.id]||(SC[m.id]={id:m.id,a:m.sa??0,b:m.sb??0});
  const idx=S.matches.indexOf(m)+1,nx=pending().find(x=>x!==m&&!lv.includes(x)),
  ctabs=!em&&lv.length>1?`<div class="ctabs" role="tablist" aria-label="Pistas en juego">${lv.map(x=>{const t=SC[x.id];return`<button role="tab" data-ct="${x.court}" aria-selected="${x===m}"><b>Pista ${x.court}</b><small>${t&&(t.a||t.b)?t.a+' - '+t.b:'en juego'}</small></button>`}).join('')}</div>`:'',tm=(t,c,l)=>`<div class="team ${c}"><div class="mut" style="color:#fff">${l}</div><div class="n">${t.map(i=>esc(nameOf(i))).join('<br>')}</div><div class="sc"><button data-sc="${c}-1" aria-label="Restar">−</button><output>${tmp[c]}</output><button data-sc="${c}1" aria-label="Sumar">+</button></div></div>`;
  return`${ctabs}<div class="head"><h2>Partido ${idx}</h2><span class="chip">${FX()?(m.lbl||'Grupo A'):'Ciclo '+m.cycle} · Pista ${m.court}</span></div>${bar()}
  ${tm(m.a,'a','Pareja A')}<div class="vs">contra</div>${tm(m.b,'b','Pareja B')}
  <button class="btn ball" data-a="ok">${m.status==='done'?'Guardar corrección':'Confirmar resultado'}</button>
  <div class="row">${m.ph==='ko'?'':'<button class="btn ghost" data-a="skip">Saltar partido</button>'}${m.status==='done'?'<button class="btn ghost" data-a="cancel">Cancelar</button>':''}</div>
  ${nx?`<div class="card pend"><span class="mut">${lv.length>1?'En cola:':'Después:'}</span><br><b>${nx.a.map(nameOf).map(esc).join(' y ')}</b> vs <b>${nx.b.map(nameOf).map(esc).join(' y ')}</b></div>`:''}
  ${!em&&nx&&lv.length<S.settings.courts?'<div class="note">⏳ <b>Hay una pista libre:</b> el siguiente partido necesita a jugadores que todavía están en pista. Empezará cuando terminen.</div>':''}
  ${FX()?fxFlow():''}
  <nav><button class="btn ghost sm" data-a="more">Jugadores</button></nav>`}
function vMore(){
  const done=S.matches.filter(m=>m.status!=='pending');
  return`<h2>Jugadores</h2><div class="note">${FX()?'✏️ <b>Parejas fijas:</b> aquí puedes corregir nombres y resultados.':'🔄 <b>Cualquier cambio</b> recalcula solo los partidos pendientes.'}</div>
  ${FX()?fxMore():`<div class="card">${S.players.map(p=>`<div style="margin:10px 0"><div class="row"><input value="${esc(p.name)}" data-ren="${p.id}" aria-label="Nombre"><span class="tag fix">${{rest:'Descansa',out:'Se marcha'}[p.status]||'Juega'}</span></div>
  <button class="btn sm ghost" data-st="${p.id}-rest">${p.status==='rest'?'Vuelve':'Descansa'}</button><button class="btn sm ghost" data-st="${p.id}-out">${p.status==='out'?'Ha vuelto / llega':'Se marcha'}</button><button class="btn sm red" data-pd="${p.id}">Quitar</button></div>`).join('')}
  <form data-f="addlive" class="row"><input name="n" placeholder="Nueva persona" autocomplete="off"><button class="btn sm fix">Añadir</button></form>${nameErrBox()}</div>`}
  <div class="card"><h3>Resultados</h3>${done.length?done.map(m=>`<div class="row" style="margin:6px 0"><span>${S.matches.indexOf(m)+1}. ${m.a.map(nameOf).map(esc).join('/')} <b>${m.status==='done'?m.sa+'-'+m.sb:''}</b> ${m.b.map(nameOf).map(esc).join('/')} ${m.status==='skipped'?'<span class="tag s">no disputado</span>':''}</span><button class="btn sm ghost fix" data-edit="${m.id}">Editar</button></div>`).join(''):'<div class="empty">🏓<br>Todavía no hay partidos resueltos.</div>'}</div>
  <button class="btn ball" data-a="final">Ver resumen final</button>
  <button class="btn ghost" data-a="repeat">Repetir con los mismos jugadores</button>
  <button class="btn red" data-a="reset">Nueva quedada (borra todo)</button>
  <button class="btn ghost" data-a="${S.started?'go':'home'}">Volver</button>`}
function summary(){
  const r=ranking(),dn=S.matches.filter(m=>m.status==='done'),aw=[];let pos=0;
  const rows=r.map((s,i)=>{if(i===0||rk(s)!==rk(r[i-1]))pos=i+1;s.pos=pos;return s});
  const open=FX()&&S.teams.length>2&&!S.matches.some(m=>m.ko===1&&m.status==='done'),top=open?[]:rows.filter(s=>s.pos===1&&s.g>0),names=a=>a.map(s=>s.p.name).join(FX()?' · ':' y ');
  if(dn.length){
    const mx=Math.max(...rows.map(s=>s.pt.size)),mn=Math.min(...rows.map(s=>s.pt.size)),u=rows.filter(s=>s.pt.size===mx);
    if(!FX()&&mx>mn)aw.push([APP_LANG==='en'?'Universal teammate':'Compañero universal',`${names(u)}: ${mx} ${APP_LANG==='en'?'different teammates':'compañeros distintos'}`]);
    const t=dn.reduce((a,b)=>Math.abs(b.sa-b.sb)<Math.abs(a.sa-a.sb)?b:a);
    aw.push([APP_LANG==='en'?'Closest match':'Partido más ajustado',`${t.a.map(nameOf).join('/')} ${t.sa}-${t.sb} ${t.b.map(nameOf).join('/')}`]);}
  return{rows,dn,top,aw,names};
}
const sg=n=>(n>0?'+':'')+n;
function podium(rows){
  const slots=[[2,'silver','🥈'],[1,'gold','🥇'],[3,'bronze','🥉']].map(([p,c,m])=>[p,c,m,rows.filter(s=>s.pos===p&&s.g>0)]).filter(x=>x[3].length);
  if(!slots.length)return'';
  return`<div class="podium" role="group" aria-label="Podio">${slots.map(([p,c,m,l])=>`<div class="pod ${c}"><div class="nm">${l.map(s=>esc(s.p.name)).join('<br>')}</div><div class="rec">${l[0].w}-${l[0].l} · ${sg(l[0].pf-l[0].pa)}</div><div class="blk"><span>${m}</span><b>${p}</b></div></div>`).join('')}</div>`}
function vFinal(){
  const{rows,dn,top,aw,names}=summary(),share=!!(navigator.canShare&&typeof File==='function'&&navigator.canShare({files:[new File([''],'a.jpg',{type:'image/jpeg'})]}));
  return`<h2>Resumen</h2>
  ${top.length?`<div class="card" style="background:var(--ball)"><div class="mut" style="color:var(--ink)">${top.length>1?'Ganadores (empate)':'Ganador/a'}</div><div class="big">🏆 ${esc(names(top))}</div><div>${top[0].w} victorias · diferencia de puntos ${sg(top[0].pf-top[0].pa)}</div></div>`:'<div class="note">⏳ El ganador aparecerá cuando haya resultados.</div>'}
  ${podium(rows)}
  <div class="card"><b>${dn.length}</b> partidos disputados<table><tr><th>#</th><th>${FX()?'Pareja':'Jugador'}</th><th>Victorias</th><th>Derrotas</th><th>Dif.</th><th>${FX()?'PJ':'Compañeros'}</th></tr>${rows.map(s=>`<tr><td>${s.pos}</td><td>${esc(s.p.name)}</td><td>${s.w}</td><td>${s.l}</td><td>${sg(s.pf-s.pa)}</td><td>${FX()?s.g:s.pt.size}</td></tr>`).join('')}</table>
  <div class="note">${FX()?'<b>🏆 Parejas fijas:</b> fase de grupos y eliminatorias. El orden final lo decide la eliminatoria; el resto, por <b>victorias</b> y <b>diferencia de puntos</b>.':'<b>🏆 Cómo se decide:</b> gana quien tiene mayor <b>porcentaje de victorias</b>. Si hay empate, decide la <b>diferencia de puntos</b> (a favor menos en contra). Todos juegan el mismo número de partidos, o uno de diferencia, con parejas distintas.'}</div></div>
  ${FX()&&S.started&&S.teams.length?fxFlow(true):''}
  ${aw.map(a=>`<div class="ok"><b>🏅 ${a[0]}</b><br>${esc(a[1])}</div>`).join('')}
  ${sessionSavePanel()}
  ${dn.length?`<button class="btn ball" data-a="story">Descargar imagen de ranking</button>${share?'<button class="btn ghost" data-a="storyshare">Compartir imagen…</button>':''}`:''}
  ${S.started&&S.matches.length&&!pending().length?'<button class="btn ghost" data-a="repeat">Repetir con los mismos jugadores</button><button class="btn red" data-a="reset">Nueva quedada (borra todo)</button>':''}
  <button class="btn ghost" data-a="${S.started?'go':'home'}">Volver</button>`}

/* ---------- Imagen para Instagram Stories (1080x1920) ---------- */
function storyCanvas(){
  const W=1080,H=1920,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d'),en=APP_LANG==='en';
  const{rows,dn,top,aw,names}=summary(),HF='"Arial Black",Impact,sans-serif',BF='"Trebuchet MS",system-ui,sans-serif',INK='#0e1c33',NAVY='#12325e',LIME='#d4f53c',MUT='#5b6b82';
  const rr=(a,b,w,h,r,f)=>{x.beginPath();x.roundRect?x.roundRect(a,b,w,h,r):x.rect(a,b,w,h);x.fillStyle=f;x.fill()};
  const card=(a,b,w,h,f)=>{rr(a,b+8,w,h,44,'#d5deea');rr(a,b,w,h,44,f)};
  const fit=(t,max,font,size,min)=>{let z=size;do{x.font=font.replace('#',z);if(x.measureText(t).width<=max)return t;z-=2}while(z>=min);
    x.font=font.replace('#',min);while(t.length>1&&x.measureText(t+'…').width>max)t=t.slice(0,-1);return t+'…'};
  x.fillStyle='#eef3f8';x.fillRect(0,0,W,H);
  /* cabecera como la barra superior de la app */
  rr(0,-60,W,440,60,NAVY);
  x.save();x.translate(64,232);x.textBaseline='alphabetic';x.textAlign='left';x.font=`900 92px ${HF}`;x.fillStyle='#fff';x.fillText('PICKLE',0,0);
  /* recuadro de &MIX: se mide la tinta real del texto para centrarlo en el recuadro (misma línea base que PICKLE) */
  const w1=x.measureText('PICKLE').width,tm=x.measureText('&MIX'),asc=tm.actualBoundingBoxAscent,dsc=tm.actualBoundingBoxDescent,
    abl=tm.actualBoundingBoxLeft,abr=tm.actualBoundingBoxRight,bw=abl+abr+48,bh=asc+dsc+44;
  x.save();x.translate(w1+16+bw/2,(dsc-asc)/2);x.rotate(.05);rr(-bw/2,-bh/2,bw,bh,24,LIME);x.fillStyle=INK;x.fillText('&MIX',(abl-abr)/2,(asc-dsc)/2);x.restore();x.restore();
  x.textAlign='left';x.fillStyle='rgba(255,255,255,.85)';x.font=`700 34px ${BF}`;
  x.fillText((en?'FINAL SUMMARY · ':'RESUMEN FINAL · ')+new Date().toLocaleDateString(en?'en-US':'es-ES',{day:'numeric',month:'long',year:'numeric'}).toUpperCase(),64,306);
  let y=420;
  /* ganador */
  if(top.length){
    card(48,y,W-96,236,LIME);x.fillStyle=INK;x.font=`800 30px ${BF}`;x.fillText(top.length>1?(en?'TIED WINNERS':'GANADORES (EMPATE)'):(en?'WINNER':'GANADOR/A'),92,y+54);
    const t=fit(names(top),W-96-44-240,`900 #px ${HF}`,84,40);x.fillText(t,92,y+138);
    x.font=`700 32px ${BF}`;x.fillText(`${top[0].w} ${en?'wins':'victorias'} · ${en?'point difference':'diferencia'} ${sg(top[0].pf-top[0].pa)}`,92,y+194);
    /* copa */
    x.font=`400 120px ${BF}`;x.textAlign='center';x.textBaseline='middle';x.fillText('🏆',W-48-110,y+122);x.textAlign='left';x.textBaseline='alphabetic';
    y+=236+26;}
  /* podio (igual que en la pantalla de Resumen: 2º · 1º · 3º, con empates apilados) */
  const slots=[[2,'#cfd8e3','🥈',130],[1,LIME,'🥇',172],[3,'#f0b88c','🥉',96]].map(([p,f,m,bh])=>({p,f,m,bh,l:rows.filter(s=>s.pos===p&&s.g>0)})).filter(o=>o.l.length);
  if(slots.length){
    const gap=16,k=slots.length,cw=(W-96-gap*(k-1))/k,NL=40,RC=34,ph=Math.max(...slots.map(o=>o.l.length*NL+RC+8+o.bh)),yb=y+ph;
    slots.forEach((o,i)=>{
      const x0=48+i*(cw+gap),mx=x0+cw/2;
      x.fillStyle='#d5deea';x.beginPath();x.roundRect?x.roundRect(x0,yb-o.bh+4,cw,o.bh,[28,28,0,0]):x.rect(x0,yb-o.bh+4,cw,o.bh);x.fill();
      x.fillStyle=o.f;x.beginPath();x.roundRect?x.roundRect(x0,yb-o.bh,cw,o.bh,[28,28,0,0]):x.rect(x0,yb-o.bh,cw,o.bh);x.fill();
      x.textAlign='center';x.textBaseline='alphabetic';x.fillStyle=INK;
      x.font=`400 34px ${BF}`;x.fillText(o.m,mx,yb-o.bh+46);
      x.font=`900 38px ${HF}`;x.fillText(o.p,mx,yb-o.bh+86);
      x.fillStyle=MUT;x.font=`700 24px ${BF}`;x.fillText(`${o.l[0].w}-${o.l[0].l} · ${sg(o.l[0].pf-o.l[0].pa)}`,mx,yb-o.bh-12);
      x.fillStyle=INK;
      o.l.forEach((s,j)=>{const t=fit(s.p.name,cw-16,`900 #px ${HF}`,32,16);x.fillText(t,mx,yb-o.bh-12-RC+4-(o.l.length-1-j)*NL)});
    });
    y+=ph+24;}
  x.textAlign='left';
  if(FX()){
    /* Parejas fijas: en lugar de la tabla, esquema del torneo en vertical (grupos ▼ eliminatorias ▼ campeón). Tamaños base grandes; solo se reducen si no caben. */
    const T=S.teams.length,{G,Q}=fxPlan(T),AV=1800-y-70-30,IW=W-96-40,X0=68,GAP=16,LAB=48,GH=78,GR=54,MB=128,CH=112,CG=22,
      tn=id=>{const t=S.teams.find(q=>q.id===id);return t?t.p.map(nameOf).join(' / ') :(en?'To be decided':'por definir')},
      st=stats(),gl=Array.from({length:G},(_,g)=>st.filter(s=>(S.teams.find(t=>t.id===s.p.id).g||0)===g).sort((a,b)=>rate(b)-rate(a)||dif(b)-dif(a))),
      rounds=[],PL=en?{1:'Final',2:'Semi-finals',4:'Quarter-finals'}:{1:'Final',2:'Semifinales',4:'Cuartos de final'},gcols=G>1?2:1,gic=G===1?2:1,mxg=Math.max(1,...gl.map(l=>l.length)),rg=Math.ceil(mxg/gic),rowsG=Math.ceil(G/gcols);
    for(let n=Q/2;n>=1;n/=2)rounds.push(n);
    const HT=k=>k*(24+LAB+rowsG*(GH+GR*rg+GAP)+rounds.reduce((s,n)=>s+LAB+Math.ceil(n/(n>=2?2:1))*(MB+GAP),0)+(Q?CG+CH:0)+24);
    let k=1;while(k>.4&&HT(k)>AV)k-=.02;
    const th=Math.min(AV,HT(k)),F=(v,m)=>Math.max(m,Math.round(v*k));
    card(48,y,W-96,th,'#fff');
    let cy=y+24*k;
    const lab=(t,ar)=>{x.textAlign='center';x.textBaseline='middle';x.fillStyle=NAVY;x.font=`900 ${F(28,14)}px ${BF}`;x.fillText((ar?'▼  ':'')+t.toUpperCase(),W/2,cy+LAB*k/2);cy+=LAB*k};
    /* grupos */
    lab(G>1?(en?'Group stage':'Fase de grupos'):(en?'Round robin':'Fase de grupos · todos contra todos'));
    const gw=(IW-GAP*(gcols-1))/gcols,gh=(GH+GR*rg)*k,cw0=(gw-40)/gic;
    gl.forEach((l,g)=>{const gx=X0+(g%gcols)*(gw+GAP),gy=cy+Math.floor(g/gcols)*(gh+GAP*k);
      rr(gx,gy,gw,gh,22,'#f3f7fb');x.textAlign='left';x.textBaseline='middle';x.fillStyle=NAVY;x.font=`900 ${F(32,16)}px ${HF}`;x.fillText((en?'GROUP ':'GRUPO ')+String.fromCharCode(65+(g||0)),gx+20,gy+GH*k/2);
      l.forEach((s,i)=>{const cx0=gx+20+(i%gic)*cw0,my=gy+GH*k+Math.floor(i/gic)*GR*k+GR*k/2;x.fillStyle=INK;x.textAlign='left';x.font=`700 ${F(32,15)}px ${BF}`;
        x.fillText(fit(s.p.name.replace(/ y /g,' / '),cw0-24-96*k,`700 #px ${BF}`,F(32,15),12),cx0,my);
        x.textAlign='right';x.font=`900 ${F(32,15)}px ${BF}`;x.fillText(s.w+'-'+s.l,cx0+cw0-(gic>1&&i%2===0?24:0),my)})});
    cy+=rowsG*(gh+GAP*k);
    /* eliminatorias */
    rounds.forEach(n=>{lab(PL[n],1);
      const ms=S.matches.filter(m=>m.ph==='ko'&&m.ko===n),cols=n>=2?2:1,cw=cols===1?Math.min(IW,720):(IW-GAP)/2,bh=MB*k,hh=bh/2;
      for(let i=0;i<n;i++){const m=ms[i],bx=cols===1?(W-cw)/2:X0+(i%2)*(cw+GAP),by=cy+Math.floor(i/cols)*(bh+GAP*k);
        rr(bx,by,cw,bh,20,'#f3f7fb');
        [[m&&m.ta,m&&m.sa,m&&m.sa>m.sb],[m&&m.tb,m&&m.sb,m&&m.sb>m.sa]].forEach(([t,s,w],j)=>{const ly=by+j*hh,done=m&&m.status==='done',win=done&&w;
          if(win)rr(bx+6,ly+(j?3:6),cw-12,hh-9,14,LIME);
          x.textBaseline='middle';x.textAlign='left';x.fillStyle=m?INK:MUT;x.font=`${win?900:700} ${F(32,15)}px ${BF}`;
          x.fillText(fit(m?tn(t):(en?'To be decided':'por definir'),cw-32-70*k,`${win?900:700} #px ${BF}`,F(32,15),12),bx+18,ly+hh/2+(j?1:2));
          if(done){x.textAlign='right';x.font=`900 ${F(36,16)}px ${HF}`;x.fillText(s,bx+cw-20,ly+hh/2+(j?1:2))}});
        x.fillStyle='#cdd8e6';x.fillRect(bx+10,by+hh-1,cw-20,2)}
      cy+=Math.ceil(n/cols)*(bh+GAP*k)});
    /* campeón */
    if(Q){cy+=CG*k;const fm=S.matches.find(m=>m.ph==='ko'&&m.ko===1&&m.status==='done'),nm=fm?tn(fm.sa>fm.sb?fm.ta:fm.tb):null,cw=Math.min(IW,760),ch=CH*k,bx=(W-cw)/2;
      rr(bx,cy,cw,ch,26,nm?LIME:'#f3f7fb');x.textAlign='center';x.textBaseline='middle';x.fillStyle=nm?INK:MUT;
      x.font=`900 ${F(44,18)}px ${HF}`;x.fillText(fit('🏆 '+(nm||(en?'Champion to be decided':'Campeón por definir')),cw-40,`900 #px ${HF}`,F(44,18),12),W/2,cy+ch/2+2)}
    x.textBaseline='alphabetic';x.textAlign='left';
    y+=th+20;
  }else{
  /* tabla: altura de fila adaptada al nº de jugadores */
  const LIM=1740,FOOT=70,n=rows.length;let awH=aw.length?28+aw.length*50+22:0,rh=(LIM-y-awH-FOOT-90-44)/n;
  if(rh<38)rh=(1800-y-awH-FOOT-90-44)/n; /* primero se aprovecha el margen inferior para conservar los premios */
  if(rh<30){awH=0;rh=(LIM-y-FOOT-90-44)/n;if(rh<30)rh=Math.max(26,(1815-y-FOOT-90-44)/n)}rh=Math.min(86,rh);
  const th=90+n*rh+44,fs=Math.max(22,Math.min(38,rh*.56));
  card(48,y,W-96,th,'#fff');
  const cx={p:96,n:170,w:575,l:745,df:855,cp:995};
  x.fillStyle=MUT;x.font=`800 22px ${BF}`;x.textAlign='left';x.fillText('#',cx.p,y+62);x.fillText(FX()?(en?'TEAM':'PAREJA'):(en?'PLAYER':'JUGADOR'),cx.n,y+62);
  x.textAlign='right';x.fillText(en?'WINS':'VICTORIAS',cx.w,y+62);x.fillText(en?'LOSSES':'DERROTAS',cx.l,y+62);x.fillText(en?'DIFF.':'DIF.',cx.df,y+62);x.fillText(FX()?(en?'GP':'PJ'):(en?'TEAMMATES':'COMP.'),cx.cp,y+62);
  rows.forEach((s,i)=>{
    const ry=y+90+i*rh,mid=ry+rh/2;
    x.fillStyle='#e1e8f1';x.fillRect(80,ry,W-160,2);
    if(s.pos===1&&s.g>0)rr(84,ry+4,W-168,rh-6,18,'#f3fcd0');
    x.textBaseline='middle';
    if(s.pos===1&&s.g>0){const d=Math.min(rh-12,56);rr(cx.p+14-d/2,mid-d/2,d,d,d/2,LIME)}
    x.fillStyle=INK;x.textAlign='center';x.font=`900 ${fs}px ${HF}`;x.fillText(s.pos,cx.p+14,mid);x.textAlign='left';
    x.font=`700 ${fs}px ${BF}`;x.fillText(fit(s.p.name,cx.w-cx.n-165,`700 #px ${BF}`,fs,18),cx.n,mid);
    x.textAlign='right';x.font=`800 ${fs}px ${BF}`;x.fillText(s.w,cx.w,mid);x.fillText(s.l,cx.l,mid);x.fillText(sg(s.pf-s.pa),cx.df,mid);x.fillText(FX()?s.g:s.pt.size,cx.cp,mid);
    x.textBaseline='alphabetic'});
  y+=th+20;
  /* premios */
  if(awH){rr(48,y,W-96,awH-6,28,'#e6f9b8');x.textBaseline='middle';x.textAlign='left';x.fillStyle=INK;
    aw.forEach((a,i)=>{const ly=y+14+25+i*50,h=a[0]+' · ';x.font=`800 28px ${BF}`;x.fillText(h,84,ly);const hw=x.measureText(h).width;
      x.font=`700 28px ${BF}`;x.fillText(fit(a[1],W-96-72-hw,`700 #px ${BF}`,28,18),84+hw,ly)});x.textBaseline='alphabetic';y+=awH}
  }
  x.textAlign='center';x.fillStyle=MUT;x.font=`700 30px ${BF}`;x.fillText(`${dn.length} ${en?'matches played':'partidos disputados'} · ${FX()?(en?'fixed teams':'parejas fijas'):(en?'rotating partners':'parejas rotatorias')}`,W/2,Math.min(H-92,y+44));
  x.fillStyle=NAVY;x.font=`800 26px ${BF}`;x.fillText(fit(en?'Play with your friends and climb the leaderboard at pickleandmix.github.io':'Juega con tus amigos y consigue el ranking en pickleandmix.github.io',W-96,`800 #px ${BF}`,26,16),W/2,H-40);
  return c;
}
function storyBlob(){return new Promise(res=>storyCanvas().toBlob(res,'image/jpeg',.92))}
function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('on');setTimeout(()=>e.classList.remove('on'),3200)}

/* ---------- Acciones ---------- */
/* Nombres únicos: se comparan sin distinguir mayúsculas, tildes ni espacios sobrantes (Alicia = alicia = Álicia) */
const normName=s=>String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
const nameTaken=(n,except)=>S.players.some(p=>p.id!==except&&normName(p.name)===normName(n));
function addNames(txt){const names=txt.split(/[\n,;]+/).map(s=>s.trim().slice(0,24).trim()).filter(Boolean),dups=[];let added=0;
  names.forEach(n=>{if(nameTaken(n)){if(!dups.includes(n))dups.push(n);return}S.players.push({id:S.nid++,name:n,status:'active'});added++});return{added,dups}}
function linkedFriends(){if(!AU.user)return[];const ids=new Set(FR.items.filter(f=>f.status==='accepted').map(f=>f.requester_id===AU.user.id?f.addressee_id:f.requester_id));return FR.people.filter(p=>ids.has(p.id))}
function addSelfPlayer(){
  if(!AU.user)return false;
  const uid=AU.user.id,existing=S.players.find(p=>p.userId===uid);
  if(existing){toast('Ya estás en la quedada.');return false}
  const display=String((AU.profile&&AU.profile.display_name)||(AU.user.user_metadata&&(AU.user.user_metadata.full_name||AU.user.user_metadata.name))||(AU.user.email?AU.user.email.split('@')[0]:'Yo')).trim().slice(0,24)||'Yo';
  let player=S.players.find(p=>!p.userId&&normName(p.name)===normName(display));
  if(player)player.userId=uid;
  else{
    const alias=AU.profile&&AU.profile.alias;
    const base=display||('@'+(alias||'yo'));let name=base.slice(0,24),n=2;
    while(nameTaken(name)){const suffix=' '+n++;name=base.slice(0,24-suffix.length)+suffix}
    S.players.push({id:S.nid++,name,userId:uid,status:'active'});
  }
  save();toast('Te has añadido a la quedada.');if(view==='setup')render();return true;
}
const dupMsg=(dups,added)=>(dups.length===1?`«${dups[0]}» ya existe. Usa un nombre distinto, por ejemplo «${dups[0]} A» o una abreviatura.`:`Ya existen: ${dups.map(d=>`«${d}»`).join(', ')}. Usa nombres distintos, por ejemplo añadiendo una inicial.`)+(added?' El resto se ha añadido.':'');
/* Límite de puntos: nadie puede pasar de P, salvo en el desempate por diferencia de 2 (p. ej. a 9: 10-8, 11-9, 12-10…) */
const okState=(a,b,P)=>Math.max(a,b)<=P||Math.abs(a-b)<=2;
function scoreStep(t,c,v,P){
  const o=c==='a'?'b':'a',s=t[c],n=s+v;
  if(n<0)return{ok:false,msg:'La puntuación no puede ser negativa.'};
  if(v>0&&s>=P&&s-t[o]>=2)return{ok:false,msg:`Partido decidido: ya se ha llegado a ${P} con 2 de ventaja.`};
  const a=c==='a'?n:t.a,b=c==='b'?n:t.b;
  if(!okState(a,b,P))return{ok:false,msg:v>0?`Máximo ${P} puntos. Solo se puede pasar de ${P} si hay empate a ${P-1} o más (ganar por 2).`:`Antes de bajar esta puntuación, resta puntos al otro equipo (no puede haber más de 2 de diferencia por encima de ${P}).`};
  return{ok:true,val:n}}
function replan(why){const n=pending().length;rebuild(n);save();msg=why+' Planificación de partidos pendientes actualizada.'}
/* Minijuegos: cada HTML vive en index.html (<script type="text/plain" id="g-...">) y se abre a pantalla completa dentro de un iframe aislado */
const GN={pong:'Pong',kitchen:'Kitchen Rush',dink:'Dink Shot',pairs:'Pickle Pairs'};
function miniGamePlayerName(){
  const p=AU.profile||{},alias=String(p.alias||'').trim();
  return (alias?'@'+alias:String(p.display_name||AU.user?.user_metadata?.full_name||AU.user?.email?.split('@')[0]||'Jugador')).slice(0,40);
}
async function saveMiniGameScore(game,rawScore){
  if(!AU.user||!sbc){toast('Inicia sesión para guardar tu puntuación en el ranking.');return}
  const score=Math.floor(Number(rawScore));
  if(!['pong','kitchen','dink'].includes(game)||!Number.isFinite(score)||score<=0)return;
  try{
    const {error}=await sbc.rpc('submit_minigame_score',{p_game_key:game,p_score:score,p_player_name:miniGamePlayerName()});
    if(error)throw error;
    toast('Resultado comprobado: se conserva tu mejor marca.');
  }catch(error){console.warn('[minigames] score:',error&&error.message);toast('No se ha podido guardar la puntuación. Inténtalo de nuevo.')}
}
function miniGameEscape(value){
  return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
async function showMiniGameLeaderboard(game){
  const ov=$('#ov');if(!ov||!['pong','kitchen','dink'].includes(game))return;
  const previous=ov.querySelector('#miniLb');if(previous)previous.remove();
  const panel=document.createElement('div');panel.id='miniLb';panel.className='mini-lb';
  panel.innerHTML=`<section class="mini-lb-card"><header><div><small>PICKLE &amp; MIX</small><h2>Top 10 · ${GN[game]||'Pong'}</h2></div><button type="button" class="btn sm red" data-lb-close>Cerrar ✕</button></header><p class="mini-lb-note">Mejor puntuación personal de cada jugador. Solo se guardan marcas de cuentas registradas.</p><div class="mini-lb-list">Cargando clasificación…</div></section>`;
  ov.appendChild(panel);
  panel.querySelector('[data-lb-close]').addEventListener('click',()=>panel.remove());
  try{
    if(!sbc)throw new Error('Clasificación no disponible');
    const {data,error}=await sbc.from('minigame_scores').select('player_name,score,updated_at').eq('game_key',game).order('score',{ascending:false}).order('updated_at',{ascending:true}).limit(10);
    if(error)throw error;
    const list=panel.querySelector('.mini-lb-list');
    if(!data||!data.length){list.innerHTML='<p class="mini-lb-empty">Todavía no hay puntuaciones. ¡Sé el primero!</p>';return}
    list.innerHTML=data.map((row,i)=>`<div class="mini-lb-row"><span class="mini-lb-pos">${i+1}</span><b>${miniGameEscape(row.player_name)}</b><strong>${Number(row.score).toLocaleString(APP_LANG==='en'?'en-US':'es-ES')}</strong><time>${row.updated_at?new Date(row.updated_at).toLocaleDateString(APP_LANG==='en'?'en-US':'es-ES'):''}</time></div>`).join('');
  }catch(error){panel.querySelector('.mini-lb-list').innerHTML='<p class="mini-lb-empty">No se ha podido cargar el ranking. Inténtalo de nuevo.</p>';console.warn('[minigames] leaderboard:',error&&error.message)}
}
function openGame(id){if((id==='kitchen'||id==='dink')&&!AU.user){toast('Este minijuego es exclusivo para usuarios registrados. Inicia sesión para jugar.');return}if($('#ov'))return;const src=document.getElementById('g-'+id);if(!src)return;
  const o=document.createElement('div');o.id='ov';o.dataset.game=id;o.className='ov';o.setAttribute('role','dialog');o.setAttribute('aria-modal','true');o.setAttribute('aria-label',GN[id]);
  o.innerHTML=`<div class="ovh"><span>${GN[id]}</span><div class="ov-actions">${id==='pairs'?'':'<button class=\"btn sm\" data-lb>Top 10</button>'}<button class="btn sm red" data-a="closeg">Cerrar ✕</button></div></div><iframe title="${GN[id]}" allow="autoplay"></iframe>`;
  const f=o.querySelector('iframe');
  f.addEventListener('load',()=>{try{const w=f.contentWindow;w.addEventListener('keydown',e=>{if(e.key==='Escape')A.closeg()});if(window.observeTranslationRoot)window.observeTranslationRoot(f.contentDocument.body);if(window.translateDOM)window.translateDOM(f.contentDocument.body);w.focus()}catch(e){}});
  const onMessage=e=>{if(e.source!==f.contentWindow||!e.data||e.data.type!=='pm-minigame-score'||e.data.game!==id)return;saveMiniGameScore(id,e.data.score)};
  window.addEventListener('message',onMessage);o._miniMessageHandler=onMessage;
  const lbButton=o.querySelector('[data-lb]');if(lbButton)lbButton.addEventListener('click',()=>showMiniGameLeaderboard(id));
  let gameSource=src.textContent.split('<\\/script>').join('</script>');if(APP_LANG==='en'&&window.translateTextValue){const bridge='<script>(function(){const tr=window.parent.translateTextValue;const p=CanvasRenderingContext2D.prototype,original=p.fillText;p.fillText=function(value){const args=Array.prototype.slice.call(arguments);args[0]=typeof value===\'string\'?tr(value):value;return original.apply(this,args)}})();<\\/script>';gameSource=gameSource.replace(/<script\\b/i,bridge+'<script')}f.srcdoc=gameSource;
  document.body.appendChild(o);document.body.style.overflow='hidden'}
const A={
  play(){if($('#ov'))return;const o=document.createElement('div');o.id='ov';o.dataset.game='pong';o.className='ov';o.setAttribute('role','dialog');o.setAttribute('aria-modal','true');
    o.innerHTML='<div class="ovh"><span>Pong de PICKLE&amp;MIX</span><div class="ov-actions"><button class="btn sm" data-lb>Top 10</button><button class="btn sm red" data-a="closeg">Cerrar ✕</button></div></div><canvas id="pong2"></canvas><p id="phint2"></p>';
    document.body.appendChild(o);o.querySelector('[data-lb]').addEventListener('click',()=>showMiniGameLeaderboard('pong'));document.body.style.overflow='hidden';initPong('pong2','phint2')},
  closeg(){const o=$('#ov');if(o){if(o._miniMessageHandler)window.removeEventListener('message',o._miniMessageHandler);o.remove()}document.body.style.overflow=''},
  kitchen(){openGame('kitchen')},dink(){openGame('dink')},pairs(){openGame('pairs')},
  /* Cuenta (Supabase · Google) */
  login(){if(!sbc||AU.busy)return;AU.busy=true;AU.err='';
    sbc.auth.signInWithOAuth({provider:'google',options:{redirectTo:auRedirect(),queryParams:{prompt:'select_account'}}})
      .then(r=>{if(r&&r.error)throw r.error})
      .catch(e=>{AU.busy=false;AU.err='No se pudo iniciar sesión con Google. Revisa tu conexión e inténtalo de nuevo.';console.warn('[auth] login:',e&&e.message);paintAuth()})},
  logout(){if(!sbc)return;
    sbc.auth.signOut({scope:'local'}).then(r=>{if(r&&r.error)throw r.error;toast('Sesión cerrada.')})
      .catch(e=>{AU.err='No se pudo cerrar la sesión. Inténtalo de nuevo.';console.warn('[auth] logout:',e&&e.message);paintAuth()})},
  guest(){AU.guest=true;try{localStorage.setItem(GUEST_K,'1')}catch(e){}},
  reloadProfile(){if(AU.user)loadProfile(AU.user.id)},
  setup(){view='setup'},home(){view='home'},profile(){view='profile';AU.profileSettingsOpen=false;loadFriendActivity()},sessions(){view='sessions';HIST.selectedSessionId=null;if(!HIST.loaded)loadMyHistory()},friends(){view='friends';FR.error='';loadFriends()},activity(){view='activity';ACT.error='';render()},party(){view=S.started?'game':'setup';ed=null},clubs(){view='clubs';CL.error='';CL.selectedId=null;loadClubs()},history(){view='history';loadMyHistory()},profileSettings(){view='profile';AU.profileSettingsOpen=true;paintAuth()},profileOverview(){AU.profileSettingsOpen=false;view='profile';paintAuth()},settings(){SETTINGS_TAB='main';view='settings'},settingsHome(){SETTINGS_TAB='main';view='settings'},settingsPrivacy(){SETTINGS_TAB='privacy';view='settings'},settingsNotifications(){SETTINGS_TAB='notifications';view='settings';loadNotificationPreferences()},settingsAccount(){SETTINGS_TAB='account';view='settings'},settingsHelp(){SETTINGS_TAB='help';view='settings';if(AU.user&&!SUPPORT.loaded)loadMySupport()},settingsAbout(){SETTINGS_TAB='about';view='settings'},settingsLanguage(){SETTINGS_TAB='language';view='settings'},achievements(){ACH.open=true;ACH.publicMode=false;paintAuth()},publicAchievements(){ACH.open=true;ACH.publicMode=true;render()},achievementsClose(){ACH.open=false;if(ACH.publicMode)render();else paintAuth()},notificationsToggle(){ACH.notificationsOpen=!ACH.notificationsOpen;paintAuth()},notificationsReadAll(){markNotificationsRead()},go(){view='game';ed=null},more(){view='more'},final(){view='final'},
  start(){S.savedSessionId=null;const c=S.settings;if(S.players.length<4){err='Necesitas al menos 4 jugadores.';return}
    if(S.players.length<4*c.courts){err=`Con ${c.courts} pistas necesitas al menos ${4*c.courts} jugadores.`;return}
    if(FX()&&S.players.length%2){err='Con parejas fijas necesitas un número par de jugadores.';return}
    if(FX()&&c.pairing==='manual'){ensureDraft();if(S.draft.some(r=>!r[0]||!r[1])){err='Completa todas las parejas.';return}}
    S.players.forEach(p=>p.status='active');S.matches=[];
    if(FX()){const ids=S.players.map(p=>p.id);let pr=[];
      if(c.pairing==='manual')pr=S.draft.map(r=>r.slice());
      else{for(let i=ids.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]]}for(let i=0;i<ids.length;i+=2)pr.push([ids[i],ids[i+1]])}
      S.teams=pr.map((p,i)=>({id:i+1,p}));fxBuild()}
    else{const nm=genQ(S.players.map(p=>p.id),c.cycles,c.courts);nm.forEach(m=>m.id=S.nid++);S.matches=nm}
    S.started=true;if(AU.user&&sbc)sbc.from('activity_events').insert({actor_id:AU.user.id,event_type:'match_started',tag:'matches'}).then(({error})=>{if(error)console.warn('[activity] match start:',error.message)});SC={};ed=null;ct=1;view='game'},
  /* Otro ciclo = un partido más para cada jugador activo (los puestos sobrantes, a quien menos ha jugado) */
  extra(){if(FX())return;const ids=active().map(p=>p.id);
    if(ids.length<4){err='Necesitas al menos 4 jugadores activos para añadir otro ciclo.';return}
    const have={};S.matches.filter(m=>m.status!=='skipped').forEach(m=>[...m.a,...m.b].forEach(i=>have[i]=(have[i]||0)+1));
    const nm=genQ(ids,1,S.settings.courts,{have,done:S.matches.filter(m=>m.status==='done')}),
      cyc=Math.max(0,...S.matches.map(m=>m.cycle||0))+1,base=S.matches.length;
    nm.forEach((m,i)=>{m.id=S.nid++;m.cycle=cyc;m.court=(base+i)%S.settings.courts+1});
    S.matches=S.matches.concat(nm);ed=null;view='game'},
  ok(){const m=S.matches.find(x=>x.id===tmp.id),p=S.settings.points,{a,b}=tmp;
    if(a===b||Math.max(a,b)<p){err=`El ganador debe llegar al menos a ${p} puntos y no puede haber empate.`;return}
    if(!okState(a,b,p)){err=`Marcador no válido: no se puede pasar de ${p} puntos salvo para ganar por 2 de diferencia.`;return}
    if(Math.abs(a-b)<2){err='Hay que ganar por diferencia de 2 puntos. Sigue jugando hasta que haya 2 de ventaja.';return}
    m.sa=a;m.sb=b;m.status='done';delete SC[m.id];ed=null;tmp=null;view='game';fxAdvance()},
  skip(){if(!confirm('¿Marcar este partido como no disputado?'))return;const m=S.matches.find(x=>x.id===tmp.id);m.status='skipped';m.sa=m.sb=null;delete SC[m.id];ed=null;tmp=null;fxAdvance()},
  cancel(){if(tmp)delete SC[tmp.id];ed=null;tmp=null},
  story(){storyBlob().then(b=>{if(!b){toast('No se pudo crear la imagen.');return}const u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download='pickle-and-mix-resumen-stories.jpg';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000);toast('Imagen descargada.')})},
  storyshare(){storyBlob().then(b=>{const f=new File([b],'pickle-and-mix-resumen-stories.jpg',{type:'image/jpeg'});navigator.share({files:[f],title:'PICKLE & MIX'}).catch(()=>{})})},
  repeat(){if(!confirm('Se borrarán partidos y resultados, pero se mantienen los jugadores. ¿Continuar?'))return;S.savedSessionId=null;S.matches=[];S.teams=[];S.draft=[];S.started=false;S.nid=1;S.players.forEach(p=>p.status='active');SC={};ed=null;ct=1;tmp=null;view='setup'},
  reset(){if(confirm('Se borrarán jugadores, partidos y resultados. ¿Seguro?')&&confirm('Última comprobación: ¿empezar una quedada nueva?')){S=fresh();SC={};ed=null;ct=1;tmp=null;view='home'}}
};
document.addEventListener('click',e=>{
  // Dejar que el navegador active el input file asociado a los controles de imagen del club.
  if(e.target.closest('label.club-avatar-edit,label.club-image-edit,[data-club-image-file]'))return;
  const t=e.target.closest('[data-a],[data-feed-filter],[data-feed-more],[data-atab],[data-admin],[data-support-open],[data-support-back],[data-support-refresh],[data-support-admin-open],[data-support-admin-back],[data-admin-range],[data-activity-club-item],[data-match-club-toggle],[data-match-club-import],[data-community-panel],[data-fa],[data-up],[data-linkplayer],[data-addself],[data-session-response],[data-session-open],[data-club-section],[data-club-directory],[data-club-directory-back],[data-profile-club-tab],[data-profile-club-more],[data-club-tab],[data-club-post-open],[data-club-post-close],[data-club-event-open],[data-club-event-close],[data-club-open],[data-club-join],[data-club-leave],[data-club-delete],[data-club-create-toggle],[data-club-settings-toggle],[data-club-link-create],[data-club-link-copy],[data-club-copy-current],[data-club-link-revoke],[data-club-invite-revoke],[data-club-request],[data-club-request-cancel],[data-club-invitation],[data-club-member-menu],[data-club-member-action],[data-club-event-toggle],[data-club-post-toggle],[data-club-post-menu],[data-club-post-edit],[data-club-post-edit-cancel],[data-club-post-delete],[data-club-post-comments],[data-club-comment-menu],[data-club-comment-delete],[data-club-event-register],[data-image-editor-action],[data-club-event-cancel],[data-club-event-delete],[data-notification-open],[data-sc],[data-ct],[data-del],[data-st],[data-pd],[data-edit],[data-mode],[data-pm]');if(!e.target.closest('.club-member-item'))document.querySelectorAll('.club-member-item.menu-open').forEach(x=>{x.classList.remove('menu-open');const b=x.querySelector('[data-club-member-menu]'),m=x.querySelector('.club-member-menu-popover');if(b)b.setAttribute('aria-expanded','false');if(m)m.setAttribute('aria-hidden','true')});if(!e.target.closest('.club-comment-admin-actions'))document.querySelectorAll('.club-comment-admin-actions.menu-open').forEach(x=>{x.classList.remove('menu-open');const b=x.querySelector('[data-club-comment-menu]'),m=x.querySelector('.club-comment-menu-popover');if(b)b.setAttribute('aria-expanded','false');if(m)m.setAttribute('aria-hidden','true')});if(!e.target.closest('.club-post-actions'))document.querySelectorAll('.club-post-actions.menu-open').forEach(x=>{x.classList.remove('menu-open');const b=x.querySelector('[data-club-post-menu]'),m=x.querySelector('.club-post-menu-popover');if(b)b.setAttribute('aria-expanded','false');if(m)m.setAttribute('aria-hidden','true')});if(!t)return;const d=t.dataset;if(d.a==='achievementsClose'&&e.target.closest('[data-achievement-modal]')&&!e.target.closest('.achievement-modal-close'))return;
  // Navegación explícita: no depende de las acciones genéricas del resto de la app.
  if(t.hasAttribute('data-image-editor-action')){if(d.imageEditorAction==='apply')applyImageEditor();else closeImageEditor();return}
  if(t.hasAttribute('data-feed-filter')){const next=t.dataset.feedFilter;if(['all','friends','clubs'].includes(next)&&next!==ACT.filter){ACT.filter=next;loadActivity(true)}return}
  if(t.hasAttribute('data-feed-more')){loadActivity(false);return}
  if(d.a==='friends'){view='friends';FR.error='';render();loadFriends();return}
  if(d.a==='profile'){view='profile';AU.profileSettingsOpen=false;render();if(AU.user){loadMyHistory();loadFriends()}return}
  if(d.a==='clubs'){view='clubs';CL.error='';CL.selectedId=null;CL.directoryGroup=null;render();loadClubs();return}
  if(t.hasAttribute('data-profile-club-tab')){PUB.clubTab=d.profileClubTab==='managed'?'managed':'member';PUB.clubsExpanded=false;render();return}
  if(t.hasAttribute('data-profile-club-more')){PUB.clubsExpanded=true;render();return}
  if(t.hasAttribute('data-club-section')){CL.section=d.clubSection==='explore'?'explore':'mine';CL.directoryGroup=null;paintClubs();return}
  if(t.hasAttribute('data-club-directory')){CL.directoryGroup=['official','friends','managed','member'].includes(d.clubDirectory)?d.clubDirectory:'friends';CL.section=['managed','member'].includes(CL.directoryGroup)?'mine':'explore';paintClubs();requestAnimationFrame(()=>window.scrollTo(0,0));return}
  if(t.hasAttribute('data-club-directory-back')){CL.directoryGroup=null;paintClubs();requestAnimationFrame(()=>window.scrollTo(0,0));return}
  if(t.hasAttribute('data-club-tab')){CL.tab=['info','events','posts','members','manage'].includes(d.clubTab)?d.clubTab:'info';CL.openPostId=null;CL.openEventId=null;paintClubs();return}
  if(d.clubPostOpen){if(e.target.closest('button,a,input,textarea,select,form,label')&&!t.matches('[data-club-post-open]'))return;CL.openPostId=d.clubPostOpen;CL.openEventId=null;paintClubs();return}
   if(t.hasAttribute('data-club-post-close')){if(e.target===t||t.classList.contains('club-post-modal-close')){CL.openPostId=null;CL.editingPostId=null;paintClubs()}return}
  if(d.clubEventOpen){CL.openEventId=d.clubEventOpen;paintClubs();return}
  if(t.hasAttribute('data-club-event-close')){if(e.target===t||t.classList.contains('club-event-modal-close')){CL.openEventId=null;paintClubs()}return}
  if(d.a==='admin'){if(!ADMIN.isAdmin)return toast('Sin permisos.');view='admin';render();adminLoad(ADMIN.tab);return}
  if(t.hasAttribute('data-admin-range')){ADMIN.analyticsRange=Number(t.dataset.adminRange)||30;ADMIN.analytics=null;adminLoad('dashboard');return}if(t.hasAttribute('data-atab')){ADMIN.tab=t.dataset.atab;if(ADMIN.tab==='users'){ADMIN.page=1;ADMIN.users=[]}render();adminLoad(ADMIN.tab);return}
  if(t.hasAttribute('data-activity-filter')){ADMIN.activityTag=t.dataset.activityFilter;ADMIN.activity=[];render();adminLoad('activity');return}
  if(t.hasAttribute('data-support-open')){SUPPORT.selected=t.dataset.supportOpen;SUPPORT.replies=[];loadSupportThread(SUPPORT.selected,false);render();return}if(t.hasAttribute('data-support-back')){SUPPORT.selected=null;SUPPORT.replies=[];render();return}if(t.hasAttribute('data-support-refresh')){SUPPORT.loaded=false;loadMySupport();return}if(t.hasAttribute('data-support-admin-open')){SUPPORT.adminSelected=t.dataset.supportAdminOpen;SUPPORT.adminReplies=[];render();loadSupportThread(SUPPORT.adminSelected,true);return}if(t.hasAttribute('data-support-admin-back')){SUPPORT.adminSelected=null;SUPPORT.adminReplies=[];render();return}if(t.hasAttribute('data-admin')){adminAction(t.dataset.admin,t.dataset.id,t.dataset.extra);return}
  if(t.hasAttribute('data-match-club-toggle')){MATCH_CLUBS.open=!MATCH_CLUBS.open;render();if(MATCH_CLUBS.open&&!MATCH_CLUBS.loaded)loadMatchClubs();return}
  if(t.hasAttribute('data-match-club-import')){importMatchClub();return}
  if(t.hasAttribute('data-activity-club-item')){openActivityClubItem(t.dataset.activityClubItem,t.dataset.itemId,t.dataset.clubOpen);return}
  if(d.clubOpen){CL.selectedId=d.clubOpen;view='club-detail';CL.tab='info';CL.openPostId=null;CL.openEventId=null;CL.settingsOpen=false;CL.eventOpen=false;CL.postOpen=false;CL.inviteUrl='';render();loadClubData(d.clubOpen);return}
  if(d.clubJoin){joinClub(d.clubJoin);return}
  if(d.clubLeave){leaveClub(d.clubLeave);return}
  if(d.clubDelete){deleteClub(d.clubDelete);return}
  if(t.hasAttribute('data-club-settings-toggle')){CL.settingsOpen=!CL.settingsOpen;paintClubs();return}
  if(t.hasAttribute('data-club-link-create')){createClubInviteLink();return}
  if(d.clubLinkCopy){const u=location.origin+location.pathname+'?club_invite='+d.clubLinkCopy;if(navigator.clipboard)navigator.clipboard.writeText(u).then(()=>toast('Enlace copiado.')).catch(()=>prompt('Copia este enlace:',u));else prompt('Copia este enlace:',u);return}
  if(t.hasAttribute('data-club-copy-current')){if(CL.inviteUrl&&navigator.clipboard)navigator.clipboard.writeText(CL.inviteUrl).then(()=>toast('Enlace copiado.')).catch(()=>prompt('Copia este enlace:',CL.inviteUrl));else if(CL.inviteUrl)prompt('Copia este enlace:',CL.inviteUrl);return}
  if(d.clubLinkRevoke){revokeClubInviteLink(d.clubLinkRevoke);return}
  if(d.clubInviteRevoke){revokeClubInvitation(d.clubInviteRevoke);return}
  if(d.clubRequest){respondClubRequest(d.id,d.clubRequest==='accept');return}
  if(t.hasAttribute('data-club-request-cancel')){cancelClubJoinRequest();return}
  if(d.clubInvitation){respondClubInvite(d.id,d.clubInvitation==='accept');return}
  if(t.hasAttribute('data-club-member-menu')){const row=t.closest('.club-member-item'),open=!row.classList.contains('menu-open');document.querySelectorAll('.club-member-item.menu-open').forEach(x=>{x.classList.remove('menu-open');const b=x.querySelector('[data-club-member-menu]'),m=x.querySelector('.club-member-menu-popover');if(b)b.setAttribute('aria-expanded','false');if(m)m.setAttribute('aria-hidden','true')});if(open){row.classList.add('menu-open');t.setAttribute('aria-expanded','true');const m=row.querySelector('.club-member-menu-popover');if(m)m.setAttribute('aria-hidden','false')}return}
  if(d.notificationOpen){if(d.notificationOpen==='friend_request_received')openFriendRequestNotification(d.id);else if(d.notificationOpen==='support_reply_received')openSupportReplyNotification(d.id);else openClubNotification(d.notificationOpen,d.id);return}
  if(d.clubMemberAction){const row=t.closest('.club-member-item');if(row){row.classList.remove('menu-open');const b=row.querySelector('[data-club-member-menu]'),m=row.querySelector('.club-member-menu-popover');if(b)b.setAttribute('aria-expanded','false');if(m)m.setAttribute('aria-hidden','true')}manageClubMember(d.id,d.clubMemberAction);return}
  if(t.hasAttribute('data-club-post-toggle')){CL.postOpen=!CL.postOpen;CL.eventOpen=false;paintClubs();return}
  if(t.hasAttribute('data-club-post-menu')){const box=t.closest('.club-post-actions'),open=!box.classList.contains('menu-open');document.querySelectorAll('.club-post-actions.menu-open').forEach(x=>{x.classList.remove('menu-open');const b=x.querySelector('[data-club-post-menu]'),m=x.querySelector('.club-post-menu-popover');if(b)b.setAttribute('aria-expanded','false');if(m)m.setAttribute('aria-hidden','true')});if(open){box.classList.add('menu-open');t.setAttribute('aria-expanded','true');const m=box.querySelector('.club-post-menu-popover');if(m)m.setAttribute('aria-hidden','false')}return}
  if(d.clubPostEdit){CL.editingPostId=d.clubPostEdit;document.querySelectorAll('.club-post-actions.menu-open').forEach(x=>x.classList.remove('menu-open'));paintClubs();return}
  if(t.hasAttribute('data-club-post-edit-cancel')){CL.editingPostId=null;paintClubs();return}
  if(d.clubPostDelete){deleteClubPost(d.clubPostDelete);return}
  if(d.clubPostComments){toggleClubPostComments(d.clubPostComments,d.enabled==='true');return}
  if(t.hasAttribute('data-club-comment-menu')){const box=t.closest('.club-comment-admin-actions'),open=!box.classList.contains('menu-open');document.querySelectorAll('.club-comment-admin-actions.menu-open').forEach(x=>{x.classList.remove('menu-open');const b=x.querySelector('[data-club-comment-menu]'),m=x.querySelector('.club-comment-menu-popover');if(b)b.setAttribute('aria-expanded','false');if(m)m.setAttribute('aria-hidden','true')});if(open){box.classList.add('menu-open');t.setAttribute('aria-expanded','true');const m=box.querySelector('.club-comment-menu-popover');if(m)m.setAttribute('aria-hidden','false')}return}
  if(d.clubCommentDelete){deleteClubComment(d.clubCommentDelete);return}
  if(t.hasAttribute('data-club-event-toggle')){CL.eventOpen=!CL.eventOpen;CL.postOpen=false;paintClubs();return}
  if(d.clubEventRegister){registerClubEvent(d.clubEventRegister);return}
  if(d.clubEventCancel){cancelClubEventRegistration(d.clubEventCancel);return}
  if(d.clubEventDelete){deleteClubEvent(d.clubEventDelete);return}
  if(t.hasAttribute('data-club-create-toggle')){e.preventDefault();CL.createOpen=!CL.createOpen;paintClubs();return}
  if(d.sessionResponse){respondSessionInvitation(d.sessionResponse,d.id);return};if(d.sessionOpen){HIST.selectedSessionId=d.sessionOpen;view='session-detail';render();return}
  if(d.communityPanel){FR.panel=FR.panel===d.communityPanel?'':d.communityPanel;paintFriends();return}
  if(d.fa){friendAction(d.fa,d.id);return}
  if(d.addself!==undefined){addSelfPlayer();return}
  if(d.linkplayer){const friend=linkedFriends().find(p=>p.id===d.linkplayer);if(friend&&!S.players.some(p=>p.userId===friend.id)){let name=(friend.display_name||friend.alias||'Jugador').slice(0,24);if(nameTaken(name))name=('@'+(friend.alias||friend.display_name||'amigo')).slice(0,24);S.players.push({id:S.nid++,name,userId:friend.id,status:'active'});save()}else if(friend)toast('Ese amigo ya está en la quedada.');render();return}
  if(d.up){openUserProfile(d.up);return}
  if(d.a){if(d.a==='logout'&&!confirm('¿Seguro que quieres cerrar sesión en Pickle&Mix?'))return;A[d.a]();}
  else if(d.sc){const c=d.sc[0],v=+d.sc.slice(1),r=scoreStep(tmp,c,v,S.settings.points);if(r.ok)tmp[c]=r.val;else toast(r.msg);$('#app').innerHTML=header()+vGame()+bottomNavigation();translateDOM();return}
  else if(d.ct){ct=+d.ct;ed=null}
  else if(d.mode)S.settings.mode=d.mode;
  else if(d.pm)S.settings.pairing=d.pm;
  else if(d.del)S.players=S.players.filter(p=>p.id!==+d.del);
  else if(d.edit){const m=S.matches.find(x=>x.id===+d.edit);if(m.status==='skipped')m.status='pending';delete SC[m.id];ed=m.id;view='game'}
  else if(d.st){const[i,s]=d.st.split('-'),p=S.players.find(x=>x.id==i);p.status=p.status===s?'active':s;replan(p.name+(p.status==='active'?' vuelve a jugar.':p.status==='rest'?' descansa.':' se marcha.'))}
  else if(d.pd){const p=S.players.find(x=>x.id==d.pd);if(!confirm(`¿Quitar a ${p.name}? Sus partidos jugados se conservan.`))return;p.status='out';p.removed=true;S.players=S.players.filter(x=>x!==p||S.matches.some(m=>m.status==='done'&&[...m.a,...m.b].includes(p.id)));replan('Jugador quitado.')}
  save();render();
});
document.addEventListener('input',e=>{const t=e.target;if(t.matches('[data-admin-search]')){const q=t.value.toLowerCase();document.querySelectorAll('[data-admin-row]').forEach(x=>x.hidden=!x.dataset.adminRow.toLowerCase().includes(q));return}if(t.matches('[data-club-search]')){const q=t.value.trim().toLocaleLowerCase('es');document.querySelectorAll('[data-club-search-text]').forEach(card=>{card.hidden=!card.dataset.clubSearchText.includes(q)});document.querySelectorAll('[data-club-group]').forEach(group=>{group.hidden=!!q&&!group.querySelector('[data-club-search-text]:not([hidden])')});return}if(t.matches('form[data-f="add"] input[name="n"]')){const box=t.closest('form').querySelector('#player-suggestions'),raw=t.value.trim(),isMention=raw.startsWith('@'),q=raw.replace(/^@/,'').toLocaleLowerCase('es');if(!box)return;if(!isMention){box.hidden=true;box.innerHTML='';return}const ownAlias=String((AU.profile&&AU.profile.alias)||'').toLocaleLowerCase('es'),ownName=String((AU.profile&&AU.profile.display_name)||'').toLocaleLowerCase('es'),hasSelf=AU.user&&!S.players.some(x=>x.userId===AU.user.id)&&(q==='yo'||(q&&((ownAlias&&ownAlias.includes(q))||ownName.includes(q))));const self=hasSelf?'<button type="button" class="player-suggestion" data-addself><b>@'+esc(ownAlias||'yo')+'</b><small>'+esc((AU.profile&&AU.profile.display_name)||auName(AU.user))+'</small><span>Este eres tú</span></button>':'';const found=AU.user&&q?linkedFriends().filter(p=>!S.players.some(x=>x.userId===p.id)&&((p.alias||'').toLocaleLowerCase('es').includes(q)||(p.display_name||'').toLocaleLowerCase('es').includes(q))).slice(0,6):[];box.innerHTML=self+found.map(p=>'<button type="button" class="player-suggestion" data-linkplayer="'+p.id+'"><b>@'+esc(p.alias||p.display_name)+'</b><small>'+esc(p.display_name||'')+'</small><span>Vincular</span></button>').join('');box.hidden=!box.innerHTML}});
function updateOfficialClubFields(form){if(!form)return;const select=form.querySelector('[data-club-type]'),box=form.querySelector('[data-club-official-fields]'),city=form.querySelector('[data-club-city]'),on=!!select&&select.value==='official';if(box)box.hidden=!on;if(city)city.required=on;if(box)box.querySelectorAll('input').forEach(input=>{input.required=on&&input.name==='official_address'})}
document.addEventListener('change',e=>{if(e.target.matches('[data-notification-pref]')){if(e.target.dataset.notificationPref==='push_enabled'){setPushEnabled(e.target.checked);return}saveNotificationPreference(e.target.dataset.notificationPref,e.target.checked);return}if(e.target.matches('[data-avatar-file]'))uploadAvatar(e.target);if(e.target.matches('[data-club-image-file]')){const input=e.target,kind=input.dataset.clubImage,file=input.files&&input.files[0];input.value='';if(file)uploadClubImage(file,kind)}if(e.target.matches('[data-club-type]'))updateOfficialClubFields(e.target.form)});
document.addEventListener('submit',e=>{e.preventDefault();if(e.target.dataset.f==='admin-add'){adminAdd(e.target);return}if(e.target.dataset.f==='support-message'){sendSupportMessage(e.target);return}if(e.target.dataset.f==='support-reply-user'){sendSupportReply(e.target,false);return}if(e.target.dataset.f==='support-reply-admin'){sendSupportReply(e.target,true);return}if(e.target.dataset.f==='profile'){saveProfile(e.target);return}if(e.target.dataset.f==='privacy'){savePrivacy(e.target);return}if(e.target.dataset.f==='friend-search'){searchFriends(e.target);return}if(e.target.dataset.f==='save-session'){savePlaySession(e.target);return}if(e.target.dataset.f==='club-create'){createClub(e.target);return}if(e.target.dataset.f==='club-settings'){saveClubSettings(e.target);return}if(e.target.dataset.f==='club-invite'){inviteClubMember(e.target);return}if(e.target.dataset.f==='club-event'){createClubEvent(e.target);return}if(e.target.dataset.f==='club-post'){createClubPost(e.target);return}if(e.target.dataset.f==='club-post-edit'){updateClubPost(e.target);return}if(e.target.dataset.f==='club-comment'){createClubComment(e.target);return}const f=e.target.dataset.f,v=e.target.n&&e.target.n.value;if(!v||!v.trim())return;if(f==='add'&&v.trim().startsWith('@')){const mention=v.trim().slice(1).toLocaleLowerCase('es'),ownAlias=String((AU.profile&&AU.profile.alias)||'').toLocaleLowerCase('es');if(AU.user&&(mention==='yo'||(ownAlias&&mention===ownAlias))){addSelfPlayer();return}toast('Selecciona una sugerencia para vincular a tu amigo.');return}
  const r=addNames(v);if(r.added&&f==='addlive')replan('Jugador añadido.');
  if(r.dups.length)nerr=dupMsg(r.dups,r.added);
  save();render();
  /* los nombres rechazados se quedan en el cuadro para poder corregirlos */
  if(r.dups.length){const i=document.querySelector(`form[data-f="${f}"] input[name="n"]`);if(i){i.value=r.dups.join(', ');i.focus();i.select()}}});
document.addEventListener('change',e=>{const t=e.target;
  if(t.matches('[data-match-club-select]')){MATCH_CLUBS.selected=t.value;const b=document.querySelector('[data-match-club-import]');if(b)b.disabled=!t.value||MATCH_CLUBS.busy;return}
  if(t.dataset.dr){const[i,j]=t.dataset.dr.split('-').map(Number);S.draft[i][j]=+t.value;save();render();return}
  if(t.dataset.ren){const p=S.players.find(x=>x.id==t.dataset.ren),nv=t.value.trim().slice(0,24).trim();
    if(nv&&nameTaken(nv,p.id)){t.value=p.name;toast(`«${nv}» ya existe. Usa un nombre distinto, por ejemplo «${nv} A».`);return}
    if(nv)p.name=nv;save();return}
  if(t.dataset.set){const k=t.dataset.set,v=Math.max(1,Math.min(+t.max,parseInt(t.value)||1));S.settings[k]=v;save();render();return}
});
/* ---------- Cuenta (Supabase · Google OAuth) ----------
   Fase 1: solo identidad (nombre y avatar). No se lee ni se escribe ninguna tabla de Supabase.
   La clave «publishable» está pensada para ir en el navegador; lo que protege los datos son las políticas RLS del proyecto.
   NUNCA pongas aquí la clave secreta de Supabase ni el Client Secret de Google (van solo en el panel de Supabase). */
const SB_URL='https://woolozllrvabjrflmqec.supabase.co',SB_KEY='sb_publishable_A3wn2gZDvhIpIkAdg4riuA_6GpG41oS',GUEST_K='pickleMix.auth.guest';
const AU={user:null,profile:null,profileLoading:false,profileErr:'',profileSettingsOpen:false,ready:false,busy:false,err:'',guest:false,oauth:false};
let sbc=null,friendChannel=null;
function watchFriendships(userId){
  if(friendChannel&&sbc){sbc.removeChannel(friendChannel);friendChannel=null}
  if(!sbc||!userId)return;
  friendChannel=sbc.channel('friendships:'+userId)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'friendships',filter:'addressee_id=eq.'+userId},payload=>{
      if(payload.new&&payload.new.status==='pending'&&payload.new.requester_id!==userId){toast('Tienes una nueva solicitud de amistad.');loadFriends()}
    })
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'friendships',filter:'requester_id=eq.'+userId},payload=>{
      if(payload.new&&payload.new.status==='accepted'){toast('Han aceptado tu solicitud de amistad.');loadFriends()}
    })
    .subscribe(status=>{if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')console.warn('[friends] no se pudo conectar con las notificaciones en tiempo real')});
}
const auRedirect=()=>{const token=new URLSearchParams(location.search).get('club_invite');return location.origin+location.pathname.replace(/index\.html$/,'')+(token?'?club_invite='+encodeURIComponent(token):'')};
const auName=u=>{const p=AU.profile&&u&&AU.profile.id===u.id?AU.profile:null,m=(u&&u.user_metadata)||{};return String((p&&p.display_name)||m.full_name||m.name||(u&&u.email?u.email.split('@')[0]:'')||'Jugador').trim().slice(0,40)||'Jugador'};
const auPic=u=>{const p=AU.profile&&u&&AU.profile.id===u.id?AU.profile:null,m=(u&&u.user_metadata)||{},v=(p&&p.avatar_url)||m.avatar_url||m.picture||'';return/^https:\/\//i.test(v)?v:''};
const auAvatar=u=>{const n=auName(u),i=esc(n.charAt(0).toUpperCase()||'?'),p=auPic(u);
  return p?`<img class="av" src="${esc(p)}" alt="" data-i="${i}" referrerpolicy="no-referrer" width="40" height="40">`:`<span class="av" aria-hidden="true">${i}</span>`};
const GLOGO='<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
const authChipIn=()=>{const unread=(ACH.notifications||[]).filter(n=>!n.read_at).length;return '<div class="header-account-actions">'+(AU.user?'<div class="notification-anchor"><button type="button" class="notification-bell" data-a="notificationsToggle" aria-label="Notificaciones'+(unread?', '+unread+' sin leer':'')+'" aria-expanded="'+(ACH.notificationsOpen?'true':'false')+'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>'+(unread?'<span class="notification-bell-count">'+(unread>9?'9+':unread)+'</span>':'')+'</button>'+(ACH.notificationsOpen?notificationsPanel():'')+'</div>':'')+'<button type="button" class="account-chip" data-a="profile" aria-label="'+(AU.user?'Abrir mi perfil':'Iniciar sesión o crear una cuenta')+'">'+(AU.user?auAvatar(AU.user)+'<span class="nm">'+esc(auName(AU.user).split(/\s+/)[0])+'</span>':'<span class="account-chip-icon" aria-hidden="true">@</span><span class="nm">Entrar</span>')+'<span class="account-chip-chevron" aria-hidden="true">›</span></button></div>';};
function authInner(){
  const e=AU.err?'<div class="err" role="alert">'+esc(AU.err)+'</div>':'';
  if(AU.user){
    if(AU.profileLoading)return '<div class="card acct"><div class="me">'+auAvatar(AU.user)+'<div><span class="tag d">Sesión iniciada</span><b>'+esc(auName(AU.user))+'</b></div></div><p class="hint" role="status">Cargando tu perfil…</p><button class="btn ghost" data-a="logout">'+tr('logout')+'</button></div>';
    if(!AU.profile)return '<div class="card acct"><h3>Tu perfil</h3>'+(AU.profileErr?'<div class="err" role="alert">'+esc(AU.profileErr)+'</div>':'<p class="hint">No se ha podido cargar tu perfil.</p>')+'<button class="btn" data-a="reloadProfile">Reintentar</button><button class="btn ghost" data-a="logout">Cerrar sesión</button></div>';
    const p=AU.profile;
    const avatar='<label class="avatar-picker" for="profile-avatar" title="Cambiar foto de perfil" aria-label="Cambiar foto de perfil">'+auAvatar(AU.user)+'<span class="avatar-camera" aria-hidden="true">✎</span></label><input id="profile-avatar" class="sr" type="file" accept="image/jpeg,image/png,image/webp" data-avatar-file>';
    if(!AU.profileSettingsOpen){
      const friendCount=FR.loaded?FR.items.filter(f=>f.status==='accepted').length:'—';
      return '<div class="profile-dashboard"><section class="card acct profile-hero"><div class="profile-hero-main"><div class="profile-avatar-large">'+avatar+'</div><div class="profile-hero-copy"><span class="tag d">TU PERFIL</span><b>'+esc(auName(AU.user))+'</b><span class="profile-alias">'+(p.alias?'@'+esc(p.alias):'Aún no has elegido un alias')+'</span><span class="profile-location">'+(p.city||p.country?'⌖ '+esc([p.city,p.country].filter(Boolean).join(', ')):'Añade tu ciudad en configuración')+'</span></div><button type="button" class="profile-settings-icon" data-a="settings" aria-label="Abrir ajustes" title="Ajustes"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.25a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5Z"/><path d="m19.4 15 .1.1a1.7 1.7 0 0 1-2.4 2.4l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a1.7 1.7 0 0 1-3.4 0v-.2a1.7 1.7 0 0 0-2.9-1.2l-.1.1a1.7 1.7 0 0 1-2.4-2.4l.1-.1a1.7 1.7 0 0 0-1.2-2.9H4a1.7 1.7 0 0 1 0-3.4h.2a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a1.7 1.7 0 0 1 2.4-2.4l.1.1a1.7 1.7 0 0 0 2.9-1.2V2a1.7 1.7 0 0 1 3.4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a1.7 1.7 0 0 1 2.4 2.4l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a1.7 1.7 0 0 1 0 3.4h-.2a1.7 1.7 0 0 0-1.2 2.9Z"/></svg></button></div><div class="profile-hero-actions"><button type="button" class="profile-friend-count" data-a="friends" aria-label="Ver lista de amigos"><span class="profile-friend-count-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m7-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg></span><span class="profile-friend-count-number">'+friendCount+'</span><span class="profile-friend-count-label">Amigos</span><span class="profile-friend-count-arrow" aria-hidden="true">›</span></button><button class="btn ghost profile-settings-btn" data-a="profileSettings">Editar perfil</button></div>'+'</section>'+achievementPanel(ACH.summary,false)+achievementCatalog(ACH.summary,false)+sessionInvitesPanel()+
        '<section class="profile-stat-block"><h3 class="profile-section-title">Tu rendimiento</h3><div class="profile-metrics"><button type="button" class="card profile-metric profile-metric-click" data-a="sessions" '+(!HIST.loaded?'disabled':'')+'><b>'+(HIST.loaded?HIST.stats.sessions:'—')+'</b><span>Quedadas jugadas</span><small>Ver registro ›</small></button><div class="card profile-metric"><b>'+(HIST.loaded?HIST.stats.wins:'—')+'</b><span>Partidos ganados</span></div><div class="card profile-metric"><b>'+(HIST.loaded?(HIST.stats.played?Math.round(HIST.stats.winRate*100)+'%':'0%'):'—')+'</b><span>% de partidos ganados</span></div></div></section>'+
        '<section class="card profile-empty profile-activity-card"><div class="profile-card-heading"><h3>Tu actividad</h3><span class="section-kicker">RECIENTE</span></div>'+(HIST.loading?'<p>Cargando tu historial…</p>':HIST.error?'<p>'+esc(HIST.error)+'</p>':HIST.items.length?HIST.items.slice(0,3).map(historyRow).join(''):'<p>Todavía no has guardado partidos en tu historial. Al terminar una quedada, podrás guardarla y vincular tu jugador con tu cuenta.</p>')+'</section>'+' <section class="card profile-empty profile-activity-card"><div class="profile-card-heading"><h3>Actividad de tus amigos</h3><span class="section-kicker">COMUNIDAD</span></div>'+(FR.activityLoading?'<p>Cargando actividad…</p>':FR.activity.length?FR.activity.slice(0,3).map(friendActivityRow).join(''):'<p>Cuando tengas amigos y compartan su historial, verás aquí sus últimos partidos.</p>')+'</section>'+
        (HIST.items.length?'<button class="btn ghost" data-a="history">Ver historial completo</button>':'')+e+
        '<button class="btn ghost" data-a="logout">Cerrar sesión</button></div>';
    }
    const opt=(k,v,t)=>'<option value="'+v+'"'+(p[k]===v?' selected':'')+'>'+t+'</option>';
    return '<div class="card acct"><div class="profile-settings-head"><button class="btn sm ghost" type="button" data-a="profileOverview">← '+tr('backProfile')+'</button></div><div class="me">'+avatar+'<div><span class="tag d">'+tr('settings')+'</span><b>'+esc(auName(AU.user))+'</b><span class="mut">Correo de acceso (solo visible para ti): '+esc(AU.user.email||'')+'</span></div></div>'+e+
      '<form data-f="profile" class="profile-form">'+
      '<label for="profile-name">'+tr('publicName')+'</label><input id="profile-name" name="display_name" maxlength="40" minlength="1" required value="'+esc(p.display_name||'')+'" autocomplete="nickname">'+
      '<label for="profile-alias">'+tr('uniqueAlias')+'</label><input id="profile-alias" name="alias" maxlength="21" minlength="3" required value="'+esc(p.alias?'@'+p.alias:'')+'" placeholder="@tu_alias" autocapitalize="none" spellcheck="false">'+
      '<small>'+tr('requiredAlias')+'</small>'+
      '<label for="profile-country">'+tr('country')+'</label><input id="profile-country" name="country" list="profile-country-options" maxlength="80" value="'+esc(p.country||'')+'" placeholder="España" autocomplete="country-name"><datalist id="profile-country-options"><option value="España"><option value="Portugal"><option value="Francia"><option value="Andorra"><option value="Italia"><option value="Reino Unido"><option value="Alemania"><option value="Países Bajos"><option value="Bélgica"><option value="Suiza"><option value="Estados Unidos"><option value="México"><option value="Argentina"><option value="Brasil"><option value="Chile"><option value="Colombia"><option value="Uruguay"><option value="Perú"><option value="Marruecos"></datalist><label for="profile-city">'+tr('city')+'</label><input id="profile-city" name="city" maxlength="80" value="'+esc(p.city||'')+'" placeholder="Málaga" autocomplete="address-level2"><small>'+tr('locationHelp')+'</small>'+
      ''+
      '<button class="btn" type="submit">'+tr('saveProfile')+'</button></form><button class="btn ghost" data-a="logout">Cerrar sesión</button></div>';
  }
  if(!sbc)return AU.guest?'':'<p class="hint">El acceso con Google no está disponible ahora mismo. La app funciona con normalidad sin cuenta.</p>';
  const go=AU.busy?'<button class="btn gg" disabled>Conectando con Google…</button>':'<button class="btn gg" data-a="login">'+GLOGO+'Continuar con Google</button>';
  const guestState=AU.guest?'<span class="guest-mode">Modo invitado · estás jugando sin cuenta</span>':'';
  return '<div class="guest-welcome"><section class="guest-hero"><span class="guest-free">REGISTRO GRATUITO</span><h3>Tu juego. Tus estadísticas. Tu comunidad.</h3><p>Crea tu cuenta gratuita y lleva tu experiencia de pickleball un paso más allá.</p>'+go+'<small>Accede rápidamente con tu cuenta de Google.</small></section>'+guestState+(AU.guest?'<section class="card settings-form settings-language-card guest-language-card"><label for="guest-language">'+(APP_LANG==='en'?'App language':'Idioma de la aplicación')+'</label><select id="guest-language" data-language-select><option value="es"'+(APP_LANG==='es'?' selected':'')+'>Español</option><option value="en"'+(APP_LANG==='en'?' selected':'')+'>English</option></select><small>'+(APP_LANG==='en'?'The change applies immediately.':'El cambio se aplica inmediatamente.')+'</small></section>':'')+'<section class="guest-benefits"><h3>¿Qué consigues al registrarte?</h3><div class="guest-benefit"><span class="guest-icon">01</span><div><b>Tus estadísticas personales</b><small>Partidos, victorias y porcentaje de triunfos.</small></div></div><div class="guest-benefit"><span class="guest-icon">02</span><div><b>Tu historial de partidos</b><small>Guarda tus quedadas y consulta resultados anteriores.</small></div></div><div class="guest-benefit"><span class="guest-icon">03</span><div><b>Amigos y comunidad</b><small>Busca jugadores, envía solicitudes y visita sus perfiles.</small></div></div><div class="guest-benefit"><span class="guest-icon">04</span><div><b>Clasificación entre amigos</b><small>Compara resultados y sigue vuestra evolución.</small></div></div><div class="guest-benefit"><span class="guest-icon">05</span><div><b>Notificaciones sociales</b><small>Recibe avisos de solicitudes y nuevas conexiones.</small></div></div></section><section class="guest-continue"><b>¿Prefieres seguir sin registrarte?</b><p>No hay problema. Puedes seguir utilizando las funciones principales de PICKLE &amp; MIX como invitado, sin crear una cuenta.</p>'+(AU.guest?'':'<button class="btn ghost" data-a="guest">Continuar sin registrarse</button>')+'</section></div>'+e;
}
async function loadProfile(id){
  if(!sbc||!id)return;
  const languageBeforeLoad=APP_LANG;AU.profile=null;AU.profileErr='';AU.profileLoading=true;paintAuth();
  try{const {data,error}=await sbc.from('profiles').select('id,display_name,alias,avatar_url,stats_visibility,history_visibility,location_visibility,preferred_language').eq('id',id).single();
    if(!AU.user||AU.user.id!==id)return;AU.profileLoading=false;
    if(error){AU.profileErr='No se ha podido cargar tu perfil. Comprueba la conexión e inténtalo de nuevo.';console.warn('[profile] load:',error.code,error.message)}else{
      const location=await sbc.rpc('get_profile_location',{p_user_id:id});
      if(location.error)throw location.error;
      AU.profile={...data,...(location.data||{})};AU.profileErr='';
      if(data.preferred_language==='es'||data.preferred_language==='en'){APP_LANG=data.preferred_language;try{localStorage.setItem(LANG_KEY,APP_LANG)}catch(e){}document.documentElement.lang=APP_LANG}
    }
  }catch(error){if(!AU.user||AU.user.id!==id)return;AU.profileLoading=false;AU.profileErr='No se ha podido cargar tu perfil. Comprueba la conexión e inténtalo de nuevo.';console.warn('[profile] load:',error&&error.message)}
  if(APP_LANG!==languageBeforeLoad)render();else paintAuth();if(view==='friends')loadFriends();
}
async function storeAvatarUrl(url){
  if(!sbc||!AU.user||!AU.profile)throw new Error('Inicia sesión para cambiar tu foto.');
  const {data,error}=await sbc.from('profiles').update({avatar_url:url}).eq('id',AU.user.id)
    .select('id,display_name,alias,avatar_url,stats_visibility,history_visibility,location_visibility,preferred_language').single();
  if(error)throw error;AU.profile={...AU.profile,...data};paintAuth();
}
async function uploadAvatar(input){
 const file=input.files&&input.files[0];if(!file)return;input.value='';
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)){toast('Elige una imagen JPG, PNG o WebP.');return}
 if(file.size>2*1024*1024){toast('La imagen no puede superar los 2 MB.');return}
 if(!sbc||!AU.user||!AU.profile){toast('Inicia sesión para cambiar tu foto.');return}
 openImageEditor(file,{kind:'square',title:'Ajustar foto de perfil',onConfirm:async blob=>{
  input.disabled=true;toast('Subiendo tu foto…');
  const id=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),path=AU.user.id+'/'+id+'.jpg';
  try{const {error:uploadError}=await sbc.storage.from('avatars').upload(path,blob,{contentType:'image/jpeg',cacheControl:'3600',upsert:false});if(uploadError)throw uploadError;
   const {data}=sbc.storage.from('avatars').getPublicUrl(path);
   try{await storeAvatarUrl(data.publicUrl)}catch(error){await sbc.storage.from('avatars').remove([path]);throw error}
   toast('Foto de perfil actualizada.');
  }catch(error){console.warn('[avatar] upload:',error&&error.message);toast('No se ha podido actualizar la foto. Comprueba la conexión e inténtalo de nuevo.')}
  finally{input.disabled=false}
 }});
}
async function savePrivacy(form){
 if(!sbc||!AU.user||!AU.profile)return;
 const payload={stats_visibility:form.querySelector('[name="stats_visibility"]').value,history_visibility:form.querySelector('[name="history_visibility"]').value,location_visibility:form.querySelector('[name="location_visibility"]').value};
 const btn=form.querySelector('button[type="submit"]');if(btn){btn.disabled=true;btn.textContent='Guardando…'}
 try{const {data,error}=await sbc.from('profiles').update(payload).eq('id',AU.user.id).select('id,display_name,alias,avatar_url,stats_visibility,history_visibility,location_visibility,preferred_language').single();if(error)throw error;AU.profile={...AU.profile,...data};toast('Preferencias de privacidad guardadas.');render()}
 catch(error){if(btn){btn.disabled=false;btn.textContent='Guardar privacidad'}toast('No se han podido guardar los ajustes de privacidad.');console.warn('[privacy] save:',error&&error.message)}
}
async function saveProfile(form){
  if(!sbc||!AU.user||!AU.profile)return;
  const name=String(form.querySelector('[name="display_name"]').value||'').trim();
  const raw=String(form.querySelector('[name="alias"]').value||'').trim().replace(/^@/,'').toLowerCase();
  if(!name||name.length>40){toast('El nombre público debe tener entre 1 y 40 caracteres.');return}
  if(!raw){toast('El alias es obligatorio. Elige uno para tu cuenta.');return}
  if(!/^[a-z0-9_]{3,20}$/.test(raw)){toast('El alias debe tener entre 3 y 20 caracteres: letras, números o guion bajo.');return}
  const country=String(form.querySelector('[name="country"]').value||'').trim().slice(0,80),city=String(form.querySelector('[name="city"]').value||'').trim().slice(0,80);
  const payload={display_name:name,alias:raw||null,country:country||null,city:city||null};
  const btn=form.querySelector('button[type="submit"]');if(btn){btn.disabled=true;btn.textContent='Guardando…'}
  try{const {data,error}=await sbc.from('profiles').update(payload).eq('id',AU.user.id).select('id,display_name,alias,avatar_url,stats_visibility,history_visibility,location_visibility,preferred_language').single();
    if(error){if(btn){btn.disabled=false;btn.textContent='Guardar perfil'}const message=error.code==='23505'?'Ese alias ya está en uso. Prueba con otro.':error.code==='23514'?'El alias o alguno de los datos no cumple el formato permitido.':'No se ha podido guardar el perfil. Inténtalo de nuevo.';toast(message);console.warn('[profile] save:',error.code,error.message);return}
    AU.profile={...AU.profile,...data,...payload};AU.profileErr='';AU.err='';paintAuth();toast('Perfil guardado.');
  }catch(error){if(btn){btn.disabled=false;btn.textContent='Guardar perfil'}toast('No se ha podido guardar el perfil. Comprueba tu conexión.');console.warn('[profile] save:',error&&error.message)}
}

async function loadMySupport(){if(!AU.user||!sbc||SUPPORT.loading)return;SUPPORT.loading=true;try{const r=await sbc.from('support_messages').select('*').eq('user_id',AU.user.id).order('updated_at',{ascending:false}).limit(100);if(r.error)throw r.error;SUPPORT.tickets=r.data||[];SUPPORT.loaded=true;if(SUPPORT.selected){const t=SUPPORT.tickets.find(x=>x.id===SUPPORT.selected);if(t){const rr=await sbc.from('support_replies').select('*').eq('ticket_id',t.id).order('created_at',{ascending:true});if(rr.error)throw rr.error;SUPPORT.replies=rr.data||[]}else{SUPPORT.selected=null;SUPPORT.replies=[]}}}catch(e){SUPPORT.loaded=true;console.warn('[support] load:',e.message);toast(APP_LANG==='en'?'Could not load your enquiries.':'No se pudieron cargar tus consultas.')}finally{SUPPORT.loading=false;if(view==='settings'&&SETTINGS_TAB==='help')render()}}
async function loadSupportThread(id,admin=false){if(!sbc)return;const flag=admin?'adminLoading':'loading';if(SUPPORT[flag])return;SUPPORT[flag]=true;try{const r=await sbc.from('support_replies').select('*').eq('ticket_id',id).order('created_at',{ascending:true});if(r.error)throw r.error;if(admin)SUPPORT.adminReplies=r.data||[];else SUPPORT.replies=r.data||[]}catch(e){toast(APP_LANG==='en'?'Could not load the conversation.':'No se pudo cargar la conversación.');console.warn('[support] thread:',e.message)}finally{SUPPORT[flag]=false;if(admin&&view==='admin')render();else if(!admin&&view==='settings'&&SETTINGS_TAB==='help')render()}}
async function sendSupportMessage(form){if(!AU.user){toast('Inicia sesión para abrir una consulta.');return}const fd=new FormData(form),category=String(fd.get('category')||''),subject=String(fd.get('subject')||'').trim(),message=String(fd.get('message')||'').trim(),email=String(fd.get('email')||'').trim(),name=String(fd.get('sender_name')||'').trim();if(!sbc)return;const btn=form.querySelector('button[type="submit"]');if(btn){btn.disabled=true;btn.textContent=APP_LANG==='en'?'Sending…':'Enviando…'}try{const {error}=await sbc.from('support_messages').insert({user_id:AU.user.id,sender_name:name||null,sender_email:email||null,category,subject,message});if(error)throw error;form.reset();SUPPORT.loaded=false;SUPPORT.selected=null;await loadMySupport();toast(APP_LANG==='en'?'Your enquiry has been opened.':'Tu consulta se ha abierto correctamente.')}catch(e){console.warn('[support] send:',e.message);toast(APP_LANG==='en'?'Could not send your enquiry.':'No se pudo enviar la consulta.')}finally{if(btn){btn.disabled=false;btn.textContent=APP_LANG==='en'?'Open enquiry':'Enviar consulta'}}}
async function sendSupportReply(form,admin=false){const id=form.dataset.id,fd=new FormData(form),message=String(fd.get('message')||'').trim();if(!AU.user||!id||!message||message.length>5000)return;const btn=form.querySelector('button[type="submit"]');if(btn)btn.disabled=true;try{const {error}=await sbc.from('support_replies').insert({ticket_id:id,sender_user_id:AU.user.id,sender_role:admin?'admin':'user',message});if(error)throw error;form.reset();if(admin){await adminLoad('messages');await loadSupportThread(id,true)}else{SUPPORT.loaded=false;await loadMySupport()}toast(APP_LANG==='en'?'Reply sent.':'Respuesta enviada.')}catch(e){console.warn('[support] reply:',e.message);toast(APP_LANG==='en'?'It is not your turn to reply, or the enquiry is closed.':'No es tu turno para responder o la consulta está cerrada.')}finally{if(btn)btn.disabled=false}}
async function adminCall(action,params={}){const {data,error}=await sbc.functions.invoke('platform-admin',{body:{action,...params}});if(error)throw error;if(data&&data.error)throw new Error(data.error);return data||{}}
async function checkAdminAccess(){ADMIN.isAdmin=false;ADMIN.role='';const uid=AU.user&&AU.user.id;if(!sbc||!uid)return;try{let admin=null;const r=await sbc.from('app_admins').select('role').eq('user_id',uid).maybeSingle();if(r.error)console.warn('[admin] consulta directa:',r.error.message);else admin=r.data||null;if(!admin){const probe=await sbc.functions.invoke('platform-admin',{body:{action:'list_admins'}});if(probe.error)throw probe.error;const found=(probe.data&&probe.data.admins||[]).find(x=>x.user_id===uid);if(found)admin=found}ADMIN.isAdmin=!!admin;ADMIN.role=admin&&admin.role||''}catch(e){console.warn('[admin] no se pudieron verificar los permisos:',e&&e.message)}if(view==='admin'){if(ADMIN.isAdmin){render();adminLoad(ADMIN.tab)}else{view='profile';render()}}else if(view==='home'||view==='profile')render()}
async function adminLoad(tab){if(!ADMIN.isAdmin)return;ADMIN.busy=true;ADMIN.error='';render();try{let officialClubsData=null;if(ADMIN.role==='superadmin'){const [pending,clubs]=await Promise.all([sbc.from('support_messages').select('id',{count:'exact',head:true}).in('status',['pending','awaiting_admin']),adminCall('list_clubs')]);if(pending.error)throw pending.error;ADMIN.pendingMessages=pending.count||0;officialClubsData=clubs;ADMIN.pendingOfficialClubs=(clubs.clubs||[]).filter(c=>c.club_type==='official'&&c.official_status==='pending').length}if(tab==='messages'){if(ADMIN.role!=='superadmin')throw new Error('Solo el superadministrador puede consultar estos mensajes.');const r=await sbc.from('support_messages').select('*').order('updated_at',{ascending:false}).limit(100);if(r.error)throw r.error;ADMIN.messages=r.data||[];if(SUPPORT.adminSelected){const rr=await sbc.from('support_replies').select('*').eq('ticket_id',SUPPORT.adminSelected).order('created_at',{ascending:true});if(rr.error)throw rr.error;SUPPORT.adminReplies=rr.data||[]}}else{const a=tab==='dashboard'?'get_analytics':tab==='users'?'list_users':tab==='clubs'?'list_clubs':tab==='admins'?'list_admins':tab==='activity'?'list_activity':'list_audit',d=tab==='clubs'&&officialClubsData?officialClubsData:await adminCall(a,{page:ADMIN.page,tag:ADMIN.activityTag,days:ADMIN.analyticsRange});if(tab==='dashboard')ADMIN.analytics=d;if(tab==='users'){const incoming=d.users||[];if(ADMIN.page>1){const seen=new Set(ADMIN.users.map(u=>u.id));ADMIN.users=ADMIN.users.concat(incoming.filter(u=>!seen.has(u.id)))}else ADMIN.users=incoming;}if(tab==='clubs')ADMIN.clubs=d.clubs||[];if(tab==='admins')ADMIN.admins=d.admins||[];if(tab==='audit')ADMIN.audit=d.entries||[];if(tab==='activity')ADMIN.activity=d.entries||[]}}catch(e){ADMIN.error=e.message||'Error cargando datos'}finally{ADMIN.busy=false;if(view==='admin')render()}}
const adate=v=>v?new Date(v).toLocaleString(APP_LANG==='en'?'en-US':'es-ES',{dateStyle:'medium',timeStyle:'short'}):'—';
function adminDashboard(){const a=ADMIN.analytics||{},n=a.metrics||{},ds=a.days||[],fmt=v=>Number(v||0).toLocaleString(APP_LANG==='en'?'en-US':'es-ES'),max=Math.max(1,...ds.map(x=>x.events||0));const bars=ds.map(x=>'<div class="admin-chart-col" title="'+esc(x.label+': '+x.events)+'"><i style="height:'+Math.max(3,(x.events||0)/max*100)+'%"></i><small>'+esc(x.short||'')+'</small></div>').join('');const cats=[['Registros','account'],['Accesos','access'],['Perfiles','profile'],['Partidos','matches'],['Clubes','clubs']].map(([label,key])=>{const v=(a.categories||{})[key]||0,p=n.eventsInRange?Math.round(v/n.eventsInRange*100):0;return '<div class="admin-category"><div><span>'+label+'</span><b>'+fmt(v)+'</b></div><i><span style="width:'+p+'%"></span></i></div>'}).join('');const recent=(a.recent||[]).map(x=>'<article class="admin-row"><div><b>'+esc(x.label||x.event_type)+'</b><small>'+esc(x.name||'Usuario')+(x.alias?' · @'+esc(x.alias):'')+' · '+adate(x.created_at)+'</small></div><span class="tag">'+esc(x.tag||'')+'</span></article>').join('');const attention=ADMIN.role==='superadmin'?([ADMIN.pendingMessages>0?'<section class="admin-attention-panel"><div class="admin-attention-icon">!</div><div class="admin-attention-copy"><b>'+ADMIN.pendingMessages+' '+(ADMIN.pendingMessages===1?'mensaje pendiente':'mensajes pendientes')+'</b><span>'+(APP_LANG==='en'?'User messages waiting for your review':'Hay mensajes de usuarios que esperan tu revisión')+'</span></div><button class="btn sm" data-atab="messages">'+(APP_LANG==='en'?'Review':'Revisar')+'</button></section>':'',ADMIN.pendingOfficialClubs>0?'<section class="admin-attention-panel"><div class="admin-attention-icon">!</div><div class="admin-attention-copy"><b>'+ADMIN.pendingOfficialClubs+' '+(ADMIN.pendingOfficialClubs===1?'solicitud de Club Oficial pendiente':'solicitudes de Club Oficial pendientes')+'</b><span>'+(APP_LANG==='en'?'Official clubs waiting for verification':'Hay clubes que han solicitado la verificación oficial')+'</span></div><button class="btn sm" data-atab="clubs">'+(APP_LANG==='en'?'Review':'Revisar')+'</button></section>':''].join('')):'';return '<div class="admin-dashboard-head"><div><span class="section-kicker">RESUMEN GENERAL</span><h3>Centro de control</h3><p>Estado y evolución de Pickle&Mix</p></div><button class="btn ghost sm" data-admin="dashboard-refresh">Actualizar</button></div>'+attention+'<div class="admin-range">'+[[7,'7 días'],[30,'30 días'],[90,'90 días']].map(([v,l])=>'<button class="'+(ADMIN.analyticsRange===v?'active':'')+'" data-admin-range="'+v+'">'+l+'</button>').join('')+'</div><div class="admin-kpi-grid"><article class="admin-kpi"><small>Usuarios registrados</small><b>'+fmt(n.users)+'</b><span>Total de perfiles</span></article><article class="admin-kpi"><small>Usuarios activos</small><b>'+fmt(n.activeUsers)+'</b><span>En '+ADMIN.analyticsRange+' días</span></article><article class="admin-kpi"><small>Nuevos registros</small><b>'+fmt(n.newUsers)+'</b><span>En el periodo</span></article><article class="admin-kpi"><small>Partidas iniciadas</small><b>'+fmt(n.matchesStarted)+'</b><span>En el periodo</span></article><article class="admin-kpi"><small>Quedadas guardadas</small><b>'+fmt(n.sessions)+'</b><span>Total histórico</span></article><article class="admin-kpi"><small>Clubes</small><b>'+fmt(n.clubs)+'</b><span>'+fmt(n.newClubs)+' nuevos en el periodo</span></article></div><div class="admin-dashboard-grid"><section class="admin-dash-panel"><div class="admin-dash-title"><div><h4>Actividad diaria</h4><small>Últimos '+ADMIN.analyticsRange+' días</small></div><b>'+fmt(n.eventsInRange)+'</b></div><div class="admin-chart">'+(ds.some(x=>x.events)?bars:'<p class="admin-empty">Sin actividad registrada todavía.</p>')+'</div></section><section class="admin-dash-panel"><div class="admin-dash-title"><div><h4>Actividad por categoría</h4><small>En el periodo seleccionado</small></div></div>'+cats+'</section></div><section class="admin-dash-panel admin-recent"><div class="admin-dash-title"><div><h4>Últimos movimientos</h4><small>Actividad reciente de los usuarios</small></div><button class="btn ghost sm" data-atab="activity">Ver toda</button></div>'+(recent||'<p class="admin-empty">Aún no hay movimientos registrados.</p>')+'</section>'}
function vAdmin(){
  if(!ADMIN.isAdmin)return '<section class="card"><h2>Administración</h2><p>Acceso restringido.</p></section>';
  const tabs=[
    {id:'dashboard',title:'Centro de control',group:'Resumen',desc:'Indicadores generales y evolución de la plataforma.'},
    {id:'users',title:'Usuarios',group:'Comunidad',desc:'Consulta cuentas, busca perfiles y gestiona incidencias de acceso.'},
    {id:'clubs',title:'Clubes',group:'Comunidad',desc:'Revisa los clubes creados y administra su información y verificación.'},
    {id:'activity',title:'Actividad',group:'Comunidad',desc:'Consulta cronológicamente la actividad de los usuarios.'},
    {id:'admins',title:'Administradores',group:'Control',desc:'Gestiona quién tiene permisos de administración en Pickle&Mix.'},
    ...(ADMIN.role==='superadmin'?[{id:'messages',title:'Mensajes de usuarios',group:'Control',desc:'Consulta y gestiona las consultas, sugerencias e incidencias recibidas.'}]:[]),
    {id:'audit',title:'Registro administrativo',group:'Control',desc:'Consulta las acciones realizadas desde las herramientas de administración.'}
  ];
  const current=tabs.find(x=>x.id===ADMIN.tab)||tabs[0];
  const navGroup=(name)=>'<div class="admin-nav-group"><span>'+name+'</span><div class="admin-nav-items">'+tabs.filter(x=>x.group===name&&(x.id!=='messages'||ADMIN.role==='superadmin')).map(x=>'<button type="button" class="admin-nav-btn" data-atab="'+x.id+'"'+(ADMIN.tab===x.id?' aria-current="page"':'')+'><span>'+x.title+'</span>'+(x.id==='messages'&&ADMIN.pendingMessages>0?'<b class="admin-nav-badge">'+(ADMIN.pendingMessages>99?'99+':ADMIN.pendingMessages)+'</b>':x.id==='clubs'&&ADMIN.role==='superadmin'&&ADMIN.pendingOfficialClubs>0?'<b class="admin-nav-badge">'+(ADMIN.pendingOfficialClubs>99?'99+':ADMIN.pendingOfficialClubs)+'</b>':'')+(ADMIN.tab===x.id?'<i aria-hidden="true"></i>':'')+'</button>').join('')+'</div></div>';
  const heading=(eyebrow,title,desc,action='')=>'<div class="admin-section-head"><div><span class="admin-eyebrow">'+eyebrow+'</span><h3>'+title+'</h3><p>'+desc+'</p></div>'+action+'</div>';
  const refresh=(action)=>'<button type="button" class="btn ghost sm" data-admin="'+action+'">Actualizar</button>';
  let content='';
  if(ADMIN.tab==='dashboard'){
    content=adminDashboard();
  }else if(ADMIN.tab==='users'){
    const rows=ADMIN.users.map(u=>{
      const p=u.profile||{},b=u.banned_until&&new Date(u.banned_until)>new Date(),label=[p.display_name,p.alias,u.email].join(' ');
      const actions=u.admin_role?'<span class="admin-role-chip">Administrador</span>':'<button type="button" class="btn sm ghost" data-admin="'+(b?'reactivate_user':'suspend_user')+'" data-id="'+u.id+'">'+(b?'Reactivar':'Suspender')+'</button><button type="button" class="btn sm danger" data-admin="delete_user" data-id="'+u.id+'">Eliminar</button>';
      return '<article class="admin-row" data-admin-row="'+esc(label)+'"><div class="admin-row-main"><span class="admin-user-avatar">'+esc((p.display_name||u.email||'U').charAt(0).toUpperCase())+'</span><div><b>'+esc(p.display_name||u.email||'Usuario')+'</b><small>'+(p.alias?'@'+esc(p.alias)+' · ':'')+esc(u.email||'')+'</small><small>Registro: '+adate(u.created_at)+'</small></div></div><div class="admin-row-actions">'+actions+'</div></article>';
    }).join('');
    content=heading('COMUNIDAD','Usuarios','Gestiona las cuentas registradas y sus permisos.',refresh('users-refresh'))+
      '<div class="admin-list-toolbar"><label class="admin-search-wrap"><span>Buscar usuario</span><input class="admin-search" data-admin-search type="search" placeholder="Nombre, alias o email" autocomplete="off"></label><span class="admin-result-count">'+ADMIN.users.length+' cargados</span></div>'+
      (rows||'<div class="admin-empty-state"><b>No hay usuarios que mostrar</b><span>Cuando se registren usuarios aparecerán aquí.</span></div>')+
      '<div class="admin-footer"><button type="button" class="btn ghost sm" data-admin="users-next">Cargar más usuarios</button></div>';
  }else if(ADMIN.tab==='clubs'){
    const rows=ADMIN.clubs.map(x=>{
      const verified=x.club_type==='official'&&x.official_status==='verified';
      const kind=x.club_type==='official'?'Club oficial':'Club de amigos';
      return '<article class="admin-row" data-admin-row="'+esc((x.name||'')+' '+(x.city||''))+'"><div class="admin-row-main"><span class="admin-club-icon" aria-hidden="true">⌂</span><div><b>'+esc(x.name||'Club sin nombre')+'</b><small>'+esc(x.city||'Sin localización')+' · '+Number(x.member_count||0)+' miembros</small><div class="admin-inline-tags"><span class="admin-meta-chip">'+kind+'</span>'+(x.club_type==='official'?'<span class="admin-meta-chip '+(verified?'is-verified':'')+'">'+(verified?'Verificado':'Sin verificar')+'</span>':'')+'</div></div></div><div class="admin-row-actions"><button type="button" class="btn sm ghost" data-admin="club-rename" data-id="'+x.id+'">Renombrar</button>'+(x.club_type==='official'?'<button type="button" class="btn sm ghost" data-admin="club-verify" data-id="'+x.id+'" data-extra="'+(verified?'pending':'verified')+'">'+(verified?'Retirar verificación':'Verificar')+'</button>':'')+'<button type="button" class="btn sm danger" data-admin="delete_club" data-id="'+x.id+'">Eliminar</button></div></article>';
    }).join('');
    content=heading('COMUNIDAD','Clubes',ADMIN.role==='superadmin'&&ADMIN.pendingOfficialClubs>0?ADMIN.pendingOfficialClubs+' solicitudes de Club Oficial pendientes de revisar. Supervisa los clubes y gestiona su verificación.':'Supervisa los clubes de la plataforma y sus datos.',refresh('clubs-refresh'))+
      '<div class="admin-list-toolbar"><label class="admin-search-wrap"><span>Buscar club</span><input class="admin-search" data-admin-search type="search" placeholder="Nombre o ciudad" autocomplete="off"></label><span class="admin-result-count">'+ADMIN.clubs.length+' clubes</span></div>'+
      (rows||'<div class="admin-empty-state"><b>No hay clubes que mostrar</b><span>Los clubes creados aparecerán en este listado.</span></div>');
  }else if(ADMIN.tab==='admins'){
    const form='<form data-f="admin-add" class="admin-add-form"><label><span>Alias del usuario</span><input name="alias" placeholder="@alias" autocomplete="off" required></label><label><span>Permiso que quieres conceder</span><select name="role"><option value="admin">Administrador</option><option value="superadmin">Superadministrador</option></select></label><button class="btn" type="submit">Conceder permisos</button></form>';
    const rows=ADMIN.admins.map(x=>'<article class="admin-row"><div class="admin-row-main"><span class="admin-user-avatar">'+esc((x.profile?.display_name||x.profile?.alias||'U').charAt(0).toUpperCase())+'</span><div><b>'+esc(x.profile?.display_name||'Usuario')+'</b><small>'+(x.profile?.alias?'@'+esc(x.profile.alias):'Sin alias')+'</small></div></div><div class="admin-row-actions"><span class="admin-role-chip '+(x.role==='superadmin'?'is-super':'')+'">'+(x.role==='superadmin'?'Superadministrador':'Administrador')+'</span>'+(x.is_me?'<span class="admin-you-chip">Tu cuenta</span>':'<button type="button" class="btn sm danger" data-admin="remove_admin" data-id="'+x.user_id+'">Retirar permisos</button>')+'</div></article>').join('');
    content=heading('CONTROL DE ACCESO','Administradores','Añade o retira permisos. Reserva el rol de superadministrador para cuentas de máxima confianza.',refresh('admins-refresh'))+
      '<section class="admin-subpanel"><h4>Añadir administrador</h4><p>Busca a la persona por su alias de Pickle&Mix. Debe tener una cuenta creada.</p>'+form+'</section>'+
      '<div class="admin-list-heading"><h4>Permisos actuales</h4><span>'+ADMIN.admins.length+' cuentas</span></div>'+
      (rows||'<div class="admin-empty-state"><b>No hay administradores registrados</b></div>');
  }else if(ADMIN.tab==='messages'){
    const labels={problem:'Problema o error',suggestion:'Sugerencia',question:'Consulta',other:'Otro'},states={pending:'Pendiente',reviewing:'En revisión',awaiting_user:'Esperando al usuario',awaiting_admin:'Requiere respuesta',resolved:'Resuelta'};
    const selected=ADMIN.messages.find(x=>x.id===SUPPORT.adminSelected);
    if(selected){
      const bubbles='<article class="support-chat-bubble from-user"><small>'+esc(selected.sender_name||'Usuario')+' · Mensaje inicial · '+adate(selected.created_at)+'</small><p>'+esc(selected.message)+'</p></article>'+SUPPORT.adminReplies.map(x=>'<article class="support-chat-bubble '+(x.sender_role==='admin'?'from-admin':'from-user')+'"><small>'+(x.sender_role==='admin'?'Soporte Pickle&Mix':esc(selected.sender_name||'Usuario'))+' · '+adate(x.created_at)+'</small><p>'+esc(x.message)+'</p></article>').join('');
      const form=selected.status==='pending'||selected.status==='reviewing'||selected.status==='awaiting_admin'?'<form class="card settings-form support-reply-form" data-f="support-reply-admin" data-id="'+selected.id+'"><label>Tu respuesta</label><textarea name="message" rows="4" maxlength="5000" required placeholder="Escribe una respuesta…"></textarea><button class="btn" type="submit">Enviar respuesta</button></form>':selected.status==='resolved'?'<p class="support-locked-note">Consulta resuelta y bloqueada. El historial permanece disponible.</p>':'<p class="support-locked-note">Has respondido. Ahora el usuario tiene el turno para contestar.</p>';
      content=heading('SOPORTE','Conversación · '+esc(selected.subject),'Consulta de '+esc(selected.sender_name||'Usuario')+' · '+adate(selected.created_at),'<button class="btn ghost sm" type="button" data-support-admin-back>Volver a consultas</button>')+'<div class="support-admin-meta">'+(selected.sender_email?'<a href="mailto:'+esc(selected.sender_email)+'">'+esc(selected.sender_email)+'</a>':'Sin email de contacto')+'</div><div class="support-chat-thread">'+bubbles+'</div>'+form+(selected.status!=='resolved'?'<div class="support-admin-actions"><button class="btn danger sm" type="button" data-admin="resolve-support" data-id="'+selected.id+'">Marcar como resuelta</button></div>':'');
    }else{
      const rows=ADMIN.messages.map(x=>'<button type="button" class="support-admin-message support-admin-open" data-support-admin-open="'+x.id+'"><div class="support-admin-top"><div><span class="admin-meta-chip">'+esc(labels[x.category]||x.category)+'</span><span class="support-admin-status status-'+esc(x.status)+'">'+esc(states[x.status]||x.status)+'</span></div><time>'+adate(x.updated_at||x.created_at)+'</time></div><h4>'+esc(x.subject)+'</h4><p class="support-admin-body">'+esc(x.message)+'</p><div class="support-admin-meta"><span>'+(x.sender_name?esc(x.sender_name):'Usuario registrado')+'</span>'+(x.sender_email?'<span>'+esc(x.sender_email)+'</span>':'')+'</div><small class="support-open-hint">Abrir conversación →</small></button>').join('');
      content=heading('SOPORTE','Consultas de usuarios',ADMIN.pendingMessages+' consultas requieren tu atención · Se muestran las últimas 100.',refresh('messages-refresh'))+(rows||'<div class="admin-empty-state"><b>No hay consultas todavía</b><span>Las consultas de usuarios registrados aparecerán aquí.</span></div>');
    }
  }else if(ADMIN.tab==='activity'){
    const tags=[['all','Todas'],['account','Registros'],['access','Accesos'],['profile','Perfiles'],['matches','Partidos'],['clubs','Clubes']];
    const labels={user_registered:'Nuevo registro',user_signed_in:'Inicio de sesión',profile_created:'Perfil creado',profile_updated:'Perfil actualizado',match_started:'Ha iniciado una partida',session_saved:'Ha guardado una quedada',club_created:'Ha creado un club',club_joined:'Se ha unido a un club'};
    const rows=ADMIN.activity.map(x=>{
      const p=x.profile||{},d=x.details||{},who=p.display_name||'Usuario',alias=p.alias?' · @'+p.alias:'',detail=d.club_name||d.title||(d.club_type==='official'?'Club oficial':d.club_type==='friends'?'Club de amigos':'');
      return '<article class="admin-row"><div class="admin-row-main"><span class="admin-activity-mark" aria-hidden="true">•</span><div><b>'+esc(labels[x.event_type]||x.event_type)+'</b><small>'+esc(who+alias)+(detail?' · '+esc(detail):'')+'</small><small>'+adate(x.created_at)+'</small></div></div><span class="admin-meta-chip">'+esc(({account:'Registro',access:'Acceso',profile:'Perfil',matches:'Partidos',clubs:'Clubes'})[x.tag]||x.tag)+'</span></article>';
    }).join('');
    content=heading('COMUNIDAD','Actividad de usuarios','Historial cronológico de los últimos 200 eventos.',refresh('activity-refresh'))+
      '<div class="admin-activity-filters">'+tags.map(([k,v])=>'<button type="button" class="admin-filter-btn '+(ADMIN.activityTag===k?'is-active':'')+'" data-activity-filter="'+k+'" aria-pressed="'+(ADMIN.activityTag===k?'true':'false')+'">'+v+'</button>').join('')+'</div>'+
      (rows||'<div class="admin-empty-state"><b>No hay actividad para este filtro</b><span>Prueba otra categoría o vuelve más tarde.</span></div>');
  }else{
    const rows=ADMIN.audit.map(x=>'<article class="admin-row"><div class="admin-row-main"><span class="admin-activity-mark" aria-hidden="true">•</span><div><b>'+esc(x.action||'Acción administrativa')+'</b><small>'+esc(x.target_type||'')+(x.target_id?' · '+esc(x.target_id):'')+'</small><small>'+adate(x.created_at)+'</small></div></div></article>').join('');
    content=heading('CONTROL DE ACCESO','Registro administrativo','Historial de las acciones realizadas desde el panel.',refresh('audit-refresh'))+
      (rows||'<div class="admin-empty-state"><b>Aún no hay acciones registradas</b><span>Las operaciones administrativas aparecerán aquí.</span></div>');
  }
  return '<div class="admin-page"><section class="admin-hero"><div><span class="section-kicker">PICKLE&MIX · CONTROL DE PLATAFORMA</span><h2>Administración</h2><p>Gestiona la comunidad, supervisa la actividad y controla los accesos desde un único lugar.</p></div><span class="admin-role-label">'+(ADMIN.role==='superadmin'?'Superadministrador':'Administrador')+'</span></section><nav class="admin-nav" aria-label="Secciones de administración">'+navGroup('Resumen')+navGroup('Comunidad')+navGroup('Control')+'</nav><section class="card admin-content">'+(ADMIN.busy?'<div class="admin-loading"><span></span><b>Cargando información…</b></div>':ADMIN.error?'<div class="admin-error"><b>No se ha podido cargar esta sección</b><span>'+esc(ADMIN.error)+'</span><button type="button" class="btn ghost sm" data-admin="'+(ADMIN.tab||'dashboard')+'-refresh">Reintentar</button></div>':'<div class="admin-current-section"><div class="admin-current-title"><span>'+current.group+'</span><b>'+current.title+'</b><small>'+current.desc+'</small></div></div>'+content)+'</section></div>';
}
async function adminAction(a,id,extra){if(a==='dashboard-refresh'||a==='users-refresh'||a==='clubs-refresh'||a==='admins-refresh'||a==='audit-refresh'||a==='activity-refresh'||a==='messages-refresh'){if(a==='dashboard-refresh')ADMIN.analytics=null;if(a==='users-refresh'){ADMIN.users=[];ADMIN.page=1;}if(a==='clubs-refresh')ADMIN.clubs=[];if(a==='admins-refresh')ADMIN.admins=[];if(a==='audit-refresh')ADMIN.audit=[];if(a==='activity-refresh')ADMIN.activity=[];if(a==='messages-refresh')ADMIN.messages=[];return adminLoad(a.replace('-refresh',''))}if(a==='users-next'){ADMIN.page++;return adminLoad('users')}try{if(a==='resolve-support'){if(ADMIN.role!=='superadmin')throw new Error('Sin permisos.');const {error}=await sbc.from('support_messages').update({status:'resolved',updated_at:new Date().toISOString()}).eq('id',id);if(error)throw error;await adminLoad('messages');return}if(['suspend_user','reactivate_user','delete_user'].includes(a)){if(!confirm(a==='delete_user'?'Eliminar definitivamente esta cuenta?':a==='suspend_user'?'Suspender esta cuenta?':'Reactivar esta cuenta?'))return;await adminCall(a,{user_id:id});await adminLoad('users');return}if(a==='club-rename'){const x=ADMIN.clubs.find(c=>c.id===id),name=prompt('Nuevo nombre del club',x?.name||'');if(name===null)return;await adminCall('update_club',{club_id:id,name});await adminLoad('clubs');return}if(a==='club-verify'){const x=ADMIN.clubs.find(c=>c.id===id);await adminCall('update_club',{club_id:id,name:x.name,official_status:extra});await adminLoad('clubs');return}if(a==='delete_club'){if(!confirm('Eliminar este club definitivamente?'))return;await adminCall('delete_club',{club_id:id});await adminLoad('clubs');return}if(a==='remove_admin'){if(!confirm('Retirar permisos administrativos?'))return;await adminCall('remove_admin',{user_id:id});await adminLoad('admins')}}catch(e){toast(e.message||'No se pudo completar la acción')}}
async function adminAdd(form){const fd=new FormData(form),alias=String(fd.get('alias')||'').trim().replace(/^@/,'').toLowerCase(),role=fd.get('role');try{const {data,error}=await sbc.from('profiles').select('id').eq('alias',alias).maybeSingle();if(error)throw error;if(!data)throw new Error('No existe ese alias');if(!confirm('¿Conceder permisos a @'+alias+'?'))return;await adminCall('add_admin',{user_id:data.id,role});await adminLoad('admins')}catch(e){toast(e.message||'No se pudo asignar el rol')}}

function paintAuth(){if(view==='activity'||view==='profile'||view==='settings'){render();return}const b=$('#authbox'),c=$('#authchip');if(b)b.innerHTML=authInner();if(c)c.innerHTML=authChipIn();translateDOM()}
if(typeof window!=='undefined'&&typeof document!=='undefined'){
  try{AU.guest=localStorage.getItem(GUEST_K)==='1'}catch(e){}
  AU.oauth=/[?&#]code=|access_token=/.test(location.search+location.hash);
  /* Errores devueltos por Google/Supabase en la URL: mensaje genérico (el texto de la URL no se muestra) y URL limpia */
  try{const q=new URLSearchParams(location.search),h=new URLSearchParams(location.hash.replace(/^#/,''));
    if((q.get('error')||h.get('error')||q.get('error_code')||h.get('error_code'))&&(q.get('error_description')||h.get('error_description'))){
      console.warn('[auth] error de OAuth:',q.get('error_description')||h.get('error_description'));AU.err='No se pudo completar el acceso con Google. Inténtalo de nuevo.';history.replaceState(null,'',location.pathname)}}catch(e){}
  try{if(window.supabase&&typeof window.supabase.createClient==='function')
    sbc=window.supabase.createClient(SB_URL,SB_KEY,{auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}})}
  catch(e){sbc=null;console.warn('[auth] no se pudo iniciar Supabase:',e&&e.message)}
  if(sbc){try{
    /* Solo se repinta la tarjeta y la cabecera (no toda la app) y solo si cambia la persona: así un refresco de token no interrumpe lo que se esté escribiendo */
    sbc.auth.onAuthStateChange((ev,ses)=>{const u=(ses&&ses.user)||null,was=AU.user&&AU.user.id,ch=(u&&u.id)!==was;
      AU.user=u;AU.ready=true;AU.busy=false;if(u)AU.err='';
      if(ch){HIST.invites=[];HIST.inviteBusy='';HIST.items=[];HIST.loaded=false;HIST.stats={played:0,wins:0,losses:0,winRate:0,pointsFor:0,pointsAgainst:0,sessions:0}}
      if(ch&&!u){view='home';SETTINGS_TAB='main';routeInitialized=false;if(profileNotificationChannel){sbc.removeChannel(profileNotificationChannel);profileNotificationChannel=null}ADMIN.isAdmin=false;ADMIN.role='';if(view==='admin')view='profile';ACH.summary=null;ACH.notifications=[];ACH.open=false;ACH.notificationsOpen=false;watchFriendships(null);AU.profile=null;AU.profileErr='';AU.profileLoading=false;HIST.loaded=false;HIST.items=[];HIST.stats={played:0,wins:0,losses:0,winRate:0,pointsFor:0,pointsAgainst:0,sessions:0}}
      if(u&&(ch||ev==='INITIAL_SESSION'||ev==='USER_UPDATED'))AU.profileLoading=true;
      if(ch||ev==='INITIAL_SESSION'||ev==='USER_UPDATED'){if(view==='home'||view==='setup')render();else paintAuth();if(view==='settings'&&SETTINGS_TAB==='notifications')loadNotificationPreferences();if(view==='settings'&&SETTINGS_TAB==='help'&&u&&!SUPPORT.loaded)setTimeout(loadMySupport,0);setTimeout(checkAdminAccess,0)}
      if(u&&(ch||ev==='INITIAL_SESSION')){watchFriendships(u.id);watchProfileNotifications(u.id)}
      if(u&&(ch||ev==='INITIAL_SESSION'||ev==='USER_UPDATED'))setTimeout(()=>{loadProfile(u.id);loadMyHistory();loadFriends();loadMyAchievements();const supportTicket=new URLSearchParams(location.search).get('support_ticket');if(supportTicket)openSupportReplyNotification(supportTicket,true);if(view==='clubs'||view==='club-detail')loadClubs();if(view==='activity'){ACT.loaded=false;loadActivity(true)}if(view==='user-profile'&&PUB.id)openUserProfile(PUB.id);redeemClubInviteFromUrl()},0);
      if(u&&ch&&AU.oauth&&ev==='SIGNED_IN'){AU.oauth=false;toast('Sesión iniciada como '+auName(u))}});
    setTimeout(()=>{if(!AU.ready){AU.ready=true;paintAuth();if(view==='settings'&&SETTINGS_TAB==='notifications')loadNotificationPreferences()}},4000)}
  catch(e){sbc=null;console.warn('[auth] onAuthStateChange:',e&&e.message)}}
  addEventListener('pageshow',e=>{if(e.persisted&&AU.busy){AU.busy=false;paintAuth()}});
  /* Si la foto de Google no carga, se muestra la inicial */
  document.addEventListener('error',e=>{const t=e.target;if(t&&t.tagName==='IMG'&&t.classList.contains('av')){const s=document.createElement('span');s.className='av';s.setAttribute('aria-hidden','true');s.textContent=t.dataset.i||'?';t.replaceWith(s)}},true);
}
function syncRouteFromLocation(event){
  const route=location.hash.replace(/^#\/?/,'').toLowerCase(),clubId=route.startsWith('clubes/')?decodeURIComponent(route.slice(7)):null,profileId=route.startsWith('jugadores/')?decodeURIComponent(route.slice(10)):null,settingsRoute=route.startsWith('ajustes/')?route.split('/')[1]:null,next=clubId?'club-detail':profileId?'user-profile':settingsRoute?'settings':ROUTE_TO_VIEW[route];
  if(next&&(next!==view||(next==='club-detail'&&clubId!==CL.selectedId)||(next==='user-profile'&&profileId!==PUB.id)||(next==='settings'&&SETTINGS_TAB!==(SETTINGS_ROUTE_TO_TAB[settingsRoute]||'main')))){
    if(next==='settings')SETTINGS_TAB=SETTINGS_ROUTE_TO_TAB[settingsRoute]||'main';
    view=next;ed=null;CL.selectedId=clubId||null;if(next==='user-profile')PUB.id=profileId;routeInitialized=true;render();
    const savedY=event&&event.state&&Number.isFinite(event.state.__pmScrollY)?event.state.__pmScrollY:0;
    requestAnimationFrame(()=>window.scrollTo(0,savedY));
    if((next==='clubs'||next==='club-detail')&&AU.user){if(!CL.items.length)loadClubs();else if(clubId)loadClubData(clubId)}
    if(next==='user-profile'&&profileId&&AU.user)openUserProfile(profileId);
    if(next==='activity'&&AU.user)loadActivity(true);
  }
}
if(typeof window!=='undefined'){
  window.addEventListener('hashchange',syncRouteFromLocation);
  window.addEventListener('popstate',syncRouteFromLocation);
}
if(typeof document!=='undefined'&&document.getElementById('app'))render();
if(typeof module!=='undefined')module.exports={gen,trial,genQ,rotInfo};

document.addEventListener('change',e=>{const s=e.target.closest('[data-language-select]');if(s)setAppLanguage(s.value)});
document.addEventListener('keydown',e=>{if(e.key==='Escape')A.closeg()});

// Actualizar el feed con el gesto nativo de arrastrar hacia abajo (solo desde el inicio de la página).
let activityPullStart=null;
document.addEventListener('touchstart',e=>{
  if(view!=='activity'||!AU.user||ACT.loading||!e.touches||e.touches.length!==1){activityPullStart=null;return}
  if(window.scrollY<=0)activityPullStart={x:e.touches[0].clientX,y:e.touches[0].clientY};
},{passive:true});
document.addEventListener('touchend',e=>{
  if(!activityPullStart)return;
  const start=activityPullStart;activityPullStart=null;
  if(view!=='activity'||!AU.user||ACT.loading||!e.changedTouches||!e.changedTouches.length)return;
  const dx=e.changedTouches[0].clientX-start.x,dy=e.changedTouches[0].clientY-start.y;
  if(dy>=75&&Math.abs(dx)<Math.max(45,dy*.6)&&window.scrollY<=0)loadActivity(true);
},{passive:true});
document.addEventListener('touchcancel',()=>{activityPullStart=null},{passive:true});

document.addEventListener('keydown',e=>{if(e.key==='Escape'&&view==='club-detail'&&(CL.openEventId||CL.openPostId)){CL.openEventId=null;CL.openPostId=null;CL.editingPostId=null;paintClubs()}});
