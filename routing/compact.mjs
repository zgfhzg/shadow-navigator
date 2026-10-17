import {distance} from './engine.mjs';
export const cellKey=(p,step=.005)=>`${Math.floor(p[0]/step)},${Math.floor(p[1]/step)}`;
const kinds=flags=>flags&4?'steps':flags&8?'elevator':flags&32?'bridge':flags&64?'indoor':'road';
export function decodeCompact(manifest,nodeBuffer,edgeBuffer){
 const arrays={};for(const [name,spec]of Object.entries(manifest.arrays)){const T=globalThis[spec.type];if(!['Int32Array','Uint32Array','Uint16Array','Uint8Array','Float32Array','Float64Array'].includes(spec.type))throw new Error('Unsupported compact graph array');arrays[name]=new T(spec.file==='nodes'?nodeBuffer:edgeBuffer,spec.offset,spec.length);}
 const g={manifest,...arrays};if(g.xy.length!==manifest.nodes*2||g.offsets.length!==manifest.nodes+1||g.to.length!==manifest.edges)throw new Error('Incomplete compact road data');
 g.id=i=>`hk2:${manifest.revision}:${i}`;
 g.index=id=>{const prefix=`hk2:${manifest.revision}:`;if(typeof id!=='string'||!id.startsWith(prefix))return -1;const raw=id.slice(prefix.length);if(!/^(0|[1-9]\d*)$/.test(raw))return -1;const i=Number(raw);return Number.isInteger(i)&&i>=0&&i<manifest.nodes?i:-1;};
 g.point=i=>[g.xy[i*2]/1e7,g.xy[i*2+1]/1e7];
 g.edge=(j,from)=>({id:`e:${j}`,from:g.id(from),to:g.id(g.to[j]),wayId:g.ways[j],name:manifest.names[g.names[j]]||'',kind:kinds(g.flags[j]),covered:!!(g.flags[j]&16),distance:g.lengths[j],modes:[...(g.flags[j]&1?['walk']:[]),...(g.flags[j]&2?['bike']:[])]});
 g.nodes={size:manifest.nodes,has:id=>g.index(id)>=0,get:id=>{const i=g.index(id);return i<0?undefined:{id,coordinate:g.point(i),level:manifest.levels[g.levels[i]]};}};
 g.adj={get:id=>{const i=g.index(id);return i<0?[]:Array.from({length:g.offsets[i+1]-g.offsets[i]},(_,n)=>g.edge(g.offsets[i]+n,i));}};
 g.data={source:manifest.source,bounds:manifest.bounds,warnings:manifest.warnings};
 g.snapCells=new Map();for(let i=0;i<manifest.nodes;i++)if(manifest.levels[g.levels[i]]==='ground'&&g.eligible[i]){const key=cellKey(g.point(i));if(!g.snapCells.has(key))g.snapCells.set(key,[]);g.snapCells.get(key).push(i);}
 return g;
}
export function snapCompact(g,point,mode='walk',maxDistance=50){
 if(!Array.isArray(point)||point.length!==2||!point.every(Number.isFinite)||Math.abs(point[0])>180||Math.abs(point[1])>90||!['walk','bike'].includes(mode))throw new Error('올바른 위치와 이동 수단을 선택해 주세요.');
 const [x,y]=cellKey(point).split(',').map(Number),bit=mode==='walk'?1:2;let best=-1,meters=Infinity;
 for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const i of g.snapCells.get(`${x+dx},${y+dy}`)||[])if(g.eligible[i]&bit){const d=distance(point,g.point(i));if(d<meters){best=i;meters=d;}}
 if(best<0||meters>maxDistance)throw new Error('50m 이내에 연결된 지상 보행·자전거 도로가 없습니다. 가까운 도로를 선택해 주세요.');
 return {id:g.id(best),coordinate:g.point(best),distance:meters};
}
class Heap{data=[];push(a){let i=this.data.length;this.data.push(a);while(i){const p=(i-1)>>1;if(this.data[p][1]<=a[1])break;this.data[i]=this.data[p];i=p;}this.data[i]=a;}pop(){const a=this.data[0],b=this.data.pop();if(this.data.length){let i=0;while(i*2+1<this.data.length){let j=i*2+1;if(j+1<this.data.length&&this.data[j+1][1]<this.data[j][1])j++;if(this.data[j][1]>=b[1])break;this.data[i]=this.data[j];i=j;}this.data[i]=b;}return a;}}
export function compactMinutes(g,j,mode,from){const flags=g.flags[j];if(flags&8)return .75;let minutes=g.lengths[j]/(flags&4?30:mode==='bike'?250:75);if(flags&4&&from!==undefined&&g.levels[from]!==g.levels[g.to[j]])minutes=Math.max(.35,minutes);return minutes;}
export function findCompact(g,{start,end,mode='walk',costForEdge,allowedCells,maxVisited=Infinity}={}){
 const a=g.index(start),b=g.index(end);if(a<0||b<0||!['walk','bike'].includes(mode))throw new Error('홍콩 도로망의 올바른 출발·도착 지점이 필요합니다.');
 const n=g.manifest.nodes,bit=mode==='walk'?1:2,best=new Float64Array(n).fill(Infinity),elapsed=new Float64Array(n),previous=new Int32Array(n).fill(-1),froms=new Int32Array(n).fill(-1),heap=new Heap();
 const target=g.point(b),speed=g.manifest.maxSpeed[mode],heuristic=i=>distance(g.point(i),target)/speed;best[a]=0;heap.push([a,heuristic(a),0]);let visited=0,found=false;
 while(heap.data.length){const [i,,knownCost]=heap.pop();if(knownCost!==best[i])continue;visited++;if(i===b){found=true;break;}if(visited>maxVisited)throw new Error('SHADE_SEARCH_BUDGET');
  for(let j=g.offsets[i];j<g.offsets[i+1];j++){if(!(g.flags[j]&bit))continue;const to=g.to[j];if(allowedCells&&!allowedCells.has(cellKey(g.point(to))))continue;const minutes=compactMinutes(g,j,mode,i),edge=costForEdge?g.edge(j,i):null,step=costForEdge?costForEdge(edge,elapsed[i],minutes,j):minutes;if(!Number.isFinite(step)||step<minutes)throw new Error('Invalid shade cost');const cost=best[i]+step;if(cost<best[to]){best[to]=cost;elapsed[to]=elapsed[i]+minutes;previous[to]=j;froms[to]=i;heap.push([to,cost+heuristic(to),cost]);}}
 }
 if(!found)throw new Error('도보·자전거로 연결된 경로가 없습니다. 바다를 건너야 하는 구간이나 통행 제한이 있는 길은 연결하지 않습니다.');
 const edges=[];let cursor=b;while(cursor!==a){const j=previous[cursor],from=froms[cursor];edges.push({...g.edge(j,from),duration:compactMinutes(g,j,mode,from)});cursor=from;}edges.reverse();const ids=[start,...edges.map(e=>e.to)],coordinates=ids.map(id=>g.nodes.get(id).coordinate);if(coordinates.length===1)coordinates.push(coordinates[0]);
 return {distance:edges.reduce((s,e)=>s+e.distance,0),duration:elapsed[b],geometry:{type:'LineString',coordinates},nodes:ids,segments:edges,visited,engine:'shadow',warnings:g.manifest.warnings};
}
export function routeCorridor(route,radius=1000){const keys=new Set(),step=.005,dx=Math.ceil(radius/500),dy=Math.ceil(radius/550);for(const p of route.geometry.coordinates){const [x,y]=cellKey(p).split(',').map(Number);for(let a=-dx;a<=dx;a++)for(let b=-dy;b<=dy;b++)keys.add(`${x+a},${y+b}`);}return keys;}
