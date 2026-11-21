/* Optional public data. Bundled ReplayLab practice does not depend on this file
 * reaching an exchange. Requests never use credentials or place orders.
 * Sources: Coinbase Exchange product candles and Kraken public OHLC docs.
 * https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-candles
 * https://docs.kraken.com/api-reference/market-data/get-ohlc-data
 */
(function (root, factory) {
  const engine = typeof module === 'object' && module.exports ? require('./engine.js') : root.ReplayEngine;
  const time = typeof module === 'object' && module.exports ? require('./time.js') : root.ReplayTime;
  const api = factory(root, engine, time);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ReplayMarket = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root, Engine, Time) {
  'use strict';

  const TIMEOUT_MS = 6500;
  const INTERVALS = Object.freeze({ '5m': 300, '15m': 900, '1h': 3600, '1d': 86400 });
  const PAIRS = Object.freeze({
    'BTC-USD': { kraken: 'XBTUSD', keys: ['XXBTZUSD', 'XBTUSD', 'BTCUSD', 'BTC/USD', 'XBT/USD'] },
    'ETH-USD': { kraken: 'ETHUSD', keys: ['XETHZUSD', 'ETHUSD', 'ETH/USD'] },
    'SOL-USD': { kraken: 'SOLUSD', keys: ['SOLUSD', 'SOL/USD'] },
    'BTC-USDT': { kraken: 'XBTUSDT', keys: ['XBTUSDT', 'XXBTUSDT', 'BTCUSDT', 'BTC/USDT', 'XBT/USDT'] },
    'ETH-USDT': { kraken: 'ETHUSDT', keys: ['ETHUSDT', 'XETHUSDT', 'ETH/USDT'] }
  });
  const LABELS = Object.freeze({ coinbase: 'Coinbase Exchange', kraken: 'Kraken' });

  function settings(options) {
    if (!Engine || typeof Engine.normalizeCandles !== 'function') throw new Error('The ReplayLab candle validator is unavailable. Reload the page.');
    options = options || {};
    if (!Object.prototype.hasOwnProperty.call(PAIRS, options.symbol)) throw new Error('Choose BTC-USD, ETH-USD, SOL-USD, BTC-USDT, or ETH-USDT.');
    if (!Object.prototype.hasOwnProperty.call(INTERVALS, options.timeframe)) throw new Error('Choose a 5m, 15m, 1h, or 1d timeframe.');
    const providerId = options.providerId || null;
    if (providerId !== null && !Object.prototype.hasOwnProperty.call(LABELS, providerId)) throw new Error('Unknown data source. Choose Coinbase Exchange or Kraken.');
    const now = Math.floor(Date.now() / 1000);
    const duration = INTERVALS[options.timeframe];
    const currentBoundary = Math.floor(now / duration) * duration;
    let start = null, afterTime = null;
    const hasDate = options.startDate !== undefined && options.startDate !== null && options.startDate !== '';
    const hasAfter = options.afterTime !== undefined && options.afterTime !== null;
    if (hasDate && hasAfter) throw new Error('Use either a start date or continuation timestamp, not both.');
    if (hasDate) {
      if (typeof options.startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(options.startDate)) throw new Error('Start date must use YYYY-MM-DD (New York).');
      if (!Time || typeof Time.parseLocal !== 'function') throw new Error('The New York time helper is unavailable. Reload the page.');
      start = Time.parseLocal(options.startDate, '00:00');
      if (start > now) throw new Error('Choose a start date that is not in the future.');
    }
    if (hasAfter) {
      if (!providerId) throw new Error('A data source is required when appending candles, so exchanges cannot be mixed.');
      if (typeof options.afterTime !== 'number' || !Number.isSafeInteger(options.afterTime) || options.afterTime < 0 || options.afterTime >= 100000000000) throw new Error('Continuation time must be a Unix timestamp in seconds.');
      afterTime = options.afterTime;
      if (afterTime > now) throw new Error('Continuation time cannot be in the future.');
      start = afterTime + duration;
    }
    if (start !== null && start >= currentBoundary) throw new Error('There are no new completed candles in this time range yet.');
    return { symbol: options.symbol, timeframe: options.timeframe, duration: duration, providerId: providerId,
      now: now, currentBoundary: currentBoundary, start: start, afterTime: afterTime, minCandles: hasAfter ? 1 : 10 };
  }

  async function requestJson(url, controllers) {
    if (typeof root.fetch !== 'function' || typeof root.AbortController !== 'function') throw new Error('This browser does not support public data requests.');
    const controller = new root.AbortController();
    controllers.push(controller);
    let timedOut = false;
    const timer = setTimeout(function () { timedOut = true; controller.abort(); }, TIMEOUT_MS);
    try {
      const response = await root.fetch(url, { method: 'GET', mode: 'cors', credentials: 'omit', cache: 'no-store', headers: { Accept: 'application/json' }, signal: controller.signal });
      if (!response.ok) {
        if (response.status === 429) throw new Error('rate limit reached; try again later');
        if (response.status === 404) throw new Error('this exact market is not available from this exchange');
        throw new Error('HTTP ' + response.status + ' from the exchange');
      }
      try { return await response.json(); }
      catch (err) {
        if (err && err.name === 'AbortError') throw err;
        throw new Error('the exchange returned invalid JSON');
      }
    } catch (err) {
      if (timedOut) throw new Error('request timed out after 6.5 seconds');
      if (err && err.name === 'AbortError') throw new Error('request was cancelled');
      if (err instanceof TypeError) throw new Error('network or browser access blocked the request');
      throw err;
    } finally { clearTimeout(timer); }
  }

  function finish(raw, config, from, until, providerId) {
    if (!raw.length) throw new Error('no historical candles were returned for this market and date');
    const candles = Engine.normalizeCandles(raw).filter(c => c.time >= from && c.time < until && c.time + config.duration <= config.now && (config.afterTime === null || c.time > config.afterTime));
    if (candles.length < config.minCandles) {
      if (config.afterTime !== null) throw new Error('no new completed candles are available after the current dataset');
      throw new Error('only ' + candles.length + ' completed candles were returned; at least 10 are needed. Choose an earlier date or another market');
    }
    return { candles: candles, source: LABELS[providerId] + ' · ' + config.symbol,
      providerId: providerId, mode: 'public', symbol: config.symbol, timeframe: config.timeframe,
      assetClass: 'crypto', volumeKind: 'units', timeZone: 'America/New_York' };
  }

  async function coinbase(config, controllers) {
    const from = config.start === null ? config.currentBoundary - 298 * config.duration : config.start;
    const until = Math.min(config.currentBoundary, from + 298 * config.duration);
    const query = new URLSearchParams({ granularity: String(config.duration), start: new Date(from * 1000).toISOString(), end: new Date(until * 1000).toISOString() });
    const url = 'https://api.exchange.coinbase.com/products/' + encodeURIComponent(config.symbol) + '/candles?' + query.toString();
    const data = await requestJson(url, controllers);
    if (!Array.isArray(data)) throw new Error(data && typeof data.message === 'string' ? data.message.slice(0, 180) : 'unexpected candle response');
    const raw = data.map(function (row, i) {
      if (!Array.isArray(row) || row.length < 6) throw new Error('malformed candle at response row ' + (i + 1));
      return { time: row[0], low: row[1], high: row[2], open: row[3], close: row[4], volume: row[5] };
    });
    return finish(raw, config, from, until, 'coinbase');
  }

  async function kraken(config, controllers) {
    // Kraken's 720-row maximum includes its current, uncommitted candle.
    const oldestAvailable = config.currentBoundary - 719 * config.duration;
    const from = config.start === null ? config.currentBoundary - 700 * config.duration : config.start;
    if (from < oldestAvailable) throw new Error('this requested date is older than Kraken’s recent 720-candle window; use Coinbase, a CSV, or the bundled replay');
    const query = new URLSearchParams({ pair: PAIRS[config.symbol].kraken, interval: String(config.duration / 60), since: String(from) });
    const data = await requestJson('https://api.kraken.com/0/public/OHLC?' + query.toString(), controllers);
    if (!data || !Array.isArray(data.error)) throw new Error('unexpected OHLC response');
    if (data.error.length) throw new Error(data.error.join('; ').slice(0, 240));
    if (!data.result || typeof data.result !== 'object') throw new Error('the exchange returned no candle result');
    const keys = Object.keys(data.result).filter(key => key !== 'last');
    if (keys.length !== 1 || !PAIRS[config.symbol].keys.includes(keys[0])) throw new Error('the response did not match the exact requested market; data was not substituted');
    const rows = data.result[keys[0]];
    if (!Array.isArray(rows)) throw new Error('unexpected candle response');
    // The API explicitly identifies its final array entry as uncommitted,
    // even when the client's local clock would otherwise mark it complete.
    const raw = rows.slice(0, -1).map(function (row, i) {
      if (!Array.isArray(row) || row.length < 8) throw new Error('malformed candle at response row ' + (i + 1));
      return { time: row[0], open: row[1], high: row[2], low: row[3], close: row[4], volume: row[6] };
    });
    return finish(raw, config, from, config.currentBoundary, 'kraken');
  }

  async function load(options) {
    const config = settings(options);
    const providers = config.providerId ? [config.providerId] : ['coinbase', 'kraken'];
    const controllers = [];
    const failures = {};
    const functions = { coinbase: coinbase, kraken: kraken };
    try {
      return await Promise.any(providers.map(async function (providerId) {
        try { return await functions[providerId](config, controllers); }
        catch (err) {
          failures[providerId] = err && err.message ? err.message : 'request failed';
          throw err;
        }
      }));
    } catch (err) {
      const details = providers.map(providerId => LABELS[providerId] + ': ' + (failures[providerId] || 'request failed'));
      const error = new Error('Public data unavailable. ' + details.join(' • ') + '. Bundled replay and CSV import remain available.');
      error.code = 'PUBLIC_DATA_UNAVAILABLE';
      error.providerErrors = providers.map(providerId => ({ providerId: providerId, message: failures[providerId] || 'request failed' }));
      throw error;
    } finally {
      // Once a venue wins the race, cancel remaining public requests.
      controllers.forEach(controller => { if (!controller.signal.aborted) controller.abort(); });
    }
  }

  return Object.freeze({ load: load, TIMEOUT_MS: TIMEOUT_MS, intervals: INTERVALS });
});
