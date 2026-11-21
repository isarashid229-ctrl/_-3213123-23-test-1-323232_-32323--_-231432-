(function (global) {
  'use strict';

  // Standalone, dependency-free learning labs. All charts are invented teaching
  // examples, never market data or forecasts. Completing a round is the only
  // event that reports a score to the host application.
  const items = [
    { id: 'candles', title: 'Read the candle', skill: 'Chart literacy', minutes: 6, description: 'Decode bodies, wicks, and what one candle can actually tell you.' },
    { id: 'structure', title: 'Find the market structure', skill: 'Price context', minutes: 7, description: 'Recognize rising swings, falling swings, ranges, and broken assumptions.' },
    { id: 'levels', title: 'Mark the useful levels', skill: 'Support & resistance', minutes: 7, description: 'Place levels on a chart and distinguish a reaction area from a guarantee.' },
    { id: 'sizing', title: 'Size the risk first', skill: 'Position sizing', minutes: 8, description: 'Turn an account limit and an invalidation price into a planned position size.' },
    { id: 'orders', title: 'Choose the right order', skill: 'Execution', minutes: 6, description: 'Practice the trade-offs between execution speed, price limits, and stop triggers.' },
    { id: 'riskreward', title: 'Build a valid trade plan', skill: 'Risk & reward', minutes: 7, description: 'Check direction, calculate planned R, and spot an invalid protective stop.' },
    { id: 'expectancy', title: 'Look beyond win rate', skill: 'Trade review', minutes: 8, description: 'Calculate results after costs and separate a small sample from a proven edge.' },
    { id: 'discipline', title: 'Make the disciplined decision', skill: 'Trading process', minutes: 6, description: 'Work through FOMO, revenge trading, loss limits, and outcome bias.' }
  ];

  const sources = {
    sizing: { title: 'CME Group: Proper Position Size', url: 'https://www.cmegroup.com/education/courses/trade-and-risk-management/proper-position-size' },
    orders: { title: 'Investor.gov: Understanding Order Types', url: 'https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-14' },
    riskreward: { title: 'CME Group: Position and Risk Management', url: 'https://www.cmegroup.com/education/courses/things-to-know-before-trading-cme-futures/position-and-risk-management' },
    expectancy: { title: 'CME Group: The Mathematics of Trading Success', url: 'https://www.cmegroup.com/education/courses/trading-psychology/the-mathematics-of-trading-success' }
  };

  const escape = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const money = n => '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const sample = values => values[Math.floor(Math.random() * values.length)];
  const shuffle = array => {
    const copy = array.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };
  const choice = (prompt, correct, others, explanation, extra) => Object.assign({ type: 'choice', prompt, correct, choices: [correct].concat(others), explanation }, extra || {});
  const numeric = (prompt, answer, explanation, extra) => Object.assign({ type: 'number', prompt, answer, tolerance: 0.01, explanation, unit: '', hint: 'Enter a number.' }, extra || {});

  function candleQuestions() {
    const open = sample([50, 80, 100, 120]);
    const body = sample([3, 4, 6]);
    const upper = sample([2, 3, 5]);
    const lower = sample([1, 2, 4]);
    const bullish = Math.random() > 0.5;
    const close = open + (bullish ? body : -body);
    const high = Math.max(open, close) + upper;
    const low = Math.min(open, close) - lower;
    const diagram = { type: 'candle', open, close, high, low };
    return [
      choice('Did this candle close above or below its open?', bullish ? 'Above its open: a bullish body.' : 'Below its open: a bearish body.', [bullish ? 'Below its open: a bearish body.' : 'Above its open: a bullish body.', 'The wick determines the open-to-close direction.'], `The open is ${money(open)} and the close is ${money(close)}. Body direction compares those two prices; the high and low describe the wider range.`, { diagram }),
      numeric('How large is the candle body?', body, `Body size is |close − open| = |${close} − ${open}| = ${body}. The full high-to-low range includes the wicks.`, { unit: 'price units', diagram, hint: 'Use the absolute difference between the open and the close.' }),
      numeric('How long is the upper wick?', upper, `The upper wick runs from the higher of open or close to the high: ${high} − ${Math.max(open, close)} = ${upper}.`, { unit: 'price units', diagram, hint: 'High minus the top of the body.' }),
      choice('The next candle closes almost exactly where it opened. What does the small body establish?', 'There was little net open-to-close movement during that candle.', ['A reversal is guaranteed on the next candle.', 'No trading took place during that candle.'], 'A small body describes the relationship between open and close. Price may still have moved substantially within the candle, and the shape alone does not establish what comes next.', { diagram: { type: 'candle', open: 100, close: 100.2, high: 105, low: 96 } }),
      choice('A long lower wick appears after a decline. What is the most defensible reading?', 'Price traded lower and then closed above the low; I still need context and a defined plan.', ['The market must rise next, so any entry size is safe.', 'The lowest price is now a guaranteed floor.'], 'The wick records a lower traded price and a later close above it. It is an observation, not a forecast. Check surrounding structure, your entry rule, and the price that would invalidate the idea.', { diagram: { type: 'candle', open: 102, close: 103, high: 104, low: 94 } })
    ];
  }

  function structureQuestions() {
    return [
      choice('Which structure do these completed swings describe?', 'An uptrend: successively higher swing highs and higher swing lows.', ['A downtrend: lower highs and lower lows.', 'A range: highs and lows stay near fixed boundaries.'], 'The highs rise from 106 to 110 to 114, while the pullback lows rise from 103 to 107. That describes the visible structure; it does not guarantee continuation.', { diagram: { type: 'swings', points: [100, 106, 103, 110, 107, 114] } }),
      choice('Which structure do these completed swings describe?', 'A downtrend: successively lower swing highs and lower swing lows.', ['An uptrend: higher highs and higher lows.', 'A flat market with no direction.'], 'The bounces peak at lower prices and each decline makes a lower low. A temporary green candle would not, by itself, reverse that sequence.', { diagram: { type: 'swings', points: [114, 108, 111, 104, 107, 100] } }),
      choice('What is the clearest description of this sequence?', 'A range between repeated reaction areas near 100 and 110.', ['A clean uptrend because the last move is up.', 'A clean downtrend because one candle is red.'], 'Repeated highs near 110 and lows near 100 describe a range. The most recent leg alone is not the whole structure. A future break can still fail.', { diagram: { type: 'swings', points: [102, 110, 100, 109, 101, 110, 100, 106] } }),
      choice('A rising sequence was in place. Price then closes at 102, below the prior swing low of 107. What changes?', 'The previous higher-low assumption is broken; reassess before taking another trend trade.', ['The uptrend is guaranteed to resume because it rose before.', 'A lasting downtrend is proven by that one close alone.'], 'A break below a prior higher low weakens that particular uptrend assumption. It is a reason to reassess, not certainty about the next move or a complete new downtrend.', { diagram: { type: 'swings', points: [100, 106, 103, 110, 107, 114, 102], reference: 107, referenceLabel: 'Prior swing low' } }),
      choice('The sequence has rising highs but falling lows. What should you label it?', 'Mixed or expanding structure; the simple trend rule is not satisfied.', ['A clean uptrend because only the highs matter.', 'A clean downtrend because only the lows matter.'], 'A clean rising-swing rule requires higher highs and higher lows. Here the highs expand upward and lows expand downward. Labeling uncertainty is better than forcing a setup.', { diagram: { type: 'swings', points: [103, 109, 101, 112, 98, 115] } })
    ];
  }

  function levelQuestions() {
    return [
      { type: 'level', prompt: 'Mark the support area that price has repeatedly reacted from.', answer: 100, tolerance: 1, min: 96, max: 114, step: 0.5, initial: 105, unit: 'price', diagram: { type: 'swings', points: [106, 100, 109, 101, 110, 99.5, 107], min: 96, max: 114 }, explanation: 'Several reactions cluster around 100. Support is better treated as an area than an exact barrier. This exercise accepts a mark from 99 to 101.' },
      { type: 'level', prompt: 'Mark the resistance area that price has repeatedly reacted from.', answer: 110, tolerance: 1, min: 96, max: 114, step: 0.5, initial: 105, unit: 'price', diagram: { type: 'swings', points: [101, 110, 102, 109.5, 100, 111, 104], min: 96, max: 114 }, explanation: 'The swing highs cluster around 110. That history makes it a useful area to watch, but future trades can move through it. This exercise accepts 109 to 111.' },
      choice('Price briefly trades above 110, then closes back inside the old range at 108. What do you know?', 'The move did not hold above the range on this close; a breakout entry needs reassessment.', ['The breakout is confirmed forever once 110 trades.', 'A fall to 100 is now guaranteed.'], 'A return inside the range challenges the breakout idea. It does not prove the next destination. Define in advance which close or price action your setup requires.', { diagram: { type: 'swings', points: [102, 110, 100, 109, 101, 112, 108], reference: 110, referenceLabel: 'Range high' } }),
      choice('Your planned long entry is 108, stop 105, and next resistance 110. What should you calculate before committing?', 'There are 2 units to resistance versus 3 units to the stop; assess that limited space and costs.', ['A support line automatically creates a 3R target.', 'Resistance guarantees an exit at exactly 110.'], 'Nearby structure can constrain a plausible target. Here the planned reward to that area is 110 − 108 = 2, while the stop distance is 108 − 105 = 3, before costs. A line is not an executable guarantee.'),
      choice('How should you use a level drawn from past price reactions?', 'As an area for a conditional plan, with a clear invalidation and controlled position size.', ['As proof that the next bounce will occur.', 'As a reason to increase size after every failed bounce.'], 'A useful plan states what you need to observe, where the idea is wrong, and what you can lose. A historical level alone does not provide certainty or justify adding risk.')
    ];
  }

  function sizingQuestions() {
    const account = sample([10000, 20000, 40000]);
    const pct = sample([0.25, 0.5]);
    const budget = account * pct / 100;
    const stopDistance = sample([0.5, 1, 2]);
    const qty = budget / stopDistance;
    return [
      numeric(`In this practice example, equity is ${money(account)} and the chosen risk limit is ${pct}%. What is the dollar risk budget?`, budget, `${money(account)} × ${pct / 100} = ${money(budget)}. This is an exercise input, not a risk percentage recommendation. A real plan must also allow for execution costs and gaps.`, { unit: 'dollars', facts: [['Practice equity', money(account)], ['Chosen exercise limit', pct + '%']], hint: 'Convert percent to a decimal, then multiply by equity.' }),
      numeric(`A long entry is 50 and the planned stop is ${50 - stopDistance}. With a ${money(budget)} budget, how many units fit the stop distance before costs?`, qty, `Risk per unit is 50 − ${50 - stopDistance} = ${stopDistance}. Quantity = ${budget} ÷ ${stopDistance} = ${qty}. Costs, available capital, minimum lot size, and gap risk still need checking.`, { unit: 'units', facts: [['Entry', '$50'], ['Stop', money(50 - stopDistance)], ['Budget', money(budget)]], hint: 'This arithmetic exercise excludes fees and slippage.' }),
      numeric('A $100 risk budget must cover $0.90 of stop distance plus $0.10 of estimated round-trip costs per unit. How many whole units fit?', 100, 'Estimated risk per unit is $0.90 + $0.10 = $1.00. $100 ÷ $1.00 = 100 units. This estimate still cannot cap a loss if price gaps or execution is worse than assumed.', { unit: 'units', facts: [['Risk budget', '$100'], ['Stop distance', '$0.90 per unit'], ['Estimated costs', '$0.10 per unit']], hint: 'Include the stated costs in the denominator.' }),
      choice('The logical stop distance doubles while the dollar risk budget stays the same. Before costs, what happens to quantity?', 'It halves.', ['It doubles.', 'It stays the same.'], 'Quantity = risk budget ÷ risk per unit. With twice the stop distance, half the quantity keeps the same planned price risk. Do not move a stop arbitrarily just to fit a preferred size.'),
      numeric('A stop-based calculation gives 250 shares at a $100 entry. Your unlevered paper account has only $10,000 available. What is the maximum whole-share quantity before costs?', 100, 'The capital limit is $10,000 ÷ $100 = 100 shares. The smaller of the risk-based size and the capital-based size applies. Fees would reduce actual buying capacity slightly.', { unit: 'shares', hint: 'This question excludes fees and permits no leverage.', facts: [['Risk-based size', '250 shares'], ['Entry', '$100'], ['Available capital', '$10,000']] })
    ];
  }

  function orderQuestions() {
    return [
      choice('You want to buy only at $50 or less, and accept that the trade may never fill. Which order expresses that?', 'A buy limit order at $50.', ['A buy market order.', 'A buy stop order above $50.'], 'A buy limit sets the highest acceptable purchase price. It controls price but does not promise a fill. A market order does not impose that price ceiling.'),
      choice('An exit needs prompt execution and you accept that the exact fill price can move. Which order is most consistent with that priority?', 'A market order.', ['A limit order placed far away from the market.', 'A stop-limit order that must fill at one exact price.'], 'A market order prioritizes execution at available prices. The last chart price is not a guaranteed fill, especially in a fast or thin market.'),
      choice('A long position has a sell stop at $95. The next available market price after a gap is $91. What is possible?', 'The triggered stop may fill near $91 or worse; $95 was a trigger, not a guaranteed sale price.', ['The broker must sell at exactly $95.', 'The stop guarantees the position cannot lose more than planned.'], 'A conventional stop becomes a market order when triggered. Gaps and liquidity can make the execution worse than the stop level. Size and contingency planning still matter.'),
      choice('You use a sell stop-limit order to control the minimum exit price. What additional risk do you accept?', 'It may trigger and remain unfilled if buyers are below the limit.', ['It guarantees both the limit price and an immediate fill.', 'It cannot be activated by a fast price move.'], 'Once triggered, a stop-limit behaves as a limit order. It can protect a price boundary while leaving the position open when that price is unavailable.'),
      choice('Replay shows a candle high above your limit price. Does that prove your entire real-world limit order would have filled?', 'No. A candle does not show queue position, available size, or the exact sequence of trades.', ['Yes. Touching any part of a candle guarantees a full fill.', 'Yes, as long as the candle is green.'], 'OHLC bars summarize prices. They omit order-book depth, queue priority, and intrabar sequence. A simulator can teach mechanics while its fills remain simplified.')
    ];
  }

  function rewardQuestions() {
    const entry = sample([50, 100, 150]);
    const risk = sample([2, 3, 4]);
    const multiple = sample([2, 3]);
    return [
      numeric(`For a long entry at ${entry}, a stop at ${entry - risk}, and a target at ${entry + risk * multiple}, what is the planned reward-to-risk multiple before costs?`, multiple, `Risk is ${risk} per unit and planned reward is ${risk * multiple}. Reward ÷ risk = ${multiple}R. This describes the plan, not the chance of reaching the target.`, { unit: 'R', facts: [['Long entry', money(entry)], ['Stop', money(entry - risk)], ['Target', money(entry + risk * multiple)]], hint: '(Target − entry) ÷ (entry − stop).' }),
      numeric('A short entry is 80, its protective stop is 82, and its target is 74. What is the planned reward-to-risk multiple before costs?', 3, 'For the short, planned risk is 82 − 80 = 2 and reward is 80 − 74 = 6. The ratio is 6 ÷ 2 = 3R. A short loses when price rises.', { unit: 'R', facts: [['Short entry', '$80'], ['Protective stop', '$82'], ['Target', '$74']], hint: 'Short trade: (entry − target) ÷ (stop − entry).' }),
      choice('Which plan has a protective stop on the wrong side of the entry?', 'Long entry 100, stop 102, target 106.', ['Long entry 100, stop 97, target 106.', 'Short entry 100, stop 103, target 94.'], 'A conventional initial protective stop for a long belongs below the entry. A stop at 102 does not define downside invalidation for a new long entered at 100.'),
      choice('A trade offers a 4R target. What does that tell you about its win probability?', 'Nothing by itself; the planned multiple does not establish the probability of winning.', ['It must win four out of five times.', 'It is profitable regardless of entry rules and costs.'], 'A distant target increases the planned payoff, but it may be reached rarely. Evaluate actual outcomes, costs, and execution over a relevant sample instead of inferring an edge from target distance.'),
      numeric('A trade initially risks $100, closes with $160 gross profit, and incurs $10 total fees and other stated costs. What is its net result in R?', 1.5, 'Net profit is $160 − $10 = $150. Dividing by the original $100 risk gives +1.5R. Keep the original risk denominator so results stay comparable.', { unit: 'R', facts: [['Original planned risk', '$100'], ['Gross profit', '$160'], ['Total stated costs', '$10']], hint: 'Net profit divided by the original risk amount.' })
    ];
  }

  function expectancyQuestions() {
    return [
      numeric('A sample wins 40% of trades, with average winners of $200 and average losers of $100. What is average gross P&L per trade?', 20, '0.40 × $200 − 0.60 × $100 = $80 − $60 = $20 per trade in this sample, before costs. A positive sample average is not a promise about future results.', { unit: 'dollars per trade', facts: [['Win rate', '40%'], ['Average winner', '$200'], ['Average loser', '$100']], hint: 'Win frequency × average win − loss frequency × average loss.' }),
      numeric('That same sample has $20 gross average P&L per trade. Average round-trip costs are $25. What is average net P&L?', -5, '$20 − $25 = −$5 per trade. Small apparent advantages can disappear after costs. The answer must include the negative sign.', { unit: 'dollars per trade', facts: [['Gross average', '+$20'], ['Average costs', '$25']], hint: 'Subtract costs. Negative answers are allowed.' }),
      numeric('A different sample wins 80% of trades. Average winners are $25, average losers are $150. What is average P&L before costs?', -10, '0.80 × $25 − 0.20 × $150 = $20 − $30 = −$10. A high win rate can coexist with losses when the losing trades are much larger.', { unit: 'dollars per trade', facts: [['Win rate', '80%'], ['Average winner', '$25'], ['Average loser', '$150']], hint: 'Include the losing 20% of trades.' }),
      choice('Five paper trades in a row were winners. Which conclusion is justified?', 'This small sample had five wins; I need more relevant observations and process review.', ['The strategy is proven and ready for maximum real-money size.', 'The next trade is guaranteed to lose to balance the sequence.'], 'Five outcomes reveal little about the full distribution of wins, losses, and market conditions. Review rule adherence and collect more observations without treating a streak as proof.'),
      choice('What is the most useful way to compare two setups in your journal?', 'Compare net results, original risk, drawdowns, sample size, and rule adherence by setup.', ['Choose whichever has the highest win rate.', 'Count only the trades that followed the rules and hide the rest.'], 'A useful review keeps both outcomes and process visible. Tag mistakes rather than deleting them, separate setups, and check whether costs or a few large losses dominate the result.')
    ];
  }

  function disciplineQuestions() {
    return [
      choice('Your planned entry has passed and price is accelerating. There is no valid stop for a new entry under your rules. What fits a disciplined process?', 'Skip the chase and wait for another setup that meets the written rules.', ['Increase size so a smaller move can make the same profit.', 'Enter first and invent a stop after the trade turns against you.'], 'Missing a move is not a loss that must be recovered. A skipped trade can be a correct decision when the entry and risk conditions are absent.'),
      choice('Your long reaches the price that invalidates the original idea. You want to move the stop farther away so the trade has time to recover. What matches the original plan?', 'Honor the invalidation and record what happened; reassess only after the trade is managed.', ['Widen the stop because a loss is not real until you close.', 'Double the position to lower the average entry.'], 'An unrealized loss already affects equity. Moving a stop solely to avoid realizing it increases the original risk and changes the trade after the fact. Recovery is not guaranteed.'),
      choice('Your written practice plan says to stop after two rule violations. You have just recorded the second. A tempting setup appears. What should you do?', 'End trading for this practice session and review the violations.', ['Take one larger trade to repair the day.', 'Delete one violation so the next trade is allowed.'], 'The stopping rule was set before the emotion of the session. Following it lets you evaluate the plan consistently. Adjust rules later during a calm review, not to justify a new trade.'),
      choice('A trade ignored your size limit but happened to make money. How should it be journaled?', 'Record the profit and the size violation separately; the outcome does not excuse the process.', ['Mark it as a model trade because it won.', 'Raise tomorrow’s size limit automatically.'], 'Good outcomes can follow poor decisions, and good decisions can still lose. Track whether you followed the plan separately from whether this particular trade made money.'),
      choice('You feel an urgent need to win back a recent loss. What is the most useful immediate action?', 'Pause, record the trigger, and return only when the next trade independently meets the plan.', ['Trade more often until the loss is erased.', 'Pick a new strategy every few minutes.'], 'Treat the urge as information about your decision state. A planned break and a clear checklist can stop one losing trade from turning into a series of impulsive decisions.')
    ];
  }

  const questionFactories = { candles: candleQuestions, structure: structureQuestions, levels: levelQuestions, sizing: sizingQuestions, orders: orderQuestions, riskreward: rewardQuestions, expectancy: expectancyQuestions, discipline: disciplineQuestions };

  function candleSvg(d, instance) {
    const low = Math.min(d.low, d.high) - 1;
    const high = Math.max(d.low, d.high) + 1;
    const y = p => 228 - (p - low) / (high - low) * 200;
    const up = d.close >= d.open;
    const top = y(Math.max(d.open, d.close));
    const bottom = y(Math.min(d.open, d.close));
    const color = up ? '#2962ff' : '#172033';
    const title = `Teaching candle: open ${d.open}, high ${d.high}, low ${d.low}, close ${d.close}.`;
    const labels = [
      ['High', d.high, 362, y(d.high)],
      ['Low', d.low, 362, y(d.low)],
      ['Open', d.open, 100, y(d.open)],
      ['Close', d.close, 362, y(d.close)]
    ];
    return `<svg class="lab-chart lab-candle-chart" viewBox="0 0 600 260" role="img" aria-labelledby="${instance}-chart-title"><title id="${instance}-chart-title">${escape(title)}</title><line x1="300" x2="300" y1="${y(d.high)}" y2="${y(d.low)}" stroke="${color}" stroke-width="3"/><rect x="268" y="${top}" width="64" height="${Math.max(bottom - top, 3)}" fill="${color}" rx="2"/>${labels.map(([label, value, x, yy]) => `<line x1="${x === 100 ? 204 : 338}" x2="${x === 100 ? 260 : 356}" y1="${yy}" y2="${yy}" stroke="#aab9cb" stroke-dasharray="3 4"/><text x="${x}" y="${yy + 5}" fill="#263349" font-size="15" font-weight="600">${label} ${escape(money(value))}</text>`).join('')}</svg>`;
  }

  function swingSvg(d, instance, selectable) {
    const min = d.min != null ? d.min : Math.floor(Math.min(...d.points) - 3);
    const max = d.max != null ? d.max : Math.ceil(Math.max(...d.points) + 3);
    const y = p => 220 - (p - min) / (max - min) * 192;
    const x = i => 50 + i / (d.points.length - 1) * 490;
    const path = d.points.map((p, i) => `${i ? 'L' : 'M'} ${x(i)} ${y(p)}`).join(' ');
    const grid = Array.from({ length: 5 }, (_, i) => min + (max - min) * i / 4);
    const title = 'Synthetic swing prices in sequence: ' + d.points.join(', ') + '.';
    return `<svg class="lab-chart ${selectable ? 'lab-select-chart' : ''}" data-lab-chart="${selectable ? 'selectable' : 'static'}" viewBox="0 0 600 260" role="img" aria-labelledby="${instance}-chart-title"><title id="${instance}-chart-title">${escape(title)}</title>${grid.map(p => `<line x1="45" x2="548" y1="${y(p)}" y2="${y(p)}" stroke="#e6ecf3"/><text x="558" y="${y(p) + 4}" fill="#52627a" font-size="12">${Number(p.toFixed(1))}</text>`).join('')}${d.reference != null ? `<line x1="45" x2="548" y1="${y(d.reference)}" y2="${y(d.reference)}" stroke="#996710" stroke-dasharray="6 5"/><text x="52" y="${y(d.reference) - 9}" fill="#996710" font-size="12">${escape(d.referenceLabel || 'Reference')}</text>` : ''}<path d="${path}" fill="none" stroke="#2962ff" stroke-width="3" stroke-linejoin="round"/>${d.points.map((p, i) => `<circle cx="${x(i)}" cy="${y(p)}" r="4" fill="#2962ff"/><text x="${x(i)}" y="${y(p) + (i % 2 === 0 ? 19 : -12)}" text-anchor="middle" fill="#263349" font-size="12">${p}</text>`).join('')}<text x="50" y="250" fill="#52627a" font-size="12">Earlier</text><text x="540" y="250" text-anchor="end" fill="#52627a" font-size="12">Later</text>${selectable ? '<line data-lab-marker x1="45" x2="548" y1="124" y2="124" stroke="#2962ff" stroke-width="2" stroke-dasharray="8 5"/><text data-lab-marker-label x="50" y="116" fill="#2962ff" font-size="13" font-weight="700"></text>' : ''}</svg>`;
  }

  function render(id, container, onComplete) {
    const item = items.find(entry => entry.id === id);
    if (!item || !container || typeof container.querySelector !== 'function') {
      if (container) container.textContent = 'This lab could not be found. Choose another lab to continue.';
      return function () {};
    }
    const instance = 'replaylab-' + id + '-' + Math.random().toString(36).slice(2, 9);
    let disposed = false;
    let round = 0;
    let questions = [];
    let index = 0;
    let results = [];
    let answered = false;
    let selectedLevel = 0;
    let removeEvents = [];

    function clearEvents() {
      removeEvents.forEach(remove => remove());
      removeEvents = [];
    }

    function listen(element, event, handler) {
      if (!element) return;
      element.addEventListener(event, handler);
      removeEvents.push(() => element.removeEventListener(event, handler));
    }

    function focusHeading() {
      const heading = container.querySelector('[data-lab-focus]');
      if (heading) heading.focus({ preventScroll: true });
    }

    function sourceMarkup() {
      const source = sources[id];
      return source ? `<p class="lab-source">Explore the underlying concept: <a href="${escape(source.url)}" target="_blank" rel="noopener noreferrer">${escape(source.title)}</a></p>` : '';
    }

    function shell(content, completed) {
      return `<section class="lab-session" aria-label="${escape(item.title)}"><div class="lab-session-heading"><div><p class="lab-eyebrow">${escape(item.skill)} lab</p><h2 tabindex="-1" data-lab-focus>${escape(item.title)}</h2><p class="lab-session-description">${escape(item.description)}</p></div><span class="lab-round">Round ${round}</span></div><div class="lab-progress-header"><span>${completed ? 'Round complete' : `Task ${index + 1} of ${questions.length}`}</span><span>Mastery: 80% or higher</span></div><div class="lab-progress" role="progressbar" aria-label="Lab tasks completed" aria-valuemin="0" aria-valuemax="${questions.length}" aria-valuenow="${completed ? questions.length : index}"><span style="width:${completed ? 100 : index / questions.length * 100}%"></span></div>${content}<p class="lab-scope-note">Practice exercises use invented examples. Results measure these skills, not future trading performance.</p>${sourceMarkup()}</section>`;
    }

    function start() {
      if (disposed) return;
      round++;
      index = 0;
      results = [];
      questions = shuffle(questionFactories[id]());
      showQuestion();
    }

    function showQuestion() {
      if (disposed) return;
      clearEvents();
      answered = false;
      const q = questions[index];
      selectedLevel = q.initial || 0;
      let diagram = '';
      if (q.diagram) {
        diagram = `<figure class="lab-figure">${q.diagram.type === 'candle' ? candleSvg(q.diagram, instance) : swingSvg(q.diagram, instance, q.type === 'level')}<figcaption>Synthetic teaching example · ${q.type === 'level' ? 'Click the chart or use the price control below.' : 'Prices shown for learning, not a market forecast.'}</figcaption></figure>`;
      }
      const facts = q.facts ? `<dl class="lab-facts">${q.facts.map(([label, value]) => `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl>` : '';
      let input;
      if (q.type === 'choice') {
        input = `<fieldset class="lab-choices"><legend class="lab-visually-hidden">Choose the best answer</legend>${shuffle(q.choices).map((answer, i) => `<label class="lab-choice"><input type="radio" name="${instance}-answer" value="${escape(answer)}"/><span class="lab-choice-key" aria-hidden="true">${String.fromCharCode(65 + i)}</span><span>${escape(answer)}</span></label>`).join('')}</fieldset>`;
      } else if (q.type === 'level') {
        input = `<div class="lab-level-input"><label for="${instance}-level">Your marked price <output data-lab-level-output for="${instance}-level">${selectedLevel.toFixed(1)}</output></label><input id="${instance}-level" type="range" min="${q.min}" max="${q.max}" step="${q.step}" value="${selectedLevel}" aria-describedby="${instance}-hint"/><p id="${instance}-hint">Use the arrow keys for ${q.step}-unit steps. Mark the center of the reaction area.</p></div>`;
      } else {
        input = `<div class="lab-number-field"><label for="${instance}-number">Your answer <span>${escape(q.unit)}</span></label><input id="${instance}-number" name="answer" type="text" inputmode="decimal" autocomplete="off" placeholder="Enter your answer" aria-describedby="${instance}-hint"/><p id="${instance}-hint">${escape(q.hint)}</p></div>`;
      }
      container.innerHTML = shell(`<form class="lab-task" novalidate><h3>${escape(q.prompt)}</h3>${facts}${diagram}${input}<p class="lab-input-error" role="alert" data-lab-error></p><div class="lab-actions"><button class="lab-button lab-button-primary" type="submit">Check answer</button><span class="lab-score-so-far" data-lab-score>${results.filter(result => result.correct).length} correct so far</span></div><div class="lab-feedback" data-lab-feedback aria-live="polite" aria-atomic="true"></div></form>`, false);
      const form = container.querySelector('form');
      listen(form, 'submit', checkAnswer);
      if (q.type === 'level') {
        const slider = container.querySelector('input[type="range"]');
        const chart = container.querySelector('[data-lab-chart="selectable"]');
        listen(slider, 'input', () => { selectedLevel = Number(slider.value); updateLevel(); });
        listen(chart, 'click', event => {
          if (answered) return;
          const bounds = chart.getBoundingClientRect();
          const scale = Math.min(bounds.width / 600, bounds.height / 260);
          if (!scale) return;
          const viewTop = bounds.top + (bounds.height - 260 * scale) / 2;
          const rawY = (event.clientY - viewTop) / scale;
          const value = q.min + (220 - Math.max(28, Math.min(220, rawY))) / 192 * (q.max - q.min);
          selectedLevel = Math.max(q.min, Math.min(q.max, Math.round(value / q.step) * q.step));
          slider.value = selectedLevel;
          updateLevel();
        });
        updateLevel();
      }
      focusHeading();
    }

    function updateLevel() {
      const q = questions[index];
      const y = 220 - (selectedLevel - q.min) / (q.max - q.min) * 192;
      const marker = container.querySelector('[data-lab-marker]');
      const label = container.querySelector('[data-lab-marker-label]');
      const output = container.querySelector('[data-lab-level-output]');
      if (marker) { marker.setAttribute('y1', y); marker.setAttribute('y2', y); }
      if (label) { label.setAttribute('y', Math.max(18, y - 8)); label.textContent = 'Your mark: ' + selectedLevel.toFixed(1); }
      if (output) output.textContent = selectedLevel.toFixed(1);
    }

    function checkAnswer(event) {
      event.preventDefault();
      if (disposed || answered) return;
      const q = questions[index];
      const error = container.querySelector('[data-lab-error]');
      let answer;
      let correct;
      if (q.type === 'choice') {
        const checked = container.querySelector('input[type="radio"]:checked');
        if (!checked) { error.textContent = 'Choose an answer before checking.'; return; }
        answer = checked.value;
        correct = answer === q.correct;
      } else if (q.type === 'level') {
        answer = selectedLevel;
        correct = Math.abs(answer - q.answer) <= q.tolerance + 1e-9;
      } else {
        const field = container.querySelector('input[name="answer"]');
        const raw = field.value.trim().replace(/[$,%\s]/g, '');
        if (!raw || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw) || !Number.isFinite(Number(raw))) {
          error.textContent = 'Enter a valid number, such as 100, 1.5, or -5.';
          field.focus();
          return;
        }
        answer = Number(raw);
        correct = Math.abs(answer - q.answer) <= q.tolerance + 1e-9;
      }
      error.textContent = '';
      answered = true;
      results.push({ prompt: q.prompt, correct, answer, expected: q.type === 'choice' ? q.correct : q.answer, explanation: q.explanation });
      container.querySelector('[data-lab-score]').textContent = results.filter(result => result.correct).length + ' correct so far';
      container.querySelectorAll('input, button[type="submit"]').forEach(input => { input.disabled = true; });
      if (q.type === 'choice') {
        container.querySelectorAll('.lab-choice').forEach(label => {
          const input = label.querySelector('input');
          if (input.value === q.correct) label.classList.add('lab-choice-correct');
          else if (input.checked) label.classList.add('lab-choice-incorrect');
        });
      }
      const feedback = container.querySelector('[data-lab-feedback]');
      feedback.classList.add(correct ? 'lab-feedback-correct' : 'lab-feedback-review');
      const answerText = q.type === 'choice' ? q.correct : `${q.answer}${q.unit ? ' ' + q.unit : ''}${q.type === 'level' ? ` (within ${q.tolerance} unit)` : ''}`;
      feedback.innerHTML = `<div class="lab-feedback-label">${correct ? 'Correct' : 'Review this one'}</div>${correct ? '' : `<p class="lab-correct-answer">Answer: ${escape(answerText)}</p>`}<p>${escape(q.explanation)}</p><button class="lab-button lab-button-secondary" type="button" data-lab-next>${index + 1 === questions.length ? 'See my results' : 'Next task'}</button>`;
      const next = feedback.querySelector('[data-lab-next]');
      listen(next, 'click', () => {
        if (disposed) return;
        index++;
        if (index < questions.length) showQuestion();
        else finish();
      });
      next.focus({ preventScroll: true });
    }

    function finish() {
      if (disposed) return;
      clearEvents();
      const correctCount = results.filter(result => result.correct).length;
      const score = Math.round(correctCount / questions.length * 100);
      const passed = score >= 80;
      const content = `<div class="lab-result ${passed ? 'lab-result-passed' : ''}"><div class="lab-result-score">${score}<span>%</span></div><div><p class="lab-eyebrow">${passed ? 'Skill check passed' : 'Keep practicing'}</p><h3>${passed ? 'You can apply this concept.' : 'A few concepts need another pass.'}</h3><p>${correctCount} of ${questions.length} correct. ${passed ? 'Try this skill in Replay next, and keep reviewing the explanations.' : 'Read the explanations below, then try another round. You need at least 4 of 5 correct.'}</p></div></div><div class="lab-review-list">${results.map(result => `<details class="lab-review-item" ${result.correct ? '' : 'open'}><summary><span class="lab-review-status ${result.correct ? 'is-correct' : ''}">${result.correct ? 'Correct' : 'Review'}</span><span>${escape(result.prompt)}</span></summary><div><p><strong>Your answer:</strong> ${escape(result.answer)}</p>${result.correct ? '' : `<p><strong>Answer:</strong> ${escape(result.expected)}</p>`}<p>${escape(result.explanation)}</p></div></details>`).join('')}</div><div class="lab-actions"><button class="lab-button lab-button-primary" type="button" data-lab-retry>Practice another round</button><span class="lab-score-so-far">A new round resets this round’s score.</span></div>`;
      container.innerHTML = shell(content, true);
      listen(container.querySelector('[data-lab-retry]'), 'click', start);
      focusHeading();
      if (typeof onComplete === 'function') onComplete({ id, score, passed, attempts: round });
    }

    start();
    return function cleanup() {
      disposed = true;
      clearEvents();
    };
  }

  global.ReplayLabs = Object.freeze({ items: items.map(item => Object.freeze(item)), render });
})(typeof window !== 'undefined' ? window : globalThis);
