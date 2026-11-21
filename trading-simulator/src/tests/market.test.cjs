'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../market.js');
const T = require('../time.js');
const NOW = Date.parse('2026-11-21T12:05:00Z') / 1000;
const INTERVAL = 900;
const BOUNDARY = Math.floor(NOW / INTERVAL) * INTERVAL;

const response = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
const coinRows = (count = 12, current = true) => {
  const rows = Array.from({ length: count }, (_, i) => [BOUNDARY - (count - i) * INTERVAL, 98 + i, 105 + i, 100 + i, 102 + i, 10]);
  if (current) rows.push([BOUNDARY, 110, 119, 112, 116, 10]);
  return rows;
};
const krakenData = (count = 12, key = 'XXBTZUSD') => ({
  error: [],
  result: { [key]: coinRows(count).map(row => [row[0], String(row[3]), String(row[2]), String(row[1]), String(row[4]), String(row[4]), String(row[5]), 4]), last: BOUNDARY }
});
async function mocked(fetcher, fn) {
  const previousFetch = global.fetch, previousNow = Date.now;
  global.fetch = fetcher;
  Date.now = () => NOW * 1000;
  try { return await fn(); }
  finally { global.fetch = previousFetch; Date.now = previousNow; }
}

test('public data races providers, keeps exact quote currency, and uses the successful fallback', async () => {
  const calls = [];
  await mocked(async (url, options) => {
    calls.push(String(url));
    assert.equal(options.credentials, 'omit');
    assert.ok(options.signal instanceof AbortSignal);
    if (String(url).includes('coinbase')) throw new TypeError('Failed to fetch');
    assert.equal(new URL(url).searchParams.get('pair'), 'XBTUSDT');
    return response(krakenData(12, 'XBTUSDT'));
  }, async () => {
    const result = await M.load({ symbol: 'BTC-USDT', timeframe: '15m' });
    assert.equal(result.providerId, 'kraken');
    assert.equal(result.symbol, 'BTC-USDT');
    assert.equal(result.source, 'Kraken · BTC-USDT');
    assert.equal(result.mode, 'public');
    assert.equal(result.assetClass, 'crypto');
    assert.equal(result.volumeKind, 'units');
    assert.equal(result.candles.length, 12);
    assert.equal(calls.length, 2);
    assert.ok(calls.some(url => url.includes('/products/BTC-USDT/candles')));
  });
});

test('Coinbase candles sort ascending, deduplicate, and exclude unfinished data', async () => {
  const rows = coinRows();
  rows.push(rows[3].slice());
  await mocked(async url => {
    const parsed = new URL(url);
    const start = Date.parse(parsed.searchParams.get('start')) / 1000;
    const end = Date.parse(parsed.searchParams.get('end')) / 1000;
    assert.equal(end - start, 298 * INTERVAL);
    assert.equal(parsed.searchParams.get('granularity'), '900');
    return response(rows.reverse());
  }, async () => {
    const result = await M.load({ symbol: 'BTC-USD', timeframe: '15m', providerId: 'coinbase' });
    assert.equal(result.candles.length, 12);
    assert.ok(result.candles.every((c, i, all) => c.time + INTERVAL <= NOW && (!i || c.time > all[i - 1].time)));
    assert.equal(result.candles.at(-1).time, BOUNDARY - INTERVAL);
  });
});

test('Kraken always excludes its documented final uncommitted row', async () => {
  const data = krakenData();
  // Simulate stale exchange time / a client clock ahead: the final API row must
  // still be excluded, rather than trusting the client completion check alone.
  data.result.XXBTZUSD.at(-1)[0] = BOUNDARY - 1;
  await mocked(async () => response(data), async () => {
    const result = await M.load({ symbol: 'BTC-USD', timeframe: '15m', providerId: 'kraken' });
    assert.equal(result.candles.length, 12);
    assert.ok(!result.candles.some(c => c.time === BOUNDARY - 1));
  });
});

test('all provider failures explain why and retain structured provider details', async () => {
  await mocked(async () => { throw new TypeError('Failed to fetch'); }, async () => {
    await assert.rejects(M.load({ symbol: 'ETH-USD', timeframe: '1h' }), error => {
      assert.equal(error.code, 'PUBLIC_DATA_UNAVAILABLE');
      assert.equal(error.providerErrors.length, 2);
      assert.match(error.message, /Coinbase Exchange/);
      assert.match(error.message, /Kraken/);
      assert.match(error.message, /Bundled replay and CSV/);
      assert.match(error.message, /network or browser access/);
      return true;
    });
  });
});

test('invalid dates, unknown inputs, and unsafe continuation fail before networking', async () => {
  let calls = 0;
  await mocked(async () => { calls++; throw new Error('Should not fetch'); }, async () => {
    const defaults = { symbol: 'BTC-USD', timeframe: '15m' };
    for (const change of [
      { startDate: '2026-02-30' }, { startDate: '2027-01-01' }, { startDate: '11/20/2026' },
      { symbol: 'DOGE-USD' }, { timeframe: '30m' }, { providerId: 'binance' },
      { afterTime: BOUNDARY - 900 }, // A source must be pinned for continuation.
      { afterTime: (BOUNDARY - 900) * 1000, providerId: 'coinbase' },
      { afterTime: BOUNDARY - 900, providerId: 'coinbase', startDate: '2026-11-20' },
      { afterTime: BOUNDARY + 900, providerId: 'coinbase' }
    ]) await assert.rejects(M.load(Object.assign({}, defaults, change)));
    assert.equal(calls, 0);
  });
});

test('Kraken refuses a historical date beyond its window instead of silently loading recent candles', async () => {
  let calls = 0;
  await mocked(async () => { calls++; return response(krakenData()); }, async () => {
    await assert.rejects(M.load({ symbol: 'BTC-USD', timeframe: '15m', providerId: 'kraken', startDate: '2026-03-01' }), /older than Kraken.*720-candle window/);
    assert.equal(calls, 0);
  });
});

test('historical Coinbase date is preserved and the request range never exceeds 298 intervals', async () => {
  const from = T.parseLocal('2026-03-01', '00:00');
  await mocked(async url => {
    const parsed = new URL(url);
    const start = Date.parse(parsed.searchParams.get('start')) / 1000;
    const end = Date.parse(parsed.searchParams.get('end')) / 1000;
    assert.equal(start, from);
    assert.equal(end - start, 298 * INTERVAL);
    const rows = Array.from({ length: 12 }, (_, i) => [from + i * INTERVAL, 98, 105, 100, 102, 10]);
    rows.unshift([from - INTERVAL, 98, 105, 100, 102, 10]);
    return response(rows);
  }, async () => {
    const result = await M.load({ symbol: 'BTC-USD', timeframe: '15m', startDate: '2026-03-01', providerId: 'coinbase' });
    assert.equal(result.candles[0].time, from);
    assert.equal(result.candles.length, 12);
  });
});

test('tail continuation stays on its venue, requests the next interval, and accepts one new candle', async () => {
  const after = BOUNDARY - 2 * INTERVAL;
  let calls = 0;
  await mocked(async url => {
    calls++;
    assert.ok(String(url).includes('coinbase.com'));
    const start = Date.parse(new URL(url).searchParams.get('start')) / 1000;
    assert.equal(start, after + INTERVAL);
    return response(coinRows());
  }, async () => {
    const result = await M.load({ symbol: 'BTC-USD', timeframe: '15m', providerId: 'coinbase', afterTime: after });
    assert.equal(result.candles.length, 1);
    assert.equal(result.candles[0].time, after + INTERVAL);
    assert.equal(calls, 1);
  });
});

test('public start dates mean midnight in New York in both EST and EDT', async () => {
  for (const [date, expectedISO] of [['2026-01-15', '2026-01-15T05:00:00.000Z'], ['2026-07-15', '2026-07-15T04:00:00.000Z']]) {
    const from = Date.parse(expectedISO) / 1000;
    await mocked(async url => {
      assert.equal(new URL(url).searchParams.get('start'), expectedISO);
      return response(Array.from({ length: 12 }, (_, i) => [from + i * INTERVAL, 98, 105, 100, 102, 10]));
    }, async () => {
      const result = await M.load({ symbol: 'BTC-USD', timeframe: '15m', startDate: date, providerId: 'coinbase' });
      assert.equal(result.candles[0].time, from);
      assert.equal(T.date(result.candles[0].time), date);
      assert.equal(T.axis(result.candles[0].time), '00:00');
    });
  }
});

test('pinned venue failure never switches exchange and does not return duplicates', async () => {
  let calls = 0;
  await mocked(async url => {
    calls++;
    assert.ok(String(url).includes('coinbase.com'));
    return response([[BOUNDARY - 3 * INTERVAL, 98, 105, 100, 102, 10]]);
  }, async () => {
    await assert.rejects(M.load({ symbol: 'BTC-USD', timeframe: '15m', providerId: 'coinbase', afterTime: BOUNDARY - 3 * INTERVAL }), /no new completed candles/);
    assert.equal(calls, 1);
  });
});

test('minimum replay length rejects an unusable new session', async () => {
  await mocked(async () => response(coinRows(9)), async () => {
    await assert.rejects(M.load({ symbol: 'BTC-USD', timeframe: '15m', providerId: 'coinbase' }), /only 9 completed candles/);
  });
});

test('exact-market validation rejects a Kraken quote mismatch', async () => {
  await mocked(async () => response(krakenData(12, 'XBTUSDT')), async () => {
    await assert.rejects(M.load({ symbol: 'BTC-USD', timeframe: '15m', providerId: 'kraken' }), /did not match the exact requested market/);
  });
});

test('malformed candle data and API errors are reported explicitly', async () => {
  const malformed = coinRows();
  malformed[2][2] = 1; // High below open and close.
  await mocked(async () => response(malformed), async () => {
    await assert.rejects(M.load({ symbol: 'BTC-USD', timeframe: '15m', providerId: 'coinbase' }), /OHLC values are inconsistent/);
  });
  await mocked(async () => response({ error: ['EQuery:Unknown asset pair'] }), async () => {
    await assert.rejects(M.load({ symbol: 'ETH-USDT', timeframe: '15m', providerId: 'kraken' }), /Unknown asset pair/);
  });
  await mocked(async () => response({}, 429), async () => {
    await assert.rejects(M.load({ symbol: 'BTC-USD', timeframe: '15m', providerId: 'coinbase' }), /rate limit/);
  });
});

test('requests use a 6500ms abort timer and surface timeout errors', async () => {
  const originalSetTimeout = global.setTimeout, originalClearTimeout = global.clearTimeout;
  const delays = [];
  global.setTimeout = (callback, delay) => { delays.push(delay); queueMicrotask(callback); return 123; };
  global.clearTimeout = () => {};
  try {
    await mocked(async (url, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => { const error = new Error('Aborted'); error.name = 'AbortError'; reject(error); }, { once: true });
    }), async () => {
      await assert.rejects(M.load({ symbol: 'BTC-USD', timeframe: '15m', providerId: 'coinbase' }), /timed out after 6.5 seconds/);
      assert.deepEqual(delays, [6500]);
    });
  } finally { global.setTimeout = originalSetTimeout; global.clearTimeout = originalClearTimeout; }
});

test('a successful provider cancels its still-pending competitor', async () => {
  let krakenAborted = false;
  await mocked(async (url, options) => {
    if (String(url).includes('coinbase')) return response(coinRows());
    return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => {
      krakenAborted = true;
      const error = new Error('Aborted'); error.name = 'AbortError'; reject(error);
    }, { once: true }));
  }, async () => {
    const result = await M.load({ symbol: 'BTC-USD', timeframe: '15m' });
    assert.equal(result.providerId, 'coinbase');
    assert.equal(krakenAborted, true);
  });
});
