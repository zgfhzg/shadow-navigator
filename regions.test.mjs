import test from 'node:test';
import assert from 'node:assert/strict';
import {regions,countries,regionAt} from './routing/regions.mjs';
test('country selection groups Japan cities and keeps Hong Kong separate',()=>{
 assert.deepEqual(countries.japan.cities,['tokyo','osaka','kyoto']);
 assert.deepEqual(countries.hongkong.cities,['hongkong']);
 for(const city of countries.japan.cities)assert.equal(regions[city].zone,countries.japan.zone);
});
test('map selection resolves real supported bounds and rejects unsupported places',()=>{
 for(const [city,region] of Object.entries(regions))assert.equal(regionAt(region.center,city==='hongkong'?'hongkong':'japan'),city);
 assert.equal(regionAt([135.5,34.69],'hongkong'),undefined);
 assert.equal(regionAt([130.4,33.59],'japan'),undefined);
 assert.equal(regionAt(regions.tokyo.center,'japan',{tokyo:false}),undefined);
 assert.equal(regionAt([114.1661,22.282],'hongkong'),undefined);
});
