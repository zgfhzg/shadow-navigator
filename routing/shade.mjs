import {solarAt} from '../dist/engine.mjs';
import {edgeMinutes} from './engine.mjs';
const CELL=100,MAX_RAY=500,RAD=Math.PI/180;
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
function inside(point,ring){let result=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])result=!result;}return result;}
const inPolygon=(p,rings)=>inside(p,rings[0])&&!rings.slice(1).some(r=>inside(p,r));
// Intervals along a horizontal ray inside an arbitrary polygon, including holes.
export function rayIntervals(point,direction,rings,maxDistance=MAX_RAY){
  const cuts=[0,maxDistance];
  for(const ring of rings)for(let i=1;i<ring.length;i++){
    const a=ring[i-1],b=ring[i],segment=[b[0]-a[0],b[1]-a[1]],delta=[a[0]-point[0],a[1]-point[1]],den=cross(direction,segment);
    if(Math.abs(den)<1e-10)continue;
    const t=cross(delta,segment)/den,u=cross(delta,direction)/den;
    if(t>0&&t<maxDistance&&u>=0&&u<=1)cuts.push(t);
  }
  cuts.sort((a,b)=>a-b);const intervals=[];
  for(let i=1;i<cuts.length;i++){const a=cuts[i-1],b=cuts[i];if(b-a<1e-7)continue;const mid=(a+b)/2;if(inPolygon([point[0]+direction[0]*mid,point[1]+direction[1]*mid],rings))intervals.push([a,b]);}
  return intervals;
}
export function createScene(collection){
  if(collection?.type!=='FeatureCollection'||!Array.isArray(collection.features))throw new Error('건물 GeoJSON 형식이 올바르지 않습니다.');
  const bounds=collection.shadow?.bounds;
  if(!Array.isArray(bounds)||bounds.length!==4||!bounds.every(Number.isFinite)||bounds[0]>=bounds[2]||bounds[1]>=bounds[3])throw new Error('건물 데이터의 수집 범위가 필요합니다.');
  const longitude=(bounds[0]+bounds[2])/2,latitude=(bounds[1]+bounds[3])/2,cos=Math.cos(latitude*RAD);
  const project=([lon,lat])=>[(lon-longitude)*RAD*6371008.8*cos,(lat-latitude)*RAD*6371008.8];
  const unproject=([x,y])=>[longitude+x/(RAD*6371008.8*cos),latitude+y/(RAD*6371008.8)];
  const grid=new Map(),parts=[],stats={features:collection.features.length,polygons:0,knownHeight:0,unknownHeight:0,invalidGeometry:0,underground:0};
  let maxHeight=0;
  for(const feature of collection.features){
    const p=feature.properties||{},g=feature.geometry;
    if(p.is_underground===true){stats.underground++;continue;}
    const polygons=g?.type==='Polygon'?[g.coordinates]:g?.type==='MultiPolygon'?g.coordinates:null;
    if(!polygons?.length){stats.invalidGeometry++;continue;}
    // A parent roofprint with building parts is not a solid block. Keep it as
    // uncertain rather than filling courtyards/passages with an invented prism.
    const height=Number.isFinite(p.height)&&p.height>0&&!p.has_parts?p.height:null;
    const base=p.min_height==null?0:p.min_height;
    const known=height!==null&&Number.isFinite(base)&&base>=0&&!(p.min_floor>0&&p.min_height==null);
    if(known){stats.knownHeight++;maxHeight=Math.max(maxHeight,base+height);}else stats.unknownHeight++;
    for(const polygon of polygons){
      if(!Array.isArray(polygon)||!polygon.length||polygon.some(r=>!Array.isArray(r)||r.length<4||r.some(c=>!Array.isArray(c)||c.length<2||!c.slice(0,2).every(Number.isFinite))||r[0][0]!==r.at(-1)[0]||r[0][1]!==r.at(-1)[1])){stats.invalidGeometry++;continue;}
      const rings=polygon.map(r=>r.map(project)),box=[Infinity,Infinity,-Infinity,-Infinity];
      for(const ring of rings)for(const [x,y]of ring){box[0]=Math.min(box[0],x);box[1]=Math.min(box[1],y);box[2]=Math.max(box[2],x);box[3]=Math.max(box[3],y);}
      const part={rings,box,base:known?base:null,top:known?base+height:null,id:feature.id||p.id};const index=parts.push(part)-1;stats.polygons++;
      for(let x=Math.floor(box[0]/CELL);x<=Math.floor(box[2]/CELL);x++)for(let y=Math.floor(box[1]/CELL);y<=Math.floor(box[3]/CELL);y++){const key=`${x},${y}`;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(index);}
    }
  }
  const solarCache=new Map();
  const scene={bounds,project,unproject,grid,parts,stats,maxHeight,latitude,longitude,source:collection.shadow};
  scene.sun=epoch=>{const minute=Math.floor(epoch/60000);if(!solarCache.has(minute)){if(solarCache.size>300)solarCache.clear();solarCache.set(minute,solarAt(minute*60000,{latitude,longitude}));}return solarCache.get(minute);};
  return scene;
}
function candidates(scene,point,end){
  const ids=new Set();
  for(let x=Math.floor(Math.min(point[0],end[0])/CELL);x<=Math.floor(Math.max(point[0],end[0])/CELL);x++)for(let y=Math.floor(Math.min(point[1],end[1])/CELL);y<=Math.floor(Math.max(point[1],end[1])/CELL);y++)for(const id of scene.grid.get(`${x},${y}`)||[])ids.add(id);
  return [...ids].map(id=>scene.parts[id]);
}
export function classifyPoint(scene,coordinate,epoch,{height=0,solar}={}){
  const sun=solar||scene.sun(epoch);if(sun.up<=0)return 'night';
  if(!Number.isFinite(height)||height<0)return 'unknown';
  const point=scene.project(coordinate),horizontal=Math.hypot(sun.east,sun.north);
  if(horizontal<1e-8){let uncertain=Boolean(scene.stats.invalidGeometry);for(const b of candidates(scene,point,point))if(inPolygon(point,b.rings)){if(b.top!==null&&b.top>height)return 'shade';if(b.top===null)uncertain=true;}const [w,s,e,n]=scene.bounds;return uncertain||coordinate[0]<w||coordinate[0]>e||coordinate[1]<s||coordinate[1]>n?'unknown':'sun';}
  const direction=[sun.east/horizontal,sun.north/horizontal],slope=sun.up/horizontal;
  const end=[point[0]+direction[0]*MAX_RAY,point[1]+direction[1]*MAX_RAY];
  let uncertain=false;
  for(const building of candidates(scene,point,end)){
    const intervals=rayIntervals(point,direction,building.rings);
    if(!intervals.length)continue;
    if(building.top===null){uncertain=true;continue;}
    for(const [near,far]of intervals){const low=Math.max(near,(building.base-height)/slope,0),high=Math.min(far,(building.top-height)/slope);if(high-low>1e-6)return 'shade';}
  }
  const [west,south,east,north]=scene.bounds,endCoord=scene.unproject(end);
  if(coordinate[0]<west||coordinate[0]>east||coordinate[1]<south||coordinate[1]>north||endCoord[0]<west||endCoord[0]>east||endCoord[1]<south||endCoord[1]>north||scene.stats.invalidGeometry||scene.maxHeight/slope>MAX_RAY||sun.altitude<2)uncertain=true;
  return uncertain?'unknown':'sun';
}
export function edgeExposure(scene,graph,edge,epoch,mode='walk'){
  const duration=edgeMinutes(edge,mode),a=graph.nodes.get(edge.from),b=graph.nodes.get(edge.to);
  const samples=Math.max(3,Math.min(12,Math.ceil(edge.distance/15))),counts={sun:0,shade:0,unknown:0,night:0};
  // floor/layer are not metres. Never substitute guessed heights on a bridge.
  const height=a.level==='ground'&&b.level==='ground'?0:null;
  for(let i=0;i<samples;i++){const t=(i+.5)/samples,at=epoch+duration*t*60000,c=[a.coordinate[0]+(b.coordinate[0]-a.coordinate[0])*t,a.coordinate[1]+(b.coordinate[1]-a.coordinate[1])*t];
    const solar=scene.sun(at);let state=solar.up<=0?'night':edge.covered?'unknown':classifyPoint(scene,c,at,{height,solar});counts[state]++;
  }
  return Object.fromEntries(Object.entries(counts).map(([key,count])=>[key,duration*count/samples]));
}
export function evaluateRoute(scene,graph,route,epoch,mode){
  const total={sun:0,shade:0,unknown:0,night:0};let elapsed=0;
  const segments=route.segments.map(segment=>{const edge=graph.adj.get(segment.from).find(e=>e.id===segment.id),exposure=edgeExposure(scene,graph,edge,epoch+elapsed*60000,mode);for(const key of Object.keys(total))total[key]+=exposure[key];elapsed+=segment.duration;return {...segment,exposure};});
  return {...route,segments,exposure:{...total,assessedFraction:route.duration?Math.max(0,Math.min(1,(total.sun+total.shade+total.night)/route.duration)):1},departure:epoch};
}

// Ground-level point samples, not exact shadow boundaries. Map consumers must
// display the resolution and must not interpret this as an elevated path layer.
export function sampleGround(scene,bounds,epoch,spacing=30){
  if(!Array.isArray(bounds)||bounds.length!==4||bounds.some(v=>!Number.isFinite(v))||bounds[0]>=bounds[2]||bounds[1]>=bounds[3]||!Number.isFinite(epoch)||!Number.isFinite(spacing)||spacing<10)throw new Error('그늘 표본의 범위·시각을 확인해 주세요.');
  const min=scene.project(bounds.slice(0,2)),max=scene.project(bounds.slice(2));
  const nx=Math.ceil((max[0]-min[0])/spacing),ny=Math.ceil((max[1]-min[1])/spacing);
  if(nx*ny>5000)throw new Error('그늘 표본 범위가 너무 큽니다.');
  const solar=scene.sun(epoch),stats={shade:0,sun:0,unknown:0,night:0},features=[];
  for(let x=0;x<nx;x++)for(let y=0;y<ny;y++){
    const coordinate=scene.unproject([Math.min(max[0],min[0]+(x+.5)*spacing),Math.min(max[1],min[1]+(y+.5)*spacing)]),state=classifyPoint(scene,coordinate,epoch,{solar});stats[state]++;
    if(state==='shade')features.push({type:'Feature',properties:{state},geometry:{type:'Point',coordinates:coordinate}});
  }
  return {type:'FeatureCollection',features,spacing,departure:epoch,stats,buildingStats:scene.stats,source:scene.source,model:'ground samples; opaque buildings; flat terrain; 500m solar ray'};
}
