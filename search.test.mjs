import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {searchPlaces,normalize} from './routing/search.mjs';
const index=JSON.parse(await readFile(new URL('./fixtures/public/hongkong.search.json',import.meta.url),'utf8'));
test('local place search supports Korean aliases and Unicode normalization',()=>{
  assert.equal(searchPlaces(index,'홍콩역')[0].nodeId,'12180384885@ground');
  assert.equal(searchPlaces(index,'Ｃｅｎｔｒａｌ　Ｍａｒｋｅｔ')[0].nodeId,'6853986554@ground');
  assert.equal(normalize('Hong-Kong Station'),'hongkongstation');
});
test('nearby entrances of the same place do not flood search results',()=>{
  const matches=searchPlaces(index,'Central Market');assert.equal(matches.length,1);assert(matches[0].featured);
  assert(searchPlaces(index,'', 'walk').length<=8);
  assert.deepEqual(searchPlaces(index,'nonexistent-place-847654'),[]);
});
test('search results are mapped to real graph points and respect travel mode',async()=>{
  const graph=JSON.parse(await readFile(new URL('./fixtures/public/hongkong.graph.json',import.meta.url),'utf8'));
  const nodes=new Set(graph.nodes.map(n=>n.id));assert(index.length>1000);for(const place of index)assert(nodes.has(place.nodeId));
  for(const place of searchPlaces(index,'', 'bike'))assert(place.modes.includes('bike'));
});
