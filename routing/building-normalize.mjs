// Hong Kong government heights are elevations. Their difference is the
// vertical extent; absolute BaseHeight must never become min_height above a
// fictitious sea-level ground plane. Terrain and open-sided roofs stay explicit.
export function governmentBuilding(feature){
 const p=feature.properties||{},base=p.BaseHeight,top=p.TopHeight,extent=top-base;
 const known=Number.isFinite(base)&&Number.isFinite(top)&&extent>0&&extent<1500&&p.BuildingBlockType!=='Open-sided Structure';
 return {type:'Feature',id:`hk-gov:${p.OBJECTID}`,geometry:feature.geometry,properties:{height:known?extent:null,min_height:0}};
}
