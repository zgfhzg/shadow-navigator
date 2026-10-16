import {distance} from './engine.mjs';
const publicAccess=new Set(['yes','designated','official','permissive']);
const streets=new Set(['residential','living_street','service','unclassified','tertiary','tertiary_link','secondary','secondary_link','primary','primary_link']);
const walking=new Set([...streets,'footway','pedestrian','path','steps','corridor','elevator','cycleway']);
function access(tags,mode,highway) {
  // Unknown, private, destination-only and conditional access is excluded in MVP.
  if(Object.keys(tags).some(k=>k.endsWith(':conditional')))return false;
  const explicit=tags[mode==='walk'?'foot':'bicycle'];
  if(explicit!==undefined)return publicAccess.has(explicit);
  if(tags.access!==undefined&&!publicAccess.has(tags.access))return false;
  if(mode==='walk')return walking.has(highway);
  // Hong Kong defaults are conservative: pedestrian paths require explicit bicycle permission.
  return streets.has(highway)||highway==='cycleway';
}
function context(tags) {
  if(tags.level!==undefined){const levels=tags.level.split(';').map(s=>s.trim());return levels.map(l=>/^-?\d+(\.\d+)?$/.test(l)?(Number(l)===0?'ground':`floor:${Number(l)}`):'invalid');}
  if(tags.layer&&tags.layer!=='0')return [`layer:${tags.layer}`];
  if(tags.bridge&&tags.bridge!=='no')return ['bridge:unknown'];
  if(tags.tunnel&&tags.tunnel!=='no')return ['tunnel:unknown'];
  return ['ground'];
}
export function importOSM(osm,{city='hongkong',bounds=null}={}) {
  if(!Array.isArray(osm?.elements)||osm.remark)throw new Error('OSM 응답이 불완전하거나 올바르지 않습니다.');
  const rawNodes=new Map(osm.elements.filter(e=>e.type==='node').map(n=>[n.id,n]));
  const nodes=new Map(),edges=[],audit={ways:0,excludedWays:0,missingNodeWays:0,ambiguousLevels:0,verticalConnectors:0,restrictions:osm.elements.filter(e=>e.type==='relation'&&e.tags?.type==='restriction').length};
  const node=(id,level)=>{const key=`${id}@${level}`,raw=rawNodes.get(id);if(!nodes.has(key))nodes.set(key,{id:key,osmId:id,coordinate:[raw.lon,raw.lat],level,name:raw.tags?.name||''});return key;};
  function add(a,b,way,tags,modes,kind){
    if(!modes.length)return;
    const oneBike=tags['oneway:bicycle']??tags.oneway??(tags.junction==='roundabout'?'yes':'no');
    const oneWalk=tags['oneway:foot']??'no';
    const allowed=(reverse)=>modes.filter(mode=>{const one=mode==='bike'?oneBike:oneWalk;return !((one==='yes'||one==='1'||one==='true')&&reverse)&&!(one==='-1'&&!reverse);});
    const props={wayId:way.id,name:tags.name||tags['name:en']||'',kind,covered:tags.covered==='yes'||tags.tunnel==='building_passage'||tags.indoor==='yes',distance:distance(nodes.get(a).coordinate,nodes.get(b).coordinate)};
    for(const [from,to,reverse]of [[a,b,false],[b,a,true]]){const permitted=allowed(reverse);if(permitted.length)edges.push({...props,id:`${way.id}:${edges.length}`,from,to,modes:permitted});}
  }
  const endpointLevels=new Map();
  for(const w of osm.elements.filter(e=>e.type==='way'&&e.tags?.highway&&!['steps','elevator'].includes(e.tags.highway))){
    const levels=context(w.tags);if(levels.length!==1||levels[0]==='invalid')continue;
    for(const id of w.nodes||[]){if(!endpointLevels.has(id))endpointLevels.set(id,new Set());endpointLevels.get(id).add(levels[0]);}
  }
  for(const way of osm.elements.filter(e=>e.type==='way')){
    const t=way.tags||{},highway=t.highway;
    if(!highway||t.area==='yes'||t.construction||(t.conveying&&t.conveying!=='no')||!way.nodes?.length){audit.excludedWays++;continue;}
    if(way.nodes.some(id=>!rawNodes.has(id))){audit.missingNodeWays++;continue;}
    const modes=['walk','bike'].filter(m=>access(t,m,highway));if(!modes.length){audit.excludedWays++;continue;}
    const levels=context(t),vertical=['steps','elevator'].includes(highway);
    if(levels.length>1&&!vertical){audit.ambiguousLevels++;continue;}
    if(levels.length>2||levels.some(l=>l==='invalid')){audit.ambiguousLevels++;continue;}
    let transition;
    if(vertical&&levels.length===2){
      const candidates=id=>{const raw=rawNodes.get(id);const explicit=raw.tags?.level!==undefined?context(raw.tags):[...(endpointLevels.get(id)||[])];return explicit.filter(l=>levels.includes(l));};
      const first=candidates(way.nodes[0]),last=candidates(way.nodes.at(-1));
      if(first.length!==1||last.length!==1||first[0]===last[0]){audit.ambiguousLevels++;continue;}
      transition=[first[0],last[0]];
    }
    const kind=highway==='steps'?'steps':highway==='elevator'?'elevator':t.bridge&&t.bridge!=='no'?'bridge':t.indoor==='yes'||highway==='corridor'?'indoor':'road';
    const usable=highway==='steps'?modes.filter(m=>m==='walk'):modes;
    for(let i=1;i<way.nodes.length;i++){
      const aRaw=rawNodes.get(way.nodes[i-1]),bRaw=rawNodes.get(way.nodes[i]);
      const nodeAllowed=usable.filter(m=>[aRaw,bRaw].every(n=>{
        const nt=n.tags||{};if(nt.barrier&&!['kerb','entrance','bollard'].includes(nt.barrier)&&!nt[m==='walk'?'foot':'bicycle'])return false;
        if(nt.access||nt.foot||nt.bicycle||Object.keys(nt).some(k=>k.endsWith(':conditional')))return access(nt,m,highway);return true;
      }));
      const fromLevel=transition?.[0]||levels[0],toLevel=transition&&i===way.nodes.length-1?transition[1]:fromLevel;
      add(node(way.nodes[i-1],fromLevel),node(way.nodes[i],toLevel),way,t,nodeAllowed,kind);
    }
    if(vertical&&levels.length===2)audit.verticalConnectors++;audit.ways++;
  }
  // A lift may be represented by one OSM node on multiple floors.
  for(const raw of rawNodes.values())if(raw.tags?.highway==='elevator'){
    const t=raw.tags,levels=context(t);if(levels.length<2||levels.some(l=>l==='invalid'))continue;
    const modes=['walk','bike'].filter(m=>access(t,m,'elevator'));
    for(let i=1;i<levels.length;i++){add(node(raw.id,levels[i-1]),node(raw.id,levels[i]),raw,t,modes,'elevator');audit.verticalConnectors++;}
  }
  return {version:1,city,bounds,nodes:[...nodes.values()],edges,source:{name:'OpenStreetMap',license:'ODbL-1.0',url:'https://www.openstreetmap.org/copyright',timestamp:osm.osm3s?.timestamp_osm_base||null,downloadedAt:osm.shadowDownload?.at||null},audit,
    warnings:['시범 도로망: 현장 검증 전입니다.','층·레이어가 다른 길은 명시적인 층 이동 연결 없이 합치지 않습니다.','지역별 통행 기본값을 보수적으로 적용하며 자전거 끌기 이동은 아직 지원하지 않습니다.']};
}
