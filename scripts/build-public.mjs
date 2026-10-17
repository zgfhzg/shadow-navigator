import {mkdir,copyFile,cp,writeFile,access} from 'node:fs/promises';
import {regions} from '../routing/regions.mjs';
const root=new URL('../',import.meta.url),out=new URL('out/',root);
// The key is a browser map key, emitted only into ignored build output.
try{process.loadEnvFile(new URL('.env',root));}catch(error){if(error.code!=='ENOENT')throw error;}
const {cleanConfig}=await import('../dist/maptiler.mjs');
const config=cleanConfig({mapKey:process.env.MAPTILER_KEY||'',mapStyle:process.env.MAPTILER_STYLE||'streets-v4'});
if(process.env.MAPTILER_KEY&&!config.mapKey)throw new Error('MAPTILER_KEY 형식을 확인해 주세요.');
await mkdir(out,{recursive:true});await cp(new URL('dist/',root),out,{recursive:true});
await writeFile(new URL('map-config.json',out),JSON.stringify(config));
// All entry points lead to the same user-facing planner.
for(const name of ['routing.html','live.html','demo.html'])await copyFile(new URL('dist/index.html',root),new URL(name,out));
for(const folder of ['runtime/routing/','runtime/dist/','runtime/data/'])await mkdir(new URL(folder,out),{recursive:true});
for(const name of ['engine.mjs','shade.mjs','service.mjs','browser-worker.mjs','search.mjs','regions.mjs'])await copyFile(new URL(`routing/${name}`,root),new URL(`runtime/routing/${name}`,out));
await copyFile(new URL('dist/engine.mjs',root),new URL('runtime/dist/engine.mjs',out));
const available={};
for(const city of Object.keys(regions)){
  const names=[`${city}.graph.json`,`${city}.geojson`,`${city}.search.json`];
  try{for(const name of names)await access(new URL(`fixtures/public/${name}`,root));available[city]=true;}catch{available[city]=false;continue;}
  for(const name of names)await copyFile(new URL(`fixtures/public/${name}`,root),new URL(`runtime/data/${name}`,out));
}
await writeFile(new URL('runtime/data/catalog.json',out),JSON.stringify({regions,available}));
console.log('Main planner built in out/: '+JSON.stringify(available));
