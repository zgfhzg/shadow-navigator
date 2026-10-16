import {prepareGraph} from './engine.mjs';
import {createScene,sampleGround} from './shade.mjs';
import {solveDirections,graphNetwork} from './service.mjs';
let loaded;
export async function runOperation(path,params={},fetcher=fetch){
  if(params.city&&params.city!=='hongkong')throw new Error('현재 공개 체험은 홍콩 센트럴 시범 구역을 지원합니다.');
  if(!loaded)loaded=Promise.all(['hongkong.graph.json','hongkong.geojson'].map(async name=>{
    const response=await fetcher(new URL(`../data/${name}`,import.meta.url));if(!response.ok)throw new Error('체험 데이터를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.');return response.json();
  })).then(([graph,buildings])=>({graph:prepareGraph(graph),scene:createScene(buildings)})).catch(error=>{loaded=undefined;throw error;});
  const {graph,scene}=await loaded;
  if(path==='/api/network')return graphNetwork(graph,'hongkong');
  if(path==='/api/shade')return sampleGround(scene,graph.data.bounds,params.departure?Date.parse(params.departure):Date.now());
  if(path==='/api/route')return solveDirections(graph,scene,{startNode:params.startNode,endNode:params.endNode,mode:params.mode||'walk',avoidSteps:params.avoidSteps===true||params.avoidSteps==='true',departure:params.departure||Date.now()});
  throw new Error('지원하지 않는 체험 요청입니다.');
}
if(typeof self!=='undefined'&&typeof self.postMessage==='function')self.onmessage=async event=>{
  const {id,path,params}=event.data;
  try{self.postMessage({id,result:await runOperation(path,params)});}catch(error){self.postMessage({id,error:error.message});}
};
