'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const C = require('../coach.js');
const scope = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../academy.js'), 'utf8'), scope);
const academy = scope.ReplayAcademy;
const guided = { items: [{ id: 'size-long', title: 'Size a paper long', subtitle: 'Match quantity to risk', moduleId: 'sizing', videoIds: ['risk-video'], lesson: { seeIt: { title: 'Measure the planned loss', text: 'Choose a stop based on invalidation, then calculate quantity.', example: 'A wider stop needs fewer shares for the same budget.' }, tryIt: { title: 'Calculate your size', text: 'Use the sizing lab before opening the position.' }, reviewIt: { title: 'Review the budget', text: 'Include costs and compare planned risk with the budget.' } } }] };
const index = C.buildIndex(academy, guided);
const bar = (time, close = 101) => ({ time, open: 100, high: 104, low: 96, close, volume: 10 });

function browserStorageFixture() {
  const rows = new Map(), local = new Map();
  const fixture = { rows, local, failWrites: false, pauseOpen: false, closed: 0, releaseOpen: null };
  fixture.environment = {
    localStorage: { getItem: key => local.get(key) || null, setItem: (key, value) => local.set(key, value), removeItem: key => local.delete(key) },
    indexedDB: { open() {
      const request = {}, database = {
        objectStoreNames: { contains: () => true }, close() { fixture.closed++; },
        transaction(name, mode) {
          assert.equal(name, 'threads');
          const transaction = {};
          function operation(fn) {
            const result = {};
            queueMicrotask(() => {
              if (fixture.failWrites && mode === 'readwrite') { transaction.error = new Error('quota exceeded'); transaction.onerror?.(); return; }
              result.result = fn(); result.onsuccess?.(); queueMicrotask(() => transaction.oncomplete?.());
            });
            return result;
          }
          transaction.objectStore = () => ({ getAll: () => operation(() => structuredClone([...rows.values()])), put: value => operation(() => { rows.set(value.id, structuredClone(value)); return value.id; }), delete: id => operation(() => rows.delete(id)) });
          return transaction;
        }
      };
      const complete = () => { request.result = database; request.onsuccess?.(); };
      if (fixture.pauseOpen) fixture.releaseOpen = complete; else queueMicrotask(complete);
      return request;
    } }
  };
  return fixture;
}

test('local retrieval indexes the real course and guided sections with correct navigation sources', () => {
  assert.ok(index.length > 100);
  const results = C.retrieve('position sizing quantity risk budget stop', index);
  assert.ok(results.length > 0);
  assert.ok(results.some(item => item.moduleId === 'sizing'));
  const guide = index.find(item => item.id === 'size-long:seeIt');
  assert.equal(guide.guideId, 'size-long');
  assert.match(guide.text, /wider stop needs fewer shares/);
  for (const result of results) assert.ok(index.some(item => item.id === result.id && item.text === result.text));
});

test('local answers use source excerpts and never claim AI or attachment analysis', () => {
  const reply = C.localReply('How do I calculate position size and risk?', { index, videos: academy.videos, attachmentCount: 1 });
  assert.equal(reply.mode, 'local');
  assert.ok(reply.references.length > 0);
  assert.match(reply.text, /From /);
  assert.match(reply.text, /Local guide has not inspected/);
  assert.doesNotMatch(reply.text, /I analyzed your|I searched the web/);
});

test('unknown and current market questions explicitly need a live connection', () => {
  for (const question of ['How far is the Andromeda galaxy?', 'What is Apple’s latest stock price today?']) {
    const reply = C.localReply(question, { index });
    assert.match(reply.text, /needs a live connection|need a live connection/i, question);
    assert.equal(reply.mode, 'local');
  }
});

test('context filtering excludes future candles, trades and unrecognized fields', () => {
  const raw = { symbol: 'TEST', timeframe: '1m', currentCandle: bar(200), cursor: 50, revealedCandles: [bar(100), bar(200), bar(300)], candles: [bar(999)], secret: 'private', account: { balance: 10000, equity: 10001, privateToken: 'secret', position: { side: 'long', qty: 1, entryPrice: 100, entryTime: 150, stop: 95, target: null }, trades: [{ side: 'long', exitTime: 100, netPnl: 4 }, { side: 'short', exitTime: 300, netPnl: 999 }] } };
  const context = C.sanitizeContext(raw);
  assert.deepEqual(context.revealedCandles.map(item => item.time), [100, 200]);
  assert.equal(context.account.trades.length, 1);
  assert.equal(context.account.position.side, 'long');
  for (const key of ['candles', 'secret']) assert.equal(context[key], undefined);
  assert.equal(context.account.privateToken, undefined);
  raw.account.position.entryTime = 300;
  assert.equal(C.sanitizeContext(raw).account.position, null);
  assert.equal(C.sanitizeContext({ revealedCandles: [bar(100)] }).revealedCandles, undefined);
});

test('context is bounded and local candle explanations use only the current observed bar', () => {
  const context = C.sanitizeContext({ symbol: 'TEST', timeframe: '1m', currentCandle: bar(200), revealedCandles: Array.from({ length: 200 }, (_, i) => bar(i + 1)) });
  assert.equal(context.revealedCandles.length, 80);
  const reply = C.localReply('Explain this candle', { index, context });
  assert.match(reply.text, /open 100, high 104, low 96, close 101/);
  assert.match(reply.text, /does not predict the next candle/);
  assert.match(reply.text, /not an attachment/);
});

test('local order help reflects the actual open position and opposite-side close behavior', () => {
  const context = { currentCandle: bar(200), account: { balance: 10000, equity: 10001, position: { side: 'short', qty: 3, entryPrice: 102, entryTime: 100 } } };
  const reply = C.localReply('How do I buy or sell?', { index, context });
  assert.match(reply.text, /paper short of 3 units/);
  assert.match(reply.text, /opposite-side button closes that entire position/);
  assert.match(reply.text, /Reverse is the separate action/);
});

test('service settings require HTTPS, a distinct service token and no embedded credentials', () => {
  const token = 'a'.repeat(40);
  assert.deepEqual(C.cleanConfig({ endpoint: 'https://coach.example/api/coach', token }), { endpoint: 'https://coach.example', token });
  assert.equal(C.cleanConfig({ endpoint: 'http://localhost:8787/', token }).endpoint, 'http://localhost:8787');
  for (const raw of [{ endpoint: 'http://remote.example', token }, { endpoint: 'javascript:alert(1)', token }, { endpoint: 'https://user:pass@example.com', token }, { endpoint: 'https://example.com?q=secret', token }, { endpoint: 'https://example.com', token: 'sk-proj-' + 'x'.repeat(40) }, { endpoint: 'https://example.com', token: 'short' }]) assert.throws(() => C.cleanConfig(raw));
  assert.deepEqual(C.cleanConfig({}), { endpoint: '', token: '' });
});

test('attachment validation enforces accepted formats, size and queue limits without analyzing content', () => {
  const image = { name: 'chart.png', type: 'image/png', size: 1024 };
  const item = C.validateAttachment(image);
  assert.equal(item.kind, 'image');
  assert.equal(item.blob, image);
  assert.equal(item.duration, null);
  for (const file of [{ ...image, type: 'image/svg+xml' }, { ...image, size: C.LIMITS.imageBytes + 1 }, { ...image, type: 'video/mp4', size: C.LIMITS.videoBytes + 1 }, { ...image, size: 0 }]) assert.throws(() => C.validateAttachment(file));
  assert.throws(() => C.validateAttachment(image, [item, item, item, item]), /at most four/);
  assert.throws(() => C.validateAttachment({ ...image, type: 'video/mp4', size: 24 * 1024 * 1024 }, [{ size: 10 * 1024 * 1024 }]), /under 32 MB/);
});

test('text fallback persists conversation text and marks omitted media honestly', async () => {
  const values = new Map(), warnings = [], env = { localStorage: { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) } };
  const storage = C.createStorage(env, value => warnings.push(value));
  await storage.load();
  const thread = { id: 'thread', title: 'A chart review', messages: [{ role: 'user', text: 'Explain this', attachments: [{ name: 'chart.png', size: 100, kind: 'image', blob: new Blob(['test']) }] }] };
  await storage.save(thread);
  assert.equal(storage.mode, 'localstorage');
  const restored = await C.createStorage(env).load();
  assert.equal(restored[0].messages[0].text, 'Explain this');
  assert.equal(restored[0].messages[0].attachments[0].blob, undefined);
  assert.equal(restored[0].messages[0].attachments[0].unavailable, true);
  assert.ok(warnings.some(value => /Media will remain available only/.test(value)));
  assert.ok(thread.messages[0].attachments[0].blob, 'fallback must not discard current-session media');
  await storage.remove('thread');
  assert.equal((await C.createStorage(env).load()).length, 0);
});

test('denied browser storage leaves in-memory conversation usable without claiming it was saved', async () => {
  const warnings = [], env = { localStorage: { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } } };
  const storage = C.createStorage(env, value => warnings.push(value));
  assert.deepEqual(await storage.load(), []);
  await storage.save({ id: 'memory', title: 'Local', messages: [{ role: 'user', text: 'Question', attachments: [] }] });
  assert.equal(storage.mode, 'memory');
  assert.ok(warnings.some(value => /only for this page session/.test(value)));
});

test('IndexedDB conversation history preserves actual attachment bytes across reload and deletion', async () => {
  const fixture = browserStorageFixture(), first = C.createStorage(fixture.environment);
  await first.load();
  const blob = new Blob(['local attachment bytes'], { type: 'image/png' });
  await first.save({ id: 'media', title: 'A screenshot', updated: 100, messages: [{ role: 'user', text: 'Review later', attachments: [{ id: 'image', kind: 'image', name: 'chart.png', size: blob.size, blob }] }] });
  assert.equal(first.mode, 'indexeddb'); first.close();
  const next = C.createStorage(fixture.environment), restored = await next.load();
  assert.equal(restored.length, 1);
  assert.equal(await restored[0].messages[0].attachments[0].blob.text(), 'local attachment bytes');
  assert.equal(restored[0].messages[0].attachments[0].unavailable, undefined);
  await next.remove('media'); next.close();
  const final = C.createStorage(fixture.environment);
  assert.deepEqual(await final.load(), []); final.close();
});

test('text fallback recovery keeps the newest text and does not resurrect deleted media conversations', async () => {
  const fixture = browserStorageFixture(), first = C.createStorage(fixture.environment);
  await first.load();
  const thread = id => ({ id, title: id, updated: 100, messages: [{ role: 'user', text: 'Original', attachments: [] }] });
  await first.save(thread('keep')); await first.save(thread('delete'));
  fixture.failWrites = true;
  const updated = thread('keep'); updated.updated = 200; updated.messages[0].text = 'Newest text while media storage was unavailable';
  await first.save(updated); await first.remove('delete');
  assert.equal(first.mode, 'localstorage');
  assert.ok(fixture.rows.has('delete'), 'underlying media database was unavailable at deletion time');
  first.close(); fixture.failWrites = false;
  const recovered = C.createStorage(fixture.environment), rows = await recovered.load();
  assert.deepEqual(rows.map(value => value.id), ['keep']);
  assert.equal(rows[0].messages[0].text, 'Newest text while media storage was unavailable');
  assert.equal(fixture.rows.has('delete'), false, 'the pending media deletion must be applied on recovery');
  assert.equal(fixture.local.has('replaylab-coach-text-v1'), false, 'successfully migrated fallback cannot reappear on later reload');
  recovered.close();
});

test('destroying storage while the database opens closes the late connection without reviving the session', async () => {
  const fixture = browserStorageFixture(); fixture.pauseOpen = true;
  const storage = C.createStorage(fixture.environment);
  storage.close(); fixture.releaseOpen();
  assert.deepEqual(await storage.load(), []);
  await storage.save({ id: 'should-not-save', messages: [] });
  assert.equal(fixture.rows.size, 0);
  assert.equal(fixture.closed, 1);
});
