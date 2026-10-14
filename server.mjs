import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {cities,geocode,directions} from './providers.mjs';
const root=new URL('./dist/',import.meta.url);
const key=process.env.MAPTILER_KEY||'', routingKey=process.env.GRAPHHOPPER_KEY||'';
const types={html:'text/html',mjs:'text/javascript',css:'text/css',json:'application/json'};
const reply=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
export const server=createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    if(req.method!=='GET') return reply(res,405,{error:'GET 요청만 지원합니다.'});
    if(url.pathname==='/api/config') return reply(res,200,{mapKey:key,routingReady:Boolean(routingKey),cities});
    if(url.pathname==='/api/search') return reply(res,200,await geocode(url.searchParams.get('q'),url.searchParams.get('city'),key));
    if(url.pathname==='/api/route') {
      const parse=name=>{try{return JSON.parse(url.searchParams.get(name));}catch{throw new Error('올바른 좌표가 필요합니다.');}};
      return reply(res,200,await directions(parse('start'),parse('end'),url.searchParams.get('mode'),routingKey));
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
