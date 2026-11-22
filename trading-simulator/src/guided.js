/* ReplayLab guided practice. Pure local rule checks, not an AI service.
 * Every scenario is built from candles at or before its declared start cursor.
 * Later checks inspect only revealed candles and recorded paper-account actions.
 * Selected teaching examples are not an unbiased strategy performance sample.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ReplayGuided = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const FEE = 0.0004, SLIP = 0.0002, EPS = 1e-7;
  const clone = value => JSON.parse(JSON.stringify(value));
  const money = value => Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const round = value => Math.round(value * 100) / 100;
  const down = value => Math.floor(value * 100 + 1e-8) / 100;
  const up = value => Math.ceil(value * 100 - 1e-8) / 100;
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const option = (value, label) => ({ value, label });
  function lesson(seeTitle, seeText, example, tryTitle, tryText, reviewText) {
    return { seeIt: { title: seeTitle, text: seeText, example }, tryIt: { title: tryTitle, text: tryText }, reviewIt: { title: 'What your result means', text: reviewText } };
  }
  function card(id, title, subtitle, minutes, level, datasetId, startIndex, moduleId, videoIds, content) {
    return { id, title, subtitle, minutes, level, datasetId, startIndex, moduleId, videoIds, lesson: content };
  }

  const items = [
    card('read-candle', 'Read the highlighted candle', 'Find the direction and body on a real AAPL bar.', 6, 'Start here', 'aapl-3m', 40, 'candles', ['candles-video', 'intro'],
      lesson('The body tells you open versus close', 'The candle body spans its open and close. A close above its own open is an up candle; below is a down candle. This describes the completed interval, not the next move.', 'Example: open 100, close 103 gives an up candle with a 3-point body. The previous candle’s close does not determine this color.', 'Inspect, answer, check', 'Use the highlighted starting bar. Choose its direction, then enter its body size. You can inspect the chart before submitting and retry with a hint.', 'Success means you read the bar correctly. It does not mean you predicted the next price.')),
    card('candle-range', 'Separate the body from the range', 'Measure the full move and wick on a real MSFT candle.', 7, 'Chart reading', 'msft-3m', 45, 'candles', ['candles-video'],
      lesson('The extreme prices sit outside the body', 'Full range is high minus low. The upper wick starts at the higher of open and close; it ends at the high. Mixing range and body leads to misleading descriptions of volatility.', 'Example: O 50, H 56, L 48, C 53. Range = 8; body = 3; upper wick = 3.', 'Measure the highlighted bar', 'Enter the full range and upper-wick length of the starting candle. Use price units, not a percentage or a dollar P&L.', 'Both measurements come from completed OHLC values. Neither proves where the next candle will close.')),
    card('identify-trend', 'Recognize the visible structure', 'Compare confirmed swing points on NVDA without looking ahead.', 9, 'Chart reading', 'nvda-3m', 100, 'structure', ['trends-video', 'intro'],
      lesson('Use a stated observation rule', 'For this drill a swing needs two completed bars on each side. Compare the latest two confirmed highs and lows. Nearby levels use the displayed tolerance: both rising means up, both falling means down, both staying nearby means range, and mixed evidence means unclear.', 'Example: highs 102 then 106 and lows 98 then 101 describe rising structure. The latest unconfirmed peak is not yet evidence.', 'Classify, then explain the limit', 'Inspect the marked swing values and choose the structure. Then identify why the most recent two bars cannot confirm their own swing points yet.', 'The feedback checks the declared swing rule. Other swing definitions can differ; a correct label is not a forecast.')),
    card('map-levels', 'Mark the recent range edges', 'Locate a support reference and resistance reference on TSLA.', 9, 'Chart reading', 'tsla-3m', 42, 'structure', ['levels-video', 'trends-video'],
      lesson('Start with a measurable reference', 'This drill defines its two reference levels as the lowest low and highest high in the twelve-bar window ending at the highlighted candle. These are recent range edges, not guaranteed support or resistance.', 'Example: a window’s lowest low is 98.40 and highest high is 103.20. Mark those prices first; then decide what a hold or failure would mean.', 'Find the two prices', 'Enter the lower and upper reference prices from the visible window. Small rounding differences are accepted. Finish by identifying what a breakout can and cannot tell you.', 'You pass by identifying the specified reference window, not by choosing a level that later happens to work.')),
    card('size-long', 'Size a long from its stop', 'Calculate whole shares, then place the actual paper order.', 12, 'Risk and execution', 'aapl-3m', 80, 'sizing', ['risk-video', 'orders-video'],
      lesson('Quantity comes after risk', 'The lab starts with $10,000 paper equity and a 0.5% planned-risk budget: $50. Use the supplied stop and include the displayed fee and slippage assumptions. Round down to whole shares and respect the account’s capital limit.', 'Example: a $50 budget and $1.20 estimated loss per share allow floor(50 ÷ 1.20) = 41 shares, subject to buying power.', 'Calculate, then buy', 'Stay at the starting candle for the calculation. Enter the maximum whole-share quantity, then submit a Buy/Long using that quantity and the supplied stop. The second check reads the actual paper position.', 'Correct sizing can still lead to a losing trade. This check rewards the risk calculation and order settings, not profit.')),
    card('size-short', 'Size a short with the same discipline', 'Reverse the price logic and submit a small paper short on AMD.', 12, 'Risk and execution', 'amd-3m', 85, 'sizing', ['risk-video', 'orders-video'],
      lesson('A short stop belongs above the entry', 'A short loses when price rises. Its adverse entry fill is slightly below the reference price and its stop-exit fill is slightly above the stop. Include both fees, then calculate the whole-share size that fits the $50 paper budget.', 'Example: short reference 80, stop 82, estimated costs $0.10 per share. A $50 budget allows floor(50 ÷ 2.10) = 23 shares before any capital constraint.', 'Calculate, then sell short', 'Use the supplied stop above the price. Enter the maximum whole-share size, then submit Sell/Short. The practice coach checks direction, quantity, protective stop, and modeled risk.', 'This is a simplified paper short. Real stock borrowing, margin, and unlimited price risk require separate understanding.')),
    card('protect-trade', 'Place a complete protective bracket', 'Submit a long with a stop, target, and controlled risk on AMZN.', 12, 'Risk and execution', 'amzn-3m', 85, 'orders', ['orders-video', 'risk-video'],
      lesson('Give the position a failure condition', 'A long bracket places the stop below its entry fill and the target above it. For this exercise, use the displayed stop reference and a target at least twice the entry-to-stop distance. Keep modeled stop risk at or below $50.', 'Example: entry fill 100, stop 98, target 104 gives a gross 2:1 reward-to-risk geometry. Costs reduce the net ratio, and neither exit price is guaranteed in real markets.', 'Configure and submit', 'Enter a stop and target in the order ticket, choose a whole-share quantity within the budget, and click Buy/Long. A typed answer alone does not complete this step.', 'The check confirms the protective plan was submitted. The future target being hit is not a passing requirement.')),
    card('wait-trigger', 'Wait for a completed trigger', 'Practise a real no-trade decision before a potential AAPL breakout.', 10, 'Timing and discipline', 'aapl-3m', 50, 'setups', ['plan-video', 'levels-video'],
      lesson('Define the trigger before advancing', 'The lab’s long trigger is a completed close above the highest high of the initial eight-bar window. An intrabar touch or an urge to avoid missing out does not satisfy that rule. The fixed trigger line will not move as replay advances.', 'Example: the marked trigger is 100. A high of 101 with a close of 99.80 has not met a close-above-100 rule.', 'Observe before deciding', 'First answer whether the trigger exists now. Reveal at least three new candles. If you open a paper trade, it must be a long after a qualifying close; waiting is valid. Then classify the latest visible close.', 'A correct wait can complete the exercise. This lab tests timing under a stated rule, not whether the later move is profitable.')),
    card('handle-loss', 'Follow an exit rule under pressure', 'Keep the original stop and practise a time exit on META.', 14, 'Timing and discipline', 'meta-3m', 80, 'management', ['psychology-video', 'orders-video'],
      lesson('Define the exit while the account is flat', 'This exercise uses a small long with the supplied stop and no profit target. Keep the stop unchanged. If the protective stop does not exit first, close manually at the third new candle after entry. Follow the same rule whether the position is green or red.', 'Example: enter after bar 80. A protective exit at bar 81 or 82 is valid; otherwise manually exit at bar 83. Moving the stop or waiting for recovery changes the exercise.', 'Open, advance, exit', 'Submit the controlled long, step through the next bars, and use Close position at the specified time if it is still open. Then identify the appropriate response to a planned loss.', 'A negative P&L can pass. An unplanned profitable hold can fail. The distinction is whether the exit protocol was followed.')),
    card('equity-check', 'See an open position change equity', 'Connect the chart move with balance and unrealized P&L on GOOG.', 10, 'Account understanding', 'goog-3m', 82, 'foundations', ['basics-video', 'risk-video'],
      lesson('The account changes before you close', 'The balance includes fees already paid and realized outcomes. While a position is open, add its marked unrealized P&L to calculate equity. An open loss counts economically even when it has not been realized.', 'Example: balance after entry fees is 9,998, and 10 long shares move from an entry fill of 100 to a mark of 98. Equity is 9,998 − 20 = 9,978 before future exit costs.', 'Make the number visible', 'Open the supplied small long. Reveal at least one new candle, then calculate current equity from the actual balance, entry fill, quantity, and latest visible close. Use the current values when you submit.', 'The check uses the position you actually hold. If a protective exit has already occurred, equity equals the resulting flat-account balance.')),
    card('review-trade', 'Review a trade with evidence', 'Turn a real MSFT paper trade into a complete journal entry.', 15, 'Review and reflection', 'msft-3m', 90, 'review', ['journal-video', 'plan-video'],
      lesson('Record the decision, then the outcome', 'This drill uses a controlled long, the supplied bracket, and a time exit at the second new candle if neither protective level exits first. Afterward, record the actual exit category, whether the exercise rules were followed, and a factual note.', 'Example note: “The entry used the planned size. The stop exited before the time limit. I followed the plan; next time I will verify the stop-risk calculation before clicking.”', 'Trade, close, journal', 'Submit the planned paper order, reveal the next bars, close at the time limit if still open, and complete the structured review. Include what happened and one specific next action.', 'Local checks verify record completeness and the structured answers. They do not claim to understand or grade the quality of your free-text reflection.')),
    card('complete-plan', 'Complete a coached trading session', 'Combine a written plan, protected entry, exit, and review on NVDA.', 20, 'Integrated practice', 'nvda-3m', 85, 'capstone', ['plan-video', 'journal-video', 'risk-video'],
      lesson('Put the decisions in order', 'This is a mechanics and process rehearsal, not a signal to buy NVDA. Write a long plan, use the supplied stop, set at least 2:1 gross target geometry, and stay within $50 modeled stop risk. Exit protectively or at the third new candle, then review honestly.', 'A complete plan names the instrument, direction, stop, target, quantity, risk budget, and time-exit rule. A later win does not repair a missing plan.', 'Write, submit, manage, review', 'Add a specific plan to the ticket before buying. Submit the complete bracket, advance one candle at a time, and follow the declared exit. Finish with the actual exit category and a useful note.', 'Completion means the defined exercise was executed and recorded. It is not a professional qualification or evidence that the setup has an edge.'))
  ];

  function number(value) {
    if (typeof value === 'boolean' || value === null || value === undefined) return null;
    if (typeof value === 'string' && (!value.trim() || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim()))) return null;
    if (typeof value !== 'string' && typeof value !== 'number') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  function candle(input, index) {
    if (!input || !['time', 'open', 'high', 'low', 'close'].every(key => finite(input[key]))) throw new Error('Candle ' + index + ' is missing valid OHLC values.');
    if (input.low <= 0 || input.low > Math.min(input.open, input.close) || input.high < Math.max(input.open, input.close)) throw new Error('Candle ' + index + ' has inconsistent prices.');
    return { time: input.time, open: input.open, high: input.high, low: input.low, close: input.close, volume: finite(input.volume) ? input.volume : 0 };
  }
  function prefix(candles, cursor) {
    if (!Array.isArray(candles) || !Number.isInteger(cursor) || cursor < 0 || cursor >= candles.length) throw new Error('Reveal a valid candle before checking this step.');
    const result = [];
    for (let i = 0; i <= cursor; i++) result.push(candle(candles[i], i));
    return result;
  }
  function structure(candles) {
    const begin = Math.max(0, candles.length - 36), pivots = [];
    for (let i = Math.max(2, begin); i < candles.length - 2; i++) {
      const at = candles[i], left = candles.slice(i - 2, i), right = candles.slice(i + 1, i + 3);
      if (left.every(x => at.high > x.high) && right.every(x => at.high >= x.high)) pivots.push({ type: 'high', index: i, time: at.time, price: at.high });
      if (left.every(x => at.low < x.low) && right.every(x => at.low <= x.low)) pivots.push({ type: 'low', index: i, time: at.time, price: at.low });
    }
    const highs = pivots.filter(x => x.type === 'high').slice(-2), lows = pivots.filter(x => x.type === 'low').slice(-2);
    const recent = candles.slice(-24), span = Math.max(...recent.map(x => x.high)) - Math.min(...recent.map(x => x.low));
    const tolerance = Math.max(0.01, round(span * 0.12));
    let label = 'unclear';
    if (highs.length === 2 && lows.length === 2) {
      const dh = highs[1].price - highs[0].price, dl = lows[1].price - lows[0].price;
      if (dh > tolerance && dl > tolerance) label = 'up';
      else if (dh < -tolerance && dl < -tolerance) label = 'down';
      else if (Math.abs(dh) <= tolerance && Math.abs(dl) <= tolerance) label = 'range';
    }
    return { label, tolerance, highs, lows, pivots: highs.concat(lows).sort((a, b) => a.index - b.index) };
  }
  function riskMath(side, reference, stop, qty, balance, fee = FEE, slip = SLIP) {
    if (!['long', 'short'].includes(side) || ![reference, stop, qty, balance, fee, slip].every(finite) || reference <= 0 || stop <= 0 || qty <= 0 || balance <= 0 || fee < 0 || fee >= 1 || slip < 0 || slip >= 1) return null;
    const d = side === 'long' ? 1 : -1, entryFill = reference * (1 + d * slip), stopFill = stop * (1 - d * slip);
    if (d * (entryFill - stop) <= 0) return null;
    const riskPerUnit = d * (entryFill - stopFill) + fee * (entryFill + stopFill);
    return { entryFill, stopFill, riskPerUnit, risk: qty * riskPerUnit, notional: qty * entryFill, entryFee: qty * entryFill * fee, capitalUse: qty * entryFill * (1 + fee), maxCapitalQty: Math.floor(balance / (entryFill * (1 + fee))) };
  }
  function maximumShares(side, price, stop, budget, balance, fee = FEE, slip = SLIP) {
    const values = riskMath(side, price, stop, 1, balance, fee, slip);
    if (!values) return 0;
    return Math.max(0, Math.floor(Math.min(budget / values.riskPerUnit, balance / (values.entryFill * (1 + fee))) + EPS));
  }
  function step(id, type, title, prompt, hints, explanation, extra) {
    return Object.assign({ id, type, title, prompt, hint: hints[0], hints, explanation }, extra || {});
  }
  const directions = [option('up', 'Up: close above open'), option('down', 'Down: close below open'), option('flat', 'Flat: close equals open')];
  const structures = [option('up', 'Uptrend under the drill rule'), option('down', 'Downtrend under the drill rule'), option('range', 'Range under the drill rule'), option('unclear', 'Mixed or insufficient evidence')];

  function createScenario(labId, candles, options = {}) {
    const item = items.find(x => x.id === labId);
    if (!item) throw new Error('Unknown guided lab: ' + labId);
    const startIndex = options.startIndex === undefined ? item.startIndex : options.startIndex;
    if (!Number.isInteger(startIndex) || startIndex < 24) throw new Error('This exercise needs at least 25 revealed candles.');
    const seen = prefix(candles, startIndex), bar = seen[seen.length - 1], recent = seen.slice(-12), lastSix = seen.slice(-6);
    const initialBalance = options.initialBalance === undefined ? 10000 : options.initialBalance;
    const feeRate = options.feeRate === undefined ? FEE : options.feeRate, slippageRate = options.slippageRate === undefined ? SLIP : options.slippageRate;
    if (!finite(initialBalance) || initialBalance <= 0 || ![feeRate, slippageRate].every(x => finite(x) && x >= 0 && x < 1)) throw new Error('Use a positive paper balance and valid fee/slippage rates.');
    const riskPct = 0.5, budget = initialBalance * riskPct / 100;
    const low = Math.min(...recent.map(x => x.low)), high = Math.max(...recent.map(x => x.high));
    const averageRange = recent.reduce((n, x) => n + x.high - x.low, 0) / recent.length;
    const longStop = down(Math.min(...lastSix.map(x => x.low)) - Math.max(0.01, averageRange * 0.1));
    const shortStop = up(Math.max(...lastSix.map(x => x.high)) + Math.max(0.01, averageRange * 0.1));
    const longFill = bar.close * (1 + slippageRate), shortFill = bar.close * (1 - slippageRate);
    const longTarget = up(longFill + 2.1 * (longFill - longStop));
    const shortTarget = down(shortFill - 2.1 * (shortStop - shortFill));
    const longQty = maximumShares('long', bar.close, longStop, budget, initialBalance, feeRate, slippageRate);
    const shortQty = maximumShares('short', bar.close, shortStop, budget, initialBalance, feeRate, slippageRate);
    if (longStop <= 0 || shortTarget <= 0 || !longQty || !shortQty) throw new Error('This snapshot cannot fit one whole share inside the exercise budget. Choose another starting point.');
    const smallQty = Math.max(1, Math.min(5, Math.floor(longQty / 2) || 1));
    const swings = structure(seen), trigger = Math.max(...seen.slice(-8).map(x => x.high));
    const sc = Object.assign(clone(item), {
      startIndex, initialBalance, riskPct, feeRate, slippageRate,
      reference: {
        anchorIndex: startIndex, startTime: bar.time, candle: bar, windowStart: startIndex - 11, windowEnd: startIndex,
        low, high, averageRange, budget, entry: bar.close, longStop, shortStop, longTarget, shortTarget, trigger,
        structure: swings,
        levels: [],
        stats: [{ label: 'Paper equity at start', value: initialBalance, unit: 'USD' }, { label: 'Planned-risk budget', value: budget, unit: 'USD' }, { label: 'Starting close', value: bar.close, unit: 'USD' }]
      },
      tradePreset: { side: 'long', qty: smallQty, stop: longStop, target: longTarget },
      steps: [],
      coachingLabel: 'Practice coach · local rule checks',
      dataNote: 'A selected historical teaching snapshot. Read the dataset source notes; intraday sample volume is tick count, not share volume.',
      evaluationNote: 'Success checks the stated process using revealed information. It does not require a profit and does not predict future performance.'
    });
    const body = Math.abs(bar.close - bar.open), range = bar.high - bar.low, upperWick = bar.high - Math.max(bar.open, bar.close);
    const numeric = (id, title, prompt, hints, explanation, unit = 'price units') => step(id, 'number', title, prompt, hints, explanation, { unit });
    const actualTrade = (id, title, prompt, hints, explanation, action = 'open') => step(id, 'trade', title, prompt, hints, explanation, { action });
    const wait = (id, title, prompt, minBars, hints, explanation) => step(id, 'wait', title, prompt, hints, explanation, { minBars });
    const journal = (id, title) => step(id, 'review', title, 'Choose the actual exit category, state whether the lab rules were followed, and write at least 40 characters describing what happened and one next action.', ['Read the closed trade’s recorded exit reason.', 'Stop-gap and same-bar stop exits belong to the Stop category; target-gap belongs to Target.', 'The local coach checks the structured answers and a complete note. Your free-text insight is not semantically graded.'], 'The journal records both the outcome and whether the declared exercise protocol was followed.', { choices: [option('stop', 'Stop / stop gap'), option('target', 'Target / target gap'), option('manual', 'Manual time exit')], minLength: 40 });

    switch (labId) {
      case 'read-candle':
        sc.steps = [
          step('direction', 'choice', 'Read its direction', 'The highlighted bar opens at ' + money(bar.open) + ' and closes at ' + money(bar.close) + '. How should its body be classified?', ['Compare this bar’s close with its own open.', 'Ignore the previous candle when deciding the body direction.', 'Close above open is up; close below open is down.'], 'This bar’s completed open and close determine the answer.', { choices: directions }),
          numeric('body', 'Measure the body', 'What is the absolute size of the highlighted candle body?', ['Use only the open and close.', 'Subtract the smaller of open and close from the larger.', 'The high and low determine the full range, not the body.'], 'Body = |close − open| = ' + money(body) + '.')
        ]; break;
      case 'candle-range':
        sc.steps = [
          numeric('range', 'Measure the full range', 'High is ' + money(bar.high) + ' and low is ' + money(bar.low) + '. What is the full range?', ['Use the two extreme prices.', 'Range = high − low.', 'Do not substitute the open or close for an extreme.'], 'Full range = ' + money(range) + '.'),
          numeric('upper-wick', 'Measure the upper wick', 'How far does the upper wick extend beyond the body?', ['Find the higher of the open and close.', 'Subtract that body edge from the high.', 'High ' + money(bar.high) + ' minus the upper body edge ' + money(Math.max(bar.open, bar.close)) + '.'], 'Upper wick = high − max(open, close) = ' + money(upperWick) + '.')
        ]; break;
      case 'identify-trend': {
        const highText = swings.highs.map(x => money(x.price)).join(' then ') || 'not enough confirmed highs';
        const lowText = swings.lows.map(x => money(x.price)).join(' then ') || 'not enough confirmed lows';
        sc.reference.levels = swings.pivots.map(x => ({ id: x.type + '-' + x.index, label: 'Confirmed ' + x.type, price: x.price }));
        sc.steps = [
          step('structure', 'choice', 'Classify the confirmed structure', 'Latest confirmed highs: ' + highText + '. Lows: ' + lowText + '. The drill’s nearby-level tolerance is ' + money(swings.tolerance) + '. Which label fits?', ['Compare the two highs and the two lows separately.', 'Both changes must exceed the tolerance in the same direction to call a trend.', 'Both pairs inside the tolerance mean range; mixed or missing pairs mean unclear.'], 'The answer follows the declared two-sided swing and tolerance rule, not later candles.', { choices: structures }),
          step('confirmation', 'choice', 'Respect the information boundary', 'Why are the most recent two bars excluded as confirmed swing centers in this drill?', ['Look at how many bars the swing rule needs on its right.', 'Confirmation requires two later completed bars.', 'A candidate peak may still be exceeded before those bars close.'], 'The right-side confirmation bars have not yet been revealed.', { choices: [option('need-later-bars', 'Their two later confirmation bars are not yet available'), option('never-swings', 'Recent bars can never become swings'), option('predict-next', 'They already reveal the next direction')] })
        ]; break;
      }
      case 'map-levels':
        sc.steps = [
          numeric('support', 'Mark the lower reference', 'What is the lowest low in the twelve-bar window ending at the highlighted candle?', ['Scan the low of each bar in the specified window.', 'Use the lowest traded low, not the lowest close.', 'The window starts at bar ' + (startIndex - 10) + ' and ends at bar ' + (startIndex + 1) + ' in one-based numbering.'], 'The drill’s lower range reference is ' + money(low) + '.', 'USD price'),
          numeric('resistance', 'Mark the upper reference', 'What is the highest high in that same twelve-bar window?', ['Use the same window as the lower reference.', 'Scan highs rather than candle closes.', 'This is a measured range edge, not a prediction of a reversal.'], 'The drill’s upper range reference is ' + money(high) + '.', 'USD price'),
          step('level-limit', 'choice', 'Understand the line’s limit', 'What does marking these range edges give you?', ['A reference is not a guarantee.', 'Price may hold, break, or break and return.', 'Use a level to define a decision and an invalidation.'], 'The levels organize a hypothesis without promising the future path.', { choices: [option('guarantee', 'A guarantee that price will reverse'), option('reference', 'Reference prices for a conditional plan'), option('must-buy', 'An instruction to buy immediately')] })
        ]; break;
      case 'size-long': case 'size-short': {
        const isLong = labId === 'size-long', side = isLong ? 'long' : 'short', stop = isLong ? longStop : shortStop, target = isLong ? longTarget : shortTarget;
        const calc = riskMath(side, bar.close, stop, 1, initialBalance, feeRate, slippageRate);
        sc.tradePreset = { side, stop, target };
        sc.reference.levels = [{ id: 'stop', label: 'Required stop', price: stop }];
        sc.reference.stats.push({ label: 'Modeled stop risk per share', value: calc.riskPerUnit, unit: 'USD' });
        sc.steps = [
          numeric('quantity', 'Calculate whole shares', 'At the starting close ' + money(bar.close) + ', stop ' + money(stop) + ', and $' + money(budget) + ' budget, how many whole shares fit after the stated costs and capital limit?', ['Use the displayed modeled stop risk per share, which includes entry and stop-exit costs.', 'Divide the budget by per-share risk, then round down.', 'Also cap quantity by available capital including the entry fee.'], 'Use the smaller of the risk-based and capital-based quantities, rounded down.', 'whole shares'),
          actualTrade('submit', 'Place the paper ' + side, 'Submit ' + (isLong ? 'Buy/Long' : 'Sell/Short') + ' with the supplied stop and the maximum whole-share quantity permitted at the actual entry. A quantity typed into the quiz is not an order.', ['Set the correct direction and supplied stop in the ticket.', 'If you advanced price, recalculate from the actual entry rather than keeping an old quantity.', 'The grader reads the executed paper position and its modeled risk.'], 'An actual paper order must respect direction, stop, whole-share sizing, cost assumptions, and the budget.')
        ]; break;
      }
      case 'protect-trade':
        sc.tradePreset = { side: 'long', qty: smallQty };
        sc.reference.levels = [{ id: 'stop', label: 'Required stop', price: longStop }, { id: 'target-example', label: 'Example target above 2:1', price: longTarget }];
        sc.steps = [
          step('bracket-logic', 'choice', 'Put the exits on the correct sides', 'For this long exercise, where should the protective stop and profit target be relative to the entry fill?', ['A long loses when price falls.', 'Its stop belongs below entry; its target belongs above.', 'A stop is a planned trigger, not a guaranteed maximum loss.'], 'A long bracket places the loss-side exit below entry and the favorable exit above.', { choices: [option('long-bracket', 'Stop below; target above'), option('short-bracket', 'Stop above; target below'), option('no-stop', 'A target makes a stop unnecessary')] }),
          actualTrade('submit', 'Submit the bracketed long', 'Use stop ' + money(longStop) + ', a target at least 2× the entry-to-stop distance above the entry fill, and whole shares within the $' + money(budget) + ' budget.', ['Enter both protective levels before buying.', 'Calculate gross geometry from the simulated entry fill, not just the rounded chart close.', 'Reduce quantity if modeled stop loss plus costs exceeds the budget.'], 'The check rewards the submitted risk plan, regardless of what the future price does.')
        ]; break;
      case 'wait-trigger':
        sc.reference.levels = [{ id: 'trigger', label: 'Fixed close-above trigger', price: trigger }];
        sc.steps = [
          step('initial-decision', 'choice', 'Is the trigger present at the start?', 'The rule needs a completed close strictly above ' + money(trigger) + '. At the highlighted starting close, should you enter or wait?', ['Compare close, not high, with the trigger.', 'The close must be strictly above the line.', 'A high touching the line does not satisfy a close-above rule.'], 'The initial line includes the starting window’s high, so the starting close has not broken above it.', { choices: [option('enter', 'The close trigger is present'), option('wait', 'Wait: the close trigger is absent')] }),
          wait('observe', 'Reveal three more candles', 'Advance at least three candles. Any paper entry during this observation must be a long after a completed close above the fixed trigger; you may also stay flat.', 3, ['Use Step to reveal one completed bar at a time.', 'Keep the original trigger line fixed.', 'A trade before the close trigger is a timing breach, even if it later wins.'], 'This checkpoint inspects the revealed bars and actual recorded entries, not future outcomes.'),
          step('current-decision', 'choice', 'Classify the current visible close', 'Using the latest revealed close and the unchanged trigger, is the close-above condition currently present?', ['Read the latest completed close.', 'Compare it with the original fixed trigger, not a newly moved line.', 'A present condition allows further risk evaluation; it does not guarantee a profitable entry.'], 'The answer is recomputed from the current revealed close.', { choices: [option('enter', 'The close condition is present; evaluate the full plan'), option('wait', 'The close condition is absent; wait')] })
        ]; break;
      case 'handle-loss':
        sc.tradePreset = { side: 'long', qty: smallQty, stop: longStop, target: null };
        sc.reference.levels = [{ id: 'stop', label: 'Keep this stop', price: longStop }];
        sc.steps = [
          actualTrade('submit', 'Open the small controlled long', 'Buy whole shares within the budget, using stop ' + money(longStop) + ' and no target. If not stopped first, your manual exit is exactly three new bars after entry.', ['Leave the target blank for this time-exit exercise.', 'Keep the supplied stop and budget.', 'Record the entry bar so you know when three new bars have elapsed.'], 'The position must have the declared protection and no different profit-exit rule.'),
          wait('observe', 'Allow the exit condition to occur', 'Step forward until the stop exits or the third new bar after entry is revealed. Do not widen the stop.', 3, ['The entry candle is bar zero for this count.', 'A protective stop may exit before the third bar.', 'If still open after the third new bar, close now under the time rule.'], 'A planned stop or reaching the time limit supplies a legitimate exit decision.'),
          actualTrade('exit', 'Follow the stop or time exit', 'If still open at the third new bar, use Close position. A protective stop exit before that is also valid.', ['A green or red P&L does not change the time rule.', 'Check the closed trade’s bar count and reason.', 'A late manual exit requires a fresh attempt; do not rewrite the original rule.'], 'The time or stop rule is evaluated independently of P&L.', 'close'),
          step('after-loss', 'choice', 'Choose the next response', 'If a trade followed this protocol and lost, what should the next decision use?', ['A loss is not a debt the market owes you.', 'Keep the original risk budget.', 'Require a fresh setup instead of doubling to recover.'], 'A planned loss is recorded and reviewed; it does not justify a larger revenge trade.', { choices: [option('double', 'Double the next size to recover'), option('hide', 'Remove the losing record'), option('same-process', 'Keep the budget and wait for a fresh setup')] })
        ]; break;
      case 'equity-check':
        sc.steps = [
          actualTrade('submit', 'Create a position to observe', 'Open the supplied small long with whole shares and the protective stop. The next check uses this actual paper position.', ['Use the supplied small quantity.', 'Keep the stop so the exercise remains controlled.', 'The entry fee is paid when the paper position opens.'], 'The account must contain a real lab paper trade, not just a typed calculation.'),
          wait('observe', 'Reveal a price change', 'Advance at least one new candle after the entry. A protective exit is allowed if the historical bar reaches it.', 1, ['The latest mark changes as you step.', 'Balance and equity may differ while a position is open.', 'If the position closed protectively, the realized balance now includes its result.'], 'The price change must actually have been revealed.'),
          numeric('equity', 'Calculate current equity', 'Using the current visible close, what is this lab account’s equity? Include fees already paid; do not subtract estimated future exit costs.', ['Start with the current account balance.', 'For an open long add quantity × (current close − entry fill); reverse the subtraction for a short.', 'If the account is flat, equity equals its current balance.'], 'The expected answer is recomputed from the actual account and latest revealed close.', 'USD')
        ]; break;
      case 'review-trade':
        sc.steps = [
          actualTrade('submit', 'Open the planned paper trade', 'Submit the supplied bracketed long within the risk budget. Close at the second new candle if the stop or target has not exited first.', ['Keep the supplied stop and target geometry.', 'Use whole shares within the budget.', 'Note the entry bar; the time limit is two new bars.'], 'The order must match the declared exercise plan.'),
          actualTrade('exit', 'Close under the declared rule', 'Allow a protective exit, or close manually at the second new candle after entry.', ['Step one candle at a time.', 'Do not close early only because P&L is uncomfortable.', 'If still open at two new bars, use Close position.'], 'The closed record must show a protective exit by the time limit or an on-time manual exit.', 'close'),
          journal('journal', 'Write the factual review')
        ]; break;
      case 'complete-plan':
        sc.tradePreset.plan = 'Practice long; use the supplied stop, a target at least 2:1 from entry, risk no more than $' + money(budget) + ', and exit at the third new bar if neither protective level exits first.';
        sc.steps = [
          step('plan-first', 'choice', 'Put the plan before the result', 'Which information belongs in the ticket before you open the paper trade?', ['Think about what you can decide before the outcome.', 'Direction, size, invalidation, target, and time exit can all be planned.', 'Future candles and a guaranteed profit are unavailable.'], 'The plan describes decisions and limits rather than a promised outcome.', { choices: [option('profit-first', 'Only the profit you want'), option('complete', 'Direction, quantity, stop, target, budget, and time exit'), option('future', 'The next three candle closes')] }),
          actualTrade('submit', 'Submit the written, protected plan', 'Write at least 20 characters describing the plan in the order ticket. Buy whole shares using the supplied stop, at least 2:1 gross target geometry, and no more than $' + money(budget) + ' modeled risk.', ['The note must exist before the order is submitted.', 'A plan note does not replace actual stop and target settings.', 'The check reads the stored entry plan and executed paper order.'], 'The submitted position must contain the written plan and the declared risk settings.'),
          actualTrade('exit', 'Execute the stop, target, or time exit', 'Follow the protective exit if it occurs first; otherwise close manually exactly three new bars after entry.', ['Count from the entry bar.', 'Stop and target remain part of the original plan.', 'A profitable but late manual exit still changes the exercise.'], 'Execution is scored from recorded actions, without rewarding future profit.', 'close'),
          journal('journal', 'Review the completed exercise')
        ]; break;
    }
    sc.steps.forEach(item => { item.videoIds = sc.videoIds.slice(); item.moduleId = sc.moduleId; });
    return sc;
  }

  function answerResult(sc, item, status, message, explanation, extra) {
    return Object.assign({ status, passed: status === 'pass', message, explanation: explanation || item.explanation, hint: item.hint, hints: item.hints.slice(), moduleId: sc.moduleId, videoIds: item.videoIds.slice(), retryAllowed: status !== 'pass', evaluation: 'local-rule-check' }, extra || {});
  }
  function visible(sc, context) {
    if (!context || !Array.isArray(context.candles)) throw new Error('The active replay chart is required for this check.');
    const cursor = context.cursor;
    if (!Number.isInteger(cursor) || cursor < sc.startIndex) throw new Error('Return to the guided lab’s starting point before checking this step.');
    const bars = prefix(context.candles, cursor);
    if (bars[sc.startIndex].time !== sc.reference.startTime) throw new Error('This chart is not the historical snapshot for the active lab. Restart the lab.');
    return { bars, cursor, bar: bars[bars.length - 1] };
  }
  function labPositions(sc, context, view) {
    const account = context && context.account;
    if (!account || !Array.isArray(account.trades)) return [];
    const values = account.trades.slice();
    if (account.position) values.push(account.position);
    return values.filter(p => p && Number.isInteger(p.entryBarIndex) && p.entryBarIndex >= sc.startIndex && p.entryBarIndex <= view.cursor && finite(p.entryTime) && p.entryTime === view.bars[p.entryBarIndex].time && (!Number.isInteger(p.exitBarIndex) || p.exitBarIndex <= view.cursor));
  }
  function latestPosition(sc, context, view) {
    return labPositions(sc, context, view).sort((a, b) => b.entryBarIndex - a.entryBarIndex || (b.exitBarIndex || Infinity) - (a.exitBarIndex || Infinity))[0] || null;
  }
  function timeLimit(sc) { return sc.id === 'review-trade' ? 2 : 3; }
  function exitCategory(reason) {
    if (typeof reason !== 'string') return 'unknown';
    if (reason.startsWith('stop')) return 'stop';
    if (reason.startsWith('target')) return 'target';
    if (reason === 'manual' || reason === 'time' || reason === 'time_exit' || reason === 'lab_time_exit') return 'manual';
    return 'unknown';
  }
  function requirements(sc, p, context) {
    if (!p) return { ok: false, code: 'missing', message: 'Place the actual paper order first.' };
    const side = sc.id === 'size-short' ? 'short' : 'long';
    if (p.side !== side) return { ok: false, code: 'side', message: 'This exercise requires a ' + side + '. Your recorded position is ' + String(p.side) + '.' };
    if (!finite(p.qty) || p.qty <= 0 || Math.abs(p.qty - Math.round(p.qty)) > EPS) return { ok: false, code: 'quantity', message: 'Use a positive whole-share quantity for this stock exercise.' };
    const stop = side === 'long' ? sc.reference.longStop : sc.reference.shortStop;
    if (!finite(p.stop) || Math.abs(p.stop - stop) > 0.011) return { ok: false, code: 'stop', message: 'Use the declared stop at ' + money(stop) + '. A missing or changed stop does not follow this lab plan.' };
    const account = context.account;
    if (!account || !finite(account.feeRate) || !finite(account.slippageRate)) return { ok: false, code: 'account', message: 'The paper account’s fee and slippage settings are unavailable.' };
    if (Math.abs(account.feeRate - sc.feeRate) > EPS || Math.abs(account.slippageRate - sc.slippageRate) > EPS) return { ok: false, code: 'cost-model', message: 'The account costs differ from this exercise. Restart the lab with the displayed assumptions.' };
    const calc = riskMath(p.side, p.entryReferencePrice, p.stop, p.qty, sc.initialBalance, account.feeRate, account.slippageRate);
    if (!calc || !finite(p.entryPrice) || Math.abs(calc.entryFill - p.entryPrice) > 0.011) return { ok: false, code: 'entry', message: 'The recorded fill does not match a valid entry under the lab’s cost model.' };
    if (calc.risk > sc.reference.budget + EPS) return { ok: false, code: 'budget', message: 'Modeled stop risk is $' + money(calc.risk) + ', above the $' + money(sc.reference.budget) + ' budget. Reduce the whole-share quantity.' };
    if (calc.capitalUse > sc.initialBalance + EPS) return { ok: false, code: 'capital', message: 'The order uses more than the lab’s available unleveraged capital including entry fees.' };
    if (sc.id === 'size-long' || sc.id === 'size-short') {
      const expected = maximumShares(p.side, p.entryReferencePrice, p.stop, sc.reference.budget, sc.initialBalance, account.feeRate, account.slippageRate);
      if (p.qty !== expected) return { ok: false, code: 'size-answer', message: 'At this actual entry, the maximum permitted whole-share size is ' + expected + '. Your order used ' + p.qty + '.' };
    }
    if (sc.id === 'handle-loss') {
      if (p.target !== null && p.target !== undefined) return { ok: false, code: 'target', message: 'Leave the target blank in this exercise: the original plan is stop or a three-bar time exit.' };
    } else if (['protect-trade', 'review-trade', 'complete-plan'].includes(sc.id)) {
      if (!finite(p.target) || p.target <= p.entryPrice) return { ok: false, code: 'target', message: 'Add a profit target above the long entry fill.' };
      const ratio = (p.target - p.entryPrice) / (p.entryPrice - p.stop);
      if (ratio + EPS < 2) return { ok: false, code: 'geometry', message: 'This target has ' + ratio.toFixed(2) + ':1 gross geometry. Move the planned target to at least 2:1 or restart the exercise with an appropriate plan.' };
    }
    if (sc.id === 'complete-plan' && (typeof p.plan !== 'string' || p.plan.trim().length < 20)) return { ok: false, code: 'plan', message: 'Write the plan in the ticket before submitting. The stored entry plan needs at least 20 characters.' };
    return { ok: true, code: 'matched', message: 'The recorded order follows the stated direction, size, protection, and risk rules.', risk: calc.risk };
  }
  function exitCheck(sc, p, context) {
    const entry = requirements(sc, p, context);
    if (!entry.ok) return entry;
    if (!Number.isInteger(p.exitBarIndex)) return { ok: false, code: 'open', message: 'The position is still open. Wait for a protective exit or use the declared time exit.' };
    const held = p.exitBarIndex - p.entryBarIndex, limit = timeLimit(sc), category = exitCategory(p.exitReason);
    if (held < 1) return { ok: false, code: 'early', message: 'The exercise requires observing new candles before a manual exit. This trade was closed on its entry bar.' };
    if ((category === 'stop' || category === 'target') && held <= limit) return { ok: true, code: 'protective', message: 'The protective exit followed the plan before the time limit.' };
    if (category === 'manual' && held === limit) return { ok: true, code: 'on-time', message: 'The manual exit occurred exactly ' + limit + ' new bars after entry, as planned.' };
    return { ok: false, code: 'timing', message: 'This trade exited after ' + held + ' new bars by ' + category + '. The exercise required a protective exit by bar ' + limit + ' or a manual exit exactly at bar ' + limit + '. Retry from a fresh lab account.' };
  }

  function evaluate(sc, stepId, response, context = {}) {
    if (!sc || !items.some(x => x.id === sc.id) || !Array.isArray(sc.steps)) throw new Error('Create a guided scenario before evaluating it.');
    const item = sc.steps.find(x => x.id === stepId);
    if (!item) throw new Error('Unknown guided checkpoint: ' + stepId);
    const pass = (message, explanation, extra) => answerResult(sc, item, 'pass', message, explanation, extra);
    const retry = (message, explanation, extra) => answerResult(sc, item, 'retry', message, explanation, extra);
    const pending = message => answerResult(sc, item, 'pending', message);
    let view;
    try { view = visible(sc, context); }
    catch (err) { return pending(err.message); }
    const anchor = sc.reference.candle;
    if (item.type === 'choice') {
      let correct, explanation = item.explanation;
      if (stepId === 'direction') {
        correct = anchor.close > anchor.open ? 'up' : anchor.close < anchor.open ? 'down' : 'flat';
        explanation = 'Open ' + money(anchor.open) + ', close ' + money(anchor.close) + ': the completed candle is ' + correct + '. The next candle is a separate question.';
      } else if (stepId === 'structure') { correct = sc.reference.structure.label; explanation = 'Using the displayed confirmed swings and tolerance, the label is ' + correct + '. This does not predict continuation.'; }
      else if (stepId === 'confirmation') correct = 'need-later-bars';
      else if (stepId === 'level-limit') correct = 'reference';
      else if (stepId === 'bracket-logic') correct = 'long-bracket';
      else if (stepId === 'initial-decision') correct = 'wait';
      else if (stepId === 'current-decision') {
        if (view.cursor < sc.startIndex + 3) return pending('Reveal at least three new candles before checking the current decision.');
        correct = view.bar.close > sc.reference.trigger ? 'enter' : 'wait';
        explanation = 'Current close ' + money(view.bar.close) + ' versus fixed trigger ' + money(sc.reference.trigger) + ': ' + (correct === 'enter' ? 'the close condition is present; risk checks are still required.' : 'the close condition is absent, so the rule says wait.');
      } else if (stepId === 'after-loss') correct = 'same-process';
      else if (stepId === 'plan-first') correct = 'complete';
      const value = typeof response === 'string' ? response.trim() : '';
      if (!item.choices.some(x => x.value === value)) return retry('Choose one of the listed answers before checking.');
      return value === correct ? pass('That matches the evidence and the stated rule.', explanation) : retry('Try again: separate the visible evidence from a prediction.', explanation);
    }
    if (item.type === 'number') {
      const value = number(response);
      if (value === null) return retry('Enter a finite number in the requested units. A blank answer is not zero.');
      let expected, tolerance = 0.011, explanation = item.explanation;
      if (stepId === 'body') expected = Math.abs(anchor.close - anchor.open);
      else if (stepId === 'range') expected = anchor.high - anchor.low;
      else if (stepId === 'upper-wick') expected = anchor.high - Math.max(anchor.open, anchor.close);
      else if (stepId === 'support' || stepId === 'resistance') { expected = stepId === 'support' ? sc.reference.low : sc.reference.high; tolerance = Math.max(0.011, (sc.reference.high - sc.reference.low) * 0.02); }
      else if (stepId === 'quantity') {
        const side = sc.id === 'size-short' ? 'short' : 'long', stop = side === 'long' ? sc.reference.longStop : sc.reference.shortStop;
        expected = maximumShares(side, anchor.close, stop, sc.reference.budget, sc.initialBalance, sc.feeRate, sc.slippageRate); tolerance = EPS;
        explanation = 'At the starting snapshot, the maximum is ' + expected + ' whole shares after modeled costs and the capital limit. Recalculate if you change the actual entry price.';
      } else if (stepId === 'equity') {
        const p = latestPosition(sc, context, view), account = context.account;
        if (!p || view.cursor <= p.entryBarIndex) return pending('Open a lab position and reveal at least one new candle before calculating its equity.');
        if (!account || !finite(account.balance)) return pending('The active paper-account balance is unavailable.');
        const open = account.position;
        if (open && (!Number.isInteger(open.entryBarIndex) || open.entryBarIndex > view.cursor || ![open.qty, open.entryPrice].every(finite))) return pending('The open position is not supported by the revealed chart.');
        const unrealized = open ? (open.side === 'long' ? 1 : -1) * open.qty * (view.bar.close - open.entryPrice) : 0;
        expected = account.balance + unrealized; tolerance = 0.021;
        explanation = 'Balance ' + money(account.balance) + ' + unrealized P&L ' + money(unrealized) + ' = equity ' + money(expected) + '. Future exit costs are not subtracted in this mark-to-market figure.';
      }
      if (!finite(expected)) return pending('The information required for this calculation is not available.');
      const evidence = { expected: round(expected), tolerance };
      return Math.abs(value - expected) <= tolerance ? pass('Your calculation matches the visible data.', explanation, evidence) : retry('Try the calculation again in ' + item.unit + '.', explanation, evidence);
    }
    if (item.type === 'wait') {
      if (sc.id === 'wait-trigger') {
        const entries = labPositions(sc, context, view);
        const recorded = Array.isArray(context.events) ? context.events.filter(e => e && e.type === 'open' && Number.isInteger(e.barIndex) && e.barIndex >= sc.startIndex && e.barIndex <= view.cursor) : [];
        for (const p of entries) {
          if (p.side !== 'long' || view.bars[p.entryBarIndex].close <= sc.reference.trigger) return retry('An entry occurred before the declared close-above trigger, or in the wrong direction. Restart and practise waiting.', 'A later gain cannot repair an early entry under this timing rule.');
        }
        for (const event of recorded) {
          const p = event.position || {};
          if ((p.side && p.side !== 'long') || view.bars[event.barIndex].close <= sc.reference.trigger) return retry('The action record contains an entry before the close trigger. Retry the timing exercise.', 'The grader uses the close at the recorded entry bar, not a later price.');
        }
        if (view.cursor < sc.startIndex + 3) return pending('Reveal ' + (sc.startIndex + 3 - view.cursor) + ' more candle(s). Staying flat while waiting is valid.');
        return pass('You observed the required bars without an early-trigger entry.', entries.length ? 'The recorded entries occurred only after the visible close condition. This does not establish a profitable strategy.' : 'Waiting was a real rule-consistent action; no trade was required.');
      }
      const p = latestPosition(sc, context, view);
      if (!p) return pending('Open the exercise’s paper position first.');
      const check = requirements(sc, p, context);
      if (!check.ok) return retry(check.message);
      if (Number.isInteger(p.exitBarIndex)) {
        if (sc.id === 'equity-check' && p.exitBarIndex > p.entryBarIndex) return pass('A later candle and the resulting account change have been observed.');
        const exit = exitCheck(sc, p, context);
        return exit.ok ? pass(exit.message) : retry(exit.message);
      }
      const elapsed = view.cursor - p.entryBarIndex;
      if (elapsed < item.minBars) return pending('Reveal ' + (item.minBars - elapsed) + ' more candle(s) after entry, unless a protective exit occurs first.');
      if (sc.id === 'handle-loss' && elapsed > 3) return retry('The three-bar time exit has been missed while the position remains open. Restart to practise the original rule.');
      return pass('The required new candles are now visible.', sc.id === 'handle-loss' ? 'The time-exit condition is here. Close the still-open position now, regardless of P&L.' : item.explanation);
    }
    const p = latestPosition(sc, context, view);
    if (item.type === 'trade') {
      if (!p) return pending('Use the order ticket to place the actual paper trade. A written answer does not create a position.');
      const check = item.action === 'close' ? exitCheck(sc, p, context) : requirements(sc, p, context);
      if (!check.ok) return check.code === 'open' || check.code === 'missing' ? pending(check.message) : retry(check.message);
      return pass(check.message, item.action === 'close' ? 'Recorded exit: ' + p.exitReason + '. Net P&L: ' + money(p.netPnl) + '. The result passes because the exit rule was followed, not because of its sign.' : 'Modeled stop risk: $' + money(check.risk) + ' within the $' + money(sc.reference.budget) + ' budget. No future candles were used.', { tradeId: p.id || null });
    }
    if (item.type === 'review') {
      if (!p || !Number.isInteger(p.exitBarIndex)) return pending('Close the exercise trade under its plan before completing the review.');
      const input = response && typeof response === 'object' ? response : {}, notes = typeof input.notes === 'string' ? input.notes.trim() : '';
      if (notes.length < item.minLength) return retry('Add a factual note of at least ' + item.minLength + ' characters: what happened and one specific next action.', 'This is a completeness check, not an AI judgment of your writing.');
      const reason = exitCategory(p.exitReason);
      if (input.reason !== reason) return retry('The recorded exit category is ' + reason + '. Use the actual closed-trade record.', 'A stop gap is still a stop exit; a target gap is still a target exit.');
      const followed = exitCheck(sc, p, context).ok;
      if (typeof input.followedPlan !== 'boolean') return retry('Choose whether the exercise plan was followed; keep that separate from profit.');
      if (input.followedPlan !== followed) return retry(followed ? 'The recorded order and exit followed this lab protocol, even if the trade lost.' : 'The record contains a protocol breach. Mark it honestly and use the feedback to retry the execution.', exitCheck(sc, p, context).message);
      return pass('The structured review is complete and matches the record.', 'Your note is recorded for reflection. Local checks verified the category and plan-adherence answer; they did not evaluate the meaning or quality of the free text.', { tradeId: p.id || null, writtenFeedbackEvaluated: false, followedPlan: followed });
    }
    return pending('This checkpoint type is unavailable.');
  }

  return Object.freeze({ items, createScenario, evaluate, riskMath, maximumShares, structure, exitCategory, label: 'Practice coach · local rule checks', version: '2026.11.3' });
});
