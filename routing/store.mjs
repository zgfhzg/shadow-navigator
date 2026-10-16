import {readFile,stat} from 'node:fs/promises';
import {prepareGraph,findRoute,snapNode} from './engine.mjs';
const supported=new Set(['hongkong','tokyo','osaka','kyoto']),cache=new Map();
export async function loadGraph(city) {
  if(!supported.has(city))throw new Error('지원 도시를 선택해 주세요.');
  const path=new URL(`../data/${city}.graph.json`,import.meta.url);
  let info;try{info=await stat(path);}catch{throw new Error('이 도시의 도로망이 아직 없습니다. 먼저 도로 데이터를 가져와 주세요.');}
  if(cache.get(city)?.mtime===info.mtimeMs)return cache.get(city).graph;
  const graph=prepareGraph(JSON.parse(await readFile(path,'utf8')));cache.set(city,{mtime:info.mtimeMs,graph});return graph;
}
export async function localDirections({city,start,end,startNode,endNode,mode='walk',avoidSteps=false}) {
  const graph=await loadGraph(city);
  let origin,destination;
  if(startNode!==undefined||endNode!==undefined){
    if(!graph.nodes.has(startNode)||!graph.nodes.has(endNode))throw new Error('도로망의 출발·도착 지점을 선택해 주세요.');
    origin={id:startNode,distance:0};destination={id:endNode,distance:0};
  }else{origin=snapNode(graph,start,mode);destination=snapNode(graph,end,mode);}
  const route=findRoute(graph,{start:origin.id,end:destination.id,mode,avoidSteps});
  return [{...route,snapping:{start:origin,end:destination},warnings:[...route.warnings,...(origin.distance||destination.distance?['선택 좌표에서 가까운 지상 도로 노드까지의 연결은 검증되지 않았으며 거리·시간에 포함하지 않습니다.']:[])]}];
}
export async function network(city) {
  const graph=await loadGraph(city);
  const degree=new Map();for(const e of graph.data.edges)degree.set(e.from,(degree.get(e.from)||0)+1);
  return {city,source:graph.data.source,audit:graph.data.audit,bounds:graph.data.bounds,warnings:graph.data.warnings,
    nodes:graph.data.nodes.filter(n=>degree.has(n.id)),
    roads:{type:'FeatureCollection',features:graph.data.edges.map(e=>({type:'Feature',properties:{id:e.id,kind:e.kind,level:graph.nodes.get(e.from).level},geometry:{type:'LineString',coordinates:[graph.nodes.get(e.from).coordinate,graph.nodes.get(e.to).coordinate]}}))}};
}
