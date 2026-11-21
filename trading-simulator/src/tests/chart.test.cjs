'use strict';
// Deterministic SVG/event verification. Browser layout is tested separately by
// the site owner; this harness never substitutes a raster screenshot for SVG.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const NY = require('../time.js');
const chartSource = fs.readFileSync(path.join(__dirname, '../chart.js'), 'utf8');
const startTime = Date.parse('2026-03-02T14:30:00Z') / 1000;
function candles(count, scale = 1) {
  return Array.from({ length: count }, (_, i) => ({ time: startTime + i * 900, open: (100 + i * 0.2) * scale, high: (103 + i * 0.2) * scale, low: (98 + i * 0.2) * scale, close: (101 + i * 0.2) * scale, volume: 100 + i }));
}
function harness(overrides = {}) {
  const frames = new Map(), listeners = new Map(), attributes = {}, levels = [], observers = [];
  const bounds = { width: overrides.width ?? 1000, height: overrides.height ?? 560, left: 20, top: 30 };
  let data = overrides.data || { candles: candles(300), cursor: 149, ema: true, levels: [], position: null, timeframe: '15m', settings: {} };
  let frameId = 0, html = '', writes = 0;
  const css = { width: '100%', height: '100%' };
  const element = {
    tagName: 'svg', namespaceURI: 'http://www.w3.org/2000/svg',
    parentElement: { getBoundingClientRect: () => bounds },
    getBoundingClientRect: () => bounds,
    style: css,
    getContext() { throw new Error('A vector chart must never request a canvas context.'); },
    setAttribute(name, value) { attributes[name] = String(value); },
    addEventListener(name, handler) { listeners.set(name, handler); },
    removeEventListener(name, handler) { if (listeners.get(name) === handler) listeners.delete(name); },
    setPointerCapture() {}
  };
  Object.defineProperty(element, 'innerHTML', { get: () => html, set(value) { html = String(value); writes++; } });
  Object.defineProperty(element, 'width', { set() { throw new Error('Raster width must not be assigned.'); } });
  Object.defineProperty(element, 'height', { set() { throw new Error('Raster height must not be assigned.'); } });
  const tooltip = { hidden: true, textContent: '', style: {} };
  class ResizeObserver {
    constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
    observe() {}
    disconnect() { this.disconnected = true; }
  }
  const sandbox = { ReplayTime: NY, ResizeObserver, devicePixelRatio: overrides.dpr || 1, console,
    requestAnimationFrame(callback) { const id = ++frameId; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); }
  };
  sandbox.window = sandbox;
  vm.runInNewContext(chartSource, sandbox, { filename: 'chart.js' });
  const chart = sandbox.ReplayChart.create(element, tooltip, { getData: () => data, onLevel: value => levels.push(value) });
  function flush() { const queue = Array.from(frames.values()); frames.clear(); queue.forEach(callback => callback()); }
  function draw() { chart.draw(); flush(); return html; }
  function event(name, properties = {}) {
    const e = Object.assign({ clientX: bounds.left + 400, clientY: bounds.top + 200, pointerId: 1, pointerType: 'mouse', button: 0, preventDefault() { this.prevented = true; } }, properties);
    listeners.get(name)?.(e); flush(); return e;
  }
  return { chart, element, tooltip, attributes, levels, listeners, observers, frames, bounds, css, draw, flush, event,
    markup: () => html, writes: () => writes, setData(value) { data = value; }, getData: () => data };
}
function bodies(h) { return [...h.markup().matchAll(/data-series="candle"/g)].length; }
function selected(h) { return Number(/data-selected-index="(\d+)"/.exec(h.markup())?.[1]); }
function through(h) { return Number(/data-through-index="(\d+)"/.exec(h.markup())?.[1]); }
function finiteMarkup(html) {
  assert.doesNotMatch(html, /(?:NaN|Infinity|undefined)/);
  for (const match of html.matchAll(/\b(?:x|y|width|height|x1|x2|y1|y2|cx|cy)="(-?\d[^\"]*)"/g)) assert.ok(Number.isFinite(parseFloat(match[1])), match[0]);
}

test('renderer emits scalable SVG with crisp 14px labels and no raster/DPR dependency', () => {
  const one = harness({ dpr: 1 }), three = harness({ dpr: 3 });
  const first = one.draw(), second = three.draw();
  assert.equal(first, second);
  assert.equal(one.attributes.viewBox, '0 0 1000 560');
  assert.equal(one.attributes['data-renderer'], 'svg');
  assert.match(first, /data-price-axis="true"[^>]*font-size="14"/);
  assert.match(first, /data-ohlc="close"[^>]*font-size="14"/);
  assert.match(first, /vector-effect="non-scaling-stroke"/);
  assert.doesNotMatch(first, /<canvas|<image|data:image/);
  assert.equal(one.attributes.role, 'img');
  assert.equal(one.attributes.tabindex, '0');
  assert.match(first, /<title>Historical/);
  assert.deepEqual(one.css, { width: '100%', height: '100%' });
});

test('unrevealed bars cannot affect candles, scale, EMAs, VWAP, shading, hover, or aria text', () => {
  const h = harness();
  const data = h.getData();
  data.settings = { vwap: true, sessionShading: true };
  const before = JSON.stringify(data), baseline = h.draw(), aria = h.attributes['aria-label'];
  h.event('pointermove'); const tooltip = h.tooltip.textContent;
  assert.equal(JSON.stringify(data), before);
  data.candles = data.candles.map((bar, i) => i <= data.cursor ? bar : new Proxy(bar, { get() { throw new Error('Read future bar ' + i); } }));
  h.event('pointerleave');
  assert.equal(h.draw(), baseline);
  assert.equal(h.attributes['aria-label'], aria);
  h.event('pointermove'); assert.equal(h.tooltip.textContent, tooltip);
  assert.match(aria, /Future candles are hidden/);
  assert.match(aria, /130\.80/);
  assert.equal(through(h), data.cursor);
});

test('candles retain chronological indices and default to blue bullish and black bearish bodies', () => {
  const bars = candles(4);
  bars[1].close = bars[1].open - 1;
  const h = harness({ data: { candles: bars, cursor: 2, settings: {}, ema: false, levels: [] } });
  h.draw();
  const indices = [...h.markup().matchAll(/data-candle-index="(\d+)" data-time="(\d+)"/g)].map(m => [Number(m[1]), Number(m[2])]);
  assert.deepEqual(indices, [[0, bars[0].time], [1, bars[1].time], [2, bars[2].time]]);
  assert.match(h.markup(), /data-direction="bull"[\s\S]*?data-series="candle"[^>]*fill="#2962ff"/);
  assert.match(h.markup(), /data-direction="bear"[\s\S]*?data-series="candle"[^>]*fill="#172033"/);
  assert.match(h.markup(), /fill="#ffffff"/);
});

test('formatting supports prices below ten and tiny decimal-priced instruments', () => {
  for (const scale of [0.01, 0.001, 0.000000001]) {
    const h = harness({ data: { candles: candles(30, scale), cursor: 19, ema: true, levels: [], settings: {} } });
    assert.doesNotThrow(() => h.draw()); finiteMarkup(h.markup());
    assert.ok(h.markup().includes('data-ohlc="close"'));
    h.event('pointermove');
    assert.doesNotMatch(h.tooltip.textContent, /C 0\.0000(?:\s|$)/);
  }
  const normal = harness({ data: { candles: candles(30, 0.001), cursor: 19, levels: [] } });
  normal.draw(); assert.match(normal.markup(), />0\.1048<\/text>/);
});

test('New York intraday labels follow EST/EDT and session shading follows the actual offset', () => {
  const times = ['2026-03-06T14:29:00Z', '2026-03-06T14:30:00Z', '2026-03-06T21:00:00Z', '2026-03-09T13:29:00Z', '2026-03-09T13:30:00Z', '2026-03-09T20:00:00Z'].map(s => Date.parse(s) / 1000);
  const bars = times.map((time, i) => ({ ...candles(6)[i], time }));
  const h = harness({ data: { candles: bars, cursor: 5, timeframe: '1m', settings: { sessionShading: true } } });
  h.draw();
  const blocks = [...h.markup().matchAll(/data-session-reference="true" data-start-time="(\d+)" data-end-time="(\d+)"/g)].map(m => [Number(m[1]), Number(m[2])]);
  assert.deepEqual(blocks, [[times[1], times[1]], [times[4], times[4]]]);
  assert.match(h.attributes['aria-label'], /16:00 EDT, New York/);
  assert.match(h.markup(), /09:29<\/text>/);
  assert.doesNotMatch(h.attributes['aria-label'], /UTC/);
  h.setData({ candles: bars, cursor: 1, timeframe: '1m', settings: {} }); h.draw();
  assert.match(h.attributes['aria-label'], /09:30 EST, New York/);
  assert.match(h.markup(), /holidays|Holidays/);
});

test('daily equity bars preserve the New York session date without pretending to be intraday', () => {
  const bars = candles(3).map((bar, i) => ({ ...bar, time: NY.parseLocal('2026-11-' + (16 + i), '16:00') }));
  const h = harness({ data: { candles: bars, cursor: 2, timeframe: '1d', instrument: { assetClass: 'equity' }, settings: { vwap: true, sessionShading: true } } });
  h.draw();
  assert.match(h.attributes['aria-label'], /Nov 18, 2026 · daily session · EST/);
  assert.match(h.markup(), /data-time-axis="true"[^>]*>Nov 18<\/text>/);
  assert.doesNotMatch(h.markup(), /data-session-reference|data-indicator="vwap"/);
  assert.doesNotMatch(h.attributes['aria-label'], /16:00|21:00/);
  assert.match(h.markup(), /VWAP needs intraday bars/);
});

test('tick volume is labeled accurately and cannot be used as traded-volume VWAP', () => {
  const h = harness();
  h.getData().volumeKind = 'ticks'; h.getData().settings.vwap = true;
  h.draw();
  assert.match(h.markup(), />Tick volume<\/text>/);
  assert.doesNotMatch(h.markup(), /data-indicator="vwap"/);
  assert.match(h.markup(), /VWAP unavailable with tick volume/);
  h.event('pointermove'); assert.match(h.tooltip.textContent, /Ticks /);
});

test('candle, OHLC bar and close-line modes honor theme, color, volume, grid and indicator choices', () => {
  const h = harness();
  const d = h.getData();
  d.settings = { chartType: 'bars', chartTheme: 'dark', bullColor: '#1234ab', bearColor: '#070707', showVolume: false, showGrid: false, ema: false, sessionShading: false };
  h.draw();
  assert.equal([...h.markup().matchAll(/data-series="bar"/g)].length, 80);
  assert.doesNotMatch(h.markup(), /data-series="candle"|data-volume-series|data-grid=|data-indicator=|data-session-reference/);
  assert.match(h.markup(), /fill="#101925"/);
  assert.match(h.markup(), /stroke="#1234ab"/);
  assert.equal(h.attributes['data-chart-theme'], 'dark');
  d.settings.chartType = 'line'; h.draw();
  assert.match(h.markup(), /data-series="line"/);
  assert.doesNotMatch(h.markup(), /data-candle-index|data-series="bar"/);
  d.settings.chartType = 'candles'; d.settings.bullColor = 'red" onload="bad'; d.settings.showVolume = true; h.draw();
  assert.match(h.markup(), /fill="#2962ff"/);
  assert.doesNotMatch(h.markup(), /onload/);
  assert.match(h.markup(), /data-volume-series/);
});

test('repeated redraws coalesce and SVG viewBox follows resize without changing CSS sizing', () => {
  const h = harness(); h.draw(); const before = h.writes();
  for (let i = 0; i < 12; i++) h.chart.draw();
  assert.equal(h.frames.size, 1); h.flush(); assert.equal(h.writes(), before + 1);
  h.bounds.width = 800; h.bounds.height = 450; h.observers[0].callback(); h.flush();
  assert.equal(h.attributes.viewBox, '0 0 800 450');
  assert.deepEqual(h.css, { width: '100%', height: '100%' });
});

test('zero, tiny, mobile, short and very large bounds never emit invalid geometry', () => {
  for (const [width, height] of [[0, 0], [1, 1], [160, 120], [220, 160], [280, 200], [360, 420], [10000, 8000]]) {
    const h = harness({ width, height });
    assert.doesNotThrow(() => h.draw(), `${width}×${height}`); finiteMarkup(h.markup());
    assert.equal(h.css.width, '100%'); assert.equal(h.css.height, '100%');
    if (width < 220 || height < 160) assert.equal(h.tooltip.hidden, true);
  }
});

test('zoom and keyboard controls stay bounded, and keyboard pan never reaches future bars', () => {
  const h = harness({ data: { candles: candles(400), cursor: 299, ema: true, levels: [], settings: {} } });
  h.draw(); assert.equal(bodies(h), 80);
  h.chart.zoom(-1); h.flush(); assert.equal(bodies(h), 64);
  for (let i = 0; i < 40; i++) h.chart.zoom(-1); h.flush(); assert.equal(bodies(h), 20);
  for (let i = 0; i < 40; i++) h.chart.zoom(1); h.flush(); assert.equal(bodies(h), 240);
  h.event('keydown', { key: '+' }); assert.equal(bodies(h), 192);
  h.chart.reset(); h.flush(); assert.equal(bodies(h), 80); assert.equal(selected(h), 299);
  h.event('keydown', { key: 'ArrowLeft' }); assert.ok(selected(h) < 299);
  h.event('keydown', { key: 'Home' }); assert.equal(selected(h), 79);
  h.event('keydown', { key: 'End' }); assert.equal(selected(h), 299);
  for (let i = 0; i < 20; i++) h.event('keydown', { key: 'ArrowRight' });
  assert.equal(selected(h), 299);
});

test('pointer panning, cancellation, and latest preserve a revealed-only viewport', () => {
  const h = harness(); h.draw();
  h.event('pointerdown', { clientX: 420 });
  h.event('pointermove', { clientX: 540 });
  h.event('pointerup', { clientX: 540 });
  h.event('pointerleave');
  const earlier = selected(h); assert.ok(earlier < 149);
  h.event('pointerdown', { clientX: 420 });
  h.event('pointercancel');
  h.event('pointermove', { clientX: 700 });
  h.event('pointerleave'); assert.equal(selected(h), earlier);
  h.chart.latest(); h.flush(); assert.equal(selected(h), 149);
});

test('price annotations remain vector lines and level marking is mouse and keyboard accessible', () => {
  const h = harness(); h.getData().levels = [125]; h.getData().position = { entryPrice: 126, stop: 124, target: 130 };
  h.draw();
  for (const name of ['level', 'entry', 'stop', 'target']) assert.match(h.markup(), new RegExp('data-price-line="' + name + '"'));
  h.chart.setLevelMode(true); h.flush(); assert.equal(h.css.cursor, 'crosshair');
  h.event('pointerdown'); h.event('pointerup'); assert.equal(h.levels.length, 1); assert.ok(Number.isFinite(h.levels[0]));
  h.event('pointerdown', { clientX: 22, clientY: 32 }); h.event('pointerup', { clientX: 22, clientY: 32 }); assert.equal(h.levels.length, 1);
  h.event('keydown', { key: 'Enter' }); assert.equal(h.levels[1], h.getData().candles[149].close);
  h.event('keydown', { key: 'ArrowUp' }); h.event('keydown', { key: 'Enter' }); assert.ok(h.levels[2] > h.levels[1]);
  h.chart.setCrosshair(false); h.event('pointermove'); assert.doesNotMatch(h.markup(), /data-crosshair=/);
});

test('empty, collapsed and destroyed charts hide stale tooltip state and clean up listeners', () => {
  const h = harness(); h.draw(); h.event('pointermove'); assert.equal(h.tooltip.hidden, false);
  h.setData({ candles: [], cursor: -1, settings: {} }); h.draw(); assert.equal(h.tooltip.hidden, true);
  h.chart.setLevelMode(true); h.flush(); assert.doesNotThrow(() => h.event('keydown', { key: 'Enter' })); assert.equal(h.levels.length, 0);
  h.setData({ candles: candles(30), cursor: 19, settings: {} }); h.draw(); h.event('pointermove'); assert.equal(h.tooltip.hidden, false);
  h.bounds.width = 0; h.bounds.height = 0; h.draw(); assert.equal(h.tooltip.hidden, true);
  h.chart.draw(); assert.equal(h.frames.size, 1); h.chart.destroy();
  assert.equal(h.frames.size, 0); assert.equal(h.listeners.size, 0); assert.equal(h.observers[0].disconnected, true);
  h.chart.draw(); assert.equal(h.frames.size, 0);
});
