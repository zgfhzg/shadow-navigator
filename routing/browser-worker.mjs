import {prepareGraph,snapNode} from './engine.mjs';
import {createScene,sampleGround} from './shade.mjs';
import {solveDirections,graphNetwork} from './service.mjs';
import {searchPlaces} from './search.mjs';
import {regions} from './regions.mjs';
const loaded=new Map();
async function loadRegion(city,fetcher){
  if(!Object.hasOwn(regions,city))throw new Error('지원하는 지역을 선택해 주세요.');
  if(!loaded.has(city))loaded.set(city,Promise.all([`${city}.graph.json`,`${city}.geojson`,`${city}.search.json`].map(async name=>{
    const response=await fetcher(new URL(`../data/${name}`,import.meta.url));if(!response.ok)throw new Error('이 지역의 자료를 준비 중입니다. 다른 지역을 선택해 주세요.');return response.json();
  })).then(([graph,buildings,index])=>({graph:prepareGraph(graph),scene:createScene(buildings),index})).catch(error=>{loaded.delete(city);throw error;}));
  return loaded.get(city);
}
export async function runOperation(path,params={},fetcher=fetch){
  if(path==='/api/regions'){const response=await fetcher(new URL('../data/catalog.json',import.meta.url));if(!response.ok)throw new Error('지역 정보를 불러오지 못했습니다.');return response.json();}
  const city=params.city||'hongkong',{graph,scene,index}=await loadRegion(city,fetcher);
  if(path==='/api/area')return {bounds:graph.data.bounds,source:graph.data.source};
  if(path==='/api/snap')return snapNode(graph,JSON.parse(params.point),params.mode||'walk');
  if(path==='/api/places')return searchPlaces(index,params.q||'',params.mode||'walk');
  if(path==='/api/network')return graphNetwork(graph,city);
  if(path==='/api/shade')return sampleGround(scene,graph.data.bounds,params.departure?Date.parse(params.departure):Date.now());
  if(path==='/api/route')return solveDirections(graph,scene,{startNode:params.startNode,endNode:params.endNode,start:params.start?JSON.parse(params.start):undefined,end:params.end?JSON.parse(params.end):undefined,mode:params.mode||'walk',avoidSteps:params.avoidSteps===true||params.avoidSteps==='true',departure:params.departure||Date.now()});
  throw new Error('지원하지 않는 요청입니다.');
}
if(typeof self!=='undefined'&&typeof self.postMessage==='function')self.onmessage=async event=>{
  const {id,path,params}=event.data;
  try{self.postMessage({id,result:await runOperation(path,params)});}catch(error){self.postMessage({id,error:error.message});}
};
