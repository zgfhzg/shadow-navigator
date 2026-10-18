import test from 'node:test';
import assert from 'node:assert/strict';
import {translate,placeLabel,languages,messages,setLanguage,getLanguage} from './dist/i18n.mjs';
import {searchURL} from './dist/maptiler.mjs';
test('language catalogs have complete slots and Hong Kong Cantonese locale',()=>{
 assert.equal(languages.yue.tag,'yue-Hant-HK');
 for(const [ko,en,yue] of messages){assert(en&&yue);for(const text of [en,yue])assert.deepEqual([...text.matchAll(/\{\d+\}/g)].map(m=>m[0]).sort(),[...ko.matchAll(/\{\d+\}/g)].map(m=>m[0]).sort(),ko);}
});
test('dynamic route, time, GPS and loading messages localize without changing measurements',()=>{
 assert.equal(translate('햇빛 3.5분 · 평가 불가 1.2분','en'),'Sun 3.5 min · Unassessed 1.2 min');
 assert.equal(translate('홍콩 현지 시간 · Asia/Hong_Kong · UTC+08:00','en'),'Hong Kong local time · Asia/Hong_Kong · UTC+08:00');
 assert.equal(translate('경로 주변 건물 자료를 불러오고 있어요… (12/56 구역)','yue'),'載入路線附近建築物…（12/56 區）');
 assert.equal(translate('현재 위치 · 정확도 약 8m · 11:50 갱신','en'),'Current location · Accuracy about 8 m · Updated 11:50');
 assert.equal(translate('그늘 우선, 16분','en'),'More shade, 16 min');
 assert.equal(translate('그늘길 찾기 ','en'),'Find a shady route ');
 assert.equal(translate('Castle Peak Bay Waterfront Promenade','yue'),'Castle Peak Bay Waterfront Promenade');
 assert.equal(placeLabel({label:'센트럴 마켓 · Central Market',terms:['中環街市 Central Market']},'en'),'Central Market');
 assert.equal(placeLabel({label:'센트럴 마켓 · Central Market',terms:['中環街市 Central Market']},'yue'),'中環街市 Central Market');
 assert.equal(translate('MapTiler 키 또는 허용 도메인을 확인해 주세요. 저장된 장소·거리 검색 결과를 표시합니다.','en'),'Check the MapTiler key or allowed domain. Showing saved places and streets.');
});
test('language selection validates values and preserves Korean fallback',()=>{
 assert.equal(setLanguage('en'),true);assert.equal(getLanguage(),'en');assert.equal(setLanguage('invalid'),false);assert.equal(getLanguage(),'en');setLanguage('ko');assert.equal(translate('현재 내 위치'),'현재 내 위치');
});
test('search language follows selection and safely limits provider language values',()=>{
 for(const language of ['ko','en','zh'])assert.equal(searchURL('Hong Kong',{key:'test',country:'hongkong',language}).searchParams.get('language'),language);
 assert.equal(searchURL('Hong Kong',{key:'test',country:'hongkong',language:'invalid'}).searchParams.get('language'),'ko');
});
