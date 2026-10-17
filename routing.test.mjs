import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareGraph,findRoute,snapNode,distance} from './routing/engine.mjs';
import {importOSM} from './routing/osm.mjs';
const node=(id,x,y,tags={})=>({type:'node',id,lon:114+x/1000,lat:22+y/1000,tags});
const way=(id,nodes,tags={})=>({type:'way',id,nodes,tags:{highway:'footway',...tags}});
const graph=(...elements)=>prepareGraph(importOSM({elements}));
const route=(g,a,b,options={})=>findRoute(g,{start:a,end:b,...options});
test('real geographic distance and fastest route respect connected graph',()=>{
  const g=graph(node(1,0,0),node(2,1,0),node(3,2,0),node(4,1,2),way(10,[1,2,3]),way(11,[1,4,3]));
  const r=route(g,'1@ground','3@ground');assert.deepEqual(r.nodes,['1@ground','2@ground','3@ground']);assert(r.distance>200&&r.distance<210);assert(Math.abs(r.duration-r.distance/75)<1e-10);
  assert.equal(route(g,'1@ground','1@ground').duration,0);
  assert(Math.abs(distance([0,0],[0,1])-111195)<1);
});
test('overlapping geometry never creates a junction',()=>{
  const g=graph(node(1,0,0),node(2,2,0),node(3,1,-1),node(4,1,1),way(10,[1,2]),way(11,[3,4],{bridge:'yes',layer:'1'}));
  assert.throws(()=>route(g,'1@ground','4@layer:1'),/연결된 경로/);
});
test('same OSM node on separate floors remains disconnected without stairs',()=>{
  const g=graph(node(1,0,0),node(2,1,0),node(3,2,0),way(10,[1,2],{level:'0'}),way(11,[2,3],{level:'1',indoor:'yes'}));
  assert.throws(()=>route(g,'1@ground','3@floor:1'),/연결된 경로/);
});
test('explicit stair and elevator connections allow floor changes',()=>{
  const elements=[node(1,0,0),node(2,1,0),node(3,1,0),node(4,2,0),way(10,[1,2],{level:'0'}),way(11,[3,4],{level:'1',bridge:'yes'}),way(12,[2,3],{highway:'steps',level:'0;1'})];
  const stairs=graph(...elements);assert(route(stairs,'1@ground','4@floor:1').segments.some(e=>e.kind==='steps'));
  assert.throws(()=>route(stairs,'1@ground','4@floor:1',{avoidSteps:true}),/연결된 경로/);
  const lift=graph(...elements.filter(e=>e.id!==12),way(12,[2,3],{highway:'elevator',level:'0;1'}));
  assert(route(lift,'1@ground','4@floor:1',{avoidSteps:true}).segments.some(e=>e.kind==='elevator'));
});
test('lift node connects explicit floors while snapping remains on ground',()=>{
  const g=graph(node(1,0,0),node(2,1,0,{highway:'elevator',level:'0;1'}),node(3,2,0),way(10,[1,2],{level:'0'}),way(11,[2,3],{level:'1'}));
  assert(route(g,'1@ground','3@floor:1').segments.some(e=>e.kind==='elevator'));
  assert.equal(snapNode(g,[114.001,22]).id,'2@ground');assert.throws(()=>snapNode(g,[120,30]),/50m/);
});
test('private access, barriers and conditional access cannot become shortcuts',()=>{
  for(const tags of [{motorroad:'yes'},{access:'private'},{foot:'no'},{'access:conditional':'yes @ (09:00-17:00)'},{highway:'steps',conveying:'forward'}]){
    const g=graph(node(1,0,0),node(2,1,0),way(10,[1,2],tags));assert.equal(g.data.edges.length,0);
  }
  const g=graph(node(1,0,0),node(2,1,0,{barrier:'gate',access:'private'}),node(3,2,0),way(10,[1,2,3]));assert.equal(g.data.edges.length,0);
});
test('cycling obeys one-way and requires explicit permission on footpaths',()=>{
  const g=graph(node(1,0,0),node(2,1,0),way(10,[1,2],{highway:'residential',oneway:'yes'}));
  assert(route(g,'1@ground','2@ground',{mode:'bike'}).distance>0);
  assert.throws(()=>route(g,'2@ground','1@ground',{mode:'bike'}),/연결된 경로/);
  assert(route(g,'2@ground','1@ground').distance>0);
  const p=graph(node(1,0,0),node(2,1,0),way(10,[1,2]));assert.throws(()=>route(p,'1@ground','2@ground',{mode:'bike'}),/연결된 경로/);
  const dismount=graph(node(1,0,0),node(2,1,0),way(10,[1,2],{bicycle:'dismount'}));assert.throws(()=>route(dismount,'1@ground','2@ground',{mode:'bike'}),/연결된 경로/);
});
test('partial imports do not bridge gaps; multi-floor corridors are flagged',()=>{
  const g=graph(node(1,0,0),node(3,2,0),way(10,[1,2,3]),way(11,[1,3],{level:'0;1',indoor:'yes'}));
  assert.equal(g.data.edges.length,0);assert.equal(g.data.audit.missingNodeWays,1);assert.equal(g.data.audit.ambiguousLevels,1);
  assert.throws(()=>importOSM({elements:[],remark:'timeout'}),/不|불완전/);
});
test('Dijkstra matches an independent relaxation solver across random directed graphs',()=>{
  let seed=51;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32;};
  for(let trial=0;trial<30;trial++){
    const nodes=Array.from({length:12},(_,i)=>({id:String(i),coordinate:[114+i*.001,22],level:'ground'}));
    const edges=[];for(let a=0;a<12;a++)for(let b=0;b<12;b++)if(a!==b&&random()<.2)edges.push({id:String(edges.length),from:String(a),to:String(b),modes:['walk'],distance:1,duration:1+Math.floor(random()*20)});
    const g=prepareGraph({version:1,nodes,edges}),costs=Array(12).fill(Infinity);costs[0]=0;
    for(let pass=0;pass<11;pass++)for(const e of edges)costs[+e.to]=Math.min(costs[+e.to],costs[+e.from]+e.duration);
    for(let end=0;end<12;end++){if(Number.isFinite(costs[end]))assert.equal(route(g,'0',String(end)).duration,costs[end]);else assert.throws(()=>route(g,'0',String(end)),/연결된 경로/);}
  }
});

test('unordered level lists use endpoint connections rather than inventing direction',()=>{
  const g=graph(node(1,0,0),node(2,1,0),node(3,1,0),node(4,2,0),way(10,[1,2],{level:'1'}),way(11,[3,4],{level:'0'}),way(12,[2,3],{highway:'steps',level:'0;1'}));
  const r=route(g,'1@floor:1','4@ground');assert(r.duration>=.35);assert(r.segments.some(e=>e.from==='2@floor:1'&&e.to==='3@ground'));
  const unknown=graph(node(2,1,0),node(3,1,0),way(12,[2,3],{highway:'steps',level:'0;1'}));assert.equal(unknown.data.edges.length,0);assert.equal(unknown.data.audit.ambiguousLevels,1);
});

test('structural endpoints connect shared OSM bridge approaches without inventing floor or crossing links',()=>{
 const elements=[node(1,0,0),node(2,1,0),node(3,2,0),node(4,3,0),node(5,2,1),way(10,[1,2]),way(11,[2,3],{bridge:'yes',layer:'1'}),way(12,[3,4]),way(13,[3,5],{level:'1',indoor:'yes'})];
 const g=prepareGraph(importOSM({elements},{connectStructuralEndpoints:true}));
 assert(route(g,'1@ground','4@ground').segments.some(e=>e.kind==='bridge'));assert.equal(g.data.audit.structuralConnections,2);
 assert.throws(()=>route(g,'1@ground','5@floor:1'),/연결된 경로/);
 const crossing=prepareGraph(importOSM({elements:[node(1,0,0),node(2,2,0),node(3,1,-1),node(4,1,1),way(10,[1,2]),way(11,[3,4],{bridge:'yes',layer:'1'})]},{connectStructuralEndpoints:true}));assert.throws(()=>route(crossing,'1@ground','4@layer:1'),/연결된 경로/);
});
