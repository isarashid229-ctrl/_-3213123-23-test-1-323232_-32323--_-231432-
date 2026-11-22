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
function harness({ count = 100, saved, marketLoad, withDesk = false } = {}) {
  const elements = new Map(), timers = new Map(), store = new Map(), listeners = new Map(), emittedEvents = [];
  let nextTimer = 0;
  if (saved) store.set('replaylab-academy-v2', typeof saved === 'string' ? saved : JSON.stringify(saved));
  function element(id) {
    if (elements.has(id)) return elements.get(id);
    const attributes = new Map(), handlers = new Map(), classes = new Set();
    const el = {
      id, value: ({ riskPercent: '0.5', speedSelect: '3', dataSymbol: 'BTC-USD', dataInterval: '15m', dataStart: '', csvTimeframe: 'auto', csvAssetClass: 'equity' })[id] || '',
      checked: false, hidden: false, disabled: false, textContent: '', innerHTML: '', dataset: {}, style: {}, open: false,
      classList: { toggle(name, force) { const on = force === undefined ? !classes.has(name) : force; if (on) classes.add(name); else classes.delete(name); return on; }, add(name) { classes.add(name); }, remove(name) { classes.delete(name); } },
      addEventListener(type, fn) { if (!handlers.has(type)) handlers.set(type, []); handlers.get(type).push(fn); },
      setAttribute(name, value) { attributes.set(name, value); }, getAttribute(name) { return attributes.get(name); }, removeAttribute(name) { attributes.delete(name); }, hasAttribute(name) { return attributes.has(name); },
      showModal() { this.open = true; }, close() { this.open = false; }, click() { if (!this.disabled) for (const fn of handlers.get('click') || []) fn({ target: this, preventDefault() {} }); }, remove() {}, scrollIntoView() {}, focus() {}, setSelectionRange() {},
      appendChild() {}, parentElement: { dataset: {} },
      closest(selector) { return selector === 'button,a' || selector === 'button' ? this : null; }, matches(selector) { return selector === '[data-exam-form]' ? !!this.dataset.examForm : selector === '[data-quiz-form]' ? !!this.dataset.quizForm : selector === '[data-review-form]' ? !!this.dataset.reviewForm : false; },
      querySelector(selector) { return selector === 'span' ? element(id + '-span') : null; }, querySelectorAll() { return []; }, handlers
    };
    elements.set(id, el); return el;
  }
  const document = {
    getElementById: element, title: '', hidden: false,
    querySelectorAll() { return []; }, querySelector(selector) { return selector === 'dialog[open]' ? [...elements.values()].find(e => e.open) || null : selector === 'meta[name="theme-color"]' ? element('meta-theme-color') : null; },
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(fn); }, createElement: () => element('created'), body: element('body'), documentElement: element('documentElement')
  };
  const noop = () => {};
  const window = {
    ReplayEngine: E,
    ReplayMarket: { load: marketLoad || (async () => { throw new Error('Test network unavailable'); }) },
    ReplayLabs: { items: ['candles', 'structure', 'levels', 'sizing', 'orders', 'riskreward', 'expectancy', 'discipline'].map(id => ({ id })), render: () => noop },
    ReplayChart: { create: (mount, tooltip, options) => { window.chartOptions = options; return { draw: noop, latest: noop, reset: noop, zoom: noop, setLevelMode: noop }; } },
    REPLAY_ARCHIVE_CSV: sampleCSV(count), addEventListener: noop, dispatchEvent: event => { emittedEvents.push(event.type); return true; }, scrollTo: noop
  };
  const location = { hash: '#practice' };
  const sandbox = Object.assign(window, {
    window, document, location, structuredClone, Blob, URL, Event, console,
    FormData: class { constructor(form) { this.values = new Map(Object.entries(form.values || {})); } get(key) { return this.values.has(key) ? this.values.get(key) : null; } has(key) { return this.values.has(key); } },
    localStorage: { getItem: key => store.get(key) || null, setItem: (key, value) => store.set(key, value) },
    setTimeout(fn) { const id = ++nextTimer; timers.set(id, fn); return id; }, clearTimeout(id) { timers.delete(id); },
    setInterval(fn) { const id = ++nextTimer; timers.set(id, fn); return id; }, clearInterval(id) { timers.delete(id); }
  });
  vm.createContext(sandbox);
  for (const file of ['order-controller.js', 'time.js', 'instruments.js', 'academy.js', 'training.js', 'studio.js', 'guided.js', ...(withDesk ? ['desk.js'] : [])]) vm.runInContext(fs.readFileSync(path.join(__dirname, '../' + file), 'utf8'), sandbox, { filename: file });
  const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
  const hook = '\nwindow.__appTest={s,studio,desk,cleanAccount,cleanSnapshot,snapshot,saveNow,advance,rewind,restart,finishConfirm,useData,openTrade,closeTrade,executeOrder,riskPreview,updatePractice,renderJournal,resetPrices,sizeTrade,setSide,loadPublic,loadMore,importCSV,restoreBackup,allTrades,tradeRow};\n})();';
  assert.match(source, /\n\}\)\(\);\s*$/);
  vm.runInContext(source.replace(/\n\}\)\(\);\s*$/, hook), sandbox, { filename: 'app.js' });
  return { app: window.__appTest, element, store, timers, window, document, location, listeners, emittedEvents,
    dispatch(type, target) { const event = { target, preventDefault() {} }; for (const fn of listeners.get(type) || []) fn(event); },
    fire(id, type) { const target = element(id), event = { target, preventDefault() {} }; for (const fn of target.handlers.get(type) || []) fn(event); } };
}
function enter(h, { side = 'long', stop = 95, target = 110, qty = 1 } = {}) {
  h.app.s.side = side;
  h.element('useProtection').checked = true;
  h.element('stopPrice').value = String(stop);
  h.element('targetPrice').value = String(target);
  h.element('quantity').value = String(qty);
  h.element('tradePlan').value = 'A documented setup with a planned invalidation.';
  h.app.openTrade({ preventDefault() {} });
  assert.ok(h.app.s.account.position, h.element('orderError').textContent);
}
const plain = value => JSON.parse(JSON.stringify(value));

test('resting limit entries wait, survive reload, fill on a later bar, and close through the ordinary opposite button',()=>{
 const h=harness({withDesk:true});h.app.s.orderType='limit';h.element('entryOrderPrice').value='98';h.element('quantity').value='2';
 const receipt=h.app.executeOrder('buy');assert.equal(receipt.type,'pending');assert.equal(h.app.s.account.balance,100000);assert.equal(h.app.s.account.position,null);assert.equal(h.element('quickBuy').disabled,true);
 h.app.saveNow();const restored=harness({saved:h.store.get('replaylab-academy-v2'),withDesk:true});assert.equal(restored.app.s.account.pendingOrders.length,1);
 assert.equal(restored.app.s.orderType,'limit');assert.equal(Number(restored.element('entryOrderPrice').value),98);assert.equal(Number(restored.element('quantity').value),2);
 const at=restored.app.s.cursor+1;restored.app.s.data.candles[at]={time:startTime+at*900,open:99,high:100,low:97,close:99.5,volume:500};restored.app.advance(at);
 assert.equal(restored.app.s.account.pendingOrders.length,0);assert.equal(restored.app.s.account.position.qty,2);assert.ok(restored.app.s.account.position.entryPrice<=98);
 assert.match(restored.element('orderReceipt').textContent,/filled/i);assert.equal(restored.element('orderReceipt').hidden,false);
 restored.app.s.orderType='limit';const close=restored.app.executeOrder('sell');assert.equal(close.type,'closed');assert.equal(restored.app.s.account.position,null);assert.equal(restored.app.s.account.trades.length,1);
});

test('automatic rejected entry and protective exit replace the persistent ticket receipt',()=>{
 const h=harness();h.app.s.orderType='stop';h.element('entryOrderPrice').value='105';h.element('quantity').value='900';h.app.executeOrder('buy');assert.equal(h.app.s.account.pendingOrders.length,1);
 let at=h.app.s.cursor+1;h.app.s.data.candles[at]={time:startTime+at*900,open:120,high:121,low:119,close:120,volume:500};h.app.advance(at);
 assert.equal(h.app.s.account.position,null);assert.equal(h.app.s.account.pendingOrders.length,0);assert.match(h.element('orderReceipt').textContent,/reject/i);assert.equal(h.element('orderReceipt').hidden,false);
 h.app.s.orderType='market';enter(h,{qty:1,stop:115,target:130});at=h.app.s.cursor+1;h.app.s.data.candles[at]={time:startTime+at*900,open:119,high:120,low:114,close:116,volume:500};h.app.advance(at);
 assert.equal(h.app.s.account.position,null);assert.match(h.element('orderReceipt').textContent,/closed:.*stop/i);assert.equal(h.element('orderReceipt').hidden,false);
});

test('main desk partial exits and modified protection preserve exact account state across save and reload',()=>{
 const h=harness({withDesk:true});enter(h,{qty:4});const at=h.app.s.cursor+1;h.app.s.data.candles[at]={time:startTime+at*900,open:100,high:104,low:99,close:103,volume:500};h.app.advance(at);
 const modify=h.app.executeOrder('modify',{stop:101,target:108});assert.equal(modify.type,'modified');assert.equal(h.app.s.account.position.stop,101);
 const partial=h.app.executeOrder('close',{qty:1});assert.equal(partial.type,'reduced');assert.equal(h.app.s.account.position.qty,3);assert.equal(h.app.s.account.trades.length,1);
 h.app.saveNow();const restored=harness({saved:h.store.get('replaylab-academy-v2'),withDesk:true});const expected=plain(h.app.s.account);expected.trades.forEach(t=>t.mistake??='');assert.deepEqual(plain(restored.app.s.account),expected);
 assert.equal(E.stats(restored.app.s.account.trades).totalTrades,0);restored.app.closeTrade();assert.equal(restored.app.s.account.position,null);assert.equal(E.stats(restored.app.s.account.trades).totalTrades,1);assert.equal(E.stats(restored.app.s.account.trades).closedFills,2);
});

test('pending cancellation charges nothing, and market switching archives the cancelled order ledger',()=>{
 const h=harness({withDesk:true});h.app.s.orderType='stop';h.element('entryOrderPrice').value='105';h.element('quantity').value='1';h.app.executeOrder('buy');const order=h.app.s.account.pendingOrders[0];
 assert.equal(h.app.executeOrder('cancel',{orderId:order.id}).type,'cancelled');assert.equal(h.app.s.account.balance,100000);assert.equal(h.app.s.account.pendingOrders.length,0);
 h.app.useData({...h.app.s.data,symbol:'NEXT'});assert.equal(h.app.s.history.length,1);assert.equal(h.app.s.history[0].account.position,null);assert.equal(h.app.s.history[0].account.events.at(-1).kind,'cancel');
});

function quickQuantity(h, value) {
  h.element('quickQuantity').value = String(value);
  h.fire('quickQuantity', 'input');
}

test('desk quick Buy and Sell open from flat and close the entire opposite position', () => {
  const h = harness({ withDesk: true });
  assert.equal(h.element('useProtection').checked, false);
  quickQuantity(h, 3);
  h.element('quickBuy').click();
  assert.equal(h.app.s.account.position.side, 'long');
  assert.equal(h.app.s.account.position.qty, 3);
  assert.equal(h.app.s.account.position.stop, null);
  assert.equal(h.element('quickBuy').disabled, true);
  assert.equal(h.element('quickSell').disabled, false);
  assert.equal(h.element('quickSell').querySelector('span').textContent, 'SELL · CLOSE');
  // Entry-only fields must not block getting out of an existing position.
  h.app.s.guided = true;
  h.element('tradePlan').value = '';
  h.element('quantity').value = 'not a number';
  h.element('stopPrice').value = '-1';
  h.element('quickSell').click();
  assert.equal(h.app.s.account.position, null);
  assert.equal(h.app.s.account.trades.length, 1);
  assert.equal(h.app.s.account.trades[0].qty, 3);
  assert.equal(h.app.s.account.trades[0].exitReason, 'opposite action');
  assert.ok(Math.abs(h.app.s.account.trades[0].netPnl + 0.36) < 1e-7);
  h.app.s.guided = false;
  quickQuantity(h, 2);
  h.element('quickSell').click();
  assert.equal(h.app.s.side, 'short');
  assert.equal(h.app.s.account.position.side, 'short');
  assert.equal(h.app.s.account.position.qty, 2);
  assert.equal(h.element('quickBuy').querySelector('span').textContent, 'BUY · CLOSE');
  h.element('quickBuy').click();
  assert.equal(h.app.s.account.position, null);
  assert.equal(h.app.s.account.trades.length, 2);
});

test('desk leaves opposite-side closing usable at the last revealed bar', () => {
  const h = harness({ count: 10, withDesk: true });
  quickQuantity(h, 1);
  h.element('quickBuy').click();
  h.app.advance(9);
  assert.ok(h.app.s.account.position);
  assert.equal(h.element('quickBuy').disabled, true);
  assert.equal(h.element('quickSell').disabled, false);
  const before = plain(h.app.s.account);
  assert.equal(h.app.executeOrder('reverse'), null);
  assert.deepEqual(plain(h.app.s.account), before);
  h.element('quickSell').click();
  assert.equal(h.app.s.account.position, null);
  assert.equal(h.element('quickBuy').disabled, true);
  assert.equal(h.element('quickSell').disabled, true);
});

test('desk reverse is a distinct atomic action and does not inherit the old bracket or plan', () => {
  const h = harness({ withDesk: true });
  enter(h, { qty: 2 });
  const old = plain(h.app.s.account.position);
  const button = h.element('testReverse'); button.dataset.orderAction = 'reverse';
  h.dispatch('click', button);
  assert.equal(h.app.s.account.trades.length, 1);
  assert.equal(h.app.s.account.trades[0].exitReason, 'reverse');
  assert.equal(h.app.s.account.position.side, 'short');
  assert.equal(h.app.s.account.position.qty, old.qty);
  assert.equal(h.app.s.account.position.stop, null);
  assert.equal(h.app.s.account.position.target, null);
  assert.equal(h.app.s.account.position.plan, '');
  assert.equal(h.app.s.account.position.plannedRisk, null);
  assert.match(h.element('riskPreview').innerHTML, /Not defined/);
  const full = harness({ withDesk: true });
  quickQuantity(full, 999);
  full.element('quickBuy').click();
  assert.ok(full.app.s.account.position);
  const before = plain(full.app.s.account);
  assert.equal(full.app.executeOrder('reverse'), null, 'closing costs leave insufficient capital for the same-size reverse');
  assert.deepEqual(plain(full.app.s.account), before, 'failed reverse must not close the old position or charge a fee');
  assert.match(full.element('orderError').textContent, /1× equity limit/);
});

test('unprotected positions show undefined planned loss instead of a zero-risk claim', () => {
  const h = harness({ withDesk: true });
  quickQuantity(h, 1);
  assert.match(h.element('riskPreview').innerHTML, /Protective exits.*Not set/);
  h.element('quickBuy').click();
  assert.equal(h.app.s.account.position.stop, null);
  assert.equal(h.app.s.account.position.plannedRisk, null);
  assert.match(h.element('riskPreview').innerHTML, /Open position planned loss.*Not defined/);
  assert.match(h.element('riskPreview').innerHTML, /No stop is attached/);
  assert.match(h.element('positionContent').innerHTML, /<td>—<\/td>/);
  assert.doesNotMatch(h.element('riskPreview').innerHTML, /planned loss[^<]*<b>\$0\.00/);
});

test('untouched protective defaults follow the current entry price, while edited prices stay explicit', () => {
  const defaults = harness({ withDesk: true });
  defaults.element('useProtection').checked = true;
  defaults.fire('useProtection', 'change');
  quickQuantity(defaults, 1);
  const next = defaults.app.s.cursor + 1;
  Object.assign(defaults.app.s.data.candles[next], { open: 100, high: 111, low: 99, close: 110 });
  defaults.app.advance(next);
  defaults.element('quickBuy').click();
  assert.equal(defaults.app.s.account.position.stop, 108.9);
  assert.equal(defaults.app.s.account.position.target, 112.2);
  const manual = harness({ withDesk: true });
  manual.element('useProtection').checked = true;
  manual.fire('useProtection', 'change');
  quickQuantity(manual, 1);
  manual.element('stopPrice').value = '95'; manual.fire('stopPrice', 'input');
  manual.element('targetPrice').value = '130'; manual.fire('targetPrice', 'input');
  Object.assign(manual.app.s.data.candles[next], { open: 100, high: 111, low: 99, close: 110 });
  manual.app.advance(next);
  manual.element('quickBuy').click();
  assert.equal(manual.app.s.account.position.stop, 95);
  assert.equal(manual.app.s.account.position.target, 130);
  const invalid = harness({ withDesk: true });
  invalid.element('useProtection').checked = true;
  invalid.fire('useProtection', 'change');
  quickQuantity(invalid, 1);
  invalid.element('targetPrice').value = '105'; invalid.fire('targetPrice', 'input');
  Object.assign(invalid.app.s.data.candles[next], { open: 100, high: 111, low: 99, close: 110 });
  invalid.app.advance(next);
  const before = plain(invalid.app.s.account);
  invalid.element('quickBuy').click();
  assert.deepEqual(plain(invalid.app.s.account), before);
  assert.equal(invalid.element('targetPrice').value, '105');
  assert.match(invalid.element('orderError').textContent, /Target must be above/);
});

test('Desk v4 backups retain drawings, chart appearance, legacy progress and guided checkpoints together', () => {
  const h = harness({ withDesk: true });
  const candles = h.app.s.data.candles;
  h.app.s.drawings = [
    { id: 'support-a', type: 'horizontal', price: 99.5 },
    { id: 'trend-a', type: 'trendline', from: { time: candles[5].time, price: 98 }, to: { time: candles[20].time, price: 101 } }
  ];
  h.app.s.levels = [100.5];
  h.app.s.settings.chartTheme = 'dark';
  h.app.s.settings.bullColor = '#abcdef';
  h.app.s.settings.bearColor = '#c12345';
  h.app.s.settings.sessionShading = true;
  h.app.s.progress.guided['read-candle'] = { completed: true, completedAt: '2026-11-22T12:00:00.000Z', attempts: 2, passedSteps: 2, totalSteps: 2 };
  h.app.s.progress.guided['size-long'] = { completed: false, completedAt: '', attempts: 3, passedSteps: 1, totalSteps: 2 };
  h.app.s.progress.labs.sizing = { best: 80, attempts: 4 };
  h.app.s.progress.lessons['foundations-1'] = true;
  h.app.s.progress.quizzes.foundations = { best: 80, attempts: 2 };
  h.app.s.progress.training['week-1:1'] = true;
  h.app.saveNow();
  const restored = harness({ saved: h.store.get('replaylab-academy-v2'), withDesk: true });
  assert.deepEqual(plain(restored.app.s.drawings), plain(h.app.s.drawings));
  assert.deepEqual(plain(restored.app.s.settings), plain(h.app.s.settings));
  assert.deepEqual(plain(restored.app.s.progress), plain(h.app.s.progress));
  assert.deepEqual(plain(restored.app.s.levels), [100.5]);
  assert.equal(restored.document.body.dataset.theme, 'dark');
  assert.equal(restored.document.documentElement.style.colorScheme, 'dark');
});

test('unknown guided IDs and malformed drawing geometry cannot enter a restored desk', () => {
  const h = harness({ withDesk: true }), raw = plain(h.app.snapshot()), bars = raw.session.data.candles;
  raw.progress.guided = {
    'read-candle': { completed: true, completedAt: '2026-11-22T12:00:00Z', attempts: 2, passedSteps: 2, totalSteps: 2 },
    'unknown-lab': { completed: true, attempts: 1, passedSteps: 99, totalSteps: 99 }
  };
  raw.session.drawings = [
    { id: 'good', type: 'horizontal', price: 100 },
    { id: 'negative', type: 'horizontal', price: -100 },
    { id: 'outside', type: 'trendline', from: { time: bars[0].time - 1, price: 100 }, to: { time: bars[1].time, price: 101 } },
    { id: 'after-data', type: 'trendline', from: { time: bars[1].time, price: 100 }, to: { time: bars.at(-1).time + 1, price: 101 } },
    { id: 'good', type: 'horizontal', price: 777 },
    { id: 'not-a-tool', type: 'unknown', price: 100 }
  ];
  const clean = h.app.cleanSnapshot(raw);
  assert.deepEqual(plain(clean.drawings), [{ id: 'good', type: 'horizontal', price: 100 }]);
  assert.deepEqual(Object.keys(clean.progress.guided), ['read-candle']);
  assert.deepEqual(plain(clean.progress.guided['read-candle']), raw.progress.guided['read-candle']);
});

test('learning and journal summaries count completed guided labs independently of preserved legacy scores', () => {
  const h = harness({ withDesk: true });
  for (const lab of h.window.ReplayLabs.items) h.app.s.progress.labs[lab.id] = { best: 100, attempts: 1 };
  h.app.s.progress.guided['read-candle'] = { completed: true, completedAt: '2026-11-22T12:00:00Z', attempts: 1, passedSteps: 2, totalSteps: 2 };
  h.app.s.progress.guided['map-levels'] = { completed: true, completedAt: '2026-11-22T12:10:00Z', attempts: 2, passedSteps: 3, totalSteps: 3 };
  h.app.s.progress.guided['size-long'] = { completed: false, completedAt: '', attempts: 2, passedSteps: 1, totalSteps: 2 };
  h.app.s.progress.guided['unknown-lab'] = { completed: true, attempts: 1, passedSteps: 2, totalSteps: 2 };
  h.app.updatePractice();
  h.app.renderJournal();
  assert.match(h.element('learningStrip').innerHTML, /2 \/ 12/);
  assert.match(h.element('learningStrip').innerHTML, /checkpoint in a guided lab/);
  assert.doesNotMatch(h.element('learningStrip').innerHTML, /Pass a lab at 80%/);
  assert.match(h.element('journalView').innerHTML, /2 \/ 12/);
  const restored = harness({ saved: h.app.snapshot(), withDesk: true });
  restored.app.renderJournal();
  assert.match(restored.element('learningStrip').innerHTML, /2 \/ 12/);
  assert.match(restored.element('journalView').innerHTML, /2 \/ 12/);
  assert.equal(Object.keys(restored.app.s.progress.labs).length, 8, 'legacy scores remain available after migration');
});

test('theme controls update the actual desk, preserve custom candle colors and persist the result', () => {
  const h = harness({ withDesk: true });
  assert.equal(h.document.body.dataset.theme, 'light');
  h.app.s.settings.bullColor = '#102030';
  h.app.s.settings.bearColor = '#a1b2c3';
  h.element('themeToggle').click();
  assert.equal(h.app.s.settings.chartTheme, 'dark');
  assert.equal(h.document.body.dataset.theme, 'dark');
  assert.equal(h.document.documentElement.style.colorScheme, 'dark');
  assert.equal(h.app.s.settings.bullColor, '#102030');
  assert.equal(h.app.s.settings.bearColor, '#a1b2c3');
  assert.match(h.element('themeToggle').getAttribute('aria-label'), /Switch to light mode/);
  assert.deepEqual(h.emittedEvents, ['replaylab-theme']);
  h.app.saveNow();
  const restored = harness({ saved: h.store.get('replaylab-academy-v2'), withDesk: true });
  assert.equal(restored.document.body.dataset.theme, 'dark');
  assert.equal(restored.app.s.settings.bullColor, '#102030');
  assert.equal(restored.app.s.settings.bearColor, '#a1b2c3');
});

test('desk watchlist and coach context never read unrevealed bars or inactive-market prices', () => {
  const h = harness({ count: 500, withDesk: true });
  quickQuantity(h, 1);
  for (let i = 0; i < 12; i++) { h.element('quickBuy').click(); h.element('quickSell').click(); }
  const bars = h.app.s.data.candles, cursor = h.app.s.cursor;
  h.app.s.data.candles = new Proxy(bars, { get(target, property, receiver) {
    if (/^\d+$/.test(String(property)) && Number(property) > cursor) throw new Error('future candle access: ' + property);
    return Reflect.get(target, property, receiver);
  } });
  for (const item of h.window.ReplayInstruments.items) item.candles = new Proxy(item.candles, { get(target, property, receiver) {
    if (/^\d+$/.test(String(property))) throw new Error('inactive market price access: ' + item.id);
    return Reflect.get(target, property, receiver);
  } });
  h.app.desk.reset();
  assert.doesNotThrow(() => h.app.desk.update());
  let context;
  assert.doesNotThrow(() => { context = h.app.desk.getContext(); });
  assert.equal(context.currentCandle.time, bars[cursor].time);
  assert.equal(context.revealedCandles.length, 80);
  assert.equal(context.revealedCandles[0].time, bars[cursor - 79].time);
  assert.ok(context.revealedCandles.every(bar => bar.time <= bars[cursor].time));
  assert.equal(context.account.trades.length, 10);
  assert.ok(!Object.hasOwn(context, 'data'));
  assert.ok(!Object.hasOwn(context, 'candles'));
  assert.match(h.element('deskWatchlist').innerHTML, /class="watch-price">Open<\/span>/);
});

test('restoring a same-symbol same-cursor backup refreshes the displayed watchlist price', async () => {
  const h = harness({ withDesk: true });
  h.app.studio.loadInstrument('aapl-3m');
  const raw = plain(h.app.snapshot()), before = raw.session.data.candles[raw.session.cursor].close;
  const after = Math.round((before + 1) * 100) / 100;
  assert.ok(h.element('deskWatchlist').innerHTML.includes('class="watch-price">' + before.toFixed(2) + '</span>'));
  raw.session.data.candles[raw.session.cursor].close = after;
  raw.session.data.candles[raw.session.cursor].high = Math.max(after, raw.session.data.candles[raw.session.cursor].high);
  const serialized = JSON.stringify(raw);
  const pending = h.app.restoreBackup({ size: serialized.length, text: async () => serialized });
  await new Promise(resolve => setImmediate(resolve));
  h.app.finishConfirm(true); await pending;
  assert.equal(h.app.s.data.candles[h.app.s.cursor].close, after);
  assert.ok(h.element('deskWatchlist').innerHTML.includes('class="watch-price">' + after.toFixed(2) + '</span>'), 'active watchlist price must match the restored current close');
  assert.equal(h.element('buyQuote').textContent, (after*(1+E.DEFAULT_SLIPPAGE)).toFixed(2), 'quick quote estimates the buy fill including slippage');
});

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
  assert.throws(() => h.app.cleanAccount(malformed, h.app.s.cursor), /trade sequence is invalid|execution ledger/);
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
    h.element('useProtection').checked = true;
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
  h.element('useProtection').checked = true;
  h.app.sizeTrade();
  const qty = Number(h.element('quantity').value);
  assert.ok(qty >= 1 && Number.isInteger(qty));
  const b = h.app.s.data.candles[h.app.s.cursor];
  const ideal = E.sizePosition({ equity: 100000, entry: b.close, stop: Number(h.element('stopPrice').value), riskPct: 0.5, side: 'long' });
  assert.equal(qty, Math.floor(ideal.qty));
  h.app.openTrade({ preventDefault() {} });
  assert.ok(h.app.s.account.position);
  assert.ok(Number.isFinite(h.app.s.account.position.plannedRisk) && h.app.s.account.position.plannedRisk > 0);
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
  assert.equal(h.element('openTrade').textContent, 'Sell at market');
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
