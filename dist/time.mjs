const pad = n => String(n).padStart(2, '0');
export function localFields(now = new Date()) {
  return {
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    minutes: now.getHours() * 60 + now.getMinutes(),
  };
}
export function clockLabel(minutes) {
  const value = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(value / 60))}:${pad(value % 60)}`;
}
export function localDeparture(date, minutes) {
  const [year, month, day] = date.split('-').map(Number);
  const result = new Date(year, month - 1, day, Math.floor(minutes / 60), minutes % 60);
  const fields = localFields(result);
  if (!Number.isFinite(result.getTime()) || fields.date !== date || fields.minutes !== minutes) {
    throw new RangeError('현지 시간대에 존재하지 않는 시각입니다. 다른 시간을 선택해 주세요.');
  }
  return result;
}
export function timezoneLabel(at = new Date()) {
  const name = Intl.DateTimeFormat().resolvedOptions().timeZone || '기기 시간대';
  const offset = -at.getTimezoneOffset();
  return `${name} · UTC${offset >= 0 ? '+' : '−'}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`;
}
export class DepartureClock {
  constructor(now = new Date()) { this.live = true; this.sync(now); }
  sync(now = new Date()) {
    if (!this.live) return false;
    const epoch = Math.floor(now.getTime() / 60000) * 60000;
    const changed = epoch !== this.epoch || timezoneLabel(now) !== this.zone;
    this.epoch = epoch;
    Object.assign(this, localFields(now));
    this.zone = timezoneLabel(now);
    return changed;
  }
  follow(now = new Date()) { this.live = true; this.sync(now); }
  select(date, minutes) {
    const departure = localDeparture(date, minutes);
    this.live = false;
    this.epoch = departure.getTime();
    this.date = date;
    this.minutes = minutes;
    this.zone = timezoneLabel(departure);
  }
}
export function arrivalLabel(epoch, duration) {
  const departure = new Date(epoch), arrival = new Date(epoch + Math.ceil(duration) * 60000);
  const fields = localFields(arrival);
  const datePrefix = fields.date !== localFields(departure).date ? `${arrival.getMonth() + 1}/${arrival.getDate()} ` : '';
  return `${datePrefix}${clockLabel(fields.minutes)}`;
}
