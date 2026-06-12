import { MAP_DATA } from './data/map-data.js';
import { normAr, dispName } from './core/text.js';
import { roundedPath } from './core/geometry.js';
import { buildRuns, runPoints } from './core/network.js';
import { buildGraph, findRoute } from './core/routing.js';

/* مصادر نصية لتوليد نسخة النشر المستقلة (بديل قراءة وسوم السكربت في النسخة الأحادية) */
import cssText from './styles/main.css?raw';
import textSrc from './core/text.js?raw';
import geometrySrc from './core/geometry.js?raw';
import networkSrc from './core/network.js?raw';
import routingSrc from './core/routing.js?raw';
import appSrc from './app.js?raw';

/* ═══════════════════════════════════════════════════════════════
   التطبيق: الرسم والتفاعل + لوحة الأدمن
   ═══════════════════════════════════════════════════════════════ */
(function(){
const DATA=MAP_DATA;
const S=DATA.stations;
const GAP=8, STROKE=5.5;
const svg=document.getElementById('map');
const wrap=document.getElementById('mapwrap');
const NS='http://www.w3.org/2000/svg';

/* نسخة نقيّة من هيكل الصفحة (لتوليد نسخة النشر) — تُلتقط قبل أي رسم */
const PRISTINE_BODY = document.body.innerHTML.replace(/<script[\s\S]*?<\/script>/gi,'').trim();
const IS_VIEWER = document.body.classList.contains('viewer');

/* فهارس مشتقّة من البيانات — تُعاد كلما تغيّرت البيانات لتبقى الخريطة
   وجهاز البحث والمخطّط متزامنين دائمًا */
let stnLines={}, lineById={}, stationsArr=[];
function rebuildIndexes(){
  stnLines={}; for(const id in S) stnLines[id]=[];
  DATA.lines.forEach(l=>l.paths.forEach(p=>p.stops.forEach(s=>{
    if(stnLines[s] && !stnLines[s].includes(l.id)) stnLines[s].push(l.id);
  })));
  lineById={}; DATA.lines.forEach(l=>lineById[l.id]=l);
  stationsArr=Object.keys(S).map(id=>({id, n:normAr(S[id].name), d:dispName(S[id].name)}));
}

/* حالة التطبيق */
const state={
  view:{x:0,y:0,k:1},
  origin:null, dest:null,
  route:null, routeEdges:null, routeStations:null,
  focusLine:null, typeFilter:'all', selStation:null,
  edit:false, dragStn:null, dragInfo:null,
  draw:null,            // وضع رسم/تعديل مسار: {line, pathIdx, isNew, backupPaths}
  place:false,          // وضع زرع محطة جديدة بالنقر
  renameId:null,
};

let adj, built;

/* ── نقطة المزامنة المركزية: أي تغيير في البيانات يمرّ من هنا ── */
function dataChanged(){
  rebuildIndexes();
  built=buildRuns(DATA);
  adj=buildGraph(DATA);
  if(state.focusLine && !lineById[state.focusLine]){
    state.focusLine=null;
    document.getElementById('lineDetail').innerHTML='';
  }
  renderLines();
  updateStats();
  if(state.origin && state.dest && S[state.origin] && S[state.dest]) computeRoute();
  else render();
}

/* ── أدوات مساعدة ── */
function clientToMap(e){
  const rect=svg.getBoundingClientRect();
  return { x:(e.clientX-rect.left-state.view.x)/state.view.k,
           y:(e.clientY-rect.top -state.view.y)/state.view.k };
}
let toastTimer=null;
function toast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>t.classList.remove('show'),2800);
}

/* ── أدوات DOM ── */
function el(tag, attrs, parent){
  const e=document.createElementNS(NS, tag);
  for(const k in attrs) e.setAttribute(k, attrs[k]);
  if(parent) parent.appendChild(e);
  return e;
}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

/* ── رسم الخريطة كاملة ── */
let world;
function render(){
  svg.innerHTML='';
  world=el('g',{id:'world'},svg);
  applyView();

  const defs=el('defs',{},world);
  const pat=el('pattern',{id:'dotgrid',width:46,height:46,patternUnits:'userSpaceOnUse'},defs);
  el('circle',{cx:1.2,cy:1.2,r:1.2,fill:'currentColor',opacity:.13},pat);
  const bg=el('rect',{x:-400,y:-300,width:2600,height:1900,fill:'url(#dotgrid)'},world);
  bg.style.color='var(--ink-soft)';

  const gRuns=el('g',{},world), gArrows=el('g',{},world), gHits=el('g',{},world),
        gStns=el('g',{},world), gLbls=el('g',{},world), gPins=el('g',{},world);

  const dimRun = r=>{
    if(state.draw) return r.line.id!==state.draw.line.id;
    if(state.routeEdges) return !state.routeEdges.has(r.line.id+':'+r.a+':'+r.b) && !state.routeEdges.has(r.line.id+':'+r.b+':'+r.a);
    if(state.focusLine)  return r.line.id!==state.focusLine;
    if(state.typeFilter!=='all') return r.line.type!==state.typeFilter;
    return false;
  };

  built.runs.forEach(r=>{
    const pts=runPoints(r, built.slots, DATA, GAP);
    const dim=dimRun(r);
    const onRoute = state.routeEdges && !dim;
    const focus = (state.focusLine||state.draw) && !dim;
    const activeDraw = state.draw && r.line.id===state.draw.line.id && r.pi===state.draw.pathIdx;
    const p=el('path',{
      d:roundedPath(pts,15),
      stroke:r.line.color,
      'stroke-width': onRoute?7.5 : activeDraw?8 : focus?7 : STROKE,
      class:'run'+(dim?' dim':'')+(onRoute?' route':'')
    },gRuns);
    p.style.color=r.line.color;
    if(r.oneWay && !dim){
      const mid=polyMid(pts,.55);
      if(mid){
        el('path',{
          d:'M -4.5 -4 L 4 0 L -4.5 4',
          stroke:r.line.color,'stroke-width':2.6,
          class:'oneway',
          transform:`translate(${mid.x},${mid.y}) rotate(${mid.ang})`
        },gArrows);
      }
    }
    /* مسار شفاف عريض فوق الخط يجعله قابلًا للنقر (يُعطَّل أثناء الرسم) */
    if(!state.draw){
      el('path',{
        d:roundedPath(pts,15),
        stroke:'#000','stroke-opacity':0,'stroke-width':16,
        class:'runhit',
        'data-line':r.line.id,'data-a':r.a,'data-b':r.b,'data-pi':r.pi
      },gHits);
    }
  });

  for(const id in S){
    const s=S[id], nl=stnLines[id].length;
    const lblObj = (typeof s.label==='object') ? s.label : null;
    const hub = lblObj && lblObj.hub;
    const r = hub?17 : nl>=4?12.5 : nl>=3?10.5 : 8.5;
    const dimS = isStationDim(id);
    const g=el('g',{class:'stn'+(dimS?' dim':'')+(state.selStation===id?' sel':''),'data-id':id},gStns);
    el('circle',{cx:s.x,cy:s.y,r:r,'stroke-width':hub?5:3.5},g);
    if(hub) el('circle',{cx:s.x,cy:s.y,r:r-7,fill:'none',stroke:'var(--ink)','stroke-width':1.6,opacity:.55},g);
    if(id==='jamia'){
      const ic=el('path',{d:gradCap(s.x,s.y),fill:'var(--ink)'},g);
      ic.style.pointerEvents='none';
    }
    if(id==='qalaa'){
      el('path',{d:castle(s.x+1, s.y-26),fill:'var(--ink)',opacity:.85},g).style.pointerEvents='none';
    }
  }

  for(const id in S){
    const s=S[id];
    const dimS=isStationDim(id);
    const spec=labelSpec(s);
    const lines=s.name.split('|');
    const t=el('text',{
      x:s.x+spec.dx, y:s.y+spec.dy,
      'text-anchor':spec.a,
      class:'lbl'+(spec.big?' big':'')+(dimS?' dim':'')
    },gLbls);
    const lh=spec.big?24:16.5;
    lines.forEach((ln,i)=>{
      el('tspan',{x:s.x+spec.dx, dy:i===0?0:lh},t).textContent=ln;
    });
    if(spec.up && lines.length>1) t.setAttribute('y', s.y+spec.dy-(lines.length-1)*lh);
  }

  [['origin','أ','var(--ink)'],['dest','ب','var(--gold)']].forEach(([k,ch,col])=>{
    const id=state[k];
    if(!id||!S[id]) return;
    const s=S[id];
    const g=el('g',{class:'endpin'},gPins);
    el('circle',{cx:s.x,cy:s.y,r:13.5,fill:col,stroke:'var(--paper)','stroke-width':3},g);
    const tx=el('text',{x:s.x,y:s.y+5.5,'text-anchor':'middle','font-size':14},g);
    tx.textContent=ch;
    if(k==='dest') tx.setAttribute('fill','#211a08');
  });

  bindStationEvents();
}

function isStationDim(id){
  if(state.draw) return false;
  if(state.routeStations) return !state.routeStations.has(id);
  if(state.focusLine) return !stnLines[id].includes(state.focusLine);
  if(state.typeFilter!=='all') return !stnLines[id].some(l=>lineById[l].type===state.typeFilter);
  return false;
}

function labelSpec(s){
  const L=s.label;
  if(typeof L==='object') return {dx:L.dx||0, dy:L.dy||0, a:L.a||'middle', big:!!L.big, up:(L.dy||0)<0};
  const nLines=s.name.split('|').length;
  switch(L){
    case 'B': return {dx:0, dy:28, a:'middle'};
    case 'L': return {dx:-16, dy:5-(nLines-1)*8, a:'start'};
    case 'R': return {dx:16, dy:5-(nLines-1)*8, a:'end'};
    default : return {dx:0, dy:-17, a:'middle', up:true};
  }
}

function polyMid(pts, t){
  let total=0; const segs=[];
  for(let i=0;i<pts.length-1;i++){
    const L=Math.hypot(pts[i+1].x-pts[i].x, pts[i+1].y-pts[i].y);
    segs.push(L); total+=L;
  }
  if(total<46) return null;
  let target=total*t;
  for(let i=0;i<segs.length;i++){
    if(target<=segs[i]){
      const f=target/segs[i];
      return {
        x:pts[i].x+(pts[i+1].x-pts[i].x)*f,
        y:pts[i].y+(pts[i+1].y-pts[i].y)*f,
        ang:Math.atan2(pts[i+1].y-pts[i].y, pts[i+1].x-pts[i].x)*180/Math.PI
      };
    }
    target-=segs[i];
  }
  return null;
}

function gradCap(cx,cy){
  return `M ${cx-9} ${cy-1} L ${cx} ${cy-6} L ${cx+9} ${cy-1} L ${cx} ${cy+4} Z
          M ${cx-5} ${cy+1.5} L ${cx-5} ${cy+6} Q ${cx} ${cy+9} ${cx+5} ${cy+6} L ${cx+5} ${cy+1.5} L ${cx} ${cy+4.5} Z`;
}
function castle(cx,cy){
  return `M ${cx-10} ${cy+8} V ${cy-2} h2.6 v-3 h2.6 v3 h3.2 v-3 h2.6 v3 h3.2 v-3 h2.6 v3 h2.6 V ${cy+8} Z`;
}

/* ── التحويل (تحريك وتقريب) ── */
function applyView(){
  if(world) world.setAttribute('transform',
    `translate(${state.view.x},${state.view.y}) scale(${state.view.k})`);
  placePopup();
}
function fitView(){
  const W=wrap.clientWidth, H=wrap.clientHeight;
  const bx={x:30,y:50,w:1760,h:1160};
  const k=Math.min(W/bx.w, H/bx.h)*.97;
  state.view.k=k;
  state.view.x=(W-bx.w*k)/2 - bx.x*k;
  state.view.y=(H-bx.h*k)/2 - bx.y*k;
  applyView();
}
function zoomAt(px,py,f){
  const v=state.view;
  const nk=Math.min(4.5, Math.max(.25, v.k*f));
  const r=nk/v.k;
  v.x=px-(px-v.x)*r;
  v.y=py-(py-v.y)*r;
  v.k=nk;
  applyView();
}

svg.addEventListener('wheel',e=>{
  e.preventDefault();
  const rect=svg.getBoundingClientRect();
  zoomAt(e.clientX-rect.left, e.clientY-rect.top, e.deltaY<0?1.13:0.885);
},{passive:false});

const ptrs=new Map();
let panStart=null, pinchD=0, moved=false;
svg.addEventListener('pointerdown',e=>{
  if(e.target.closest('.stn') && state.edit && !state.draw){ startDragStation(e); return; }
  svg.setPointerCapture(e.pointerId);
  ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  moved=false;
  if(ptrs.size===1) panStart={x:e.clientX,y:e.clientY,vx:state.view.x,vy:state.view.y};
  if(ptrs.size===2){
    const a=[...ptrs.values()];
    pinchD=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);
  }
  wrap.classList.add('dragging');
});
svg.addEventListener('pointermove',e=>{
  if(state.dragStn){ moveDragStation(e); return; }
  if(!ptrs.has(e.pointerId)) return;
  ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(ptrs.size===1 && panStart){
    const dx=e.clientX-panStart.x, dy=e.clientY-panStart.y;
    if(Math.abs(dx)+Math.abs(dy)>4) moved=true;
    state.view.x=panStart.vx+dx;
    state.view.y=panStart.vy+dy;
    applyView();
  }else if(ptrs.size===2){
    const a=[...ptrs.values()];
    const d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);
    if(pinchD>0){
      const rect=svg.getBoundingClientRect();
      const cx=(a[0].x+a[1].x)/2-rect.left, cy=(a[0].y+a[1].y)/2-rect.top;
      zoomAt(cx,cy,d/pinchD);
    }
    pinchD=d;
    moved=true;
  }
});
function endPtr(e){
  ptrs.delete(e.pointerId);
  if(ptrs.size===0){ panStart=null; wrap.classList.remove('dragging'); }
  if(state.dragStn) endDragStation();
}
svg.addEventListener('pointerup',endPtr);
svg.addEventListener('pointercancel',endPtr);

document.getElementById('zin').onclick =()=>zoomAt(wrap.clientWidth/2,wrap.clientHeight/2,1.25);
document.getElementById('zout').onclick=()=>zoomAt(wrap.clientWidth/2,wrap.clientHeight/2,.8);
document.getElementById('zfit').onclick=fitView;
window.addEventListener('resize',fitView);

/* ── النقر على المحطات ── */
function bindStationEvents(){
  svg.querySelectorAll('.stn').forEach(g=>{
    g.addEventListener('click',e=>{
      closeLinePopup();
      if(moved || state.edit) return;
      if(state.draw){ addDrawStop(g.dataset.id); e.stopPropagation(); return; }
      openPopup(g.dataset.id);
      e.stopPropagation();
    });
  });
  /* النقر على خط: في نسخة النشر يركّزه، وفي الأدمن يفتح قائمة إجراءاته */
  svg.querySelectorAll('.runhit').forEach(h=>{
    h.addEventListener('click',e=>{
      if(moved || state.draw || state.place) return;
      e.stopPropagation();
      closePopup();
      if(IS_VIEWER){
        if(state.focusLine!==h.dataset.line) toggleFocusLine(h.dataset.line);
        return;
      }
      openLinePopup(h.dataset, e);
    });
  });
}

/* ── نافذة الخط: إجراءات مباشرة على الخريطة ── */
const linePopup=document.getElementById('linePopup');
let lineCtx=null;
function openLinePopup(ds, e){
  const rect=wrap.getBoundingClientRect();
  openLinePopupCore(ds, e.clientX-rect.left, e.clientY-rect.top+14, clientToMap(e));
}
/* فتح بطاقة خط عند منتصف أول مقاطعه (يُستخدم بعد إنشاء خط جديد لتسميته فورًا) */
function openLinePopupAt(line){
  const pi=line.paths.findIndex(p=>p.stops.length>=2);
  if(pi<0) return;
  const p=line.paths[pi];
  const a=p.stops[0], b=p.stops[1];
  const mx=(S[a].x+S[b].x)/2, my=(S[a].y+S[b].y)/2;
  openLinePopupCore({line:line.id, a, b, pi:String(pi)},
    state.view.x+mx*state.view.k, state.view.y+my*state.view.k, {x:mx, y:my});
}
function openLinePopupCore(ds, wx, wy, pt){
  const l=lineById[ds.line];
  if(!l) return;
  lineCtx={ lineId:ds.line, a:ds.a, b:ds.b, pi:+ds.pi, pt };
  document.getElementById('lpName').innerHTML='خط '+esc(l.name)
    +' <span class="lp-type">· مقطع '
    +esc(dispName(S[ds.a].name))+' ↔ '+esc(dispName(S[ds.b].name))+'</span>';
  /* تهيئة محرّر الخط داخل البطاقة */
  const c=document.getElementById('lpColor'), n=document.getElementById('lpRename'), t=document.getElementById('lpType');
  c.value=l.color; c._snap=false;
  n.value=l.name;  n._snap=false;
  t.value=l.type;
  linePopup.style.left=Math.min(Math.max(wx-115,8), wrap.clientWidth-265)+'px';
  linePopup.style.top=Math.min(Math.max(wy,8), wrap.clientHeight-300)+'px';
  linePopup.classList.add('open');
}
function closeLinePopup(){ linePopup.classList.remove('open'); }

/* محرّر الخط داخل بطاقته: كل تغيير ينعكس فورًا على الخريطة والمفتاح والبحث */
const lpColor=document.getElementById('lpColor'),
      lpRename=document.getElementById('lpRename'),
      lpType=document.getElementById('lpType');
function lpLine(){ return lineCtx ? lineById[lineCtx.lineId] : null; }
lpColor.addEventListener('input',()=>{
  const l=lpLine(); if(!l) return;
  if(!lpColor._snap){ snapshot(); lpColor._snap=true; }
  l.color=lpColor.value;
  renderLines(); render();
  if(state.route) renderResult();
  if(state.focusLine===l.id) renderLineDetail(l.id);
});
lpColor.addEventListener('change',()=>{ lpColor._snap=false; });
lpRename.addEventListener('input',()=>{
  const l=lpLine(); if(!l) return;
  if(!lpRename._snap){ snapshot(); lpRename._snap=true; }
  l.name=lpRename.value;
  document.getElementById('lpName').firstChild.textContent='خط '+l.name+' ';
  renderLines();
  if(state.route) renderResult();
  if(state.focusLine===l.id) renderLineDetail(l.id);
});
lpRename.addEventListener('blur',()=>{ lpRename._snap=false; });
lpType.addEventListener('change',()=>{
  const l=lpLine(); if(!l) return;
  snapshot();
  l.type=lpType.value;
  renderLines(); render();
  if(state.route) renderResult();
});
document.getElementById('lpX').onclick=closeLinePopup;
document.getElementById('lpFocus').onclick=()=>{
  if(lineCtx && state.focusLine!==lineCtx.lineId) toggleFocusLine(lineCtx.lineId);
  closeLinePopup();
};
document.getElementById('lpEdit').onclick=()=>{
  if(lineCtx) startEditLine(lineById[lineCtx.lineId]);
  closeLinePopup();
};
document.getElementById('lpDelete').onclick=()=>{
  if(!lineCtx) return;
  const l=lineById[lineCtx.lineId];
  if(!confirm('حذف خط «'+l.name+'» نهائيًا من الخريطة وجهاز البحث؟ (يمكن التراجع ↶)')) return;
  snapshot();
  DATA.lines=DATA.lines.filter(x=>x!==l);
  closeLinePopup();
  renderAdmin();
  dataChanged();
  toast('حُذف الخط وتحدّث جهاز البحث');
};
document.getElementById('lpInsert').onclick=()=>{
  if(!lineCtx) return;
  const l=lineById[lineCtx.lineId];
  const p=l.paths[lineCtx.pi];
  if(!p) return;
  /* موضع الإدراج: إسقاط نقطة النقر على المقطع بين المحطتين */
  let idx=-1;
  for(let i=0;i<p.stops.length-1;i++){
    if((p.stops[i]===lineCtx.a && p.stops[i+1]===lineCtx.b) ||
       (p.stops[i]===lineCtx.b && p.stops[i+1]===lineCtx.a)){ idx=i; break; }
  }
  if(idx<0) return;
  const A=S[p.stops[idx]], B=S[p.stops[idx+1]];
  const pos=projectOnSeg(lineCtx.pt, A, B);
  snapshot();
  const id='S'+Date.now().toString(36)+(stnSeq++);
  S[id]={ name:'محطة جديدة', x:Math.round(pos.x/5)*5, y:Math.round(pos.y/5)*5, label:'T' };
  p.stops.splice(idx+1, 0, id);
  if(p.via){ delete p.via[lineCtx.a+'>'+lineCtx.b]; delete p.via[lineCtx.b+'>'+lineCtx.a]; }
  closeLinePopup();
  dataChanged();
  toast('أُدرجت محطة على خط «'+l.name+'» — مربوطة وظاهرة في البحث فورًا');
  openRename(id);
};
function projectOnSeg(p, a, b){
  const dx=b.x-a.x, dy=b.y-a.y, L2=dx*dx+dy*dy||1;
  let t=((p.x-a.x)*dx+(p.y-a.y)*dy)/L2;
  t=Math.max(.15, Math.min(.85, t));   // لا تلتصق المحطة الجديدة بإحدى الجارتين
  return { x:a.x+dx*t, y:a.y+dy*t };
}
const popup=document.getElementById('popup');
function openPopup(id){
  state.selStation=id;
  document.getElementById('popName').textContent=dispName(S[id].name);
  const pl=document.getElementById('popLines');
  pl.innerHTML=stnLines[id].length
    ? stnLines[id].map(lid=>{
        const l=lineById[lid];
        return `<div class="pline"><span class="sw" style="background:${l.color}"></span>
                خط ${esc(l.name)} <span style="color:var(--ink-soft)">· ${l.type}</span></div>`;
      }).join('')
    : `<div class="pline" style="color:var(--ink-soft)">لا يمرّ بها أي خط حاليًا</div>`;
  popup.classList.add('open');
  placePopup();
  render();
}
function placePopup(){
  const id=state.selStation;
  if(!id||!popup.classList.contains('open')) return;
  const s=S[id];
  const px=state.view.x+s.x*state.view.k, py=state.view.y+s.y*state.view.k;
  const W=wrap.clientWidth;
  popup.style.left=Math.min(Math.max(px-110,8), W-260)+'px';
  popup.style.top=Math.max(py+20,8)+'px';
}
function closePopup(){
  popup.classList.remove('open');
  if(state.selStation){ state.selStation=null; render(); }
}
document.getElementById('popupX').onclick=closePopup;
svg.addEventListener('click',e=>{
  if(e.target.closest('.stn') || e.target.closest('.runhit') || moved) return;
  closeLinePopup();
  if(state.place){
    const pt=clientToMap(e);
    cancelPlace();
    const id=createStationAt(pt.x, pt.y);
    openRename(id);
    return;
  }
  closePopup();
});
/* نقرة مزدوجة على الفراغ (في وضعي التعديل أو الرسم) = محطة جديدة في مكانها */
svg.addEventListener('dblclick',e=>{
  if(IS_VIEWER || moved) return;
  if(e.target.closest('.stn')) return;
  if(!state.edit && !state.draw) return;
  e.preventDefault();
  const pt=clientToMap(e);
  const id=createStationAt(pt.x, pt.y);
  if(state.draw){ addDrawStop(id); openRename(id); }
  else openRename(id);
});
document.getElementById('popA').onclick=()=>{ setEndpoint('origin', state.selStation); closePopup(); };
document.getElementById('popB').onclick=()=>{ setEndpoint('dest', state.selStation); closePopup(); };

/* ── البحث والإكمال التلقائي ── */
function attachSearch(inputId, ddId, key){
  const inp=document.getElementById(inputId), dd=document.getElementById(ddId);
  let hl=-1;
  function show(list){
    hl=-1;
    dd.innerHTML = list.length
      ? list.map(o=>`<div class="opt" data-id="${o.id}">${esc(o.d)}
          ${stnLines[o.id].length
            ? `<span class="dots">${stnLines[o.id].map(l=>`<span class="dot" style="background:${lineById[l].color}"></span>`).join('')}</span>`
            : `<span class="nolink">غير مربوطة بخط</span>`}
        </div>`).join('')
      : `<div class="empty">لا توجد محطة بهذا الاسم</div>`;
    dd.classList.add('open');
    dd.querySelectorAll('.opt').forEach(o=>o.onclick=()=>pick(o.dataset.id));
  }
  function pick(id){
    state[key]=id;
    inp.value=dispName(S[id].name);
    dd.classList.remove('open');
    afterEndpointChange();
  }
  inp.addEventListener('input',()=>{
    state[key]=null;
    const q=normAr(inp.value);
    if(!q){ dd.classList.remove('open'); afterEndpointChange(); return; }
    const starts=stationsArr.filter(o=>o.n.startsWith(q));
    const incl=stationsArr.filter(o=>!o.n.startsWith(q)&&o.n.includes(q));
    show([...starts,...incl].slice(0,9));
  });
  inp.addEventListener('focus',()=>{ if(inp.value && !state[key]) inp.dispatchEvent(new Event('input')); });
  inp.addEventListener('keydown',e=>{
    if(!dd.classList.contains('open')) return;
    const opts=dd.querySelectorAll('.opt');
    if(e.key==='ArrowDown'){ hl=Math.min(hl+1,opts.length-1); e.preventDefault(); }
    else if(e.key==='ArrowUp'){ hl=Math.max(hl-1,0); e.preventDefault(); }
    else if(e.key==='Enter'){ if(opts[hl]) pick(opts[hl].dataset.id); else if(opts[0]) pick(opts[0].dataset.id); e.preventDefault(); return; }
    else if(e.key==='Escape'){ dd.classList.remove('open'); return; }
    opts.forEach((o,i)=>o.classList.toggle('hl',i===hl));
  });
  document.addEventListener('click',e=>{ if(!e.target.closest('.field')) dd.classList.remove('open'); });
}
attachSearch('fromIn','fromDD','origin');
attachSearch('toIn','toDD','dest');

function setEndpoint(key,id){
  state[key]=id;
  document.getElementById(key==='origin'?'fromIn':'toIn').value=dispName(S[id].name);
  afterEndpointChange();
}
function afterEndpointChange(){
  if(state.origin && state.dest) computeRoute();
  else { state.route=null; state.routeEdges=null; state.routeStations=null; renderResult(); render(); }
  updateClearBtn();
}

document.getElementById('swapBtn').onclick=()=>{
  [state.origin,state.dest]=[state.dest,state.origin];
  const f=document.getElementById('fromIn'), t=document.getElementById('toIn');
  [f.value,t.value]=[t.value,f.value];
  afterEndpointChange();
};
document.getElementById('goBtn').onclick=()=>{
  if(state.origin && state.dest) computeRoute();
  else renderResult('اختر محطتي الانطلاق والوصول أولًا — اكتب الاسم في الحقلين أو انقر على المحطات في الخريطة.');
};
document.getElementById('clearBtn').onclick=()=>{
  state.origin=state.dest=null; state.route=null; state.routeEdges=null; state.routeStations=null;
  document.getElementById('fromIn').value=''; document.getElementById('toIn').value='';
  renderResult(); render(); updateClearBtn();
};
function updateClearBtn(){
  document.getElementById('clearBtn').classList.toggle('show', !!(state.origin||state.dest||state.route));
}

/* ── حساب الرحلة وعرض التذكرة ── */
function computeRoute(){
  state.focusLine=null;
  document.getElementById('lineDetail').innerHTML='';
  const res=findRoute(DATA, adj, state.origin, state.dest);
  state.route=res;
  if(res && res.legs){
    state.routeEdges=new Set();
    state.routeStations=new Set();
    res.legs.forEach(leg=>{
      leg.stops.forEach(s=>state.routeStations.add(s));
      for(let i=0;i<leg.stops.length-1;i++)
        state.routeEdges.add(leg.line+':'+leg.stops[i]+':'+leg.stops[i+1]);
    });
  }else{ state.routeEdges=null; state.routeStations=null; }
  renderResult();
  render();
  updateClearBtn();
}

function renderResult(msg){
  const box=document.getElementById('result');
  if(msg){ box.innerHTML=`<div class="card noroute">${esc(msg)}</div>`; return; }
  const r=state.route;
  if(!r){ box.innerHTML=''; return; }
  if(r.same){ box.innerHTML=`<div class="card noroute">محطتا الانطلاق والوصول نفسها — أنت في وجهتك بالفعل 🙂</div>`; return; }
  if(!r.legs){ box.innerHTML=`<div class="card noroute">تعذّر إيجاد طريق بين المحطتين على الشبكة الحالية.</div>`; return; }

  let html=`<div class="ticket">
    <div class="thead">
      <span class="tt">تذكرة الرحلة</span>
      <span class="meta">
        <span><b>${r.totalStops}</b> محطة</span>
        <span><b>${r.transfers}</b> تبديل</span>
      </span>
    </div>
    <div class="perfo"></div>
    <div class="legs">`;

  r.legs.forEach((leg,i)=>{
    const l=lineById[leg.line];
    const from=leg.stops[0], to=leg.stops[leg.stops.length-1];
    const mids=leg.stops.slice(1,-1);
    html+=`
    <div class="leg" style="--lc:${l.color}">
      <div class="rail"><span class="lnode"></span><span class="lbar"></span></div>
      <div class="body">
        <div class="lname">اركب خط ${esc(l.name)} <span class="badge">${l.type}</span></div>
        <div class="dirn">من <b>${esc(dispName(S[from].name))}</b> وانزل في <b>${esc(dispName(S[to].name))}</b>
          · ${leg.stops.length-1} ${leg.stops.length-1===1?'محطة':'محطات'}</div>
        ${mids.length?`<details><summary>عرض المحطات بينهما (${mids.length})</summary>
          <div class="stopslist">${mids.map(m=>esc(dispName(S[m].name))).join(' ← ')}</div></details>`:''}
      </div>
    </div>`;
    if(i<r.legs.length-1){
      html+=`<div class="transfer"><span class="ticon">⇄</span> بدّل في المحطة نفسها: ${esc(dispName(S[to].name))}</div>`;
    }
  });

  const dest=r.legs[r.legs.length-1].stops.slice(-1)[0];
  html+=`<div class="endrow"><span class="enode"><span class="pt b">ب</span></span>
         <span class="ename">وصلت: ${esc(dispName(S[dest].name))}</span></div>
    </div></div>`;
  box.innerHTML=html;
}

/* ── قائمة الخطوط (المفتاح) ── */
function renderLines(){
  const list=document.getElementById('linesList');
  list.innerHTML='';
  DATA.lines.forEach(l=>{
    const count=new Set(l.paths.flatMap(p=>p.stops)).size;
    const b=document.createElement('button');
    b.className='linechip'+(state.focusLine===l.id?' on':'')
      +((state.typeFilter!=='all'&&l.type!==state.typeFilter)?' hidden':'');
    b.innerHTML=`<span class="sw" style="background:${l.color}"></span>
      <span class="nm">${esc(l.name)}</span>
      <span class="ct">${count} محطة</span>
      <span class="ty">${l.type}</span>`;
    b.onclick=()=>toggleFocusLine(l.id);
    list.appendChild(b);
  });
}
function toggleFocusLine(id){
  if(state.focusLine===id){ state.focusLine=null; document.getElementById('lineDetail').innerHTML=''; }
  else{
    state.focusLine=id;
    state.route=null; state.routeEdges=null; state.routeStations=null;
    renderResult(); renderLineDetail(id);
  }
  renderLines(); render(); updateClearBtn();
}
function renderLineDetail(id){
  const l=lineById[id];
  const box=document.getElementById('lineDetail');
  const seen=new Set(), stops=[];
  l.paths.forEach(p=>p.stops.forEach(s=>{ if(!seen.has(s)){seen.add(s); stops.push(s);} }));
  const hasLoop=l.paths.some(p=>p.oneWay);
  box.innerHTML=`<div class="card" style="--lc:${l.color}">
    <h2><span class="sw" style="width:26px;height:10px;border-radius:6px;background:${l.color};display:inline-block"></span>
      خط ${esc(l.name)}
      <button class="closex" title="إغلاق">✕</button></h2>
    <div class="lstops">${stops.map(s=>`<div class="lstop" data-id="${s}">
      <span class="nd"></span>${esc(dispName(S[s].name))}</div>`).join('')}</div>
    ${hasLoop?'<div class="loopnote">⟳ يتضمن هذا الخط حلقة تسير باتجاه واحد (لاحظ الأسهم على الخريطة).</div>':''}
  </div>`;
  box.querySelector('.closex').onclick=()=>toggleFocusLine(id);
  box.querySelectorAll('.lstop').forEach(d=>d.onclick=()=>openPopup(d.dataset.id));
}

document.querySelectorAll('#typeSeg button').forEach(b=>{
  b.onclick=()=>{
    document.querySelectorAll('#typeSeg button').forEach(x=>x.classList.remove('on'));
    b.classList.add('on');
    state.typeFilter=b.dataset.t;
    if(state.focusLine && state.typeFilter!=='all' && lineById[state.focusLine].type!==state.typeFilter)
      { state.focusLine=null; document.getElementById('lineDetail').innerHTML=''; }
    renderLines(); render();
  };
});

/* ═══════════════════════════════════════════
   لوحة الأدمن — إدارة المحطات والخطوط
   ═══════════════════════════════════════════ */

/* ═══ نظام التراجع والإعادة ═══
   قبل كل تعديل تُحفظ لقطة كاملة من البيانات؛ التراجع يستعيدها،
   والخريطة وجهاز البحث يُعاد بناؤهما تلقائيًا من البيانات المستعادة. */
const undoStack=[], redoStack=[], UNDO_MAX=60;
function currentJSON(){ return JSON.stringify({stations:S, lines:DATA.lines}); }
function snapshot(){
  undoStack.push(currentJSON());
  if(undoStack.length>UNDO_MAX) undoStack.shift();
  redoStack.length=0;
  updateUndoButtons();
}
function restoreJSON(json){
  const d=JSON.parse(json);
  for(const k in S) delete S[k];
  Object.assign(S, d.stations);
  DATA.lines=d.lines;
  /* الخروج الآمن من أي وضع تحرير جارٍ */
  if(state.draw){ state.draw=null; drawbar.classList.remove('show'); }
  closeRename();
  closePopup();
  /* مزامنة حقلي البحث مع الأسماء المستعادة */
  if(state.origin && S[state.origin]) document.getElementById('fromIn').value=dispName(S[state.origin].name);
  if(state.dest && S[state.dest])     document.getElementById('toIn').value=dispName(S[state.dest].name);
  renderAdmin();
  dataChanged();
  if(state.focusLine) renderLineDetail(state.focusLine);
}
function doUndo(){
  if(!undoStack.length) return;
  redoStack.push(currentJSON());
  restoreJSON(undoStack.pop());
  updateUndoButtons();
}
function doRedo(){
  if(!redoStack.length) return;
  undoStack.push(currentJSON());
  restoreJSON(redoStack.pop());
  updateUndoButtons();
}
function updateUndoButtons(){
  const u=document.getElementById('undoBtn'), r=document.getElementById('redoBtn');
  if(u) u.disabled=!undoStack.length;
  if(r) r.disabled=!redoStack.length;
}
document.getElementById('undoBtn')?.addEventListener('click',doUndo);
document.getElementById('redoBtn')?.addEventListener('click',doRedo);
document.addEventListener('keydown',e=>{
  if(IS_VIEWER) return;
  const t=document.activeElement;
  if(t && (t.tagName==='INPUT'||t.tagName==='TEXTAREA')) return;   // لا نعترض تراجع الكتابة داخل الحقول
  if((e.ctrlKey||e.metaKey) && !e.shiftKey && e.key.toLowerCase()==='z'){ e.preventDefault(); doUndo(); }
  else if((e.ctrlKey||e.metaKey) && (e.key.toLowerCase()==='y' || (e.shiftKey && e.key.toLowerCase()==='z'))){ e.preventDefault(); doRedo(); }
});

/* — وضع التعديل: سحب المحطات + إعادة التسمية بالنقر — */
const editBtn=document.getElementById('editBtn');
editBtn.onclick=()=>{
  if(state.draw) return;
  state.edit=!state.edit;
  editBtn.classList.toggle('active', state.edit);
  wrap.classList.toggle('editing', state.edit);
  closePopup();
};
function startDragStation(e){
  const g=e.target.closest('.stn');
  state.dragStn=g.dataset.id;
  state.dragInfo={sx:e.clientX, sy:e.clientY, moved:false};
  svg.setPointerCapture(e.pointerId);
  e.stopPropagation();
}
let rafPending=false;
function moveDragStation(e){
  const info=state.dragInfo;
  if(!info.moved && Math.abs(e.clientX-info.sx)+Math.abs(e.clientY-info.sy)>5){
    info.moved=true;
    snapshot();   // لقطة قبل أول تحريك فعلي
  }
  if(!info.moved) return;
  const rect=svg.getBoundingClientRect();
  const mx=(e.clientX-rect.left-state.view.x)/state.view.k;
  const my=(e.clientY-rect.top -state.view.y)/state.view.k;
  const s=S[state.dragStn];
  s.x=Math.round(mx/5)*5;
  s.y=Math.round(my/5)*5;
  if(!rafPending){
    rafPending=true;
    requestAnimationFrame(()=>{ rafPending=false; built=buildRuns(DATA); render(); });
  }
}
function endDragStation(){
  const id=state.dragStn, info=state.dragInfo;
  state.dragStn=null; state.dragInfo=null;
  if(info && !info.moved){ openRename(id); return; }   // نقرة دون سحب = إعادة تسمية
  dataChanged();
}

/* — إعادة تسمية محطة — */
const renameBg=document.getElementById('renameBg');
function openRename(id){
  state.renameId=id;
  document.getElementById('rnName').value=S[id].name;
  document.getElementById('rnPos').value='keep';
  populateRnLines(id);
  renameBg.classList.add('open');
  setTimeout(()=>document.getElementById('rnName').focus(),60);
}
function closeRename(){ renameBg.classList.remove('open'); state.renameId=null; }
document.getElementById('rnX').onclick=closeRename;
document.getElementById('rnCancel').onclick=closeRename;
renameBg.addEventListener('click',e=>{ if(e.target===renameBg) closeRename(); });
document.getElementById('rnSave').onclick=()=>{
  const id=state.renameId;
  if(!id) return;
  const s=S[id];
  const nv=document.getElementById('rnName').value.trim();
  const pos=document.getElementById('rnPos').value;
  if((nv && nv!==s.name) || pos!=='keep') snapshot();
  if(nv) s.name=nv;
  if(pos!=='keep'){
    if(typeof s.label==='object' && s.label.hub){ /* المحاور الكبرى تحتفظ بموضعها المخصص */ }
    else s.label=pos;
  }
  /* مزامنة حقول البحث إن كانت تشير لهذه المحطة */
  if(state.origin===id) document.getElementById('fromIn').value=dispName(s.name);
  if(state.dest===id)   document.getElementById('toIn').value=dispName(s.name);
  closeRename();
  dataChanged();
  if(state.draw) syncDrawUI();
};
document.getElementById('rnName').addEventListener('keydown',e=>{
  if(e.key==='Enter') document.getElementById('rnSave').click();
});

/* — الربط الذكي: إدراج المحطة في أنسب موضع على مسارات الخط —
   يُقارن «الالتفاف» الناتج عن إدراجها بين كل زوج محطات متجاورتين
   (المسافة عبرها ناقص المسافة المباشرة) مع كلفة تمديد المسار من طرفيه،
   ويُختار الأقل. يعيد false إن لم يكن للخط مسار صالح. */
function smartAttach(line, stId){
  const st=S[stId];
  let best=null;
  line.paths.forEach((p,pi)=>{
    for(let i=0;i<p.stops.length-1;i++){
      const a=S[p.stops[i]], b=S[p.stops[i+1]];
      const cost=Math.hypot(a.x-st.x,a.y-st.y)+Math.hypot(b.x-st.x,b.y-st.y)-Math.hypot(a.x-b.x,a.y-b.y);
      if(!best||cost<best.cost) best={pi, at:i+1, cost, pair:[p.stops[i],p.stops[i+1]]};
    }
    const isLoop=p.stops.length>2 && p.stops[0]===p.stops[p.stops.length-1];
    if(p.stops.length && !isLoop){
      const e0=S[p.stops[0]], e1=S[p.stops[p.stops.length-1]];
      const c0=Math.hypot(e0.x-st.x,e0.y-st.y), c1=Math.hypot(e1.x-st.x,e1.y-st.y);
      if(!best||c0<best.cost) best={pi, at:0, cost:c0, pair:null};
      if(!best||c1<best.cost) best={pi, at:p.stops.length, cost:c1, pair:null};
    }
  });
  if(!best) return false;
  const p=line.paths[best.pi];
  p.stops.splice(best.at, 0, stId);
  if(best.pair && p.via){ delete p.via[best.pair[0]+'>'+best.pair[1]]; delete p.via[best.pair[1]+'>'+best.pair[0]]; }
  return true;
}

/* — فصل محطة عن خط واحد (مع الحفاظ على الحلقات المغلقة) — */
function detachFromLine(line, stId){
  line.paths.forEach(p=>{
    const wasLoop=p.stops.length>2 && p.stops[0]===p.stops[p.stops.length-1];
    p.stops=p.stops.filter(s=>s!==stId);
    p.stops=p.stops.filter((s,i)=>i===0||s!==p.stops[i-1]);
    if(wasLoop && p.stops.length>=2 && p.stops[0]!==p.stops[p.stops.length-1]) p.stops.push(p.stops[0]);
    if(p.via){ for(const k in p.via){ const ab=k.split('>'); if(ab[0]===stId||ab[1]===stId) delete p.via[k]; } }
  });
  line.paths=line.paths.filter(p=>p.stops.length>=3 || (p.stops.length===2 && p.stops[0]!==p.stops[1]));
}

/* — قائمة ربط/فصل الخطوط داخل نافذة المحطة — */
function populateRnLines(id){
  const box=document.getElementById('rnLines');
  box.innerHTML='';
  DATA.lines.forEach(l=>{
    const linked=(stnLines[id]||[]).includes(l.id);
    const row=document.createElement('div');
    row.className='rn-line';
    row.innerHTML=`<span class="sw" style="background:${l.color}"></span>
      <span class="rn-ln" title="${esc(l.name)}">${esc(l.name)}</span>
      <button class="${linked?'unlink':'link'}">${linked?'فصل':'ربط'}</button>`;
    row.querySelector('button').onclick=()=>{
      snapshot();
      if(linked){
        detachFromLine(l, id);
        toast('فُصلت المحطة عن خط «'+l.name+'» وتحدّث البحث');
      }else{
        if(!smartAttach(l, id)){
          undoStack.pop(); updateUndoButtons();
          toast('خط «'+l.name+'» بلا مسار مرسوم بعد — ارسمه أولًا بزر ✎');
          return;
        }
        toast('رُبطت المحطة بخط «'+l.name+'» — تظهر الآن في رحلاته بجهاز البحث');
      }
      dataChanged();
      populateRnLines(id);
      if(state.draw) syncDrawUI();
    };
    box.appendChild(row);
  });
}

/* — حذف محطة: تُزال من كل مسارات الخطوط ويُوصل المسار بين جارتيها — */
document.getElementById('rnDelete').onclick=()=>{
  const id=state.renameId;
  if(!id) return;
  const used=stnLines[id].length;
  const msg='حذف محطة «'+dispName(S[id].name)+'» نهائيًا؟'
    +(used?' تمرّ بها '+used+' من الخطوط وسيُوصل مسار كل خط بين المحطتين المجاورتين مباشرة.':'')
    +' (يمكن التراجع ↶)';
  if(!confirm(msg)) return;
  snapshot();
  DATA.lines.forEach(l=>{
    l.paths.forEach(p=>{
      /* إن كان المسار حلقة مغلقة (يبدأ وينتهي بالمحطة نفسها) نحفظ ذلك
         لنعيد إغلاق الحلقة بعد الحذف — وإلا تتحول حلقة الاتجاه الواحد لطريق مسدود */
      const wasLoop = p.stops.length>2 && p.stops[0]===p.stops[p.stops.length-1];
      p.stops=p.stops.filter(s=>s!==id);
      p.stops=p.stops.filter((s,i)=>i===0||s!==p.stops[i-1]);   // إزالة أي تكرار متتالٍ ناتج
      if(wasLoop && p.stops.length>=2 && p.stops[0]!==p.stops[p.stops.length-1])
        p.stops.push(p.stops[0]);                                // إعادة إغلاق الحلقة
      if(p.via){ for(const k in p.via){ const ab=k.split('>'); if(ab[0]===id||ab[1]===id) delete p.via[k]; } }
    });
    l.paths=l.paths.filter(p=>p.stops.length>=3 || (p.stops.length===2 && p.stops[0]!==p.stops[1]));
  });
  delete S[id];
  if(state.origin===id){ state.origin=null; document.getElementById('fromIn').value=''; }
  if(state.dest===id)  { state.dest=null;   document.getElementById('toIn').value=''; }
  if(state.selStation===id) state.selStation=null;
  if(state.draw){ syncDrawUI(); }
  closeRename();
  renderAdmin();
  dataChanged();
  toast('حُذفت المحطة وتحدّث جهاز البحث والمسارات تلقائيًا');
};

/* — إنشاء محطة جديدة — */
let stnSeq=0;
function createStationAt(x,y,name){
  snapshot();
  const id='S'+Date.now().toString(36)+(stnSeq++);
  S[id]={ name:name||'محطة جديدة', x:Math.round(x/5)*5, y:Math.round(y/5)*5, label:'T' };
  dataChanged();
  toast('أُنشئت محطة جديدة — أصبحت متاحة فورًا في البحث والمخطّط');
  return id;
}

/* — وضع زرع المحطات من شريط التعديل — */
const placeBtn=document.getElementById('placeBtn');
placeBtn.onclick=()=>{
  state.place=!state.place;
  wrap.classList.toggle('placing', state.place);
  placeBtn.classList.toggle('on', state.place);
  if(state.place) toast('انقر على الخريطة في مكان المحطة الجديدة (Esc للإلغاء)');
};
function cancelPlace(){
  state.place=false;
  wrap.classList.remove('placing');
  placeBtn.classList.remove('on');
}
document.addEventListener('keydown',e=>{
  if(e.key==='Escape' && state.place) cancelPlace();
});

/* — إدارة الخطوط: لون / اسم / نوع / حذف — */
function renderAdmin(){
  /* أزيلت بطاقة «إدارة الخطوط» من الشريط الجانبي —
     تحرير الخط (اللون/الاسم/النوع/المسار/الحذف) صار بالنقر عليه فوق الخريطة مباشرة،
     وإضافة خط جديد من زر «＋ خط جديد» في شريط وضع التعديل. */
}

/* ═══ محرّر المسارات الموحّد: رسم خط جديد أو تعديل خط موجود ═══
   - إضافة خط: يبدأ بمسار فارغ، انقر المحطات بالترتيب.
   - تعديل خط: تُحمَّل مساراته؛ «تراجع» يحذف من نهاية المسار النشط
     والنقر يمدّده، وشرائح الأرقام تنقل بين المسارات، و«＋ فرع» يضيف مسارًا جديدًا.
   - نقرة مزدوجة على فراغ الخريطة أثناء الرسم = محطة جديدة تُضاف للمسار فورًا.
   - عند الحفظ يُعاد بناء جهاز البحث والمخطّط من المسارات الجديدة مباشرة. */
const drawbar=document.getElementById('drawbar');
const PALETTE=['#e07b2a','#0ea5b7','#7c4dde','#4f7f2f','#c2356f','#6b7a23','#1f5fae','#a05522','#10897a','#b03030'];

document.getElementById('addLineBtn').onclick=()=>{
  if(state.draw) return;
  const used=new Set(DATA.lines.map(l=>l.color.toLowerCase()));
  const color=PALETTE.find(c=>!used.has(c))||'#'+Math.floor(Math.random()*0xffffff).toString(16).padStart(6,'0');
  const line={ id:'L'+Date.now().toString(36), name:'خط جديد', type:'باص', color, paths:[{stops:[]}] };
  snapshot();
  DATA.lines.push(line);
  renderAdmin();
  enterDraw(line, true);
};

function startEditLine(line){
  if(state.draw) return;
  snapshot();
  if(!line.paths.length) line.paths.push({stops:[]});
  enterDraw(line, false);
  toast('وضع تعديل المسار: انقر المحطات لتمديده، و«تراجع» يحذف من نهايته');
}

function enterDraw(line, isNew){
  state.edit=false; editBtn.classList.remove('active'); wrap.classList.remove('editing');
  cancelPlace();
  closePopup();
  state.draw={ line, isNew, pathIdx:0,
               backupPaths: JSON.parse(JSON.stringify(line.paths)) };
  drawbar.classList.add('show');
  syncDrawUI();
  dataChanged();
}
function activePath(){ return state.draw.line.paths[state.draw.pathIdx]; }

function syncDrawUI(){
  const d=state.draw; if(!d) return;
  if(!d.line.paths.length) d.line.paths.push({stops:[]});
  if(d.pathIdx>=d.line.paths.length) d.pathIdx=d.line.paths.length-1;
  const p=activePath();
  document.getElementById('drawTitle').innerHTML=
    (d.isNew?'رسم مسار ':'تعديل مسارات ')+'<b>«'+esc(d.line.name)+'»</b>: انقر المحطات بالترتيب';
  document.getElementById('drawCount').textContent='('+p.stops.length+')';
  const last=p.stops[p.stops.length-1];
  document.getElementById('drawLast').textContent=last&&S[last]?('آخرها: '+dispName(S[last].name)):'';
  document.getElementById('drawOneWay').checked=!!p.oneWay;
  /* شرائح اختيار المسار + إضافة فرع */
  const box=document.getElementById('drawPaths');
  box.innerHTML='';
  if(d.line.paths.length>1){
    d.line.paths.forEach((pp,i)=>{
      const c=document.createElement('button');
      c.className='pchip'+(i===d.pathIdx?' on':'');
      c.textContent=(i+1);
      c.title='مسار '+(i+1)+(pp.stops.length
        ? ': '+dispName(S[pp.stops[0]].name)+' ← '+dispName(S[pp.stops[pp.stops.length-1]].name)
        : ' (فارغ)');
      c.onclick=()=>{ d.pathIdx=i; syncDrawUI(); render(); };
      box.appendChild(c);
    });
  }
  const add=document.createElement('button');
  add.className='pchip';
  add.textContent='＋ فرع';
  add.title='إضافة مسار/فرع جديد لهذا الخط';
  add.onclick=()=>{
    d.line.paths.push({stops:[]});
    d.pathIdx=d.line.paths.length-1;
    syncDrawUI();
    built=buildRuns(DATA);
    render();
  };
  box.appendChild(add);
}

function addDrawStop(id){
  const st=activePath().stops;
  if(st[st.length-1]===id) return;
  st.push(id);
  syncDrawUI();
  built=buildRuns(DATA);
  render();
}
document.getElementById('drawUndo').onclick=()=>{
  if(!state.draw) return;
  activePath().stops.pop();
  syncDrawUI();
  built=buildRuns(DATA);
  render();
};
document.getElementById('drawOneWay').onchange=function(){
  if(!state.draw) return;
  activePath().oneWay=this.checked;
  built=buildRuns(DATA);
  render();
};
document.getElementById('drawDone').onclick=()=>{
  const d=state.draw;
  if(!d) return;
  const dropped=d.line.paths.filter(p=>p.stops.length<2).length;
  d.line.paths=d.line.paths.filter(p=>p.stops.length>=2);
  if(d.isNew && !d.line.paths.length){
    alert('المسار يحتاج محطتين على الأقل — انقر المحطات على الخريطة بالترتيب، أو اضغط «إلغاء».');
    d.line.paths.push({stops:[]});
    syncDrawUI();
    return;
  }
  const isNew=d.isNew;
  state.draw=null;
  drawbar.classList.remove('show');
  renderAdmin();
  dataChanged();
  if(!d.line.paths.length)
    toast('أُزيلت كل مسارات الخط — أعد رسمها بزر ✎ أو احذف الخط');
  else
    toast(isNew ? 'أُضيف الخط وصار متاحًا فورًا في جهاز البحث'
                : 'حُفظ المسار وتحدّث جهاز البحث مباشرة'+(dropped?' (أُهملت مسارات فارغة)':''));
  if(isNew && d.line.paths.length){
    /* فتح بطاقة الخط الجديد مباشرة لتسميته وتلوينه */
    openLinePopupAt(d.line);
    setTimeout(()=>{ lpRename.focus(); lpRename.select(); }, 80);
  }
};
document.getElementById('drawCancel').onclick=()=>{
  const d=state.draw;
  if(!d) return;
  d.line.paths=d.backupPaths;                                  // استرجاع المسارات كما كانت
  if(d.isNew) DATA.lines=DATA.lines.filter(x=>x!==d.line);     // الخط الجديد يُزال كليًا
  /* الإلغاء يعيد البيانات كما قبل البدء — نزيل لقطتها إن كانت أعلى المكدس */
  if(undoStack.length && undoStack[undoStack.length-1]===currentJSON()){
    undoStack.pop(); updateUndoButtons();
  }
  state.draw=null;
  drawbar.classList.remove('show');
  renderAdmin();
  dataChanged();
};

/* — تصدير إحداثيات المحطات (للصق في ملف المصدر) — */
const modalBg=document.getElementById('modalBg');
document.getElementById('exportBtn').onclick=()=>{
  const lines=Object.keys(S).map(id=>{
    const s=S[id];
    const lbl = typeof s.label==='object' ? JSON.stringify(s.label).replace(/"/g,'') : `'${s.label}'`;
    return `  ${id}: st('${s.name}', ${s.x}, ${s.y}, ${lbl}),`;
  });
  document.getElementById('exportTA').value=`stations: {\n${lines.join('\n')}\n},`;
  modalBg.classList.add('open');
};
document.getElementById('modalX').onclick=()=>modalBg.classList.remove('open');
modalBg.addEventListener('click',e=>{ if(e.target===modalBg) modalBg.classList.remove('open'); });
document.getElementById('copyBtn').onclick=()=>{
  const ta=document.getElementById('exportTA');
  ta.select();
  navigator.clipboard?.writeText(ta.value).catch(()=>document.execCommand('copy'));
  document.getElementById('copyOk').style.display='inline';
  setTimeout(()=>document.getElementById('copyOk').style.display='none',2000);
};

/* ═══════════════════════════════════════════
   تصدير نسخة النشر — ملف واحد مستقل
   (خريطة + جهاز بحث، من دون أدوات التعديل)
   ═══════════════════════════════════════════ */
/* تجريد أسطر import/export كي تعمل الوحدات كسكربتات تقليدية في الملف المولّد */
function stripESM(src){
  return src.split('\n').filter(l=>!/^\s*(import |export \{)/.test(l)).join('\n');
}
function buildPublishHTML(){
  const css=cssText;
  const dataJS='const MAP_DATA = '+JSON.stringify(DATA)+';';
  const logic=stripESM([textSrc,geometrySrc,networkSrc,routingSrc].join('\n'));
  const app=stripESM(appSrc);
  const SC='<scr'+'ipt>', EC='</scr'+'ipt>';
  return '<!DOCTYPE html>\n<html lang="ar" dir="rtl">\n<head>\n'
    +'<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
    +'<title>خريطة النقل الداخلي لحلب — دليل تفاعلي</title>\n'
    +'<link rel="preconnect" href="https://fonts.googleapis.com">\n'
    +'<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
    +'<link href="https://fonts.googleapis.com/css2?family=Changa:wght@500;700;800&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet">\n'
    +'<style>\n'+css+'\n</style>\n</head>\n'
    +'<body class="viewer">\n'+PRISTINE_BODY+'\n'
    +SC+'\n'+dataJS+'\n'+EC+'\n'
    +SC+'\n'+logic+'\n'+EC+'\n'
    +SC+'\n'+app+'\n'+EC+'\n'
    +'</body>\n</html>';
}
const pubBg=document.getElementById('pubBg');
document.getElementById('pubBtn')?.addEventListener('click',()=>{
  const html=buildPublishHTML();
  document.getElementById('pubTA').value=html;
  const kb=Math.round(new Blob([html]).size/1024);
  document.getElementById('pubSize').innerHTML=
    `حجم الملف: <b>${kb} ك.ب</b> · يتضمن ${DATA.lines.length} خطًا و${Object.keys(S).length} محطة بآخر تعديلاتك.`;
  pubBg.classList.add('open');
});
document.getElementById('pubX').onclick=()=>pubBg.classList.remove('open');
pubBg.addEventListener('click',e=>{ if(e.target===pubBg) pubBg.classList.remove('open'); });
document.getElementById('pubDownload').onclick=()=>{
  const blob=new Blob([document.getElementById('pubTA').value],{type:'text/html;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='خريطة-حلب.html';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  showPubOk();
};
document.getElementById('pubCopy').onclick=()=>{
  const ta=document.getElementById('pubTA');
  ta.select();
  navigator.clipboard?.writeText(ta.value).catch(()=>document.execCommand('copy'));
  showPubOk();
};
function showPubOk(){
  document.getElementById('pubOk').style.display='inline';
  setTimeout(()=>document.getElementById('pubOk').style.display='none',2000);
}

/* الوضع الليلي */
document.getElementById('themeBtn').onclick=function(){
  document.body.classList.toggle('dark');
  const dark=document.body.classList.contains('dark');
  this.innerHTML=dark?'☀️ <span>نهاري</span>':'🌙 <span>ليلي</span>';
};

/* الإحصاءات */
function updateStats(){
  document.getElementById('stats').innerHTML=
    `<span><b>${DATA.lines.length}</b> خط</span><span><b>${Object.keys(S).length}</b> محطة</span>`;
}

/* انطلاق */
rebuildIndexes();
built=buildRuns(DATA);
adj=buildGraph(DATA);
renderLines();
if(!IS_VIEWER) renderAdmin();
updateStats();
render();
fitView();
})();
