import {api} from './browser-client.mjs';
import {DepartureClock,clockLabel} from './time.mjs';
const $=id=>document.getElementById(id),ns='http://www.w3.org/2000/svg';
const clock=new DepartureClock(new Date(),'Asia/Hong_Kong');
let data,project,request=0,shadeRequest=0,results=[];

function line(coordinates,parent,className){const p=document.createElementNS(ns,'polyline');p.setAttribute('points',coordinates.map(c=>project(c).join(',')).join(' '));p.setAttribute('class',className);parent.append(p);}
function populate(){const previous=[$('start').value,$('end').value],query=$('node-search').value.trim().toLowerCase();
  for(const [i,id]of ['start','end'].entries()){$(id).replaceChildren();for(const node of data.nodes){const text=`${node.name||'연결 지점'} · ${node.level} · ${node.id}`;if(!query||text.toLowerCase().includes(query))$(id).append(new Option(text,node.id));}
    if([...$(id).options].some(o=>o.value===previous[i]))$(id).value=previous[i];else if(i===1&&$(id).options.length>1)$(id).selectedIndex=1;
  }$('find').disabled=!$('start').value||!$('end').value;
}
function clear(){request++;results=[];$('path').replaceChildren();$('details').replaceChildren();$('results').replaceChildren();$('status').textContent='출발·도착 지점을 선택하고 경로를 비교하세요.';}
function displayTime(){ $('date').value=clock.date;$('time').value=clockLabel(clock.minutes);$('clock').textContent=`${clock.live?'현재 시간':'선택 시간'} · ${clock.zone}`;$('now').setAttribute('aria-pressed',clock.live);}
async function refreshShade(){if(!data)return;const serial=++shadeRequest;$('shade-samples').replaceChildren();$('building-status').textContent='건물 데이터를 확인하고 있습니다…';
  try{const snapshot=await api('/api/shade',{city:'hongkong',departure:new Date(clock.epoch).toISOString()});if(serial!==shadeRequest)return;
    for(const f of snapshot.features){const [x,y]=project(f.geometry.coordinates),c=document.createElementNS(ns,'circle');c.setAttribute('cx',x);c.setAttribute('cy',y);c.setAttribute('r',3);c.setAttribute('class','shade-sample');$('shade-samples').append(c);}
    const s=snapshot.buildingStats;$('building-status').textContent=`건물·부분 ${s.features}개 · 높이 사용 가능 ${s.knownHeight}개 · ${snapshot.stats.night?'야간: 직사광선 없음':`지상 그늘 ${snapshot.features.length}개 표본 (${snapshot.spacing}m 간격)`}`;
  }catch(e){if(serial===shadeRequest)$('building-status').textContent=e.message;}
}
for(const id of ['start','end','mode','avoid'])$(id).onchange=clear;
for(const id of ['date','time'])$(id).onchange=()=>{try{const [h,m]=$('time').value.split(':').map(Number);clock.select($('date').value,h*60+m);displayTime();clear();refreshShade();}catch(e){$('status').textContent=e.message;}};
$('now').onclick=()=>{clock.follow();displayTime();clear();refreshShade();};
function refreshTime(){if(clock.sync()){displayTime();clear();refreshShade();}}
setInterval(()=>{if(!document.hidden)refreshTime();},1000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshTime();});displayTime();
$('node-search').oninput=()=>{clear();populate();};
const titles={fast:'최단 시간',balanced:'균형',shade:'그늘 우선'};
function exposureText(e){return e?`모델상 그늘 ${e.shade.toFixed(1)}분 · 햇빛 ${e.sun.toFixed(1)}분 · 평가 불가 ${e.unknown.toFixed(1)}분 · 야간 ${e.night.toFixed(1)}분`:'건물 데이터 미연결';}
function renderRoute(index){const route=results[index];$('path').replaceChildren();$('details').replaceChildren();
  for(const [i,segment]of route.segments.entries()){const e=segment.exposure;let cls='selected';if(e){if(e.unknown>=segment.duration*.5)cls='route-unknown';else if(e.night>=segment.duration*.5)cls='route-night';else if(e.sun>e.shade)cls='route-sun';}line([route.geometry.coordinates[i],route.geometry.coordinates[i+1]],$('path'),cls);}
  for(const c of [route.geometry.coordinates[0],route.geometry.coordinates.at(-1)]){const [x,y]=project(c),circle=document.createElementNS(ns,'circle');circle.setAttribute('cx',x);circle.setAttribute('cy',y);circle.setAttribute('r',6);circle.setAttribute('class','dot');$('path').append(circle);}
  $('status').textContent=`${titles[route.kind]} · ${Math.ceil(route.duration)}분 · ${Math.round(route.distance)}m · ${route.exposure?`평가 가능 ${Math.round(route.exposure.assessedFraction*100)}%`:'그늘 평가 불가'}`;
  for(const [i,button]of [...$('results').children].entries())button.setAttribute('aria-pressed',i===index);
  const summary=document.createElement('p');summary.textContent=exposureText(route.exposure);$('details').append(summary);
  // Group adjacent OSM edges into readable street segments.
  const groups=[];for(const segment of route.segments){const key=`${segment.name}|${segment.kind}|${segment.from.split('@')[1]}|${segment.to.split('@')[1]}`,last=groups.at(-1);if(last?.key===key)last.distance+=segment.distance;else groups.push({key,...segment});}
  for(const segment of groups){const p=document.createElement('p');p.textContent=`${segment.name||'이름 없는 길'} · ${segment.kind} · ${Math.round(segment.distance)}m · ${segment.from.split('@')[1]} → ${segment.to.split('@')[1]}`;$('details').append(p);}
}
$('find').onclick=async()=>{if(!$('date').reportValidity()||!$('time').reportValidity())return;const serial=++request;$('path').replaceChildren();$('details').replaceChildren();$('results').replaceChildren();$('status').textContent='통과 시각의 햇빛 노출로 경로를 비교하고 있습니다…';
  try{const fresh=await api('/api/route',{city:'hongkong',departure:new Date(clock.epoch).toISOString(),startNode:$('start').value,endNode:$('end').value,mode:$('mode').value,avoidSteps:$('avoid').checked});if(serial!==request)return;results=fresh;
    results.forEach((route,i)=>{const button=document.createElement('button');button.textContent=`${titles[route.kind]} · ${Math.ceil(route.duration)}분 / ${Math.round(route.distance)}m · ${exposureText(route.exposure)}`;button.onclick=()=>renderRoute(i);$('results').append(button);});renderRoute(0);
  }catch(e){if(serial===request)$('status').textContent=e.message;}
};
try{data=await api('/api/network',{city:'hongkong'});if(!data.nodes.length)throw new Error('표시할 도로망이 없습니다.');
  let west=Infinity,east=-Infinity,south=Infinity,north=-Infinity;for(const n of data.nodes){west=Math.min(west,n.coordinate[0]);east=Math.max(east,n.coordinate[0]);south=Math.min(south,n.coordinate[1]);north=Math.max(north,n.coordinate[1]);}
  const cos=Math.cos((north+south)/2*Math.PI/180),scale=Math.min(940/Math.max(1e-6,(east-west)*cos),640/Math.max(1e-6,north-south));
  project=([lon,lat])=>[30+(lon-west)*cos*scale,670-(lat-south)*scale];
  for(const f of data.roads.features)line(f.geometry.coordinates,$('roads'),'road'+(f.properties.kind==='bridge'?' bridge':''));
  populate();for(const [id,value]of [['start','3334802079@ground'],['end','14205438441@ground']])if([...$(id).options].some(o=>o.value===value))$(id).value=value;
  $('status').textContent=`노드 ${data.nodes.length}개 · 가져온 도로 ${data.audit.ways}개`;
  refreshShade();
}catch(e){$('status').textContent=e.message;}
