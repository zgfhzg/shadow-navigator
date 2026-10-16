import {distance} from './engine.mjs';
export const normalize=value=>String(value||'').normalize('NFKC').toLocaleLowerCase().replace(/[\s\p{P}]/gu,'');
export function searchPlaces(index,query='',mode='walk',limit=8){
  const q=normalize(query);
  const ranked=index.filter(p=>(!p.modes||p.modes.includes(mode))&&(!q||p.terms.some(term=>normalize(term).includes(q))))
    .sort((a,b)=>Number(b.featured)-Number(a.featured)||(normalize(a.label).startsWith(q)?-1:0)-(normalize(b.label).startsWith(q)?-1:0)||a.label.localeCompare(b.label));
  const selected=[];for(const place of ranked){const key=normalize(place.label.match(/[A-Za-z].*$/)?.[0]||place.label);
    if(selected.some(other=>normalize(other.label.match(/[A-Za-z].*$/)?.[0]||other.label)===key&&((other.featured&&place.featured)||distance(other.coordinate,place.coordinate)<200)))continue;
    selected.push(place);if(selected.length===limit)break;
  }return selected;
}
