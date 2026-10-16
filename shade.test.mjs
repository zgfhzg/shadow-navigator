import test from 'node:test';
import assert from 'node:assert/strict';
import {createScene,classifyPoint,rayIntervals,edgeExposure,evaluateRoute} from './routing/shade.mjs';
import {prepareGraph,findRoute} from './routing/engine.mjs';
const unit=1/(6371008.8*Math.PI/180),ll=([x,y])=>[x*unit,y*unit];
const ring=(x0,y0,x1,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1],[x0,y0]].map(ll);
const feature=(rings,properties={height:20})=>({type:'Feature',properties,geometry:{type:'Polygon',coordinates:rings}});
const scene=(...features)=>createScene({type:'FeatureCollection',features,shadow:{bounds:[-.02,-.02,.02,.02]}});
const east={east:Math.SQRT1_2,north:0,up:Math.SQRT1_2,altitude:45},west={...east,east:-Math.SQRT1_2};
const point=(s,p,options={})=>classifyPoint(s,ll(p),0,{solar:east,...options});
test('ray casting matches analytic wall shadow length and direction',()=>{
  const s=scene(feature([ring(10,-10,20,10)]));
  assert.equal(point(s,[0,0]),'shade');assert.equal(point(s,[-15,0]),'sun');assert.equal(point(s,[0,30]),'sun');assert.equal(point(s,[0,0],{solar:west}),'sun');
  assert.equal(point(s,[0,0],{height:25}),'sun');
});
test('floating structure respects minimum height and vertical extent',()=>{
  const s=scene(feature([ring(2,-10,4,10)],{height:10,min_height:7}));
  assert.equal(point(s,[0,0]),'sun');assert.equal(point(s,[-6,0]),'shade');assert.equal(point(s,[-6,0],{height:20}),'sun');
});
test('courtyard holes and disjoint multipolygons are preserved',()=>{
  const s=scene(feature([ring(-10,-10,10,10),ring(-5,-5,5,5)]));
  assert.equal(point(s,[0,0],{solar:{east:0,north:0,up:1,altitude:90}}),'sun');
  assert.equal(point(s,[7,0],{solar:{east:0,north:0,up:1,altitude:90}}),'shade');
  const m=createScene({type:'FeatureCollection',shadow:{bounds:[-.02,-.02,.02,.02]},features:[{type:'Feature',properties:{height:20},geometry:{type:'MultiPolygon',coordinates:[[ring(10,-10,20,10)],[ring(10,30,20,40)]]}}]});
  assert.equal(point(m,[0,20]),'sun');assert.equal(point(m,[0,35]),'shade');
  assert.deepEqual(rayIntervals([0,0],[1,0],[[[10,-1],[20,-1],[20,1],[10,1],[10,-1]]],50),[[10,20]]);
});
test('missing height, multipart parents and invalid geometry cannot become sunny certainty',()=>{
  assert.equal(point(scene(feature([ring(10,-10,20,10)],{})),[0,0]),'unknown');
  assert.equal(point(scene(feature([ring(10,-10,20,10)],{height:20,has_parts:true})),[0,0]),'unknown');
  assert.equal(point(scene(feature([ring(10,-10,20,10)],{height:20,min_floor:2})),[0,0]),'unknown');
  const known=feature([ring(10,-10,20,10)]),unknown=feature([ring(30,-10,40,10)],{});
  assert.equal(point(scene(unknown,known),[0,0]),'shade');
  const bad={type:'Feature',properties:{height:20},geometry:{type:'Point',coordinates:[0,0]}};
  assert.equal(point(scene(bad),[0,0]),'unknown');
});
test('night is separate from shade; low sun and coverage boundary remain uncertain',()=>{
  const s=scene();assert.equal(point(s,[0,0],{solar:{east:1,north:0,up:-.1,altitude:-5}}),'night');
  assert.equal(point(s,[0,0],{solar:{east:1,north:0,up:.01,altitude:1}}),'unknown');
  assert.equal(point(s,[2100,0]),'unknown');assert.equal(point(s,[0,0],{height:null}),'unknown');
});
function network(level='ground',covered=false){return prepareGraph({version:1,nodes:[{id:'a',coordinate:ll([0,0]),level},{id:'b',coordinate:ll([10,0]),level}],edges:[{id:'e',from:'a',to:'b',modes:['walk'],distance:10,covered,kind:'road'}]});}
test('elevated and covered paths are uncertain without measured height/material',()=>{
  const s=scene();s.sun=()=>east;
  for(const [level,covered]of [['floor:1',false],['layer:1',false],['ground',true]]){
    const g=network(level,covered),e=edgeExposure(s,g,g.data.edges[0],0);assert.equal(e.unknown,10/75);assert.equal(e.shade,0);
  }
});
test('samples use segment passage time across sunset and exposure totals equal elapsed time',()=>{
  const s=scene();s.sun=epoch=>epoch>=4000?{east:1,north:0,up:-1,altitude:-45}:east;
  const g=network(),r=findRoute(g,{start:'a',end:'b'}),evaluated=evaluateRoute(s,g,r,0,'walk');
  assert(evaluated.exposure.sun>0);assert(evaluated.exposure.night>0);
  const e=evaluated.exposure;assert(Math.abs(e.sun+e.shade+e.unknown+e.night-r.duration)<1e-10);
});
test('weighted search preserves actual duration separately from exposure cost',()=>{
  const g=prepareGraph({version:1,nodes:['a','b','c'].map((id,i)=>({id,coordinate:ll([i,0]),level:'ground'})),edges:[
    {id:'direct',from:'a',to:'c',modes:['walk'],distance:10,duration:1},
    {id:'s1',from:'a',to:'b',modes:['walk'],distance:10,duration:.75},
    {id:'s2',from:'b',to:'c',modes:['walk'],distance:10,duration:.75}]});
  const fast=findRoute(g,{start:'a',end:'c'}),shade=findRoute(g,{start:'a',end:'c',costForEdge:(e,elapsed,m)=>{assert(Number.isFinite(elapsed));return m+(e.id==='direct'?3:0);}});
  assert.equal(fast.duration,1);assert.equal(shade.duration,1.5);assert.deepEqual(shade.nodes,['a','b','c']);
  assert.throws(()=>findRoute(g,{start:'a',end:'c',costForEdge:()=>-1}),/비용/);
});

test('ground sample map reports spacing and keeps night separate from shade',async()=>{
  const {sampleGround}=await import('./routing/shade.mjs'),s=scene();s.sun=()=>({east:1,north:0,up:-1,altitude:-45});
  const sample=sampleGround(s,[0,0,100*unit,100*unit],0,30);assert.equal(sample.spacing,30);assert.equal(sample.features.length,0);assert.equal(sample.stats.night,16);
  assert.throws(()=>sampleGround(s,[-10,-10,10,10],0),/범위/);
});
