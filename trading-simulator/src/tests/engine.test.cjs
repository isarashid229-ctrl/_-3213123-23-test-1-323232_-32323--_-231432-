'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

const baseTime = 1772323200;
const bar = (i, open = 100, high = 104, low = 96, close = 101) => ({ time: baseTime + i * 900, open, high, low, close, volume: 1000 });
const approximately = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const enter = (account, overrides = {}) => E.openPosition(account, Object.assign({ side: 'long', qty: 10, price: 100, time: baseTime, barIndex: 0, stop: 95, target: 110 }, overrides));

test('normalization orders data and removes identical duplicates without changing input', () => {
  const input = [bar(2), bar(0), bar(1), bar(1)];
  const original = JSON.stringify(input);
  const result = E.normalizeCandles(input);
  assert.deepEqual(result.map(c => c.time), [baseTime, baseTime + 900, baseTime + 1800]);
  assert.equal(JSON.stringify(input), original);
  assert.throws(() => E.normalizeCandles([bar(0), Object.assign(bar(0), { close: 102 })]), /Conflicting candles/);
});

test('normalization rejects malformed OHLC, nonnumeric values, negative volume and empty data', () => {
  assert.throws(() => E.normalizeCandles([]), /No candles/);
  for (const invalid of [
    { high: 99 }, { low: 102 }, { open: 0 }, { close: NaN }, { close: '' },
    { high: Infinity }, { volume: -1 }, { close: true }, { time: 'not a date' }
  ]) assert.throws(() => E.normalizeCandles([Object.assign(bar(0), invalid)]), /Candle 1/);
});

test('CSV supports BOM, aliases, no volume, UTC, quoted values and semicolon delimiters', () => {
  const csv = '\uFEFFDate;Open price;High;Low;Close\r\n"2026-03-01 00:15:00";101;104;96;102\r\n"2026-03-01T00:00:00Z";100;103;98;101\r\n';
  const result = E.parseCSV(csv);
  assert.equal(result.length, 2);
  assert.equal(result[0].time, baseTime);
  assert.equal(result[1].time, baseTime + 900);
  assert.equal(result[0].volume, 0);
  assert.equal(E.parseTime(1772323200000), baseTime);
  assert.equal(E.parseTime('1772323200000'), baseTime);
  assert.equal(E.parseTime('2026-02-28T18:00:00-06:00'), baseTime);
  assert.equal(E.parseTime('2026-03-01'), baseTime);
});

test('CSV fails with useful errors instead of skipping malformed rows', () => {
  assert.throws(() => E.parseCSV('time,open,high,low,close\n1772323200,100,102,98,101\n1772324100,101,103,99,nope'), /CSV row 3: Close/);
  assert.throws(() => E.parseCSV('time,open,high,low,close\n1772323200,100,102,98'), /expected 5 fields/);
  assert.throws(() => E.parseCSV('time,open,high,low\n1772323200,100,102,98'), /Missing close/);
  assert.throws(() => E.parseCSV('time,open,high,low,close\n"1772323200,100,102,98,101'), /quoted field was not closed/);
  assert.throws(() => E.parseCSV('time,date,open,high,low,close\n1772323200,2026-03-01,100,102,98,101'), /more than one time column/);
  assert.throws(() => E.parseTime('2026-02-30T00:00:00Z'), /Invalid calendar/);
  assert.throws(() => E.parseTime('03/01/2026'), /Use Unix/);
});

test('long entry and exit account for adverse slippage and both fees exactly once', () => {
  const account = E.createAccount();
  const position = enter(account);
  approximately(position.entryPrice, 100.02);
  approximately(account.balance, 100000 - 0.40008);
  approximately(E.equity(account, 100), 99999.39992);
  const trade = E.closePosition(account, { price: 110, time: baseTime + 900, barIndex: 1 });
  approximately(trade.exitPrice, 109.978);
  approximately(trade.netPnl, 98.740008);
  approximately(trade.fees, 0.839992);
  approximately(account.balance, 100000 + trade.netPnl);
  assert.equal(account.position, null);
  assert.equal(account.trades.length, 1);
});

test('short entry and exit account for costs and mark unrealized losses', () => {
  const account = E.createAccount();
  enter(account, { side: 'short', stop: 105, target: 90 });
  approximately(account.position.entryPrice, 99.98);
  assert.ok(E.equity(account, 110) < account.balance);
  const trade = E.closePosition(account, { price: 90, time: baseTime + 900, barIndex: 1 });
  approximately(trade.exitPrice, 90.018);
  approximately(trade.netPnl, 98.860008);
  approximately(account.balance, 100000 + trade.netPnl);
});

test('invalid orders are atomic and cannot create extra positions or exceed 1x equity', () => {
  const account = E.createAccount(1000);
  const original = JSON.stringify(account);
  for (const invalid of [{ qty: 11 }, { qty: -1 }, { qty: NaN }, { stop: 101 }, { target: 99 }, { side: 'buy' }, { riskBudget: 1 }, { stop: 0 }, { barIndex: 1.5 }]) {
    assert.throws(() => enter(account, invalid));
    assert.equal(JSON.stringify(account), original);
  }
  enter(account, { qty: 1 });
  const withPosition = JSON.stringify(account);
  assert.throws(() => enter(account), /Close the current/);
  assert.equal(JSON.stringify(account), withPosition);
  assert.throws(() => E.closePosition(account, { price: 105, time: baseTime - 1, barIndex: 1 }), /before its entry/);
  assert.equal(JSON.stringify(account), withPosition);
});

test('risk sizing includes both fees/slippage and passes its budget to the order', () => {
  for (const side of ['long', 'short']) {
    const stop = side === 'long' ? 95 : 105;
    const account = E.createAccount(10000);
    const sizing = E.sizePosition({ equity: 10000, entry: 100, stop, riskPct: 0.5, side });
    assert.ok(sizing.risk <= 50);
    assert.ok(sizing.risk > 49.9999);
    assert.ok(sizing.qty < 10); // Naked distance-only sizing would incorrectly yield 10 units.
    E.openPosition(account, { side, qty: sizing.qty, price: 100, stop, time: baseTime, barIndex: 0, riskBudget: 50 });
    approximately(account.position.plannedRisk, sizing.risk);
    const candle = side === 'long' ? bar(1, 100, 102, 94, 96) : bar(1, 100, 106, 98, 104);
    const trade = E.processCandle(account, candle, 1);
    approximately(trade.netPnl, -sizing.risk);
    approximately(trade.rMultiple, -1);
  }
});

test('risk calculator caps exposure including fees and reports the smaller budget used', () => {
  const sizing = E.sizePosition({ equity: 1000, entry: 100, stop: 99.99, riskPct: 10 });
  assert.equal(sizing.capped, true);
  assert.ok(sizing.notional + sizing.entryFee <= 1000 + 1e-8);
  assert.ok(sizing.risk < sizing.riskBudget);
  const account = E.createAccount(1000);
  enter(account, { qty: sizing.qty, stop: 99.99 });
  assert.throws(() => E.sizePosition({ equity: 1000, entry: 100, stop: 101, riskPct: 1 }), /stop must be below/);
});

test('protective orders cannot exit on the entry bar or reprocess a previous bar', () => {
  const account = E.createAccount();
  enter(account);
  assert.equal(E.processCandle(account, bar(0, 100, 112, 90, 100), 0), null);
  assert.ok(account.position);
  assert.equal(E.processCandle(account, bar(1), 1), null);
  assert.equal(E.processCandle(account, bar(1, 100, 112, 90, 100), 1), null);
  assert.ok(account.position);
});

test('an ambiguous bar chooses the stop conservatively for both directions', () => {
  for (const side of ['long', 'short']) {
    const account = E.createAccount();
    enter(account, side === 'long' ? {} : { side, stop: 105, target: 90 });
    const trade = E.processCandle(account, bar(1, 100, 112, 88, 100), 1);
    assert.equal(trade.exitReason, 'stop_ambiguous');
    assert.equal(trade.ambiguous, true);
    assert.ok(trade.netPnl < 0);
    assert.equal(account.trades.length, 1);
  }
});

test('adverse opening gaps exceed planned stop risk and favorable gaps use target without price improvement', () => {
  const long = E.createAccount();
  enter(long);
  const loss = E.processCandle(long, bar(1, 90, 94, 87, 92), 1);
  assert.equal(loss.exitReason, 'stop_gap');
  approximately(loss.exitPrice, 90 * 0.9998);
  assert.ok(loss.rMultiple < -1);

  const short = E.createAccount();
  enter(short, { side: 'short', stop: 105, target: 90 });
  const shortLoss = E.processCandle(short, bar(1, 110, 115, 108, 112), 1);
  assert.equal(shortLoss.exitReason, 'stop_gap');
  approximately(shortLoss.exitPrice, 110 * 1.0002);

  const target = E.createAccount();
  enter(target);
  const win = E.processCandle(target, bar(1, 115, 117, 90, 112), 1);
  assert.equal(win.exitReason, 'target_gap'); // Opening price resolves target before a later low.
  approximately(win.exitReferencePrice, 110);
});

test('manual close at unchanged reference price still loses execution costs', () => {
  for (const side of ['long', 'short']) {
    const account = E.createAccount();
    enter(account, side === 'long' ? {} : { side, stop: 105, target: 90 });
    const trade = E.closePosition(account, { price: 100, time: baseTime, barIndex: 0 });
    assert.ok(trade.netPnl < 0);
    approximately(trade.netPnl, -1.2);
    approximately(E.equity(account, 100), 100000 + trade.netPnl);
  }
});

test('statistics use net outcomes and report closed-trade drawdown separately from win rate', () => {
  const history = [100, -80, -60, 200, 0].map((netPnl, i) => ({ netPnl, rMultiple: netPnl / 100, fees: 2, exitTime: baseTime + i * 900 }));
  const s = E.stats(history, 1000);
  assert.equal(s.totalTrades, 5);
  assert.equal(s.wins, 2);
  assert.equal(s.losses, 2);
  assert.equal(s.breakeven, 1);
  assert.equal(s.winRate, 40);
  assert.equal(s.netPnl, 160);
  assert.equal(s.expectancy, 32);
  approximately(s.averageR, 0.32);
  approximately(s.profitFactor, 300 / 140);
  assert.equal(s.maxDrawdown, 140);
  approximately(s.maxDrawdownPct, 140 / 1100 * 100);
  assert.equal(s.maxLosingStreak, 2);
  assert.equal(s.finalEquity, 1160);
  assert.equal(s.fees, 10);
  assert.equal(E.stats([]).winRate, null);
  assert.equal(E.stats([]).averageR, null);
});

test('large short gaps can make equity negative and prevent a new paper order', () => {
  const account = E.createAccount(1000);
  enter(account, { side: 'short', qty: 9, stop: 105, target: 90 });
  E.processCandle(account, bar(1, 300, 320, 290, 310), 1);
  assert.ok(account.balance < 0);
  assert.throws(() => enter(account), /no equity available/);
});
