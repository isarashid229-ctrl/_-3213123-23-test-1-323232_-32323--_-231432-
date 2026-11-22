'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const UI = require('../guided-ui.js');
const G = require('../guided.js');
const I = require('../instruments.js');
const E = require('../engine.js');

function quantity(sc) {
  return G.maximumShares(sc.tradePreset.side, sc.reference.entry, sc.tradePreset.stop, sc.reference.budget, sc.initialBalance, sc.feeRate, sc.slippageRate);
}
function numberAnswer(s) {
  const ref = s.scenario.reference, bar = ref.candle;
  return { body: Math.abs(bar.close - bar.open), range: bar.high - bar.low, 'upper-wick': bar.high - Math.max(bar.open, bar.close), support: ref.low, resistance: ref.high, quantity: s.step().id === 'quantity' ? quantity(s.scenario) : 0, equity: E.equity(s.account, s.current().close) }[s.step().id];
}
function choiceAnswer(s) {
  const ref = s.scenario.reference, bar = ref.candle;
  return { direction: bar.close > bar.open ? 'up' : bar.close < bar.open ? 'down' : 'flat', structure: ref.structure.label, confirmation: 'need-later-bars', 'level-limit': 'reference', 'bracket-logic': 'long-bracket', 'initial-decision': 'wait', 'current-decision': s.current().close > ref.trigger ? 'enter' : 'wait', 'after-loss': 'same-process', 'plan-first': 'complete' }[s.step().id];
}
function submitExerciseOrder(s) {
  const sc = s.scenario, short = sc.tradePreset.side === 'short';
  return s.order(short ? 'sell' : 'buy', { qty: sc.tradePreset.qty || quantity(sc), stop: short ? sc.reference.shortStop : sc.reference.longStop, target: sc.id === 'handle-loss' ? null : short ? sc.reference.shortTarget : sc.reference.longTarget, plan: 'Follow the fixed protective levels, small risk budget and declared time exit.' });
}
function complete(s) {
  for (let guard = 0; !s.completed && guard < 12; guard++) {
    const step = s.step(); let response = null;
    if (step.type === 'choice') response = choiceAnswer(s);
    if (step.type === 'number') response = numberAnswer(s);
    if (step.type === 'trade' && step.action === 'open') submitExerciseOrder(s);
    if (step.type === 'wait') {
      const p = s.account.position || s.account.trades.at(-1);
      const end = (s.scenario.id === 'wait-trigger' ? s.scenario.startIndex : p.entryBarIndex) + step.minBars;
      while (s.cursor < end && (!p || s.account.position || s.scenario.id === 'wait-trigger')) s.advance();
    }
    if (step.type === 'trade' && step.action === 'close' && s.account.position) {
      const end = s.account.position.entryBarIndex + (s.scenario.id === 'review-trade' ? 2 : 3);
      while (s.cursor < end && s.account.position) s.advance();
      if (s.account.position) s.order('close');
    }
    if (step.type === 'review') response = { notes: 'I followed the planned protection and time exit. Next attempt I will keep the same risk calculation and review the recorded fill.', reason: G.exitCategory(s.account.trades.at(-1).exitReason), followedPlan: true };
    const result = s.check(response);
    assert.equal(result.passed, true, s.scenario.id + '/' + step.id + ': ' + result.message);
    if (!s.completed) assert.equal(s.next(), true);
  }
  assert.equal(s.completed, true);
}

for (const item of G.items) test('guided workspace controller completes ' + item.id + ' using actual account evidence', () => {
  const s = UI.createSession(item.id), before = JSON.stringify(s.dataset.candles);
  assert.equal(s.account.balance, 10000);
  assert.equal(s.cursor, item.startIndex);
  complete(s);
  assert.equal(Object.keys(s.passed).length, s.scenario.steps.length);
  assert.equal(s.events.at(-1).type, 'complete');
  assert.equal(JSON.stringify(s.dataset.candles), before, 'practice must not modify the shared market sample');
  assert.throws(() => s.order('buy', { qty: 1 }), /complete/);
  assert.throws(() => s.advance(), /complete/);
});

test('typed answers cannot substitute for an actual protected paper position', () => {
  const s = UI.createSession('size-long');
  assert.equal(s.check(quantity(s.scenario)).passed, true); s.next();
  assert.equal(s.check(quantity(s.scenario)).status, 'pending');
  assert.equal(s.completed, false); assert.equal(s.account.position, null);
  s.order('buy', { qty: 1, stop: '', target: '' });
  assert.ok(s.account.position); assert.ok(s.account.balance < 10000);
  assert.equal(s.check().status, 'retry');
  assert.match(s.lastResult.message, /stop/i);
  const clean = UI.createSession('size-long');
  assert.equal(clean.account.balance, 10000); assert.equal(clean.account.position, null);
  assert.notEqual(clean.account, s.account);
});

test('final verification rejects a later timing breach even after the waiting checkpoint passed', () => {
  const s = UI.createSession('wait-trigger');
  assert.equal(s.check('wait').passed, true); s.next();
  s.advance(3); assert.equal(s.check().passed, true); s.next();
  s.order('sell', { qty: 1, stop: null, target: null });
  const result = s.check(choiceAnswer(s));
  assert.equal(result.passed, false); assert.equal(s.completed, false);
  assert.equal(s.step().id, 'observe');
  assert.match(result.message, /Revisit|direction|entry/i);
});

test('every advanced candle is processed and an intermediate protective exit is retained', () => {
  const original = I.items.find(item => item.id === 'meta-3m');
  const dataset = { ...original, candles: original.candles.map(bar => ({ ...bar })) };
  const s = UI.createSession('handle-loss', { dataset });
  submitExerciseOrder(s);
  const start = s.cursor, stop = s.account.position.stop, open = s.current().close;
  dataset.candles[start + 1] = { ...dataset.candles[start + 1], open, high: open + 0.1, low: stop - 0.5, close: stop - 0.25 };
  const result = s.advance(3);
  assert.equal(result.advanced, 3); assert.equal(s.cursor, start + 3);
  assert.equal(s.account.position, null);
  assert.equal(s.account.trades.length, 1);
  assert.equal(s.account.trades[0].exitBarIndex, start + 1);
  assert.equal(s.account.trades[0].exitReason, 'stop');
  assert.deepEqual(s.events.filter(event => event.type === 'step').map(event => event.barIndex), [start + 1, start + 2, start + 3]);
  assert.equal(s.events.filter(event => event.type === 'close').length, 1);
  assert.ok(s.events.some(event => event.type === 'wait'));
  assert.throws(() => s.advance(-1), /positive number/);
});

test('scenario rendering context and evaluation read only revealed history, capped at 80 bars for the coach', () => {
  const original = I.items.find(item => item.id === 'aapl-3m');
  let revealed = G.items.find(item => item.id === 'size-long').startIndex;
  const dataset = { ...original, candles: original.candles.map((bar, index) => new Proxy(bar, { get(target, key) { if (index > revealed) throw new Error('Future candle read: ' + index); return target[key]; } })) };
  const s = UI.createSession('size-long', { dataset });
  assert.doesNotThrow(() => s.getContext());
  assert.equal(s.getContext().revealedCandles.length, 80);
  assert.ok(s.getContext().revealedCandles.every(bar => bar.time <= s.current().time));
  assert.equal(s.getContext().selectedLab, 'size-long');
  assert.equal(s.check(quantity(s.scenario)).passed, true);
  revealed += 3; assert.doesNotThrow(() => s.advance(3));
  assert.equal(s.getContext().cursor, revealed);
  const copy = s.getContext(); copy.revealedCandles.at(-1).close = -10;
  assert.ok(s.current().close > 0);
});

test('coach context limits trades, copies account state and keeps attempts separate', () => {
  const s = UI.createSession('size-long'), other = UI.createSession('size-long');
  for (let i = 0; i < 25; i++) { s.order('buy', { qty: 1 }); s.order('close'); }
  s.order('buy', { qty: 1 });
  const context = s.getContext();
  assert.equal(context.account.trades.length, 10);
  assert.equal(context.events.length, 40);
  context.account.position.qty = 1000000; context.account.trades[0].netPnl = 1000000;
  assert.equal(s.account.position.qty, 1);
  assert.ok(s.account.trades.every(trade => trade.netPnl < 0));
  assert.equal(other.account.balance, 10000); assert.equal(other.account.position, null); assert.equal(other.events.length, 0);
});

// A deliberately small DOM shell exercises the real delegated UI actions,
// persistence boundary and cleanup. Browser layout is verified separately.
function uiHarness() {
  const previous = { chart: global.ReplayChart, interval: global.setInterval, clear: global.clearInterval, addEvent: global.addEventListener, removeEvent: global.removeEventListener };
  const listeners = new Map(), windowListeners = new Map(), nodes = new Map(), intervals = new Map(), charts = [];
  let intervalId = 0, saves = 0, html = '';
  function node() { return { innerHTML: '', textContent: '', hidden: false, disabled: false, value: '', dataset: {}, attributes: {}, style: {}, setAttribute(name, value) { this.attributes[name] = String(value); }, addEventListener() {}, focus() {}, querySelector() { return { open: true, addEventListener() {}, focus() {} }; } }; }
  const inputs = ['qty', 'stop', 'target', 'plan'].map(field => ({ ...node(), dataset: { ticket: field } }));
  const mount = {
    set innerHTML(value) { html = value; nodes.clear(); }, get innerHTML() { return html; },
    contains: () => true,
    querySelector(selector) {
      const role = /data-guided-role="([^"]+)"/.exec(selector)?.[1];
      if (role) { if (!nodes.has(role)) nodes.set(role, node()); return nodes.get(role); }
      const ticket = /data-ticket="([^"]+)"/.exec(selector)?.[1];
      return inputs.find(input => input.dataset.ticket === ticket) || null;
    },
    querySelectorAll(selector) { return selector === '[data-ticket]' ? inputs : []; },
    addEventListener(name, listener) { listeners.set(name, listener); },
    removeEventListener(name, listener) { if (listeners.get(name) === listener) listeners.delete(name); }
  };
  global.ReplayChart = { create(element, tooltip, options) { const chart = { options, draws: 0, destroyed: false, draw() { this.draws++; }, latest() {}, setTool() {}, zoom() {}, setAutoscale() {}, getScaleState() { return { auto: true }; }, cancelDrawing() { return false; }, deleteSelected() { return false; }, destroy() { this.destroyed = true; } }; charts.push(chart); return chart; } };
  global.setInterval = callback => { const id = ++intervalId; intervals.set(id, callback); return id; };
  global.clearInterval = id => intervals.delete(id);
  global.addEventListener = (name, listener) => { if (!windowListeners.has(name)) windowListeners.set(name, new Set()); windowListeners.get(name).add(listener); };
  global.removeEventListener = (name, listener) => { const group = windowListeners.get(name); group?.delete(listener); if (group?.size === 0) windowListeners.delete(name); };
  const state = { progress: {}, settings: { chartTheme: 'light', chartType: 'line' }, account: E.createAccount() };
  const ui = UI.create({ mount, state, save() { saves++; }, toast() {} });
  function input(kind, value) { listeners.get('input')({ target: { dataset: { response: kind }, value } }); }
  function click(action) { const button = { disabled: false, dataset: { guidedAction: action } }; listeners.get('click')({ target: { closest: () => button } }); }
  function submit() { const form = { dataset: { guidedForm: 'checkpoint' } }; listeners.get('submit')({ preventDefault() {}, target: { closest: () => form } }); }
  return { ui, state, charts, intervals, listeners, windowListeners, mount, input, click, submit, saves: () => saves,
    emitTheme() { for (const listener of windowListeners.get('replaylab-theme') || []) listener({ type: 'replaylab-theme' }); },
    restore() { ui.destroy(); global.ReplayChart = previous.chart; global.setInterval = previous.interval; global.clearInterval = previous.clear; global.addEventListener = previous.addEvent; global.removeEventListener = previous.removeEvent; }
  };
}

test('UI writes completion once, never on visiting or partially passing a lab, and honors legacy routes', () => {
  const h = uiHarness();
  try {
    h.ui.render('candles');
    assert.equal(h.ui.getContext().selectedLab, 'read-candle');
    assert.equal(h.saves(), 0); assert.equal(h.state.progress.guided, undefined);
    assert.equal(h.charts[0].options.getData().settings.chartType, 'candles', 'recognition labs must remain candle charts even if the main desk uses a line');
    const candle = h.ui.getContext().currentCandle;
    h.input('choice', candle.close > candle.open ? 'up' : candle.close < candle.open ? 'down' : 'flat'); h.submit();
    assert.equal(h.saves(), 0); assert.equal(h.state.progress.guided, undefined);
    h.click('next'); h.input('number', String(Math.abs(candle.close - candle.open))); h.submit();
    assert.equal(h.saves(), 1);
    const saved = h.state.progress.guided['read-candle'];
    assert.equal(saved.completed, true); assert.equal(saved.attempts, 1); assert.equal(saved.passedSteps, 2); assert.equal(saved.totalSteps, 2);
    assert.ok(Number.isFinite(Date.parse(saved.completedAt)));
    h.submit(); assert.equal(h.saves(), 1);
    h.click('restart'); assert.equal(h.saves(), 1); assert.equal(h.ui.getContext().completed, false);
    assert.equal(h.state.account.balance, 100000, 'the main desk account must remain untouched');
    h.ui.render(); assert.equal(h.ui.getContext().mode, 'guided-catalog');
    assert.equal((h.mount.innerHTML.match(/class="guided-lab-card/g) || []).length, 12);
  } finally { h.restore(); }
});

test('UI route cleanup cancels play, disposes chart instances and removes delegated handlers', () => {
  const h = uiHarness();
  try {
    h.ui.render('read-candle'); h.click('play'); assert.equal(h.intervals.size, 1);
    const before = h.ui.getContext().cursor;
    [...h.intervals.values()][0]();
    assert.equal(h.ui.getContext().cursor, before + 1);
    h.input('choice', 'up'); assert.equal(h.intervals.size, 0, 'editing an answer pauses replay so its input is not replaced during typing');
    h.click('play'); assert.equal(h.intervals.size, 1);
    h.ui.render('map-levels');
    assert.equal(h.intervals.size, 0); assert.equal(h.charts[0].destroyed, true);
    assert.equal(h.charts[1].options.getData().highlightIndex, h.ui.getContext().startIndex);
    h.click('play'); h.ui.destroy();
    assert.equal(h.intervals.size, 0); assert.equal(h.charts[1].destroyed, true); assert.equal(h.listeners.size, 0);
  } finally { h.restore(); }
});

test('completed labs can continue free practice while their verified result stays locked', () => {
  const s = UI.createSession('size-long'); complete(s);
  const result = structuredClone(s.lastResult), checks = s.checks;
  assert.ok(s.account.position);
  assert.equal(s.continuePractice(), true);
  s.advance();
  if (s.account.position) s.order('close');
  assert.equal(s.completed, true); assert.equal(s.practiceMode, true);
  assert.deepEqual(s.check('wrong answer'), result);
  assert.equal(s.checks, checks);
  assert.equal(s.account.position, null);
  assert.equal(s.getContext().practiceMode, true);
  assert.ok(s.events.some(event => event.type === 'free-practice'));
});

test('theme events redraw the active guided chart immediately and clean up on destroy', () => {
  const h = uiHarness();
  try {
    h.ui.render('read-candle');
    const first = h.charts[0], before = first.draws;
    assert.equal(h.windowListeners.get('replaylab-theme').size, 1);
    h.state.settings.chartTheme = 'dark'; h.emitTheme();
    assert.equal(first.draws, before + 1);
    assert.equal(first.options.getData().settings.chartTheme, 'dark');
    h.ui.render();
    const stopped = first.draws; h.emitTheme();
    assert.equal(first.draws, stopped, 'catalog theme changes must not draw a disposed chart');
    h.ui.render('map-levels');
    const active = h.charts[1], activeBefore = active.draws;
    h.state.settings.chartTheme = 'light'; h.emitTheme();
    assert.equal(active.draws, activeBefore + 1);
    assert.equal(active.options.getData().settings.chartTheme, 'light');
    assert.equal(h.windowListeners.get('replaylab-theme').size, 1, 'rendering another lab must not add another theme listener');
    h.ui.destroy();
    assert.equal(h.windowListeners.has('replaylab-theme'), false);
    h.emitTheme(); assert.equal(active.draws, activeBefore + 1);
  } finally { h.restore(); }
});
