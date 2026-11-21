'use strict';
// Integration tests execute the real app source with lightweight DOM/state
// doubles. They verify accounting and persistence, not visual browser behavior.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const E = require('../engine.js');
const startTime = 1772323200;
function sampleCSV(count = 100) { return 'time,open,high,low,close,volume\n' + Array.from({ length: count }, (_, i) => `${startTime + i * 900},100,101,99,100,500`).join('\n'); }
function harness({ count = 100, saved, marketLoad } = {}) {
  const elements = new Map(), timers = new Map(), store = new Map(), listeners = new Map();
  let nextTimer = 0;
  if (saved) store.set('replaylab-academy-v2', typeof saved === 'string' ? saved : JSON.stringify(saved));
  function element(id) {
    if (elements.has(id)) return elements.get(id);
    const attributes = new Map(), handlers = new Map(), classes = new Set();
    const el = {
      id, value: ({ riskPercent: '0.5', speedSelect: '3', dataSymbol: 'BTC-USD', dataInterval: '15m', dataStart: '' })[id] || '',
      checked: false, hidden: false, disabled: false, textContent: '', innerHTML: '', dataset: {}, style: {}, open: false,
      classList: { toggle(name, force) { if (force === undefined ? !classes.has(name) : force) classes.add(name); else classes.delete(name); }, add(name) { classes.add(name); }, remove(name) { classes.delete(name); } },
      addEventListener(type, fn) { handlers.set(type, fn); },
      setAttribute(name, value) { attributes.set(name, value); }, getAttribute(name) { return attributes.get(name); }, removeAttribute(name) { attributes.delete(name); },
      showModal() { this.open = true; }, close() { this.open = false; }, click() {}, remove() {}, scrollIntoView() {},
      querySelector() { return null; }, querySelectorAll() { return []; }, handlers
    };
    elements.set(id, el); return el;
  }
  const document = {
    getElementById: element, title: '', hidden: false,
    querySelectorAll() { return []; }, querySelector(selector) { return selector === 'dialog[open]' ? [...elements.values()].find(e => e.open) || null : null; },
    addEventListener(type, fn) { listeners.set(type, fn); }, createElement: () => element('created'), body: { appendChild() {} }
  };
  const noop = () => {};
  const window = {
    ReplayEngine: E,
    ReplayMarket: { load: marketLoad || (async () => { throw new Error('Test network unavailable'); }) },
    ReplayLabs: { items: ['candles', 'structure', 'levels', 'sizing', 'orders', 'riskreward', 'expectancy', 'discipline'].map(id => ({ id })), render: () => noop },
    ReplayChart: { create: () => ({ draw: noop, latest: noop, reset: noop, zoom: noop, setLevelMode: noop }) },
    REPLAY_ARCHIVE_CSV: sampleCSV(count), addEventListener: noop, scrollTo: noop
  };
  const location = { hash: '#practice' };
  const sandbox = {
    window, document, location, structuredClone, Blob, URL, console,
    localStorage: { getItem: key => store.get(key) || null, setItem: (key, value) => store.set(key, value) },
    setTimeout(fn) { const id = ++nextTimer; timers.set(id, fn); return id; }, clearTimeout(id) { timers.delete(id); },
    setInterval(fn) { const id = ++nextTimer; timers.set(id, fn); return id; }, clearInterval(id) { timers.delete(id); }
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../academy.js'), 'utf8'), sandbox, { filename: 'academy.js' });
  const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
  const hook = '\nwindow.__appTest={s,cleanAccount,cleanSnapshot,snapshot,saveNow,advance,rewind,restart,finishConfirm,useData,openTrade,closeTrade,resetPrices,loadPublic,importCSV};\n})();';
  assert.match(source, /\n\}\)\(\);\s*$/);
  vm.runInContext(source.replace(/\n\}\)\(\);\s*$/, hook), sandbox, { filename: 'app.js' });
  return { app: window.__appTest, element, store, timers, window, document, location };
}
function enter(h, { side = 'long', stop = 95, target = 110, qty = 1 } = {}) {
  h.app.s.side = side;
  h.element('stopPrice').value = String(stop);
  h.element('targetPrice').value = String(target);
  h.element('quantity').value = String(qty);
  h.element('tradePlan').value = 'A documented setup with a planned invalidation.';
  h.app.openTrade({ preventDefault() {} });
  assert.ok(h.app.s.account.position, h.element('orderError').textContent);
}
const plain = value => JSON.parse(JSON.stringify(value));

test('initial replay leaves useful future candles for both short and full datasets', () => {
  for (const count of [10, 20, 100, 2976]) {
    const h = harness({ count });
    assert.ok(h.app.s.cursor >= 0);
    assert.ok(h.app.s.cursor < count - 1);
    assert.equal(h.element('stepButton').disabled, false);
    assert.equal(h.app.s.account.balance, 100000);
    assert.equal(h.app.s.data.candles.length, count);
  }
});

test('entry, mark-to-market equity, and an active position survive save/reload without double fees', () => {
  const h = harness();
  enter(h);
  h.app.advance(h.app.s.cursor + 3);
  const before = plain(h.app.snapshot());
  const equity = E.equity(h.app.s.account, 100);
  h.app.saveNow();
  const restored = harness({ saved: h.store.get('replaylab-academy-v2') });
  assert.deepEqual(plain(restored.app.s.account), before.session.account);
  assert.equal(restored.app.s.cursor, before.session.cursor);
  assert.equal(E.equity(restored.app.s.account, 100), equity);
  assert.equal(restored.app.s.account.position.lastProcessedBarIndex, restored.app.s.cursor);
  restored.app.closeTrade();
  assert.equal(restored.app.s.account.trades.length, 1);
  assert.ok(Math.abs(restored.app.s.account.trades[0].netPnl + 0.12) < 1e-8);
  assert.ok(Math.abs(restored.app.s.account.balance - 99999.88) < 1e-8);
});

test('jumping forward processes each bar and pauses exactly at the first protective exit', () => {
  const h = harness();
  enter(h);
  const exitIndex = h.app.s.cursor + 5;
  Object.assign(h.app.s.data.candles[exitIndex], { high: 112, low: 94 });
  h.app.advance(h.app.s.data.candles.length - 1);
  assert.equal(h.app.s.cursor, exitIndex);
  assert.equal(h.app.s.account.position, null);
  assert.equal(h.app.s.account.trades.length, 1);
  assert.equal(h.app.s.account.trades[0].exitReason, 'stop_ambiguous');
  assert.ok(Math.abs(h.app.s.account.trades[0].rMultiple + 1) < 1e-8);
  assert.equal(h.element('replaySlider').value, String(exitIndex));
});

test('end of data disables new entries but leaves an open position available for manual closing', () => {
  const h = harness({ count: 10 });
  enter(h, { stop: 1, target: 1000, qty: 0.1 });
  h.app.advance(9);
  assert.equal(h.app.s.cursor, 9);
  assert.ok(h.app.s.account.position);
  assert.equal(h.element('openTrade').disabled, true);
  assert.equal(h.element('playButton').disabled, true);
  assert.equal(h.element('stepButton').disabled, true);
  h.app.closeTrade();
  assert.equal(h.app.s.account.trades.length, 1);
  h.app.openTrade({ preventDefault() {} });
  assert.equal(h.app.s.account.position, null);
  assert.match(h.element('orderError').textContent, /dataset has ended/);
});

test('rewind cancellation preserves the account and approval closes/archives it before resetting', async () => {
  const h = harness();
  enter(h);
  h.app.advance(30);
  const original = plain(h.app.s.account);
  const cancelled = h.app.rewind(5);
  assert.equal(h.element('confirmDialog').open, true);
  h.app.finishConfirm(false);
  await cancelled;
  assert.equal(h.app.s.cursor, 30);
  assert.deepEqual(plain(h.app.s.account), original);
  const confirmed = h.app.rewind(5);
  h.app.finishConfirm(true);
  await confirmed;
  assert.equal(h.app.s.cursor, 5);
  assert.equal(h.app.s.start, 5);
  assert.equal(h.app.s.account.balance, 100000);
  assert.equal(h.app.s.account.position, null);
  assert.equal(h.app.s.history.length, 1);
  const archived = h.app.s.history[0].account;
  assert.equal(archived.trades.length, 1);
  assert.equal(archived.trades[0].exitBarIndex, 30);
  assert.equal(archived.trades[0].exitReason, 'replay reset');
  assert.equal(archived.position, null);
});

test('changing datasets preserves old trades under the original market and resets the new session', () => {
  const h = harness();
  enter(h, { side: 'short', stop: 105, target: 90 });
  const oldId = h.app.s.id;
  h.app.useData({ candles: E.parseCSV(sampleCSV(10)), symbol: 'TEST-USD', timeframe: 'CSV', source: 'Test import', providerId: 'csv', mode: 'csv' });
  assert.equal(h.app.s.data.symbol, 'TEST-USD');
  assert.equal(h.app.s.cursor, 2);
  assert.equal(h.app.s.history[0].id, oldId);
  assert.equal(h.app.s.history[0].symbol, 'BTC-USDT');
  assert.equal(h.app.s.history[0].account.trades[0].side, 'short');
  assert.equal(h.app.s.history[0].account.trades[0].exitReason, 'data changed');
  assert.notEqual(h.app.s.id, oldId);
  assert.equal(h.app.s.account.balance, 100000);
  assert.equal(h.app.s.account.trades.length, 0);
});

test('backup reconstruction recalculates derived P&L and rejects inconsistent balances or execution models', () => {
  const h = harness();
  enter(h); h.app.closeTrade();
  const raw = plain(h.app.s.account);
  raw.trades[0].netPnl = 999999;
  raw.trades[0].entryPrice = 1;
  raw.trades[0].fees = 0;
  raw.trades[0].notes = 'A saved review';
  raw.trades[0].followedPlan = true;
  const clean = h.app.cleanAccount(raw, h.app.s.cursor);
  assert.ok(Math.abs(clean.trades[0].netPnl + 0.12) < 1e-8);
  assert.equal(clean.trades[0].notes, 'A saved review');
  assert.equal(clean.trades[0].followedPlan, true);
  assert.throws(() => h.app.cleanAccount({ ...raw, balance: raw.balance + 20 }), /balance does not match/);
  assert.throws(() => h.app.cleanAccount({ ...raw, feeRate: 0 }), /different execution model/);
  const malformed = plain(raw);
  malformed.trades[0].exitBarIndex = h.app.s.cursor + 1;
  assert.throws(() => h.app.cleanAccount(malformed, h.app.s.cursor), /trade sequence is invalid/);
});

test('invalid CSV and failed public requests preserve the active dataset and account', async () => {
  const h = harness();
  enter(h);
  const before = plain(h.app.snapshot());
  await h.app.importCSV({ name: 'bad.csv', size: 100, text: async () => 'time,open,high,low,close\n1772323200,100,90,98,102' });
  assert.deepEqual(plain(h.app.s.account), before.session.account);
  assert.deepEqual(plain(h.app.s.data), before.session.data);
  assert.equal(h.app.s.loading, false);
  await h.app.loadPublic();
  assert.deepEqual(plain(h.app.s.account), before.session.account);
  assert.deepEqual(plain(h.app.s.data), before.session.data);
  assert.equal(h.app.s.id, before.session.id);
  assert.equal(h.app.s.loading, false);
  assert.equal(h.element('loadPublic').disabled, false);
  assert.match(h.element('dataMessage').textContent, /existing replay is still ready/);
});

test('progress, journal reviews, archived sessions, and an active trade round-trip together', () => {
  const h = harness();
  enter(h); h.app.closeTrade();
  h.app.s.account.trades[0].notes = 'Followed the plan';
  h.app.s.account.trades[0].followedPlan = true;
  h.app.s.account.trades[0].mistake = 'none';
  h.app.useData({ ...h.app.s.data });
  enter(h);
  const firstModule = h.window.ReplayAcademy.modules[0];
  h.app.s.progress.lessons[firstModule.lessons[0].id] = true;
  h.app.s.progress.quizzes[firstModule.id] = { best: 100, attempts: 2 };
  h.app.s.progress.labs.sizing = { best: 80, attempts: 1 };
  h.app.s.levels.push(100);
  const raw = plain(h.app.snapshot());
  const clean = plain(h.app.cleanSnapshot(raw));
  assert.deepEqual(clean.account, raw.session.account);
  assert.deepEqual(clean.history, raw.history);
  assert.deepEqual(clean.progress, raw.progress);
  assert.deepEqual(clean.levels, [100]);
  assert.equal(clean.history[0].account.trades[0].notes, 'Followed the plan');
});
