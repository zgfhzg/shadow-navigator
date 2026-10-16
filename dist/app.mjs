import * as L from './vendor/leaflet.mjs';
import {api} from './browser-client.mjs';
import {regions} from './regions.mjs';
import {DepartureClock,clockLabel,arrivalLabel} from './time.mjs';
import {solarAt} from './engine.mjs';
const $=id=>document.getElementById(id);
const clock=new DepartureClock(new Date(),regions.hongkong.zone);
const state={city:'hongkong',mode:'walk',kind:'shade',ready:false,available:{},area:null,origin:null,destination:null,routes:[],showShade:true};
let regionVersion=0,routeVersion=0,shadeVersion=0,timeTimer,timeRecalcWanted=false;
const map=L.map('map',{zoomControl:false,preferCanvas:true,attributionControl:true}).setView([22.2819,114.1589],16);
map.attributionControl.setPrefix(false);
const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',keepBuffer:1}).addTo(map);
const routeLayer=L.layerGroup().addTo(map),pinLayer=L.layerGroup().addTo(map),shadeLayer=L.layerGroup().addTo(map),fallbackLayer=L.layerGroup().addTo(map);
let tileFailure=false;
tiles.on('tileerror',()=>{if(tileFailure)return;tileFailure=true;showRoadFallback();});
async function showRoadFallback(){const city=state.city,version=regionVersion;try{const network=await api('/api/network',{city});if(version!==regionVersion)return;fallbackLayer.clearLayers();L.geoJSON(network.roads,{style:{color:'#b3bfd2',weight:1.5,opacity:.7}}).addTo(fallbackLayer);$('location-status').textContent='배경 지도를 연결하지 못해 실제 도로 형상으로 표시합니다.';}catch{}}
const marker=(place,text)=>{const p=L.marker([place.coordinate[1],place.coordinate[0]],{icon:L.divIcon({className:'map-pin '+(text==='A'?'start':'end'),html:`<span>${text}</span>`,iconSize:[28,28],iconAnchor:[14,14]})});const label=document.createElement('span');label.textContent=place.label+(place.accessDistance>5?' · 인근 보행로':'');p.bindTooltip(label,{direction:'top',offset:[0,-15]});return p;};
function drawPins(){pinLayer.clearLayers();if(state.origin)marker(state.origin,'A').addTo(pinLayer);if(state.destination)marker(state.destination,'B').addTo(pinLayer);}
function clearRoutes(message='출발지와 도착지를 검색한 뒤 그늘길 찾기를 눌러 주세요.'){
  routeVersion++;state.pendingRoute=null;$('search').disabled=!state.ready;state.routes=[];routeLayer.clearLayers();$('routes').replaceChildren();$('result-count').textContent='';$('route-status').textContent=message;$('insight').textContent='어디로 떠나볼까요?';$('insight-sub').textContent='선택한 장소 사이의 경로를 지도에 표시합니다.';
}
function displayClock(){
  $('date').value=clock.date;$('time').value=clock.minutes;$('time-output').textContent=clockLabel(clock.minutes);$('departure-heading').textContent=clock.live?'현재 시간에 출발':'선택한 시간에 출발';$('timezone-label').textContent=`${regions[state.city].name} 현지 시간 · ${clock.zone}`;$('now').setAttribute('aria-pressed',clock.live);
  const sun=solarAt(clock.epoch,{latitude:regions[state.city].center[1],longitude:regions[state.city].center[0]});$('sun-symbol').textContent=sun.up>0?'☀':'☾';$('solar-label').textContent=sun.up>0?`태양 고도 약 ${Math.round(sun.altitude)}°`:'야간 · 직사광선 없음';
}
async function refreshShade(){const version=++shadeVersion,region=regionVersion;shadeLayer.clearLayers();if(!state.ready)return;
  try{const snapshot=await api('/api/shade',{city:state.city,departure:new Date(clock.epoch).toISOString()});if(version!==shadeVersion||region!==regionVersion)return;
    for(const f of snapshot.features)L.circle([f.geometry.coordinates[1],f.geometry.coordinates[0]],{radius:13,color:'#63799d',weight:0,fillOpacity:.24,interactive:false}).addTo(shadeLayer);
  }catch{ /* Route cards retain their own explicit coverage status. */ }
}
const searchControllers={};
function hideOptions(id){const c=searchControllers[id];if(c){c.version++;c.items=[];c.active=-1;}$(id+'-options').hidden=true;$(id).setAttribute('aria-expanded','false');$(id).removeAttribute('aria-activedescendant');}
function selectPlace(id,place){state[id]=place;$(id).value=place.label;hideOptions(id);clearRoutes(state.origin&&state.destination?'그늘길 찾기를 누르면 경로를 지도에 표시해 드려요.':undefined);drawPins();map.panTo([place.coordinate[1],place.coordinate[0]],{animate:false});}
for(const id of ['origin','destination']){
  const input=$(id),box=$(id+'-options'),controller={version:0,items:[],active:-1,timer:null};searchControllers[id]=controller;
  controller.show=async()=>{
    if(!state.ready){$('route-status').textContent='먼저 지원 지역을 선택해 주세요.';return;}
    const serial=++controller.version,region=regionVersion;box.hidden=false;box.replaceChildren();input.setAttribute('aria-expanded','true');
    try{const items=await api('/api/places',{city:state.city,q:input.value,mode:state.mode});if(serial!==controller.version||region!==regionVersion)return;controller.items=items;controller.active=-1;box.replaceChildren();
      if(!items.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='시범 구역 안에서 찾지 못했어요. 다른 장소명이나 영문 이름으로 검색해 주세요.';box.append(empty);}
      items.forEach((place,i)=>{const button=document.createElement('button');button.type='button';button.id=`${id}-option-${i}`;button.setAttribute('role','option');button.setAttribute('aria-selected','false');const name=document.createElement('span');name.textContent=place.label;const sub=document.createElement('small');sub.textContent=`${regions[state.city].name} · ${regions[state.city].area}${place.accessDistance>5?' · 인근 보행로 기준':''}`;button.append(name,sub);button.onclick=()=>selectPlace(id,place);box.append(button);});
    }catch(e){if(serial===controller.version){box.replaceChildren();const empty=document.createElement('div');empty.className='empty';empty.textContent=e.message;box.append(empty);}}
  };
  input.onfocus=()=>controller.show();
  input.oninput=()=>{hideOptions(id);state[id]=null;drawPins();clearRoutes();clearTimeout(controller.timer);controller.timer=setTimeout(controller.show,150);};
  input.onkeydown=event=>{
    if(event.key==='Escape'){hideOptions(id);return;}
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();if(box.hidden){controller.show();return;}if(!controller.items.length)return;controller.active=(controller.active+(event.key==='ArrowDown'?1:-1)+controller.items.length)%controller.items.length;[...box.querySelectorAll('button')].forEach((b,i)=>b.setAttribute('aria-selected',i===controller.active));input.setAttribute('aria-activedescendant',`${id}-option-${controller.active}`);box.children[controller.active]?.scrollIntoView({block:'nearest'});}
    if(event.key==='Enter'){event.preventDefault();if(!box.hidden&&controller.items.length)selectPlace(id,controller.items[Math.max(0,controller.active)]);else if(state.origin&&state.destination)computeRoutes();else controller.show();}
  };
}
document.addEventListener('click',event=>{for(const id of ['origin','destination'])if(!$(id).parentElement.contains(event.target))hideOptions(id);});
function text(tag,value,className){const e=document.createElement(tag);e.textContent=value;if(className)e.className=className;return e;}
const titles={shade:'그늘 우선',balanced:'균형 경로',fast:'최단 시간'};
function renderRoutes(){
  $('routes').replaceChildren();$('result-count').textContent=`${state.routes.length} ROUTES`;
  const order=['shade','balanced','fast'];
  for(const kind of order){const r=state.routes.find(r=>r.kind===kind);if(!r)continue;const e=r.exposure;const button=document.createElement('button');button.className='route-card'+(kind===state.kind?' selected':'');button.setAttribute('aria-pressed',kind===state.kind);button.setAttribute('aria-label',`${titles[kind]}, ${Math.ceil(r.duration)}분`);
    const top=document.createElement('div');top.className='card-top';const radio=document.createElement('span');radio.className='radio';top.append(radio,text('span',titles[kind]),text('span',kind==='shade'?'햇빛 회피':kind==='balanced'?'시간과 그늘':'시간 중심','badge'));
    const stats=document.createElement('div');stats.className='card-stats';const minutes=text('b',String(Math.ceil(r.duration)));minutes.append(text('small','분'));stats.append(minutes,text('span',`· ${(r.distance/1000).toFixed(2)} km`,'distance'));
    if(e)stats.append(text('span',e.night>=r.duration*.99?'직사광선 없음':`그늘 약 ${e.shade.toFixed(1)}분`,'shade-stat'));
    const bar=document.createElement('div');bar.className='shade-bar';if(e)for(const key of ['shade','sun','unknown','night']){const span=document.createElement('span');span.className='exposure-'+key;span.style.width=`${r.duration?100*e[key]/r.duration:0}%`;bar.append(span);}
    const bottom=document.createElement('div');bottom.className='card-bottom';bottom.append(text('span',e?`햇빛 ${e.sun.toFixed(1)}분 · 평가 불가 ${e.unknown.toFixed(1)}분`:'그늘 정보 준비 중'),text('span',`${arrivalLabel(clock.epoch,r.duration,clock.timeZone)} 도착`));
    button.append(top,stats,bar,bottom);if(e&&e.unknown>.05)button.append(text('p',`전체 시간 중 ${Math.round(e.assessedFraction*100)}%에서 햇빛·그늘을 평가할 수 있어요.`,'coverage'));
    button.onclick=()=>{state.kind=kind;renderRoutes();drawRoute(false);};$('routes').append(button);
  }
}
function drawRoute(fit=true){
  routeLayer.clearLayers();const selected=state.routes.find(r=>r.kind===state.kind)||state.routes[0];if(!selected)return;
  for(const r of state.routes.filter(r=>r!==selected))L.polyline(r.geometry.coordinates.map(([lon,lat])=>[lat,lon]),{color:'#8ca6dd',weight:3,opacity:.45}).addTo(routeLayer);
  const points=selected.geometry.coordinates.map(([lon,lat])=>[lat,lon]);L.polyline(points,{color:'#fff',weight:9,opacity:.95}).addTo(routeLayer);L.polyline(points,{color:'#3563f3',weight:5,opacity:1}).addTo(routeLayer);drawPins();
  if(fit&&points.length>1)map.fitBounds(L.latLngBounds(points),{padding:[55,75],maxZoom:17,animate:false});
  $('insight').textContent=`${titles[selected.kind]} · ${(selected.distance/1000).toFixed(2)}km`;
  const e=selected.exposure;$('insight-sub').textContent=e?e.night>=selected.duration*.99?'해가 진 시간에는 직사광선이 없어요.':`그늘 추정 ${e.shade.toFixed(1)}분 · 평가 불가 ${e.unknown.toFixed(1)}분`:'이 지역의 건물 정보를 준비하고 있어요.';
}
async function computeRoutes(){
  if(!state.ready)return;if(!$('date').reportValidity()||!$('time-error').hidden)return;
  for(const id of ['origin','destination'])if(!state[id]){$('route-status').textContent=`검색 결과에서 ${id==='origin'?'출발지':'도착지'}를 선택해 주세요.`;$(id).focus();return;}
  const serial=++routeVersion,region=regionVersion;state.pendingRoute=serial;$('search').disabled=true;$('route-status').textContent='선택한 시간의 그늘길을 찾고 있어요…';routeLayer.clearLayers();$('routes').replaceChildren();
  try{const results=await api('/api/route',{city:state.city,startNode:state.origin.nodeId,endNode:state.destination.nodeId,mode:state.mode,departure:new Date(clock.epoch).toISOString()});if(serial!==routeVersion||region!==regionVersion)return;state.routes=results;if(!results.some(r=>r.kind===state.kind))state.kind=results[0].kind;renderRoutes();drawRoute();if(window.matchMedia('(max-width:760px)').matches)document.querySelector('.map-panel').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'start'});$('route-status').textContent='선택한 경로를 지도에 표시했어요.';
  }catch(e){if(serial===routeVersion){clearRoutes(e.message);$('insight').textContent='이 조건으로 길을 찾지 못했어요';}}
  finally{if(region===regionVersion&&state.pendingRoute===serial){state.pendingRoute=null;$('search').disabled=!state.ready;}}
}
async function loadRegion(){
  clearTimeout(timeTimer);timeRecalcWanted=false;const version=++regionVersion;state.city=$('region').value;state.ready=false;state.origin=null;state.destination=null;$('origin').value='';$('destination').value='';for(const id of ['origin','destination'])hideOptions(id);clearRoutes('지역의 장소 정보를 불러오고 있어요.');drawPins();shadeLayer.clearLayers();fallbackLayer.clearLayers();clock.setZone(regions[state.city].zone);displayClock();
  const region=regions[state.city];$('area-name').textContent=`${region.name} · ${region.area}`;map.setView([region.center[1],region.center[0]],16,{animate:false});$('search').disabled=true;for(const id of ['origin','destination'])$(id).disabled=true;
  if(!state.available[state.city]){$('location-status').textContent='이 지역의 길찾기 자료를 준비 중입니다.';$('route-status').textContent='현재 지원되는 다른 지역을 선택해 주세요.';return;}
  try{const area=await api('/api/area',{city:state.city});if(version!==regionVersion)return;state.area=area;state.ready=true;$('search').disabled=false;for(const id of ['origin','destination'])$(id).disabled=false;$('location-status').textContent=`${region.area} 시범 구역의 장소·거리 이름을 검색할 수 있어요.`;$('route-status').textContent='출발지와 도착지를 검색해 주세요.';refreshShade();if(tileFailure)showRoadFallback();}
  catch(e){if(version===regionVersion){$('location-status').textContent=e.message;$('route-status').textContent='지역 자료를 불러오지 못했어요. 다시 선택해 주세요.';}}
}
$('region').onchange=loadRegion;$('search').onclick=computeRoutes;
for(const mode of ['walk','bike'])$(mode).onclick=()=>{if(state.mode===mode)return;state.mode=mode;for(const m of ['walk','bike']){$(m).classList.toggle('active',m===mode);$(m).setAttribute('aria-pressed',m===mode);}clearRoutes();for(const id of ['origin','destination']){if(state[id]?.modes&&!state[id].modes.includes(mode)){state[id]=null;$(id).value='';}hideOptions(id);}drawPins();};
$('swap').onclick=()=>{[state.origin,state.destination]=[state.destination,state.origin];$('origin').value=state.origin?.label||'';$('destination').value=state.destination?.label||'';clearRoutes();drawPins();};
function timeChanged(){timeRecalcWanted ||= state.routes.length>0;try{clock.select($('date').value,+$('time').value);$('time-error').hidden=true;displayClock();clearRoutes();clearTimeout(timeTimer);timeTimer=setTimeout(()=>{const recalc=timeRecalcWanted;timeRecalcWanted=false;refreshShade();if(recalc&&state.origin&&state.destination)computeRoutes();},200);}catch(e){$('time-error').textContent=e.message;$('time-error').hidden=false;}}
$('time').oninput=timeChanged;$('date').onchange=timeChanged;
$('now').onclick=()=>{const recalc=state.routes.length>0;clock.follow();$('time-error').hidden=true;displayClock();clearRoutes();refreshShade();if(recalc)computeRoutes();};
function refreshNow(){if(clock.sync()){const recalc=state.routes.length>0;displayClock();clearRoutes();refreshShade();if(recalc)computeRoutes();}}
setInterval(()=>{if(!document.hidden)refreshNow();},1000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshNow();});window.addEventListener('pageshow',refreshNow);
$('layer').onclick=()=>{state.showShade=!state.showShade;$('layer').classList.toggle('active',state.showShade);$('layer').setAttribute('aria-pressed',state.showShade);state.showShade?shadeLayer.addTo(map):map.removeLayer(shadeLayer);};
$('zoom-in').onclick=()=>map.zoomIn();$('zoom-out').onclick=()=>map.zoomOut();$('reset').onclick=()=>{if(state.routes.length)drawRoute();else map.setView([regions[state.city].center[1],regions[state.city].center[0]],16);};
$('about').onclick=()=>$('help').showModal();$('close-help').onclick=()=>$('help').close();
$('locate').onclick=()=>{
  if(!state.ready||!navigator.geolocation){$('route-status').textContent='지원 지역을 선택한 뒤 위치 기능을 사용해 주세요.';return;}
  const city=state.city,version=regionVersion;$('locate').disabled=true;
  navigator.geolocation.getCurrentPosition(async position=>{try{if(version!==regionVersion)return;const snap=await api('/api/snap',{city,point:JSON.stringify([position.coords.longitude,position.coords.latitude]),mode:state.mode});if(version!==regionVersion)return;selectPlace('origin',{label:'내 위치 인근 보행로',nodeId:snap.id,coordinate:snap.coordinate,accessDistance:snap.distance});}catch(e){$('route-status').textContent='현재 위치 인근에 지원되는 길이 없습니다. 출발지를 검색해 주세요.';}finally{$('locate').disabled=false;}},()=>{$('locate').disabled=false;$('route-status').textContent='위치를 확인하지 못했어요. 출발지를 직접 검색해 주세요.';},{timeout:10000,maximumAge:60000});
};
new ResizeObserver(()=>map.invalidateSize()).observe($('map'));displayClock();
try{const catalog=await api('/api/regions');state.available=catalog.available;for(const option of $('region').options){const region=regions[option.value];option.textContent=`${region.name} · ${region.area}${catalog.available[option.value]?'':' (준비 중)'}`;}await loadRegion();}catch(e){$('location-status').textContent=e.message;$('search').disabled=true;}
