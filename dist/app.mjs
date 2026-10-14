import {nodes,edges,buildings,places,shadows,sun,route} from './engine.mjs';
import {DepartureClock, clockLabel, arrivalLabel} from './time.mjs';
const $=id=>document.getElementById(id),svgNS='http://www.w3.org/2000/svg';
const regions = {
  seoul: {name:'서울', latitude:37.54, longitude:127.04},
  tokyo: {name:'도쿄', latitude:35.68, longitude:139.69},
  london: {name:'런던', latitude:51.51, longitude:-.13},
  newyork: {name:'뉴욕', latitude:40.71, longitude:-74.01},
  sydney: {name:'시드니', latitude:-33.87, longitude:151.21},
};
const clock = new DepartureClock();
const state={mode:'walk',kind:'balanced',showShade:true,zoom:1,location:regions.seoul};
let solarContext;
function displayClock() {
  $('date').value=clock.date;
  $('time').value=clock.minutes;
  $('time-output').textContent=clockLabel(clock.minutes);
  $('timezone-label').textContent=`기기 현지 시간 · ${clock.zone}`;
  $('departure-heading').textContent=clock.live?'현재 시간에 출발':'선택한 시간에 출발';
  $('now').setAttribute('aria-pressed',clock.live);
  $('time-error').hidden=true;
}
function selectDeparture() {
  try {
    clock.select($('date').value,+$('time').value);
    displayClock();
    compute();
  } catch(error) {
    $('time-error').textContent=error.message;
    $('time-error').hidden=false;
  }
}

function el(tag,attrs,parent){const e=document.createElementNS(svgNS,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));parent.append(e);return e;}
for(const [name,id]of places){for(const select of [$('origin'),$('destination')]){const o=document.createElement('option');o.value=id;o.textContent=name;select.append(o);}}
$('origin').value=55;$('destination').value=8;
displayClock();
for(const e of edges){const a=nodes[e.a],b=nodes[e.b];el('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'#ffffff','stroke-width':e.walkOnly?10:20,'stroke-linecap':'round'},$('roads'));if(e.walkOnly)el('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'#c1ccc8','stroke-width':2,'stroke-dasharray':'4 5'},$('roads'));}
for(const b of buildings){el('rect',{x:b.x,y:b.y,width:b.w,height:b.h,rx:3,fill:'#e3e6eb',stroke:'#d3d8e1','stroke-width':1},$('buildings'));el('line',{x1:b.x+5,y1:b.y+5,x2:b.x+b.w-5,y2:b.y+5,stroke:'#f6f7f9','stroke-width':2},$('buildings'));}
function drawLabels() {
  const seoul=$('region').value==='seoul';
  const names=seoul?['서울숲','SEOUL FOREST','성수동','SEONGSU','연무장길','성수이로','왕십리로']:['예제 공원','DEMO PARK','가상 도시','DEMO CITY','카페 거리','중앙로','공원로'];
  $('labels').replaceChildren();
  [[852,143,22],[852,166,8],[428,348,20],[428,370,8],[530,466,10],[214,420,10],[533,62,10]].forEach(([x,y,size],i)=>{
    const t=el('text',{x,y,'font-size':size,fill:'#8993a2','text-anchor':'middle','letter-spacing':size>15?4:1},$('labels'));t.textContent=names[i];
  });
  const generic=['출발 광장','공원 입구','카페 거리','아틀리에','중앙역','공원 카페'];
  for(const id of ['origin','destination'])Array.from($(id).options).forEach((o,i)=>o.textContent=seoul?places[i][0]:generic[i]);
  $('area-name').textContent=seoul?'성수 · 서울숲':`${state.location.name} · 가상 지도`;
}
drawLabels();
let results=[];
function compute(){if(!$('date').value){$('date').reportValidity();return;}const time=clock.minutes,date=clock.date;solarContext={...state.location,epoch:clock.epoch,minute:time};const s=sun(date,time,solarContext);$('time-output').textContent=clockLabel(time);$('sun-symbol').textContent=s.up>0?'☀':'☾';$('solar-label').textContent=s.up>0?`태양 고도 ${Math.round(s.altitude)}° · ${state.location.name} 기준 근사치`:'야간 · 직사광선 없음';$('shadows').replaceChildren();if(state.showShade)for(const p of shadows(date,time,solarContext))el('polygon',{points:p.map(p=>p.join(',')).join(' '),fill:'#78849c',opacity:.30},$('shadows'));results=['balanced','shade','fast'].map(kind=>route({start:+$('origin').value,end:+$('destination').value,date,time,mode:state.mode,kind,context:solarContext}));render();}
function render(){const selected=results.find(r=>r.kind===state.kind),titles={balanced:'균형 경로',shade:'그늘 우선',fast:'최단 경로'};$('routes').replaceChildren();for(const r of results){const btn=document.createElement('button');btn.className='route-card'+(r.kind===state.kind?' selected':'');btn.setAttribute('aria-pressed',r.kind===state.kind);btn.dataset.kind=r.kind;btn.innerHTML=`<div class="card-top"><span class="radio"></span>${titles[r.kind]}<span class="badge">${{balanced:'추천',shade:'그늘 중심',fast:'거리 중심'}[r.kind]}</span></div><div class="card-stats"><b>${Math.ceil(r.minutes)}<small>분</small></b><span class="distance">· ${(r.length/1000).toFixed(1)} km</span><span class="shade-stat">그늘 <strong>${Math.round(r.shade*100)}%</strong></span></div><div class="shade-bar"><span style="width:${r.shade*100}%"></span></div><div class="card-bottom"><span>햇빛 노출 약 ${Math.round(r.sunMinutes)}분</span><span>${arrivalLabel(clock.epoch,r.minutes)} 도착 예상</span></div>`;btn.onclick=()=>{state.kind=r.kind;render();};$('routes').append(btn);}
$('route-lines').replaceChildren();for(const r of [...results.filter(r=>r.kind!==state.kind),selected])el('polyline',{points:r.path.map(i=>`${nodes[i].x},${nodes[i].y}`).join(' '),fill:'none',stroke:r.kind===state.kind?'#3563f3':'#b7c2d8','stroke-width':r.kind===state.kind?7:4,'stroke-linejoin':'round','stroke-linecap':'round',opacity:r.kind===state.kind?1:.65},$('route-lines'));
$('pins').replaceChildren();for(const [id,label,color]of [[+$('origin').value,'출발','#fff'],[+$('destination').value,'도착','#3563f3']]){const n=nodes[id];el('circle',{cx:n.x,cy:n.y,r:12,fill:color,stroke:'#3563f3','stroke-width':4},$('pins'));el('rect',{x:n.x-25,y:n.y-46,width:50,height:25,rx:7,fill:'#fff'},$('pins'));const t=el('text',{x:n.x,y:n.y-29,fill:'#3563f3','font-size':11,'text-anchor':'middle'},$('pins'));t.textContent=label;}
const delta=results.find(r=>r.kind==='fast').sunMinutes-selected.sunMinutes;$('insight').textContent=selected.length===0?'출발지와 도착지가 같아요':sun(clock.date,clock.minutes,solarContext).up<=0?'해가 진 시간에는 직사광선이 없어요':delta>.4?`최단 경로보다 햇빛 노출 약 ${Math.round(delta)}분 감소`:`전체 경로 중 약 ${Math.round(selected.shade*100)}%가 그늘이에요`;$('insight-sub').textContent=selected.length===0?'다른 도착지를 선택해 경로를 찾아보세요.':'각 구간의 예상 통과 시각을 반영한 시뮬레이션';}
for(const mode of ['walk','bike'])$(mode).onclick=()=>{state.mode=mode;for(const m of ['walk','bike']){$(m).classList.toggle('active',m===mode);$(m).setAttribute('aria-pressed',m===mode);}compute();};
$('swap').onclick=()=>{const v=$('origin').value;$('origin').value=$('destination').value;$('destination').value=v;compute();};
$('time').oninput=selectDeparture;
$('date').onchange=selectDeparture;
for(const id of ['origin','destination'])$(id).onchange=compute;
$('search').onclick=()=>{if(!$('time-error').hidden)return;compute();};
$('now').onclick=()=>{clock.follow();displayClock();compute();};
function refreshNow(){if(clock.sync()){displayClock();compute();}}
setInterval(()=>{if(!document.hidden)refreshNow();},1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshNow();});
window.addEventListener('pageshow',refreshNow);
$('region').onchange=()=>{
  state.location=regions[$('region').value];
  $('location-status').textContent='지역은 태양 계산에만 반영됩니다. 지도는 가상 예제입니다.';
  drawLabels();compute();
};
$('locate').onclick=()=>{
  if(!navigator.geolocation){$('location-status').textContent='이 브라우저는 위치 기능을 지원하지 않습니다. 도시를 선택해 주세요.';return;}
  $('locate').disabled=true;
  $('location-status').textContent='위치 권한을 허용하면 이 기기에서만 그늘을 계산합니다.';
  navigator.geolocation.getCurrentPosition(position=>{
    regions.current={name:'내 위치',latitude:position.coords.latitude,longitude:position.coords.longitude};
    if(!Array.from($('region').options).some(o=>o.value==='current')){
      const option=document.createElement('option');option.value='current';option.textContent='내 위치 · 가상 지도';$('region').append(option);
    }
    $('region').value='current';state.location=regions.current;
    $('location-status').textContent='내 위치로 태양 계산 중 · 지도는 가상 예제입니다. 위치는 저장·전송하지 않습니다.';
    $('locate').disabled=false;drawLabels();compute();
  },error=>{
    $('locate').disabled=false;
    $('location-status').textContent=error.code===1?'위치 권한이 허용되지 않았습니다. 도시를 직접 선택해 주세요.':'위치를 확인하지 못했습니다. 다시 시도하거나 도시를 선택해 주세요.';
  },{enableHighAccuracy:false,timeout:10000,maximumAge:60000});
};
$('layer').onclick=()=>{state.showShade=!state.showShade;$('layer').classList.toggle('active',state.showShade);$('layer').setAttribute('aria-pressed',state.showShade);compute();};
function zoom(d){state.zoom=d===0?1:Math.min(2,Math.max(.8,state.zoom+d));$('viewport').setAttribute('transform',`translate(${500*(1-state.zoom)},${380*(1-state.zoom)}) scale(${state.zoom})`);}$('zoom-in').onclick=()=>zoom(.2);$('zoom-out').onclick=()=>zoom(-.2);$('reset').onclick=()=>zoom(0);$('about').onclick=()=>$('help').showModal();$('close-help').onclick=()=>$('help').close();compute();
