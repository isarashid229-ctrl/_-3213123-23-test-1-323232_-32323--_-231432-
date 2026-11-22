/* ReplayLab simulation core. No network, real orders, or dependencies.
 * Account balance includes realized P&L and fees already paid. Opening a paper
 * position reserves exposure, not cash: equity = balance + mark-to-market P&L.
 * Both long and short exposure are capped at 1x equity including the entry fee.
 * Historical OHLC bars cannot establish intrabar order. A bar touching both a
 * stop and target exits at the stop unless the opening price already resolves
 * the order. Stop gaps fill at the open; target gaps receive the target price.
 * Protective orders activate only after the entry bar. Prices receive adverse
 * slippage and fees on market/protective fills; entry limits cap adverse prices.
 * Manual partial closes allocate original entry costs and risk proportionally.
 * This model does not simulate liquidity, a fill queue, or borrow costs.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ReplayEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DEFAULT_FEE = 0.0004;
  const DEFAULT_SLIPPAGE = 0.0002;
  const EPSILON = 1e-8;
  const MAX_EVENTS = 10000;
  const INTERNAL = Symbol('internal execution');
  const MODEL_NOTE = 'Historical OHLC simulation, not an order book. One position or pending entry, at most 1× equity. Pending entries activate on a later bar; a touched limit is assumed filled with no queue or liquidity model. Limit fills respect the limit; stop gaps use the opening price plus adverse slippage. Protective exits begin after the entry bar. Gaps that make an entry exceed exposure/risk limits or invalidate its brackets reject and cancel that entry. Intrabar order, partial liquidity, borrow, funding and liquidation are not modeled.';

  function finite(value, name, options) {
    const empty = value === null || value === undefined || (typeof value === 'string' && !value.trim());
    if (empty || typeof value === 'boolean' || (typeof value !== 'number' && typeof value !== 'string')) throw new Error(name + ' must be a number.');
    if (typeof value === 'string' && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) throw new Error(name + ' must be a decimal number.');
    const n = Number(value);
    if (!Number.isFinite(n)) throw new Error(name + ' must be a finite number.');
    if (options && options.positive && n <= 0) throw new Error(name + ' must be greater than zero.');
    if (options && options.nonnegative && n < 0) throw new Error(name + ' cannot be negative.');
    return n;
  }

  function rate(value, fallback, name) {
    const n = value === undefined ? fallback : finite(value, name, { nonnegative: true });
    if (n >= 1) throw new Error(name + ' must be less than 100%.');
    return n;
  }

  function index(value) {
    const n = finite(value, 'Bar index', { nonnegative: true });
    if (!Number.isSafeInteger(n)) throw new Error('Bar index must be a nonnegative integer.');
    return n;
  }

  function sideValue(value) {
    if (value !== 'long' && value !== 'short') throw new Error('Side must be long or short.');
    return value;
  }

  function timeValue(value) {
    if (typeof value === 'number' || (typeof value === 'string' && /^[+-]?\d+(?:\.\d+)?$/.test(value.trim()))) {
      let n = finite(value, 'Timestamp', { nonnegative: true });
      if (n >= 100000000000) n /= 1000;
      if (!Number.isFinite(new Date(n * 1000).getTime())) throw new Error('Timestamp is outside the supported date range.');
      return Math.floor(n);
    }
    if (typeof value !== 'string') throw new Error('Use a Unix timestamp or an ISO date for time.');
    const s = value.trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:?\d{2})?)?$/.exec(s);
    if (!m) throw new Error('Use Unix seconds/milliseconds or ISO dates, such as 2026-03-01T12:00:00Z. ISO times without a timezone use UTC.');
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    const h = Number(m[4] || 0), min = Number(m[5] || 0), sec = Number(m[6] || 0);
    const calendar = new Date(0);
    calendar.setUTCFullYear(y, mo - 1, d);
    calendar.setUTCHours(h, min, sec, 0);
    if (mo < 1 || mo > 12 || d < 1 || calendar.getUTCFullYear() !== y || calendar.getUTCMonth() !== mo - 1 || calendar.getUTCDate() !== d || h > 23 || min > 59 || sec > 59) throw new Error('Invalid calendar date or time: ' + s + '.');
    const normalized = m[4] ? s.replace(' ', 'T') + (m[8] ? '' : 'Z') : s + 'T00:00:00Z';
    const parsed = Date.parse(normalized);
    if (!Number.isFinite(parsed) || parsed < 0) throw new Error('Invalid timestamp: ' + s + '.');
    return Math.floor(parsed / 1000);
  }

  function candleValue(input, label) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(label + ': expected a candle object.');
    try {
      const candle = {
        time: timeValue(input.time),
        open: finite(input.open, 'Open', { positive: true }),
        high: finite(input.high, 'High', { positive: true }),
        low: finite(input.low, 'Low', { positive: true }),
        close: finite(input.close, 'Close', { positive: true }),
        volume: input.volume === undefined || input.volume === null || input.volume === '' ? 0 : finite(input.volume, 'Volume', { nonnegative: true })
      };
      if (candle.low > Math.min(candle.open, candle.close) || candle.high < Math.max(candle.open, candle.close) || candle.low > candle.high) throw new Error('OHLC values are inconsistent: low must be at or below open/close, and high at or above them.');
      return candle;
    } catch (err) {
      throw new Error(label + ': ' + err.message);
    }
  }

  function normalizeCandles(input) {
    if (!Array.isArray(input) || !input.length) throw new Error('No candles were supplied.');
    const result = input.map((candle, i) => candleValue(candle, 'Candle ' + (i + 1))).sort((a, b) => a.time - b.time);
    const unique = [];
    for (const candle of result) {
      const previous = unique[unique.length - 1];
      if (previous && previous.time === candle.time) {
        if (['open', 'high', 'low', 'close', 'volume'].some(key => previous[key] !== candle[key])) throw new Error('Conflicting candles share timestamp ' + candle.time + '. Remove or reconcile the duplicate rows.');
      } else unique.push(candle);
    }
    return unique;
  }

  function csvRows(text, delimiter) {
    const rows = [];
    let cells = [], cell = '', quoted = false, closed = false, line = 1, rowLine = 1;
    const endCell = () => { cells.push(cell.trim()); cell = ''; closed = false; };
    const endRow = () => { endCell(); if (cells.some(v => v !== '')) rows.push({ cells: cells, line: rowLine }); cells = []; rowLine = line + 1; };
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"') {
          if (text[i + 1] === '"') { cell += '"'; i++; }
          else { quoted = false; closed = true; }
        } else {
          cell += ch;
          if (ch === '\n') line++;
        }
      } else if (ch === '"') {
        if (cell.trim() || closed) throw new Error('CSV row ' + line + ': unexpected quote.');
        quoted = true;
      } else if (ch === delimiter) endCell();
      else if (ch === '\n' || ch === '\r') {
        endRow();
        if (ch === '\r' && text[i + 1] === '\n') i++;
        line++;
        rowLine = line;
      } else {
        if (closed && ch.trim()) throw new Error('CSV row ' + line + ': text follows a closing quote.');
        cell += ch;
      }
    }
    if (quoted) throw new Error('CSV row ' + rowLine + ': a quoted field was not closed.');
    if (cell.length || cells.length) endRow();
    return rows;
  }

  function parseCSV(input, options = {}) {
    if (typeof input !== 'string' || !input.trim()) throw new Error('The CSV file is empty.');
    const text = input.replace(/^\uFEFF/, '');
    let firstLine = text.split(/\r?\n/, 1)[0], inQuote = false, commas = 0, semicolons = 0;
    for (let i = 0; i < firstLine.length; i++) {
      if (firstLine[i] === '"') inQuote = !inQuote;
      else if (!inQuote && firstLine[i] === ',') commas++;
      else if (!inQuote && firstLine[i] === ';') semicolons++;
    }
    const rows = csvRows(text, semicolons > commas ? ';' : ',');
    if (rows.length < 2) throw new Error('Include a header and at least one OHLC candle.');
    const headers = rows[0].cells.map(v => v.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const aliases = {
      time: ['time', 'date', 'datetime', 'timestamp', 'opentime', 'openingtime', 'unix', 'unixseconds'],
      open: ['open', 'opening', 'openprice'], high: ['high', 'highprice'],
      low: ['low', 'lowprice'], close: ['close', 'closing', 'closeprice', 'last'],
      volume: ['volume', 'vol', 'basevolume']
    };
    const columns = {};
    for (const field of Object.keys(aliases)) {
      const matching = headers.map((h, i) => aliases[field].includes(h) ? i : -1).filter(i => i >= 0);
      if (matching.length > 1) throw new Error('The CSV has more than one ' + field + ' column. Keep a single unambiguous column.');
      if (!matching.length && field !== 'volume') throw new Error('Missing ' + field + ' column. Required headers: time, open, high, low, close. Volume is optional.');
      columns[field] = matching.length ? matching[0] : -1;
    }
    const candles = rows.slice(1).map(row => {
      if (row.cells.length !== headers.length) throw new Error('CSV row ' + row.line + ': expected ' + headers.length + ' fields but found ' + row.cells.length + '.');
      const data = {};
      for (const field of Object.keys(columns)) data[field] = columns[field] < 0 ? 0 : row.cells[columns[field]];
      if (typeof options.dateOnlyToTime === 'function' && /^\d{4}-\d{2}-\d{2}$/.test(data.time)) data.time = options.dateOnlyToTime(data.time);
      return candleValue(data, 'CSV row ' + row.line);
    });
    return normalizeCandles(candles);
  }

  function createAccount(initialBalance, options) {
    const balance = finite(initialBalance === undefined ? 100000 : initialBalance, 'Starting balance', { positive: true });
    options = options || {};
    return { initialBalance: balance, balance: balance, feeRate: rate(options.feeRate, DEFAULT_FEE, 'Fee rate'), slippageRate: rate(options.slippageRate, DEFAULT_SLIPPAGE, 'Slippage rate'), position: null, trades: [], pendingOrders: [], executionVersion: 2, events: [] };
  }

  const safeText = (value, max) => typeof value === 'string' ? value.slice(0, max) : '';
  const safeTags = value => Array.isArray(value) ? value.filter(t => typeof t === 'string').map(t => t.slice(0, 80)).slice(0, 20) : [];
  const absent = value => value === undefined || value === null || (typeof value === 'string' && !value.trim());

  function openEvent(p) {
    return { kind: 'open', side: p.side, qty: p.qty, price: p.entryReferencePrice, time: p.entryTime, barIndex: p.entryBarIndex, stop: p.stop, target: p.target, riskBudget: null, plan: safeText(p.plan, 4000), tags: safeTags(p.tags) };
  }
  function legacyEvents(account) {
    const extended = p => p && (p.partial || p.initialQty !== undefined && p.initialQty !== p.qty || p.entryOrderType && p.entryOrderType !== 'market' || p.initialStop !== undefined && p.initialStop !== p.stop || p.initialTarget !== undefined && p.initialTarget !== p.target);
    if ((account.pendingOrders || []).length || account.trades.some(extended) || extended(account.position)) throw new Error('This account uses extended executions but its execution ledger is missing.');
    const events = [];
    for (const t of account.trades) {
      events.push(openEvent(t));
      events.push({ kind: 'close', qty: t.qty, price: t.exitReferencePrice, time: t.exitTime, barIndex: t.exitBarIndex, reason: safeText(t.exitReason, 80) || 'manual', ambiguous: t.ambiguous === true, gap: t.gap === true });
    }
    if (account.position) events.push(openEvent(account.position));
    return events;
  }
  function ledgerBefore(account, reservedEvents = 0) {
    if (account.executionVersion !== undefined && account.executionVersion !== 2) throw new Error('Unsupported paper execution version.');
    const events = account.executionVersion === 2 ? account.events : legacyEvents(account);
    if (!Array.isArray(events) || events.length + 1 + reservedEvents > MAX_EVENTS) throw new Error('The execution ledger is invalid or has reached its 10,000 events limit. Close or cancel the current position/order, export this session and start another.');
    return events.slice();
  }
  function record(account, before, event) {
    account.executionVersion = 2; account.events = before.concat(event);
    if (!Array.isArray(account.pendingOrders)) account.pendingOrders = [];
  }
  function stamp(account, options, label) {
    const time = timeValue(options.time), barIndex = index(options.barIndex);
    const last = account.events?.[account.events.length - 1];
    if (last && (barIndex < last.barIndex || time < last.time)) throw new Error('An execution cannot occur before the previous execution. Start a fresh replay to rewind.');
    const active = account.position || account.pendingOrders?.[0];
    if (active) {
      const at = Math.max(active.entryBarIndex ?? active.submittedBarIndex, active.lastProcessedBarIndex || 0);
      if (barIndex < at || time < (active.entryTime ?? active.submittedTime)) throw new Error(label + ' cannot occur before the current position or order cursor.');
    }
    return { time, barIndex };
  }

  function accountValue(account) {
    if (!account || !Array.isArray(account.trades)) throw new Error('Invalid paper account.');
    if (typeof account.balance !== 'number' || typeof account.feeRate !== 'number' || typeof account.slippageRate !== 'number') throw new Error('Invalid paper account numeric fields.');
    finite(account.balance, 'Account balance');
    rate(account.feeRate, DEFAULT_FEE, 'Fee rate');
    rate(account.slippageRate, DEFAULT_SLIPPAGE, 'Slippage rate');
    return account;
  }

  function equity(account, mark) {
    accountValue(account);
    if (!account.position) return account.balance;
    const price = finite(mark, 'Mark price', { positive: true });
    const p = account.position;
    const result = account.balance + (p.side === 'long' ? 1 : -1) * p.qty * (price - p.entryPrice);
    if (!Number.isFinite(result)) throw new Error('Marked equity is outside the supported numeric range.');
    return result;
  }

  function optionalPrice(value, name) {
    return absent(value) ? null : finite(value, name, { positive: true });
  }

  function calculations(side, reference, stop, fee, slip, override) {
    const direction = side === 'long' ? 1 : -1;
    const entryFill = override === undefined ? reference * (1 + direction * slip) : override;
    if (!Number.isFinite(entryFill) || entryFill <= 0) throw new Error('Entry fill is outside the supported price range.');
    let stopFill = null, riskPerUnit = null;
    if (stop !== null) {
      if (direction * (entryFill - stop) <= 0) throw new Error('A long stop must be below the entry fill; a short stop must be above it.');
      stopFill = stop * (1 - direction * slip);
      riskPerUnit = direction * (entryFill - stopFill) + fee * (entryFill + stopFill);
      if (!Number.isFinite(riskPerUnit) || riskPerUnit <= 0) throw new Error('Planned stop risk must be positive and finite.');
    }
    return { direction: direction, entryFill: entryFill, stopFill: stopFill, riskPerUnit: riskPerUnit };
  }

  function sizePosition(options) {
    options = options || {};
    const balance = finite(options.equity, 'Equity', { positive: true });
    const reference = finite(options.entry, 'Entry price', { positive: true });
    const stop = finite(options.stop, 'Stop price', { positive: true });
    const side = sideValue(options.side === undefined ? 'long' : options.side);
    const riskPct = finite(options.riskPct, 'Risk percent', { positive: true });
    if (riskPct > 100) throw new Error('Risk percent cannot exceed 100%.');
    const fee = rate(options.feeRate, DEFAULT_FEE, 'Fee rate');
    const slip = rate(options.slippageRate, DEFAULT_SLIPPAGE, 'Slippage rate');
    const orderType = options.orderType === undefined ? 'market' : options.orderType;
    if (!['market', 'limit', 'stop'].includes(orderType)) throw new Error('Order type must be market, limit or stop.');
    // Entry is the chosen limit/trigger for a pending order. A limit cannot
    // receive a worse entry price; its protective stop still incurs slippage.
    const calc = calculations(side, reference, stop, fee, slip, orderType === 'limit' ? reference : undefined);
    const riskBudget = balance * riskPct / 100;
    const maxQty = balance / (calc.entryFill * (1 + fee));
    const riskQty = riskBudget / calc.riskPerUnit;
    const rawQty = Math.min(maxQty, riskQty);
    const qty = Math.floor(rawQty * 1e8) / 1e8;
    if (!Number.isFinite(qty) || qty <= 0) throw new Error('This risk budget produces a quantity below 0.00000001. Increase the budget or use a lower-priced instrument.');
    return { qty: qty, risk: qty * calc.riskPerUnit, notional: qty * calc.entryFill, entryFee: qty * calc.entryFill * fee, riskBudget: riskBudget, riskPerUnit: calc.riskPerUnit, entryFill: calc.entryFill, stopFill: calc.stopFill, capped: maxQty < riskQty, maxQty: maxQty };
  }

  function openPosition(account, options) {
    accountValue(account);
    if (account.position) throw new Error('Close the current paper position before opening another.');
    if (account.pendingOrders?.length) throw new Error('Cancel the pending entry before opening a market position.');
    if (account.balance <= 0) throw new Error('The paper account has no equity available. Start a new session to continue.');
    options = options || {};
    const before = options[INTERNAL] ? null : ledgerBefore(account, 1);
    const side = sideValue(options.side);
    const qty = finite(options.qty, 'Quantity', { positive: true });
    const reference = finite(options.price, 'Entry price', { positive: true });
    const { time, barIndex } = stamp(account, options, 'An entry');
    const stop = optionalPrice(options.stop, 'Stop price');
    const target = optionalPrice(options.target, 'Target price');
    const orderType = options[INTERNAL] ? options.entryOrderType || 'market' : 'market';
    const orderPrice = orderType === 'market' ? null : finite(options.entryOrderPrice, 'Entry order price', { positive: true });
    const direction = side === 'long' ? 1 : -1;
    const adverseFill = reference * (1 + direction * account.slippageRate);
    const limitFill = orderType === 'limit' ? (side === 'long' ? Math.min(orderPrice, adverseFill) : Math.max(orderPrice, adverseFill)) : undefined;
    const calc = calculations(side, reference, stop, account.feeRate, account.slippageRate, limitFill);
    if (target !== null && calc.direction * (target - calc.entryFill) <= 0) throw new Error('A long target must be above the entry fill; a short target must be below it.');
    const notional = qty * calc.entryFill;
    const entryFee = notional * account.feeRate;
    if (!Number.isFinite(notional + entryFee)) throw new Error('Position size is outside the supported numeric range.');
    if (notional + entryFee > account.balance + EPSILON) throw new Error('Position exceeds the 1× equity limit, including the entry fee. Reduce the quantity.');
    const plannedRisk = calc.riskPerUnit === null ? null : qty * calc.riskPerUnit;
    const budget = absent(options.riskBudget) ? null : finite(options.riskBudget, 'Risk budget', { positive: true });
    if (budget !== null) {
      if (plannedRisk === null) throw new Error('A stop is required to enforce a risk budget.');
      if (plannedRisk > budget + EPSILON) throw new Error('Planned loss including costs exceeds the risk budget. Reduce the quantity or review the stop.');
    }
    const position = {
      id: String(time) + '-' + String(account.trades.length + 1), side: side, qty: qty,
      entryPrice: calc.entryFill, entryReferencePrice: reference, entryTime: time, entryBarIndex: barIndex,
      stop: stop, target: target, entryFee: entryFee, plannedRisk: plannedRisk,
      initialQty: qty, initialEntryFee: entryFee, initialPlannedRisk: plannedRisk, initialStop: stop, initialTarget: target,
      entryOrderType: orderType, entryOrderPrice: orderPrice, entryOrderId: options[INTERNAL] ? safeText(options.entryOrderId, 120) : '',
      realizedPnl: 0, exitCount: 0,
      plan: safeText(options.plan, 4000), tags: safeTags(options.tags),
      lastProcessedBarIndex: barIndex
    };
    account.balance -= entryFee;
    account.position = position;
    if (before) record(account, before, { kind: 'open', side, qty, price: reference, time, barIndex, stop, target, riskBudget: budget, plan: position.plan, tags: position.tags.slice() });
    return position;
  }

  // Undefined fields retain an existing level; null/blank removes it. Levels
  // are checked against the current mark so a stop can lock in an open gain.
  // The original entry risk is never rewritten by a protection edit.
  function modifyPosition(account, options = {}) {
    accountValue(account);
    if (!account.position) throw new Error('There is no open paper position to modify.');
    const before = ledgerBefore(account, 1), p = account.position;
    const price = finite(options.price, 'Current price', { positive: true });
    const { time, barIndex } = stamp(account, options, 'A protection change');
    const stop = options.stop === undefined ? p.stop : optionalPrice(options.stop, 'Stop price');
    const target = options.target === undefined ? p.target : optionalPrice(options.target, 'Target price');
    const direction = p.side === 'long' ? 1 : -1;
    if (stop !== null && direction * (price - stop) <= 0) throw new Error('The stop must be ' + (direction === 1 ? 'below' : 'above') + ' the current revealed price.');
    if (target !== null && direction * (target - price) <= 0) throw new Error('The target must be ' + (direction === 1 ? 'above' : 'below') + ' the current revealed price.');
    p.stop = stop; p.target = target; p.lastProcessedBarIndex = barIndex;
    record(account, before, { kind: 'modify', stop, target, price, time, barIndex });
    return p;
  }

  function closePosition(account, options) {
    accountValue(account);
    if (!account.position) throw new Error('There is no open paper position.');
    options = options || {};
    const before = ledgerBefore(account), p = account.position;
    const reference = finite(options.price, 'Exit price', { positive: true });
    const time = timeValue(options.time), barIndex = index(options.barIndex);
    if (barIndex < p.entryBarIndex || time < p.entryTime) throw new Error('An exit cannot occur before its entry.');
    stamp(account, options, 'An exit');
    const direction = p.side === 'long' ? 1 : -1;
    let qty = absent(options.qty) ? p.qty : finite(options.qty, 'Close quantity', { positive: true });
    const tolerance = Number.EPSILON * 8 * Math.max(qty, p.qty);
    if (qty > p.qty + tolerance) throw new Error('Close quantity exceeds the open position.');
    const partial = p.qty - qty > tolerance;
    // Keep the final ledger slot available for a complete close. An account
    // must never become impossible to flatten merely by reaching its bound.
    if (partial && before.length + 2 > MAX_EVENTS) throw new Error('The execution ledger is near its 10,000 events limit. Close the full remaining position and start another session.');
    if (!partial) qty = p.qty;
    const fraction = qty / p.qty, entryFee = partial ? p.entryFee * fraction : p.entryFee;
    const plannedRisk = p.plannedRisk === null ? null : partial ? p.plannedRisk * fraction : p.plannedRisk;
    const fill = reference * (1 - direction * account.slippageRate);
    const exitFee = qty * fill * account.feeRate;
    const gross = direction * qty * (fill - p.entryPrice);
    const net = gross - entryFee - exitFee;
    const nextBalance = account.balance + gross - exitFee;
    if (![fill, exitFee, gross, net, nextBalance].every(Number.isFinite) || fill <= 0) throw new Error('Exit is outside the supported numeric range.');
    const exitCount = (p.exitCount || 0) + 1, remainingQty = partial ? p.qty - qty : 0;
    const trade = Object.assign({}, p, {
      id: partial || p.exitCount ? p.id + ':' + exitCount : p.id, positionId: p.id,
      qty, entryFee, plannedRisk, partial, positionClosed: !partial, remainingQty,
      positionRealizedPnl: (p.realizedPnl || 0) + net,
      exitPrice: fill, exitReferencePrice: reference, exitTime: time, exitBarIndex: barIndex,
      exitReason: typeof options.reason === 'string' ? options.reason.slice(0, 80) : 'manual',
      ambiguous: options.ambiguous === true, gap: options.gap === true,
      grossPnl: gross, exitFee: exitFee, fees: entryFee + exitFee, netPnl: net,
      rMultiple: plannedRisk === null ? null : net / plannedRisk,
      barsHeld: barIndex - p.entryBarIndex,
      notes: '', followedPlan: null, mistake: ''
    });
    delete trade.lastProcessedBarIndex;
    delete trade.realizedPnl; delete trade.exitCount;
    trade.tags = safeTags(p.tags);
    account.balance = nextBalance;
    if (partial) {
      account.position = Object.assign({}, p, { qty: remainingQty, entryFee: p.entryFee - entryFee, plannedRisk: p.plannedRisk === null ? null : p.plannedRisk - plannedRisk, realizedPnl: trade.positionRealizedPnl, exitCount, lastProcessedBarIndex: barIndex, tags: safeTags(p.tags) });
    } else account.position = null;
    account.trades.push(trade);
    record(account, before, { kind: 'close', qty, price: reference, time, barIndex, reason: trade.exitReason, ambiguous: trade.ambiguous, gap: trade.gap });
    return trade;
  }

  function processCandle(account, input, barIndex) {
    accountValue(account);
    if (!account.position) return null;
    const p = account.position;
    const at = index(barIndex);
    if (at <= Math.max(p.entryBarIndex, p.lastProcessedBarIndex || 0)) return null;
    const candle = candleValue(input, 'Replay candle');
    if (candle.time < p.entryTime) throw new Error('Cannot process a candle dated before the position entry.');
    const long = p.side === 'long';
    const stopGap = p.stop !== null && (long ? candle.open <= p.stop : candle.open >= p.stop);
    const targetGap = p.target !== null && (long ? candle.open >= p.target : candle.open <= p.target);
    const stopped = p.stop !== null && (long ? candle.low <= p.stop : candle.high >= p.stop);
    const targeted = p.target !== null && (long ? candle.high >= p.target : candle.low <= p.target);
    let exit = null;
    if (stopGap) exit = { price: candle.open, reason: 'stop_gap', gap: true };
    else if (targetGap) exit = { price: p.target, reason: 'target_gap', gap: true };
    else if (stopped) exit = { price: p.stop, reason: targeted ? 'stop_ambiguous' : 'stop', ambiguous: targeted };
    else if (targeted) exit = { price: p.target, reason: 'target' };
    if (exit) return closePosition(account, Object.assign(exit, { time: candle.time, barIndex: at }));
    p.lastProcessedBarIndex = at;
    return null;
  }

  function pendingList(account) {
    const orders = account.pendingOrders === undefined ? [] : account.pendingOrders;
    if (!Array.isArray(orders) || orders.length > 1) throw new Error('Invalid pending-order state. Only one pending entry is supported.');
    return orders;
  }

  // Resting entries are deliberately limited to one while flat. Placement
  // does not charge a fee or deduct notional; available exposure is rechecked
  // at the actual modeled fill. A rejected gap never silently reduces quantity.
  function placeOrder(account, options = {}) {
    accountValue(account);
    if (account.position) throw new Error('Close the open position before placing a pending entry.');
    if (pendingList(account).length) throw new Error('Cancel the existing pending entry before placing another.');
    const before = ledgerBefore(account, 2), type = options.type;
    if (!['limit', 'stop'].includes(type)) throw new Error('Pending entry type must be limit or stop.');
    const side = sideValue(options.side), direction = side === 'long' ? 1 : -1;
    const price = finite(options.price, 'Current price', { positive: true });
    const orderPrice = finite(options.orderPrice, 'Entry order price', { positive: true });
    const { time, barIndex } = stamp(account, options, 'Order placement');
    if (type === 'limit' && direction * (orderPrice - price) > 0) throw new Error('A resting buy limit must be at or below the current price; a sell limit must be at or above it. Use a market order for immediate entry.');
    if (type === 'stop' && direction * (orderPrice - price) <= 0) throw new Error('A buy stop entry must be above the current price; a sell stop entry must be below it.');
    const id = 'order-' + time + '-' + (before.length + 1);
    const draft = Object.assign({}, account, { trades: account.trades.slice(), pendingOrders: [] });
    const estimate = openPosition(draft, { ...options, [INTERNAL]: true, side, price: orderPrice, time, barIndex, entryOrderType: type, entryOrderPrice: orderPrice, entryOrderId: id });
    const order = {
      id, type, side, qty: estimate.qty, orderPrice, submittedPrice: price, submittedTime: time, submittedBarIndex: barIndex, lastProcessedBarIndex: barIndex,
      stop: estimate.stop, target: estimate.target, riskBudget: absent(options.riskBudget) ? null : finite(options.riskBudget, 'Risk budget', { positive: true }),
      plan: estimate.plan, tags: estimate.tags.slice(), estimatedFill: estimate.entryPrice, estimatedRisk: estimate.plannedRisk,
      estimatedFee: estimate.entryFee, reservedNotional: estimate.qty * estimate.entryPrice + estimate.entryFee
    };
    account.pendingOrders = [order];
    record(account, before, { kind: 'place', type, side, qty: order.qty, orderPrice, price, time, barIndex, stop: order.stop, target: order.target, riskBudget: order.riskBudget, plan: order.plan, tags: order.tags.slice() });
    return order;
  }

  function cancelOrder(account, options = {}) {
    accountValue(account);
    const order = pendingList(account)[0];
    if (!order) throw new Error('There is no pending entry to cancel.');
    if (options.orderId !== undefined && options.orderId !== order.id) throw new Error('That pending entry is no longer active.');
    const before = ledgerBefore(account), { time, barIndex } = stamp(account, options, 'A cancellation');
    const reason = safeText(options.reason, 80) || 'cancelled';
    account.pendingOrders = [];
    record(account, before, { kind: 'cancel', orderId: order.id, time, barIndex, reason });
    return { ...order, status: 'cancelled', cancelledTime: time, cancelledBarIndex: barIndex, reason };
  }

  // Return execution events instead of overloading the legacy protective-exit
  // return value. One event at most: a position and pending entry cannot coexist.
  function processBar(account, input, barIndex) {
    accountValue(account);
    const order = pendingList(account)[0];
    if (account.position) {
      if (order) throw new Error('A position and pending entry cannot coexist in this execution model.');
      const trade = processCandle(account, input, barIndex);
      return trade ? [{ type: 'closed', trade, position: null, message: 'Paper position closed: ' + trade.exitReason + '.' }] : [];
    }
    if (!order) return [];
    const at = index(barIndex);
    if (at <= Math.max(order.submittedBarIndex, order.lastProcessedBarIndex)) return [];
    const candle = candleValue(input, 'Pending-order candle');
    if (candle.time <= order.submittedTime) throw new Error('A pending entry requires a candle after its submission time.');
    const long = order.side === 'long';
    const touched = order.type === 'limit' ? (long ? candle.low <= order.orderPrice : candle.high >= order.orderPrice) : (long ? candle.high >= order.orderPrice : candle.low <= order.orderPrice);
    if (!touched) { order.lastProcessedBarIndex = at; return []; }
    const before = ledgerBefore(account, 1);
    const reference = order.type === 'limit' ? (long ? Math.min(candle.open, order.orderPrice) : Math.max(candle.open, order.orderPrice)) : (long ? Math.max(candle.open, order.orderPrice) : Math.min(candle.open, order.orderPrice));
    const draft = Object.assign({}, account, { trades: account.trades.slice(), pendingOrders: [] });
    let position = null, rejection = null;
    try {
      position = openPosition(draft, { [INTERNAL]: true, side: order.side, qty: order.qty, price: reference, time: candle.time, barIndex: at, stop: order.stop, target: order.target, riskBudget: order.riskBudget, plan: order.plan, tags: order.tags, entryOrderType: order.type, entryOrderPrice: order.orderPrice, entryOrderId: order.id });
    } catch (error) { rejection = error.message; }
    account.pendingOrders = [];
    if (position) { account.balance = draft.balance; account.position = position; }
    record(account, before, { kind: 'pending_bar', orderId: order.id, candle, time: candle.time, barIndex: at, outcome: position ? 'opened' : 'rejected' });
    return position ? [{ type: 'opened', position, trade: null, order, message: 'Pending ' + order.type + ' filled. Protective exits begin on the next bar.' }] : [{ type: 'rejected', position: null, trade: null, order, reason: rejection, message: 'Pending ' + order.type + ' rejected and cancelled: ' + rejection }];
  }

  // Rebuild economic state from execution intentions, never from serialized
  // P&L, fees or fill prices. Legacy accounts are translated into open/close
  // events. New partial fills and edited protections require their event ledger.
  function restoreAccount(raw, options = {}) {
    accountValue(raw);
    if (!Array.isArray(raw.trades) || raw.trades.length > MAX_EVENTS) throw new Error('The saved trade history is invalid or too large.');
    if (typeof raw.initialBalance !== 'number' || !Number.isFinite(raw.initialBalance) || raw.initialBalance <= 0) throw new Error('The saved starting balance is invalid.');
    if (raw.trades.some(t => !t || typeof t !== 'object' || Array.isArray(t)) || raw.position && (typeof raw.position !== 'object' || Array.isArray(raw.position))) throw new Error('The saved position or trade is invalid.');
    const max = options.maxBarIndex === undefined ? Infinity : options.maxBarIndex;
    if (max !== Infinity && (!Number.isSafeInteger(max) || max < 0)) throw new Error('The maximum replay index must be a nonnegative integer.');
    if (raw.executionVersion !== undefined && raw.executionVersion !== 2) throw new Error('Unsupported saved execution version.');
    const events = raw.executionVersion === 2 ? raw.events : legacyEvents(raw);
    if (!Array.isArray(events) || events.length > MAX_EVENTS) throw new Error('The saved execution ledger is invalid or too large.');
    const account = createAccount(raw.initialBalance, { feeRate: raw.feeRate, slippageRate: raw.slippageRate });
    let priorIndex = -1, priorTime = -1;
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      if (!event || typeof event !== 'object' || Array.isArray(event)) throw new Error('Execution event ' + (i + 1) + ' is invalid.');
      const at = index(event.barIndex), when = timeValue(event.time);
      if (at < priorIndex || at > max || when < priorTime) throw new Error('The backup trade sequence is invalid or extends beyond the replay.');
      try {
        if (event.kind === 'open') openPosition(account, event);
        else if (event.kind === 'close') closePosition(account, event);
        else if (event.kind === 'modify') modifyPosition(account, event);
        else if (event.kind === 'place') placeOrder(account, event);
        else if (event.kind === 'cancel') cancelOrder(account, event);
        else if (event.kind === 'pending_bar') {
          const order = account.pendingOrders[0];
          if (!order || order.id !== event.orderId || event.candle?.time !== when || !['opened', 'rejected'].includes(event.outcome)) throw new Error('The pending-entry event is inconsistent.');
          const results = processBar(account, event.candle, at);
          if (results.length !== 1 || results[0].type !== event.outcome) throw new Error('The pending-entry outcome does not match its candle and execution rules.');
        } else throw new Error('Unknown execution event type.');
      } catch (error) { throw new Error('Execution event ' + (i + 1) + ': ' + error.message); }
      priorIndex = at; priorTime = when;
    }
    if (account.trades.length !== raw.trades.length || !!account.position !== !!raw.position) throw new Error('The saved positions or trade count do not match the execution ledger.');
    const same = (clean, saved, keys, label) => { for (const key of keys) if (saved[key] !== undefined && saved[key] !== clean[key]) throw new Error(label + ' does not match its execution ledger (' + key + ').'); };
    for (let i = 0; i < account.trades.length; i++) {
      const clean = account.trades[i], saved = raw.trades[i];
      same(clean, saved, ['side', 'qty', 'entryReferencePrice', 'entryTime', 'entryBarIndex', 'exitReferencePrice', 'exitTime', 'exitBarIndex', 'stop', 'target', 'exitReason'], 'Saved trade');
      if (raw.executionVersion === 2) same(clean, saved, ['id', 'positionId', 'partial', 'positionClosed', 'remainingQty', 'entryOrderType', 'entryOrderPrice', 'entryOrderId'], 'Saved trade');
      clean.notes = safeText(saved.notes, 2000); clean.followedPlan = typeof saved.followedPlan === 'boolean' ? saved.followedPlan : null; clean.mistake = safeText(saved.mistake, 80);
    }
    if (account.position) {
      same(account.position, raw.position, ['side', 'qty', 'entryReferencePrice', 'entryTime', 'entryBarIndex', 'stop', 'target', 'entryOrderType', 'entryOrderPrice', 'entryOrderId'], 'Saved position');
      const at = raw.position.lastProcessedBarIndex;
      if (!Number.isSafeInteger(at) || at < account.position.lastProcessedBarIndex || at > max) throw new Error('The saved position cursor is invalid.');
      account.position.lastProcessedBarIndex = at;
    }
    const savedOrders = pendingList(raw);
    if (savedOrders.length !== account.pendingOrders.length) throw new Error('The saved pending orders do not match the execution ledger.');
    if (savedOrders.length) {
      const clean = account.pendingOrders[0], saved = savedOrders[0];
      same(clean, saved, ['id', 'type', 'side', 'qty', 'orderPrice', 'submittedPrice', 'submittedTime', 'submittedBarIndex', 'stop', 'target', 'riskBudget'], 'Saved pending order');
      const at = saved.lastProcessedBarIndex;
      if (!Number.isSafeInteger(at) || at < clean.lastProcessedBarIndex || at > max) throw new Error('The saved pending-order cursor is invalid.');
      clean.lastProcessedBarIndex = at;
    }
    if (!Number.isFinite(raw.balance) || Math.abs(account.balance - raw.balance) > 0.01) throw new Error('The backup balance does not match its trades and execution ledger.');
    return account;
  }

  function stats(trades, initialBalance) {
    if (!Array.isArray(trades)) throw new Error('Trade history must be an array.');
    const initial = finite(initialBalance === undefined ? 100000 : initialBalance, 'Starting balance', { positive: true });
    let wins = 0, losses = 0, grossProfit = 0, grossLoss = 0, fees = 0, total = 0, completedNet = 0;
    let highWater = initial, running = initial, maxDrawdown = 0, maxDrawdownPct = 0;
    let rSum = 0, rCount = 0, losingStreak = 0, maxLosingStreak = 0;
    const equityCurve = [{ trade: 0, equity: initial, time: null }];
    const positions = new Map();
    for (let i = 0; i < trades.length; i++) {
      const trade = trades[i];
      const pnl = finite(trade.netPnl, 'Trade ' + (i + 1) + ' net P&L');
      total += pnl;
      if (trade.fees !== undefined) fees += finite(trade.fees, 'Trade fees', { nonnegative: true });
      const key = trade.positionId || 'legacy-row-' + i;
      const group = positions.get(key) || { net: 0, risk: 0, hasRisk: true, count: 0, complete: false, directR: null };
      group.net += pnl; group.count++; group.complete = group.complete || trade.positionClosed !== false;
      if (Number.isFinite(trade.plannedRisk) && trade.plannedRisk > 0) group.risk += trade.plannedRisk; else group.hasRisk = false;
      if (Number.isFinite(trade.rMultiple)) group.directR = trade.rMultiple;
      positions.set(key, group);
      running += pnl;
      highWater = Math.max(highWater, running);
      const drawdown = highWater - running;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
      maxDrawdownPct = Math.max(maxDrawdownPct, highWater > 0 ? drawdown / highWater * 100 : 0);
      equityCurve.push({ trade: i + 1, equity: running, time: trade.exitTime === undefined ? null : trade.exitTime });
    }
    const completed = [...positions.values()].filter(position => position.complete);
    for (const position of completed) {
      const pnl = position.net; completedNet += pnl;
      if (pnl > EPSILON) { wins++; grossProfit += pnl; losingStreak = 0; }
      else if (pnl < -EPSILON) { losses++; grossLoss -= pnl; losingStreak++; maxLosingStreak = Math.max(maxLosingStreak, losingStreak); }
      else losingStreak = 0;
      const multiple = position.hasRisk && position.risk > 0 ? pnl / position.risk : position.count === 1 ? position.directR : null;
      if (Number.isFinite(multiple)) { rSum += multiple; rCount++; }
    }
    const count = completed.length;
    return {
      totalTrades: count, closedTrades: count, wins: wins, losses: losses, breakeven: count - wins - losses,
      closedFills: trades.length, partiallyClosedPositions: positions.size - count, completedNetPnl: completedNet,
      winRate: count ? wins / count * 100 : null,
      netPnl: total, totalNetPnl: total, fees: fees,
      grossProfit: grossProfit, grossLoss: grossLoss,
      profitFactor: grossLoss > EPSILON ? grossProfit / grossLoss : grossProfit > EPSILON ? Infinity : null,
      averageWin: wins ? grossProfit / wins : null, averageLoss: losses ? grossLoss / losses : null,
      expectancy: count ? completedNet / count : null, averageNetPnl: count ? completedNet / count : null,
      averageR: rCount ? rSum / rCount : null, rTrades: rCount,
      maxDrawdown: maxDrawdown, maxDrawdownPct: maxDrawdownPct, maxLosingStreak: maxLosingStreak,
      finalEquity: running, equityCurve: equityCurve
    };
  }

  return Object.freeze({
    DEFAULT_FEE: DEFAULT_FEE, DEFAULT_SLIPPAGE: DEFAULT_SLIPPAGE, MAX_EVENTS, MODEL_NOTE,
    normalizeCandles: normalizeCandles, parseCSV: parseCSV, parseTime: timeValue,
    createAccount: createAccount, equity: equity, sizePosition: sizePosition,
    openPosition: openPosition, closePosition: closePosition, modifyPosition, placeOrder, cancelOrder,
    processCandle: processCandle, processBar, restoreAccount, stats: stats
  });
});
