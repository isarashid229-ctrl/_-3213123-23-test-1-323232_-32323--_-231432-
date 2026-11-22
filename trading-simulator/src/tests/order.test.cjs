'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const O = require('../order-controller.js');

const time = 1772323200;
const request = overrides => Object.assign({ action: 'buy', qty: 10, price: 100, time, barIndex: 0 }, overrides);
const later = overrides => request(Object.assign({ price: 102, time: time + 900, barIndex: 1 }, overrides));
const clone = value => JSON.parse(JSON.stringify(value));
const approx = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
const rejectsWithoutChange = (account, input, code) => {
  const before = clone(account), position = account.position;
  assert.throws(() => O.execute(account, input), error => !code || error.code === code);
  assert.deepEqual(account, before);
  assert.equal(account.position, position);
};

test('Buy and Sell immediately open paper positions with optional blank protections', () => {
  for (const action of ['buy', 'sell']) {
    const account = E.createAccount();
    const result = O.execute(account, request({ action, stop: '   ', target: '', riskBudget: '' }));
    assert.equal(result.action, action);
    assert.equal(result.type, 'opened');
    assert.equal(result.position, account.position);
    assert.equal(result.trade, null);
    assert.equal(account.position.side, action === 'buy' ? 'long' : 'short');
    assert.equal(account.position.stop, null);
    assert.equal(account.position.target, null);
    assert.equal(account.position.plannedRisk, null);
    assert.match(result.message, /filled: 10 units/);
    approx(account.balance, 100000 - account.position.entryFee);
    assert.equal(E.processCandle(account, { time: time + 900, open: 100, high: 200, low: 50, close: 120 }, 1), null);
  }
});

test('preview is nonmutating and its fills and classification match execution', () => {
  const account = E.createAccount(), before = clone(account);
  const input = request({ stop: 95, target: 110, riskBudget: 100, plan: 'A planned entry', tags: ['risk'] });
  const preview = O.preview(account, input);
  assert.deepEqual(account, before);
  assert.match(preview.message, /^Ready to open/);
  const result = O.execute(account, input);
  for (const field of ['action', 'type', 'position', 'trade']) assert.deepEqual(result[field], preview[field]);
  const open = clone(account);
  const closePreview = O.preview(account, later({ action: 'sell', qty: undefined }));
  closePreview.trade.tags.push('preview-only');
  assert.deepEqual(account, open, 'editing a preview must not modify a saved position');
});

test('opposite-side actions close the full position without inheriting malformed entry fields or reversing', () => {
  for (const action of ['buy', 'sell']) {
    const account = E.createAccount();
    O.execute(account, request({ action }));
    const opposite = action === 'buy' ? 'sell' : 'buy';
    const result = O.execute(account, later({ action: opposite, qty: 'not a number', stop: -50, target: 'stale', riskBudget: 0, allowEntry: false }));
    assert.equal(result.type, 'closed');
    assert.equal(result.action, opposite);
    assert.equal(result.trade.qty, 10);
    assert.equal(result.trade.exitReason, 'opposite action');
    assert.equal(account.position, null);
    assert.equal(account.trades.length, 1);
    approx(account.balance, 100000 + result.trade.netPnl);
    assert.match(result.message, /closed: 10 units/);
    rejectsWithoutChange(account, later({ action: opposite, qty: undefined }), 'INVALID_QUANTITY');
  }
});

test('same-side actions reject accidental pyramiding and repeated Buy clicks charge no additional fees', () => {
  const account = E.createAccount();
  O.execute(account, request());
  rejectsWithoutChange(account, request(), 'POSITION_ALREADY_OPEN');
  assert.throws(() => O.preview(account, request()), /Use Sell to close it, or Reverse/);
  O.execute(account, later({ action: 'close', qty: -1 }));
  rejectsWithoutChange(account, later({ action: 'close' }), 'NO_POSITION');
  rejectsWithoutChange(account, later({ action: 'reverse' }), 'NO_POSITION');
});

test('explicit reversal closes then opens the opposite side once, using the old size and fresh optional exits', () => {
  for (const action of ['buy', 'sell']) {
    const account = E.createAccount();
    O.execute(account, request({ action, stop: action === 'buy' ? 95 : 105, target: action === 'buy' ? 110 : 90, plan: 'Original thesis', tags: ['original'] }));
    const result = O.execute(account, later({ action: 'reverse', qty: undefined }));
    assert.equal(result.type, 'reversed');
    assert.equal(result.position, account.position);
    assert.equal(result.trade, account.trades[0]);
    assert.equal(result.trade.exitReason, 'reverse');
    assert.equal(account.trades.length, 1);
    assert.equal(account.position.side, action === 'buy' ? 'short' : 'long');
    assert.equal(account.position.qty, 10);
    assert.equal(account.position.entryBarIndex, result.trade.exitBarIndex);
    assert.equal(account.position.stop, null);
    assert.equal(account.position.target, null);
    assert.equal(account.position.plannedRisk, null);
    assert.equal(account.position.plan, '');
    assert.deepEqual(account.position.tags, []);
    approx(account.balance, 100000 + result.trade.netPnl - result.position.entryFee);
    assert.match(result.message, /reversed: closed/);
  }
});

test('invalid reversal replacements are atomic: original position, costs, and journal remain untouched', () => {
  const account = E.createAccount();
  O.execute(account, request({ stop: 95, target: 110 }));
  for (const invalid of [
    { qty: 0 }, { qty: NaN }, { qty: 100000 }, { stop: 95 }, { target: 110 },
    { stop: 110, riskBudget: 1 }, { target: 0 }, { price: Infinity }
  ]) rejectsWithoutChange(account, later({ action: 'reverse', ...invalid }));
  assert.equal(account.trades.length, 0);
  assert.equal(account.position.side, 'long');
});

test('a same-size reversal at the exposure ceiling cannot overspend remaining equity after closing costs', () => {
  const account = E.createAccount(1000);
  const size = E.sizePosition({ equity: 1000, entry: 100, stop: 99.99, side: 'long', riskPct: 100 });
  O.execute(account, request({ qty: size.qty }));
  rejectsWithoutChange(account, request({ action: 'reverse', qty: undefined }), 'EXPOSURE_LIMIT');
  const result = O.execute(account, request({ action: 'reverse', qty: 9 }));
  assert.equal(result.position.qty, 9);
  assert.equal(result.position.side, 'short');
});

test('reversal accepts a deliberate replacement quantity and independent protective prices', () => {
  const account = E.createAccount();
  O.execute(account, request({ stop: 95, target: 110 }));
  const result = O.execute(account, later({ action: 'reverse', qty: 2, stop: 110, target: 95, riskBudget: 20, plan: 'A new short thesis' }));
  assert.equal(result.trade.qty, 10);
  assert.equal(result.position.qty, 2);
  assert.equal(result.position.stop, 110);
  assert.equal(result.position.target, 95);
  assert.equal(result.position.plan, 'A new short thesis');
  assert.ok(result.position.plannedRisk <= 20);
});

test('stale protective levels produce current-fill guidance instead of being silently discarded', () => {
  const account = E.createAccount();
  assert.throws(() => O.preview(account, request({ price: 80, stop: 95, target: 110 })), error => error.code === 'INVALID_STOP' && /below the current long fill of 80\.016/.test(error.message) && /Reset the brackets/.test(error.message));
  assert.throws(() => O.preview(account, request({ price: 120, stop: 95, target: 110 })), error => error.code === 'INVALID_TARGET' && /above the current long fill/.test(error.message));
  assert.equal(account.position, null);
  assert.equal(account.balance, 100000);
});

test('risk budgets require an actual stop and include costs while a target alone remains optional', () => {
  const account = E.createAccount();
  rejectsWithoutChange(account, request({ stop: '', riskBudget: 50 }), 'STOP_REQUIRED');
  rejectsWithoutChange(account, request({ stop: 95, riskBudget: 50 }), 'RISK_LIMIT');
  const result = O.execute(account, request({ target: 110 }));
  assert.equal(result.position.stop, null);
  assert.equal(result.position.target, 110);
  assert.equal(result.position.plannedRisk, null);
});

test('the end of a dataset blocks entry and reversal but still permits an explicit close', () => {
  const account = E.createAccount();
  rejectsWithoutChange(account, request({ allowEntry: false }), 'DATA_ENDED');
  O.execute(account, request());
  rejectsWithoutChange(account, later({ action: 'reverse', allowEntry: false }), 'DATA_ENDED');
  const result = O.execute(account, later({ action: 'close', allowEntry: false }));
  assert.equal(result.type, 'closed');
  assert.equal(account.position, null);
});

test('invalid prices, quantities, actions, and stale replay coordinates do not change the account', () => {
  const account = E.createAccount();
  for (const invalid of [{ qty: '' }, { qty: -1 }, { qty: true }, { price: 0 }, { price: '1x' }, { action: 'limit' }, { barIndex: -1 }, { time: 'invalid' }, { allowEntry: 'false' }]) rejectsWithoutChange(account, request(invalid));
  O.execute(account, request());
  E.processCandle(account, { time: time + 1800, open: 100, high: 104, low: 98, close: 102 }, 2);
  rejectsWithoutChange(account, later({ action: 'close' }), 'STALE_REPLAY');
  O.execute(account, later({ action: 'close', barIndex: 2, time: time + 1800 }));
  rejectsWithoutChange(account, later({ action: 'buy' }), 'STALE_REPLAY');
});

test('market actions retain existing fee/slippage settings and charge each fill exactly once', () => {
  const account = E.createAccount(10000, { feeRate: 0.001, slippageRate: 0.002 });
  const entry = O.execute(account, request());
  approx(entry.position.entryPrice, 100.2);
  approx(entry.position.entryFee, 1.002);
  const close = O.execute(account, request({ action: 'sell', qty: undefined }));
  approx(close.trade.exitPrice, 99.8);
  approx(close.trade.exitFee, 0.998);
  approx(close.trade.netPnl, -6);
  approx(account.balance, 9994);
});

test('newly reversed protections cannot trigger against the already revealed entry bar', () => {
  const account = E.createAccount();
  O.execute(account, request());
  O.execute(account, later({ action: 'reverse', qty: undefined, stop: 110, target: 95 }));
  assert.equal(E.processCandle(account, { time: time + 900, open: 102, high: 120, low: 80, close: 102 }, 1), null);
  assert.ok(account.position);
  const exit = E.processCandle(account, { time: time + 1800, open: 102, high: 120, low: 80, close: 102 }, 2);
  assert.equal(exit.exitReason, 'stop_ambiguous');
  assert.equal(account.position, null);
});

test('mixed market actions reconstruct through the original backup accounting format', () => {
  const account = E.createAccount();
  O.execute(account, request({ stop: 95, target: 110 }));
  O.execute(account, later({ action: 'reverse', qty: undefined }));
  O.execute(account, later({ action: 'buy', qty: undefined, barIndex: 2, time: time + 1800, price: 101 }));
  account.trades[0].notes = 'A saved review';
  O.execute(account, later({ action: 'sell', qty: 5, barIndex: 2, time: time + 1800, price: 101 }));
  const rebuilt = E.createAccount();
  for (const trade of clone(account).trades) {
    E.openPosition(rebuilt, { side: trade.side, qty: trade.qty, price: trade.entryReferencePrice, time: trade.entryTime, barIndex: trade.entryBarIndex, stop: trade.stop, target: trade.target, plan: trade.plan, tags: trade.tags });
    E.closePosition(rebuilt, { price: trade.exitReferencePrice, time: trade.exitTime, barIndex: trade.exitBarIndex, reason: trade.exitReason });
  }
  const p = account.position;
  E.openPosition(rebuilt, { side: p.side, qty: p.qty, price: p.entryReferencePrice, time: p.entryTime, barIndex: p.entryBarIndex, stop: p.stop, target: p.target, plan: p.plan, tags: p.tags });
  approx(rebuilt.balance, account.balance);
  assert.deepEqual(rebuilt.position, account.position);
  assert.deepEqual(rebuilt.trades.map(t => t.netPnl), account.trades.map(t => t.netPnl));
  assert.equal(account.trades[0].notes, 'A saved review');
});
