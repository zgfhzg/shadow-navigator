import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {solarAt, sun, shadows, route} from './dist/engine.mjs';
import {clockLabel} from './dist/time.mjs';
function inZone(zone, code) {
  execFileSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import {DepartureClock, localFields, localDeparture, arrivalLabel, timezoneLabel} from './dist/time.mjs';
    ${code}
  `], {cwd: import.meta.dirname, env:{...process.env,TZ:zone}});
}
for(const [zone,date,minutes] of [
  ['Asia/Seoul','2026-10-15',30],
  ['America/New_York','2026-10-14',690],
  ['Europe/London','2026-10-14',990],
  ['Asia/Kathmandu','2026-10-14',1275],
  ['Pacific/Auckland','2026-10-15',270],
])test(`device current date and minute in ${zone}`,()=>inZone(zone,`
  const clock=new DepartureClock(new Date('2026-10-14T15:30:42Z'));
  assert.equal(clock.date,'${date}'); assert.equal(clock.minutes,${minutes});
  assert.equal(clock.epoch,Date.parse('2026-10-14T15:30:00Z'));
  assert.equal(localDeparture(clock.date,clock.minutes).getTime(),clock.epoch);
`));
test('live clock crosses midnight; manual selection stays fixed; now resumes',()=>inZone('Asia/Seoul',`
  const clock=new DepartureClock(new Date('2026-12-31T14:59:00Z'));
  assert.equal(clock.minutes,1439);
  clock.sync(new Date('2026-12-31T15:00:00Z'));
  assert.equal(clock.date,'2027-01-01');assert.equal(clock.minutes,0);
  clock.select('2027-01-03',570);
  assert.equal(clock.sync(new Date('2027-01-04T00:00:00Z')),false);
  assert.equal(clock.date,'2027-01-03');assert.equal(clock.minutes,570);
  clock.follow(new Date('2027-01-04T00:00:00Z'));
  assert.equal(clock.date,'2027-01-04');assert.equal(clock.minutes,540);assert(clock.live);
  assert.equal(clock.sync(new Date('2027-01-04T00:00:22Z')),false);
`));
test('DST skipped and repeated hours preserve true elapsed time',()=>inZone('America/New_York',`
  const before=new DepartureClock(new Date('2026-03-08T06:59:00Z'));
  assert.equal(before.minutes,119);
  assert.equal(arrivalLabel(before.epoch,2),'03:01');
  before.sync(new Date('2026-03-08T07:00:00Z'));
  assert.equal(before.minutes,180);assert(before.zone.includes('UTC−04:00'));
  assert.throws(()=>localDeparture('2026-03-08',150),RangeError);
  const repeated=new DepartureClock(new Date('2026-11-01T06:30:00Z'));
  assert.equal(repeated.minutes,90);
  assert.equal(repeated.epoch,Date.parse('2026-11-01T06:30:00Z'));
  assert(repeated.zone.includes('UTC−05:00'));
`));
test('arrival time includes new date at midnight',()=>inZone('Asia/Seoul',`
  assert.equal(arrivalLabel(Date.parse('2026-10-14T14:59:00Z'),5),'10/15 00:04');
`));
test('clock label rolls minutes over without 24:00 or :60',()=>{
  assert.equal(clockLabel(1439),'23:59');assert.equal(clockLabel(1440),'00:00');assert.equal(clockLabel(59.8),'01:00');
});
test('UTC instant and longitude distinguish day from night',()=>{
  const utc=Date.parse('2026-07-15T16:00:00Z');
  assert(solarAt(utc,{latitude:40.71,longitude:-74.01}).altitude>60);
  assert(solarAt(utc,{latitude:-33.87,longitude:151.21}).altitude<0);
});
test('southern hemisphere summer sun is higher than winter',()=>{
  const location={latitude:-33.87,longitude:151.21};
  assert(solarAt(Date.parse('2026-12-21T02:00:00Z'),location).altitude>solarAt(Date.parse('2026-06-21T02:00:00Z'),location).altitude+35);
});
test('equatorial equinox noon and polar cases remain finite',()=>{
  assert(solarAt(Date.parse('2026-03-20T12:00:00Z'),{latitude:0,longitude:0}).altitude>87);
  for(const latitude of [-90,90])assert(Number.isFinite(solarAt(Date.parse('2026-06-21T12:00:00Z'),{latitude,longitude:0}).altitude));
});
test('route times crossing midnight use next-day solar position',()=>{
  const context={latitude:37.54,longitude:127.04,epoch:Date.parse('2026-12-31T14:59:00Z'),minute:1439};
  assert.deepEqual(sun('2026-12-31',1441,context),solarAt(Date.parse('2026-12-31T15:01:00Z'),context));
});
test('region affects shadows and route sunlight at identical instants',()=>{
  const base={start:55,end:8,date:'2026-07-15',time:960,kind:'fast'};
  const daytime={latitude:40.71,longitude:-74.01,epoch:Date.parse('2026-07-15T16:00:00Z'),minute:960};
  const nighttime={...daytime,latitude:-33.87,longitude:151.21};
  assert(shadows(base.date,base.time,daytime).length>0);assert.equal(shadows(base.date,base.time,nighttime).length,0);
  assert(route({...base,context:daytime}).sunMinutes>0);assert.equal(route({...base,context:nighttime}).sunMinutes,0);
});
