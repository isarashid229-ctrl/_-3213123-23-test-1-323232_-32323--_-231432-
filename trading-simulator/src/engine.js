/* ReplayLab simulation core. No network, real orders, or dependencies.
 * Account balance includes realized P&L and fees already paid. Opening a paper
 * position reserves exposure, not cash: equity = balance + mark-to-market P&L.
 * Both long and short exposure are capped at 1x equity including the entry fee.
 * Historical OHLC bars cannot establish intrabar order. A bar touching both a
 * stop and target exits at the stop unless the opening price already resolves
 * the order. Stop gaps fill at the open; target gaps receive the target price.
 * Protective orders activate only after the entry bar. Prices receive adverse
 * slippage and fees on every fill, including protective fills. This deliberately
 * conservative model does not simulate liquidity, borrow costs, or partial fills.
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
    return { initialBalance: balance, balance: balance, feeRate: rate(options.feeRate, DEFAULT_FEE, 'Fee rate'), slippageRate: rate(options.slippageRate, DEFAULT_SLIPPAGE, 'Slippage rate'), position: null, trades: [] };
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
    return value === undefined || value === null || value === '' ? null : finite(value, name, { positive: true });
  }

  function calculations(side, reference, stop, fee, slip) {
    const direction = side === 'long' ? 1 : -1;
    const entryFill = reference * (1 + direction * slip);
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
    const calc = calculations(side, reference, stop, fee, slip);
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
    if (account.balance <= 0) throw new Error('The paper account has no equity available. Start a new session to continue.');
    options = options || {};
    const side = sideValue(options.side);
    const qty = finite(options.qty, 'Quantity', { positive: true });
    const reference = finite(options.price, 'Entry price', { positive: true });
    const time = timeValue(options.time);
    const barIndex = index(options.barIndex);
    const stop = optionalPrice(options.stop, 'Stop price');
    const target = optionalPrice(options.target, 'Target price');
    const calc = calculations(side, reference, stop, account.feeRate, account.slippageRate);
    if (target !== null && calc.direction * (target - calc.entryFill) <= 0) throw new Error('A long target must be above the entry fill; a short target must be below it.');
    const notional = qty * calc.entryFill;
    const entryFee = notional * account.feeRate;
    if (!Number.isFinite(notional + entryFee)) throw new Error('Position size is outside the supported numeric range.');
    if (notional + entryFee > account.balance + EPSILON) throw new Error('Position exceeds the 1× equity limit, including the entry fee. Reduce the quantity.');
    const plannedRisk = calc.riskPerUnit === null ? null : qty * calc.riskPerUnit;
    if (options.riskBudget !== undefined && options.riskBudget !== null) {
      const budget = finite(options.riskBudget, 'Risk budget', { positive: true });
      if (plannedRisk === null) throw new Error('A stop is required to enforce a risk budget.');
      if (plannedRisk > budget + EPSILON) throw new Error('Planned loss including costs exceeds the risk budget. Reduce the quantity or review the stop.');
    }
    const position = {
      id: String(time) + '-' + String(account.trades.length + 1), side: side, qty: qty,
      entryPrice: calc.entryFill, entryReferencePrice: reference, entryTime: time, entryBarIndex: barIndex,
      stop: stop, target: target, entryFee: entryFee, plannedRisk: plannedRisk,
      plan: typeof options.plan === 'string' ? options.plan.slice(0, 4000) : '',
      tags: Array.isArray(options.tags) ? options.tags.filter(t => typeof t === 'string').map(t => t.slice(0, 80)).slice(0, 20) : [],
      lastProcessedBarIndex: barIndex
    };
    account.balance -= entryFee;
    account.position = position;
    return position;
  }

  function closePosition(account, options) {
    accountValue(account);
    if (!account.position) throw new Error('There is no open paper position.');
    options = options || {};
    const p = account.position;
    const reference = finite(options.price, 'Exit price', { positive: true });
    const time = timeValue(options.time);
    const barIndex = index(options.barIndex);
    if (barIndex < p.entryBarIndex || time < p.entryTime) throw new Error('An exit cannot occur before its entry.');
    const direction = p.side === 'long' ? 1 : -1;
    const fill = reference * (1 - direction * account.slippageRate);
    const exitFee = p.qty * fill * account.feeRate;
    const gross = direction * p.qty * (fill - p.entryPrice);
    const net = gross - p.entryFee - exitFee;
    const nextBalance = account.balance + gross - exitFee;
    if (![fill, exitFee, gross, net, nextBalance].every(Number.isFinite) || fill <= 0) throw new Error('Exit is outside the supported numeric range.');
    const trade = Object.assign({}, p, {
      exitPrice: fill, exitReferencePrice: reference, exitTime: time, exitBarIndex: barIndex,
      exitReason: typeof options.reason === 'string' ? options.reason.slice(0, 80) : 'manual',
      ambiguous: options.ambiguous === true, gap: options.gap === true,
      grossPnl: gross, exitFee: exitFee, fees: p.entryFee + exitFee, netPnl: net,
      rMultiple: p.plannedRisk === null ? null : net / p.plannedRisk,
      barsHeld: barIndex - p.entryBarIndex,
      notes: '', followedPlan: null
    });
    delete trade.lastProcessedBarIndex;
    account.balance = nextBalance;
    account.position = null;
    account.trades.push(trade);
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

  function stats(trades, initialBalance) {
    if (!Array.isArray(trades)) throw new Error('Trade history must be an array.');
    const initial = finite(initialBalance === undefined ? 100000 : initialBalance, 'Starting balance', { positive: true });
    let wins = 0, losses = 0, grossProfit = 0, grossLoss = 0, fees = 0, total = 0;
    let highWater = initial, running = initial, maxDrawdown = 0, maxDrawdownPct = 0;
    let rSum = 0, rCount = 0, losingStreak = 0, maxLosingStreak = 0;
    const equityCurve = [{ trade: 0, equity: initial, time: null }];
    for (let i = 0; i < trades.length; i++) {
      const trade = trades[i];
      const pnl = finite(trade.netPnl, 'Trade ' + (i + 1) + ' net P&L');
      total += pnl;
      if (pnl > EPSILON) { wins++; grossProfit += pnl; losingStreak = 0; }
      else if (pnl < -EPSILON) { losses++; grossLoss -= pnl; losingStreak++; maxLosingStreak = Math.max(maxLosingStreak, losingStreak); }
      else losingStreak = 0;
      if (trade.fees !== undefined) fees += finite(trade.fees, 'Trade fees', { nonnegative: true });
      if (trade.rMultiple !== null && trade.rMultiple !== undefined && Number.isFinite(trade.rMultiple)) { rSum += trade.rMultiple; rCount++; }
      running += pnl;
      highWater = Math.max(highWater, running);
      const drawdown = highWater - running;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
      maxDrawdownPct = Math.max(maxDrawdownPct, highWater > 0 ? drawdown / highWater * 100 : 0);
      equityCurve.push({ trade: i + 1, equity: running, time: trade.exitTime === undefined ? null : trade.exitTime });
    }
    const count = trades.length;
    return {
      totalTrades: count, closedTrades: count, wins: wins, losses: losses, breakeven: count - wins - losses,
      winRate: count ? wins / count * 100 : null,
      netPnl: total, totalNetPnl: total, fees: fees,
      grossProfit: grossProfit, grossLoss: grossLoss,
      profitFactor: grossLoss > EPSILON ? grossProfit / grossLoss : grossProfit > EPSILON ? Infinity : null,
      averageWin: wins ? grossProfit / wins : null, averageLoss: losses ? grossLoss / losses : null,
      expectancy: count ? total / count : null, averageNetPnl: count ? total / count : null,
      averageR: rCount ? rSum / rCount : null, rTrades: rCount,
      maxDrawdown: maxDrawdown, maxDrawdownPct: maxDrawdownPct, maxLosingStreak: maxLosingStreak,
      finalEquity: running, equityCurve: equityCurve
    };
  }

  return Object.freeze({
    DEFAULT_FEE: DEFAULT_FEE, DEFAULT_SLIPPAGE: DEFAULT_SLIPPAGE,
    normalizeCandles: normalizeCandles, parseCSV: parseCSV, parseTime: timeValue,
    createAccount: createAccount, equity: equity, sizePosition: sizePosition,
    openPosition: openPosition, closePosition: closePosition, processCandle: processCandle, stats: stats
  });
});
