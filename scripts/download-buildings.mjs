import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),python=fileURLToPath(new URL('.tools/overture/bin/overturemaps',root));
const catalog=await(await fetch('https://stac.overturemaps.org/catalog.json',{signal:AbortSignal.timeout(15000)})).json();
const release=process.argv[2]||catalog.latest;
if(typeof release!=='string'||!/^\d{4}-\d{2}-\d{2}\.\d+$/.test(release))throw new Error('Overture 릴리스를 확인할 수 없습니다.');
for(const type of ['building','building_part']){
  const suffix=type==='building'?'buildings':'parts';
  const result=spawnSync(python,['download','--release',release,'--bbox=114.140,22.270,114.178,22.294','-f','geojson','--type',type,'-o',`data/hongkong.${suffix}.geojson`,'--connect_timeout','15','--request_timeout','30'],{cwd:fileURLToPath(root),stdio:'inherit',env:{...process.env,...(process.platform==='darwin'&&!process.env.SSL_CERT_FILE?{SSL_CERT_FILE:'/etc/ssl/cert.pem'}:{})}});
  if(result.error)throw new Error('공식 Overture 도구를 .tools/overture 환경에 먼저 설치해 주세요.');
  if(result.status!==0)process.exit(result.status||1);
}
const prepare=spawnSync(process.execPath,['scripts/prepare-buildings.mjs','hongkong'],{cwd:fileURLToPath(root),stdio:'inherit'});if(prepare.error)throw prepare.error;process.exit(prepare.status??1);
