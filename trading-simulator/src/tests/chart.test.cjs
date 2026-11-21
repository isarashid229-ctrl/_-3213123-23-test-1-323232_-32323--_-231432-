'use strict';
// This is deterministic drawing/event verification, not a claim of browser or
// pixel-layout testing. It exercises the real chart source with a canvas mock.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const startTime = 1772323200;
function candles(count, scale = 1) {
  return Array.from({ length: count }, (_, i) => ({ time: startTime + i * 900, open: (100 + i * 0.2) * scale, high: (103 + i * 0.2) * scale, low: (98 + i * 0.2) * scale, close: (101 + i * 0.2) * scale, volume: 100 + i }));
}
function harness(overrides = {}) {
  const calls = [], frames = new Map(), listeners = new Map(), attributes = {}, levels = [], styleWrites = [], observers = [];
  let frameId = 0, widthWrites = 0, heightWrites = 0, backingWidth = 0, backingHeight = 0;
  const bounds = { width: overrides.width === undefined ? 1000 : overrides.width, height: overrides.height === undefined ? 500 : overrides.height, left: 20, top: 30 };
  let data = overrides.data || { candles: candles(300), cursor: 149, ema: true, levels: [], position: null };
  const drawing = { fillStyle: '', strokeStyle: '', globalAlpha: 1, font: '', lineWidth: 1, textAlign: '', textBaseline: '' };
  const ctx = drawing;
  for (const method of ['setTransform', 'clearRect', 'fillRect', 'beginPath', 'moveTo', 'lineTo', 'stroke', 'fillText', 'save', 'rect', 'clip', 'restore', 'setLineDash']) {
    ctx[method] = (...args) => {
      for (const arg of args) if (typeof arg === 'number') assert.ok(Number.isFinite(arg), method + ' received non-finite coordinate');
      calls.push({ method, args, fillStyle: drawing.fillStyle, strokeStyle: drawing.strokeStyle, alpha: drawing.globalAlpha });
    };
  }
  const css = { width: '100%', height: '100%' };
  const canvas = {
    parentElement: { getBoundingClientRect: () => bounds },
    getBoundingClientRect: () => bounds,
    getContext: () => ctx,
    style: new Proxy(css, { set(target, key, value) { styleWrites.push([key, value]); target[key] = value; return true; } }),
    addEventListener: (name, handler) => listeners.set(name, handler),
    removeEventListener: (name, handler) => { if (listeners.get(name) === handler) listeners.delete(name); },
    setAttribute: (name, value) => { attributes[name] = value; },
    setPointerCapture: () => {}
  };
  Object.defineProperty(canvas, 'width', { get: () => backingWidth, set: value => { backingWidth = value; widthWrites++; } });
  Object.defineProperty(canvas, 'height', { get: () => backingHeight, set: value => { backingHeight = value; heightWrites++; } });
  const tooltip = { hidden: true, textContent: '' };
  class ResizeObserver {
    constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
    observe(element) { this.element = element; }
    disconnect() { this.disconnected = true; }
  }
  const window = { devicePixelRatio: overrides.dpr || 2 };
  const sandbox = {
    window, ResizeObserver,
    requestAnimationFrame(callback) { const id = ++frameId; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    console
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../chart.js'), 'utf8'), sandbox, { filename: 'chart.js' });
  const chart = window.ReplayChart.create(canvas, tooltip, { getData: () => data, onLevel: value => levels.push(value) });
  function flush() {
    const queue = Array.from(frames.entries());
    frames.clear();
    for (const [, callback] of queue) callback();
  }
  function draw() { calls.length = 0; chart.draw(); flush(); return calls; }
  function event(name, properties = {}) {
    const ev = Object.assign({ clientX: bounds.left + 400, clientY: bounds.top + 100, pointerId: 1, pointerType: 'mouse', preventDefault() { this.prevented = true; } }, properties);
    if (listeners.has(name)) listeners.get(name)(ev);
    flush();
    return ev;
  }
  return { chart, canvas, tooltip, calls, attributes, levels, listeners, observers, frames, bounds, css, styleWrites, draw, flush, event,
    setData(value) { data = value; }, getData: () => data,
    backingWrites: () => ({ width: widthWrites, height: heightWrites }) };
}
const bodies = h => h.calls.filter(c => c.method === 'fillRect' && ['#70d9b5', '#ee8496'].includes(c.fillStyle) && c.alpha === 1);
const visualSignature = calls => JSON.stringify(calls.map(c => Object.assign({ method: c.method, args: c.args },
  ['fillRect', 'fillText'].includes(c.method) ? { fillStyle: c.fillStyle, alpha: c.alpha } : c.method === 'stroke' ? { strokeStyle: c.strokeStyle, alpha: c.alpha } : {})));

test('future candles cannot influence scale, EMAs, tooltip, or accessibility text', () => {
  const h = harness();
  const data = h.getData();
  const inputBefore = JSON.stringify(data);
  const baseline = visualSignature(h.draw());
  h.event('pointermove');
  const baselineTooltip = h.tooltip.textContent;
  assert.equal(JSON.stringify(data), inputBefore);
  data.candles = data.candles.map((c, i) => i <= data.cursor ? c : new Proxy(c, { get() { throw new Error('Read future candle ' + i); } }));
  h.event('pointerleave');
  assert.equal(visualSignature(h.draw()), baseline);
  h.event('pointermove');
  assert.equal(h.tooltip.textContent, baselineTooltip);
  assert.match(h.attributes['aria-label'], /Future candles are hidden/);
  assert.match(h.attributes['aria-label'], /130\.8/);
});

test('low-priced candles keep useful decimals on axis labels and hover details', () => {
  const data = { candles: candles(30, 0.001), cursor: 19, ema: true, levels: [], position: null };
  const h = harness({ data });
  h.draw();
  const text = h.calls.filter(c => c.method === 'fillText').map(c => c.args[0]);
  assert.ok(text.includes('0.1048'));
  assert.ok(text.some(t => /^0\.10\d/.test(t)));
  h.event('pointermove');
  assert.match(h.tooltip.textContent, /C 0\.10/);
  assert.doesNotMatch(h.tooltip.textContent, /C 0(?:\s|$)/);
});

test('repeated draws coalesce and preserve CSS sizing without reallocating the backing canvas', () => {
  const h = harness({ dpr: 3 });
  h.draw();
  assert.equal(h.canvas.width, 2000); // DPR capped at two.
  assert.equal(h.canvas.height, 1000);
  const writes = h.backingWrites();
  for (let i = 0; i < 12; i++) h.chart.draw();
  assert.equal(h.frames.size, 1);
  h.flush();
  assert.deepEqual(h.backingWrites(), writes);
  assert.deepEqual(h.css, { width: '100%', height: '100%' });
  assert.equal(h.styleWrites.length, 0);
  h.bounds.width = 800;
  h.bounds.height = 450;
  h.observers[0].callback();
  h.flush();
  assert.equal(h.canvas.width, 1600);
  assert.equal(h.canvas.height, 900);
  assert.deepEqual(h.css, { width: '100%', height: '100%' });
});

test('zero, narrow, short, and large parent sizes do not produce non-finite canvas coordinates', () => {
  for (const [width, height] of [[0, 0], [1, 1], [49, 49], [50, 50], [76, 105], [160, 120], [10000, 8000]]) {
    const h = harness({ width, height });
    assert.doesNotThrow(() => h.draw(), `${width}×${height}`);
    assert.equal(h.css.width, '100%');
    assert.equal(h.css.height, '100%');
  }
});

test('zoom controls and keyboard stay bounded between 20 and 240 visible candles', () => {
  const h = harness({ data: { candles: candles(400), cursor: 399, ema: true, levels: [] } });
  h.draw();
  assert.equal(bodies(h).length, 80);
  h.chart.zoom(-1); h.flush(); h.draw();
  assert.equal(bodies(h).length, 64);
  for (let i = 0; i < 40; i++) h.chart.zoom(-1);
  h.flush(); h.draw();
  assert.equal(bodies(h).length, 20);
  for (let i = 0; i < 40; i++) h.chart.zoom(1);
  h.flush(); h.draw();
  assert.equal(bodies(h).length, 240);
  const key = h.event('keydown', { key: '+' });
  assert.equal(key.prevented, true);
  h.draw();
  assert.equal(bodies(h).length, 192);
  h.chart.reset(); h.flush(); h.draw();
  assert.equal(bodies(h).length, 80);
});

test('panning moves to revealed history and latest returns to the replay cursor', () => {
  const h = harness();
  h.draw();
  const rightEdge = h.bounds.left + h.bounds.width - 83;
  h.event('pointermove', { clientX: rightEdge });
  const latest = h.tooltip.textContent;
  assert.match(latest, /C 130\.8/);
  h.event('pointerdown', { clientX: 400 });
  h.event('pointermove', { clientX: 520 });
  h.event('pointerup', { clientX: 520 });
  h.event('pointermove', { clientX: rightEdge });
  const panned = h.tooltip.textContent;
  assert.notEqual(panned, latest);
  h.chart.latest(); h.flush();
  h.event('pointermove', { clientX: rightEdge });
  assert.equal(h.tooltip.textContent, latest);
});

test('marking levels only accepts plot locations and Enter marks the revealed close', () => {
  const h = harness();
  h.draw();
  h.chart.setLevelMode(true);
  assert.equal(h.css.cursor, 'crosshair');
  h.event('pointerup', { clientX: h.bounds.left + 400, clientY: h.bounds.top + 100 });
  assert.equal(h.levels.length, 1);
  assert.ok(Number.isFinite(h.levels[0]));
  assert.ok(h.levels[0] > 100 && h.levels[0] < 140);
  h.event('pointerup', { clientX: h.bounds.left + 2, clientY: h.bounds.top + 2 });
  assert.equal(h.levels.length, 1);
  h.event('keydown', { key: 'Enter' });
  assert.equal(h.levels.length, 2);
  assert.equal(h.levels[1], h.getData().candles[h.getData().cursor].close);
});

test('clearing data or collapsing the chart hides the previous tooltip', () => {
  const h = harness();
  h.draw(); h.event('pointermove');
  assert.equal(h.tooltip.hidden, false);
  h.setData({ candles: [], cursor: -1, ema: false, levels: [] });
  h.draw();
  assert.equal(h.tooltip.hidden, true);
  h.setData({ candles: candles(30), cursor: 19, ema: false, levels: [] });
  h.draw(); h.event('pointermove');
  assert.equal(h.tooltip.hidden, false);
  h.bounds.width = 0; h.bounds.height = 0;
  h.draw();
  assert.equal(h.tooltip.hidden, true);
});

test('level keyboard shortcut safely ignores an empty dataset', () => {
  const h = harness({ data: { candles: [], cursor: -1, ema: false, levels: [] } });
  h.draw(); h.chart.setLevelMode(true);
  assert.doesNotThrow(() => h.event('keydown', { key: 'Enter' }));
  assert.equal(h.levels.length, 0);
});

test('destroy removes listeners and cancels pending redraw work', () => {
  const h = harness();
  const registered = h.listeners.size;
  h.chart.draw();
  assert.equal(h.frames.size, 1);
  assert.ok(registered > 0);
  h.chart.destroy();
  assert.equal(h.frames.size, 0);
  assert.equal(h.listeners.size, 0);
  assert.equal(h.observers[0].disconnected, true);
  h.chart.draw();
  assert.equal(h.frames.size, 0);
});
