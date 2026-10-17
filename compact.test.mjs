import test from 'node:test';import assert from 'node:assert/strict';
import {decodeCompact,findCompact,snapCompact,routeCorridor} from './routing/compact.mjs';import {distance,prepareGraph,findRoute} from './routing/engine.mjs';import {governmentBuilding} from './routing/building-normalize.mjs';import {createScene,classifyPoint} from './routing/shade.mjs';import {createCountryRuntime,unpackGzip} from './routing/country-runtime.mjs';import {gzipSync} from 'node:zlib';
function fixture(nodes,edges){
 const n=nodes.length,sorted=[...edges].sort((a,b)=>a.from-b.from),m=sorted.length,xy=new Int32Array(n*2),levels=new Uint16Array(n),eligible=new Uint8Array(n),offsets=new Uint32Array(n+1),to=new Uint32Array(m),lengths=new Float32Array(m),flags=new Uint8Array(m),ways=new Float64Array(m),names=new Uint32Array(m),levelNames=['ground','floor:1'];
 nodes.forEach((p,i)=>{xy[i*2]=Math.round(p.coordinate[0]*1e7);xy[i*2+1]=Math.round(p.coordinate[1]*1e7);levels[i]=levelNames.indexOf(p.level||'ground');});
 sorted.forEach((e,j)=>{to[j]=e.to;lengths[j]=e.distance;flags[j]=e.flags??3;ways[j]=100+j;offsets[e.from+1]++;eligible[e.from]|=flags[j]&3;eligible[e.to]|=flags[j]&3;});for(let i=1;i<=n;i++)offsets[i]+=offsets[i-1];
 const manifest={version:2,revision:'test',nodes:n,edges:m,arrays:{},levels:levelNames,names:[''],maxSpeed:{walk:10000,bike:10000},bounds:[113,21,115,23],warnings:[],source:{name:'fixture'}};
 function pack(file,arrays){let size=0;for(const [key,a]of Object.entries(arrays)){size=Math.ceil(size/8)*8;manifest.arrays[key]={file,type:a.constructor.name,offset:size,length:a.length};size+=a.byteLength;}const b=new ArrayBuffer(size);for(const [key,a]of Object.entries(arrays))new Uint8Array(b,manifest.arrays[key].offset,a.byteLength).set(new Uint8Array(a.buffer));return b;}
 const nodeBuffer=pack('nodes',{xy,levels,eligible,offsets}),edgeBuffer=pack('edges',{to,lengths,flags,ways,names});return {manifest,nodeBuffer,edgeBuffer,g:decodeCompact(manifest,nodeBuffer,edgeBuffer)};
}
const node=(i,level='ground')=>({coordinate:[114+i*.0001,22],level});
test('compact A* matches an independent Dijkstra oracle across directed road networks',()=>{
 let seed=211;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32;};
 for(let trial=0;trial<20;trial++){const nodes=Array.from({length:10},(_,i)=>node(i)),edges=[];for(let a=0;a<10;a++)for(let b=0;b<10;b++)if(a!==b&&rand()<.2)edges.push({from:a,to:b,distance:distance(nodes[a].coordinate,nodes[b].coordinate)*(1+rand()),flags:3});const {g}=fixture(nodes,edges);const oracle=prepareGraph({version:1,nodes:nodes.map((n,i)=>({...n,id:String(i)})),edges:edges.map((e,i)=>({id:String(i),from:String(e.from),to:String(e.to),distance:e.distance,modes:['walk','bike']}))});
  for(const mode of ['walk','bike'])for(let end=0;end<10;end++){let expected;try{expected=findRoute(oracle,{start:'0',end:String(end),mode});}catch{assert.throws(()=>findCompact(g,{start:g.id(0),end:g.id(end),mode}),/연결된 경로/);continue;}const actual=findCompact(g,{start:g.id(0),end:g.id(end),mode});assert(Math.abs(actual.duration-expected.duration)<1e-5);assert.equal(actual.nodes[0],g.id(0));assert.equal(actual.nodes.at(-1),g.id(end));}
 }
});
test('compact snapping respects ground, access mode and graph revision',()=>{
 const {g}=fixture([node(0),node(1),node(2,'floor:1'),node(3)],[{from:0,to:1,distance:12,flags:1},{from:1,to:2,distance:0,flags:5}]);assert.equal(snapCompact(g,node(2).coordinate).id,g.id(1));assert.throws(()=>snapCompact(g,node(1).coordinate,'bike'),/50m/);assert.equal(g.nodes.has('hk2:old:1'),false);assert.equal(g.nodes.has('hk2:test:'),false);assert.throws(()=>snapCompact(g,[120,30]),/50m/);
});
test('compact stairs retain floor-transition time and weighted costs remain bounded',()=>{
 const {g}=fixture([node(0),node(0,'floor:1')],[{from:0,to:1,distance:0,flags:5}]);assert.equal(findCompact(g,{start:g.id(0),end:g.id(1)}).duration,.35);assert.throws(()=>findCompact(g,{start:g.id(0),end:g.id(1),costForEdge:()=>-1}),/Invalid shade cost/);assert.throws(()=>findCompact(g,{start:g.id(0),end:g.id(1),maxVisited:0}),/BUDGET/);assert(routeCorridor(findCompact(g,{start:g.id(0),end:g.id(1)})).size>0);
});
test('unloaded building tiles cannot be classified as known sunlight',()=>{
 const source={bounds:[113,21,115,23],coverageTiles:[],tileStep:.01};const scene=createScene({type:'FeatureCollection',features:[],shadow:source});assert.equal(classifyPoint(scene,[114,22],Date.parse('2026-10-17T04:00:00Z')),'unknown');
});
test('government absolute elevations become relative building extent and uncertain roofs remain unknown',()=>{
 const feature={type:'Feature',geometry:{type:'Polygon',coordinates:[[[114,22],[114.001,22],[114.001,22.001],[114,22.001],[114,22]]]},properties:{OBJECTID:7,BaseHeight:80,TopHeight:120,BuildingBlockType:'Tower'}};
 const normalized=governmentBuilding(feature);assert.equal(normalized.properties.height,40);assert.equal(normalized.properties.min_height,0);assert.equal(normalized.id,'hk-gov:7');for(const properties of [{...feature.properties,BaseHeight:null},{...feature.properties,TopHeight:70},{...feature.properties,BuildingBlockType:'Open-sided Structure'},{...feature.properties,TopHeight:99999}])assert.equal(governmentBuilding({...feature,properties}).properties.height,null);
});
test('country runtime uses compressed assets and degrades explicitly when building download fails',async()=>{
 const {manifest,nodeBuffer,edgeBuffer,g}=fixture([node(0),node(1)],[{from:0,to:1,distance:12,flags:3}]);
 const fetcher=async url=>{const name=url.pathname.split('/').at(-1);if(name==='manifest.json'&&!url.pathname.includes('/buildings/'))return {ok:true,json:async()=>manifest};const bytes=name==='nodes.bin.gz'?gzipSync(nodeBuffer):name==='edges.bin.gz'?gzipSync(edgeBuffer):null;return bytes?{ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}:{ok:false};};
 const runtime=createCountryRuntime(new URL('https://example.invalid/data/'),fetcher);const result=await runtime.operation('/api/route',{startNode:g.id(0),endNode:g.id(1),departure:'2026-10-17T04:00:00Z'});assert.equal(result.length,1);assert.equal(result[0].shadeAvailable,false);assert.equal(result[0].buildingError,true);assert.equal(result[0].kind,'fast');
});
