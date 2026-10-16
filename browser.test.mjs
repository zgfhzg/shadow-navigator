import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runOperation} from './routing/browser-worker.mjs';
test('public browser engine uses the committed snapshot without a server or API key',async()=>{
  const fetcher=async url=>{
    const file=new URL(`./fixtures/public/${url.pathname.split('/').at(-1)}`,import.meta.url);
    return {ok:true,json:async()=>JSON.parse(await readFile(file,'utf8'))};
  };
  const network=await runOperation('/api/network',{city:'hongkong'},fetcher);assert(network.nodes.length>8000);
  const routes=await runOperation('/api/route',{city:'hongkong',startNode:'3334802079@ground',endNode:'14205438441@ground',departure:'2026-10-16T04:00:00Z'},fetcher);
  assert.deepEqual(routes.map(r=>r.kind),['fast','balanced','shade']);assert(Math.abs(routes[0].distance-1241.266923878328)<.001);assert(routes[0].exposure.shade>0);assert(routes[0].exposure.unknown>0);
  const night=await runOperation('/api/shade',{city:'hongkong',departure:'2026-10-16T14:00:00Z'},fetcher);assert.equal(night.features.length,0);assert(night.stats.night>0);
});
