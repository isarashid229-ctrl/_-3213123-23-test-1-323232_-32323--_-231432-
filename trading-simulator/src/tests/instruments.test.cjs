'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const E = require('../engine.js');
const T = require('../time.js');
const I = require('../instruments.js');

test('catalog contains twelve attributed genuine historical choices without generated ticker prices', () => {
  assert.equal(I.items.length, 12);
  assert.equal(new Set(I.items.map(x => x.id)).size, 12);
  assert.deepEqual(I.items.map(x => x.symbol), ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMD', 'AMZN', 'META', 'GOOG', 'SPY', 'QQQ', 'IWM', 'TSM']);
  assert.equal(I.scenarios.length, 0);
  for (const item of I.items) {
    assert.ok(item.id !== item.symbol);
    assert.ok(item.sourceUrl.startsWith('https://github.com/'));
    assert.match(item.sourceSha, /^[a-f0-9]{40}$/);
    assert.ok(item.adjustmentNote && item.sourceNote && item.rangeLabel);
    assert.ok(item.candles.length >= 40);
  }
});

test('every bundled candle passes strict OHLC validation and matches the recorded data digest', () => {
  for (const item of I.items) {
    assert.deepEqual(E.normalizeCandles(item.candles), item.candles, item.id);
    assert.equal(item.barCount, item.candles.length);
    assert.equal(item.firstTime, item.candles[0].time);
    assert.equal(item.lastTime, item.candles.at(-1).time);
    assert.ok(item.lastTime < Date.parse('2026-11-21T00:00:00Z') / 1000);
    assert.equal(crypto.createHash('sha256').update(JSON.stringify(item.candles)).digest('hex'), item.dataSha256);
  }
});

test('intraday samples retain UTC bar-open timing, three-minute intervals, actual dates, and tick volume labels', () => {
  const intraday = I.items.filter(x => x.timeframe === '3m');
  assert.equal(intraday.length, 8);
  for (const item of intraday) {
    assert.equal(item.candles.length, 320);
    assert.equal(item.volumeKind, 'ticks');
    assert.equal(item.dateOnly, false);
    assert.equal(T.date(item.firstTime), '2026-07-22');
    assert.equal(T.date(item.lastTime), '2026-07-24');
    assert.equal(T.axis(item.firstTime), '13:00');
    assert.equal(T.axis(item.lastTime), '15:57');
    const sessions = {};
    for (let i = 0; i < item.candles.length; i++) {
      const b = item.candles[i], date = T.date(b.time);
      assert.equal(T.isRegularSession(b.time), true);
      sessions[date] = (sessions[date] || 0) + 1;
      if (i && date === T.date(item.candles[i - 1].time)) assert.equal(b.time - item.candles[i - 1].time, 180);
    }
    assert.deepEqual(sessions, { '2026-07-22': 60, '2026-07-23': 130, '2026-07-24': 130 });
  }
});

test('daily studies preserve source session dates through DST without pretending to be intraday', () => {
  const daily = I.items.filter(x => x.timeframe === '1d');
  assert.equal(daily.length, 4);
  for (const item of daily) {
    assert.equal(item.dateOnly, true);
    assert.equal(item.volumeKind, 'shares');
    assert.match(item.description, /one trading day, not an intraday bar/);
    for (let i = 0; i < item.candles.length; i++) {
      const b = item.candles[i], p = T.parts(b.time);
      assert.equal(p.hour, 16);
      assert.equal(p.minute, 0);
      assert.ok(p.weekday !== 'Sat' && p.weekday !== 'Sun');
      assert.equal(T.parseLocal(T.date(b.time), '16:00'), b.time);
      if (i) assert.ok(T.date(b.time) > T.date(item.candles[i - 1].time));
    }
  }
  const qqq = daily.find(x => x.symbol === 'QQQ');
  assert.equal(T.parts(qqq.firstTime).zoneName, 'EST');
  assert.ok(qqq.candles.some(b => T.parts(b.time).zoneName === 'EDT'));
});

test('bundled sample accounting can use later bars while an entry never exits on its own candle', () => {
  for (const item of I.items) {
    const account = E.createAccount(), at = Math.floor(item.candles.length / 4), current = item.candles[at];
    const qty = Math.min(1, 1000 / current.close);
    E.openPosition(account, { side: 'long', qty, price: current.close, time: current.time, barIndex: at, stop: current.close * 0.98, target: current.close * 1.04 });
    assert.equal(E.processCandle(account, current, at), null);
    for (let i = at + 1; i < item.candles.length && account.position; i++) E.processCandle(account, item.candles[i], i);
    if (account.position) E.closePosition(account, { price: item.candles.at(-1).close, time: item.lastTime, barIndex: item.candles.length - 1 });
    assert.equal(account.trades.length, 1);
    assert.ok(Number.isFinite(account.trades[0].netPnl));
  }
});
