import {readFile,stat} from 'node:fs/promises';
import {createScene} from './shade.mjs';
const cache=new Map(),supported=new Set(['hongkong','tokyo','osaka','kyoto']);
export async function loadScene(city){
  if(!supported.has(city))throw new Error('지원 도시를 선택해 주세요.');
  const file=new URL(`../data/${city}.geojson`,import.meta.url);let info;
  try{info=await stat(file);}catch{throw new Error('건물 데이터가 없습니다. 먼저 건물 데이터를 가져와 주세요.');}
  if(cache.get(city)?.mtime===info.mtimeMs)return cache.get(city).scene;
  const scene=createScene(JSON.parse(await readFile(file,'utf8')));cache.set(city,{mtime:info.mtimeMs,scene});return scene;
}
