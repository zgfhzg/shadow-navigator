import {readFile,stat} from 'node:fs/promises';
import {prepareGraph,findRoute,snapNode} from './engine.mjs';
import {loadScene} from './building-store.mjs';
import {edgeExposure,evaluateRoute} from './shade.mjs';
const supported=new Set(['hongkong','tokyo','osaka','kyoto']),cache=new Map();
export async function loadGraph(city) {
  if(!supported.has(city))throw new Error('지원 도시를 선택해 주세요.');
  const path=new URL(`../data/${city}.graph.json`,import.meta.url);
  let info;try{info=await stat(path);}catch{throw new Error('이 도시의 도로망이 아직 없습니다. 먼저 도로 데이터를 가져와 주세요.');}
  if(cache.get(city)?.mtime===info.mtimeMs)return cache.get(city).graph;
  const graph=prepareGraph(JSON.parse(await readFile(path,'utf8')));cache.set(city,{mtime:info.mtimeMs,graph});return graph;
}
export async function localDirections({city,start,end,startNode,endNode,mode='walk',avoidSteps=false,departure=Date.now(),withShade=true}) {
  const graph=await loadGraph(city);
  let origin,destination;
  if(startNode!==undefined||endNode!==undefined){
    if(!graph.nodes.has(startNode)||!graph.nodes.has(endNode))throw new Error('도로망의 출발·도착 지점을 선택해 주세요.');
    origin={id:startNode,distance:0};destination={id:endNode,distance:0};
  }else{origin=snapNode(graph,start,mode);destination=snapNode(graph,end,mode);}
  const epoch=typeof departure==='number'?departure:Date.parse(departure);
  if(!Number.isFinite(epoch)||Math.abs(epoch)>8640000000000000)throw new Error('출발 시각은 UTC 또는 오프셋을 포함한 ISO 날짜로 입력해 주세요.');
  if(typeof departure==='string'&&!/(Z|[+-]\d{2}:\d{2})$/i.test(departure))throw new Error('출발 시각의 시간대가 필요합니다.');
  let scene,sceneError;
  if(withShade){try{scene=await loadScene(city);}catch(error){sceneError=error.message;}}
  const baseOptions={start:origin.id,end:destination.id,mode,avoidSteps};
  const fast=findRoute(graph,baseOptions);
  const attach=r=>({...r,snapping:{start:origin,end:destination},warnings:[...r.warnings,...(origin.distance||destination.distance?['선택 좌표에서 가까운 지상 도로 노드까지의 연결은 검증되지 않았으며 거리·시간에 포함하지 않습니다.']:[])]});
  if(!scene)return [attach({...fast,kind:'fast',departure:epoch,shadeAvailable:false,warnings:[...fast.warnings,...(sceneError?[sceneError]:[])]})];
  const cache=new Map();
  const exposures=(edge,elapsed)=>{
    const key=`${edge.id}:${Math.floor((epoch+elapsed*60000)/60000)}`;
    if(!cache.has(key))cache.set(key,edgeExposure(scene,graph,edge,epoch+elapsed*60000,mode));return cache.get(key);
  };
  const results=[{...fast,kind:'fast'}];
  for(const [kind,weight]of [['balanced',1],['shade',3]])results.push({...findRoute(graph,{...baseOptions,costForEdge:(edge,elapsed,minutes)=>{const e=exposures(edge,elapsed);return minutes+weight*(e.sun+e.unknown);}}),kind});
  return results.map(route=>attach({...evaluateRoute(scene,graph,route,epoch,mode),shadeAvailable:true,buildingStats:scene.stats,buildingSource:scene.source,algorithm:'single-label time-dependent approximation',warnings:[...route.warnings,'가장 좋은 그늘 경로의 전역 최적성을 보장하지 않는 근사 탐색입니다.','건물 높이는 입력 자료 기준입니다. 평탄한 지면·불투명 건물·500m 탐색 반경을 가정하며 지형·가로수·구름·유리 투과는 미반영입니다.','높이 미상 건물·층 높이 미상 통로·덮인 통로·범위 밖은 평가 불가로 표시하고 탐색 시 햇빛 노출과 같은 비용을 줍니다.']}));
}
export async function network(city) {
  const graph=await loadGraph(city);
  const degree=new Map();for(const e of graph.data.edges)degree.set(e.from,(degree.get(e.from)||0)+1);
  return {city,source:graph.data.source,audit:graph.data.audit,bounds:graph.data.bounds,warnings:graph.data.warnings,
    nodes:graph.data.nodes.filter(n=>degree.has(n.id)),
    roads:{type:'FeatureCollection',features:graph.data.edges.map(e=>({type:'Feature',properties:{id:e.id,kind:e.kind,level:graph.nodes.get(e.from).level},geometry:{type:'LineString',coordinates:[graph.nodes.get(e.from).coordinate,graph.nodes.get(e.to).coordinate]}}))}};
}
