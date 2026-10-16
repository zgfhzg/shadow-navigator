import * as L from './vendor/leaflet.mjs';
import {api} from './browser-client.mjs';
import {regions,countries,regionAt} from './regions.mjs';
import {DepartureClock,clockLabel,arrivalLabel} from './time.mjs';
import {solarAt} from './engine.mjs';
const $=id=>document.getElementById(id);
const clock=new DepartureClock(new Date(),regions.hongkong.zone);
const state={country:'hongkong',city:'hongkong',user:null,pick:null,mode:'walk',kind:'shade',ready:false,available:{},area:null,origin:null,destination:null,routes:[],showShade:true};
let regionVersion=0,routeVersion=0,shadeVersion=0,timeTimer,timeRecalcWanted=false;
const map=L.map('map',{zoomControl:false,preferCanvas:true,attributionControl:true}).setView([22.2819,114.1589],16);
map.attributionControl.setPrefix(false);
const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',keepBuffer:1}).addTo(map);
map.on('moveend',()=>{const c=map.getCenter(),city=regionAt([c.lng,c.lat],state.country,state.available);$('area-name').textContent=city?`${regions[city].name} · ${regions[city].area}`:countries[state.country].name+' 지도';});
const routeLayer=L.layerGroup().addTo(map),pinLayer=L.layerGroup().addTo(map),shadeLayer=L.layerGroup().addTo(map),fallbackLayer=L.layerGroup().addTo(map);
const userLayer=L.layerGroup().addTo(map),coverageLayer=L.layerGroup().addTo(map);
let watchId=null,userMarker=null,userAccuracy=null;
let tileFailure=false;
tiles.on('tileerror',()=>{if(tileFailure)return;tileFailure=true;showRoadFallback();});
async function showRoadFallback(){const city=state.city,version=regionVersion;try{const network=await api('/api/network',{city});if(version!==regionVersion)return;fallbackLayer.clearLayers();L.geoJSON(network.roads,{style:{color:'#b3bfd2',weight:1.5,opacity:.7}}).addTo(fallbackLayer);$('location-status').textContent='배경 지도를 연결하지 못해 실제 도로 형상으로 표시합니다.';}catch{}}
const marker=(place,text)=>{const p=L.marker([place.coordinate[1],place.coordinate[0]],{icon:L.divIcon({className:'map-pin '+(text==='A'?'start':'end'),html:`<span>${text}</span>`,iconSize:[28,28],iconAnchor:[14,14]})});const label=document.createElement('span');label.textContent=place.label+(place.accessDistance>5?' · 인근 보행로':'');p.bindTooltip(label,{direction:'top',offset:[0,-15]});return p;};
function drawPins(){pinLayer.clearLayers();if(state.origin)marker(state.origin,'A').addTo(pinLayer);if(state.destination)marker(state.destination,'B').addTo(pinLayer);}
function clearRoutes(message='출발지와 도착지를 검색한 뒤 그늘길 찾기를 눌러 주세요.'){
  routeVersion++;state.pendingRoute=null;$('search').disabled=!state.ready;state.routes=[];routeLayer.clearLayers();$('routes').replaceChildren();$('result-count').textContent='';$('route-status').textContent=message;$('insight').textContent='어디로 떠나볼까요?';$('insight-sub').textContent='선택한 장소 사이의 경로를 지도에 표시합니다.';
}
function displayClock(){
  $('date').value=clock.date;$('time').value=clock.minutes;$('time-output').textContent=clockLabel(clock.minutes);$('departure-heading').textContent=clock.live?'현재 시간에 출발':'선택한 시간에 출발';$('timezone-label').textContent=`${countries[state.country].name} 현지 시간 · ${clock.zone}`;$('now').setAttribute('aria-pressed',clock.live);
  const sun=solarAt(clock.epoch,{latitude:regions[state.city].center[1],longitude:regions[state.city].center[0]});$('sun-symbol').textContent=sun.up>0?'☀':'☾';$('solar-label').textContent=sun.up>0?`태양 고도 약 ${Math.round(sun.altitude)}°`:'야간 · 직사광선 없음';
}
async function refreshShade(){const version=++shadeVersion,region=regionVersion;shadeLayer.clearLayers();if(!state.ready)return;
  try{const snapshot=await api('/api/shade',{city:state.city,departure:new Date(clock.epoch).toISOString()});if(version!==shadeVersion||region!==regionVersion)return;
    for(const f of snapshot.features)L.circle([f.geometry.coordinates[1],f.geometry.coordinates[0]],{radius:13,color:'#63799d',weight:0,fillOpacity:.24,interactive:false}).addTo(shadeLayer);
  }catch{ /* Route cards retain their own explicit coverage status. */ }
}
const searchControllers={};
function hideOptions(id){const c=searchControllers[id];if(c){c.version++;c.items=[];c.active=-1;}$(id+'-options').hidden=true;$(id).setAttribute('aria-expanded','false');$(id).removeAttribute('aria-activedescendant');}
async function selectPlace(id,place){
  const city=place.city||state.city;
  if(place.type==='area'){hideOptions(id);$(id).value='';await loadRegion(city,false);map.setView([place.coordinate[1],place.coordinate[0]],16,{animate:false});$('route-status').textContent='지도를 이동했어요. 장소명을 검색하거나 지도에서 출발·도착을 지정하세요.';return;}
  const switched=city!==state.city,hadOther=!!state[id==='origin'?'destination':'origin'];
  if(switched){await loadRegion(city,false);if(state.city!==city||!state.ready)return;}
  state[id]=place;$(id).value=place.label;hideOptions(id);clearRoutes(state.origin&&state.destination?'그늘길 찾기를 누르면 경로를 지도에 표시해 드려요.':undefined);drawPins();map.panTo([place.coordinate[1],place.coordinate[0]],{animate:false});if(switched&&hadOther)$('route-status').textContent='도시 간 경로는 아직 지원하지 않아 이전 지점을 지웠어요. 같은 도시에서 다른 지점도 선택해 주세요.';}
for(const id of ['origin','destination']){
  const input=$(id),box=$(id+'-options'),controller={version:0,items:[],active:-1,timer:null};searchControllers[id]=controller;
  controller.show=async()=>{
    if(!state.ready){$('route-status').textContent='먼저 지원 지역을 선택해 주세요.';return;}
    const serial=++controller.version,country=state.country;box.hidden=false;box.replaceChildren();input.setAttribute('aria-expanded','true');
    try{const groups=await Promise.all(countries[country].cities.filter(city=>state.available[city]).map(async city=>(await api('/api/places',{city,q:input.value,mode:state.mode})).map(place=>({...place,city}))));const q=input.value.trim().toLowerCase();const aliases={tokyo:['도쿄','tokyo','東京'],osaka:['오사카','osaka','大阪'],kyoto:['교토','kyoto','京都'],hongkong:['홍콩','hong kong','香港']};const areas=q?countries[country].cities.filter(city=>aliases[city].some(name=>name.toLowerCase().includes(q))).map(city=>({type:'area',city,label:regions[city].name+' 지도에서 보기',coordinate:regions[city].center})):[];const items=[...areas,...groups.flat()].slice(0,18);if(serial!==controller.version||country!==state.country)return;controller.items=items;controller.active=-1;box.replaceChildren();
      if(!items.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='현재 지원 범위에서 찾지 못했어요. 지도 점선 안을 선택하거나 다른 장소명으로 검색해 주세요.';box.append(empty);}
      items.forEach((place,i)=>{const button=document.createElement('button');button.type='button';button.id=`${id}-option-${i}`;button.setAttribute('role','option');button.setAttribute('aria-selected','false');const name=document.createElement('span');name.textContent=place.label;const sub=document.createElement('small');sub.textContent=`${regions[place.city].name} · ${regions[place.city].area}${place.accessDistance>5?' · 인근 보행로 기준':''}`;button.append(name,sub);button.onclick=()=>selectPlace(id,place);box.append(button);});
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
  if(fit&&points.length>1)fitEverything();
  $('insight').textContent=`${titles[selected.kind]} · ${(selected.distance/1000).toFixed(2)}km`;
  const e=selected.exposure;$('insight-sub').textContent=e?e.night>=selected.duration*.99?'해가 진 시간에는 직사광선이 없어요.':`그늘 추정 ${e.shade.toFixed(1)}분 · 평가 불가 ${e.unknown.toFixed(1)}분`:'이 지역의 건물 정보를 준비하고 있어요.';
}
async function computeRoutes({scroll=true}={}){
  if(!state.ready)return;if(!$('date').reportValidity()||!$('time-error').hidden)return;
  for(const id of ['origin','destination'])if(!state[id]){$('route-status').textContent=`검색 결과에서 ${id==='origin'?'출발지':'도착지'}를 선택해 주세요.`;$(id).focus();return;}
  const serial=++routeVersion,region=regionVersion;state.pendingRoute=serial;$('search').disabled=true;$('route-status').textContent='선택한 시간의 그늘길을 찾고 있어요…';routeLayer.clearLayers();$('routes').replaceChildren();
  try{const results=await api('/api/route',{city:state.city,startNode:state.origin.nodeId,endNode:state.destination.nodeId,mode:state.mode,departure:new Date(clock.epoch).toISOString()});if(serial!==routeVersion||region!==regionVersion)return;state.routes=results;if(!results.some(r=>r.kind===state.kind))state.kind=results[0].kind;renderRoutes();drawRoute();if(scroll&&window.matchMedia('(max-width:760px)').matches)document.querySelector('.map-panel').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'start'});$('route-status').textContent='선택한 경로를 지도에 표시했어요.';
  }catch(e){if(serial===routeVersion){clearRoutes(e.message);$('insight').textContent='이 조건으로 길을 찾지 못했어요';}}
  finally{if(region===regionVersion&&state.pendingRoute===serial){state.pendingRoute=null;$('search').disabled=!state.ready;}}
}
async function loadRegion(city=countries[state.country].cities.find(c=>state.available[c]),resetView=true){
  clearTimeout(timeTimer);timeRecalcWanted=false;const version=++regionVersion;state.city=city;state.ready=false;state.origin=null;state.destination=null;$('origin').value='';$('destination').value='';for(const id of ['origin','destination'])hideOptions(id);clearRoutes('지역의 장소 정보를 불러오고 있어요.');$('location-status').textContent='장소 정보를 불러오고 있어요…';drawPins();shadeLayer.clearLayers();fallbackLayer.clearLayers();clock.setZone(regions[state.city].zone);displayClock();
  const region=regions[state.city];if(resetView)$('area-name').textContent=`${region.name} · ${region.area}`;if(resetView)map.setView([region.center[1],region.center[0]],16,{animate:false});$('search').disabled=true;for(const id of ['origin','destination'])$(id).disabled=true;
  if(!state.available[state.city]){$('location-status').textContent='이 지역의 길찾기 자료를 준비 중입니다.';$('route-status').textContent='현재 지원되는 다른 지역을 선택해 주세요.';return;}
  try{const area=await api('/api/area',{city:state.city});if(version!==regionVersion)return;state.area=area;state.ready=true;$('search').disabled=false;for(const id of ['origin','destination'])$(id).disabled=false;$('location-status').textContent=`${countries[state.country].name}의 장소를 검색하거나 지도에서 지점을 선택하세요. 길찾기는 점선 안에서 지원합니다.`;$('route-status').textContent='출발지와 도착지를 검색해 주세요.';refreshShade();if(tileFailure)showRoadFallback();}
  catch(e){if(version===regionVersion){$('location-status').textContent=e.message;$('route-status').textContent='지역 자료를 불러오지 못했어요. 다시 선택해 주세요.';}}
}
$('region').onchange=async()=>{state.country=$('region').value;if(state.pick)pickMode(state.pick);drawCoverage();const c=countries[state.country];map.setView([c.center[1],c.center[0]],c.zoom,{animate:false});await loadRegion(undefined,false);};$('search').onclick=computeRoutes;
for(const mode of ['walk','bike'])$(mode).onclick=()=>{if(state.mode===mode)return;state.mode=mode;for(const m of ['walk','bike']){$(m).classList.toggle('active',m===mode);$(m).setAttribute('aria-pressed',m===mode);}clearRoutes();for(const id of ['origin','destination']){if(state[id]?.modes&&!state[id].modes.includes(mode)){state[id]=null;$(id).value='';}hideOptions(id);}drawPins();};
$('swap').onclick=()=>{[state.origin,state.destination]=[state.destination,state.origin];$('origin').value=state.origin?.label||'';$('destination').value=state.destination?.label||'';clearRoutes();drawPins();};
function timeChanged(){timeRecalcWanted ||= state.routes.length>0;try{clock.select($('date').value,+$('time').value);$('time-error').hidden=true;displayClock();clearRoutes();clearTimeout(timeTimer);timeTimer=setTimeout(()=>{const recalc=timeRecalcWanted;timeRecalcWanted=false;refreshShade();if(recalc&&state.origin&&state.destination)computeRoutes({scroll:false});},200);}catch(e){$('time-error').textContent=e.message;$('time-error').hidden=false;}}
$('time').oninput=timeChanged;$('date').onchange=timeChanged;
$('now').onclick=()=>{const recalc=state.routes.length>0;clock.follow();$('time-error').hidden=true;displayClock();clearRoutes();refreshShade();if(recalc)computeRoutes({scroll:false});};
function refreshNow(){if(clock.sync()){const recalc=state.routes.length>0;displayClock();clearRoutes();refreshShade();if(recalc)computeRoutes({scroll:false});}}
setInterval(()=>{if(!document.hidden)refreshNow();},1000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshNow();});window.addEventListener('pageshow',refreshNow);
$('layer').onclick=()=>{state.showShade=!state.showShade;$('layer').classList.toggle('active',state.showShade);$('layer').setAttribute('aria-pressed',state.showShade);state.showShade?shadeLayer.addTo(map):map.removeLayer(shadeLayer);};
$('zoom-in').onclick=()=>map.zoomIn();$('zoom-out').onclick=()=>map.zoomOut();$('reset').onclick=fitEverything;
$('about').onclick=()=>$('help').showModal();$('close-help').onclick=()=>$('help').close();

function drawCoverage(){
  coverageLayer.clearLayers();
  for(const city of countries[state.country].cities){if(!state.available[city])continue;const [w,s,e,n]=regions[city].bounds;
    const box=L.rectangle([[s,w],[n,e]],{color:'#7b8cad',weight:1.5,dashArray:'5 5',fillOpacity:.025,interactive:false}).addTo(coverageLayer);
    const label=document.createElement('span');label.textContent=regions[city].name+' · 길찾기 지원';box.bindTooltip(label,{permanent:true,direction:'center',className:'coverage-label'});
  }
}
function fitEverything(){
  const route=state.routes.find(r=>r.kind===state.kind)||state.routes[0];
  const points=route?route.geometry.coordinates.map(([lon,lat])=>[lat,lon]):[state.origin,state.destination].filter(Boolean).map(p=>[p.coordinate[1],p.coordinate[0]]);
  if(state.user)points.push([state.user.latitude,state.user.longitude]);
  if(points.length)map.fitBounds(L.latLngBounds(points),{paddingTopLeft:window.matchMedia('(max-width:760px)').matches?[25,240]:[36,195],paddingBottomRight:[45,85],maxZoom:17,animate:false});
  else {const c=countries[state.country];map.setView([c.center[1],c.center[0]],c.zoom);}
}
$('fit-all').onclick=fitEverything;
const userStart=document.createElement('button');userStart.id='start-here';userStart.type='button';userStart.textContent='내 위치에서 출발';userStart.hidden=true;document.querySelector('.map-actions').append(userStart);
userStart.onclick=async()=>{if(!state.user)return;const point=[state.user.longitude,state.user.latitude];const country=Object.keys(countries).find(c=>regionAt(point,c,state.available));if(!country){$('route-status').textContent='현재 위치는 길찾기 지원 범위 밖입니다. 지도 점선 안의 출발지를 선택해 주세요.';return;}const city=regionAt(point,country,state.available);try{const snap=await api('/api/snap',{city,point:JSON.stringify(point),mode:state.mode});state.country=country;$('region').value=country;drawCoverage();await selectPlace('origin',{city,label:'내 위치 인근 보행로',nodeId:snap.id,coordinate:snap.coordinate,accessDistance:snap.distance});}catch{$('route-status').textContent='현재 위치 가까이 연결된 길을 찾지 못했어요. 지도에서 출발지를 선택해 주세요.';}};
function pickMode(id){state.pick=state.pick===id?null:id;for(const key of ['origin','destination'])$('pick-'+key).setAttribute('aria-pressed',state.pick===key);$('map').classList.toggle('picking',!!state.pick);if(state.pick)$('route-status').textContent=`지도 점선 안의 길을 눌러 ${state.pick==='origin'?'출발지':'도착지'}를 지정하세요.`;}
for(const id of ['origin','destination'])$('pick-'+id).onclick=()=>pickMode(id);
map.on('click',async event=>{
  if(!state.pick)return;const id=state.pick,point=[event.latlng.lng,event.latlng.lat],country=state.country;
  const city=regionAt(point,country,state.available);
  if(!city){$('route-status').textContent='이곳의 길찾기 자료는 아직 없습니다. 지도 점선 안의 길을 선택해 주세요.';return;}
  try{const snap=await api('/api/snap',{city,point:JSON.stringify(point),mode:state.mode});if(country!==state.country||id!==state.pick)return;
    await selectPlace(id,{city,label:`지도에서 선택한 ${id==='origin'?'출발지':'도착지'}`,nodeId:snap.id,coordinate:snap.coordinate,accessDistance:snap.distance});if(id===state.pick)pickMode(id);
  }catch(e){$('route-status').textContent='선택 지점에서 연결된 길을 찾지 못했어요. 가까운 도로나 보행로를 눌러 주세요.';}
});
function stopLocation(){if(watchId!==null)navigator.geolocation.clearWatch(watchId);watchId=null;$('stop-location').hidden=true;userStart.hidden=true;$('locate').textContent='내 위치';$('gps-status').textContent=state.user?'위치 갱신 중단 · 마지막 위치 표시':'위치 추적이 꺼졌어요.';}
const stopButton=document.createElement('button');stopButton.id='stop-location';stopButton.type='button';stopButton.textContent='위치 끄기';stopButton.hidden=true;stopButton.onclick=stopLocation;$('locate').after(stopButton);
$('locate').onclick=()=>{
  if(!navigator.geolocation){$('gps-status').textContent='이 브라우저에서는 위치 기능을 사용할 수 없어요.';return;}
  if(watchId!==null){fitEverything();return;}
  $('gps-status').textContent='현재 위치를 확인하고 있어요…';$('locate').textContent='위치 확인 중';let first=true;
  watchId=navigator.geolocation.watchPosition(position=>{
    const {latitude,longitude,accuracy}=position.coords;state.user={latitude,longitude,accuracy};
    const latlng=[latitude,longitude];
    if(!userMarker){userMarker=L.marker(latlng,{icon:L.divIcon({className:'user-location',html:'<span></span>',iconSize:[24,24],iconAnchor:[12,12]}),zIndexOffset:1000}).addTo(userLayer);userMarker.bindTooltip('내 현재 위치',{direction:'top'});userAccuracy=L.circle(latlng,{radius:accuracy,color:'#3388ff',weight:1,fillOpacity:.09,interactive:false}).addTo(userLayer);}
    else {userMarker.setLatLng(latlng);userAccuracy.setLatLng(latlng).setRadius(accuracy);}
    $('locate').textContent='내 위치 보기';stopButton.hidden=false;userStart.hidden=false;$('gps-status').textContent=`현재 위치 · 정확도 약 ${Math.round(accuracy)}m · ${new Date(position.timestamp).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})} 갱신`;
    if(first){first=false;if(state.routes.length)fitEverything();else map.setView(latlng,16);}
  },error=>{if(error.code===1)stopLocation();$('locate').textContent=watchId===null?'내 위치':'위치 다시 보기';$('gps-status').textContent=error.code===1?'위치 권한이 꺼져 있어요. 브라우저 설정에서 허용하면 내 위치를 표시할 수 있어요.':'현재 위치를 갱신하지 못했어요. 수신이 회복되면 다시 표시합니다.';},{enableHighAccuracy:true,timeout:15000,maximumAge:10000});
};
$('map-locate').onclick=()=>$('locate').onclick();
window.addEventListener('pagehide',()=>{if(watchId!==null)stopLocation();});
new ResizeObserver(()=>map.invalidateSize()).observe($('map'));displayClock();
try{const catalog=await api('/api/regions');state.available=catalog.available;await loadRegion();drawCoverage();}catch(e){$('location-status').textContent=e.message;$('search').disabled=true;}
