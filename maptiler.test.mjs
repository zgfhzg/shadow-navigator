import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanConfig,readMapConfig,mapAvailable,tileOptions,searchMapTiler,connectPlace} from './dist/maptiler.mjs';
import {regions} from './dist/regions.mjs';
test('MapTiler config supports keyless fallback and rejects invalid injected config',async()=>{
 assert.equal(tileOptions({}).url,'https://tile.openstreetmap.org/{z}/{x}/{y}.png');
 const configured=tileOptions({mapKey:'test-key',mapStyle:'streets-v4'});
 assert(configured.url.startsWith('https://api.maptiler.com/maps/streets-v4/256/'));assert(configured.attribution.includes('MapTiler'));assert.equal(configured.crossOrigin,true);
 assert.deepEqual(cleanConfig({mapKey:'<bad>',mapStyle:'../../elsewhere'}),{mapKey:'',mapStyle:'streets-v4'});
 assert.equal((await readMapConfig(async()=>{throw new Error('offline');})).mapKey,'');
 assert.equal((await readMapConfig(async()=>({ok:true,json:async()=>({mapKey:'test-key'})}))).mapKey,'test-key');
});
test('country-wide Unicode search is filtered by country without a pilot bounding box',async()=>{
 for(const [country,iso] of [['japan','jp'],['hongkong','hk']]){
  const items=await searchMapTiler('福岡駅',{key:'test-key',country,proximity:[130.42,33.59]},async url=>{
   assert(decodeURIComponent(url.pathname).includes('福岡駅'));assert.equal(url.searchParams.get('country'),iso);assert.equal(url.searchParams.get('proximity'),'130.42,33.59');assert.equal(url.searchParams.get('language'),'ko');assert.equal(url.searchParams.has('bbox'),false);
   return {ok:true,json:async()=>({features:[{place_name:'후쿠오카역',center:[130.42,33.59],place_type:['poi']},{center:[999,0]},null]})};
  });assert.equal(items.length,1);assert.deepEqual(items[0].coordinate,[130.42,33.59]);
 }
});
test('broad geocoder regions move the map rather than become an arbitrary road endpoint',async()=>{
 const items=await searchMapTiler('福岡',{key:'test-key',country:'japan'},async()=>({ok:true,json:async()=>({features:[{text:'Fukuoka',center:[130.42,33.59],place_type:['place'],bbox:[130.3,33.5,130.6,33.7]}]})}));
 assert.equal(items[0].type,'area');assert.deepEqual(items[0].bbox,[130.3,33.5,130.6,33.7]);
});
test('provider failures and network errors never expose a key or upstream payload',async()=>{
 for(const status of [401,403,429,500])await assert.rejects(()=>searchMapTiler('Tokyo',{key:'test-key',country:'japan'},async()=>({ok:false,status,json:async()=>({error:'test-key'})})),error=>!error.message.includes('test-key'));
 await assert.rejects(()=>searchMapTiler('Tokyo',{key:'test-key',country:'japan'},async()=>{throw new Error('https://api.maptiler.com?key=test-key');}),error=>!error.message.includes('test-key'));
 await assert.rejects(()=>searchMapTiler('T',{key:'test-key',country:'japan'},()=>{throw new Error('must not request');}),/검색어/);
 const abort=new DOMException('cancelled','AbortError');await assert.rejects(()=>searchMapTiler('Tokyo',{key:'test-key',country:'japan'},async()=>{throw abort;}),error=>error===abort);
});
test('global places outside pilot coverage never acquire invented routing nodes',async()=>{
 let calls=0;const snap=async()=>{calls++;throw new Error('must not snap');};
 const place=await connectPlace({label:'Fukuoka',coordinate:[130.42,33.59]},{country:'japan',available:{},mode:'walk',snap});
 assert.equal(place.nodeId,null);assert.equal(place.supported,false);assert.equal(calls,0);assert.deepEqual(place.coordinate,[130.42,33.59]);
});
test('inside-coverage places use real snapped nodes and preserve the original place coordinates',async()=>{
 const coordinate=regions.tokyo.center;
 const result=await connectPlace({label:'Tokyo Station',coordinate},{country:'japan',available:{tokyo:true},mode:'bike',snap:async(city,point,mode)=>{assert.equal(city,'tokyo');assert.equal(mode,'bike');assert.deepEqual(point,coordinate);return {id:'actual-node@ground',coordinate:[139.7672,35.6813],distance:15};}});
 assert.equal(result.nodeId,'actual-node@ground');assert.equal(result.supported,true);assert.deepEqual(result.placeCoordinate,coordinate);assert.notDeepEqual(result.coordinate,coordinate);
 const failed=await connectPlace({coordinate},{country:'japan',available:{tokyo:true},mode:'walk',snap:async()=>{throw new Error('no nearby path');}});assert.equal(failed.nodeId,null);assert.equal(failed.supported,false);
});

test('map metadata preflight avoids showing provider invalid-key placeholder tiles',async()=>{
 assert.equal(await mapAvailable({},()=>{throw new Error('no request without key');}),false);
 assert.equal(await mapAvailable({mapKey:'test-key'},async()=>({ok:false,status:403})),false);
 assert.equal(await mapAvailable({mapKey:'test-key'},async()=>({ok:true,json:async()=>({error:'denied'})})),false);
 assert.equal(await mapAvailable({mapKey:'test-key'},async url=>{assert(url.pathname.endsWith('/256/tiles.json'));return {ok:true,json:async()=>({tiles:['https://api.maptiler.com/example']})};}),true);
});
