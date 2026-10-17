import {writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {regions} from '../routing/regions.mjs';
import {importOSM} from '../routing/osm.mjs';
import {prepareGraph} from '../routing/engine.mjs';
const city=process.argv[2];if(!Object.hasOwn(regions,city))throw new Error('지역을 선택해 주세요.');
if(city==='hongkong')throw new Error('홍콩 전역 자료는 npm run data:hongkong 으로 준비하세요. OSM 지도 편집 API에서 국가 전체를 요청하지 않습니다.');
const region=regions[city],root=new URL('../',import.meta.url);await mkdir(new URL('data/',root),{recursive:true});
const response=await fetch(`https://api.openstreetmap.org/api/0.6/map.json?bbox=${region.bounds.join(',')}`,{headers:{'User-Agent':'ShadowNavigator/0.1 (https://github.com/zgfhzg/shadow-navigator; development data import)'},signal:AbortSignal.timeout(55000)});
if(!response.ok)throw new Error(`도로 자료 다운로드 실패 ${response.status}; retry-after=${response.headers.get('retry-after')||'not supplied'}; ${(await response.text()).slice(0,250)}`);
const osm=await response.json();osm.shadowDownload={at:new Date().toISOString(),bounds:region.bounds};
await writeFile(new URL(`data/${city}.osm.json`,root),JSON.stringify(osm));const graph=importOSM(osm,{city,bounds:region.bounds});prepareGraph(graph);
await writeFile(new URL(`data/${city}.graph.json`,root),JSON.stringify(graph));console.log(`${city}: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);
for(const [type,suffix]of [['building','buildings'],['building_part','parts']]){
  const result=spawnSync(fileURLToPath(new URL('.tools/overture/bin/overturemaps',root)),['download','--release','2026-09-23.1',`--bbox=${region.buildingBounds.join(',')}`,'-f','geojson','--type',type,'-o',`data/${city}.${suffix}.geojson`,'--connect_timeout','15','--request_timeout','30'],{cwd:fileURLToPath(root),stdio:'inherit',env:{...process.env,...(process.platform==='darwin'?{SSL_CERT_FILE:process.env.SSL_CERT_FILE||'/etc/ssl/cert.pem'}:{})}});
  if(result.status!==0)throw new Error('건물 자료 다운로드 실패');
}
const result=spawnSync(process.execPath,['scripts/prepare-buildings.mjs',city],{cwd:fileURLToPath(root),stdio:'inherit'});if(result.status!==0)throw new Error('건물 자료 준비 실패');
