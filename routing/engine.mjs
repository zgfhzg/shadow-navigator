// Geographic road graph. OSM node identity is preserved; coordinate crossings
// never create junctions. The search uses elapsed minutes, not pixel distances.
export function distance(a,b) {
  const rad=Math.PI/180, dlat=(b[1]-a[1])*rad, dlon=(b[0]-a[0])*rad;
  const h=Math.sin(dlat/2)**2+Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin(dlon/2)**2;
  return 6371008.8*2*Math.asin(Math.sqrt(Math.min(1,h)));
}
class Heap {
  data=[];
  push(item){let i=this.data.length;this.data.push(item);while(i){const p=(i-1)>>1;if(this.data[p].cost<=item.cost)break;this.data[i]=this.data[p];i=p;}this.data[i]=item;}
  pop(){const first=this.data[0],last=this.data.pop();if(this.data.length){let i=0;while(i*2+1<this.data.length){let child=i*2+1;if(child+1<this.data.length&&this.data[child+1].cost<this.data[child].cost)child++;if(this.data[child].cost>=last.cost)break;this.data[i]=this.data[child];i=child;}this.data[i]=last;}return first;}
}
export function prepareGraph(data) {
  if(data?.version!==1||!Array.isArray(data.nodes)||!Array.isArray(data.edges))throw new Error('도로망 형식이 올바르지 않습니다.');
  const nodes=new Map(),adj=new Map(),edgeIds=new Set();
  for(const n of data.nodes){
    if(typeof n.id!=='string'||nodes.has(n.id)||!Array.isArray(n.coordinate)||n.coordinate.length!==2||!n.coordinate.every(Number.isFinite)||Math.abs(n.coordinate[0])>180||Math.abs(n.coordinate[1])>90)throw new Error('도로망 노드가 올바르지 않습니다.');
    nodes.set(n.id,n);adj.set(n.id,[]);
  }
  for(const e of data.edges){
    if(typeof e.id!=='string'||edgeIds.has(e.id)||!nodes.has(e.from)||!nodes.has(e.to)||!Number.isFinite(e.distance)||e.distance<0||!Array.isArray(e.modes)||e.modes.some(m=>!['walk','bike'].includes(m)))throw new Error('도로망 연결이 올바르지 않습니다.');
    if(e.duration!==undefined&&(!Number.isFinite(e.duration)||e.duration<0))throw new Error('이동 시간이 올바르지 않습니다.');
    edgeIds.add(e.id);adj.get(e.from).push(e);
  }
  return {data,nodes,adj};
}
export function edgeMinutes(edge,mode) {
  if(edge.duration!==undefined)return edge.duration;
  if(edge.kind==='elevator')return .75; // fixed wait/ride estimate; not live service status
  const minutes=edge.distance/(edge.kind==='steps'?30:mode==='bike'?250:75);
  return edge.kind==='steps'&&edge.from.split('@')[1]!==edge.to.split('@')[1]?Math.max(.35,minutes):minutes;
}
export function findRoute(graph,{start,end,mode='walk',avoidSteps=false}={}) {
  if(!['walk','bike'].includes(mode))throw new Error('도보 또는 자전거를 선택해 주세요.');
  if(!graph.nodes.has(start)||!graph.nodes.has(end))throw new Error('도로망의 출발·도착 지점을 선택해 주세요.');
  const best=new Map([[start,0]]),previous=new Map(),heap=new Heap();heap.push({id:start,cost:0});
  let visited=0;
  while(heap.data.length){
    const current=heap.pop();if(current.cost!==best.get(current.id))continue;visited++;
    if(current.id===end)break;
    for(const edge of graph.adj.get(current.id)){
      if(!edge.modes.includes(mode)||(avoidSteps&&edge.kind==='steps'))continue;
      const cost=current.cost+edgeMinutes(edge,mode);
      if(cost<(best.get(edge.to)??Infinity)){best.set(edge.to,cost);previous.set(edge.to,edge);heap.push({id:edge.to,cost});}
    }
  }
  if(!best.has(end))throw new Error('이 조건에서 연결된 경로가 없습니다. 범위 밖 도로나 층 연결 누락일 수 있습니다.');
  const segments=[];let cursor=end;
  while(cursor!==start){const edge=previous.get(cursor);segments.push(edge);cursor=edge.from;}segments.reverse();
  const ids=[start,...segments.map(e=>e.to)],coordinates=ids.map(id=>graph.nodes.get(id).coordinate);
  if(coordinates.length===1)coordinates.push(coordinates[0]);
  return {distance:segments.reduce((sum,e)=>sum+e.distance,0),duration:best.get(end),geometry:{type:'LineString',coordinates},nodes:ids,
    segments:segments.map(e=>({id:e.id,wayId:e.wayId,name:e.name,kind:e.kind,covered:e.covered,from:e.from,to:e.to,distance:e.distance,duration:edgeMinutes(e,mode)})),
    visited,engine:'shadow',warnings:[...(graph.data.warnings||[]),'건물 그늘·실시간 폐쇄·운영 시간·회전 제한은 아직 반영하지 않습니다.']};
}
export function snapNode(graph,coordinate,mode='walk',{maxDistance=50,level='ground'}={}) {
  if(!Array.isArray(coordinate)||coordinate.length!==2||!coordinate.every(Number.isFinite)||Math.abs(coordinate[0])>180||Math.abs(coordinate[1])>90)throw new Error('올바른 좌표를 입력해 주세요.');
  // Only nodes with a usable incident edge are eligible; never choose a rooftop
  // merely because its XY location is nearest. Connectors require explicit IDs.
  const eligible=new Set();for(const e of graph.data.edges)if(e.modes.includes(mode)){eligible.add(e.from);eligible.add(e.to);}
  let selected,meters=Infinity;
  for(const node of graph.nodes.values())if(eligible.has(node.id)&&node.level===level){const d=distance(coordinate,node.coordinate);if(d<meters){selected=node;meters=d;}}
  if(!selected||meters>maxDistance)throw new Error('50m 이내에 해당 층의 도로 연결 지점이 없습니다. 출입구 또는 지도 노드를 선택해 주세요.');
  return {id:selected.id,distance:meters,coordinate:selected.coordinate};
}
