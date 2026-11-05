import test from 'node:test';
import assert from 'node:assert/strict';
import {shadeSurface} from './dist/shade-surface.mjs';
import {createScene,sampleGround} from './routing/shade.mjs';
const snapshot=(values,columns,rows)=>({spacing:30,grid:{columns,rows,origin:[114,22],step:[.001,.001],bounds:[114,22,114+columns*.001,22+rows*.001],values}});
function inside(point,ring){let result=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])result=!result;}return result;}
test('adjacent shade samples form one filled area rather than many circles',()=>{
 const surface=shadeSurface(snapshot(Array(12).fill(1),4,3));
 assert.equal(surface.features.length,1);assert.equal(surface.features[0].geometry.type,'MultiPolygon');
 assert.equal(surface.features[0].geometry.coordinates.length,1);
 assert.equal(surface.features[0].geometry.coordinates[0].length,1);
});
test('sunny or unassessed gaps stay holes; distant patches remain separate',()=>{
 const hole=shadeSurface(snapshot([1,1,1,1,0,1,1,1,1],3,3)).features[0].geometry.coordinates[0];
 assert.equal(hole.length,2);
 assert.equal(hole.filter(ring=>inside([114.0015,22.0015],ring)).length%2,0);
 const separate=shadeSurface(snapshot([1,0,0,0,1],5,1));
 assert.equal(separate.features[0].geometry.coordinates.length,2);
 const gaps=shadeSurface(snapshot([0,NaN,-1,undefined],2,2));assert.equal(gaps.features.length,0);
});
test('rendered areas stay within sampled bounds and empty or invalid grids disappear',()=>{
 const input=snapshot([1],1,1);input.grid.bounds=[114,22,114.0006,22.0006];
 for(const polygon of shadeSurface(input).features[0].geometry.coordinates)for(const ring of polygon)for(const [x,y]of ring){assert(x>=114&&x<=114.0006);assert(y>=22&&y<=22.0006);}
 for(const value of [{},snapshot([],1,1),snapshot([0],1,1)])assert.deepEqual(shadeSurface(value).features,[]);
});
test('sampling grid has exactly the same shaded cells as the original solar samples',()=>{
 const scene=createScene({type:'FeatureCollection',features:[],shadow:{bounds:[114,22,114.01,22.01]}});
 const result=sampleGround(scene,[114.002,22.002,114.004,22.004],Date.parse('2026-11-05T04:00:00Z'),30);
 assert.equal(result.grid.values.length,result.grid.columns*result.grid.rows);
 assert.equal(result.grid.values.filter(v=>v===1).length,result.features.length);
 assert.equal(result.grid.values.filter(v=>v===1).length,result.stats.shade);
});
