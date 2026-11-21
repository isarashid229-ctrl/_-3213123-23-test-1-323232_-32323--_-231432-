'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../time.js');
const seconds = iso => Date.parse(iso) / 1000;

test('New York display uses EST in winter and EDT in summer', () => {
  assert.equal(T.zone, 'America/New_York');
  assert.equal(T.format(seconds('2026-01-15T14:30:00Z')), 'Jan 15, 2026, 09:30 EST');
  assert.equal(T.format(seconds('2026-07-15T13:30:00Z')), 'Jul 15, 2026, 09:30 EDT');
  assert.equal(T.axis(seconds('2026-07-15T13:30:00Z')), '09:30');
  assert.equal(T.axis(seconds('2026-07-15T13:30:00Z'), { dateOnly: true }), 'Jul 15');
});

test('New York date rolls back across UTC midnight instead of changing the trading day', () => {
  const at = seconds('2026-03-01T01:00:00Z');
  assert.equal(T.date(at), '2026-02-28');
  assert.equal(T.format(at, { dateOnly: true }), 'Feb 28, 2026');
  const daily = T.parseLocal('2026-03-02', '16:00');
  assert.equal(T.date(daily), '2026-03-02');
  assert.equal(T.format(daily, { dateOnly: true }), 'Mar 2, 2026');
});

test('spring transition skips nonexistent New York times and preserves UTC arithmetic', () => {
  const before = seconds('2026-03-08T06:59:00Z'), after = before + 60;
  assert.match(T.format(before), /01:59 EST/);
  assert.match(T.format(after), /03:00 EDT/);
  assert.throws(() => T.parseLocal('2026-03-08', '02:30'), /does not exist/);
  assert.equal(T.parseLocal('2026-03-08', '03:00'), after);
});

test('fall transition requires explicit disambiguation for repeated wall times', () => {
  assert.throws(() => T.parseLocal('2026-11-01', '01:30'), /occurs twice/);
  const earlier = T.parseLocal('2026-11-01', '01:30', { disambiguation: 'earlier' });
  const later = T.parseLocal('2026-11-01', '01:30', { disambiguation: 'later' });
  assert.equal(later - earlier, 3600);
  assert.equal(earlier, seconds('2026-11-01T05:30:00Z'));
  assert.equal(later, seconds('2026-11-01T06:30:00Z'));
  assert.match(T.format(earlier), /01:30 EDT/);
  assert.match(T.format(later), /01:30 EST/);
});

test('local parsing round-trips midnight and second precision in both seasons', () => {
  for (const date of ['2026-01-15', '2026-07-15', '2026-03-08', '2026-11-01']) {
    for (const time of ['00:00', '09:30', '16:00', '23:59:59']) {
      const at = T.parseLocal(date, time), p = T.parts(at);
      assert.equal(T.date(at), date);
      assert.equal(String(p.hour).padStart(2, '0') + ':' + String(p.minute).padStart(2, '0'), time.slice(0, 5));
      assert.equal(p.second, time.length > 5 ? 59 : 0);
    }
  }
});

test('weekday core-hours reference has exact open/close boundaries and discloses calendar limits', () => {
  assert.equal(T.isRegularSession(T.parseLocal('2026-01-12', '09:29')), false);
  assert.equal(T.isRegularSession(T.parseLocal('2026-01-12', '09:30')), true);
  assert.equal(T.isRegularSession(T.parseLocal('2026-01-12', '15:59:59')), true);
  assert.equal(T.isRegularSession(T.parseLocal('2026-01-12', '16:00')), false);
  assert.equal(T.isRegularSession(T.parseLocal('2026-01-17', '12:00')), false);
  assert.equal(T.isRegularSession(T.parseLocal('2026-01-18', '12:00')), false);
  assert.match(T.sessionNote, /holidays and early closes are not modeled/);
});

test('invalid dates, times, units, and disambiguation are rejected clearly', () => {
  for (const [date, time] of [['2026-02-30', '10:00'], ['2026-13-01', '10:00'], ['11/21/2026', '10:00'], ['2026-01-01', '24:00'], ['2026-01-01', '09:60']]) assert.throws(() => T.parseLocal(date, time));
  assert.throws(() => T.parseLocal('2026-01-01', '09:30', { disambiguation: 'guess' }));
  for (const bad of [NaN, Infinity, '1772323200', null]) assert.throws(() => T.format(bad));
});
