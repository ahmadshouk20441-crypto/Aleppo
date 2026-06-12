import { offsetPolyline } from './geometry.js';

/* — بناء "الأشواط": كل شوط = مقطع خط بين محطتين متتاليتين — */
function buildRuns(DATA){
  const runs=[], corridors={};
  DATA.lines.forEach((line, li)=>{
    line.paths.forEach((path, pi)=>{
      const via=path.via||{};
      for(let i=0;i<path.stops.length-1;i++){
        const a=path.stops[i], b=path.stops[i+1];
        if(!DATA.stations[a]) throw new Error('محطة غير معرّفة: '+a);
        if(!DATA.stations[b]) throw new Error('محطة غير معرّفة: '+b);
        let bends = via[a+'>'+b] || null, rev=false;
        if(!bends && via[b+'>'+a]){ bends=[...via[b+'>'+a]].reverse(); }
        const key=[a,b].sort().join('|');
        (corridors[key]=corridors[key]||new Set()).add(li);
        runs.push({line, li, pi, a, b, key, bends, oneWay:!!path.oneWay});
      }
    });
  });
  const slots={};
  for(const key in corridors){
    const lis=[...corridors[key]].sort((x,y)=>x-y);
    slots[key]={};
    lis.forEach((li,idx)=>{ slots[key][li]=idx-(lis.length-1)/2; });
  }
  return {runs, slots};
}

/* — حساب نقاط الشوط مع الإزاحة المتوازية — */
function runPoints(run, slots, DATA, GAP){
  const S=DATA.stations;
  const pts=[{x:S[run.a].x,y:S[run.a].y},
             ...(run.bends||[]).map(b=>({x:b[0],y:b[1]})),
             {x:S[run.b].x,y:S[run.b].y}];
  let off = slots[run.key][run.li]*GAP;
  const canonical = [run.a,run.b].sort()[0]===run.a;   // اتجاه قياسي ثابت للممر
  if(!canonical) off=-off;
  return offsetPolyline(pts, off);
}

export { buildRuns, runPoints };
