export const cities = {
  hongkong: {name:'홍콩',center:[114.1589,22.2819],zone:'Asia/Hong_Kong'},
  tokyo: {name:'도쿄',center:[139.7671,35.6812],zone:'Asia/Tokyo'},
  osaka: {name:'오사카',center:[135.5023,34.6937],zone:'Asia/Tokyo'},
  kyoto: {name:'교토',center:[135.7681,35.0116],zone:'Asia/Tokyo'},
};
export function coordinate(value) {
  if(!Array.isArray(value)||value.length!==2||!value.every(Number.isFinite)||Math.abs(value[0])>180||Math.abs(value[1])>90) throw new Error('올바른 좌표가 필요합니다.');
  return value;
}
export async function providerJSON(url, fetcher=fetch) {
  const response=await fetcher(url,{signal:AbortSignal.timeout(12000)});
  // Provider error payloads/URLs may contain credentials. Never forward them.
  if(!response.ok) throw new Error(`지도 서비스 요청 실패 (${response.status}). 키와 사용량을 확인해 주세요.`);
  return response.json();
}
export async function geocode(query,city,key,fetcher=fetch) {
  if(!key) throw new Error('MapTiler API 키가 아직 설정되지 않았습니다.');
  if(typeof query!=='string'||query.trim().length<2||query.length>200||!Object.hasOwn(cities,city)) throw new Error('도시와 검색어를 확인해 주세요.');
  const url=new URL(`https://api.maptiler.com/geocoding/${encodeURIComponent(query.trim())}.json`);
  url.search=new URLSearchParams({key,proximity:cities[city].center.join(','),limit:'5',language:'ko'});
  const data=await providerJSON(url,fetcher);
  return (data.features||[]).filter(f=>Array.isArray(f.center)).map(f=>({name:f.place_name||f.text,center:coordinate(f.center)}));
}
