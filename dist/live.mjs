import {DepartureClock,clockLabel,arrivalLabel} from './time.mjs';
const $=id=>document.getElementById(id);
let config,map,clock,version=0,routeVersion=0,markers=[];
async function api(path,params={}) {
  const response=await fetch(path+'?'+new URLSearchParams(params));
  if(!response.headers.get('content-type')?.includes('application/json')) throw new Error('실제 지도는 Node 서버에서 실행해야 합니다. 기존 정적 배포에서는 사용할 수 없습니다.');
  const data=await response.json();if(!response.ok)throw new Error(data.error||'연결 실패');return data;
}
function time(){clock.sync();$('clock').textContent=`현재 ${clockLabel(clock.minutes)} · ${clock.zone}`;}
async function cityChanged(){
  const request=++version;++routeVersion;
  const city=config.cities[$('city').value];clock=new DepartureClock(new Date(),city.zone);time();
  $('start').replaceChildren();$('end').replaceChildren();$('results').replaceChildren();$('route').disabled=true;
  for(const marker of markers)marker.remove();markers=[];
  if(map?.getSource('route'))map.getSource('route').setData({type:'FeatureCollection',features:[]});
  if(map?.getSource('buildings'))map.getSource('buildings').setData({type:'FeatureCollection',features:[]});
  map?.jumpTo({center:city.center,zoom:14});
  try{const data=await api('/api/buildings',{city:$('city').value});if(request!==version)return;
    const known=data.features.filter(f=>Number.isFinite(f.properties?.height)&&f.properties.height>0).length;
    $('buildings').textContent=`건물 ${data.features.length}개 · 높이 확인 ${known}개. 실제 경로의 그늘 평가에 사용합니다.`;
    map?.getSource('buildings')?.setData(data);
  }catch(e){if(request===version)$('buildings').textContent=e.message;}
}
for(const [form,query,target] of [['places','start-query','start'],['destination','end-query','end']]){
  let searchVersion=0;
  $(form).onsubmit=async event=>{event.preventDefault();const cityVersion=version,request=++searchVersion;++routeVersion;
    $(target).replaceChildren();$('route').disabled=true;$('results').replaceChildren();
    if(map?.getSource('route'))map.getSource('route').setData({type:'FeatureCollection',features:[]});
    try{const items=await api('/api/search',{q:$(query).value,city:$('city').value});if(cityVersion!==version||request!==searchVersion)return;
      for(const item of items){const option=new Option(item.name,JSON.stringify(item.center));$(target).append(option);}
      $('status').textContent=items.length?'검색 결과에서 장소를 선택해 주세요.':'검색 결과가 없습니다.';
      $('route').disabled=!map?.getSource('route')||!config.routingCities[$('city').value]||!$('start').value||!$('end').value;
    }catch(e){if(cityVersion===version&&request===searchVersion)$('status').textContent=e.message;}
  };
}
function clearRoute(){++routeVersion;$('results').replaceChildren();if(map?.getSource('route'))map.getSource('route').setData({type:'FeatureCollection',features:[]});}
for(const id of ['mode','start','end'])$(id).onchange=clearRoute;
$('route').onclick=async()=>{
  const request=++routeVersion;const epoch=Date.now(),zone=clock.timeZone;
  $('status').textContent='경로를 찾고 있습니다…';$('results').replaceChildren();
  try{const paths=await api('/api/route',{departure:new Date(epoch).toISOString(),city:$('city').value,start:$('start').value,end:$('end').value,mode:$('mode').value});if(request!==routeVersion)return;
    const draw=p=>{map.getSource('route').setData({type:'Feature',properties:{},geometry:p.geometry});const bounds=new maplibregl.LngLatBounds();p.geometry.coordinates.forEach(c=>bounds.extend(c));map.fitBounds(bounds,{padding:45,maxZoom:17});};
    paths.forEach((p,i)=>{const button=document.createElement('button');button.textContent=`${{fast:'최단 시간',balanced:'균형',shade:'그늘 우선'}[p.kind]} · ${Math.ceil(p.duration)}분 · ${(p.distance/1000).toFixed(1)}km · ${arrivalLabel(epoch,p.duration,zone)} 도착${p.exposure?` · 모델상 그늘 ${p.exposure.shade.toFixed(1)}분 / 평가 불가 ${p.exposure.unknown.toFixed(1)}분`:''}`;button.onclick=()=>draw(p);$('results').append(button);});draw(paths[0]);
    for(const marker of markers)marker.remove();markers=[$('start').value,$('end').value].map(value=>new maplibregl.Marker().setLngLat(JSON.parse(value)).addTo(map));
    $('status').textContent='자체 엔진의 근사 경로입니다. 높이 정보가 없는 구간은 평가 불가입니다.';
  }catch(e){if(request===routeVersion)$('status').textContent=e.message;}
};
try{
  config=await api('/api/config');for(const [id,city] of Object.entries(config.cities))$('city').append(new Option(city.name,id));
  $('city').onchange=cityChanged;await cityChanged();setInterval(time,1000);
  if(!config.mapKey)throw new Error('MapTiler API 키 설정 대기 중입니다. .env 설정 후 서버를 다시 시작해 주세요.');
  const css=document.createElement('link');css.rel='stylesheet';css.href='https://unpkg.com/maplibre-gl@5.6.1/dist/maplibre-gl.css';document.head.append(css);
  await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://unpkg.com/maplibre-gl@5.6.1/dist/maplibre-gl.js';script.onload=resolve;script.onerror=()=>reject(new Error('지도 라이브러리를 불러오지 못했습니다.'));document.head.append(script);});
  map=new maplibregl.Map({container:'map',style:`https://api.maptiler.com/maps/streets-v2/style.json?key=${encodeURIComponent(config.mapKey)}`,center:config.cities[$('city').value].center,zoom:14});
  map.addControl(new maplibregl.NavigationControl());
  map.on('error',()=>{$('status').textContent='지도를 불러오지 못했습니다. MapTiler 키와 도메인 제한을 확인해 주세요.';});
  map.on('load',()=>{for(const id of ['buildings','route'])map.addSource(id,{type:'geojson',data:{type:'FeatureCollection',features:[]}});map.addLayer({id:'buildings',type:'fill',source:'buildings',paint:{'fill-color':'#77849b','fill-opacity':.35}});map.addLayer({id:'route',type:'line',source:'route',paint:{'line-color':'#3563f3','line-width':5}});cityChanged();});
  $('status').textContent=config.routingReady?'출발지와 도착지를 검색해 주세요.':'지도 연결 완료 · 이 도시의 도로 데이터 가져오기가 필요합니다.';
}catch(e){$('status').textContent=e.message;}
