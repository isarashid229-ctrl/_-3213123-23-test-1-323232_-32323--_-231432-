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
  const chart = sandbox.ReplayChart.create(element, tooltip, { getData: () => data, onLevel: value => levels.push(value), ...overrides.callbacks });
  function flush() { const queue = Array.from(frames.values()); frames.clear(); queue.forEach(callback => callback()); }
  function draw() { chart.draw(); flush(); return html; }
  function event(name, properties = {}) {
    const e = Object.assign({ clientX: bounds.left + 400, clientY: bounds.top + 200, pointerId: 1, pointerType: 'mouse', button: 0, preventDefault() { this.prevented = true; } }, properties);
    listeners.get(name)?.(e); flush(); return e;
  }
  return { chart, element, tooltip, attributes, levels, listeners, observers, frames, bounds, css, sandbox, draw, flush, event,
    markup: () => html, writes: () => writes, setData(value) { data = value; }, getData: () => data };
}
function bodies(h) { return [...h.markup().matchAll(/data-series="candle"/g)].length; }
function selected(h) { return Number(/data-selected-index="(\d+)"/.exec(h.markup())?.[1]); }
function through(h) { return Number(/data-through-index="(\d+)"/.exec(h.markup())?.[1]); }
function plot(h) {
  const match = /<clipPath id="[^\"]+-price"><rect x="([^\"]+)" y="([^\"]+)" width="([^\"]+)" height="([^\"]+)"/.exec(h.markup());
  return { x: Number(match[1]), y: Number(match[2]), width: Number(match[3]), height: Number(match[4]) };
}
function click(h, x, y) {
  h.event('pointerdown', { clientX: h.bounds.left + x, clientY: h.bounds.top + y });
  h.event('pointerup', { clientX: h.bounds.left + x, clientY: h.bounds.top + y });
}
function normalized(value) { return JSON.parse(JSON.stringify(value)); }
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

test('horizontal and two-point trendline tools emit completed host-owned drawings at revealed bar times', () => {
  const drafts = [];
  const h = harness({ callbacks: { onDrawing: drawing => drafts.push(normalized(drawing)) } });
  h.draw();
  h.chart.setTool('horizontal'); h.flush();
  click(h, 250, 190);
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].type, 'horizontal');
  assert.ok(drafts[0].price > 0);
  assert.equal(h.levels.length, 0, 'the modern and legacy callbacks must not both fire');
  assert.equal(h.attributes['data-chart-tool'], 'horizontal');

  h.chart.setTool('trendline'); h.flush();
  click(h, 240, 210);
  assert.equal(drafts.length, 1, 'a first endpoint must not be persisted as a completed line');
  assert.match(h.markup(), /Choose a second bar/);
  h.event('pointermove', { clientX: h.bounds.left + 580, clientY: h.bounds.top + 150 });
  assert.match(h.markup(), /data-drawing-preview="trendline"/);
  click(h, 580, 150);
  assert.equal(drafts.length, 2);
  const line = drafts[1];
  assert.equal(line.type, 'trendline');
  assert.ok(line.from.time < line.to.time);
  assert.ok(line.from.price < line.to.price);
  for (const endpoint of [line.from, line.to]) {
    assert.ok(h.getData().candles.slice(0, 150).some(bar => bar.time === endpoint.time));
    assert.ok(endpoint.time <= h.getData().candles[149].time);
  }
  assert.doesNotMatch(h.markup(), /data-drawing-preview=/);
  assert.deepEqual(h.getData().drawings, undefined, 'the chart must not mutate host data');

  click(h, 300, 180); click(h, 300, 200);
  assert.equal(drafts.length, 2, 'a trendline requires distinct bar times');
  assert.equal(h.chart.cancelDrawing(), true); h.flush();
  assert.equal(h.chart.cancelDrawing(), false); h.flush();
  assert.doesNotMatch(h.markup(), /data-drawing-preview=/);
  h.event('pointerdown'); h.event('pointercancel'); h.event('pointerup');
  assert.equal(drafts.length, 2, 'cancelled gestures cannot place points');
});

test('drawing keyboard controls place endpoints, select and delete without trapping ordinary browser keys', () => {
  const drafts = [], selections = [], deleted = [];
  const h = harness({ callbacks: {
    onDrawing: drawing => drafts.push(normalized(drawing)),
    onDrawingSelect: value => selections.push(value),
    onDeleteDrawing: value => { deleted.push(value); h.getData().drawings = h.getData().drawings.filter(item => item.id !== value); }
  } });
  h.draw(); h.chart.setTool('trendline'); h.flush();
  h.event('keydown', { key: 'Enter' });
  for (let i = 0; i < 4; i++) h.event('keydown', { key: 'ArrowLeft' });
  h.event('keydown', { key: 'ArrowUp' }); h.event('keydown', { key: 'Enter' });
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].from.time, h.getData().candles[149].time);
  assert.equal(drafts[0].to.time, h.getData().candles[145].time);
  assert.ok(drafts[0].to.price > drafts[0].from.price);

  h.getData().drawings = [{ id: 'keyboard-line', ...drafts[0] }];
  h.chart.setTool('cursor'); h.flush();
  h.event('pointermove'); assert.doesNotMatch(h.markup(), /data-crosshair=/);
  h.event('keydown', { key: 'd' });
  assert.deepEqual(selections, ['keyboard-line']);
  assert.match(h.markup(), /data-selected="true"/);
  assert.match(h.markup(), /data-drawing-handle="true"/);
  const deletion = h.event('keydown', { key: 'Delete' });
  assert.equal(deletion.prevented, true);
  assert.deepEqual(deleted, ['keyboard-line']);
  assert.deepEqual(selections, ['keyboard-line', null]);
  assert.doesNotMatch(h.markup(), /data-drawing-id="keyboard-line"/);
  assert.equal(h.chart.deleteSelected(), false);
  assert.equal(h.event('keydown', { key: 'Tab' }).prevented, undefined);
  assert.equal(h.event('keydown', { key: '+', ctrlKey: true }).prevented, undefined);

  h.chart.setTool('trendline'); h.flush(); h.event('keydown', { key: 'Enter' });
  h.event('keydown', { key: 'Escape' });
  assert.doesNotMatch(h.markup(), /data-drawing-preview=/);
  h.chart.setTool('invalid-tool'); h.flush();
  assert.equal(h.attributes['data-chart-tool'], 'trendline');
});

test('drawings support pointer selection, escape labels, and discard selection when the host removes them', () => {
  const selections = [];
  const h = harness({ callbacks: { onDrawingSelect: value => selections.push(value) } });
  const drawingId = 'level"/><script>bad()</script>';
  h.getData().drawings = [{ id: drawingId, type: 'horizontal', price: 125, color: '#2345ab' }];
  h.draw();
  assert.doesNotMatch(h.markup(), /<script>/);
  assert.match(h.markup(), /data-drawing-id="level&quot;/);
  const p = plot(h), scale = h.chart.getScaleState();
  const py = p.y + (scale.high - 125) / (scale.high - scale.low) * p.height;
  click(h, 300, py);
  assert.deepEqual(selections, [drawingId]);
  assert.match(h.markup(), /data-selected="true"/);
  h.getData().drawings = []; h.draw();
  assert.deepEqual(selections, [drawingId, null]);
  assert.equal(h.chart.deleteSelected(), false);
});

test('future drawing endpoints are neither read nor rendered and cannot change the viewport scale', () => {
  const h = harness(); h.draw();
  const baseline = normalized(h.chart.getScaleState());
  const bars = h.getData().candles;
  h.getData().drawings = [
    { id: 'future-end', type: 'trendline', from: { time: bars[100].time, price: 120 }, to: { time: bars[200].time, get price() { throw new Error('future endpoint read'); } } },
    { id: 'future-start', type: 'trendline', from: { time: bars[200].time, get price() { throw new Error('future endpoint read'); } }, to: { time: bars[100].time, price: 120 } }
  ];
  h.getData().candles = bars.map((bar, i) => i <= 149 ? bar : new Proxy(bar, { get() { throw new Error('future candle ' + i); } }));
  assert.doesNotThrow(() => h.draw());
  assert.doesNotMatch(h.markup(), /data-drawing-id="future/);
  assert.deepEqual(normalized(h.chart.getScaleState()), baseline);
});

test('price-axis wheel and drag preserve a manual range while auto-fit tracks newly revealed prices', () => {
  const changes = [];
  const h = harness({ callbacks: { onScaleChange: value => changes.push(normalized(value)) } });
  h.draw();
  const initial = normalized(h.chart.getScaleState()), initialCount = bodies(h);
  const axis = { clientX: h.bounds.left + h.bounds.width - 25, clientY: h.bounds.top + 190 };
  h.event('wheel', { ...axis, deltaY: -120 });
  const manual = normalized(h.chart.getScaleState());
  assert.equal(manual.auto, false);
  assert.ok(manual.high - manual.low < initial.high - initial.low);
  assert.equal(bodies(h), initialCount, 'price-axis zoom must not change time zoom');
  assert.deepEqual(changes, [{ auto: false }]);
  h.getData().cursor = 150; h.getData().candles[150].high = 220;
  h.draw();
  assert.deepEqual(normalized(h.chart.getScaleState()), manual, 'new bars must not silently reset a manual price range');
  h.chart.resetPriceScale(); h.flush();
  assert.equal(h.chart.getScaleState().auto, true);
  assert.ok(h.chart.getScaleState().high > 220);
  assert.deepEqual(changes, [{ auto: false }, { auto: true }]);

  const beforeDrag = normalized(h.chart.getScaleState());
  h.event('pointerdown', axis);
  h.event('pointermove', { ...axis, clientY: axis.clientY + 55 });
  h.event('pointerup', { ...axis, clientY: axis.clientY + 55 });
  const afterDrag = normalized(h.chart.getScaleState());
  assert.equal(afterDrag.auto, false);
  assert.ok(afterDrag.high - afterDrag.low > beforeDrag.high - beforeDrag.low);
  const span = afterDrag.high - afterDrag.low;
  h.event('pointerdown', { clientX: 420, clientY: 210 });
  h.event('pointermove', { clientX: 420, clientY: 240 });
  h.event('pointerup', { clientX: 420, clientY: 240 });
  assert.ok(h.chart.getScaleState().low > afterDrag.low);
  assert.ok(Math.abs(h.chart.getScaleState().high - h.chart.getScaleState().low - span) < 1e-8);
  h.event('dblclick', axis);
  assert.equal(h.chart.getScaleState().auto, true);
  h.event('keydown', { key: '+', altKey: true });
  assert.equal(h.chart.getScaleState().auto, false);
  h.event('keydown', { key: '0' });
  assert.equal(h.chart.getScaleState().auto, true);
});

test('manual price scales remain finite at tiny prices, extreme drag distances and chart resize', () => {
  const h = harness({ data: { candles: candles(200, 1e-10), cursor: 149, settings: {}, drawings: [], levels: [] } });
  h.draw();
  h.chart.setAutoscale(false); h.flush();
  const frozen = normalized(h.chart.getScaleState());
  h.bounds.width = 450; h.bounds.height = 320; h.draw();
  assert.deepEqual(normalized(h.chart.getScaleState()), frozen);
  const axis = { clientX: h.bounds.left + h.bounds.width - 15, clientY: h.bounds.top + 150 };
  h.event('pointerdown', axis);
  h.event('pointermove', { ...axis, clientY: axis.clientY - 100000 });
  h.event('pointerup', { ...axis, clientY: axis.clientY - 100000 });
  finiteMarkup(h.markup());
  assert.ok(h.chart.getScaleState().low >= 0);
  assert.ok(h.chart.getScaleState().high > h.chart.getScaleState().low);
  h.chart.reset(); h.flush();
  assert.equal(h.chart.getScaleState().auto, true);
});

test('entry and exit markers reveal independently and never inspect future prices or affect scaling', () => {
  const bars = candles(300), h = harness({ data: { candles: bars, cursor: 149, settings: {}, trades: [] } });
  h.draw(); const baseline = normalized(h.chart.getScaleState());
  let exitReads = 0;
  h.getData().trades = [
    { id: 'delayed', side: 'long', entryTime: bars[120].time, entryBarIndex: 120, entryPrice: bars[120].close,
      exitTime: bars[160].time, exitBarIndex: 160, get exitPrice() { exitReads++; return bars[160].close; }, get netPnl() { throw new Error('result not needed by chart'); } },
    { entryTime: bars[200].time, get entryPrice() { throw new Error('future entry price'); }, get exitTime() { throw new Error('future trade metadata'); }, get id() { throw new Error('future trade identifier'); } },
    { id: 'earlier-entry', side: 'short', entryTime: bars[10].time, entryBarIndex: 10, get entryPrice() { throw new Error('offscreen entry should not be read'); }, exitTime: bars[130].time, exitBarIndex: 130, exitPrice: bars[130].close },
    { id: 'bad-index', side: 'long', entryTime: bars[120].time, entryBarIndex: 200, get entryPrice() { throw new Error('unrevealed entry index'); }, exitTime: bars[130].time, exitBarIndex: 200, get exitPrice() { throw new Error('unrevealed exit index'); } }
  ];
  h.getData().position = { entryTime: bars[180].time, get entryPrice() { throw new Error('future open position'); } };
  h.getData().candles = bars.map((bar, i) => i <= 149 ? bar : new Proxy(bar, { get() { throw new Error('future bar ' + i); } }));
  assert.doesNotThrow(() => h.draw());
  assert.equal(exitReads, 0);
  assert.match(h.markup(), /data-trade-marker="entry" data-trade-id="delayed"/);
  assert.doesNotMatch(h.markup(), /data-trade-marker="exit" data-trade-id="delayed"/);
  assert.match(h.markup(), /data-trade-marker="exit" data-trade-id="earlier-entry"/);
  assert.doesNotMatch(h.markup(), /data-trade-marker="entry" data-trade-id="earlier-entry"|data-trade-id="bad-index"/);
  assert.deepEqual(normalized(h.chart.getScaleState()), baseline);
  assert.match(h.markup(), /Long entry at 125\.00/);
  assert.match(h.markup(), /New York<\/title>/);

  h.getData().candles = bars; h.getData().cursor = 159; h.draw(); assert.equal(exitReads, 0);
  h.getData().cursor = 160; h.draw();
  assert.equal(exitReads, 1);
  assert.match(h.markup(), /data-trade-marker="exit" data-trade-id="delayed"[^>]*data-event-index="160"/);
  h.getData().position = { id: 'open', side: 'short', entryTime: bars[155].time, entryBarIndex: 155, entryPrice: bars[155].close, stop: 135, target: 125 };
  h.draw();
  assert.match(h.markup(), /data-trade-marker="entry" data-trade-id="open"/);
  assert.match(h.markup(), /Short entry at/);
});

test('crosshair labels use New York and tool choice controls its visible behavior', () => {
  const h = harness(); h.draw(); h.event('pointermove');
  assert.match(h.markup(), /data-crosshair="time"/);
  assert.match(h.markup(), />Mar \d+ \d\d:\d\d EST<\/text>/);
  h.chart.setTool('cursor'); h.flush();
  assert.doesNotMatch(h.markup(), /data-crosshair=/);
  assert.match(h.attributes['aria-label'], /Active tool: cursor/);
  h.chart.setTool('crosshair'); h.flush();
  assert.match(h.markup(), /data-crosshair="vertical"/);
  h.chart.setCrosshair(false); h.flush();
  assert.doesNotMatch(h.markup(), /data-crosshair=/);
});

test('desktop OHLC uses one compact row while narrow charts wrap without covering the plot', () => {
  const desktop = harness(), narrow = harness({ width: 400 });
  desktop.draw(); narrow.draw();
  function headerRows(h) {
    return [...h.markup().matchAll(/<text x="[^\"]+" y="([^\"]+)" data-ohlc="(?:open|high|low|close)"/g)].map(match => Number(match[1]));
  }
  const desktopRows = headerRows(desktop), narrowRows = headerRows(narrow);
  assert.equal(desktopRows.length, 4); assert.equal(new Set(desktopRows).size, 1);
  assert.equal(narrowRows.length, 4); assert.equal(new Set(narrowRows).size, 2);
  assert.ok(Math.max(...desktopRows) < plot(desktop).y);
  assert.ok(Math.max(...narrowRows) < plot(narrow).y);
  assert.ok(plot(desktop).height > desktop.bounds.height * 0.55);
});

test('multiple chart instances keep clip paths, drawing tools, scales and cleanup independent', () => {
  const first = harness(), second = harness({ width: 500, height: 400 });
  second.chart.destroy();
  const chartTwo = first.sandbox.ReplayChart.create(second.element, second.tooltip, { getData: second.getData });
  first.draw(); chartTwo.draw(); first.flush();
  const firstClip = /<clipPath id="([^\"]+)-price"/.exec(first.markup())[1];
  const secondClip = /<clipPath id="([^\"]+)-price"/.exec(second.markup())[1];
  assert.notEqual(firstClip, secondClip);
  first.chart.setTool('trendline'); first.flush();
  first.event('keydown', { key: 'Enter' });
  assert.match(first.markup(), /data-drawing-preview="trendline"/);
  assert.doesNotMatch(second.markup(), /data-drawing-preview=/);
  first.chart.setAutoscale(false); first.flush();
  assert.equal(chartTwo.getScaleState().auto, true);
  assert.equal(second.attributes['data-chart-tool'], 'crosshair');
  first.chart.destroy();
  const writes = second.writes(); chartTwo.draw(); first.flush();
  assert.ok(second.writes() > writes);
  assert.ok(second.listeners.size > 0);
  chartTwo.destroy();
  assert.equal(second.listeners.size, 0);
  assert.ok(first.observers.every(observer => observer.disconnected));
});

test('a requested study candle is outlined only when its bar is revealed and visible', () => {
  const h = harness(); h.getData().highlightIndex = 120; h.draw();
  assert.match(h.markup(), /data-study-candle="120"/);
  assert.match(h.markup(), /Study candle:/);
  h.getData().highlightIndex = 200;
  h.getData().candles[200] = new Proxy({}, { get() { throw new Error('unrevealed highlighted bar read'); } });
  assert.doesNotThrow(() => h.draw());
  assert.doesNotMatch(h.markup(), /data-study-candle=/);
  h.getData().highlightIndex = 5; h.draw();
  assert.doesNotMatch(h.markup(), /data-study-candle=/);
});

test('same-bar fills keep their markers and detail but cap visible labels, with readable price badges', () => {
  const h = harness(), data = h.getData(), bar = data.candles[data.cursor];
  data.trades = Array.from({ length: 15 }, (_, index) => ({ id: 'same-' + index, side: index % 2 ? 'short' : 'long', entryTime: bar.time, entryBarIndex: data.cursor, entryPrice: bar.close, exitTime: bar.time, exitBarIndex: data.cursor, exitPrice: bar.close }));
  data.settings.bullColor = '#ffffff'; h.draw();
  assert.equal([...h.markup().matchAll(/data-trade-marker="/g)].length, 30);
  assert.equal([...h.markup().matchAll(/data-trade-label="true"/g)].length, 2);
  assert.match(h.markup(), /data-last-price-text="true" fill="#172033"/);
  data.settings.bullColor = '#172033'; h.draw();
  assert.match(h.markup(), /data-last-price-text="true" fill="#ffffff"/);
  data.settings.showTrades = false; h.draw();
  assert.doesNotMatch(h.markup(), /data-trade-marker="|data-trade-label="/);
});
