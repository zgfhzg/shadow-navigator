import {prepareGraph,snapNode} from './engine.mjs';
import {createScene,sampleGround} from './shade.mjs';
import {solveDirections,graphNetwork} from './service.mjs';
import {searchPlaces} from './search.mjs';
import {regions} from './regions.mjs';
import {createCountryRuntime} from './country-runtime.mjs';
const countryRuntimes=new WeakMap();
const loaded=new Map(),indexes=new Map();
async function loadIndex(city,fetcher){
 if(!Object.hasOwn(regions,city))throw new Error('지원하는 지역을 선택해 주세요.');
 if(!indexes.has(city))indexes.set(city,(async()=>{const response=await fetcher(new URL(`../data/${city}.search.json`,import.meta.url));if(!response.ok)throw new Error('장소 검색 자료를 불러오지 못했어요.');return response.json();})().catch(error=>{indexes.delete(city);throw error;}));
 return indexes.get(city);
}
async function loadRegion(city,fetcher){
  if(!Object.hasOwn(regions,city))throw new Error('지원하는 지역을 선택해 주세요.');
  if(!loaded.has(city))loaded.set(city,Promise.all([`${city}.graph.json`,`${city}.geojson`].map(async name=>{
    const response=await fetcher(new URL(`../data/${name}`,import.meta.url));if(!response.ok)throw new Error('이 지역의 자료를 준비 중입니다. 다른 지역을 선택해 주세요.');return response.json();
  }).concat(loadIndex(city,fetcher))).then(([graph,buildings,index])=>({graph:prepareGraph(graph),scene:createScene(buildings),index})).catch(error=>{loaded.delete(city);throw error;}));
  return loaded.get(city);
}
export async function runOperation(path,params={},fetcher=fetch,progress){
  if(params.city==='hongkong'&&params.coverage==='country'){if(!countryRuntimes.has(fetcher))countryRuntimes.set(fetcher,createCountryRuntime(new URL('../data/hongkong-country/',import.meta.url),fetcher));return countryRuntimes.get(fetcher).operation(path,params,progress);}
  if(path==='/api/regions'){const response=await fetcher(new URL('../data/catalog.json',import.meta.url));if(!response.ok)throw new Error('지역 정보를 불러오지 못했습니다.');return response.json();}
  const city=params.city||'hongkong';
  if(path==='/api/places')return searchPlaces(await loadIndex(city,fetcher),params.q||'',params.mode||'walk');
  const {graph,scene}=await loadRegion(city,fetcher);
  if(path==='/api/area')return {bounds:graph.data.bounds,source:graph.data.source};
  if(path==='/api/snap')return snapNode(graph,JSON.parse(params.point),params.mode||'walk');
  if(path==='/api/network')return graphNetwork(graph,city);
  if(path==='/api/shade')return sampleGround(scene,graph.data.bounds,params.departure?Date.parse(params.departure):Date.now());
  if(path==='/api/route')return solveDirections(graph,scene,{startNode:params.startNode,endNode:params.endNode,start:params.start?JSON.parse(params.start):undefined,end:params.end?JSON.parse(params.end):undefined,mode:params.mode||'walk',avoidSteps:params.avoidSteps===true||params.avoidSteps==='true',departure:params.departure||Date.now()});
  throw new Error('지원하지 않는 요청입니다.');
}
if(typeof self!=='undefined'&&typeof self.postMessage==='function')self.onmessage=async event=>{
  const {id,path,params}=event.data;
  try{self.postMessage({id,result:await runOperation(path,params,fetch,message=>self.postMessage({id,progress:message}))});}catch(error){self.postMessage({id,error:error.message});}
};
