/* — هندسة: إزاحة مسار متوازٍ (miter offset) — */
function offsetPolyline(pts, d){
  if(!d) return pts.map(p=>({x:p.x,y:p.y}));
  const n=pts.length, dirs=[], out=[];
  for(let i=0;i<n-1;i++){
    const dx=pts[i+1].x-pts[i].x, dy=pts[i+1].y-pts[i].y, L=Math.hypot(dx,dy)||1;
    dirs.push({x:dx/L,y:dy/L});
  }
  for(let i=0;i<n;i++){
    let nx,ny;
    if(i===0){ nx=-dirs[0].y; ny=dirs[0].x; }
    else if(i===n-1){ nx=-dirs[n-2].y; ny=dirs[n-2].x; }
    else{
      const a=dirs[i-1], b=dirs[i];
      let mx=-(a.y+b.y), my=(a.x+b.x);
      const L=Math.hypot(mx,my);
      if(L<1e-6){ nx=-a.y; ny=a.x; }
      else{
        mx/=L; my/=L;
        const cos=mx*(-a.y)+my*a.x;
        const sc=Math.min(1/Math.max(cos,.25), 3);
        nx=mx*sc; ny=my*sc;
      }
    }
    out.push({x:pts[i].x+nx*d, y:pts[i].y+ny*d});
  }
  return out;
}

/* — هندسة: مسار بزوايا منحنية — */
function roundedPath(pts, r){
  if(pts.length<2) return '';
  let d=`M ${pts[0].x} ${pts[0].y}`;
  for(let i=1;i<pts.length-1;i++){
    const p0=pts[i-1], p1=pts[i], p2=pts[i+1];
    const l1=Math.hypot(p1.x-p0.x,p1.y-p0.y), l2=Math.hypot(p2.x-p1.x,p2.y-p1.y);
    const rr=Math.min(r, l1/2.2, l2/2.2);
    if(rr<1){ d+=` L ${p1.x} ${p1.y}`; continue; }
    const ax=p1.x-(p1.x-p0.x)/l1*rr, ay=p1.y-(p1.y-p0.y)/l1*rr;
    const bx=p1.x+(p2.x-p1.x)/l2*rr, by=p1.y+(p2.y-p1.y)/l2*rr;
    d+=` L ${ax} ${ay} Q ${p1.x} ${p1.y} ${bx} ${by}`;
  }
  const e=pts[pts.length-1];
  d+=` L ${e.x} ${e.y}`;
  return d;
}

export { offsetPolyline, roundedPath };
