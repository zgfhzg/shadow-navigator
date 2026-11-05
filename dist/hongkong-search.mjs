import proj4 from './vendor/proj4.mjs';
const HK80='+proj=tmerc +lat_0=22.3121333333333 +lon_0=114.178555555556 +k=1 +x_0=836694.05 +y_0=819069.8 +ellps=intl +towgs84=-162.619,-276.959,-161.764,-0.067753,2.243648,1.158828,-1.094246 +units=m +no_defs';
const normalize=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[\s\p{P}]/gu,'');
const aliases=new Map([['센트럴플라자','中環廣場'],['센트럴프라자','中環廣場'],['센트럴마켓','中環街市'],['홍콩역','香港站'],['완차이역','灣仔站'],['침사추이역','尖沙咀站']]);
export const governmentQuery=query=>aliases.get(normalize(query))||String(query||'').trim();
export function hk80ToWgs84(x,y){
 if(!Number.isFinite(x)||!Number.isFinite(y)||x<790000||x>875000||y<790000||y>855000)return null;
 const point=proj4(HK80,'EPSG:4326',[x,y]);
 return point.every(Number.isFinite)&&point[0]>=113.76&&point[0]<=114.51&&point[1]>=22.12&&point[1]<=22.59?point:null;
}
export function governmentPlaces(data,query,proximity){
 if(!Array.isArray(data))throw new Error('홍콩 정부 검색 응답을 읽지 못했어요.');
 const q=normalize(governmentQuery(query)),seen=new Set(),items=[];
 for(const row of data){
  if(!row||typeof row.nameEN!=='string'||typeof row.nameZH!=='string')continue;
  const coordinate=hk80ToWgs84(row.x,row.y);if(!coordinate)continue;
  const nameEN=row.nameEN.trim(),nameZH=row.nameZH.trim(),addressEN=String(row.addressEN||'').trim().replace(/\s+/g,' '),addressZH=String(row.addressZH||'').trim().replace(/\s+/g,' ');
  const labelEN=[nameEN,addressEN,row.districtEN].filter(Boolean).join(', '),labelZH=[nameZH,addressZH,row.districtZH].filter(Boolean).join('，');
  const key=normalize(nameZH||nameEN)+':'+coordinate.map(v=>v.toFixed(5)).join(',');
  if(seen.has(key))continue;seen.add(key);
  const exact=[nameEN,nameZH].some(name=>normalize(name)===q);
  const address=[addressEN,addressZH].some(name=>normalize(name)===q);
  const score=exact?0:address?1:2;
  const near=Array.isArray(proximity)&&proximity.length===2&&proximity.every(Number.isFinite)?Math.hypot((coordinate[0]-proximity[0])*.93,coordinate[1]-proximity[1]):0;
  items.push({source:'landsd',country:'hongkong',city:'hongkong',type:'place',label:labelEN||labelZH,labelEN,labelZH,coordinate,terms:[nameEN,nameZH,addressEN,addressZH],score,near});
 }
 return items.sort((a,b)=>a.score-b.score||a.near-b.near).slice(0,10).map(({score,near,...item})=>item);
}
const cache=new Map();
export async function searchHongKong(query,{signal,proximity}={},fetcher=fetch){
 const q=governmentQuery(query);if(q.length<2||q.length>200)return [];
 const key=normalize(q),cached=fetcher===fetch?cache.get(key):null;
 if(cached&&Date.now()-cached.at<300000)return governmentPlaces(cached.data,query,proximity);
 const url=new URL('https://www.map.gov.hk/gs/api/v1.0.0/locationSearch');url.searchParams.set('q',q);
 let response;
 try{response=await fetcher(url,{signal:signal||AbortSignal.timeout(10000)});}catch(error){if(error.name==='AbortError')throw error;throw new Error('홍콩 정부 장소 검색에 연결하지 못했어요.');}
 if(!response.ok)throw new Error('홍콩 정부 장소 검색을 사용할 수 없어요.');
 let data;try{data=await response.json();}catch{throw new Error('홍콩 정부 검색 응답을 읽지 못했어요.');}
 const places=governmentPlaces(data,query,proximity);
 if(fetcher===fetch){cache.set(key,{data,at:Date.now()});while(cache.size>32)cache.delete(cache.keys().next().value);}
 return places;
}
// Government + local matches survive fuzzy third-party results. Prefer exact
// names, and deduplicate identical bilingual place names at the same coordinate.
export function mergePlaceResults(...groups){
 const result=[];
 for(const place of groups.flat()){
  const names=[place.label,...(place.terms||[])].map(normalize).filter(Boolean);
  const duplicate=result.some(other=>Math.hypot(other.coordinate[0]-place.coordinate[0],other.coordinate[1]-place.coordinate[1])<.0003&&[other.label,...(other.terms||[])].map(normalize).some(n=>names.includes(n)));
  if(!duplicate)result.push(place);
 }
 return result.slice(0,18);
}
