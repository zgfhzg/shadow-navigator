import {contours} from './vendor/d3-contour.mjs';
// Interpolate the binary ground-sample grid into adjoining areas. Missing,
// sunny and unknown cells stay zero; this changes presentation, not routing.
export function shadeSurface(snapshot){
 const grid=snapshot?.grid,empty={type:'FeatureCollection',features:[]};
 if(!grid||!Number.isInteger(grid.columns)||!Number.isInteger(grid.rows)||grid.columns<1||grid.rows<1||grid.columns*grid.rows>5000||
   !Array.isArray(grid.values)||grid.values.length!==grid.columns*grid.rows||
   !Array.isArray(grid.origin)||!Array.isArray(grid.step)||![...grid.origin,...grid.step].every(Number.isFinite)||
   grid.origin.length!==2||grid.step.length!==2||grid.step.some(v=>v<=0)||
   !Array.isArray(grid.bounds)||grid.bounds.length!==4||!grid.bounds.every(Number.isFinite))return empty;
 const values=grid.values.map(v=>v===1?1:0);
 if(!values.some(Boolean))return empty;
 const shape=contours().size([grid.columns,grid.rows]).smooth(true).thresholds([.5])(values)[0];
 if(!shape?.coordinates?.length)return empty;
 const [w,s,e,n]=grid.bounds;
 const coordinates=shape.coordinates.map(polygon=>polygon.map(ring=>ring.map(([x,y])=>[
  Math.max(w,Math.min(e,grid.origin[0]+x*grid.step[0])),
  Math.max(s,Math.min(n,grid.origin[1]+y*grid.step[1]))
 ])));
 return {type:'FeatureCollection',features:[{type:'Feature',properties:{state:'shade',approximate:true,spacing:snapshot.spacing},geometry:{type:'MultiPolygon',coordinates}}]};
}
