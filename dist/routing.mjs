const $=id=>document.getElementById(id),ns='http://www.w3.org/2000/svg';
let data,project,request=0;
async function api(path,params={}){const r=await fetch(path+'?'+new URLSearchParams(params));if(!r.headers.get('content-type')?.includes('application/json'))throw new Error('로컬 Node 서버에서 실행해 주세요.');const data=await r.json();if(!r.ok)throw new Error(data.error);return data;}
function line(coordinates,parent,className){const p=document.createElementNS(ns,'polyline');p.setAttribute('points',coordinates.map(c=>project(c).join(',')).join(' '));p.setAttribute('class',className);parent.append(p);}
function populate(){const previous=[$('start').value,$('end').value],query=$('node-search').value.trim().toLowerCase();
  for(const [i,id]of ['start','end'].entries()){$(id).replaceChildren();for(const node of data.nodes){const text=`${node.name||'연결 지점'} · ${node.level} · ${node.id}`;if(!query||text.toLowerCase().includes(query))$(id).append(new Option(text,node.id));}
    if([...$(id).options].some(o=>o.value===previous[i]))$(id).value=previous[i];else if(i===1&&$(id).options.length>1)$(id).selectedIndex=1;
  }$('find').disabled=!$('start').value||!$('end').value;
}
function clear(){request++;$('path').replaceChildren();$('details').replaceChildren();$('status').textContent='출발·도착 노드를 선택해 경로를 확인하세요.';}
for(const id of ['start','end','mode','avoid'])$(id).onchange=clear;
$('node-search').oninput=()=>{clear();populate();};
$('find').onclick=async()=>{const serial=++request;$('path').replaceChildren();$('details').replaceChildren();$('status').textContent='자체 엔진으로 계산 중…';
  try{const [route]=await api('/api/route',{city:'hongkong',startNode:$('start').value,endNode:$('end').value,mode:$('mode').value,avoidSteps:$('avoid').checked});if(serial!==request)return;
    line(route.geometry.coordinates,$('path'),'selected');for(const c of [route.geometry.coordinates[0],route.geometry.coordinates.at(-1)]){const [x,y]=project(c),circle=document.createElementNS(ns,'circle');circle.setAttribute('cx',x);circle.setAttribute('cy',y);circle.setAttribute('r',6);circle.setAttribute('class','dot');$('path').append(circle);}
    $('status').textContent=`${Math.ceil(route.duration)}분 · ${Math.round(route.distance)}m · ${route.segments.length}개 구간`;
    for(const segment of route.segments){const p=document.createElement('p');p.textContent=`${segment.name||'이름 없는 길'} · ${segment.kind} · ${segment.from.split('@')[1]} → ${segment.to.split('@')[1]}`;$('details').append(p);}
  }catch(e){if(serial===request)$('status').textContent=e.message;}
};
try{data=await api('/api/network',{city:'hongkong'});if(!data.nodes.length)throw new Error('표시할 도로망이 없습니다.');
  let west=Infinity,east=-Infinity,south=Infinity,north=-Infinity;for(const n of data.nodes){west=Math.min(west,n.coordinate[0]);east=Math.max(east,n.coordinate[0]);south=Math.min(south,n.coordinate[1]);north=Math.max(north,n.coordinate[1]);}
  const cos=Math.cos((north+south)/2*Math.PI/180),scale=Math.min(940/Math.max(1e-6,(east-west)*cos),640/Math.max(1e-6,north-south));
  project=([lon,lat])=>[30+(lon-west)*cos*scale,670-(lat-south)*scale];
  for(const f of data.roads.features)line(f.geometry.coordinates,$('roads'),'road'+(f.properties.kind==='bridge'?' bridge':''));
  populate();
  for(const [id,value]of [['start','3334802079@ground'],['end','14205438441@ground']])if([...$(id).options].some(o=>o.value===value))$(id).value=value;
  $('status').textContent=`노드 ${data.nodes.length}개 · 가져온 도로 ${data.audit.ways}개 · 데이터 ${data.source.timestamp||data.source.downloadedAt||'시점 미상'}`;
}catch(e){$('status').textContent=e.message;}
