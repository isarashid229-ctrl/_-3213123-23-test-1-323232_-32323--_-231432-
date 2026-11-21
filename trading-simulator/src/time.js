/* ReplayLab time policy: UTC seconds for storage and arithmetic, New York for
 * display. Daily stock studies are stamped at 16:00 New York on their source
 * trading date to preserve that date; this is a display convention, not a claim
 * about a particular day's closing auction. Core-hours shading is a weekday
 * reference only: exchange holidays and early closes are not modeled.
 * Official session reference: https://www.nyse.com/trade/trading-information
 * Calendars: https://www.nyse.com/trade/hours-calendars
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ReplayTime = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const zone = 'America/New_York';
  const partsFormatter = new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short', hourCycle: 'h23', timeZoneName: 'short' });
  const dateFormatter = new Intl.DateTimeFormat('en-US', { timeZone: zone, month: 'short', day: 'numeric', year: 'numeric' });
  const shortDateFormatter = new Intl.DateTimeFormat('en-US', { timeZone: zone, month: 'short', day: 'numeric' });
  const pad = n => String(n).padStart(2, '0');
  function timestamp(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Time must be a finite Unix timestamp in seconds.');
    const date = new Date(value * 1000);
    if (!Number.isFinite(date.getTime())) throw new Error('Timestamp is outside the supported date range.');
    return date;
  }
  function parts(value) {
    const p = Object.fromEntries(partsFormatter.formatToParts(timestamp(value)).filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
    return { year: Number(p.year), month: Number(p.month), day: Number(p.day), hour: Number(p.hour), minute: Number(p.minute), second: Number(p.second), weekday: p.weekday, zoneName: p.timeZoneName };
  }
  function date(value) { const p = parts(value); return p.year + '-' + pad(p.month) + '-' + pad(p.day); }
  function format(value, options) {
    options = options || {};
    const d = timestamp(value), label = (options.includeYear === false ? shortDateFormatter : dateFormatter).format(d);
    if (options.dateOnly) return label;
    const p = parts(value);
    return label + ', ' + pad(p.hour) + ':' + pad(p.minute) + (options.includeSeconds ? ':' + pad(p.second) : '') + ' ' + p.zoneName;
  }
  function axis(value, options) {
    options = options || {};
    if (options.dateOnly) return shortDateFormatter.format(timestamp(value));
    const p = parts(value);
    return pad(p.hour) + ':' + pad(p.minute);
  }
  function isRegularSession(value) {
    const p = parts(value), minutes = p.hour * 60 + p.minute;
    return p.weekday !== 'Sat' && p.weekday !== 'Sun' && minutes >= 570 && minutes < 960;
  }
  function parseLocal(dateString, timeString, options) {
    timeString = timeString === undefined ? '00:00' : timeString;
    options = options || {};
    const dateMatch = typeof dateString === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
    const timeMatch = typeof timeString === 'string' && /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(timeString);
    if (!dateMatch || !timeMatch) throw new Error('Use YYYY-MM-DD and HH:mm (New York time).');
    const year = Number(dateMatch[1]), month = Number(dateMatch[2]), day = Number(dateMatch[3]);
    const hour = Number(timeMatch[1]), minute = Number(timeMatch[2]), second = Number(timeMatch[3] || 0);
    if (year < 1970 || year > 9999 || month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59) throw new Error('Invalid New York calendar date or time.');
    const utc = Date.UTC(year, month - 1, day, hour, minute, second), calendar = new Date(utc);
    if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) throw new Error('Invalid New York calendar date or time.');
    const disambiguation = options.disambiguation || 'reject';
    if (!['reject', 'earlier', 'later'].includes(disambiguation)) throw new Error('Time disambiguation must be reject, earlier, or later.');
    // Discover offsets around the desired calendar date from IANA time-zone
    // data, rather than hardcoding UTC-4/UTC-5 or the DST transition dates.
    const offsets = new Set();
    for (const delta of [-172800, -86400, 0, 86400, 172800]) {
      const at = Math.floor(utc / 1000) + delta, p = parts(at);
      offsets.add(Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) / 1000 - at);
    }
    const candidates = [];
    for (const offset of offsets) {
      const at = utc / 1000 - offset, p = parts(at);
      if (p.year === year && p.month === month && p.day === day && p.hour === hour && p.minute === minute && p.second === second) candidates.push(at);
    }
    candidates.sort((a, b) => a - b);
    if (!candidates.length) throw new Error('That New York time does not exist because clocks move forward. Choose another time.');
    if (candidates.length > 1 && disambiguation === 'reject') throw new Error('That New York time occurs twice when clocks move back. Choose earlier or later explicitly.');
    return disambiguation === 'later' ? candidates[candidates.length - 1] : candidates[0];
  }
  return Object.freeze({ zone: zone, label: 'New York (EST / EDT)', format: format, axis: axis, date: date, parts: parts,
    isRegularSession: isRegularSession, parseLocal: parseLocal,
    sessionNote: 'Weekday 09:30–16:00 New York reference only; holidays and early closes are not modeled.' });
});
