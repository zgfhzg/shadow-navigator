const pad = n => String(n).padStart(2, '0');
export function localFields(now = new Date(), zone) {
  if (zone) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(now).map(p=>[p.type,p.value]));
    return {date:`${parts.year}-${parts.month}-${parts.day}`,minutes:Number(parts.hour)*60+Number(parts.minute)};
  }
  return {
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    minutes: now.getHours() * 60 + now.getMinutes(),
  };
}
export function clockLabel(minutes) {
  const value = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(value / 60))}:${pad(value % 60)}`;
}
export function localDeparture(date, minutes, zone) {
  if (zone) {
    const target = Date.parse(`${date}T00:00:00Z`) + minutes*60000;
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1439 || !Number.isFinite(target)) throw new RangeError("올바른 날짜와 시간을 선택해 주세요.");
    const offsets = new Set([-36,0,36].map(h=>{
      const epoch=target+h*3600000, f=localFields(new Date(epoch),zone);
      return Date.parse(`${f.date}T00:00:00Z`)+f.minutes*60000-epoch;
    }));
    const candidates=[...offsets].map(offset=>target-offset).sort((a,b)=>a-b);
    for (const epoch of candidates) { const f=localFields(new Date(epoch),zone); if(f.date===date && f.minutes===minutes) return new Date(epoch); }
    throw new RangeError("현지 시간대에 존재하지 않는 시각입니다. 다른 시간을 선택해 주세요.");
  }
  const [year, month, day] = date.split('-').map(Number);
  const result = new Date(year, month - 1, day, Math.floor(minutes / 60), minutes % 60);
  const fields = localFields(result);
  if (!Number.isFinite(result.getTime()) || fields.date !== date || fields.minutes !== minutes) {
    throw new RangeError('현지 시간대에 존재하지 않는 시각입니다. 다른 시간을 선택해 주세요.');
  }
  return result;
}
export function timezoneLabel(at = new Date(), zone) {
  const name = zone || Intl.DateTimeFormat().resolvedOptions().timeZone || '기기 시간대';
  const fields = localFields(at, zone);
  const offset = zone ? (Date.parse(`${fields.date}T00:00:00Z`)+fields.minutes*60000-Math.floor(at.getTime()/60000)*60000)/60000 : -at.getTimezoneOffset();
  return `${name} · UTC${offset >= 0 ? '+' : '−'}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`;
}
export class DepartureClock {
  constructor(now = new Date(), timeZone) { this.timeZone=timeZone; this.live = true; this.sync(now); }
  sync(now = new Date()) {
    if (!this.live) return false;
    const epoch = Math.floor(now.getTime() / 60000) * 60000;
    const changed = epoch !== this.epoch || timezoneLabel(now, this.timeZone) !== this.zone;
    this.epoch = epoch;
    Object.assign(this, localFields(now, this.timeZone));
    this.zone = timezoneLabel(now, this.timeZone);
    return changed;
  }
  setZone(zone, now = new Date()) {
    this.timeZone=zone;
    if(this.live) this.sync(now);
    else { Object.assign(this,localFields(new Date(this.epoch),zone)); this.zone=timezoneLabel(new Date(this.epoch),zone); }
  }
  follow(now = new Date()) { this.live = true; this.sync(now); }
  select(date, minutes) {
    const departure = localDeparture(date, minutes, this.timeZone);
    this.live = false;
    this.epoch = departure.getTime();
    this.date = date;
    this.minutes = minutes;
    this.zone = timezoneLabel(departure, this.timeZone);
  }
}
export function arrivalLabel(epoch, duration, zone) {
  const departure = new Date(epoch), arrival = new Date(epoch + Math.ceil(duration) * 60000);
  const fields = localFields(arrival, zone);
  const datePrefix = fields.date !== localFields(departure, zone).date ? `${Number(fields.date.slice(5,7))}/${Number(fields.date.slice(8))} ` : '';
  return `${datePrefix}${clockLabel(fields.minutes)}`;
}
