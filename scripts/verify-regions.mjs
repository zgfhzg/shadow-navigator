import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {runOperation} from '../routing/browser-worker.mjs';
import {prepareGraph,findRoute} from '../routing/engine.mjs';
import {regions} from '../routing/regions.mjs';
import {createCountryRuntime} from '../routing/country-runtime.mjs';
import {findCompact} from '../routing/compact.mjs';
const root=new URL('../fixtures/public/',import.meta.url),reports=[];
const fetcher=async url=>({ok:true,json:async()=>JSON.parse(await readFile(new URL(url.pathname.split('/').at(-1),root),'utf8'))});
for(const city of Object.keys(regions)){
  if(city==='hongkong'){
    const fullRoot=new URL('hongkong-country/',root),runtime=createCountryRuntime(fullRoot,async url=>{try{const bytes=await readFile(url);return {ok:true,json:async()=>JSON.parse(bytes.toString()),arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};}catch{return {ok:false};}}),g=await runtime.graph(),index=JSON.parse(await readFile(new URL('search.json',fullRoot),'utf8'));
    const area=await runtime.operation('/api/area');assert(area.countrywide);assert(area.bounds[0]<113.9&&area.bounds[2]>114.4);
    let sample;for(const a of index.slice(0,20)){for(const b of index.slice(0,20)){if(a.label===b.label)continue;try{const r=findCompact(g,{start:a.nodeId,end:b.nodeId});if(r.distance>100&&r.distance<3000){sample={a,b};break;}}catch{}}if(sample)break;}assert(sample);
    const routes=await runtime.operation('/api/route',{startNode:sample.a.nodeId,endNode:sample.b.nodeId,departure:'2026-10-17T04:00:00Z'});assert.equal(routes.length,3);for(const r of routes){assert.equal(r.nodes[0],sample.a.nodeId);assert.equal(r.nodes.at(-1),sample.b.nodeId);const e=r.exposure;assert(Math.abs(e.sun+e.shade+e.unknown+e.night-r.duration)<1e-6);}
    reports.push({city,area:'홍콩 전역',searchablePlaces:index.length,source:g.manifest.source,start:sample.a.label,end:sample.b.label,buildingSource:routes[0].buildingSource,buildingStats:routes[0].buildingStats,routes:routes.map(r=>({kind:r.kind,distance:r.distance,duration:r.duration,exposure:r.exposure}))});continue;
  }
  const raw=JSON.parse(await readFile(new URL(`${city}.graph.json`,root),'utf8')),graph=prepareGraph(raw),index=JSON.parse(await readFile(new URL(`${city}.search.json`,root),'utf8'));
  const area=await runOperation('/api/area',{city},fetcher);assert.deepEqual(area.bounds,regions[city].bounds);
  const places=await runOperation('/api/places',{city},fetcher);assert(places.length>1);
  let sample;
  for(const a of places){for(const b of places){if(a.label===b.label)continue;try{const r=findRoute(graph,{start:a.nodeId,end:b.nodeId});if(r.distance>100&&r.distance<3000){sample={a,b};break;}}catch{}}if(sample)break;}
  assert(sample,`${city}: connected named places required`);
  const routes=await runOperation('/api/route',{city,startNode:sample.a.nodeId,endNode:sample.b.nodeId,departure:city==='hongkong'?'2026-10-16T04:00:00Z':'2026-10-16T03:00:00Z'},fetcher);
  assert.deepEqual(routes.map(r=>r.kind),['fast','balanced','shade']);
  for(const r of routes){assert.equal(r.nodes[0],sample.a.nodeId);assert.equal(r.nodes.at(-1),sample.b.nodeId);const e=r.exposure;assert(Math.abs(e.sun+e.shade+e.unknown+e.night-r.duration)<1e-7);assert(Math.abs(r.geometry.coordinates[0][0]-regions[city].center[0])<.03);}
  reports.push({city,area:regions[city].area,searchablePlaces:index.length,source:raw.source,start:sample.a.label,end:sample.b.label,buildingSource:routes[0].buildingSource,buildingStats:routes[0].buildingStats,routes:routes.map(r=>({kind:r.kind,distance:r.distance,duration:r.duration,exposure:r.exposure}))});
}
await writeFile(new URL('../data/regions-verification.json',import.meta.url),JSON.stringify({verifiedAt:new Date().toISOString(),reports},null,2)+'\n');
console.log(reports.map(r=>({city:r.city,places:r.searchablePlaces,start:r.start,end:r.end,distance:r.routes[0].distance})));
