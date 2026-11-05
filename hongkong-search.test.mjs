import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {governmentQuery,hk80ToWgs84,governmentPlaces,searchHongKong,mergePlaceResults} from './dist/hongkong-search.mjs';
import {placeLabel,prepareLanguage} from './dist/i18n.mjs';
const fixture=JSON.parse(await readFile(new URL('./fixtures/public/hongkong-government-search.json',import.meta.url),'utf8'));
test('Hong Kong government building search finds Central Plaza in Korean, English and traditional Chinese',async()=>{
 for(const query of ['센트럴 플라자','Central Plaza','中環廣場','18 Harbour Road']){
  const places=await searchHongKong(query,{proximity:[114.1589,22.2819]},async url=>{
   assert.equal(url.origin,'https://www.map.gov.hk');
   assert.equal(url.searchParams.get('q'),governmentQuery(query));
   return {ok:true,json:async()=>fixture};
  });
  const place=places.find(p=>p.labelZH.includes('中環廣場'));
  assert(place);assert(place.labelEN.includes('18 HARBOUR ROAD'));assert.equal(place.nodeId,undefined);
  assert(Math.abs(place.coordinate[0]-114.173789)<.00002&&Math.abs(place.coordinate[1]-22.280658)<.00002);
  assert(placeLabel(place,'en').includes('Central Plaza'));await prepareLanguage('yue');assert(placeLabel(place,'yue').includes('中環廣場'));
 }
});
test('government coordinates reject invalid or non-Hong Kong values',()=>{
 for(const p of [[0,0],[NaN,815701],[835932,Infinity],['835932',815701]])assert.equal(hk80ToWgs84(...p),null);
 assert.deepEqual(governmentPlaces([{nameEN:'Invalid',nameZH:'無效',x:0,y:0}],''),[]);
 assert.throws(()=>governmentPlaces({},''),/검색 응답/);
});
test('government and local exact names survive fuzzy MapTiler matches',()=>{
 const local={label:'센트럴 플라자',coordinate:[114.173789,22.280658],terms:['Central Plaza']};
 const official=governmentPlaces(fixture,'센트럴 플라자',[114.1589,22.2819]);
 const fuzzy={label:'Central district',coordinate:[114.158,22.282]};
 const merged=mergePlaceResults(official,[local],[fuzzy]);
 assert.equal(merged[0].source,'landsd');assert(merged.some(p=>p===fuzzy));
 assert.equal(merged.filter(p=>p===local).length,0);
});
test('government failures are contained and cancellation stays cancellable',async()=>{
 await assert.rejects(()=>searchHongKong('Central Plaza',{},async()=>{throw Error('upstream URL');}),error=>!error.message.includes('upstream'));
 const abort=new DOMException('cancelled','AbortError');
 await assert.rejects(()=>searchHongKong('Central Plaza',{},async()=>{throw abort;}),error=>error===abort);
 let called=false;assert.deepEqual(await searchHongKong('',{},async()=>{called=true;}),[]);assert.equal(called,false);
});
