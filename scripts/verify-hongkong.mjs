import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {server} from '../server.mjs';
import {loadGraph} from '../routing/store.mjs';
const graph=await loadGraph('hongkong');
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
try{
  const base=`http://127.0.0.1:${server.address().port}`;
  const config=await (await fetch(base+'/api/config')).json();assert.equal(config.routingEngine,'shadow');assert(config.routingCities.hongkong);
  const params=new URLSearchParams({city:'hongkong',startNode:'3334802079@ground',endNode:'14205438441@ground',mode:'walk'});
  const response=await fetch(base+'/api/route?'+params);assert.equal(response.status,200);
  const [route]=await response.json();assert(route.distance>500);assert.equal(route.nodes[0],params.get('startNode'));assert.equal(route.nodes.at(-1),params.get('endNode'));
  for(const segment of route.segments){const edge=graph.adj.get(segment.from).find(e=>e.id===segment.id);assert(edge);assert(edge.modes.includes('walk'));assert.equal(edge.to,segment.to);}
  const network=await fetch(base+'/api/network?city=hongkong');assert.equal(network.status,200);
  assert.equal((await fetch(base+'/routing.html')).status,200);
  const report={verifiedAt:new Date().toISOString(),source:graph.data.source,bounds:graph.data.bounds,audit:graph.data.audit,nodeCount:graph.nodes.size,directedEdgeCount:graph.data.edges.length,sample:{start:params.get('startNode'),end:params.get('endNode'),distance:route.distance,duration:route.duration,segments:route.segments.length,visited:route.visited},limitations:route.warnings};
  await writeFile(new URL('../data/hongkong-verification.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await new Promise(resolve=>server.close(resolve));}
