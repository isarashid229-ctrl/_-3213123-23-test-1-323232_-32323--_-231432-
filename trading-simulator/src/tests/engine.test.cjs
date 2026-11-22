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

const copy = value => JSON.parse(JSON.stringify(value));
const point = (i, overrides = {}) => ({ price: 100, time: baseTime + i * 900, barIndex: i, ...overrides });
const pending = (account, overrides = {}) => E.placeOrder(account, { type: 'limit', side: 'long', qty: 10, orderPrice: 95, ...point(0), ...overrides });
const unchanged = (account, operation, pattern) => {
  const before = copy(account);
  assert.throws(operation, pattern);
  assert.deepEqual(account, before);
};

test('editing protection can lock gains on either side without rewriting original risk or charging fees', () => {
  for (const side of ['long', 'short']) {
    const long = side === 'long', account = E.createAccount();
    const p = enter(account, { side, stop: long ? 95 : 105, target: long ? 115 : 85 });
    const risk = p.plannedRisk, balance = account.balance;
    const updated = E.modifyPosition(account, point(1, { price: long ? 110 : 90, stop: long ? 105 : 95 }));
    assert.equal(updated.plannedRisk, risk);
    assert.equal(updated.initialStop, long ? 95 : 105);
    assert.equal(account.balance, balance);
    assert.equal(E.processCandle(account, bar(1, 100, 120, 80, 100), 1), null, 'new exits cannot apply to an already revealed bar');
    const exit = E.processCandle(account, long ? bar(2, 110, 112, 104, 106) : bar(2, 90, 96, 88, 94), 2);
    assert.equal(exit.exitReason, 'stop');
    assert.ok(exit.netPnl > 0);
    approximately(exit.rMultiple, exit.netPnl / risk);
    assert.deepEqual(account.events.map(e => e.kind), ['open', 'modify', 'close']);
    assert.deepEqual(E.restoreAccount(copy(account)), account);
  }
});

test('protection edits distinguish retained and removed levels, reject invalid levels atomically, and preserve null initial risk', () => {
  const account = E.createAccount();
  enter(account, { stop: null, target: 120 });
  for (const fields of [{ stop: 101 }, { target: 99 }, { stop: 0 }, { target: NaN }]) unchanged(account, () => E.modifyPosition(account, point(1, fields)));
  E.modifyPosition(account, point(1, { stop: 95 }));
  assert.equal(account.position.target, 120);
  assert.equal(account.position.plannedRisk, null);
  E.modifyPosition(account, point(1, { target: '', stop: null }));
  assert.equal(account.position.stop, null);
  assert.equal(account.position.target, null);
  const exit = E.closePosition(account, point(2, { price: 102 }));
  assert.equal(exit.rMultiple, null);
});

test('multiple partial closes conserve cash, entry fees and initial risk for long and short positions', () => {
  for (const side of ['long', 'short']) {
    const long = side === 'long', account = E.createAccount();
    const opened = copy(enter(account, { side, stop: long ? 95 : 105, target: long ? 120 : 80, qty: 7 }));
    for (const [i, qty, price] of [[1, 2, long ? 105 : 95], [2, 1.5, long ? 98 : 102]]) {
      const fill = E.closePosition(account, point(i, { qty, price }));
      assert.equal(fill.partial, true);
      assert.equal(fill.positionClosed, false);
      assert.equal(fill.positionId, opened.id);
      approximately(fill.entryFee, opened.entryFee * qty / opened.qty);
      approximately(fill.plannedRisk, opened.plannedRisk * qty / opened.qty);
      approximately(account.balance, account.initialBalance + account.trades.reduce((sum, t) => sum + t.netPnl, 0) - account.position.entryFee);
      approximately(E.equity(account, price), account.balance + (long ? 1 : -1) * account.position.qty * (price - opened.entryPrice));
    }
    const last = E.closePosition(account, point(3, { price: long ? 110 : 90 }));
    assert.equal(last.partial, false);
    assert.equal(last.positionClosed, true);
    assert.equal(last.remainingQty, 0);
    assert.equal(account.position, null);
    assert.equal(new Set(account.trades.map(t => t.id)).size, 3);
    approximately(account.trades.reduce((sum, t) => sum + t.entryFee, 0), opened.entryFee);
    approximately(account.trades.reduce((sum, t) => sum + t.plannedRisk, 0), opened.plannedRisk);
    approximately(account.balance, account.initialBalance + account.trades.reduce((sum, t) => sum + t.netPnl, 0));
    approximately(last.positionRealizedPnl, account.trades.reduce((sum, t) => sum + t.netPnl, 0));
    assert.deepEqual(E.restoreAccount(copy(account), { maxBarIndex: 3 }), account);
  }
});

test('invalid close amounts are atomic and tiny legitimate positions can still be reduced', () => {
  const account = E.createAccount();
  enter(account, { qty: 1e-9, tags: ['setup'] });
  for (const qty of [0, -1, true, NaN, 2e-9]) unchanged(account, () => E.closePosition(account, point(1, { qty })), /quantity/i);
  const partial = E.closePosition(account, point(1, { qty: 4e-10 }));
  assert.equal(partial.partial, true);
  approximately(account.position.qty, 6e-10, 1e-24);
  partial.tags.push('review');
  assert.deepEqual(account.position.tags, ['setup'], 'reviewing a partial exit cannot change the remaining position tags');
  E.closePosition(account, point(2));
  assert.equal(account.position, null);
});

test('partial exits contribute realized P&L while win rate and R count completed positions once', () => {
  const account = E.createAccount();
  const risk = enter(account).plannedRisk;
  E.closePosition(account, point(1, { qty: 2, price: 110 }));
  let statistics = E.stats(account.trades);
  assert.equal(statistics.totalTrades, 0);
  assert.equal(statistics.closedFills, 1);
  assert.equal(statistics.partiallyClosedPositions, 1);
  assert.equal(statistics.winRate, null);
  approximately(statistics.netPnl, account.trades[0].netPnl);
  E.closePosition(account, point(2, { price: 90 }));
  statistics = E.stats(account.trades);
  assert.equal(statistics.totalTrades, 1);
  assert.equal(statistics.closedFills, 2);
  assert.equal(statistics.wins, 0);
  assert.equal(statistics.losses, 1);
  assert.equal(statistics.partiallyClosedPositions, 0);
  approximately(statistics.averageR, statistics.netPnl / risk);
  approximately(statistics.finalEquity, account.balance);
});

test('pending entries reserve one slot without charging fees and enforce directional placement', () => {
  const account = E.createAccount(), before = copy(account);
  for (const options of [{ type: 'market' }, { orderPrice: 101 }, { type: 'stop', orderPrice: 100 }, { side: 'short', orderPrice: 99 }, { type: 'stop', side: 'short', orderPrice: 101 }, { qty: 100000 }, { stop: 96 }]) unchanged(account, () => pending(account, options));
  const order = pending(account);
  assert.equal(typeof order.id, 'string');
  assert.equal(account.balance, before.balance);
  assert.equal(account.position, null);
  assert.equal(account.trades.length, 0);
  assert.equal(order.estimatedFill, 95);
  approximately(order.reservedNotional, 950 * 1.0004);
  unchanged(account, () => pending(account), /pending entry/);
  unchanged(account, () => enter(account), /pending entry/);
});

test('limit autosizing matches capped entry pricing and cannot overspend at the short or long exposure ceiling', () => {
  for (const side of ['long', 'short']) {
    const account = E.createAccount(1000), long = side === 'long', stop = long ? 99.999 : 100.001;
    const size = E.sizePosition({ equity: 1000, entry: 100, stop, riskPct: 10, side, orderType: 'limit' });
    assert.equal(size.capped, true);
    assert.equal(size.entryFill, 100);
    assert.ok(size.notional + size.entryFee <= 1000);
    const order = pending(account, { side, qty: size.qty, price: long ? 101 : 99, orderPrice: 100, stop, riskBudget: size.riskBudget });
    approximately(order.estimatedRisk, size.risk);
    const [event] = E.processBar(account, long ? bar(1, 101, 102, 99, 100) : bar(1, 99, 101, 98, 100), 1);
    assert.equal(event.type, 'opened');
    approximately(event.position.entryFee, size.entryFee);
    approximately(event.position.plannedRisk, size.risk);
  }
});

test('limit entries activate only on later bars, never pay beyond the limit, and receive capped gap improvement', () => {
  for (const side of ['long', 'short']) {
    const long = side === 'long', price = long ? 95 : 105;
    for (const gap of [false, true]) {
      const account = E.createAccount();
      const order = pending(account, { side, orderPrice: price });
      assert.deepEqual(E.processBar(account, bar(0, 100, 110, 90, 100), 0), []);
      assert.equal(account.position, null);
      const candle = gap ? long ? bar(1, 90, 96, 88, 94) : bar(1, 110, 112, 104, 106) : bar(1, 100, 108, 92, 101);
      const [event] = E.processBar(account, candle, 1);
      assert.equal(event.type, 'opened');
      assert.equal(event.order.id, order.id);
      assert.equal(account.pendingOrders.length, 0);
      assert.equal(account.position.entryOrderType, 'limit');
      assert.equal(account.position.entryOrderId, order.id);
      assert.ok(long ? account.position.entryPrice <= price : account.position.entryPrice >= price);
      approximately(account.position.entryPrice, gap ? candle.open * (long ? 1.0002 : 0.9998) : price);
      approximately(account.balance, account.initialBalance - account.position.entryFee);
      assert.deepEqual(E.processBar(account, candle, 1), [], 'the same entry bar cannot create another execution');
      assert.deepEqual(E.restoreAccount(copy(account), { maxBarIndex: 1 }), account);
    }
  }
});

test('stop entries convert to market pricing at the trigger or adverse opening gap for both sides', () => {
  for (const side of ['long', 'short']) for (const gap of [false, true]) {
    const long = side === 'long', account = E.createAccount(), trigger = long ? 105 : 95;
    pending(account, { type: 'stop', side, orderPrice: trigger });
    const candle = gap ? long ? bar(1, 110, 115, 108, 112) : bar(1, 90, 92, 85, 88) : bar(1, 100, 108, 92, 101);
    const [event] = E.processBar(account, candle, 1);
    assert.equal(event.type, 'opened');
    approximately(event.position.entryReferencePrice, gap ? candle.open : trigger);
    approximately(event.position.entryPrice, (gap ? candle.open : trigger) * (long ? 1.0002 : 0.9998));
    assert.deepEqual(E.restoreAccount(copy(account)), account);
  }
});

test('pending entry risk, exposure and protection are revalidated at gap fill without silently resizing', () => {
  const cases = [
    { balance: 1000, setup: { type: 'stop', qty: 9, orderPrice: 105 }, candle: bar(1, 120, 125, 118, 122), reason: /1× equity/ },
    { setup: { type: 'stop', orderPrice: 105, stop: 95, riskBudget: 102 }, candle: bar(1, 110, 112, 108, 111), reason: /risk budget/ },
    { setup: { orderPrice: 95, stop: 90 }, candle: bar(1, 85, 87, 83, 86), reason: /stop must/ },
    { setup: { type: 'stop', orderPrice: 105, target: 110 }, candle: bar(1, 115, 118, 114, 116), reason: /target must/ }
  ];
  for (const scenario of cases) {
    const account = E.createAccount(scenario.balance || 100000);
    pending(account, scenario.setup);
    const balance = account.balance;
    const [event] = E.processBar(account, scenario.candle, 1);
    assert.equal(event.type, 'rejected');
    assert.match(event.reason, scenario.reason);
    assert.equal(account.balance, balance);
    assert.equal(account.position, null);
    assert.equal(account.pendingOrders.length, 0);
    assert.equal(account.trades.length, 0);
    assert.deepEqual(E.restoreAccount(copy(account)), account);
  }
});

test('entry-bar extremes never activate protection; the following ambiguous bar exits conservatively', () => {
  const account = E.createAccount();
  pending(account, { orderPrice: 95, stop: 90, target: 105 });
  const [entry] = E.processBar(account, bar(1, 100, 110, 85, 96), 1);
  assert.equal(entry.type, 'opened');
  assert.equal(account.trades.length, 0);
  assert.deepEqual(E.processBar(account, bar(1, 100, 110, 85, 96), 1), []);
  const [exit] = E.processBar(account, bar(2, 96, 110, 85, 100), 2);
  assert.equal(exit.type, 'closed');
  assert.equal(exit.trade.exitReason, 'stop_ambiguous');
  approximately(exit.trade.rMultiple, -1);
  assert.deepEqual(E.restoreAccount(copy(account)), account);
});

test('untouched pending orders retain their replay cursor through reload and can be cancelled without a fill', () => {
  let account = E.createAccount();
  const order = pending(account);
  assert.deepEqual(E.processBar(account, bar(1), 1), []);
  assert.deepEqual(E.processBar(account, bar(2), 2), []);
  const saved = copy(account);
  account = E.restoreAccount(saved, { maxBarIndex: 2 });
  assert.deepEqual(account, saved);
  assert.deepEqual(E.processBar(account, bar(2, 100, 105, 90, 101), 2), [], 'a different candle at the saved cursor is not reprocessed');
  unchanged(account, () => E.cancelOrder(account, point(2, { orderId: 'stale-id' })), /no longer active/);
  const cancelled = E.cancelOrder(account, point(2, { orderId: order.id }));
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(account.balance, account.initialBalance);
  assert.deepEqual(E.processBar(account, bar(3, 100, 105, 90, 101), 3), []);
  assert.deepEqual(E.restoreAccount(copy(account), { maxBarIndex: 3 }), account);
});

test('pending data errors never consume an order and a restored untouched order fills on its next trigger', () => {
  const account = E.createAccount();
  pending(account);
  unchanged(account, () => E.processBar(account, bar(1, 100, 99, 90, 95), 1), /OHLC/);
  unchanged(account, () => E.processBar(account, bar(0), 1), /after its submission/);
  E.processBar(account, bar(1), 1);
  const restored = E.restoreAccount(copy(account), { maxBarIndex: 1 });
  assert.equal(E.processBar(restored, bar(2, 100, 105, 94, 96), 2)[0].type, 'opened');
  assert.equal(restored.position.entryBarIndex, 2);
});

test('restoration recomputes economics and preserves review fields through partial closes and modified protection', () => {
  const account = E.createAccount();
  enter(account, { plan: 'Breakout retest', tags: ['patient'] });
  E.closePosition(account, point(1, { qty: 3, price: 108 }));
  Object.assign(account.trades[0], { notes: 'Closed a planned portion.', followedPlan: false, mistake: 'early-exit' });
  E.modifyPosition(account, point(1, { price: 108, stop: 102, target: 120 }));
  E.processCandle(account, bar(2, 108, 112, 105, 110), 2);
  const saved = copy(account);
  const clean = E.restoreAccount(saved, { maxBarIndex: 2 });
  assert.deepEqual(clean, account);
  assert.equal(saved.position.lastProcessedBarIndex, 2);
  saved.position.entryPrice = 1;
  saved.position.entryFee = 0;
  saved.position.plannedRisk = 0;
  saved.trades[0].netPnl = 1e9;
  saved.trades[0].fees = 0;
  saved.trades[0].rMultiple = 1234;
  assert.deepEqual(E.restoreAccount(saved, { maxBarIndex: 2 }), clean, 'serialized derived values never override execution economics');
  const exit = E.processCandle(clean, bar(3, 100, 104, 96, 101), 3);
  assert.equal(exit.gap, true);
  assert.equal(exit.exitReason, 'stop_gap');
  assert.deepEqual(E.restoreAccount(copy(clean)), clean);
});

test('restoration rejects changed execution intent, event ordering, cursors and inconsistent balances', () => {
  const account = E.createAccount();
  enter(account);
  E.closePosition(account, point(1, { qty: 3, price: 104 }));
  const saved = copy(account);
  for (const mutate of [
    a => { a.balance += 1; }, a => { a.trades[0].qty = 4; }, a => { a.position.qty = 8; },
    a => { a.events[1].qty = 4; }, a => { a.events[0].kind = 'deposit'; },
    a => { a.events[1].barIndex = -1; }, a => { a.events[1].time = baseTime - 1; },
    a => { a.position.lastProcessedBarIndex = 2; }, a => { a.trades[0] = null; },
    a => { a.executionVersion = 999; }, a => { delete a.events; },
    a => { delete a.initialBalance; }
  ]) {
    const corrupt = copy(saved); mutate(corrupt);
    assert.throws(() => E.restoreAccount(corrupt, { maxBarIndex: 1 }));
  }
  assert.throws(() => E.restoreAccount(saved, { maxBarIndex: 0 }), /beyond the replay/);
  assert.deepEqual(E.restoreAccount(saved, { maxBarIndex: Infinity }), account);
  assert.deepEqual(saved, account, 'restore never mutates the input');
});

test('pending ledgers reject invented trigger outcomes, mismatched order IDs and missing ledgers', () => {
  const account = E.createAccount();
  pending(account);
  E.processBar(account, bar(1, 100, 104, 94, 96), 1);
  for (const mutate of [
    a => { a.events[1].outcome = 'rejected'; },
    a => { a.events[1].orderId = 'made-up'; },
    a => { a.events[1].candle.low = 96; },
    a => { a.events[1].candle.time += 1; },
    a => { delete a.executionVersion; delete a.events; }
  ]) { const corrupt = copy(account); mutate(corrupt); assert.throws(() => E.restoreAccount(corrupt)); }
  const waiting = E.createAccount(); pending(waiting); E.processBar(waiting, bar(1), 1);
  for (const mutate of [a => { a.pendingOrders[0].orderPrice = 96; }, a => { a.pendingOrders[0].id = 'changed'; }, a => { a.pendingOrders[0].lastProcessedBarIndex = 2; }]) {
    const corrupt = copy(waiting); mutate(corrupt); assert.throws(() => E.restoreAccount(corrupt, { maxBarIndex: 1 }));
  }
});

test('legacy full-position accounts migrate with matching balance, reviews and active replay cursor', () => {
  const account = E.createAccount();
  enter(account);
  E.processCandle(account, bar(1, 100, 112, 90, 100), 1);
  enter(account, { ...point(2), side: 'short', stop: 105, target: 90 });
  E.processCandle(account, bar(3), 3);
  const legacy = copy(account);
  delete legacy.executionVersion; delete legacy.events; delete legacy.pendingOrders;
  const added = ['initialQty', 'initialEntryFee', 'initialPlannedRisk', 'initialStop', 'initialTarget', 'entryOrderType', 'entryOrderPrice', 'entryOrderId', 'realizedPnl', 'exitCount', 'positionId', 'partial', 'positionClosed', 'remainingQty', 'positionRealizedPnl'];
  for (const record of [...legacy.trades, legacy.position]) for (const key of added) delete record[key];
  Object.assign(legacy.trades[0], { notes: 'Legacy review', followedPlan: true, mistake: 'patience' });
  const restored = E.restoreAccount(legacy, { maxBarIndex: 3 });
  approximately(restored.balance, account.balance);
  approximately(restored.position.entryPrice, account.position.entryPrice);
  assert.equal(restored.position.lastProcessedBarIndex, 3);
  assert.equal(restored.trades[0].ambiguous, true);
  assert.equal(restored.trades[0].notes, 'Legacy review');
  assert.equal(restored.trades[0].followedPlan, true);
  assert.equal(restored.executionVersion, 2);
  assert.deepEqual(E.restoreAccount(copy(restored)), restored);
  assert.throws(() => E.restoreAccount(legacy, { maxBarIndex: 2 }), /cursor/);
});

test('extended accounts cannot masquerade as legacy to discard edited risk or partial-fill history', () => {
  for (const operation of [a => E.modifyPosition(a, point(1, { price: 105, stop: 101 })), a => E.closePosition(a, point(1, { qty: 2 }))]) {
    const account = E.createAccount(); enter(account); operation(account);
    delete account.executionVersion; delete account.events;
    assert.throws(() => E.restoreAccount(account), /ledger is missing/);
  }
});

test('the execution-ledger bound rejects another mutation atomically', () => {
  const account = E.createAccount();
  enter(account);
  account.events = Array.from({ length: E.MAX_EVENTS }, () => ({ ...account.events[0] }));
  unchanged(account, () => E.closePosition(account, point(1)), /10,000 events/);
});

test('near the ledger bound, protection edits and reductions always leave capacity to close the account', () => {
  for (const partial of [false, true]) {
    const account = E.createAccount();
    enter(account);
    const first = account.events[0];
    const edit = { kind: 'modify', stop: 95, target: 110, ...point(0) };
    account.events = [first, ...Array.from({ length: E.MAX_EVENTS - 3 }, () => ({ ...edit }))];
    if (partial) E.closePosition(account, point(1, { qty: 2 }));
    else E.modifyPosition(account, point(1, { stop: 96 }));
    assert.equal(account.events.length, E.MAX_EVENTS - 1);
    unchanged(account, () => E.modifyPosition(account, point(1, { stop: 97 })), /10,000 events/);
    unchanged(account, () => E.closePosition(account, point(1, { qty: 1 })), /Close the full remaining/);
    E.closePosition(account, point(1));
    assert.equal(account.events.length, E.MAX_EVENTS);
    assert.equal(account.position, null);
    approximately(account.balance, account.initialBalance + account.trades.reduce((sum, t) => sum + t.netPnl, 0));
  }
});
