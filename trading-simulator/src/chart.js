/* ReplayLab vector chart. The host supplies validated, ascending OHLCV candles.
 * Only bars at or before the replay cursor may be read. Rendering uses SVG in
 * CSS-pixel coordinates; there is no raster backing store or DPR scaling.
 * Drawings are host-owned: horizontal {id,type,price}; trendline
 * {id,type,from:{time,price},to:{time,price}}. onDrawing receives a completed
 * drawing without an id. onDrawingSelect/onDeleteDrawing receive an id.
 * Trades use entryTime/entryPrice and optional exitTime/exitPrice; each event
 * is checked against the revealed cursor before its price is ever read.
 */
(function (root) {
  'use strict';
  const ZONE = 'America/New_York';
  const DEFAULTS = Object.freeze({ bullColor: '#2962ff', bearColor: '#172033', chartTheme: 'light', chartType: 'candles', showVolume: true, showGrid: true, ema: true, vwap: false, sessionShading: true });
  const PALETTES = {
    light: { background: '#ffffff', text: '#263349', muted: '#52627a', grid: '#e8edf4', axis: '#d4dce8', session: '#edf3ff', crosshair: '#73839b', marker: '#e8eef8', ema9: '#7954c9', ema21: '#996600', vwap: '#be417f', level: '#617694', entry: '#5865b5', stop: '#c24651', target: '#168469', bearOutline: '#172033' },
    dark: { background: '#101925', text: '#e5edf7', muted: '#adbed2', grid: '#253347', axis: '#36475e', session: '#182740', crosshair: '#9aabc3', marker: '#293a50', ema9: '#b5a0f4', ema21: '#e4b45d', vwap: '#ed98bd', level: '#adbed8', entry: '#bbc4ff', stop: '#fa929d', target: '#6bd6b7', bearOutline: '#aebdd1' }
  };
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const escape = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const coordinate = n => Number(n.toFixed(3));
  const color = (value, fallback) => typeof value === 'string' && /^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i.test(value) ? value : fallback;
  function contrastText(fill) {
    let hex = fill.slice(1);
    if (hex.length === 3) hex = hex.split('').map(value => value + value).join('');
    const values = [0, 2, 4].map(index => { const channel = parseInt(hex.slice(index, index + 2), 16) / 255; return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4; });
    return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722 > 0.179 ? '#172033' : '#ffffff';
  }
  let chartSequence = 0;

  const fallbackParts = new Intl.DateTimeFormat('en-US', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23', timeZoneName: 'short' });
  const fallbackDate = new Intl.DateTimeFormat('en-US', { timeZone: ZONE, month: 'short', day: 'numeric', year: 'numeric' });
  const fallbackShortDate = new Intl.DateTimeFormat('en-US', { timeZone: ZONE, month: 'short', day: 'numeric' });
  function timeParts(t) {
    if (root.ReplayTime) return root.ReplayTime.parts(t);
    const p = Object.fromEntries(fallbackParts.formatToParts(new Date(t * 1000)).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
    return { year: Number(p.year), month: Number(p.month), day: Number(p.day), hour: Number(p.hour), minute: Number(p.minute), weekday: p.weekday, zoneName: p.timeZoneName };
  }
  function dayKey(t) {
    if (root.ReplayTime) return root.ReplayTime.date(t);
    const p = timeParts(t);
    return [p.year, String(p.month).padStart(2, '0'), String(p.day).padStart(2, '0')].join('-');
  }
  function shortDate(t) { return root.ReplayTime ? root.ReplayTime.axis(t, { dateOnly: true }) : fallbackShortDate.format(new Date(t * 1000)); }
  function clock(t) { const p = timeParts(t); return String(p.hour).padStart(2, '0') + ':' + String(p.minute).padStart(2, '0'); }
  function fullTime(t, daily) {
    const label = root.ReplayTime ? root.ReplayTime.format(t, { dateOnly: daily }) : fallbackDate.format(new Date(t * 1000)) + (daily ? '' : ', ' + clock(t) + ' ' + timeParts(t).zoneName);
    return daily ? label + ' · daily session · ' + timeParts(t).zoneName : label;
  }
  function regularHours(t) {
    if (root.ReplayTime) return root.ReplayTime.isRegularSession(t);
    const p = timeParts(t), minutes = p.hour * 60 + p.minute;
    return p.weekday !== 'Sat' && p.weekday !== 'Sun' && minutes >= 570 && minutes < 960;
  }
  function price(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    const absolute = Math.abs(n);
    const decimals = absolute > 0 && absolute < 1 ? clamp(-Math.floor(Math.log10(absolute)) + 3, 4, 12) : absolute < 10 ? 3 : 2;
    return n.toLocaleString('en-US', { minimumFractionDigits: absolute < 1 ? Math.min(4, decimals) : 2, maximumFractionDigits: decimals });
  }
  function volume(value) { return Number(value).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 2 }); }
  function config(data) {
    const input = data.settings || {};
    return {
      bullColor: color(input.bullColor, DEFAULTS.bullColor), bearColor: color(input.bearColor, DEFAULTS.bearColor),
      chartTheme: input.chartTheme === 'dark' ? 'dark' : 'light',
      chartType: ['candles', 'bars', 'line'].includes(input.chartType) ? input.chartType : 'candles',
      showVolume: input.showVolume !== false, showGrid: input.showGrid !== false,
      ema: data.ema !== false && input.ema !== false, vwap: input.vwap === true, sessionShading: input.sessionShading !== false,
      crosshair: input.crosshair !== false, showTrades: input.showTrades !== false
    };
  }

  function create(element, tooltip, options) {
    if (!element || !options || typeof options.getData !== 'function') throw new Error('A chart element and data getter are required.');
    const id = 'replay-vector-' + (++chartSequence);
    const raf = root.requestAnimationFrame ? root.requestAnimationFrame.bind(root) : callback => setTimeout(callback, 16);
    const caf = root.cancelAnimationFrame ? root.cancelAnimationFrame.bind(root) : clearTimeout;
    let visible = 80, offset = 0, mouse = null, geometry = null, drag = null, press = null;
    let tool = 'crosshair', keyboardPrice = null, keyboardIndex = null, crosshair = true, frame = 0, disposed = false;
    let selectedDrawing = null, pendingTrend = null, drawingHits = [], markerHits = [];
    let autoScale = true, manualScale = null;
    element.setAttribute('tabindex', '0');
    element.setAttribute('focusable', 'true');
    element.setAttribute('role', 'img');
    element.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    element.setAttribute('preserveAspectRatio', 'none');
    element.setAttribute('aria-roledescription', 'Interactive historical price chart');
    element.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight + - Enter Escape Delete');
    const redraw = () => {
      if (!frame && !disposed) frame = raf(() => { frame = 0; draw(); });
    };
    function hideTooltip() { if (tooltip) tooltip.hidden = true; }
    function drawingMode() { return ['horizontal','trendline','fib','rectangle','measure'].includes(tool); }
    function selectDrawing(value) {
      if (selectedDrawing === value) return;
      selectedDrawing = value;
      if (typeof options.onDrawingSelect === 'function') options.onDrawingSelect(value);
    }
    function setAutoscale(value) {
      const next = !!value, changed = autoScale !== next;
      if (next) manualScale = null;
      else if (!manualScale && geometry) manualScale = { low: geometry.lowest, high: geometry.highest };
      autoScale = next;
      if (changed && typeof options.onScaleChange === 'function') options.onScaleChange({ auto: next });
      redraw();
    }
    function manualRange(low, high) {
      if (!Number.isFinite(low) || !Number.isFinite(high) || high <= low) return;
      const middle = (low + high) / 2;
      const span = clamp(high - low, Math.max(Math.abs(middle) * 1e-8, 1e-14), Math.max(Math.abs(middle), 1) * 1e6);
      const nextLow = Math.max(0, middle - span / 2);
      manualScale = { low: nextLow, high: nextLow + span };
      setAutoscale(false);
    }
    function scalePrice(factor, at) {
      if (!geometry) return;
      const ratio = at ? clamp((at.y - geometry.top) / geometry.height, 0, 1) : 0.5;
      const span = (geometry.highest - geometry.lowest) * clamp(factor, 0.1, 10);
      const anchor = geometry.highest - ratio * (geometry.highest - geometry.lowest);
      manualRange(anchor - (1 - ratio) * span, anchor + ratio * span);
    }
    function cancelDrawing() {
      const hadPending = pendingTrend !== null;
      pendingTrend = null; keyboardPrice = null; keyboardIndex = null;
      redraw(); return hadPending;
    }
    function setTool(value) {
      if (!['crosshair', 'cursor', 'horizontal', 'trendline','fib','rectangle','measure'].includes(value)) return;
      tool = value; cancelDrawing(); drag = null; press = null;
      element.style.cursor = tool === 'cursor' ? 'grab' : 'crosshair';
      redraw();
    }
    function deleteSelected() {
      if (selectedDrawing === null || typeof options.onDeleteDrawing !== 'function') return false;
      const value = selectedDrawing;
      selectDrawing(null);
      options.onDeleteDrawing(value);
      redraw(); return true;
    }
    function blank(W, H, palette, message) {
      geometry = null; drawingHits = []; markerHits = [];
      hideTooltip();
      if (W > 0 && H > 0) {
        element.setAttribute('viewBox', `0 0 ${coordinate(W)} ${coordinate(H)}`);
        element.innerHTML = `<rect width="100%" height="100%" fill="${palette.background}"/><text x="50%" y="50%" text-anchor="middle" fill="${palette.muted}" font-family="system-ui,sans-serif" font-size="14">${escape(message)}</text>`;
      } else element.innerHTML = '';
      element.setAttribute('aria-label', message);
    }
    function draw() {
      if (disposed) return;
      const bounds = element.parentElement.getBoundingClientRect();
      const W = Math.max(0, Number(bounds.width) || 0), H = Math.max(0, Number(bounds.height) || 0);
      const data = options.getData() || {}, settings = config(data), palette = PALETTES[settings.chartTheme];
      if (W < 220 || H < 160) { blank(W, H, palette, 'Expand the chart to view prices.'); return; }
      const candles = Array.isArray(data.candles) ? data.candles : [];
      const cursor = Number.isInteger(data.cursor) ? Math.min(data.cursor, candles.length - 1) : -1;
      const length = cursor + 1;
      if (length < 1) { blank(W, H, palette, 'Load historical candles to begin.'); return; }
      if (pendingTrend && pendingTrend.time > candles[cursor].time) cancelDrawing();
      const count = Math.min(visible, length);
      offset = clamp(offset, 0, Math.max(0, length - count));
      const end = cursor - offset, start = Math.max(0, end - count + 1);
      // No subsequent candle is inspected, including for indicators or scale.
      const bars = candles.slice(start, end + 1);
      const daily = data.timeframe === '1d' || data.instrument?.timeframe === '1d';
      const tickVolume = data.volumeKind === 'ticks', volumeLabel = tickVolume ? 'Tick volume' : 'Volume';
      const compact = W < 620, singleRow = W >= 880, short = H < 260;
      const top = compact ? (short ? 78 : 96) : singleRow ? (short ? 35 : 56) : (short ? 58 : 78);
      const bottom = daily ? 38 : 52;
      const volumeH = settings.showVolume && !short ? Math.max(34, Math.min(90, H * 0.17)) : 0;
      const volumeGap = volumeH ? 20 : 0;
      let highest = Math.max(...bars.map(bar => bar.high)), lowest = Math.min(...bars.map(bar => bar.low));
      const range = Math.max(highest - lowest, Math.abs(highest) * 0.002, 1e-12);
      highest += range * 0.12;
      lowest = Math.max(0, lowest - range * 0.12);
      if (highest <= lowest) highest = lowest + 1e-12;
      if (!autoScale) {
        if (!manualScale) manualScale = { low: lowest, high: highest };
        highest = manualScale.high; lowest = manualScale.low;
      }
      const longest = Math.max(price(highest).length, price(lowest).length);
      const right = clamp(longest * 8.2 + 22, 92, Math.min(155, W * 0.4));
      const left = 16, plotWidth = W - left - right, plotHeight = H - top - bottom - volumeH - volumeGap;
      if (plotWidth < 55 || plotHeight < 30) { blank(W, H, palette, 'Expand the chart to view prices.'); return; }
      const plotRight = W - right, plotBottom = top + plotHeight, volumeBottom = H - bottom;
      const step = plotWidth / bars.length;
      const x = i => left + (i + 0.5) * step;
      const y = value => top + (highest - value) / (highest - lowest) * plotHeight;
      geometry = { W, H, left, right, top, width: plotWidth, height: plotHeight, plotRight, plotBottom, start, end, cursor, step, highest, lowest, times: bars.map(bar => bar.time),
        priceAt: py => highest - (clamp(py, top, plotBottom) - top) / plotHeight * (highest - lowest) };
      drawingHits = []; markerHits = [];
      let hovered = null;
      if (mouse && mouse.x >= left && mouse.x <= plotRight && mouse.y >= top && mouse.y <= volumeBottom) hovered = clamp(Math.floor((mouse.x - left) / step), 0, bars.length - 1);
      const selected = hovered === null ? bars[bars.length - 1] : bars[hovered];
      const selectedIndex = hovered === null ? end : start + hovered;
      const tickCount = Math.min(bars.length, Math.max(2, Math.floor(plotWidth / 160) + 1));
      const ticks = Array.from({ length: tickCount }, (_, i) => tickCount === 1 ? 0 : Math.round(i * (bars.length - 1) / (tickCount - 1)));
      const axisRows = plotHeight >= 220 ? 5 : plotHeight >= 110 ? 4 : 2;
      const parts = [];
      const text = (tx, ty, value, attributes = '') => `<text x="${coordinate(tx)}" y="${coordinate(ty)}" ${attributes}>${escape(value)}</text>`;
      const path = (d, stroke, attributes = '') => `<path d="${d}" fill="none" stroke="${stroke}" vector-effect="non-scaling-stroke" ${attributes}/>`;
      const line = (x1, y1, x2, y2, stroke, attributes = '') => `<line x1="${coordinate(x1)}" y1="${coordinate(y1)}" x2="${coordinate(x2)}" y2="${coordinate(y2)}" stroke="${stroke}" vector-effect="non-scaling-stroke" ${attributes}/>`;
      const title = `Historical ${settings.chartType === 'line' ? 'closing prices' : 'OHLC prices'} through ${fullTime(candles[cursor].time, daily)}, New York. Future candles are hidden.`;
      const instructions = 'Focus the chart: plus or minus zooms time; left or right pans; Home shows the oldest revealed bars; End returns to the replay cursor. Drag or scroll the price axis to scale prices; double-click that axis or press 0 to restore auto scale. Alt plus or minus scales prices and Alt up or down shifts them. Drawing tools: arrows move the point, Enter places it, and Escape cancels. A trendline needs two different bar times. Press D to select a drawing, then Delete to remove it.';
      const description = `${title} Latest open ${price(candles[cursor].open)}, high ${price(candles[cursor].high)}, low ${price(candles[cursor].low)}, close ${price(candles[cursor].close)}. ${instructions} ${settings.sessionShading && !daily ? 'US-hours shading is a weekday 09:30–16:00 New York reference, without holidays or early closes.' : ''}`;
      element.setAttribute('viewBox', `0 0 ${coordinate(W)} ${coordinate(H)}`);
      element.setAttribute('aria-label', description + ` Active tool: ${tool}. Price scale: ${autoScale ? 'automatic' : 'manual'}.` + (pendingTrend ? ' Trendline first point placed; choose a different bar for its second point.' : '') + (selectedDrawing !== null ? ' A drawing is selected; Delete removes it.' : ''));
      element.setAttribute('data-renderer', 'svg');
      element.setAttribute('data-chart-theme', settings.chartTheme);
      element.setAttribute('data-chart-type', settings.chartType);
      element.setAttribute('data-chart-tool', tool);
      element.setAttribute('data-autoscale', String(autoScale));
      parts.push(`<title>${escape(title)}</title><desc>${escape(instructions)}</desc><defs><clipPath id="${id}-price"><rect x="${left}" y="${top}" width="${coordinate(plotWidth)}" height="${coordinate(plotHeight)}"/></clipPath><clipPath id="${id}-volume"><rect x="${left}" y="${coordinate(volumeBottom - volumeH)}" width="${coordinate(plotWidth)}" height="${coordinate(volumeH)}"/></clipPath></defs>`);
      parts.push(`<g font-family="Inter,ui-sans-serif,system-ui,sans-serif" fill="${palette.text}" pointer-events="none"><rect width="${coordinate(W)}" height="${coordinate(H)}" fill="${palette.background}"/>`);

      // New York session shading is deliberately a reference, not an exchange
      // holiday calendar. It never runs on daily bars.
      if (settings.sessionShading && !daily) {
        let blockStart = null;
        for (let i = 0; i <= bars.length; i++) {
          const active = i < bars.length && regularHours(bars[i].time);
          if (active && blockStart === null) blockStart = i;
          if (!active && blockStart !== null) {
            parts.push(`<rect data-session-reference="true" data-start-time="${bars[blockStart].time}" data-end-time="${bars[i - 1].time}" x="${coordinate(left + blockStart * step)}" y="${top}" width="${coordinate((i - blockStart) * step)}" height="${coordinate(volumeBottom - top)}" fill="${palette.session}"><title>US hours reference: weekdays 09:30–16:00 New York. Holidays and early closes are not modeled.</title></rect>`);
            blockStart = null;
          }
        }
      }
      for (let i = 0; i < axisRows; i++) {
        const py = top + i * plotHeight / (axisRows - 1), value = highest - i * (highest - lowest) / (axisRows - 1);
        if (settings.showGrid) parts.push(line(left, py, plotRight, py, palette.grid, 'data-grid="price" stroke-width="1"'));
        parts.push(text(plotRight + 12, py + 5, price(value), `data-price-axis="true" fill="${palette.text}" font-family="ui-monospace,SFMono-Regular,Consolas,monospace" font-size="14"`));
      }
      for (const i of ticks) {
        const px = x(i), anchor = i === 0 ? 'start' : i === bars.length - 1 ? 'end' : 'middle';
        const tx = i === 0 ? left : i === bars.length - 1 ? plotRight : px;
        if (settings.showGrid) parts.push(line(px, top, px, volumeBottom, palette.grid, 'data-grid="time" stroke-width="1"'));
        parts.push(text(tx, H - (daily ? 13 : 28), daily ? shortDate(bars[i].time) : clock(bars[i].time), `data-time-axis="true" fill="${palette.text}" font-size="14" text-anchor="${anchor}"`));
        if (!daily) parts.push(text(tx, H - 10, shortDate(bars[i].time), `fill="${palette.muted}" font-size="12" text-anchor="${anchor}"`));
      }
      parts.push(line(plotRight + 1, top, plotRight + 1, volumeBottom, palette.axis, 'stroke-width="1"'));
      parts.push(line(left, volumeBottom + 1, plotRight, volumeBottom + 1, palette.axis, 'stroke-width="1"'));
      parts.push(text(plotRight + right / 2, H - 17, 'New York', `fill="${palette.muted}" font-size="12" text-anchor="middle"`));
      parts.push(`<g data-price-series="${settings.chartType}" data-scale-high="${highest}" data-scale-low="${lowest}" clip-path="url(#${id}-price)">`);
      if (settings.chartType === 'line') {
        const d = bars.map((bar, i) => `${i ? 'L' : 'M'}${coordinate(x(i))},${coordinate(y(bar.close))}`).join(' ');
        parts.push(path(d, settings.bullColor, `data-series="line" data-start-index="${start}" data-end-index="${end}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"`));
        if (bars.length === 1) parts.push(`<circle cx="${coordinate(x(0))}" cy="${coordinate(y(bars[0].close))}" r="3" fill="${settings.bullColor}"/>`);
      } else {
        for (let i = 0; i < bars.length; i++) {
          const bar = bars[i], up = bar.close >= bar.open, shade = up ? settings.bullColor : settings.bearColor;
          const px = x(i), bodyWidth = Math.max(1.6, Math.min(20, step * 0.7));
          const wick = !up && settings.chartTheme === 'dark' ? palette.bearOutline : shade;
          parts.push(`<g data-candle-index="${start + i}" data-time="${bar.time}" data-direction="${up ? 'bull' : 'bear'}">`);
          if (Number.isInteger(data.highlightIndex) && data.highlightIndex === start + i) {
            const highlightWidth = Math.max(9, Math.min(30, step * 0.9));
            parts.push(`<rect data-study-candle="${start + i}" x="${coordinate(px - highlightWidth / 2)}" y="${coordinate(y(bar.high) - 6)}" width="${coordinate(highlightWidth)}" height="${coordinate(Math.max(12, y(bar.low) - y(bar.high) + 12))}" rx="3" fill="${settings.bullColor}" fill-opacity=".08" stroke="${settings.bullColor}" stroke-width="1.6" stroke-dasharray="3 2" vector-effect="non-scaling-stroke"><title>Study candle: ${escape(fullTime(bar.time, daily))}</title></rect>`);
          }
          parts.push(line(px, y(bar.high), px, y(bar.low), wick, 'stroke-width="1.5"'));
          if (settings.chartType === 'bars') {
            const arm = Math.max(2, Math.min(8, step * 0.34));
            parts.push(path(`M${coordinate(px - arm)},${coordinate(y(bar.open))}H${coordinate(px)}M${coordinate(px)},${coordinate(y(bar.close))}H${coordinate(px + arm)}`, wick, 'data-series="bar" stroke-width="1.8" stroke-linecap="square"'));
          } else {
            const bodyTop = y(Math.max(bar.open, bar.close));
            parts.push(`<rect data-series="candle" x="${coordinate(px - bodyWidth / 2)}" y="${coordinate(bodyTop)}" width="${coordinate(bodyWidth)}" height="${coordinate(Math.max(2, Math.abs(y(bar.open) - y(bar.close))))}" fill="${shade}" stroke="${wick}" stroke-width="1.1" vector-effect="non-scaling-stroke"/>`);
          }
          parts.push('</g>');
        }
      }

      if (settings.ema) {
        for (const [period, shade] of [[9, palette.ema9], [21, palette.ema21]]) {
          const alpha = 2 / (period + 1);
          let value = candles[0].close, d = '';
          for (let i = 0; i <= end; i++) {
            if (i) value = candles[i].close * alpha + value * (1 - alpha);
            if (i >= start) d += `${i === start ? 'M' : 'L'}${coordinate(x(i - start))},${coordinate(y(value))} `;
          }
          parts.push(path(d.trim(), shade, `data-indicator="ema${period}" data-through-index="${end}" stroke-width="1.8" stroke-linejoin="round"`));
        }
      }
      if (settings.vwap && !daily && !tickVolume) {
        let key = '', sumPriceVolume = 0, sumVolume = 0, drawingDay = '', d = '';
        for (let i = 0; i <= end; i++) {
          const bar = candles[i], nextKey = dayKey(bar.time);
          if (nextKey !== key) { key = nextKey; sumPriceVolume = 0; sumVolume = 0; }
          sumPriceVolume += (bar.high + bar.low + bar.close) / 3 * bar.volume;
          sumVolume += bar.volume;
          if (i >= start && sumVolume > 0) {
            const command = !d || drawingDay !== key ? 'M' : 'L';
            d += `${command}${coordinate(x(i - start))},${coordinate(y(sumPriceVolume / sumVolume))} `;
            drawingDay = key;
          }
        }
        if (d) parts.push(path(d.trim(), palette.vwap, `data-indicator="vwap" data-through-index="${end}" stroke-width="2" stroke-dasharray="5 3" stroke-linejoin="round"`));
      }
      parts.push('</g>');

      if (volumeH) {
        const maximum = Math.max(...bars.map(bar => bar.volume), 1), bodyWidth = Math.max(1.6, Math.min(20, step * 0.7));
        parts.push(`<g data-volume-series="true" clip-path="url(#${id}-volume)">`);
        for (let i = 0; i < bars.length; i++) {
          const bar = bars[i], height = Math.max(0, bar.volume / maximum * (volumeH - 9));
          parts.push(`<rect data-volume-index="${start + i}" x="${coordinate(x(i) - bodyWidth / 2)}" y="${coordinate(volumeBottom - height)}" width="${coordinate(bodyWidth)}" height="${coordinate(height)}" fill="${bar.close >= bar.open ? settings.bullColor : settings.bearColor}" opacity="${settings.chartTheme === 'dark' ? 0.7 : 0.38}"/>`);
        }
        parts.push('</g>');
        parts.push(text(left + 2, volumeBottom - volumeH - 5, volumeLabel, `fill="${palette.muted}" font-size="12"`));
        parts.push(text(plotRight + 12, volumeBottom - volumeH + 14, volume(maximum), `fill="${palette.muted}" font-size="12"`));
      }
      function priceLine(value, label, shade, kind) {
        if (!Number.isFinite(value) || value <= 0) return;
        const py = y(value);
        if (py < top || py > plotBottom) return;
        parts.push(line(left, py, plotRight, py, shade, `data-price-line="${kind}" stroke-width="1.2" stroke-dasharray="6 5"`));
        if (label) {
          const labelY = clamp(py - 20, top + 2, plotBottom - 21);
          parts.push(`<rect x="${left + 5}" y="${coordinate(labelY)}" width="${label.length * 7.2 + 14}" height="19" rx="3" fill="${palette.background}" fill-opacity=".95"/>` + text(left + 12, labelY + 14, label, `fill="${shade}" font-size="12" font-weight="600"`));
        }
      }
      // Time lookup is deliberately bounded by cursor, including when a
      // saved drawing or trade contains a timestamp after this replay point.
      function revealedIndex(time, exactIndex) {
        if (!Number.isFinite(time) || time < candles[0].time || time > candles[cursor].time) return null;
        if (Number.isInteger(exactIndex)) {
          if (exactIndex < 0 || exactIndex > cursor) return null;
          if (candles[exactIndex].time === time) return exactIndex;
        }
        let low = 0, high = cursor;
        while (low <= high) {
          const middle = (low + high) >> 1;
          if (candles[middle].time <= time) low = middle + 1;
          else high = middle - 1;
        }
        return high;
      }
      function anchorPoint(anchor) {
        if (!anchor) return null;
        const index = revealedIndex(anchor.time);
        if (index === null) return null;
        // Check the timestamp before reading the price of an unrevealed anchor.
        const value = anchor.price;
        return Number.isFinite(value) && value > 0 ? { x: x(index - start), y: y(value), index, time: anchor.time, price: value } : null;
      }
      function drawingHandle(at, shade) {
        return `<circle data-drawing-handle="true" cx="${coordinate(at.x)}" cy="${coordinate(at.y)}" r="4.5" fill="${palette.background}" stroke="${shade}" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
      }
      const drawings = Array.isArray(data.drawings) ? data.drawings : [];
      if (selectedDrawing !== null && !drawings.some(item => item && String(item.id) === selectedDrawing)) selectDrawing(null);
      parts.push(`<g data-drawings="true" clip-path="url(#${id}-price)">`);
      for (const drawing of drawings) {
        if (!drawing || drawing.id == null) continue;
        const drawingId = String(drawing.id), active = drawingId === selectedDrawing;
        const shade = color(drawing.color, settings.bullColor), weight = active ? 2.5 : 1.6;
        if (drawing.type === 'horizontal') {
          if (!Number.isFinite(drawing.price) || drawing.price <= 0) continue;
          const py = y(drawing.price);
          if (py < top || py > plotBottom) continue;
          parts.push(`<g data-drawing-id="${escape(drawingId)}" data-drawing-type="horizontal" data-selected="${active}"><title>Horizontal level at ${escape(price(drawing.price))}${active ? ', selected. Press Delete to remove.' : ''}</title>`);
          parts.push(line(left, py, plotRight, py, shade, `stroke-width="${weight}"`));
          parts.push(text(left + 8, clamp(py - 7, top + 15, plotBottom - 5), price(drawing.price), `fill="${shade}" font-size="12" font-weight="600" paint-order="stroke" stroke="${palette.background}" stroke-width="4" stroke-linejoin="round"`));
          if (active) parts.push(drawingHandle({ x: left + plotWidth / 2, y: py }, shade));
          parts.push('</g>');
          drawingHits.push({ id: drawingId, type: 'horizontal', from: { x: left, y: py }, to: { x: plotRight, y: py }, label: 'Horizontal level ' + price(drawing.price) });
        } else if(['fib','rectangle','measure'].includes(drawing.type)){
          if(!drawing.from||!drawing.to||revealedIndex(drawing.from.time)===null||revealedIndex(drawing.to.time)===null)continue;
          const from=anchorPoint(drawing.from),to=anchorPoint(drawing.to);if(!from||!to||from.time===to.time)continue;
          const x1=Math.min(from.x,to.x),x2=Math.max(from.x,to.x),y1=Math.min(from.y,to.y),y2=Math.max(from.y,to.y);
          parts.push(`<g data-drawing-id="${escape(drawingId)}" data-drawing-type="${drawing.type}" data-selected="${active}">`);
          if(drawing.type==='rectangle'){
            parts.push(`<rect x="${coordinate(x1)}" y="${coordinate(y1)}" width="${coordinate(x2-x1)}" height="${coordinate(y2-y1)}" fill="${shade}" fill-opacity=".08" stroke="${shade}" stroke-width="${weight}"/>`);
            for(const [a,b] of [[{x:x1,y:y1},{x:x2,y:y1}],[{x:x2,y:y1},{x:x2,y:y2}],[{x:x2,y:y2},{x:x1,y:y2}],[{x:x1,y:y2},{x:x1,y:y1}]])drawingHits.push({id:drawingId,type:drawing.type,from:a,to:b,label:'Price zone '+price(Math.min(from.price,to.price))+'–'+price(Math.max(from.price,to.price))});
          }else if(drawing.type==='fib'){
            for(const ratio of [0,.236,.382,.5,.618,.786,1]){
              const value=to.price+(from.price-to.price)*ratio,py=y(value),label=(ratio*100).toFixed(1)+'% · '+price(value);
              parts.push(line(x1,py,x2,py,shade,`stroke-width="${ratio===.5?weight+.4:weight}" stroke-opacity="${ratio===0||ratio===1?1:.7}"`));
              parts.push(text(x1+5,py-5,label,`fill="${shade}" font-size="12" paint-order="stroke" stroke="${palette.background}" stroke-width="3"`));
              drawingHits.push({id:drawingId,type:drawing.type,from:{x:x1,y:py},to:{x:x2,y:py},label:'Fibonacci reference '+label});
            }
          }else{
            const change=to.price-from.price,changePct=change/from.price*100,barCount=Math.abs(to.index-from.index),label=(change>=0?'+':'')+price(change)+' ('+(changePct>=0?'+':'')+changePct.toFixed(2)+'%) · '+barCount+' bars';
            parts.push(line(from.x,from.y,to.x,to.y,shade,`stroke-width="${weight}" stroke-dasharray="5 3"`));
            parts.push(text(clamp((from.x+to.x)/2,left+120,plotRight-120),clamp((from.y+to.y)/2-12,top+16,plotBottom-8),label,`fill="${shade}" font-size="13" font-weight="650" text-anchor="middle" paint-order="stroke" stroke="${palette.background}" stroke-width="4"`));
            drawingHits.push({id:drawingId,type:drawing.type,from,to,label:'Measurement '+label});
          }
          if(active)parts.push(drawingHandle(from,shade),drawingHandle(to,shade));parts.push('</g>');
        } else if (drawing.type === 'trendline') {
          // Do not show a line at an earlier replay point when either endpoint
          // depends on a bar that has not been revealed yet.
          if (!drawing.from || !drawing.to || revealedIndex(drawing.from.time) === null || revealedIndex(drawing.to.time) === null) continue;
          const from = anchorPoint(drawing.from), to = anchorPoint(drawing.to);
          if (!from || !to || from.time === to.time) continue;
          const label = `Trendline: ${fullTime(from.time, daily)} at ${price(from.price)} to ${fullTime(to.time, daily)} at ${price(to.price)}`;
          parts.push(`<g data-drawing-id="${escape(drawingId)}" data-drawing-type="trendline" data-selected="${active}" data-from-time="${from.time}" data-to-time="${to.time}"><title>${escape(label)}</title>`);
          parts.push(line(from.x, from.y, to.x, to.y, shade, `stroke-width="${weight}" stroke-linecap="round"`));
          if (active) parts.push(drawingHandle(from, shade), drawingHandle(to, shade));
          parts.push('</g>');
          drawingHits.push({ id: drawingId, type: 'trendline', from, to, label });
        }
      }
      if (['trendline','fib','rectangle','measure'].includes(tool) && pendingTrend) {
        const from = anchorPoint(pendingTrend), to = anchorPoint(currentAnchor());
        if (from) {
          if (to) parts.push(line(from.x, from.y, to.x, to.y, palette.entry, 'data-drawing-preview="trendline" stroke-width="1.6" stroke-dasharray="5 4"'));
          parts.push(drawingHandle(from, palette.entry));
          if (to) parts.push(drawingHandle(to, palette.entry));
        }
      }
      parts.push('</g>');
      for (const level of data.levels || []) priceLine(level, 'Level ' + price(level), palette.level, 'level');
      const visiblePosition = data.position && (!Number.isFinite(data.position.entryTime) || revealedIndex(data.position.entryTime, data.position.entryBarIndex) !== null);
      if (visiblePosition) {
        priceLine(data.position.entryPrice, 'Entry ' + price(data.position.entryPrice), palette.entry, 'entry');
        priceLine(data.position.stop, 'Stop ' + price(data.position.stop), palette.stop, 'stop');
        priceLine(data.position.target, 'Target ' + price(data.position.target), palette.target, 'target');
      }
      const pendingOrders=Array.isArray(data.pendingOrders)?data.pendingOrders:[];
      for(const order of pendingOrders){
        if(!order||!Number.isFinite(order.submittedTime)||order.submittedTime>candles[cursor].time)continue;
        priceLine(order.orderPrice,(order.side==='long'?'Buy ':'Sell ')+order.type+' · '+price(order.orderPrice),palette.level,'pending-'+order.type);
      }
      const last = bars[bars.length - 1], lastY = y(last.close), lastShade = last.close >= last.open ? settings.bullColor : settings.bearColor;
      priceLine(last.close, '', lastShade, 'last');
      if (lastY >= top && lastY <= plotBottom) {
        const labelY = clamp(lastY - 13, top, plotBottom - 26);
        parts.push(`<rect data-last-price="true" x="${coordinate(plotRight + 3)}" y="${coordinate(labelY)}" width="${coordinate(right - 7)}" height="26" rx="3" fill="${lastShade}"/>`);
        parts.push(text(plotRight + right / 2, labelY + 18, price(last.close), `data-last-price-text="true" fill="${contrastText(lastShade)}" font-family="ui-monospace,SFMono-Regular,Consolas,monospace" font-size="14" font-weight="650" text-anchor="middle"`));
      }

      // An entry can be visible while its exit is not. Filter each event before
      // accessing fill price, side, result or text; none affects the y scale.
      const labeledLanes = new Set();
      function tradeMarker(trade, kind, fallbackId) {
        const time = trade[kind + 'Time'];
        if (!Number.isFinite(time) || time > candles[cursor].time) return;
        const index = revealedIndex(time, trade[kind + 'BarIndex']);
        if (index === null || index < start || index > end) return;
        const value = trade[kind + 'Price'];
        if (!Number.isFinite(value) || value <= 0) return;
        const py = y(value);
        if (py < top || py > plotBottom) return;
        const isEntry = kind === 'entry', isLong = trade.side !== 'short';
        const upward = isEntry ? isLong : !isLong, direction = upward ? 1 : -1;
        const shade = isEntry ? settings.bullColor : palette.text;
        const titleLabel = isEntry ? (isLong ? 'Long entry' : 'Short entry') : 'Exit';
        const label = (isEntry ? (isLong ? 'LONG' : 'SHORT') : 'EXIT') + ' ' + price(value);
        const laneKey = index + ':' + direction;
        const px = x(index - start), labelX = clamp(px, left + 46, plotRight - 46);
        const labelY = clamp(py + direction * 29, top + 12, plotBottom - 6);
        const eventId = trade.id == null ? fallbackId : String(trade.id);
        const detail = titleLabel + ' at ' + price(value) + ' · ' + fullTime(time, daily) + ' · New York';
        parts.push(`<g data-trade-marker="${kind}" data-trade-id="${escape(eventId)}" data-event-time="${time}" data-event-index="${index}" data-price="${value}"><title>${escape(detail)}</title>`);
        parts.push(`<path d="M${coordinate(px)},${coordinate(py)}l-5,${direction * 9}h3v${direction * 9}h4v${-direction * 9}h3Z" fill="${shade}" stroke="${palette.background}" stroke-width="1" vector-effect="non-scaling-stroke"/>`);
        if (!labeledLanes.has(laneKey)) {
          parts.push(text(labelX, labelY, label, `data-trade-label="true" fill="${shade}" font-size="11" font-weight="700" text-anchor="middle" paint-order="stroke" stroke="${palette.background}" stroke-width="4" stroke-linejoin="round"`));
          labeledLanes.add(laneKey);
        }
        parts.push('</g>');
        markerHits.push({ x: px, y: py + direction * 10, label: detail });
      }
      parts.push(`<g data-trade-markers="true" clip-path="url(#${id}-price)">`);
      if (settings.showTrades) {
        if (visiblePosition) tradeMarker(data.position, 'entry', 'open-position');
        const trades = Array.isArray(data.trades) ? data.trades : [];
        for (let index = trades.length - 1; index >= 0; index--) {
          const trade = trades[index];
          if (!trade || !Number.isFinite(trade.entryTime) || trade.entryTime > candles[cursor].time) continue;
          tradeMarker(trade, 'entry', 'trade-' + index);
          tradeMarker(trade, 'exit', 'trade-' + index);
        }
      }
      parts.push('</g>');

      if(visiblePosition&&plotWidth>360&&Number.isFinite(data.position.qty)){
        const p=data.position,py=y(p.entryPrice),mark=candles[cursor].close,gross=(p.side==='long'?1:-1)*(mark-p.entryPrice)*p.qty;
        if(py>=top&&py<=plotBottom){
          const cy=clamp(py-14,top+1,plotBottom-29),cx=plotRight-310;
          const result=(gross>=0?'+':'')+gross.toLocaleString('en-US',{style:'currency',currency:'USD'});
          const label=(p.side==='long'?'Long ':'Short ')+p.qty.toLocaleString('en-US',{maximumFractionDigits:6})+' · '+result;
          parts.push(`<g data-position-pnl="true"><rect x="${coordinate(cx)}" y="${coordinate(cy)}" width="250" height="28" rx="3" fill="${palette.background}" stroke="${palette.entry}"/>`+text(cx+10,cy+19,label,`fill="${gross>=0?settings.bullColor:palette.stop}" font-size="14" font-weight="650"`)+`<title>Open mark-to-market P&amp;L before exit costs</title></g>`);
          if(typeof options.onTradeAction==='function'){
            for(const [action,dx,label,aria] of [['manage',252,'⋯','Manage open position'],['close',281,'×','Close open position']])parts.push(`<g class="chart-trade-control" data-trade-action="${action}" pointer-events="all" role="button" tabindex="0" aria-label="${aria}"><rect x="${coordinate(cx+dx)}" y="${coordinate(cy)}" width="28" height="28" rx="3" fill="${palette.background}" stroke="${palette.entry}"/>`+text(cx+dx+14,cy+19,label,`fill="${palette.text}" font-size="17" text-anchor="middle"`)+`<title>${aria}</title></g>`);
          }
        }
      }

      if (crosshair && settings.crosshair && tool !== 'cursor' && hovered !== null) {
        const px = x(hovered);
        parts.push(line(px, top, px, volumeBottom, palette.crosshair, 'data-crosshair="vertical" stroke-width="1" stroke-dasharray="4 4"'));
        if (mouse.y <= plotBottom) {
          parts.push(line(left, mouse.y, plotRight, mouse.y, palette.crosshair, 'data-crosshair="horizontal" stroke-width="1" stroke-dasharray="4 4"'));
          const labelY = clamp(mouse.y - 12, top, plotBottom - 24);
          parts.push(`<rect x="${coordinate(plotRight + 3)}" y="${coordinate(labelY)}" width="${coordinate(right - 7)}" height="24" rx="3" fill="${palette.marker}"/>`);
          parts.push(text(plotRight + right / 2, labelY + 17, price(geometry.priceAt(mouse.y)), `fill="${palette.text}" font-family="ui-monospace,monospace" font-size="14" text-anchor="middle"`));
        }
        const timeLabel = daily ? (root.ReplayTime ? root.ReplayTime.format(selected.time, { dateOnly: true }) : fallbackDate.format(new Date(selected.time * 1000))) : shortDate(selected.time) + ' ' + clock(selected.time) + ' ' + timeParts(selected.time).zoneName;
        const labelWidth = Math.min(plotWidth, timeLabel.length * 6.5 + 16), labelX = clamp(px - labelWidth / 2, left, plotRight - labelWidth);
        parts.push(`<rect data-crosshair="time" x="${coordinate(labelX)}" y="${coordinate(volumeBottom + 3)}" width="${coordinate(labelWidth)}" height="24" rx="3" fill="${palette.marker}"/>`);
        parts.push(text(labelX + labelWidth / 2, volumeBottom + 20, timeLabel, `fill="${palette.text}" font-size="12" font-weight="550" text-anchor="middle"`));
      }
      if (tool === 'horizontal' && keyboardPrice !== null) priceLine(keyboardPrice, 'Enter to mark ' + price(keyboardPrice), palette.entry, 'level-preview');
      if (['trendline','fib','rectangle','measure'].includes(tool)) {
        parts.push(text(left + 8, top + 17, pendingTrend ? 'Choose a second bar · Enter to place · Esc cancels' : 'Choose the first point · Arrow keys + Enter also work', `data-drawing-hint="true" fill="${palette.entry}" font-size="11" paint-order="stroke" stroke="${palette.background}" stroke-width="4" stroke-linejoin="round"`));
      }

      // The header is a persistent OHLC readout, not a screenshot or scaled
      // bitmap. Hover changes the selected bar without changing the replay.
      parts.push(`<g data-ohlc-header="true" data-selected-index="${selectedIndex}">`);
      const dateLabel = fullTime(selected.time, daily);
      const dateWidth = Math.min(310, dateLabel.length * 6.6 + 22);
      parts.push(text(left, 21, dateLabel, `fill="${palette.muted}" font-size="${compact ? 12 : 13}" font-weight="550"`));
      const fields = [['O', selected.open, 'open'], ['H', selected.high, 'high'], ['L', selected.low, 'low'], ['C', selected.close, 'close']];
      fields.forEach(([label, value, name], i) => {
        const tx = compact ? left + (i % 2) * (W - 32) / 2 : singleRow ? left + dateWidth + i * (W - dateWidth - 38) / 4 : left + i * Math.min(155, (W - 32) / 4);
        const ty = compact ? 43 + Math.floor(i / 2) * 22 : singleRow ? 21 : 44;
        parts.push(text(tx, ty, label, `fill="${palette.muted}" font-size="14"`));
        parts.push(text(tx + 21, ty, price(value), `data-ohlc="${name}" fill="${name === 'close' && selected.close >= selected.open ? settings.bullColor : palette.text}" font-family="ui-monospace,SFMono-Regular,Consolas,monospace" font-size="14" font-weight="650"`));
      });
      if (!short) {
        const legend = [];
        if (settings.sessionShading && !daily) legend.push(['US hours reference', palette.muted]);
        if (settings.ema) legend.push(['EMA 9', palette.ema9], ['EMA 21', palette.ema21]);
        if (settings.vwap) legend.push([tickVolume ? 'VWAP unavailable with tick volume' : daily ? 'VWAP needs intraday bars' : 'VWAP · loaded NY day', palette.vwap]);
        if (offset) legend.push(['Earlier view', palette.muted]);
        if (!autoScale) legend.push(['Manual price scale · 0 resets', palette.muted]);
        let legendX = left;
        const legendY = compact ? 86 : singleRow ? 44 : 66;
        for (const [label, shade] of legend) {
          const labelWidth = label.length * 6.5 + 20;
          if (legendX + labelWidth > W - 12) break;
          parts.push(text(legendX, legendY, label, `fill="${shade}" font-size="12" font-weight="550"`));
          legendX += labelWidth;
        }
      }
      parts.push('</g></g>');
      element.innerHTML = parts.join('');
      if (hovered !== null && tooltip) {
        const marker = markerHits.find(hit => Math.hypot(hit.x - mouse.x, hit.y - mouse.y) <= 15);
        const drawing = hitDrawing(mouse);
        tooltip.textContent = marker ? marker.label : drawing ? drawing.label : fullTime(selected.time, daily) + ' · New York\nO ' + price(selected.open) + '   H ' + price(selected.high) + '   L ' + price(selected.low) + '   C ' + price(selected.close) + (tickVolume ? '   Ticks ' : '   Vol ') + volume(selected.volume);
        // On narrow charts the persistent SVG header is the full hover readout;
        // a second floating box would cover most of the price action.
        tooltip.hidden = W < 660;
        if (tooltip.style) {
          tooltip.style.left = '18px'; tooltip.style.top = 'auto'; tooltip.style.bottom = (bottom + 10) + 'px';
          tooltip.style.fontSize = '13px'; tooltip.style.whiteSpace = 'pre-line';
        }
      } else hideTooltip();
    }

    function point(event) {
      const bounds = element.getBoundingClientRect();
      if (!geometry || !bounds.width || !bounds.height) return null;
      return { x: (event.clientX - bounds.left) * geometry.W / bounds.width, y: (event.clientY - bounds.top) * geometry.H / bounds.height };
    }
    function insidePlot(at) {
      return !!(at && geometry && at.x >= geometry.left && at.x <= geometry.plotRight && at.y >= geometry.top && at.y <= geometry.plotBottom);
    }
    function onPriceAxis(at) {
      return !!(at && geometry && at.x > geometry.plotRight && at.x <= geometry.W && at.y >= geometry.top && at.y <= geometry.plotBottom);
    }
    function hitDrawing(at) {
      if (!insidePlot(at)) return null;
      for (let i = drawingHits.length - 1; i >= 0; i--) {
        const hit = drawingHits[i], dx = hit.to.x - hit.from.x, dy = hit.to.y - hit.from.y;
        const length = dx * dx + dy * dy;
        const ratio = length ? clamp(((at.x - hit.from.x) * dx + (at.y - hit.from.y) * dy) / length, 0, 1) : 0;
        if (Math.hypot(at.x - hit.from.x - ratio * dx, at.y - hit.from.y - ratio * dy) <= 8) return hit;
      }
      return null;
    }
    function anchorAt(at) {
      if (!insidePlot(at)) return null;
      const index = clamp(Math.floor((at.x - geometry.left) / geometry.step), 0, geometry.times.length - 1);
      return { time: geometry.times[index], price: geometry.priceAt(at.y) };
    }
    function currentAnchor() {
      if (!geometry) return null;
      if (keyboardIndex !== null || keyboardPrice !== null || !insidePlot(mouse)) {
        const index = clamp(keyboardIndex === null ? geometry.end : keyboardIndex, geometry.start, geometry.end);
        const bar = options.getData()?.candles?.[index];
        return bar ? { time: bar.time, price: keyboardPrice === null ? bar.close : keyboardPrice } : null;
      }
      return anchorAt(mouse);
    }
    function placePoint(anchor) {
      if (!anchor || !Number.isFinite(anchor.price) || anchor.price <= 0) return;
      if (tool === 'horizontal') {
        if (typeof options.onDrawing === 'function') options.onDrawing({ type: 'horizontal', price: anchor.price });
        else if (typeof options.onLevel === 'function') options.onLevel(anchor.price);
      } else if (['trendline','fib','rectangle','measure'].includes(tool)) {
        if (!pendingTrend) pendingTrend = { time: anchor.time, price: anchor.price };
        else if (pendingTrend.time !== anchor.time) {
          const completed = { type: tool, from: { ...pendingTrend }, to: { time: anchor.time, price: anchor.price } };
          pendingTrend = null;
          if (typeof options.onDrawing === 'function') options.onDrawing(completed);
        }
      }
      redraw();
    }
    function pointer(event) {
      if(event.target?.closest?.('[data-trade-action]')){element.style.cursor='pointer';return;}
      const at = point(event);
      if (!at) return;
      if (drag && event.pointerId != null && event.pointerId !== drag.pointerId) return;
      mouse = at; keyboardPrice = null; keyboardIndex = null;
      if (drag && geometry) {
        drag.moved = drag.moved || Math.hypot(at.x - drag.x, at.y - drag.y) > 4;
        if (drag.kind === 'scale') {
          const middle = (drag.high + drag.low) / 2, span = (drag.high - drag.low) * Math.exp(clamp((at.y - drag.y) * 0.008, -4, 4));
          manualRange(middle - span / 2, middle + span / 2);
        } else {
          offset = clamp(drag.offset + Math.round((at.x - drag.x) / drag.step), 0, geometry.cursor);
          if (!autoScale) {
            const shift = (at.y - drag.y) / drag.height * (drag.high - drag.low);
            manualRange(drag.low + shift, drag.high + shift);
          }
        }
      }
      element.style.cursor = drag ? (drag.kind === 'scale' ? 'ns-resize' : 'grabbing') : onPriceAxis(at) ? 'ns-resize' : tool === 'cursor' ? (hitDrawing(at) ? 'pointer' : 'grab') : 'crosshair';
      redraw();
    }
    function down(event) {
      if(event.target?.closest?.('[data-trade-action]'))return;
      if (event.button != null && event.button !== 0) return;
      const at = point(event);
      if (!insidePlot(at) && !onPriceAxis(at)) return;
      if (press && event.pointerId != null && press.pointerId !== event.pointerId) return;
      event.preventDefault();
      if (typeof element.focus === 'function') element.focus({ preventScroll: true });
      mouse = at; keyboardPrice = null; keyboardIndex = null;
      press = { ...at, pointerId: event.pointerId };
      if (onPriceAxis(at) || !drawingMode()) {
        drag = { kind: onPriceAxis(at) ? 'scale' : 'pan', x: at.x, y: at.y, pointerId: event.pointerId, offset, step: geometry.step, height: geometry.height, high: geometry.highest, low: geometry.lowest, moved: false };
        if (drag.kind === 'scale') setAutoscale(false);
      }
      if (element.setPointerCapture) element.setPointerCapture(event.pointerId);
    }
    function up(event) {
      if(event.target?.closest?.('[data-trade-action]'))return;
      if (press && event.pointerId != null && press.pointerId !== event.pointerId) return;
      const at = point(event);
      const click = press && at && Math.hypot(at.x - press.x, at.y - press.y) <= 8 && !(drag && drag.moved);
      const wasScale = drag && drag.kind === 'scale';
      drag = null; press = null;
      if (click && !wasScale && insidePlot(at)) {
        if (drawingMode()) { selectDrawing(null); placePoint(anchorAt(at)); }
        else selectDrawing(hitDrawing(at)?.id ?? null);
      }
      if (element.hasPointerCapture?.(event.pointerId)) element.releasePointerCapture(event.pointerId);
      element.style.cursor = onPriceAxis(at) ? 'ns-resize' : tool === 'cursor' ? 'grab' : 'crosshair';
      redraw();
    }
    function leave() { if (!drag) { mouse = null; redraw(); } }
    function cancelDrag() { drag = null; press = null; mouse = null; redraw(); }
    function wheel(event) {
      event.preventDefault();
      const at = point(event), delta = Number(event.deltaY) || 0;
      if (!delta) return;
      if (onPriceAxis(at) || event.altKey) scalePrice(Math.exp(clamp(delta * (event.deltaMode === 1 ? 0.06 : 0.002), -0.7, 0.7)), at);
      else { visible = clamp(Math.round(visible * (delta > 0 ? 1.15 : 0.87)), 20, 240); redraw(); }
    }
    function doubleClick(event) { if (onPriceAxis(point(event))) { event.preventDefault(); setAutoscale(true); } }
    function zoom(direction) { visible = clamp(Math.round(visible * (direction > 0 ? 1.25 : 0.8)), 20, 240); redraw(); }
    function keys(event) {
      if(event.target?.closest?.('[data-trade-action]')){if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation?.();tradeClick(event);}return;}
      if (event.ctrlKey || event.metaKey) return;
      if (event.key === 'Escape') { event.preventDefault(); cancelDrawing(); selectDrawing(null); }
      else if (event.key === 'Delete' || event.key === 'Backspace') { if (deleteSelected()) event.preventDefault(); }
      else if (event.key === '0') { event.preventDefault(); setAutoscale(true); }
      else if (event.key === 'd' || event.key === 'D') {
        if (drawingHits.length) { event.preventDefault(); const unique=[...new Map(drawingHits.map(hit=>[hit.id,hit])).values()];const index = unique.findIndex(hit => hit.id === selectedDrawing); selectDrawing(unique[(index + 1) % unique.length].id); redraw(); }
      }
      else if (event.key === '+' || event.key === '=') { event.preventDefault(); if (event.altKey) scalePrice(0.8); else zoom(-1); }
      else if (event.key === '-') { event.preventDefault(); if (event.altKey) scalePrice(1.25); else zoom(1); }
      else if (event.altKey && geometry && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        event.preventDefault();
        const shift = (geometry.highest - geometry.lowest) * (event.key === 'ArrowUp' ? 0.1 : -0.1);
        manualRange(geometry.lowest + shift, geometry.highest + shift);
      }
      else if (drawingMode() && geometry && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
        const anchor = currentAnchor(), data = options.getData();
        if (!anchor) return;
        if (keyboardIndex === null) keyboardIndex = insidePlot(mouse) ? geometry.start + clamp(Math.floor((mouse.x - geometry.left) / geometry.step), 0, geometry.times.length - 1) : geometry.end;
        if (keyboardPrice === null) keyboardPrice = anchor.price;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') keyboardIndex = clamp(keyboardIndex + (event.key === 'ArrowLeft' ? -1 : 1), geometry.start, geometry.end);
        else keyboardPrice = clamp(keyboardPrice + (event.key === 'ArrowUp' ? 1 : -1) * (geometry.highest - geometry.lowest) / 40, Math.max(geometry.lowest, Number.MIN_VALUE), geometry.highest);
        if (!data.candles?.[keyboardIndex]) keyboardIndex = geometry.end;
        mouse = { x: geometry.left + (keyboardIndex - geometry.start + 0.5) * geometry.step, y: geometry.top + (geometry.highest - keyboardPrice) / (geometry.highest - geometry.lowest) * geometry.height };
        redraw();
      }
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        if (geometry) offset = clamp(offset + (event.key === 'ArrowLeft' ? 1 : -1) * Math.max(1, Math.floor(visible / 10)), 0, geometry.cursor);
        mouse = null; redraw();
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault(); offset = event.key === 'End' ? 0 : Math.max(0, options.getData()?.cursor || 0); mouse = null; redraw();
      } else if (drawingMode() && event.key === 'Enter') {
        event.preventDefault();
        if (geometry) {
          // The first keyboard action starts at the last visible close instead
          // of reusing a stale mouse point from an earlier drawing.
          if (keyboardIndex === null && keyboardPrice === null) { keyboardIndex = geometry.end; keyboardPrice = options.getData()?.candles?.[geometry.end]?.close ?? null; }
          placePoint(currentAnchor());
        }
      }
    }
    function tradeClick(event){const button=event.target?.closest?.('[data-trade-action]');if(!button||typeof options.onTradeAction!=='function')return;const action=button.getAttribute('data-trade-action');if(action==='manage'||action==='close'){event.preventDefault();options.onTradeAction(action);}}
    const listeners = { click:tradeClick,pointermove: pointer, pointerdown: down, pointerup: up, pointerleave: leave, pointercancel: cancelDrag, lostpointercapture: cancelDrag, wheel, dblclick: doubleClick, keydown: keys };
    for (const [name, handler] of Object.entries(listeners)) element.addEventListener(name, handler, name === 'wheel' ? { passive: false } : undefined);
    const Observer = root.ResizeObserver || (typeof ResizeObserver === 'function' ? ResizeObserver : null);
    const observer = Observer ? new Observer(redraw) : null;
    if (observer) observer.observe(element.parentElement);
    else if (root.addEventListener) root.addEventListener('resize', redraw);
    return {
      draw: redraw, zoom, setTool, setAutoscale, cancelDrawing, deleteSelected,
      getScaleState() { return { auto: autoScale, low: geometry?.lowest ?? null, high: geometry?.highest ?? null }; },
      resetPriceScale() { setAutoscale(true); },
      reset() { visible = 80; offset = 0; mouse = null; drag = null; press = null; cancelDrawing(); selectDrawing(null); setAutoscale(true); },
      latest() { offset = 0; mouse = null; redraw(); },
      setLevelMode(value) { setTool(value ? 'horizontal' : 'crosshair'); },
      setCrosshair(value) { crosshair = !!value; redraw(); },
      destroy() {
        disposed = true;
        if (frame) caf(frame);
        frame = 0;
        if (observer) observer.disconnect();
        else if (root.removeEventListener) root.removeEventListener('resize', redraw);
        for (const [name, handler] of Object.entries(listeners)) element.removeEventListener(name, handler);
        hideTooltip();
      }
    };
  }
  root.ReplayChart = Object.freeze({ create, defaults: DEFAULTS });
})(typeof window !== 'undefined' ? window : globalThis);
