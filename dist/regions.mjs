export const regions={
  hongkong:{name:'홍콩',area:'전역',zone:'Asia/Hong_Kong',center:[114.1589,22.2819],bounds:[113.81,22.13,114.46,22.58],buildingBounds:[113.80,22.12,114.48,22.59],countrywide:true},
  tokyo:{name:'도쿄',area:'도쿄역 · 마루노우치',zone:'Asia/Tokyo',center:[139.7671,35.6812],bounds:[139.758,35.675,139.775,35.686],buildingBounds:[139.750,35.667,139.783,35.694]},
  osaka:{name:'오사카',area:'나카노시마',zone:'Asia/Tokyo',center:[135.5023,34.6937],bounds:[135.493,34.687,135.512,34.700],buildingBounds:[135.485,34.679,135.520,34.708]},
  kyoto:{name:'교토',area:'산조 · 시청',zone:'Asia/Tokyo',center:[135.7681,35.009],bounds:[135.762,35.004,135.774,35.014],buildingBounds:[135.754,34.996,135.782,35.022]},
};

export const countries={
  hongkong:{name:'홍콩',zone:'Asia/Hong_Kong',cities:['hongkong'],center:[114.17,22.31],zoom:11},
  japan:{name:'일본',zone:'Asia/Tokyo',cities:['tokyo','osaka','kyoto'],center:[137.4,36.2],zoom:6},
};
export function regionAt(point,country,available={}){
  return countries[country]?.cities.find(city=>{const [w,s,e,n]=regions[city].bounds;return available[city]!==false&&point[0]>=w&&point[0]<=e&&point[1]>=s&&point[1]<=n;});
}
