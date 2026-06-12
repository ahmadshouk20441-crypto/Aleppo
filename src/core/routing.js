/* — بناء مخطّط الشبكة لإيجاد الطرق (مع احترام الاتجاه الواحد) — */
function buildGraph(DATA){
  const adj={};
  for(const id in DATA.stations) adj[id]=[];
  const S=DATA.stations;
  const dist=(a,b)=>Math.hypot(S[a].x-S[b].x, S[a].y-S[b].y);
  DATA.lines.forEach(line=>{
    line.paths.forEach(path=>{
      for(let i=0;i<path.stops.length-1;i++){
        const a=path.stops[i], b=path.stops[i+1], w=1+dist(a,b)/700;
        adj[a].push({to:b, line:line.id, w});
        if(!path.oneWay) adj[b].push({to:a, line:line.id, w});
      }
    });
  });
  return adj;
}

/* — خوارزمية دايكسترا على حالات (محطة، خط) مع كلفة تبديل — */
function findRoute(DATA, adj, from, to){
  if(from===to) return {same:true};
  const TRANSFER=2.8;
  const best={}, prev={};
  const startKey=from+'#';
  best[startKey]=0;
  const pq=[[0,from,'']];
  let found=null;
  while(pq.length){
    let mi=0;
    for(let i=1;i<pq.length;i++) if(pq[i][0]<pq[mi][0]) mi=i;
    const [cost,stn,line]=pq.splice(mi,1)[0];
    const key=stn+'#'+line;
    if(cost>best[key]+1e-9) continue;
    if(stn===to){ found=key; break; }
    for(const e of adj[stn]){
      const nc = cost + e.w + (line && e.line!==line ? TRANSFER : 0);
      const nk = e.to+'#'+e.line;
      if(best[nk]===undefined || nc<best[nk]-1e-9){
        best[nk]=nc; prev[nk]=key;
        pq.push([nc, e.to, e.line]);
      }
    }
  }
  if(!found) return null;
  /* إعادة بناء المسار */
  const chain=[];
  let k=found;
  while(k){ chain.push(k); k=prev[k]; }
  chain.reverse();
  const steps=chain.map(k=>{ const [s,l]=k.split('#'); return {stn:s, line:l}; });
  /* تجميع المراحل حسب الخط */
  const legs=[];
  for(let i=1;i<steps.length;i++){
    const l=steps[i].line;
    if(!legs.length || legs[legs.length-1].line!==l)
      legs.push({line:l, stops:[steps[i-1].stn, steps[i].stn]});
    else
      legs[legs.length-1].stops.push(steps[i].stn);
  }
  return {legs, totalStops: steps.length-1, transfers: legs.length-1};
}

export { buildGraph, findRoute };
