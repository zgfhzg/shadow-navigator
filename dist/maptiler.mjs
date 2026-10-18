import {regionAt} from './regions.mjs';
export const COUNTRY_CODES={hongkong:'hk',japan:'jp'};
export function cleanConfig(value={}){
 const mapKey=typeof value.mapKey==='string'?value.mapKey.trim():'';
 return {mapKey:/^[a-zA-Z0-9_-]{1,200}$/.test(mapKey)?mapKey:'',mapStyle:/^[a-zA-Z0-9_-]+$/.test(value.mapStyle||'')?value.mapStyle:'streets-v4'};
}
export async function readMapConfig(fetcher=fetch){
 try{const response=await fetcher(new URL('./map-config.json',import.meta.url),{cache:'no-store'});return response.ok?cleanConfig(await response.json()):cleanConfig();}catch{return cleanConfig();}
}
export async function mapAvailable(config,fetcher=fetch){
 const {mapKey,mapStyle}=cleanConfig(config);if(!mapKey)return false;
 const url=new URL(`https://api.maptiler.com/maps/${mapStyle}/256/tiles.json`);url.searchParams.set('key',mapKey);
 try{const response=await fetcher(url,{signal:AbortSignal.timeout(8000)});if(!response.ok)return false;const data=await response.json();return Array.isArray(data.tiles)&&data.tiles.length>0;}catch{return false;}
}
export function tileOptions(config){
 const {mapKey,mapStyle}=cleanConfig(config);
 return mapKey?{url:`https://api.maptiler.com/maps/${mapStyle}/256/{z}/{x}/{y}.png?key=${encodeURIComponent(mapKey)}`,maxZoom:19,crossOrigin:true,attribution:'<a href="https://www.maptiler.com/copyright/">© MapTiler</a> · <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>'}:{url:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'};
}
export function searchURL(query,{key,country,proximity,language='ko'}={}){
 if(!key)throw new Error('MapTiler 키가 설정되지 않았습니다.');
 const q=String(query||'').trim();if(q.length<2||q.length>200||!COUNTRY_CODES[country])throw new Error('국가와 검색어를 확인해 주세요.');
 const url=new URL(`https://api.maptiler.com/geocoding/${encodeURIComponent(q)}.json`);
 url.search=new URLSearchParams({key,country:COUNTRY_CODES[country],language:['ko','en','zh'].includes(language)?language:'ko',limit:'8',autocomplete:'true'});
 if(Array.isArray(proximity)&&proximity.length===2&&proximity.every(Number.isFinite)&&Math.abs(proximity[0])<=180&&Math.abs(proximity[1])<=90)url.searchParams.set('proximity',proximity.join(','));
 return url;
}
export async function searchMapTiler(query,options,fetcher=fetch){
 const url=searchURL(query,options);let response;
 try{response=await fetcher(url,{signal:options.signal||AbortSignal.timeout(10000)});}catch(e){if(e.name==='AbortError')throw e;throw new Error('MapTiler 검색에 연결하지 못했어요.');}
 if(!response.ok)throw new Error(response.status===401||response.status===403?'MapTiler 키 또는 허용 도메인을 확인해 주세요.':response.status===429?'MapTiler 검색 사용량 한도에 도달했어요.':'MapTiler 검색을 사용할 수 없어요.');
 let data;try{data=await response.json();}catch{throw new Error('MapTiler 검색 응답을 읽지 못했어요.');}
 return (Array.isArray(data?.features)?data.features:[]).filter(f=>f&&Array.isArray(f.center)&&f.center.length===2&&f.center.every(Number.isFinite)&&Math.abs(f.center[0])<=180&&Math.abs(f.center[1])<=90).map(f=>({source:'maptiler',label:String(f.place_name||f.text||'검색한 장소'),coordinate:f.center,placeType:Array.isArray(f.place_type)?f.place_type:[],type:(Array.isArray(f.place_type)?f.place_type:[]).some(t=>['country','region','subregion','place','locality'].includes(t))?'area':'place',bbox:Array.isArray(f.bbox)&&f.bbox.length===4&&f.bbox.every(Number.isFinite)&&f.bbox[0]<f.bbox[2]&&f.bbox[1]<f.bbox[3]&&Math.abs(f.bbox[0])<=180&&Math.abs(f.bbox[2])<=180&&Math.abs(f.bbox[1])<=90&&Math.abs(f.bbox[3])<=90?f.bbox:undefined}));
}
export async function connectPlace(place,{country,available,mode,snap}){
 const city=regionAt(place.coordinate,country,available);
 if(!city)return {...place,city:null,nodeId:null,supported:false};
 try{const node=await snap(city,place.coordinate,mode);return {...place,city,nodeId:node.id,placeCoordinate:place.coordinate,coordinate:node.coordinate,accessDistance:node.distance,supported:true};}
 catch{return {...place,city,nodeId:null,supported:false};}
}
