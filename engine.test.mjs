import test from 'node:test';import assert from 'node:assert/strict';import {route,edges,sun,shadows} from './dist/engine.mjs';
const base={start:55,end:8,date:'2026-07-15',time:840,mode:'walk',kind:'balanced'};
test('routes connect endpoints through valid roads with bounded shade',()=>{for(const mode of ['walk','bike'])for(const kind of ['fast','balanced','shade']){const r=route({...base,mode,kind});assert.equal(r.path[0],55);assert.equal(r.path.at(-1),8);assert(r.shade>=0&&r.shade<=1);assert(r.sunMinutes>=0&&r.sunMinutes<=r.minutes);for(let i=1;i<r.path.length;i++){const e=edges.find(e=>[e.a,e.b].includes(r.path[i-1])&&[e.a,e.b].includes(r.path[i]));assert(e);if(mode==='bike')assert(!e.walkOnly);}}});
test('shortest walk route has Manhattan distance and cycling is faster',()=>{const a=route({...base,kind:'fast'}),b=route({...base,kind:'fast',mode:'bike'});assert.equal(a.length,1300);assert(b.minutes<a.minutes);});
test('night has no direct sunlight or projected shadows',()=>{assert(sun(base.date,0).up<0);assert.equal(shadows(base.date,0).length,0);assert.equal(route({...base,time:0}).sunMinutes,0);});
test('time changes projected building shadows',()=>assert.notDeepEqual(shadows(base.date,540),shadows(base.date,960)));
test('same endpoint produces a zero length path',()=>{const r=route({...base,end:55});assert.deepEqual(r.path,[55]);assert.equal(r.minutes,0);});
