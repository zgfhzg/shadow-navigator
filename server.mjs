import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {cities,geocode} from './providers.mjs';
import {loadGraph,localDirections,network} from './routing/store.mjs';
import {loadScene} from './routing/building-store.mjs';
import {sampleGround} from './routing/shade.mjs';
import {snapNode} from './routing/engine.mjs';
import {regions} from './routing/regions.mjs';
import {searchPlaces} from './routing/search.mjs';
const root=new URL('./dist/',import.meta.url);
const key=process.env.MAPTILER_KEY||'';
const types={html:'text/html',mjs:'text/javascript',css:'text/css',json:'application/json'};
const reply=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
export const server=createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    if(req.method!=='GET') return reply(res,405,{error:'GET 요청만 지원합니다.'});
    if(url.pathname==='/map-config.json')return reply(res,200,{mapKey:key,mapStyle:process.env.MAPTILER_STYLE||'streets-v4'});
    if(url.pathname==='/api/config') {
      const available={};for(const city of Object.keys(cities)){try{await loadGraph(city);available[city]=true;}catch{available[city]=false;}}
      return reply(res,200,{mapKey:key,routingReady:Object.values(available).some(Boolean),routingCities:available,routingEngine:'shadow',cities});
    }
    if(url.pathname==='/api/regions') {
      const available={};for(const city of Object.keys(regions)){try{await loadGraph(city);available[city]=true;}catch{available[city]=false;}}return reply(res,200,{regions,available});
    }
    if(url.pathname==='/api/places') {
      const city=url.searchParams.get('city')||'hongkong';if(!Object.hasOwn(regions,city))return reply(res,400,{error:'지역을 선택해 주세요.'});
      let index;try{index=JSON.parse(await readFile(new URL(`./fixtures/public/${city}.search.json`,import.meta.url),'utf8'));}catch{return reply(res,503,{error:'이 지역의 장소 정보를 준비 중입니다.'});}
      return reply(res,200,searchPlaces(index,url.searchParams.get('q')||'',url.searchParams.get('mode')||'walk'));
    }
    if(url.pathname==='/api/area'){const graph=await loadGraph(url.searchParams.get('city')||'hongkong');return reply(res,200,{bounds:graph.data.bounds,source:graph.data.source});}
    if(url.pathname==='/api/snap'){const graph=await loadGraph(url.searchParams.get('city')||'hongkong');return reply(res,200,snapNode(graph,JSON.parse(url.searchParams.get('point')),url.searchParams.get('mode')||'walk'));}
    if(url.pathname==='/api/network') return reply(res,200,await network(url.searchParams.get('city')));
    if(url.pathname==='/api/shade') {
      const city=url.searchParams.get('city')||'hongkong',raw=url.searchParams.get('departure');
      if(raw&&!/(Z|[+-]\d{2}:\d{2})$/i.test(raw))return reply(res,400,{error:'출발 시각의 시간대가 필요합니다.'});
      const epoch=raw?Date.parse(raw):Date.now(),graph=await loadGraph(city),scene=await loadScene(city);
      if(!graph.data.bounds)return reply(res,400,{error:'도로망 수집 범위가 필요합니다.'});
      return reply(res,200,sampleGround(scene,graph.data.bounds,epoch));
    }
    if(url.pathname==='/api/search') return reply(res,200,await geocode(url.searchParams.get('q'),url.searchParams.get('city'),key));
    if(url.pathname==='/api/route') {
      const parse=name=>{try{return JSON.parse(url.searchParams.get(name));}catch{throw new Error('올바른 좌표가 필요합니다.');}};
      const city=url.searchParams.get('city')||'hongkong';
      const options={city,departure:url.searchParams.get('departure')||Date.now(),withShade:url.searchParams.get('shade')!=='false',mode:url.searchParams.get('mode')||'walk',avoidSteps:url.searchParams.get('avoidSteps')==='true'};
      if(url.searchParams.has('startNode'))Object.assign(options,{startNode:url.searchParams.get('startNode'),endNode:url.searchParams.get('endNode')});
      else Object.assign(options,{start:parse('start'),end:parse('end')});
      return reply(res,200,await localDirections(options));
    }
    if(url.pathname==='/api/buildings') {
      const city=url.searchParams.get('city');
      if(!Object.hasOwn(cities,city)) return reply(res,400,{error:'지원 도시를 선택해 주세요.'});
      let data;
      try{data=JSON.parse(await readFile(new URL(`./data/${city}.geojson`,import.meta.url),'utf8'));}
      catch{return reply(res,503,{error:'이 도시의 Overture 건물 데이터를 아직 가져오지 않았습니다.'});}
      if(data.type!=='FeatureCollection'||!Array.isArray(data.features)) return reply(res,503,{error:'건물 데이터 형식을 확인해 주세요.'});
      return reply(res,200,data);
    }
    if(url.pathname.startsWith('/api/')) return reply(res,404,{error:'API를 찾을 수 없습니다.'});
    const path=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);
    const file=new URL('.'+path,root);
    if(!fileURLToPath(file).startsWith(fileURLToPath(root))) return reply(res,403,{error:'접근할 수 없습니다.'});
    try{const data=await readFile(file);res.writeHead(200,{'Content-Type':types[path.split('.').pop()]||'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(data);}
    catch{return reply(res,404,{error:'파일을 찾을 수 없습니다.'});}
  } catch(error) {reply(res,400,{error:error.name==='TimeoutError'?'지도 서비스 응답 시간이 초과되었습니다.':error.message.includes('fetch')?'지도 서비스에 연결할 수 없습니다.':error.message});}
});
if(process.argv[1]===fileURLToPath(import.meta.url)) server.listen(Number(process.env.PORT)||4173,'127.0.0.1',()=>console.log('Shadow: http://localhost:'+(Number(process.env.PORT)||4173)));
