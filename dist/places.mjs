// Named OSM points already present in the Hong Kong snapshot. Labels translate
// real source names; they are not generated POIs or geocoder search results.
export const places=[
  {nodeId:'12180384885@ground',label:'홍콩역 · Hong Kong Station',sourceName:'香港站 Hong Kong Station'},
  {nodeId:'6853986554@ground',label:'센트럴 마켓 · Central Market',sourceName:'中環街市 Central Market'},
  {nodeId:'12179714517@ground',label:'IFC 몰 · IFC Mall',sourceName:'國際金融中心商場 IFC Mall'},
  {nodeId:'4361292406@ground',label:'홍콩 시티홀 · City Hall',sourceName:'大會堂 City Hall'},
  {nodeId:'2555632177@ground',label:'차터 가든 · Chater Garden',sourceName:'遮打花園 Chater Garden'},
  {nodeId:'5395421323@ground',label:'타이쿤 · Tai Kwun',sourceName:'大館 Tai Kwun'},
  {nodeId:'4539759189@ground',label:'애드미럴티역 · Admiralty Station',sourceName:'金鐘站 Admiralty Station'},
  {nodeId:'4457491382@ground',label:'퍼시픽 플레이스 · Pacific Place',sourceName:'太古廣場 Pacific Place'},
];
export function availablePlaces(nodes){const lookup=new Map(nodes.map(n=>[n.id,n]));return places.filter(p=>lookup.get(p.nodeId)?.name===p.sourceName);}
export function routeSegmentLabel(segment){
  const kind={steps:'계단',elevator:'엘리베이터',bridge:'육교',indoor:'실내 통로',road:'보행 구간'}[segment.kind]||'이동 구간';
  const raw=segment.name?.trim(),english=raw?.match(/[A-Za-z].*$/)?.[0];
  return `${english||raw||kind}${raw&&segment.kind!=='road'?` · ${kind}`:''} · ${Math.round(segment.distance)}m`;
}
