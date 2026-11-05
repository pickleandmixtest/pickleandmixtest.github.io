'use strict';
const K='pickleMix.v1',$=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fresh=()=>({players:[],settings:{courts:1,points:11,cycles:3,mode:'rot',pairing:'random'},matches:[],started:false,nid:1,teams:[],draft:[]});
function valid(d){return d&&Array.isArray(d.players)&&Array.isArray(d.matches)&&d.settings&&d.players.every(p=>p&&typeof p.id=='number'&&typeof p.name=='string')&&d.matches.every(m=>m&&Array.isArray(m.a)&&Array.isArray(m.b)&&m.a.length==2&&m.b.length==2&&['pending','done','skipped'].includes(m.status))&&(d.settings.mode!=='fixed'||Array.isArray(d.teams))&&['courts','points','cycles'].every(k=>Number.isInteger(d.settings[k])&&d.settings[k]>0)}
let S=fresh();try{const d=JSON.parse(localStorage.getItem(K));if(valid(d)){S=d;if(!S.started&&S.settings.points===7)S.settings.points=11}}catch(e){}
const save=()=>{try{localStorage.setItem(K,JSON.stringify(S))}catch(e){}};
let view=S.started?'game':'home',tmp=null,msg='',err='',nerr='',ed=null,ct=1,SC={};
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
const foot=()=>`<p class="mut foot">Plataforma para pickleballers creada por <a href="https://kikebarcelodg.github.io/" target="_blank" rel="noopener">Kike Barceló</a></p>`;
function render(){
  const f={home:vHome,setup:vSetup,game:vGame,more:vMore,final:vFinal}[view];
  $('#app').innerHTML=header()+f()+(err?`<div class="err">${esc(err)}</div>`:'')+foot();err='';nerr='';if(view==='home')initPong('pong',null,true);
  if(msg){toast(msg);msg=''}
}
let PG={u:0,c:0};
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
    if(PG.u>=WIN||PG.c>=WIN){s.m='over';idle();s.vx=s.vy=0;say(PG.u>PG.c?`¡Ganaste ${PG.u}-${PG.c}! Toca la pelota para jugar otra vez`:`Gana el ordenador ${PG.c}-${PG.u}. Toca la pelota para la revancha`);return}
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
function header(){
  const t=S.started?[['home','Inicio'],['go','Partido'],['more','Jugadores'],['final','Resumen']]:[['home','Inicio'],['setup','Preparar'],['final','Resumen']];
  const cur={home:'home',game:'go',more:'more',final:'final',setup:'setup'}[view];
  return`<header class="top"><div class="mark">PICKLE<b>&amp;MIX</b></div><div class="who" id="authchip">${authChipIn()}</div><nav class="tabs" aria-label="Acceso rápido">${t.map(x=>`<button data-a="${x[0]}"${x[0]===cur?' aria-current="page"':''}>${x[1]}</button>`).join('')}</nav></header>`}
const GT={
pong:`<svg viewBox="0 0 160 96" aria-hidden="true"><rect width="160" height="96" fill="#2f6fbd"/><rect x="6" y="6" width="148" height="84" rx="4" fill="none" stroke="#fff" stroke-width="2" opacity=".8"/><path d="M6 48H154" stroke="#fff" stroke-width="2" stroke-dasharray="6 5" opacity=".8"/><rect x="56" y="12" width="46" height="8" rx="4" fill="#ff6a4d"/><rect x="66" y="76" width="46" height="8" rx="4" fill="#fff"/><circle cx="84" cy="62" r="4" fill="#d4f53c" opacity=".35"/><circle cx="92" cy="54" r="7" fill="#d4f53c" stroke="#0e1c33" stroke-width="2"/></svg>`,
kitchen:`<svg viewBox="0 0 160 96" aria-hidden="true"><rect width="160" height="96" fill="#12325e"/><polygon points="44,10 116,10 148,90 12,90" fill="#2f7bff" stroke="#fff" stroke-width="2"/><polygon points="31,56 129,56 140,78 20,78" fill="#d4f53c" opacity=".35"/><path d="M80 10V56M80 78V90" stroke="#fff" stroke-width="2"/><rect x="26" y="40" width="108" height="9" rx="3" fill="#0e1c33" opacity=".7"/><rect x="24" y="38" width="112" height="3" rx="1.5" fill="#fff"/><circle cx="98" cy="68" r="7" fill="#d4f53c" stroke="#0e1c33" stroke-width="2"/></svg>`,
dink:`<svg viewBox="0 0 160 96" aria-hidden="true"><rect width="160" height="96" fill="#12325e"/><rect x="48" y="6" width="64" height="84" rx="4" fill="#2f6fbd" stroke="#fff" stroke-width="2"/><rect x="48" y="40" width="64" height="26" fill="#4a8fe0"/><path d="M42 52H118" stroke="#0e1c33" stroke-width="5" stroke-linecap="round"/><path d="M42 52H118" stroke="#fff" stroke-width="2" stroke-dasharray="3 3"/><circle cx="88" cy="22" r="15" fill="#fff" stroke="#ff6a4d" stroke-width="3"/><circle cx="88" cy="22" r="8" fill="#ff6a4d"/><circle cx="88" cy="22" r="3.4" fill="#f8e81c"/><path d="M70 80Q62 52 86 28" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="2 5" stroke-linecap="round"/><circle cx="70" cy="80" r="6" fill="#d4f53c" stroke="#0e1c33" stroke-width="2"/></svg>`,
pairs:`<svg viewBox="0 0 160 96" aria-hidden="true"><rect width="160" height="96" fill="#12325e"/><g stroke="#fff" stroke-opacity=".3" stroke-width="2"><rect x="25" y="12" width="30" height="34" rx="6" fill="#2a62ad"/><rect x="105" y="12" width="30" height="34" rx="6" fill="#2a62ad"/><rect x="65" y="54" width="30" height="34" rx="6" fill="#2a62ad"/><rect x="105" y="54" width="30" height="34" rx="6" fill="#2a62ad"/></g><g fill="#d4f53c"><circle cx="40" cy="29" r="5"/><circle cx="120" cy="29" r="5"/><circle cx="80" cy="71" r="5"/><circle cx="120" cy="71" r="5"/></g><g fill="#fff" stroke="#d4f53c" stroke-width="2.5"><rect x="65" y="12" width="30" height="34" rx="6"/><rect x="25" y="54" width="30" height="34" rx="6"/></g><g fill="#f8e81c" stroke="#0e1c33" stroke-width="2"><circle cx="80" cy="29" r="10"/><circle cx="40" cy="71" r="10"/></g></svg>`};
const GM=[['pong','Pong','Duelo contra el ordenador a 7 puntos','play'],['kitchen','Kitchen Rush','Reflejos: espera el bote en la Kitchen','kitchen'],['dink','Dink Shot','Puntería: apunta a la diana con viento','dink'],['pairs','Pickle Pairs','Memoria: encuentra las parejas, de 1 a 4 jugadores','pairs']];
const gamesGrid=()=>`<h2 class="gt">Minijuegos</h2><p class="lead">Para pasar el rato mientras te toca descansar.</p><div class="games">${GM.map(g=>`<button class="gc" data-a="${g[3]}" aria-label="Jugar a ${g[1]}"><span class="th">${GT[g[0]]}</span><span class="tx"><b>${g[1]}</b><span>${g[2]}</span></span></button>`).join('')}</div>`;
function vHome(){const n=S.players.length,c=S.settings;
  return`<p class="sub tagline">Elige tu modo de juego, disfruta con tus amigos y consigue <b>tu ranking</b> automáticamente</p>
  <div id="authbox">${authInner()}</div>
  <div class="card"><div class="big">${n}</div><div>jugadores inscritos</div><div class="chips" style="margin-top:12px"><span class="chip">${c.courts} pista${c.courts>1?'s':''}</span><span class="chip">a ${c.points} puntos</span>${FX()?'':`<span class="chip">${c.cycles} ciclos</span>`}<span class="chip">${FX()?'grupos + eliminatorias':'parejas rotatorias'}</span></div></div>
  ${S.started?'<button class="btn ball" data-a="go">Continuar la quedada</button>':''}
  <button class="btn ghost" data-a="${S.started?'more':'setup'}">Gestionar participantes</button>
  ${gamesGrid()}`}
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
function vSetup(){const c=S.settings,n=S.players.length,per=Math.floor(n/4)||0,T=Math.floor(n/2),tot=FX()?fxTotal(T):(n>=4?Math.ceil(n*c.cycles/4):0);
  return`<h2>Prepara la quedada</h2><p class="lead">Añade a los jugadores y ajusta pistas, puntos${FX()?'':' y ciclos'}.</p>${modeSel()}
  <form class="card" data-f="add"><label class="mut">Añadir jugadores (uno o varios separados por comas o líneas)</label><div class="row"><input name="n" autocomplete="off" placeholder="Nombre"><button class="btn sm fix">Añadir</button></div>${nameErrBox()}</form>
  <div class="card">${n?S.players.map(p=>`<div class="row" style="margin:6px 0"><input value="${esc(p.name)}" data-ren="${p.id}" aria-label="Nombre"><button class="btn sm red fix" data-del="${p.id}" aria-label="Eliminar ${esc(p.name)}">✕</button></div>`).join(''):'<div class="empty">👥<br><b>Aún no hay jugadores</b><br>Añade al menos 4 para empezar.</div>'}</div>
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
    if(!FX()&&mx>mn)aw.push(['Compañero universal',`${names(u)}: ${mx} compañeros distintos`]);
    const t=dn.reduce((a,b)=>Math.abs(b.sa-b.sb)<Math.abs(a.sa-a.sb)?b:a);
    aw.push(['Partido más ajustado',`${t.a.map(nameOf).join('/')} ${t.sa}-${t.sb} ${t.b.map(nameOf).join('/')}`]);}
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
  ${dn.length?`<button class="btn ball" data-a="story">Descargar imagen de ranking</button>${share?'<button class="btn ghost" data-a="storyshare">Compartir imagen…</button>':''}`:''}
  ${S.started&&S.matches.length&&!pending().length?'<button class="btn ghost" data-a="repeat">Repetir con los mismos jugadores</button><button class="btn red" data-a="reset">Nueva quedada (borra todo)</button>':''}
  <button class="btn ghost" data-a="${S.started?'go':'home'}">Volver</button>`}

/* ---------- Imagen para Instagram Stories (1080x1920) ---------- */
function storyCanvas(){
  const W=1080,H=1920,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
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
  x.fillText('RESUMEN FINAL · '+new Date().toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'}).toUpperCase(),64,306);
  let y=420;
  /* ganador */
  if(top.length){
    card(48,y,W-96,236,LIME);x.fillStyle=INK;x.font=`800 30px ${BF}`;x.fillText(top.length>1?'GANADORES (EMPATE)':'GANADOR/A',92,y+54);
    const t=fit(names(top),W-96-44-240,`900 #px ${HF}`,84,40);x.fillText(t,92,y+138);
    x.font=`700 32px ${BF}`;x.fillText(`${top[0].w} victorias · diferencia ${sg(top[0].pf-top[0].pa)}`,92,y+194);
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
      tn=id=>{const t=S.teams.find(q=>q.id===id);return t?t.p.map(nameOf).join(' / '):'por definir'},
      st=stats(),gl=Array.from({length:G},(_,g)=>st.filter(s=>(S.teams.find(t=>t.id===s.p.id).g||0)===g).sort((a,b)=>rate(b)-rate(a)||dif(b)-dif(a))),
      rounds=[],PL={1:'Final',2:'Semifinales',4:'Cuartos de final'},gcols=G>1?2:1,gic=G===1?2:1,mxg=Math.max(1,...gl.map(l=>l.length)),rg=Math.ceil(mxg/gic),rowsG=Math.ceil(G/gcols);
    for(let n=Q/2;n>=1;n/=2)rounds.push(n);
    const HT=k=>k*(24+LAB+rowsG*(GH+GR*rg+GAP)+rounds.reduce((s,n)=>s+LAB+Math.ceil(n/(n>=2?2:1))*(MB+GAP),0)+(Q?CG+CH:0)+24);
    let k=1;while(k>.4&&HT(k)>AV)k-=.02;
    const th=Math.min(AV,HT(k)),F=(v,m)=>Math.max(m,Math.round(v*k));
    card(48,y,W-96,th,'#fff');
    let cy=y+24*k;
    const lab=(t,ar)=>{x.textAlign='center';x.textBaseline='middle';x.fillStyle=NAVY;x.font=`900 ${F(28,14)}px ${BF}`;x.fillText((ar?'▼  ':'')+t.toUpperCase(),W/2,cy+LAB*k/2);cy+=LAB*k};
    /* grupos */
    lab(G>1?'Fase de grupos':'Fase de grupos · todos contra todos');
    const gw=(IW-GAP*(gcols-1))/gcols,gh=(GH+GR*rg)*k,cw0=(gw-40)/gic;
    gl.forEach((l,g)=>{const gx=X0+(g%gcols)*(gw+GAP),gy=cy+Math.floor(g/gcols)*(gh+GAP*k);
      rr(gx,gy,gw,gh,22,'#f3f7fb');x.textAlign='left';x.textBaseline='middle';x.fillStyle=NAVY;x.font=`900 ${F(32,16)}px ${HF}`;x.fillText(grpL(g).toUpperCase(),gx+20,gy+GH*k/2);
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
          x.fillText(fit(m?tn(t):'por definir',cw-32-70*k,`${win?900:700} #px ${BF}`,F(32,15),12),bx+18,ly+hh/2+(j?1:2));
          if(done){x.textAlign='right';x.font=`900 ${F(36,16)}px ${HF}`;x.fillText(s,bx+cw-20,ly+hh/2+(j?1:2))}});
        x.fillStyle='#cdd8e6';x.fillRect(bx+10,by+hh-1,cw-20,2)}
      cy+=Math.ceil(n/cols)*(bh+GAP*k)});
    /* campeón */
    if(Q){cy+=CG*k;const fm=S.matches.find(m=>m.ph==='ko'&&m.ko===1&&m.status==='done'),nm=fm?tn(fm.sa>fm.sb?fm.ta:fm.tb):null,cw=Math.min(IW,760),ch=CH*k,bx=(W-cw)/2;
      rr(bx,cy,cw,ch,26,nm?LIME:'#f3f7fb');x.textAlign='center';x.textBaseline='middle';x.fillStyle=nm?INK:MUT;
      x.font=`900 ${F(44,18)}px ${HF}`;x.fillText(fit('🏆 '+(nm||'Campeón por definir'),cw-40,`900 #px ${HF}`,F(44,18),12),W/2,cy+ch/2+2)}
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
  x.fillStyle=MUT;x.font=`800 22px ${BF}`;x.textAlign='left';x.fillText('#',cx.p,y+62);x.fillText(FX()?'PAREJA':'JUGADOR',cx.n,y+62);
  x.textAlign='right';x.fillText('VICTORIAS',cx.w,y+62);x.fillText('DERROTAS',cx.l,y+62);x.fillText('DIF.',cx.df,y+62);x.fillText(FX()?'PJ':'COMP.',cx.cp,y+62);
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
  x.textAlign='center';x.fillStyle=MUT;x.font=`700 30px ${BF}`;x.fillText(`${dn.length} partidos disputados · ${FX()?'parejas fijas':'parejas rotatorias'}`,W/2,Math.min(H-92,y+44));
  x.fillStyle=NAVY;x.font=`800 26px ${BF}`;x.fillText(fit('Juega con tus amigos y consigue el ranking en pickleandmix.github.io',W-96,`800 #px ${BF}`,26,16),W/2,H-40);
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
const GN={kitchen:'Kitchen Rush',dink:'Dink Shot',pairs:'Pickle Pairs'};
function openGame(id){if($('#ov'))return;const src=document.getElementById('g-'+id);if(!src)return;
  const o=document.createElement('div');o.id='ov';o.className='ov';o.setAttribute('role','dialog');o.setAttribute('aria-modal','true');o.setAttribute('aria-label',GN[id]);
  o.innerHTML=`<div class="ovh"><span>${GN[id]}</span><button class="btn sm red" data-a="closeg">Cerrar ✕</button></div><iframe title="${GN[id]}" allow="autoplay"></iframe>`;
  const f=o.querySelector('iframe');
  f.addEventListener('load',()=>{try{const w=f.contentWindow;w.addEventListener('keydown',e=>{if(e.key==='Escape')A.closeg()});w.focus()}catch(e){}});
  f.srcdoc=src.textContent.split('<\\/script>').join('</script>');
  document.body.appendChild(o);document.body.style.overflow='hidden'}
const A={
  play(){if($('#ov'))return;const o=document.createElement('div');o.id='ov';o.className='ov';o.setAttribute('role','dialog');o.setAttribute('aria-modal','true');
    o.innerHTML='<div class="ovh"><span>Pong de PICKLE&amp;MIX</span><button class="btn sm red" data-a="closeg">Cerrar ✕</button></div><canvas id="pong2"></canvas><p id="phint2"></p>';
    document.body.appendChild(o);document.body.style.overflow='hidden';initPong('pong2','phint2')},
  closeg(){const o=$('#ov');if(o)o.remove();document.body.style.overflow=''},
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
  setup(){view='setup'},home(){view='home'},go(){view='game';ed=null},more(){view='more'},final(){view='final'},
  start(){const c=S.settings;if(S.players.length<4){err='Necesitas al menos 4 jugadores.';return}
    if(S.players.length<4*c.courts){err=`Con ${c.courts} pistas necesitas al menos ${4*c.courts} jugadores.`;return}
    if(FX()&&S.players.length%2){err='Con parejas fijas necesitas un número par de jugadores.';return}
    if(FX()&&c.pairing==='manual'){ensureDraft();if(S.draft.some(r=>!r[0]||!r[1])){err='Completa todas las parejas.';return}}
    S.players.forEach(p=>p.status='active');S.matches=[];
    if(FX()){const ids=S.players.map(p=>p.id);let pr=[];
      if(c.pairing==='manual')pr=S.draft.map(r=>r.slice());
      else{for(let i=ids.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]]}for(let i=0;i<ids.length;i+=2)pr.push([ids[i],ids[i+1]])}
      S.teams=pr.map((p,i)=>({id:i+1,p}));fxBuild()}
    else{const nm=genQ(S.players.map(p=>p.id),c.cycles,c.courts);nm.forEach(m=>m.id=S.nid++);S.matches=nm}
    S.started=true;SC={};ed=null;ct=1;view='game'},
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
  repeat(){if(!confirm('Se borrarán partidos y resultados, pero se mantienen los jugadores. ¿Continuar?'))return;S.matches=[];S.teams=[];S.draft=[];S.started=false;S.nid=1;S.players.forEach(p=>p.status='active');SC={};ed=null;ct=1;tmp=null;view='setup'},
  reset(){if(confirm('Se borrarán jugadores, partidos y resultados. ¿Seguro?')&&confirm('Última comprobación: ¿empezar una quedada nueva?')){S=fresh();SC={};ed=null;ct=1;tmp=null;view='home'}}
};
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-a],[data-sc],[data-ct],[data-del],[data-st],[data-pd],[data-edit],[data-mode],[data-pm]');if(!t)return;const d=t.dataset;
  if(d.a)A[d.a]();
  else if(d.sc){const c=d.sc[0],v=+d.sc.slice(1),r=scoreStep(tmp,c,v,S.settings.points);if(r.ok)tmp[c]=r.val;else toast(r.msg);$('#app').innerHTML=header()+vGame()+foot();return}
  else if(d.ct){ct=+d.ct;ed=null}
  else if(d.mode)S.settings.mode=d.mode;
  else if(d.pm)S.settings.pairing=d.pm;
  else if(d.del)S.players=S.players.filter(p=>p.id!==+d.del);
  else if(d.edit){const m=S.matches.find(x=>x.id===+d.edit);if(m.status==='skipped')m.status='pending';delete SC[m.id];ed=m.id;view='game'}
  else if(d.st){const[i,s]=d.st.split('-'),p=S.players.find(x=>x.id==i);p.status=p.status===s?'active':s;replan(p.name+(p.status==='active'?' vuelve a jugar.':p.status==='rest'?' descansa.':' se marcha.'))}
  else if(d.pd){const p=S.players.find(x=>x.id==d.pd);if(!confirm(`¿Quitar a ${p.name}? Sus partidos jugados se conservan.`))return;p.status='out';p.removed=true;S.players=S.players.filter(x=>x!==p||S.matches.some(m=>m.status==='done'&&[...m.a,...m.b].includes(p.id)));replan('Jugador quitado.')}
  save();render();
});
document.addEventListener('submit',e=>{e.preventDefault();if(e.target.dataset.f==='profile'){saveProfile(e.target);return}const f=e.target.dataset.f,v=e.target.n.value;if(!v.trim())return;
  const r=addNames(v);if(r.added&&f==='addlive')replan('Jugador añadido.');
  if(r.dups.length)nerr=dupMsg(r.dups,r.added);
  save();render();
  /* los nombres rechazados se quedan en el cuadro para poder corregirlos */
  if(r.dups.length){const i=document.querySelector(`form[data-f="${f}"] input[name="n"]`);if(i){i.value=r.dups.join(', ');i.focus();i.select()}}});
document.addEventListener('change',e=>{const t=e.target;
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
const AU={user:null,profile:null,profileLoading:false,profileErr:'',ready:false,busy:false,err:'',guest:false,oauth:false};
let sbc=null;
const auRedirect=()=>location.origin+location.pathname.replace(/index\.html$/,'');
const auName=u=>{const p=AU.profile&&u&&AU.profile.id===u.id?AU.profile:null,m=(u&&u.user_metadata)||{};return String((p&&p.display_name)||m.full_name||m.name||(u&&u.email?u.email.split('@')[0]:'')||'Jugador').trim().slice(0,40)||'Jugador'};
const auPic=u=>{const p=AU.profile&&u&&AU.profile.id===u.id?AU.profile:null,m=(u&&u.user_metadata)||{},v=(p&&p.avatar_url)||m.avatar_url||m.picture||'';return/^https:\/\//i.test(v)?v:''};
const auAvatar=u=>{const n=auName(u),i=esc(n.charAt(0).toUpperCase()||'?'),p=auPic(u);
  return p?`<img class="av" src="${esc(p)}" alt="" data-i="${i}" referrerpolicy="no-referrer" width="40" height="40">`:`<span class="av" aria-hidden="true">${i}</span>`};
const GLOGO='<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
const authChipIn=()=>AU.user?`<span class="sr">Sesión iniciada como ${esc(auName(AU.user))}</span>${auAvatar(AU.user)}<span class="nm" aria-hidden="true">${esc(auName(AU.user).split(/\s+/)[0])}</span>`:'';
function authInner(){
  const e=AU.err?'<div class="err" role="alert">'+esc(AU.err)+'</div>':'';
  if(AU.user){
    if(AU.profileLoading)return '<div class="card acct"><div class="me">'+auAvatar(AU.user)+'<div><span class="tag d">Sesión iniciada</span><b>'+esc(auName(AU.user))+'</b></div></div><p class="hint" role="status">Cargando tu perfil…</p><button class="btn ghost" data-a="logout">Cerrar sesión</button></div>';
    if(!AU.profile)return '<div class="card acct"><h3>Tu perfil</h3>'+(AU.profileErr?'<div class="err" role="alert">'+esc(AU.profileErr)+'</div>':'<p class="hint">No se ha podido cargar tu perfil.</p>')+'<button class="btn" data-a="reloadProfile">Reintentar</button><button class="btn ghost" data-a="logout">Cerrar sesión</button></div>';
    const p=AU.profile;
    const opt=(k,v,t)=>'<option value="'+v+'"'+(p[k]===v?' selected':'')+'>'+t+'</option>';
    return '<div class="card acct"><div class="me">'+auAvatar(AU.user)+'<div><span class="tag d">Tu perfil</span><b>'+esc(auName(AU.user))+'</b><span class="mut">Correo de acceso (solo visible para ti): '+esc(AU.user.email||'')+'</span></div></div>'+e+
      '<form data-f="profile" class="profile-form">'+
      '<label for="profile-name">Nombre público</label><input id="profile-name" name="display_name" maxlength="40" minlength="1" required value="'+esc(p.display_name||'')+'" autocomplete="nickname">'+
      '<label for="profile-alias">Alias único</label><input id="profile-alias" name="alias" maxlength="21" value="'+esc(p.alias?'@'+p.alias:'')+'" placeholder="@tu_alias" autocapitalize="none" spellcheck="false">'+
      '<small>Entre 3 y 20 caracteres: letras minúsculas, números y guion bajo. Puedes dejarlo vacío.</small>'+
      '<label for="profile-stats">Quién puede ver tus estadísticas</label><select id="profile-stats" name="stats_visibility">'+opt('stats_visibility','everyone','Todo el mundo')+opt('stats_visibility','friends','Solo amigos')+opt('stats_visibility','nobody','Nadie')+'</select>'+
      '<label for="profile-history">Quién puede ver tu historial</label><select id="profile-history" name="history_visibility">'+opt('history_visibility','everyone','Todo el mundo')+opt('history_visibility','friends','Solo amigos')+opt('history_visibility','nobody','Nadie')+'</select>'+
      '<label for="profile-location">Quién puede ver tu ubicación</label><select id="profile-location" name="location_visibility">'+opt('location_visibility','everyone','Todo el mundo')+opt('location_visibility','friends','Solo amigos')+opt('location_visibility','nobody','Nadie')+'</select>'+
      '<p class="hint">La foto actual procede de Google. Más adelante añadiremos la opción de subir otra.</p><button class="btn" type="submit">Guardar perfil</button></form><button class="btn ghost" data-a="logout">Cerrar sesión</button></div>';
  }
  if(!sbc)return AU.guest?'':'<p class="hint">El acceso con Google no está disponible ahora mismo. La app funciona con normalidad sin cuenta.</p>';
  if(!AU.ready)return '<p class="hint" role="status">Comprobando sesión…</p>';
  const go=AU.busy?'<button class="btn gg" disabled>Conectando con Google…</button>':'<button class="btn gg" data-a="login">'+GLOGO+'Continuar con Google</button>';
  if(AU.guest)return '<div class="card acct mini"><span class="mut">Modo invitado · sin cuenta</span>'+(AU.busy?'<button class="btn sm gg" disabled>Conectando…</button>':'<button class="btn sm ghost" data-a="login">Iniciar sesión</button>')+'</div>'+e;
  return '<div class="card acct"><h3>Entra con tu cuenta</h3><p class="lead">Inicia sesión con Google para tener tu perfil (nombre y foto) en PICKLE &amp; MIX. La app funciona igual sin cuenta.</p>'+e+go+'<button class="btn ghost" data-a="guest">Continuar sin registrarse</button></div>';
}
async function loadProfile(id){
  if(!sbc||!id)return;
  AU.profile=null;AU.profileErr='';AU.profileLoading=true;paintAuth();
  try{const {data,error}=await sbc.from('profiles').select('id,display_name,alias,avatar_url,stats_visibility,history_visibility,location_visibility').eq('id',id).single();
    if(!AU.user||AU.user.id!==id)return;AU.profileLoading=false;
    if(error){AU.profileErr='No se ha podido cargar tu perfil. Comprueba la conexión e inténtalo de nuevo.';console.warn('[profile] load:',error.code,error.message)}else{AU.profile=data;AU.profileErr=''}
  }catch(error){if(!AU.user||AU.user.id!==id)return;AU.profileLoading=false;AU.profileErr='No se ha podido cargar tu perfil. Comprueba la conexión e inténtalo de nuevo.';console.warn('[profile] load:',error&&error.message)}
  paintAuth();
}
async function saveProfile(form){
  if(!sbc||!AU.user||!AU.profile)return;
  const name=String(form.querySelector('[name="display_name"]').value||'').trim();
  const raw=String(form.querySelector('[name="alias"]').value||'').trim().replace(/^@/,'').toLowerCase();
  if(!name||name.length>40){toast('El nombre público debe tener entre 1 y 40 caracteres.');return}
  if(raw&&!/^[a-z0-9_]{3,20}$/.test(raw)){toast('El alias debe tener entre 3 y 20 caracteres: letras, números o guion bajo.');return}
  const payload={display_name:name,alias:raw||null,stats_visibility:form.querySelector('[name="stats_visibility"]').value,history_visibility:form.querySelector('[name="history_visibility"]').value,location_visibility:form.querySelector('[name="location_visibility"]').value};
  const btn=form.querySelector('button[type="submit"]');if(btn){btn.disabled=true;btn.textContent='Guardando…'}
  try{const {data,error}=await sbc.from('profiles').update(payload).eq('id',AU.user.id).select('id,display_name,alias,avatar_url,stats_visibility,history_visibility,location_visibility').single();
    if(error){if(btn){btn.disabled=false;btn.textContent='Guardar perfil'}const message=error.code==='23505'?'Ese alias ya está en uso. Prueba con otro.':error.code==='23514'?'El alias o alguno de los datos no cumple el formato permitido.':'No se ha podido guardar el perfil. Inténtalo de nuevo.';toast(message);console.warn('[profile] save:',error.code,error.message);return}
    AU.profile=data;AU.profileErr='';AU.err='';paintAuth();toast('Perfil guardado.');
  }catch(error){if(btn){btn.disabled=false;btn.textContent='Guardar perfil'}toast('No se ha podido guardar el perfil. Comprueba tu conexión.');console.warn('[profile] save:',error&&error.message)}
}
function paintAuth(){const b=$('#authbox'),c=$('#authchip');if(b)b.innerHTML=authInner();if(c)c.innerHTML=authChipIn()}
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
      if(ch&&!u){AU.profile=null;AU.profileErr='';AU.profileLoading=false}
      if(ch||ev==='INITIAL_SESSION'||ev==='USER_UPDATED')paintAuth();
      if(u&&(ch||!AU.profile||AU.profile.id!==u.id))setTimeout(()=>loadProfile(u.id),0);
      if(u&&ch&&AU.oauth&&ev==='SIGNED_IN'){AU.oauth=false;toast('Sesión iniciada como '+auName(u))}});
    setTimeout(()=>{if(!AU.ready){AU.ready=true;paintAuth()}},4000)}
  catch(e){sbc=null;console.warn('[auth] onAuthStateChange:',e&&e.message)}}
  addEventListener('pageshow',e=>{if(e.persisted&&AU.busy){AU.busy=false;paintAuth()}});
  /* Si la foto de Google no carga, se muestra la inicial */
  document.addEventListener('error',e=>{const t=e.target;if(t&&t.tagName==='IMG'&&t.classList.contains('av')){const s=document.createElement('span');s.className='av';s.setAttribute('aria-hidden','true');s.textContent=t.dataset.i||'?';t.replaceWith(s)}},true);
}
if(typeof document!=='undefined'&&document.getElementById('app'))render();
if(typeof module!=='undefined')module.exports={gen,trial,genQ,rotInfo};

document.addEventListener('keydown',e=>{if(e.key==='Escape')A.closeg()});
