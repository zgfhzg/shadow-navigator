import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('./dist/app.mjs',import.meta.url),'utf8');
const handler=source.slice(source.indexOf('let locationSelection=0;'),source.indexOf("for(const id of ['origin','destination'])$('current-'+id)"));
function fixture(getCurrentPosition){
 const elements=new Map();const element=id=>{if(!elements.has(id))elements.set(id,{textContent:'',disabled:false});return elements.get(id);};
 const state={country:'hongkong',mode:'walk',available:{hongkong:true},origin:{label:'original start'},destination:{label:'original end'}};
 const selected=[];const shown=[];
 const context=vm.createContext({state,selectionVersion:0,$:element,translate:value=>value,placeLabel:p=>p?.label||'',navigator:{geolocation:{getCurrentPosition}},countries:{hongkong:{}},regionAt:()=> 'hongkong',hideOptions(){},showUserPosition:p=>shown.push(p),api:async()=>({id:'real-road-node',coordinate:[114.16,22.28],distance:5}),selectPlace:async(id,p)=>{selected.push(id);state[id]=p;},watchId:1});
 vm.runInContext(handler,context);return {state,selected,shown,element,context,run:id=>context.setCurrentLocation(id)};
}
const position={coords:{longitude:114.16001,latitude:22.28001,accuracy:8},timestamp:Date.now()};
for(const id of ['origin','destination'])test(`GPS sets ${id} and preserves the other endpoint`,async()=>{
 const f=fixture(resolve=>resolve(position));const other=id==='origin'?'destination':'origin',before=f.state[other];await f.run(id);
 assert.deepEqual(f.selected,[id]);assert.equal(f.state[id].source,'gps');assert.equal(f.state[id].nodeId,'real-road-node');assert.equal(f.state[other],before);assert.equal(f.shown.length,1);assert.equal(f.element('current-'+id).disabled,false);
});
test('permission denial keeps existing endpoints and offers recovery',async()=>{
 const f=fixture((_,reject)=>reject({code:1}));const before=f.state.destination;await f.run('destination');assert.equal(f.state.destination,before);assert.equal(f.selected.length,0);assert.match(f.element('route-status').textContent,/위치 접근을 허용/);assert.equal(f.element('current-destination').disabled,false);
});
test('late GPS response does not overwrite a newer search selection',async()=>{
 let resolve;const f=fixture(r=>{resolve=r;});const pending=f.run('origin');vm.runInContext('selectionVersion++',f.context);resolve(position);await pending;assert.equal(f.selected.length,0);assert.equal(f.shown.length,0);
});
