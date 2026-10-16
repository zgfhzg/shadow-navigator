import {readFile,writeFile} from 'node:fs/promises';
import {distance,prepareGraph} from '../routing/engine.mjs';
import {places} from '../dist/places.mjs';
const city=process.argv[2]||'hongkong',root=new URL('../',import.meta.url);
const graph=prepareGraph(JSON.parse(await readFile(new URL(`data/${city}.graph.json`,root),'utf8'))),osm=JSON.parse(await readFile(new URL(`data/${city}.osm.json`,root),'utf8'));
const modes=new Map();for(const e of graph.data.edges)for(const id of [e.from,e.to]){if(!modes.has(id))modes.set(id,new Set());for(const m of e.modes)modes.get(id).add(m);}
const ground=graph.data.nodes.filter(n=>n.level==='ground'&&modes.get(n.id)?.has('walk'));
const index=[],seen=new Set();
const translated=[['東京駅','도쿄역 Tokyo Station'],['丸の内','마루노우치 Marunouchi'],['大阪市役所','오사카 시청 Osaka City Hall'],['中之島','나카노시마 Nakanoshima'],['淀屋橋','요도야바시 Yodoyabashi'],['北浜','기타하마 Kitahama'],['京都市役所','교토 시청 Kyoto City Hall'],['三条','산조 Sanjo']];
function add(label,node,terms=[],type='장소',accessDistance=0,featured=false){const exact=translated.find(([source])=>[label,...terms].includes(source));if(exact){const alias=exact[1].match(/^(.*?) ([A-Za-z].*)$/);if(alias){terms=[...terms,label,alias[1],alias[2]];label=`${alias[1]} · ${alias[2]}`;featured=true;}}terms=[...terms,...translated.filter(([source])=>[label,...terms].some(t=>t.includes(source))).map(([,alias])=>alias)];const key=`${label}:${node.id}`;if(seen.has(key))return;seen.add(key);index.push({id:key,label,nodeId:node.id,coordinate:node.coordinate,terms:[label,...terms],type,accessDistance,modes:[...modes.get(node.id)],featured});}
if(city==='hongkong')for(const p of places){const n=graph.nodes.get(p.nodeId);if(n)add(p.label,n,[p.sourceName],'주요 장소',0,true);}
for(const node of ground)if(node.name)add(node.name.match(/[A-Za-z].*$/)?.[0]||node.name,node,[node.name]);
for(const raw of osm.elements){if(raw.type!=='node'||!raw.tags?.name||!['amenity','shop','tourism','railway','public_transport','leisure'].some(k=>raw.tags[k]))continue;
  let node,meters=Infinity;for(const candidate of ground){const d=distance([raw.lon,raw.lat],candidate.coordinate);if(d<meters){meters=d;node=candidate;}}
  if(node&&meters<=50)add(raw.tags['name:ko']||raw.tags['name:en']||raw.tags.name,node,Object.entries(raw.tags).filter(([k])=>k==='name'||k.startsWith('name:')||k==='alt_name').map(([,v])=>v),'주변 장소',meters);
}
const ways=new Set();for(const e of graph.data.edges)if(e.name&&!ways.has(e.wayId)&&graph.nodes.get(e.from).level==='ground'){ways.add(e.wayId);add(e.name.match(/[A-Za-z].*$/)?.[0]||e.name,graph.nodes.get(e.from),[e.name],'거리');}
await writeFile(new URL(`data/${city}.search.json`,root),JSON.stringify(index));console.log(`${city}: ${index.length} searchable real places and streets`);
