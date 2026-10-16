import {writeFile,mkdir} from 'node:fs/promises';
import {importOSM} from '../routing/osm.mjs';
import {prepareGraph} from '../routing/engine.mjs';
const bounds=[114.151,22.278,114.166,22.286];
// One small development snapshot; this is never called by route requests.
const response=await fetch(`https://api.openstreetmap.org/api/0.6/map.json?bbox=${bounds.join(',')}`,{signal:AbortSignal.timeout(55000)});
if(!response.ok)throw new Error(`OSM 다운로드 실패: ${response.status}`);
const osm=await response.json();osm.shadowDownload={at:new Date().toISOString(),bounds};
const graph=importOSM(osm,{city:'hongkong',bounds});prepareGraph(graph);
if(!graph.edges.length)throw new Error('도로가 없거나 응답이 불완전합니다.');
await mkdir(new URL('../data/',import.meta.url),{recursive:true});
await writeFile(new URL('../data/hongkong.osm.json',import.meta.url),JSON.stringify(osm));
await writeFile(new URL('../data/hongkong.graph.json',import.meta.url),JSON.stringify(graph));
console.log(JSON.stringify({nodes:graph.nodes.length,edges:graph.edges.length,audit:graph.audit,timestamp:graph.source.timestamp,bounds},null,2));
