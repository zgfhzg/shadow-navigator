import {decodeCompact,snapCompact,findCompact,routeCorridor,cellKey} from './compact.mjs';
import {createScene,classifyPoint,evaluateRoute,sampleGround} from './shade.mjs';import {distance} from './engine.mjs';import {searchPlaces} from './search.mjs';
export async function unpackGzip(bytes){const view=new Uint8Array(bytes);if(view[0]!==31||view[1]!==139)return bytes;if(typeof DecompressionStream==='undefined')throw new Error('압축 도로 데이터를 읽으려면 최신 브라우저가 필요합니다.');return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();}
export function createCountryRuntime(base,fetcher=fetch){
 let metaPromise,graphPromise,buildPromise,indexPromise;const tiles=new Map();
 const read=async name=>{const response=await fetcher(new URL(name,base));if(!response.ok)throw new Error('홍콩 길찾기 자료를 불러오지 못했어요. 네트워크를 확인해 주세요.');return response;};
 const meta=()=>metaPromise??=(read('manifest.json').then(r=>r.json()).catch(e=>{metaPromise=null;throw e;}));
 const graph=()=>graphPromise??=(async()=>{const m=await meta(),buffers=await Promise.all(['nodes.bin.gz','edges.bin.gz'].map(async name=>unpackGzip(await (await read(name)).arrayBuffer())));return decodeCompact(m,...buffers);})().catch(e=>{graphPromise=null;throw e;});
 const buildings=()=>buildPromise??=((async()=>{const m=await meta(),directory=m.buildingsDirectory||'buildings/';if(!/^buildings(?:-[a-z0-9-]+)?\/$/.test(directory))throw new Error('Invalid building manifest directory');return (await read(directory+'manifest.json')).json();})().catch(e=>{buildPromise=null;throw e;}));
 async function sceneFor(keys,progress){
  const manifest=await buildings(),unique=new Map(),list=[...keys];let fetched=0;
  for(let start=0;start<list.length;start+=6){await Promise.all(list.slice(start,start+6).map(async key=>{const file=manifest.files[key];if(!file)return;let job=tiles.get(key);if(!job){job=(async()=>{const buffer=await unpackGzip(await(await read((manifest.directory||'buildings/')+file.file)).arrayBuffer());return JSON.parse(new TextDecoder().decode(buffer)).features;})().catch(e=>{tiles.delete(key);throw e;});tiles.set(key,job);}const features=await job;tiles.delete(key);tiles.set(key,job);while(tiles.size>24)tiles.delete(tiles.keys().next().value);for(const f of features)unique.set(f.id,f);fetched++;}));if(progress&&start%36===0)progress(`경로 주변 건물 자료를 불러오고 있어요… (${Math.min(start+6,list.length)}/${list.length} 구역)`);}
  return createScene({type:'FeatureCollection',features:[...unique.values()],shadow:{...manifest.source,coverageTiles:list,tileStep:manifest.step,fullDatasetStats:manifest.stats}});
 }
 const buildingKeys=(cells,step=.005)=>{const keys=new Set();for(const cell of cells){const [x,y]=cell.split(',').map(Number);for(let a=Math.floor((x*step-.006)/.01);a<=Math.floor(((x+1)*step+.006)/.01);a++)for(let b=Math.floor((y*step-.006)/.01);b<=Math.floor(((y+1)*step+.006)/.01);b++)keys.add(`${a},${b}`);}return keys;};
 return {meta,graph,buildings,async operation(path,params={},progress){
  if(path==='/api/area'){const m=await meta();return {bounds:m.bounds,source:m.source,nodes:m.nodes,edges:m.edges,countrywide:true};}
  if(path==='/api/places'){indexPromise??=read('search.json').then(r=>r.json()).catch(e=>{indexPromise=null;throw e;});return searchPlaces(await indexPromise,params.q||'',params.mode||'walk');}
  if(path==='/api/shade'){
   if(!params.bounds)return {type:'FeatureCollection',features:[],spacing:30,stats:{},countrywide:true};const bounds=JSON.parse(params.bounds);if(!Array.isArray(bounds)||bounds.length!==4||!bounds.every(Number.isFinite)||bounds[0]>=bounds[2]||bounds[1]>=bounds[3]||bounds[2]-bounds[0]>.06||bounds[3]-bounds[1]>.06)return {type:'FeatureCollection',features:[],spacing:30,stats:{},countrywide:true};
   const cells=new Set();for(let x=Math.floor(bounds[0]/.005);x<=Math.floor(bounds[2]/.005);x++)for(let y=Math.floor(bounds[1]/.005);y<=Math.floor(bounds[3]/.005);y++)cells.add(`${x},${y}`);const scene=await sceneFor(buildingKeys(cells));const area=(bounds[2]-bounds[0])*102800*(bounds[3]-bounds[1])*111200,spacing=Math.max(30,Math.ceil(Math.sqrt(area/4000)));return sampleGround(scene,bounds,params.departure?Date.parse(params.departure):Date.now(),spacing);
  }
  const g=await graph(),mode=params.mode||'walk';if(path==='/api/snap')return snapCompact(g,JSON.parse(params.point),mode);
  if(path==='/api/network'){
   const bounds=params.bounds?JSON.parse(params.bounds):[114.15,22.275,114.17,22.29],features=[];for(let i=0;i<g.manifest.nodes&&features.length<12000;i++){const p=g.point(i);if(p[0]<bounds[0]||p[0]>bounds[2]||p[1]<bounds[1]||p[1]>bounds[3])continue;for(let j=g.offsets[i];j<g.offsets[i+1];j++)if(i<g.to[j])features.push({type:'Feature',properties:{kind:g.edge(j,i).kind},geometry:{type:'LineString',coordinates:[p,g.point(g.to[j])]}});}return {city:'hongkong',bounds:g.manifest.bounds,roads:{type:'FeatureCollection',features},nodes:[]};
  }
  if(path!=='/api/route')throw new Error('지원하지 않는 홍콩 길찾기 요청입니다.');
  const epoch=params.departure?Date.parse(params.departure):Date.now();if(!Number.isFinite(epoch)||typeof params.departure==='string'&&!/(Z|[+-]\d{2}:\d{2})$/i.test(params.departure))throw new Error('출발 시각의 시간대가 필요합니다.');
  progress?.('홍콩 전역 도로망에서 경로를 찾고 있어요…');
  const start=params.startNode||snapCompact(g,JSON.parse(params.start),mode).id,end=params.endNode||snapCompact(g,JSON.parse(params.end),mode).id;
  const fast=findCompact(g,{start,end,mode}),corridor=routeCorridor(fast),keys=buildingKeys(corridor);let scene;
  try{scene=await sceneFor(keys,progress);}catch(e){return [{...fast,kind:'fast',departure:epoch,shadeAvailable:false,countrywide:true,buildingError:true,warnings:[...fast.warnings,'건물 자료를 불러오지 못해 그늘 평가 없이 최단 경로만 표시합니다.']}];}
  progress?.('경로 주변의 햇빛·그늘을 비교하고 있어요…');const states=new Map(),origin=g.nodes.get(start).coordinate,target=g.nodes.get(end).coordinate;
  const results=[{...fast,kind:'fast'}];
  for(const [kind,weight]of [['balanced',1],['shade',3]]){
   try{const route=findCompact(g,{start,end,mode,allowedCells:corridor,maxVisited:25000,costForEdge:(edge,elapsed,minutes,j)=>{if(!states.has(j)){const a=g.nodes.get(edge.from),b=g.nodes.get(edge.to),mid=[(a.coordinate[0]+b.coordinate[0])/2,(a.coordinate[1]+b.coordinate[1])/2],d1=distance(origin,mid),d2=distance(mid,target),at=epoch+fast.duration*(d1/(d1+d2||1))*60000;const sun=scene.sun(at);states.set(j,sun.up<=0?'night':edge.covered||a.level!=='ground'||b.level!=='ground'?'unknown':classifyPoint(scene,mid,at));}return minutes+weight*(['sun','unknown'].includes(states.get(j))?minutes:0);}});results.push({...route,kind});}
   catch(e){if(e.message!=='SHADE_SEARCH_BUDGET')throw e;results.push({...fast,kind,searchLimited:true,warnings:[...fast.warnings,'계산량 제한으로 이 후보는 최단 경로를 사용합니다.']} );}
  }
  return results.map(route=>({...evaluateRoute(scene,g,route,epoch,mode),shadeAvailable:true,countrywide:true,buildingStats:scene.stats,buildingSource:scene.source,algorithm:'A*; shade comparison within approximately 1km of shortest route; midpoint solar cost; actual passage-time evaluation',warnings:[...route.warnings,'그늘 우선은 최단 경로 주변 약 1km의 후보를 비교하는 근사 탐색입니다. 건물 높이 미상은 평가 불가입니다.','경사 지형·가로수·날씨·유리 투과·실시간 통행 제한은 반영하지 않습니다.']}));
 }};
}
