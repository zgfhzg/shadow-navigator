import test from 'node:test';
import assert from 'node:assert/strict';
import {coordinate,geocode} from './providers.mjs';
import {DepartureClock,localDeparture,arrivalLabel} from './dist/time.mjs';
import {server} from './server.mjs';
test('Hong Kong and Japan preserve instant across region and date changes',()=>{
  const now=new Date('2026-10-14T15:30:00Z');
  const c=new DepartureClock(now,'Asia/Hong_Kong');assert.equal(c.minutes,1410);assert.equal(c.date,'2026-10-14');
  c.setZone('Asia/Tokyo',now);assert.equal(c.date,'2026-10-15');assert.equal(c.minutes,30);assert.equal(c.epoch,now.getTime());
  c.select('2026-10-15',30);c.setZone('Asia/Hong_Kong');assert.equal(c.date,'2026-10-14');assert.equal(c.minutes,1410);assert.equal(c.live,false);
  assert.equal(arrivalLabel(now.getTime(),40,'Asia/Hong_Kong'),'10/15 00:10');
  assert.throws(()=>localDeparture('2026-03-08',150,'America/New_York'),RangeError);
  assert.equal(localDeparture('2026-11-01',90,'America/New_York').toISOString(),'2026-11-01T05:30:00.000Z');
});
test('geocoder handles Unicode and never leaks upstream key on error',async()=>{
  await geocode('東京駅','tokyo','secret',async url=>{assert(decodeURIComponent(url.pathname).includes('東京駅'));return {ok:true,json:async()=>({features:[]})};});
  await assert.rejects(()=>geocode('東京駅','tokyo','secret',async()=>({ok:false,status:401})),e=>!e.message.includes('secret'));
  await assert.rejects(()=>geocode('東京駅','tokyo',''),/키/);
});
test('HTTP server serves static files, missing buildings and invalid routes safely',async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  try{
    const page=await fetch(base+'/');assert.equal(page.status,200);assert((await page.text()).includes('출발지 검색'));
    assert.equal((await fetch(base+'/.env')).status,404);
    const mapConfig=await (await fetch(base+'/map-config.json')).json();assert.equal(typeof mapConfig.mapKey,'string');assert.equal(mapConfig.mapStyle,process.env.MAPTILER_STYLE||'streets-v4');
    assert.equal((await fetch(base+'/api/buildings?city=unknown')).status,400);
    assert.equal((await fetch(base+'/api/route?start=invalid')).status,400);
    const config=await (await fetch(base+'/api/config')).json();assert(!('routingKey' in config));assert.equal(config.cities.hongkong.zone,'Asia/Hong_Kong');
  }finally{await new Promise(resolve=>server.close(resolve));}
});
