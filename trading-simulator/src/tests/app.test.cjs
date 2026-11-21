'use strict';
// Integration tests execute the real app source with lightweight DOM/state
// doubles. They verify accounting and persistence, not visual browser behavior.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const E = require('../engine.js');
const T = require('../time.js');
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
      id, value: ({ riskPercent: '0.5', speedSelect: '3', dataSymbol: 'BTC-USD', dataInterval: '15m', dataStart: '', csvTimeframe: 'auto', csvAssetClass: 'equity' })[id] || '',
      checked: false, hidden: false, disabled: false, textContent: '', innerHTML: '', dataset: {}, style: {}, open: false,
      classList: { toggle(name, force) { if (force === undefined ? !classes.has(name) : force) classes.add(name); else classes.delete(name); }, add(name) { classes.add(name); }, remove(name) { classes.delete(name); } },
      addEventListener(type, fn) { if (!handlers.has(type)) handlers.set(type, []); handlers.get(type).push(fn); },
      setAttribute(name, value) { attributes.set(name, value); }, getAttribute(name) { return attributes.get(name); }, removeAttribute(name) { attributes.delete(name); }, hasAttribute(name) { return attributes.has(name); },
      showModal() { this.open = true; }, close() { this.open = false; }, click() {}, remove() {}, scrollIntoView() {}, focus() {}, setSelectionRange() {},
      appendChild() {}, parentElement: { dataset: {} },
      closest(selector) { return selector === 'button,a' ? this : null; }, matches(selector) { return selector === '[data-exam-form]' ? !!this.dataset.examForm : selector === '[data-quiz-form]' ? !!this.dataset.quizForm : selector === '[data-review-form]' ? !!this.dataset.reviewForm : false; },
      querySelector() { return null; }, querySelectorAll() { return []; }, handlers
    };
    elements.set(id, el); return el;
  }
  const document = {
    getElementById: element, title: '', hidden: false,
    querySelectorAll() { return []; }, querySelector(selector) { return selector === 'dialog[open]' ? [...elements.values()].find(e => e.open) || null : null; },
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(fn); }, createElement: () => element('created'), body: element('body')
  };
  const noop = () => {};
  const window = {
    ReplayEngine: E,
    ReplayMarket: { load: marketLoad || (async () => { throw new Error('Test network unavailable'); }) },
    ReplayLabs: { items: ['candles', 'structure', 'levels', 'sizing', 'orders', 'riskreward', 'expectancy', 'discipline'].map(id => ({ id })), render: () => noop },
    ReplayChart: { create: (mount, tooltip, options) => { window.chartOptions = options; return { draw: noop, latest: noop, reset: noop, zoom: noop, setLevelMode: noop }; } },
    REPLAY_ARCHIVE_CSV: sampleCSV(count), addEventListener: noop, scrollTo: noop
  };
  const location = { hash: '#practice' };
  const sandbox = Object.assign(window, {
    window, document, location, structuredClone, Blob, URL, console,
    FormData: class { constructor(form) { this.values = new Map(Object.entries(form.values || {})); } get(key) { return this.values.has(key) ? this.values.get(key) : null; } has(key) { return this.values.has(key); } },
    localStorage: { getItem: key => store.get(key) || null, setItem: (key, value) => store.set(key, value) },
    setTimeout(fn) { const id = ++nextTimer; timers.set(id, fn); return id; }, clearTimeout(id) { timers.delete(id); },
    setInterval(fn) { const id = ++nextTimer; timers.set(id, fn); return id; }, clearInterval(id) { timers.delete(id); }
  });
  vm.createContext(sandbox);
  for (const file of ['time.js', 'instruments.js', 'academy.js', 'training.js', 'studio.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../' + file), 'utf8'), sandbox, { filename: file });
  const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
  const hook = '\nwindow.__appTest={s,studio,cleanAccount,cleanSnapshot,snapshot,saveNow,advance,rewind,restart,finishConfirm,useData,openTrade,closeTrade,resetPrices,sizeTrade,setSide,loadPublic,loadMore,importCSV,restoreBackup,allTrades,tradeRow};\n})();';
  assert.match(source, /\n\}\)\(\);\s*$/);
  vm.runInContext(source.replace(/\n\}\)\(\);\s*$/, hook), sandbox, { filename: 'app.js' });
  return { app: window.__appTest, element, store, timers, window, document, location, listeners,
    dispatch(type, target) { const event = { target, preventDefault() {} }; for (const fn of listeners.get(type) || []) fn(event); } };
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

test('date-only CSV imports preserve their New York session dates through DST', async () => {
  const h = harness();
  const dates = ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-09', '2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13'];
  const csv = 'Date,Open,High,Low,Close,Volume\n' + dates.map(date => `${date},100,102,98,101,500`).join('\n');
  await h.app.importCSV({ name: 'daily-equity.csv', size: csv.length, text: async () => csv });
  assert.equal(h.app.s.data.mode, 'csv');
  assert.equal(h.app.s.data.timeframe, '1d');
  assert.equal(h.app.s.data.assetClass, 'equity');
  assert.equal(h.app.s.data.volumeKind, 'shares');
  assert.deepEqual(Array.from(h.app.s.data.candles, b => T.date(b.time)), dates);
  assert.equal(T.parts(h.app.s.data.candles[4].time).zoneName, 'EST');
  assert.equal(T.parts(h.app.s.data.candles[5].time).zoneName, 'EDT');
  assert.equal(h.app.s.data.candles[5].time - h.app.s.data.candles[4].time, 71 * 3600);
});

test('tiny valid CSV prices retain visible quotes and usable default protective levels on both sides', async () => {
  const price = 0.000000012;
  const csv = 'time,open,high,low,close,volume\n' + Array.from({ length: 10 }, (_, i) => `${startTime + i * 900},${price},${price * 1.03},${price * 0.97},${price},1000`).join('\n');
  for (const side of ['long', 'short']) {
    const h = harness();
    h.app.setSide(side);
    h.element('csvAssetClass').value = 'crypto';
    await h.app.importCSV({ name: 'tiny-prices.csv', size: csv.length, text: async () => csv });
    assert.equal(h.app.s.data.mode, 'csv');
    assert.equal(Number(h.element('lastPrice').textContent.replace(/[$,]/g, '')), price);
    const stop = Number(h.element('stopPrice').value), target = Number(h.element('targetPrice').value), direction = side === 'long' ? 1 : -1;
    assert.ok(stop > 0 && target > 0);
    assert.ok(direction * (price - stop) > 0, 'default stop remains on the loss side');
    assert.ok(direction * (target - price) > 0, 'default target remains on the profit side');
    h.app.sizeTrade();
    h.app.openTrade({ preventDefault() {} });
    assert.ok(h.app.s.account.position, h.element('orderError').textContent);
    assert.equal(h.app.s.account.position.side, side);
    assert.equal(h.app.s.account.position.stop, stop);
    assert.equal(h.app.s.account.position.target, target);
    assert.ok(h.app.s.account.position.plannedRisk <= 500 + 1e-8);
  }
});

test('older Academy v2 backups migrate without shifting candles or altering an active account', () => {
  const h = harness();
  enter(h); h.app.advance(h.app.s.cursor + 2);
  const old = plain(h.app.snapshot());
  for (const key of ['settings', 'favorites', 'side', 'speed']) delete old.session[key];
  for (const key of ['assetClass', 'volumeKind', 'instrumentId', 'name', 'description', 'rangeLabel', 'sourceUrl', 'adjustmentNote']) delete old.session.data[key];
  for (const key of ['training', 'weekNotes', 'exams', 'rubric', 'planWeek']) delete old.progress[key];
  const firstLesson = h.window.ReplayAcademy.modules[0].lessons[0].id;
  const firstModule = h.window.ReplayAcademy.modules[0].id;
  const firstVideo = h.window.ReplayAcademy.videos[0].id;
  old.progress.lessons[firstLesson] = true;
  old.progress.quizzes[firstModule] = { best: 75, attempts: 3 };
  old.progress.labs.sizing = { best: 80, attempts: 2 };
  old.progress.watched[firstVideo] = true;
  const migrated = harness({ saved: old });
  assert.deepEqual(plain(migrated.app.s.account), old.session.account);
  assert.deepEqual(plain(migrated.app.s.data.candles), old.session.data.candles);
  assert.equal(migrated.app.s.progress.lessons[firstLesson], true);
  assert.deepEqual(plain(migrated.app.s.progress.quizzes[firstModule]), { best: 75, attempts: 3 });
  assert.deepEqual(plain(migrated.app.s.progress.labs.sizing), { best: 80, attempts: 2 });
  assert.equal(migrated.app.s.progress.watched[firstVideo], true);
  assert.equal(migrated.app.s.settings.chartTheme, 'light');
  assert.equal(migrated.app.s.progress.planWeek, 'week-1');
  assert.equal(migrated.app.s.speed, 3);
  assert.match(migrated.element('replayDate').textContent, /E[SD]T/);
});

test('stock selection, whole-share risk sizing and metadata survive a reload', () => {
  const h = harness();
  h.app.studio.loadInstrument('aapl-3m');
  assert.equal(h.app.s.data.instrumentId, 'aapl-3m');
  assert.equal(h.app.s.data.assetClass, 'equity');
  assert.equal(h.app.s.data.mode, 'equity');
  assert.equal(h.app.s.data.timeframe, '3m');
  assert.equal(h.app.s.data.volumeKind, 'ticks');
  h.app.sizeTrade();
  const qty = Number(h.element('quantity').value);
  assert.ok(qty >= 1 && Number.isInteger(qty));
  const b = h.app.s.data.candles[h.app.s.cursor];
  const ideal = E.sizePosition({ equity: 100000, entry: b.close, stop: Number(h.element('stopPrice').value), riskPct: 0.5, side: 'long' });
  assert.equal(qty, Math.floor(ideal.qty));
  h.app.openTrade({ preventDefault() {} });
  assert.ok(h.app.s.account.position);
  assert.ok(h.app.s.account.position.plannedRisk <= 500);
  h.app.s.settings.vwap = true;
  assert.equal(h.window.chartOptions.getData().settings.vwap, false, 'tick-count data must not masquerade as share-volume VWAP');
  const restored = harness({ saved: h.app.snapshot() });
  for (const key of ['instrumentId', 'symbol', 'name', 'timeframe', 'assetClass', 'volumeKind', 'sourceUrl', 'rangeLabel', 'adjustmentNote']) assert.equal(restored.app.s.data[key], h.app.s.data[key]);
  assert.deepEqual(plain(restored.app.s.account), plain(h.app.s.account));
});

test('chart preferences, favorites, weekly work and assessment progress round-trip together', () => {
  const h = harness();
  const week = h.window.ReplayTraining.weeks[5], exam = h.window.ReplayTraining.exams[0], rubric = h.window.ReplayTraining.rubric[0];
  h.app.s.settings = { bullColor: '#112233', bearColor: '#dce5f3', chartTheme: 'dark', chartType: 'bars', showVolume: false, showGrid: true, vwap: true, sessionShading: false };
  h.app.s.favorites = ['nvda-3m', 'iwm-1d'];
  h.app.s.progress.training[week.id + ':' + week.days[2].day] = true;
  h.app.s.progress.weekNotes[week.id] = 'Reviewed stop placement against the session plan.';
  h.app.s.progress.exams[exam.id] = { best: 90, last: 80, attempts: 2 };
  h.app.s.progress.rubric[rubric.id] = true;
  h.app.s.progress.planWeek = week.id;
  h.app.s.side = 'short'; h.app.s.speed = 5;
  h.app.saveNow();
  const restored = harness({ saved: h.store.get('replaylab-academy-v2') });
  assert.deepEqual(plain(restored.app.s.settings), plain(h.app.s.settings));
  assert.deepEqual(plain(restored.app.s.favorites), plain(h.app.s.favorites));
  assert.deepEqual(plain(restored.app.s.progress), plain(h.app.s.progress));
  assert.equal(restored.app.s.side, 'short');
  assert.equal(restored.app.s.speed, 5);
});

test('an explicitly empty watchlist stays empty after reload', () => {
  const h = harness();
  h.app.s.favorites = [];
  const restored = harness({ saved: h.app.snapshot() });
  assert.deepEqual(plain(restored.app.s.favorites), []);
});

test('invalid replacement data cannot close or archive the current account', () => {
  const h = harness();
  enter(h);
  const before = plain(h.app.snapshot());
  const tooShort = E.parseCSV(sampleCSV(9));
  assert.throws(() => h.app.useData({ ...h.app.s.data, candles: tooShort }), /at least 10/);
  const malformed = E.parseCSV(sampleCSV(10)); malformed[3].high = 80;
  assert.throws(() => h.app.useData({ ...h.app.s.data, candles: malformed }), /OHLC/);
  assert.deepEqual(plain(h.app.snapshot().session), before.session);
  assert.deepEqual(plain(h.app.s.history), before.history);
});

test('main app and Studio document listeners coexist when saving chart settings', () => {
  const h = harness();
  assert.ok(h.listeners.get('change').length > 1);
  const field = h.element('testThemeControl'); field.dataset.chartSetting = 'chartTheme'; field.value = 'dark'; field.type = 'select';
  h.dispatch('change', field);
  assert.equal(h.app.s.settings.chartTheme, 'dark');
  assert.equal(h.document.body.dataset.chartTheme, 'dark');
});

test('daily study and archived daily journal entries display session dates without placeholder clock times', () => {
  const h = harness();
  h.app.studio.loadInstrument('spy-1d');
  const at = h.app.s.data.candles[h.app.s.cursor].time, expectedDate = T.format(at, { dateOnly: true });
  assert.equal(h.element('replayDate').textContent, expectedDate + ' · NY session date');
  h.app.sizeTrade(); h.app.openTrade({ preventDefault() {} });
  assert.ok(h.app.s.account.position);
  h.app.closeTrade();
  assert.match(h.app.tradeRow(h.app.allTrades()[0]), new RegExp(expectedDate));
  assert.doesNotMatch(h.app.tradeRow(h.app.allTrades()[0]), /16:00|E[SD]T/);
  h.app.studio.loadInstrument('nvda-3m');
  assert.equal(h.app.s.history[0].timeframe, '1d');
  const restored = harness({ saved: h.app.snapshot() });
  const archived = restored.app.allTrades().find(t => t._archived);
  assert.equal(archived._timeframe, '1d');
  assert.doesNotMatch(restored.app.tradeRow(archived), /16:00|E[SD]T/);
});

test('restoring a backup updates displayed direction and speed together with state', async () => {
  const h = harness();
  const raw = plain(h.app.snapshot()); raw.session.side = 'short'; raw.session.speed = 10;
  assert.equal(h.element('longSide').getAttribute('aria-pressed'), 'true');
  const file = { size: JSON.stringify(raw).length, text: async () => JSON.stringify(raw) };
  const pending = h.app.restoreBackup(file);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.element('confirmDialog').open, true);
  h.app.finishConfirm(true); await pending;
  assert.equal(h.app.s.side, 'short');
  assert.equal(h.app.s.speed, 10);
  assert.equal(h.element('shortSide').getAttribute('aria-pressed'), 'true');
  assert.equal(h.element('longSide').getAttribute('aria-pressed'), 'false');
  assert.equal(h.element('openTrade').textContent, 'Open paper short');
  assert.equal(h.element('speedSelect').value, '10');
});

test('real assessments persist best and latest scores while preserving original course progress', () => {
  const h = harness(), training = h.window.ReplayTraining, academy = h.window.ReplayAcademy;
  assert.equal(training.weeks.length, 16);
  assert.equal(training.weeks.reduce((n, w) => n + w.days.length, 0), 80);
  assert.equal(academy.modules.length, 16);
  assert.equal(academy.modules.reduce((n, m) => n + m.lessons.length, 0), 48);
  assert.equal(academy.modules.reduce((n, m) => n + m.quiz.length, 0), 80);
  const diagnostic = training.exams.find(x => x.id === 'diagnostic'), capstone = training.exams.find(x => x.id === 'capstone');
  assert.equal(diagnostic.questions.length, 12);
  assert.equal(capstone.questions.length, 20);
  h.app.s.progress.quizzes.foundations = { best: 75, attempts: 2 };
  const form = h.element('testAssessmentForm'); form.dataset.examForm = diagnostic.id;
  form.values = Object.fromEntries(diagnostic.questions.map((q, i) => ['exam-' + i, String(q.answer)]));
  h.dispatch('submit', form);
  assert.deepEqual(plain(h.app.s.progress.exams.diagnostic), { best: 100, last: 100, attempts: 1 });
  form.values = Object.fromEntries(diagnostic.questions.map((q, i) => ['exam-' + i, String((q.answer + 1) % q.choices.length)]));
  h.dispatch('submit', form);
  assert.deepEqual(plain(h.app.s.progress.exams.diagnostic), { best: 100, last: 0, attempts: 2 });
  delete form.values['exam-0']; h.dispatch('submit', form);
  assert.equal(h.app.s.progress.exams.diagnostic.attempts, 2);
  const restored = harness({ saved: h.app.snapshot() });
  assert.deepEqual(plain(restored.app.s.progress.exams.diagnostic), { best: 100, last: 0, attempts: 2 });
  assert.deepEqual(plain(restored.app.s.progress.quizzes.foundations), { best: 75, attempts: 2 });
});

test('appending public candles pins the source and preserves the active trade and replay cursor', async () => {
  let requested;
  const h = harness({ marketLoad: async options => {
    requested = options;
    return { candles: E.parseCSV(sampleCSV(110)).slice(100), source: 'Coinbase Exchange · BTC-USD', providerId: 'coinbase', symbol: 'BTC-USD', timeframe: '15m' };
  } });
  h.app.useData({ ...h.app.s.data, mode: 'public', providerId: 'coinbase', symbol: 'BTC-USD' });
  enter(h);
  const before = plain(h.app.s.account), cursor = h.app.s.cursor, last = h.app.s.data.candles.at(-1).time;
  await h.app.loadMore();
  assert.equal(requested.providerId, 'coinbase');
  assert.equal(requested.afterTime, last);
  assert.equal(h.app.s.data.candles.length, 110);
  assert.equal(h.app.s.cursor, cursor);
  assert.deepEqual(plain(h.app.s.account), before);
});

test('a successful public load leaves replay and more-candles controls ready to use', async () => {
  let resolveLoad;
  const h = harness({ marketLoad: () => new Promise(resolve => { resolveLoad = resolve; }) });
  const loading = h.app.loadPublic();
  assert.equal(h.app.s.loading, true);
  assert.equal(h.element('loadPublic').disabled, true);
  resolveLoad({ candles: E.parseCSV(sampleCSV(30)), source: 'Coinbase Exchange · BTC-USD', providerId: 'coinbase', symbol: 'BTC-USD', timeframe: '15m', mode: 'public', assetClass: 'crypto', volumeKind: 'units' });
  await loading;
  assert.equal(h.app.s.loading, false);
  assert.equal(h.app.s.data.mode, 'public');
  assert.equal(h.app.s.data.candles.length, 30);
  assert.equal(h.element('moreCandles').hidden, false);
  for (const id of ['moreCandles', 'loadPublic', 'loadArchive', 'csvInput', 'stepButton', 'playButton', 'openTrade']) assert.equal(h.element(id).disabled, false, id + ' should be usable after the load');
});

test('restoring during an active append cannot replace the dataset or mix old-market candles into a backup', async () => {
  let resolveLoad, fileRead = false;
  const h = harness({ marketLoad: () => new Promise(resolve => { resolveLoad = resolve; }) });
  h.app.useData({ ...h.app.s.data, mode: 'public', providerId: 'coinbase', symbol: 'BTC-USD' });
  enter(h);
  const before = plain(h.app.snapshot()), backup = plain(before);
  backup.session.data.symbol = 'RESTORED-MARKET';
  const pending = h.app.loadMore();
  await h.app.restoreBackup({ size: 1000, text: async () => { fileRead = true; return JSON.stringify(backup); } });
  assert.equal(fileRead, false, 'a busy data operation should be rejected before the file is read');
  assert.equal(h.element('confirmDialog').open, false);
  assert.deepEqual(plain(h.app.snapshot().session), before.session);
  assert.match(h.element('toast').textContent, /Wait for the current data operation/);
  for (const fn of h.element('randomReplay').handlers.get('click') || []) fn();
  assert.equal(h.app.s.id, before.session.id, 'random replay cannot switch the dataset during an append');
  resolveLoad({ candles: E.parseCSV(sampleCSV(110)).slice(100), source: 'Coinbase Exchange · BTC-USD', providerId: 'coinbase', symbol: 'BTC-USD', timeframe: '15m' });
  await pending;
  assert.equal(h.app.s.data.symbol, 'BTC-USD');
  assert.equal(h.app.s.data.candles.length, 110);
  assert.deepEqual(plain(h.app.s.account), before.session.account);
});

test('a public append that starts while a backup is being read also blocks that restore', async () => {
  let resolveLoad, resolveFile;
  const h = harness({ marketLoad: () => new Promise(resolve => { resolveLoad = resolve; }) });
  h.app.useData({ ...h.app.s.data, mode: 'public', providerId: 'coinbase', symbol: 'BTC-USD' });
  enter(h);
  const before = plain(h.app.snapshot()), backup = plain(before);
  backup.session.data.symbol = 'RESTORED-MARKET';
  const restoring = h.app.restoreBackup({ size: 1000, text: () => new Promise(resolve => { resolveFile = resolve; }) });
  const pending = h.app.loadMore();
  resolveFile(JSON.stringify(backup));
  await restoring;
  assert.equal(h.element('confirmDialog').open, false);
  assert.deepEqual(plain(h.app.snapshot().session), before.session);
  assert.match(h.element('toast').textContent, /Wait for the current data operation/);
  resolveLoad({ candles: E.parseCSV(sampleCSV(110)).slice(100), source: 'Coinbase Exchange · BTC-USD', providerId: 'coinbase', symbol: 'BTC-USD', timeframe: '15m' });
  await pending;
  assert.equal(h.app.s.data.symbol, 'BTC-USD');
  assert.deepEqual(plain(h.app.s.account), before.session.account);
});
