export const W=1000,H=760;
export const nodes=Array.from({length:63},(_,i)=>({id:i,x:100+i%9*100,y:80+Math.floor(i/9)*100}));
export const places=[['성수역',55],['서울숲 입구',8],['연무장길',30],['성수 아틀리에',14],['뚝섬역',1],['숲길 카페',44]];
// Synthetic city blocks, coordinates and heights: not real Seoul survey data.
export const buildings=[];
for(let y=0;y<6;y++)for(let x=0;x<8;x++){if(x>5&&y<2)continue;buildings.push({x:118+x*100,y:98+y*100,w:34+(x*7+y*3)%35,h:40+(x*3+y*7)%28,height:10+(x*13+y*17)%65});}
export const edges=nodes.flatMap(n=>[n.id%9<8?n.id+1:null,n.id<54?n.id+9:null].filter(v=>v!==null).map(v=>({a:n.id,b:v,length:100,walkOnly:n.id%9>=6&&n.id>=9&&n.id<18&&v===n.id+1})));
// NOAA general solar equations; UTC instant + east-positive longitude.
// Approximation only: no atmospheric refraction, weather, terrain or tree cover.
// https://gml.noaa.gov/grad/solcalc/solareqns.PDF
export function solarAt(instant, {latitude = 37.54, longitude = 127.04} = {}) {
  const utc = new Date(instant);
  if (!Number.isFinite(utc.getTime()) || !Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) throw new RangeError('Invalid solar location or instant');
  const year = utc.getUTCFullYear();
  const days = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86400000;
  const day = Math.floor((Date.UTC(year, utc.getUTCMonth(), utc.getUTCDate()) - Date.UTC(year, 0, 1)) / 86400000) + 1;
  const minutes = utc.getUTCHours() * 60 + utc.getUTCMinutes() + utc.getUTCSeconds() / 60;
  const gamma = 2 * Math.PI / days * (day - 1 + (minutes / 60 - 12) / 24);
  const eqtime = 229.18 * (.000075 + .001868 * Math.cos(gamma) - .032077 * Math.sin(gamma) - .014615 * Math.cos(2 * gamma) - .040849 * Math.sin(2 * gamma));
  const decl = .006918 - .399912 * Math.cos(gamma) + .070257 * Math.sin(gamma) - .006758 * Math.cos(2 * gamma) + .000907 * Math.sin(2 * gamma) - .002697 * Math.cos(3 * gamma) + .00148 * Math.sin(3 * gamma);
  const solarMinutes = ((minutes + eqtime + 4 * longitude) % 1440 + 1440) % 1440;
  const d = Math.PI / 180, lat = latitude * d, ha = (solarMinutes / 4 - 180) * d;
  const east = -Math.cos(decl) * Math.sin(ha);
  const north = Math.cos(lat) * Math.sin(decl) - Math.sin(lat) * Math.cos(decl) * Math.cos(ha);
  const up = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha);
  return {east, north, up, altitude: Math.asin(Math.max(-1, Math.min(1, up))) / d};
}
export function sun(date, minutes, context = {}) {
  // Legacy engine callers use Seoul civil time. The UI always supplies an epoch.
  const instant = context.epoch === undefined
    ? Date.parse(date + 'T00:00:00Z') + (minutes - 540) * 60000
    : context.epoch + (minutes - context.minute) * 60000;
  return solarAt(instant, context);
}
function hull(points){const p=points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);let lo=[],hi=[];for(const q of p){while(lo.length>1&&cross(lo.at(-2),lo.at(-1),q)<=0)lo.pop();lo.push(q);}for(const q of [...p].reverse()){while(hi.length>1&&cross(hi.at(-2),hi.at(-1),q)<=0)hi.pop();hi.push(q);}return lo.slice(0,-1).concat(hi.slice(0,-1));}
export function shadows(date,minutes,context={}){const s=sun(date,minutes,context);if(s.up<=0)return [];return buildings.map(b=>{const scale=b.height/Math.max(.035,s.up),dx=-s.east*scale,dy=s.north*scale;const p=[[b.x,b.y],[b.x+b.w,b.y],[b.x+b.w,b.y+b.h],[b.x,b.y+b.h]];return hull(p.concat(p.map(([x,y])=>[x+dx,y+dy])));});}
function inside(x,y,p){let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;}
export function shadeAt(x,y,date,time,polys,context={}){if(sun(date,time,context).up<=0)return 1;return (polys||shadows(date,time,context)).some(p=>inside(x,y,p))?1:0;}
export function route({start,end,date,time,mode='walk',kind='balanced',context={}}){const speed=mode==='bike'?250:75,weight={fast:0,balanced:1.2,shade:5}[kind];const costs=nodes.map(()=>Infinity),arrival=nodes.map(()=>0),previous=[],done=new Set(),metrics=[];costs[start]=0;while(done.size<nodes.length){let u=-1;for(const n of nodes)if(!done.has(n.id)&&(u<0||costs[n.id]<costs[u]))u=n.id;if(u<0||!Number.isFinite(costs[u])||u===end)break;done.add(u);for(const e of edges){if(mode==='bike'&&e.walkOnly)continue;let v=e.a===u?e.b:e.b===u?e.a:-1;if(v<0||done.has(v))continue;let shaded=0;const duration=e.length/speed;for(let k=0;k<5;k++){const t=(k+.5)/5,at=time+arrival[u]+duration*t;shaded+=shadeAt(nodes[u].x+(nodes[v].x-nodes[u].x)*t,nodes[u].y+(nodes[v].y-nodes[u].y)*t,date,at,undefined,context)/5;}const cost=costs[u]+duration*(1+weight*(1-shaded));if(cost<costs[v]){costs[v]=cost;arrival[v]=arrival[u]+duration;previous[v]=u;metrics[v]={length:e.length,shaded};}}}if(!Number.isFinite(costs[end]))return null;let path=[end],length=0,shadeLength=0;while(path[0]!==start){const v=path[0],m=metrics[v];length+=m.length;shadeLength+=m.length*m.shaded;path.unshift(previous[v]);}return {kind,path,length,minutes:length/speed,shade:length?shadeLength/length:0,sunMinutes:(length-shadeLength)/speed};}
