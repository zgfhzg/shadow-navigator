import {readFile,stat} from 'node:fs/promises';
import {prepareGraph} from './engine.mjs';
import {loadScene} from './building-store.mjs';
import {solveDirections,graphNetwork} from './service.mjs';
const supported=new Set(['hongkong','tokyo','osaka','kyoto']),cache=new Map();
export async function loadGraph(city) {
  if(!supported.has(city))throw new Error('지원 도시를 선택해 주세요.');
  const path=new URL(`../data/${city}.graph.json`,import.meta.url);
  let info;try{info=await stat(path);}catch{throw new Error('이 도시의 도로망이 아직 없습니다. 먼저 도로 데이터를 가져와 주세요.');}
  if(cache.get(city)?.mtime===info.mtimeMs)return cache.get(city).graph;
  const graph=prepareGraph(JSON.parse(await readFile(path,'utf8')));cache.set(city,{mtime:info.mtimeMs,graph});return graph;
}
export async function localDirections(options) {
  const graph=await loadGraph(options.city);let scene,sceneError;
  if(options.withShade!==false){try{scene=await loadScene(options.city);}catch(error){sceneError=error.message;}}
  return solveDirections(graph,scene,options,sceneError);
}
export async function network(city) {return graphNetwork(await loadGraph(city),city);}
