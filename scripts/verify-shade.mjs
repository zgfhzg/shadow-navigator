import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {server} from '../server.mjs';
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
try{
  const params={city:'hongkong',startNode:'3334802079@ground',endNode:'14205438441@ground',mode:'walk'};
  const summaries=[];
  for(const departure of ['2026-10-16T04:00:00Z','2026-10-16T10:00:00Z','2026-10-16T14:00:00Z']){
    const started=performance.now(),response=await fetch(base+'/api/route?'+new URLSearchParams({...params,departure}));assert.equal(response.status,200);
    const routes=await response.json();assert.deepEqual(routes.map(r=>r.kind),['fast','balanced','shade']);
    for(const r of routes){assert(r.shadeAvailable);const e=r.exposure;assert(Math.abs(e.sun+e.shade+e.unknown+e.night-r.duration)<1e-7);assert(e.assessedFraction>=0&&e.assessedFraction<=1+1e-10);assert.equal(r.departure,Date.parse(departure));}
    if(departure.includes('14:00'))for(const r of routes){assert.equal(r.exposure.sun,0);assert.equal(r.exposure.shade,0);assert(Math.abs(r.exposure.night-r.duration)<1e-7);}
    const snapshot=await(await fetch(base+'/api/shade?'+new URLSearchParams({city:'hongkong',departure}))).json();assert.equal(snapshot.type,'FeatureCollection');assert.equal(snapshot.spacing,30);
    summaries.push({departure,elapsedMs:Math.round(performance.now()-started),snapshot:{stats:snapshot.stats,spacing:snapshot.spacing},routes:routes.map(r=>({kind:r.kind,distance:r.distance,duration:r.duration,exposure:r.exposure}))});
  }
  assert(summaries[0].routes[0].exposure.shade>0);
  assert.equal((await fetch(base+'/api/route?'+new URLSearchParams({...params,departure:'2026-10-16T12:00'}))).status,400);
  assert.equal((await fetch(base+'/api/shade?city=hongkong&departure=invalid')).status,400);
  const buildings=await(await fetch(base+'/api/buildings?city=hongkong')).json();assert(buildings.shadow.release);assert(buildings.features.length>0);
  const report={verifiedAt:new Date().toISOString(),buildingSource:buildings.shadow,scope:'Prototype estimates on supplied buildings; not a field accuracy validation',summaries};
  await writeFile(new URL('../data/hongkong-shade-verification.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await new Promise(resolve=>server.close(resolve));}
