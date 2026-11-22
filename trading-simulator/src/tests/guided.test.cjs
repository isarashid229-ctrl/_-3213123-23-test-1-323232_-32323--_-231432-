const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const G = require('../guided.js');
const E = require('../engine.js');
const catalog = require('../instruments.js');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../academy.js'), 'utf8'), context);
const A = context.ReplayAcademy;

function setup(id) {
  const item = G.items.find(x => x.id === id);
  const dataset = catalog.items.find(x => x.id === item.datasetId);
  const scenario = G.createScenario(id, dataset.candles);
  const account = E.createAccount(scenario.initialBalance);
  return { scenario, dataset, account, cursor: scenario.startIndex, events: [] };
}
function ctx(run) { return { candles: run.dataset.candles, cursor: run.cursor, account: run.account, events: run.events }; }
function open(run, changes = {}) {
  const sc = run.scenario, preset = sc.tradePreset || {}, side = preset.side || 'long';
  const bar = run.dataset.candles[run.cursor];
  const stop = side === 'long' ? sc.reference.longStop : sc.reference.shortStop;
  const qty = sc.id.startsWith('size-') ? G.maximumShares(side, bar.close, stop, sc.reference.budget, run.account.balance, run.account.feeRate, run.account.slippageRate) : preset.qty || 1;
  const p = E.openPosition(run.account, { side, qty, price: bar.close, time: bar.time, barIndex: run.cursor, stop, target: sc.id === 'handle-loss' ? null : side === 'long' ? sc.reference.longTarget : sc.reference.shortTarget, plan: preset.plan || 'Use the declared stop, budget, and exercise time exit.', ...changes });
  run.events.push({ type: 'open', barIndex: run.cursor, position: JSON.parse(JSON.stringify(p)) });
  return p;
}
function advance(run, bars) {
  for (let i = 0; i < bars; i++) {
    run.cursor++;
    const closed = E.processCandle(run.account, run.dataset.candles[run.cursor], run.cursor);
    run.events.push({ type: 'step', barIndex: run.cursor });
    if (closed) run.events.push({ type: 'close', barIndex: run.cursor, trade: JSON.parse(JSON.stringify(closed)) });
  }
}
function close(run) {
  if (!run.account.position) return run.account.trades.at(-1);
  const bar = run.dataset.candles[run.cursor];
  const trade = E.closePosition(run.account, { price: bar.close, time: bar.time, barIndex: run.cursor, reason: 'manual' });
  run.events.push({ type: 'close', barIndex: run.cursor, trade: JSON.parse(JSON.stringify(trade)) });
  return trade;
}
function evaluate(run, id, response) { return G.evaluate(run.scenario, id, response, ctx(run)); }

test('twelve guided labs use existing historical stock datasets and exact learning/video references', () => {
  assert.equal(G.items.length, 12);
  assert.equal(new Set(G.items.map(x => x.id)).size, 12);
  const moduleIds = new Set(A.modules.map(x => x.id)), videoIds = new Set(A.videos.map(x => x.id));
  for (const item of G.items) {
    const dataset = catalog.items.find(x => x.id === item.datasetId);
    assert.ok(dataset && dataset.assetClass === 'equity', item.id + ': historical equity dataset');
    assert.ok(item.startIndex >= 24 && item.startIndex + 10 < dataset.candles.length, item.id + ': usable starting window');
    assert.ok(moduleIds.has(item.moduleId), item.id + ': course reference');
    assert.ok(item.videoIds.length && item.videoIds.every(id => videoIds.has(id)), item.id + ': videos');
    for (const key of ['seeIt', 'tryIt', 'reviewIt']) {
      assert.ok(item.lesson[key].title && item.lesson[key].text, item.id + ': readable lesson section');
    }
    assert.ok(item.lesson.seeIt.example, item.id + ': worked example');
    const sc = G.createScenario(item.id, dataset.candles);
    assert.ok(sc.steps.length >= 2, item.id + ': actual checkpoints');
    assert.equal(new Set(sc.steps.map(x => x.id)).size, sc.steps.length, item.id + ': unique step IDs');
    for (const step of sc.steps) {
      assert.ok(['choice', 'number', 'trade', 'wait', 'review'].includes(step.type));
      assert.ok(step.hints.length >= 2 && step.hints.every(x => typeof x === 'string' && x.length));
      assert.ok(step.prompt && step.explanation && step.moduleId === item.moduleId);
      if (step.type === 'choice') assert.ok(step.choices.length >= 2 && new Set(step.choices.map(x => x.value)).size === step.choices.length);
    }
  }
});

test('scenario construction never reads a future candle and future changes cannot alter the exercise', () => {
  for (const item of G.items) {
    const data = catalog.items.find(x => x.id === item.datasetId).candles;
    const guarded = new Proxy(data, { get(target, key, receiver) {
      if (/^\d+$/.test(String(key)) && Number(key) > item.startIndex) throw new Error('Future candle read: ' + key);
      return Reflect.get(target, key, receiver);
    } });
    const actual = G.createScenario(item.id, guarded);
    const changedFuture = data.map((bar, i) => i <= item.startIndex ? bar : { time: bar.time, open: 1, high: 1e9, low: 0.01, close: 1e8, volume: 0 });
    assert.deepEqual(actual, G.createScenario(item.id, changedFuture), item.id + ': future data changed the starting exercise');
  }
});

test('candle feedback grades anchored OHLC and gives corrective steps with video/course follow-up', () => {
  const run = setup('read-candle'), bar = run.scenario.reference.candle;
  const direction = bar.close > bar.open ? 'up' : bar.close < bar.open ? 'down' : 'flat';
  assert.equal(evaluate(run, 'direction', direction).status, 'pass');
  const wrong = evaluate(run, 'direction', direction === 'up' ? 'down' : 'up');
  assert.equal(wrong.status, 'retry');
  assert.ok(wrong.hints.length >= 2 && wrong.moduleId === 'candles' && wrong.videoIds.includes('candles-video'));
  run.cursor += 5;
  assert.equal(evaluate(run, 'body', Math.abs(bar.close - bar.open)).status, 'pass', 'anchored candle remains the target after replay advances');
});

test('blank, boolean, NaN, and nonnumeric answers are not silently treated as zero', () => {
  const run = setup('candle-range');
  for (const value of ['', '  ', null, undefined, true, false, NaN, Infinity, '0x20', '$1.00']) {
    assert.equal(evaluate(run, 'range', value).status, 'retry', String(value));
  }
  const bar = run.scenario.reference.candle;
  assert.equal(evaluate(run, 'range', bar.high - bar.low).status, 'pass');
  assert.equal(evaluate(run, 'upper-wick', bar.high - Math.max(bar.open, bar.close)).status, 'pass');
});

test('structure labels use confirmed visible pivots and declared tolerance', () => {
  const run = setup('identify-trend'), structure = run.scenario.reference.structure;
  for (const pivot of structure.pivots) assert.ok(pivot.index <= run.cursor - 2, 'pivot needs two revealed right-side bars');
  assert.equal(evaluate(run, 'structure', structure.label).status, 'pass');
  assert.equal(evaluate(run, 'confirmation', 'need-later-bars').status, 'pass');
});

test('level checks accept rounding tolerance but reject unrelated prices', () => {
  const run = setup('map-levels'), ref = run.scenario.reference;
  assert.equal(evaluate(run, 'support', ref.low).status, 'pass');
  assert.equal(evaluate(run, 'resistance', ref.high).status, 'pass');
  assert.equal(evaluate(run, 'support', ref.high + 10).status, 'retry');
  assert.equal(evaluate(run, 'level-limit', 'guarantee').status, 'retry');
});

test('long and short sizing agree with the simulation engine and require an actual order', () => {
  for (const id of ['size-long', 'size-short']) {
    const run = setup(id), sc = run.scenario, side = id === 'size-long' ? 'long' : 'short';
    const stop = side === 'long' ? sc.reference.longStop : sc.reference.shortStop;
    const size = E.sizePosition({ equity: sc.initialBalance, entry: sc.reference.entry, stop, side, riskPct: sc.riskPct, feeRate: sc.feeRate, slippageRate: sc.slippageRate });
    assert.equal(evaluate(run, 'quantity', Math.floor(size.qty)).status, 'pass');
    assert.equal(evaluate(run, 'submit', 'I bought the shares').status, 'pending', 'a statement is not an executed paper trade');
    open(run);
    const result = evaluate(run, 'submit');
    assert.equal(result.status, 'pass', JSON.stringify(result));
  }
});

test('risk check rejects an excessive but broker-accepted quantity and fractional shares in whole-share drills', () => {
  const run = setup('size-long'), sc = run.scenario;
  const max = G.maximumShares('long', sc.reference.entry, sc.reference.longStop, sc.reference.budget, sc.initialBalance, sc.feeRate, sc.slippageRate);
  open(run, { qty: max + 1 });
  const result = evaluate(run, 'submit');
  assert.equal(result.status, 'retry');
  assert.match(result.message, /budget|risk|quantity/i);
  const fractional = setup('size-short');
  open(fractional, { qty: 1.5 });
  assert.match(evaluate(fractional, 'submit').message, /whole-share/i);
});

test('protective-bracket checkpoint rejects missing targets and inadequate geometry', () => {
  const missing = setup('protect-trade');
  open(missing, { target: null });
  assert.equal(evaluate(missing, 'submit').status, 'retry');
  const narrow = setup('protect-trade'), sc = narrow.scenario;
  const entry = sc.reference.entry * (1 + sc.slippageRate);
  open(narrow, { target: entry + (entry - sc.reference.longStop) });
  assert.match(evaluate(narrow, 'submit').message, /2:1|geometry/i);
  const good = setup('protect-trade');
  open(good);
  assert.equal(evaluate(good, 'submit').status, 'pass');
});

test('a process-correct bracket can pass after a negative result; P&L is not the success criterion', () => {
  const run = setup('protect-trade');
  open(run);
  const trade = close(run);
  assert.ok(trade.netPnl < 0, 'same-mark close loses modeled costs');
  assert.equal(evaluate(run, 'submit').status, 'pass', 'the bracket-setting checkpoint grades the submitted plan, not profit');
});

test('waiting requires revealed bars and rejects an early actual entry even if later candles rise', () => {
  const waiting = setup('wait-trigger');
  assert.equal(evaluate(waiting, 'initial-decision', 'wait').status, 'pass');
  assert.equal(evaluate(waiting, 'observe').status, 'pending');
  advance(waiting, 3);
  assert.equal(evaluate(waiting, 'observe').status, 'pass', 'a deliberate wait can succeed without an order');
  const current = waiting.dataset.candles[waiting.cursor].close > waiting.scenario.reference.trigger ? 'enter' : 'wait';
  assert.equal(evaluate(waiting, 'current-decision', current).status, 'pass');
  const early = setup('wait-trigger');
  open(early);
  advance(early, 3);
  assert.equal(evaluate(early, 'observe').status, 'retry');
});

test('the time-exit exercise checks actual entry/exit bars and accepts planned protective exits', () => {
  const run = setup('handle-loss');
  open(run);
  assert.equal(evaluate(run, 'submit').status, 'pass');
  assert.equal(evaluate(run, 'observe').status, 'pending');
  advance(run, 3);
  close(run);
  assert.equal(evaluate(run, 'exit').status, 'pass');
  assert.equal(evaluate(run, 'after-loss', 'same-process').status, 'pass');
  const tooSoon = setup('handle-loss');
  open(tooSoon);
  close(tooSoon);
  assert.equal(evaluate(tooSoon, 'exit').status, 'retry', 'an immediate manual close is not the time-exit task');
});

test('equity task uses the actual marked account and requires an observed post-entry candle', () => {
  const run = setup('equity-check');
  assert.equal(evaluate(run, 'equity', 10000).status, 'pending');
  open(run);
  assert.equal(evaluate(run, 'equity', run.account.balance).status, 'pending');
  advance(run, 1);
  const expected = E.equity(run.account, run.dataset.candles[run.cursor].close);
  assert.equal(evaluate(run, 'equity', expected.toFixed(2)).status, 'pass');
  assert.equal(evaluate(run, 'equity', expected + 100).status, 'retry');
});

test('journal feedback checks structured facts and labels free-text evaluation limits honestly', () => {
  const run = setup('review-trade');
  open(run);
  advance(run, 2);
  const trade = close(run);
  assert.equal(evaluate(run, 'exit').status, 'pass');
  const response = { notes: 'I used the planned quantity and followed the recorded exit. Next time I will verify the stop-risk calculation before entry.', reason: G.exitCategory(trade.exitReason), followedPlan: true };
  assert.equal(evaluate(run, 'journal', { ...response, notes: 'done' }).status, 'retry');
  assert.equal(evaluate(run, 'journal', { ...response, reason: 'imaginary' }).status, 'retry');
  assert.equal(evaluate(run, 'journal', { ...response, followedPlan: false }).status, 'retry');
  const good = evaluate(run, 'journal', response);
  assert.equal(good.status, 'pass');
  assert.equal(good.writtenFeedbackEvaluated, false);
  assert.equal(good.evaluation, 'local-rule-check');
});

test('integrated plan requires the written pre-entry record as well as actual protection', () => {
  const missing = setup('complete-plan');
  open(missing, { plan: '' });
  assert.equal(evaluate(missing, 'submit').status, 'retry');
  const good = setup('complete-plan');
  open(good);
  assert.equal(evaluate(good, 'submit').status, 'pass');
  advance(good, 3);
  close(good);
  assert.equal(evaluate(good, 'exit').status, 'pass');
});

test('evaluation cannot use orders or candles beyond the revealed cursor', () => {
  const run = setup('size-long');
  run.cursor++;
  open(run);
  run.cursor--;
  assert.equal(evaluate(run, 'submit').status, 'pending', 'future entry is unavailable at the current cursor');
  const read = setup('read-candle'), original = read.dataset.candles;
  read.dataset = { candles: new Proxy(original, { get(target, key, receiver) {
    if (/^\d+$/.test(String(key)) && Number(key) > read.cursor) throw new Error('Unrevealed candle accessed');
    return Reflect.get(target, key, receiver);
  } }) };
  assert.equal(evaluate(read, 'body', Math.abs(read.scenario.reference.candle.close - read.scenario.reference.candle.open)).status, 'pass');
});

test('evaluation leaves the scenario, account, action record, and response unchanged', () => {
  const run = setup('review-trade');
  open(run); advance(run, 2); const trade = close(run);
  const response = { notes: 'The plan used the fixed stop and time exit. I will verify quantity and risk before the next entry.', reason: G.exitCategory(trade.exitReason), followedPlan: true };
  const before = JSON.stringify({ scenario: run.scenario, account: run.account, events: run.events, response });
  evaluate(run, 'journal', response);
  assert.equal(JSON.stringify({ scenario: run.scenario, account: run.account, events: run.events, response }), before);
});
