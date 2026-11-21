/* ReplayLab vector chart. The host supplies validated, ascending OHLCV candles.
 * Only bars at or before the replay cursor may be read. Rendering uses SVG in
 * CSS-pixel coordinates; there is no raster backing store or DPR scaling.
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
      crosshair: input.crosshair !== false
    };
  }

  function create(element, tooltip, options) {
    if (!element || !options || typeof options.getData !== 'function') throw new Error('A chart element and data getter are required.');
    const id = 'replay-vector-' + (++chartSequence);
    const raf = root.requestAnimationFrame ? root.requestAnimationFrame.bind(root) : callback => setTimeout(callback, 16);
    const caf = root.cancelAnimationFrame ? root.cancelAnimationFrame.bind(root) : clearTimeout;
    let visible = 80, offset = 0, mouse = null, geometry = null, drag = null, press = null;
    let levelMode = false, keyboardPrice = null, crosshair = true, frame = 0, disposed = false;
    element.setAttribute('tabindex', '0');
    element.setAttribute('focusable', 'true');
    element.setAttribute('role', 'img');
    element.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    element.setAttribute('preserveAspectRatio', 'none');
    const redraw = () => {
      if (!frame && !disposed) frame = raf(() => { frame = 0; draw(); });
    };
    function hideTooltip() { if (tooltip) tooltip.hidden = true; }
    function blank(W, H, palette, message) {
      geometry = null;
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
      const count = Math.min(visible, length);
      offset = clamp(offset, 0, Math.max(0, length - count));
      const end = cursor - offset, start = Math.max(0, end - count + 1);
      // No subsequent candle is inspected, including for indicators or scale.
      const bars = candles.slice(start, end + 1);
      const daily = data.timeframe === '1d' || data.instrument?.timeframe === '1d';
      const tickVolume = data.volumeKind === 'ticks', volumeLabel = tickVolume ? 'Tick volume' : 'Volume';
      const compact = W < 660, short = H < 300;
      const top = short ? (compact ? 78 : 62) : (compact ? 112 : 82);
      const bottom = daily ? 38 : 52;
      const volumeH = settings.showVolume && !short ? Math.max(34, Math.min(90, H * 0.17)) : 0;
      const volumeGap = volumeH ? 20 : 0;
      let highest = Math.max(...bars.map(bar => bar.high)), lowest = Math.min(...bars.map(bar => bar.low));
      const range = Math.max(highest - lowest, Math.abs(highest) * 0.002, 1e-12);
      highest += range * 0.12;
      lowest = Math.max(0, lowest - range * 0.12);
      if (highest <= lowest) highest = lowest + 1e-12;
      const longest = Math.max(price(highest).length, price(lowest).length);
      const right = clamp(longest * 8.2 + 22, 92, Math.min(155, W * 0.4));
      const left = 16, plotWidth = W - left - right, plotHeight = H - top - bottom - volumeH - volumeGap;
      if (plotWidth < 55 || plotHeight < 30) { blank(W, H, palette, 'Expand the chart to view prices.'); return; }
      const plotRight = W - right, plotBottom = top + plotHeight, volumeBottom = H - bottom;
      const step = plotWidth / bars.length;
      const x = i => left + (i + 0.5) * step;
      const y = value => top + (highest - value) / (highest - lowest) * plotHeight;
      geometry = { W, H, left, right, top, width: plotWidth, height: plotHeight, plotRight, plotBottom, start, end, cursor, step, highest, lowest,
        priceAt: py => highest - (clamp(py, top, plotBottom) - top) / plotHeight * (highest - lowest) };
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
      const instructions = 'Focus the chart: plus or minus zooms; left or right pans; Home shows the oldest revealed bars; End returns to the replay cursor. In Mark level mode, up or down adjusts the marked price and Enter adds it.';
      const description = `${title} Latest open ${price(candles[cursor].open)}, high ${price(candles[cursor].high)}, low ${price(candles[cursor].low)}, close ${price(candles[cursor].close)}. ${instructions} ${settings.sessionShading && !daily ? 'US-hours shading is a weekday 09:30–16:00 New York reference, without holidays or early closes.' : ''}`;
      element.setAttribute('viewBox', `0 0 ${coordinate(W)} ${coordinate(H)}`);
      element.setAttribute('aria-label', description);
      element.setAttribute('data-renderer', 'svg');
      element.setAttribute('data-chart-theme', settings.chartTheme);
      element.setAttribute('data-chart-type', settings.chartType);
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
      for (const level of data.levels || []) priceLine(level, 'Level ' + price(level), palette.level, 'level');
      if (data.position) {
        priceLine(data.position.entryPrice, 'Entry ' + price(data.position.entryPrice), palette.entry, 'entry');
        priceLine(data.position.stop, 'Stop ' + price(data.position.stop), palette.stop, 'stop');
        priceLine(data.position.target, 'Target ' + price(data.position.target), palette.target, 'target');
      }
      const last = bars[bars.length - 1], lastY = y(last.close), lastShade = last.close >= last.open ? settings.bullColor : settings.bearColor;
      priceLine(last.close, '', lastShade, 'last');
      parts.push(`<rect data-last-price="true" x="${coordinate(plotRight + 3)}" y="${coordinate(lastY - 13)}" width="${coordinate(right - 7)}" height="26" rx="3" fill="${lastShade}"/>`);
      parts.push(text(plotRight + right / 2, lastY + 5, price(last.close), 'fill="#ffffff" font-family="ui-monospace,SFMono-Regular,Consolas,monospace" font-size="14" font-weight="650" text-anchor="middle"'));

      if (crosshair && settings.crosshair && hovered !== null) {
        const px = x(hovered);
        parts.push(line(px, top, px, volumeBottom, palette.crosshair, 'data-crosshair="vertical" stroke-width="1" stroke-dasharray="4 4"'));
        if (mouse.y <= plotBottom) {
          parts.push(line(left, mouse.y, plotRight, mouse.y, palette.crosshair, 'data-crosshair="horizontal" stroke-width="1" stroke-dasharray="4 4"'));
          parts.push(`<rect x="${coordinate(plotRight + 3)}" y="${coordinate(mouse.y - 12)}" width="${coordinate(right - 7)}" height="24" rx="3" fill="${palette.marker}"/>`);
          parts.push(text(plotRight + right / 2, mouse.y + 5, price(geometry.priceAt(mouse.y)), `fill="${palette.text}" font-family="ui-monospace,monospace" font-size="14" text-anchor="middle"`));
        }
      }
      if (levelMode && keyboardPrice !== null) priceLine(keyboardPrice, 'Enter to mark ' + price(keyboardPrice), palette.entry, 'level-preview');

      // The header is a persistent OHLC readout, not a screenshot or scaled
      // bitmap. Hover changes the selected bar without changing the replay.
      parts.push(`<g data-ohlc-header="true" data-selected-index="${selectedIndex}">`);
      parts.push(text(left, 21, fullTime(selected.time, daily) + (offset ? ' · earlier view' : ''), `fill="${palette.muted}" font-size="${compact ? 12 : 13}" font-weight="550"`));
      const fields = [['O', selected.open, 'open'], ['H', selected.high, 'high'], ['L', selected.low, 'low'], ['C', selected.close, 'close']];
      fields.forEach(([label, value, name], i) => {
        const tx = compact ? left + (i % 2) * (W - 32) / 2 : left + i * Math.min(150, (W - 32) / 4);
        const ty = compact ? 45 + Math.floor(i / 2) * 23 : 46;
        parts.push(text(tx, ty, label, `fill="${palette.muted}" font-size="14"`));
        parts.push(text(tx + 21, ty, price(value), `data-ohlc="${name}" fill="${name === 'close' && selected.close >= selected.open ? settings.bullColor : palette.text}" font-family="ui-monospace,SFMono-Regular,Consolas,monospace" font-size="14" font-weight="650"`));
      });
      if (!short) {
        const legend = [];
        if (settings.sessionShading && !daily) legend.push(['US hours reference', palette.muted]);
        if (settings.ema) legend.push(['EMA 9', palette.ema9], ['EMA 21', palette.ema21]);
        if (settings.vwap) legend.push([tickVolume ? 'VWAP unavailable with tick volume' : daily ? 'VWAP needs intraday bars' : 'VWAP · loaded NY day', palette.vwap]);
        let legendX = left;
        const legendY = compact ? 94 : 68;
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
        tooltip.textContent = fullTime(selected.time, daily) + ' · New York\nO ' + price(selected.open) + '   H ' + price(selected.high) + '   L ' + price(selected.low) + '   C ' + price(selected.close) + (tickVolume ? '   Ticks ' : '   Vol ') + volume(selected.volume);
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
    function pointer(event) {
      const at = point(event);
      if (!at) return;
      mouse = at;
      if (drag && geometry) {
        offset = clamp(drag.offset + Math.round((at.x - drag.x) / geometry.step), 0, geometry.cursor);
        drag.moved = drag.moved || Math.abs(at.x - drag.x) > 4;
      }
      redraw();
    }
    function down(event) {
      if (event.button != null && event.button !== 0) return;
      const at = point(event);
      if (!at || at.x < geometry.left || at.x > geometry.plotRight || at.y < geometry.top || at.y > geometry.plotBottom) return;
      press = at;
      if (!levelMode) drag = { x: at.x, offset, moved: false };
      if (element.setPointerCapture) element.setPointerCapture(event.pointerId);
    }
    function up(event) {
      const at = point(event);
      if (levelMode && press && at && geometry && Math.hypot(at.x - press.x, at.y - press.y) <= 8 && at.x >= geometry.left && at.x <= geometry.plotRight && at.y >= geometry.top && at.y <= geometry.plotBottom) {
        if (typeof options.onLevel === 'function') options.onLevel(geometry.priceAt(at.y));
      }
      drag = null; press = null; redraw();
    }
    function leave() { if (!drag) { mouse = null; redraw(); } }
    function cancelDrag() { drag = null; press = null; mouse = null; redraw(); }
    function wheel(event) { event.preventDefault(); visible = clamp(Math.round(visible * (event.deltaY > 0 ? 1.15 : 0.87)), 20, 240); redraw(); }
    function zoom(direction) { visible = clamp(Math.round(visible * (direction > 0 ? 1.25 : 0.8)), 20, 240); redraw(); }
    function keys(event) {
      if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(-1); }
      else if (event.key === '-') { event.preventDefault(); zoom(1); }
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        if (geometry) offset = clamp(offset + (event.key === 'ArrowLeft' ? 1 : -1) * Math.max(1, Math.floor(visible / 10)), 0, geometry.cursor);
        mouse = null; redraw();
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault(); offset = event.key === 'End' ? 0 : Math.max(0, options.getData()?.cursor || 0); mouse = null; redraw();
      } else if (levelMode && (event.key === 'ArrowUp' || event.key === 'ArrowDown') && geometry) {
        event.preventDefault();
        const data = options.getData(), current = data.candles[data.cursor];
        keyboardPrice = clamp((keyboardPrice === null ? current.close : keyboardPrice) + (event.key === 'ArrowUp' ? 1 : -1) * (geometry.highest - geometry.lowest) / 40, geometry.lowest, geometry.highest);
        redraw();
      } else if (levelMode && event.key === 'Enter') {
        event.preventDefault();
        const data = options.getData(), bar = data.candles[data.cursor];
        if (bar && typeof options.onLevel === 'function') options.onLevel(keyboardPrice === null ? bar.close : keyboardPrice);
      }
    }
    const listeners = { pointermove: pointer, pointerdown: down, pointerup: up, pointerleave: leave, pointercancel: cancelDrag, lostpointercapture: cancelDrag, wheel, keydown: keys };
    for (const [name, handler] of Object.entries(listeners)) element.addEventListener(name, handler, name === 'wheel' ? { passive: false } : undefined);
    const Observer = root.ResizeObserver || (typeof ResizeObserver === 'function' ? ResizeObserver : null);
    const observer = Observer ? new Observer(redraw) : null;
    if (observer) observer.observe(element.parentElement);
    else if (root.addEventListener) root.addEventListener('resize', redraw);
    return {
      draw: redraw, zoom,
      reset() { visible = 80; offset = 0; mouse = null; keyboardPrice = null; redraw(); },
      latest() { offset = 0; mouse = null; redraw(); },
      setLevelMode(value) { levelMode = !!value; keyboardPrice = null; element.style.cursor = levelMode ? 'crosshair' : 'grab'; redraw(); },
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
