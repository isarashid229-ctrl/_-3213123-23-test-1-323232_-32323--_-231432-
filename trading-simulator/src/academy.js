/* ReplayLab Academy: original lessons and worked examples; source links checked 2026-11-21. */
(function (root) {
  'use strict';
  const section = (heading, text, bullets, example) => ({ heading, text, ...(bullets ? { bullets } : {}), ...(example ? { example } : {}) });
  const lesson = (id, title, sections, takeaway) => ({ id, title, sections, takeaway });
  const question = (prompt, choices, answer, explanation) => ({ prompt, choices, answer, explanation });

  const modules = [
    {
      id: 'foundations', title: 'Build the right foundation', subtitle: 'Understand the job, the risks, and what good practice looks like.', level: 'Foundation', minutes: 18,
      skills: ['Separate process from outcome', 'Read account equity', 'Practise without hindsight'], labId: 'discipline', sourceIds: ['sec-day-risk', 'cme-expectations', 'fidelity-basics'],
      lessons: [
        lesson('foundations-1', 'What a day trader actually does', [
          section('A repeatable decision process', 'A day trader opens and closes positions within the trading day or defined session. The work is preparation, selecting an opportunity, deciding what would invalidate it, sizing the position, executing, and reviewing the result. Clicking more often is not a measure of skill. In a 24-hour market such as crypto, define your own session and a time to be flat.'),
          section('Start with one share', 'A stock share is a unit of ownership in a company. In a long trade you buy shares, then sell them to close. Quantity tells you how many shares are exposed to each dollar of price movement. In a short trade the exposure is reversed: a falling price helps and a rising price hurts, before costs.', null, 'Buy 10 shares at an actual fill of $100. Sell all 10 at $102: gross profit is 10 × $2 = $20. Sell at $98 instead: gross loss is 10 × $2 = $20. A $2 price move has a different account effect with 10 shares than with 100 shares.'),
          section('What this course can teach', 'ReplayLab teaches market vocabulary, risk arithmetic, chart observation, and disciplined paper-trading routines. The modules build toward a documented practice process. Completing them is an educational achievement; it is not a professional qualification or evidence that a strategy will earn money.', ['Keep money needed for living costs outside speculative trading.', 'Learn the specific instrument, venue, hours, and account rules before considering real trades.', 'Treat borrowing and leverage as additional risks, not shortcuts.'])
        ], 'Your first goal is to make explainable decisions and keep honest records.'),
        lesson('foundations-2', 'Balance is not the whole account', [
          section('Realized and unrealized results', 'A closed trade creates a realized result. An open position changes in value as prices move, creating an unrealized result. Equity includes that open gain or loss. Refusing to close a losing trade does not stop the economic loss; it keeps the exposure open.'),
          section('Work through the numbers', 'For a long position, gross unrealized P&L is quantity × (current price − entry price). For a short position, reverse the subtraction. Fees, slippage, and other real-world costs reduce the result.', null, 'A paper account has a $10,000 balance after entry fees. It holds 20 units bought at $100. At $95, gross unrealized P&L is 20 × (95 − 100) = −$100. Equity is $9,900 before any exit costs, even though the position is still open.'),
          section('Follow the account through a trade', 'In ReplayLab’s simplified paper account, opening a position deducts the entry fee from balance and stores the position separately. Balance is not a cash-buying-power display. While the position is open, equity is balance plus marked open P&L. Closing adds the gross trade result and deducts the exit fee; the open position then disappears. Read the fills and fees as well as the headline number.', ['Before entry: note starting equity.', 'After entry: compare reference price, actual fill, quantity, and fee.', 'After one new candle: calculate open P&L using the current close.', 'After exit: reconcile net P&L with the change from starting balance.']),
          section('Separate two kinds of risk', 'Notional exposure is quantity × price. Planned loss to a stop is quantity × the distance to the stop, plus estimated costs. They measure different things. A stop is a planned exit trigger, not a guarantee that losses cannot exceed the estimate.')
        ], 'Watch equity and exposure, not just the balance after closed trades.'),
        lesson('foundations-3', 'Use replay as an honest experiment', [
          section('Hide the answer', 'Make your decision using only information visible at the replay cursor. Write the plan before stepping forward. Seeing later candles and then choosing an earlier entry is hindsight, even when it feels obvious. Repeating a remembered chart can teach mechanics, but it is not fresh evidence of a trading edge.'),
          section('Know the limits', 'A candle records the open, high, low, and close of a period. It does not reveal every trade, the bid and ask, queue position, or the sequence between the high and low. A simulator must make fill assumptions. Paper results also omit some pressures and frictions of real trading.', ['Use a fresh historical segment when evaluating a rule.', 'Keep losing trades in the record.', 'Score plan adherence separately from profit.', 'Record when a result depends on a simplified fill assumption.'])
        ], 'Practice is useful when the test is fair, including the uncomfortable outcomes.')
      ],
      quiz: [
        question('Your balance is $10,000 and your open position is down $250 before exit costs. What is your equity?', ['$10,250', '$10,000 until you sell', '$9,750', 'It cannot be calculated'], 2, 'Equity reflects the current value of the account: $10,000 − $250 = $9,750, before estimated exit costs.'),
        question('Which is the strongest early training goal?', ['Make money on every trade', 'Follow and document a defined process', 'Use maximum buying power', 'Trade every visible pattern'], 1, 'A defined, documented process gives you something to evaluate. A winning outcome alone may be luck.'),
        question('Which replay habit introduces hindsight?', ['Planning before entry', 'Recording a loss', 'Using a fixed risk budget', 'Looking at future candles before choosing the entry'], 3, 'Future prices were not available to a trader at the time. Using them changes the test.'),
        question('Passing this course means which of the following?', ['You completed educational exercises', 'You are licensed to advise clients', 'Your next strategy will be profitable', 'You can ignore broker rules'], 0, 'Course progress records learning. It does not grant a license, certify professional readiness, or predict future returns.')
      ]
    },
    {
      id: 'candles', title: 'Read a candle, then its context', subtitle: 'Translate price bars into evidence without guessing the next move.', level: 'Foundation', minutes: 20,
      skills: ['Read OHLC', 'Compare bodies and wicks', 'Understand timeframe and volume'], labId: 'candles', sourceIds: ['schwab-candles', 'fidelity-technical', 'cme-averages'],
      lessons: [
        lesson('candles-1', 'The four prices inside every candle', [
          section('Open, high, low, close', 'The open is the first traded price in the interval; the close is the last. The high and low are the interval extremes. The body spans open to close. The upper and lower wicks extend to the high and low. In the usual green/red convention, green means close above open and red means close below open. A green candle can still close below the previous candle.'),
          section('Read the shape numerically', 'The full range is high − low. Body size is the absolute difference between close and open. A small body with long wicks means the final close was near the open despite a wider range. The shape describes what happened; it does not guarantee a reversal.', null, 'O = 100, H = 106, L = 98, C = 104. This is an up candle with a 4-point body, an 8-point range, a 2-point upper wick, and a 2-point lower wick.')
        ], 'Describe the candle accurately before assigning a story to it.'),
        lesson('candles-2', 'Location matters more than a nickname', [
          section('Ask three context questions', 'A long lower wick may look interesting, but the same shape can appear during a healthy pullback, a downtrend, or random sideways noise. First ask where price is relative to recent swing points. Then ask whether the market is trending or ranging. Finally ask what later evidence your plan requires before acting.'),
          section('Turn a pattern into a hypothesis', 'Use conditional language: “If price holds this area and my trigger appears, I will evaluate a long.” A pattern name by itself does not define entry, stop, size, or exit. Do not label a candle as confirmed until its interval has finished.', ['Observation: the candle traded lower and closed near its high.', 'Hypothesis: buyers may be defending this area.', 'Invalidation: price breaks the level specified in the plan.', 'Decision: wait, enter under the written rule, or skip.'])
        ], 'A pattern is a prompt to investigate, not an instruction to buy or sell.'),
        lesson('candles-3', 'Timeframe, volume, and chart consistency', [
          section('The same market has several views', 'A 15-minute candle summarizes more time than a 1-minute candle. A short decline can sit inside a larger uptrend. Choose the timeframe for your entry decision before the session and use a broader view for context when available. Changing timeframes to find a reason to keep a losing trade changes the plan.'),
          section('Volume needs a fair comparison', 'Read the dataset’s unit before interpreting its volume column. Share volume counts shares; tick volume counts observed price or quote updates and is not a count of shares. ReplayLab’s bundled intraday stock examples label their vendor tick volume. Compare the same measure and source across similar periods; a taller bar does not prove that a breakout will succeed.'),
          section('An indicator summarizes price', 'A moving average smooths earlier prices. An exponential moving average gives more weight to recent observations. It can help you describe direction, but it responds to past data and can be repeatedly crossed in a range. Avoid stacking several similar indicators and counting them as independent evidence.')
        ], 'Keep the timeframe, venue, and indicator assumptions consistent during a test.')
      ],
      quiz: [
        question('A candle has O = 50, H = 55, L = 48, C = 52. What is its full range?', ['2', '3', '5', '7'], 3, 'Range is high minus low: 55 − 48 = 7. The body is only 2.'),
        question('What can a long lower wick tell you with certainty?', ['The next candle will rise', 'Price traded lower and closed above that low', 'Large buyers are guaranteed to defend the level', 'A short trade is impossible'], 1, 'OHLC data supports the price observation. It does not identify every participant or guarantee what happens next.'),
        question('A green candle usually means what?', ['Its close is above its own open', 'Its close is above yesterday’s close', 'It has no lower wick', 'Volume must have risen'], 0, 'Color usually compares the current candle’s open and close, not the previous close or the volume.'),
        question('Why can an EMA give repeated false starts in a sideways market?', ['It sees future prices', 'It removes transaction costs', 'It summarizes past prices while price crosses it repeatedly', 'It changes the underlying trades'], 2, 'An EMA is a lagging summary. In a range, repeated crossings can create signals without sustained movement.')
      ]
    },
    {
      id: 'structure', title: 'Map trends and decision zones', subtitle: 'Recognize market structure and mark levels before the outcome.', level: 'Foundation', minutes: 22,
      skills: ['Identify swing structure', 'Distinguish trends from ranges', 'Mark support and resistance'], labId: 'structure', sourceIds: ['schwab-levels', 'cme-trends', 'schwab-intro'],
      lessons: [
        lesson('structure-1', 'Higher highs, lower lows, and uncertainty', [
          section('Read the sequence', 'An uptrend is commonly described by rising swing highs and rising swing lows. A downtrend has falling swing highs and falling swing lows. A range shows repeated movement between areas without a sustained directional sequence. Mixed evidence deserves the label “unclear”; forcing every chart into a clean trend leads to invented certainty.'),
          section('Confirmation takes time', 'A swing high is a local peak relative to surrounding bars. You need later observations to know a peak held. During replay, a recent high may only be a candidate swing. Do not use a label that depends on candles you have not yet revealed.', null, 'Swing highs at 102, 106, and 109 with swing lows at 98, 101, and 104 describe rising structure. A subsequent break below 104 weakens that structure, but it does not by itself prove a new downtrend.'),
          section('Apply one rule to the actual chart', 'In the guided structure lab, a swing high must be higher than the preceding two highs and at least as high as the following two highs. A swing low uses the reversed comparisons. This tie convention makes the rule reproducible. The latest two bars cannot yet supply confirmed swings. Compare the last two confirmed highs and the last two confirmed lows. The lab declares its tolerance and lookback so another learner can reproduce the answer.', ['Both pairs rise beyond the stated tolerance: uptrend under this exercise rule.', 'Both pairs fall beyond the tolerance: downtrend.', 'Both pairs remain within tolerance: range under this rule.', 'The pairs disagree or there are too few confirmed swings: unclear.'])
        ], 'Use a consistent swing definition and leave room for “not clear yet.”'),
        lesson('structure-2', 'Support and resistance are areas to observe', [
          section('Draw from repeated behavior', 'Support is an area where declines previously met buying interest; resistance is where advances previously stalled. Use visible reactions and mark a modest zone rather than pretending every turn happens at one exact price. Prior reactions give a reference point, not a promise that the area will hold again.'),
          section('Begin with an observable reference', 'First find the lowest low and highest high inside a declared visible window. These are reproducible reference prices. Then inspect the surrounding reactions before calling either a meaningful support or resistance zone. One isolated extreme does not establish repeated defense, and extending a line into the future does not make it predictive.', null, 'Visible lows of 100.20, 100.10, and 100.25 with recoveries toward 101 describe several reactions near 100.10–100.25. A later completed close below that area would challenge a rule that requires the zone to hold. Decide in advance whether your rule uses a touch, an intrabar break, or a completed close.'),
          section('Plan both outcomes', 'At a resistance zone, price might reject, pause, break through, or briefly break and return. State the evidence you require for your chosen setup. A breakout is a move through a reference area; a failed breakout returns through it. The important question is what your plan does when the hypothesis fails.', ['Mark the zone using candles already visible.', 'Describe what a hold and a failure would look like.', 'Check whether the next zone leaves enough room for the planned target.', 'Skip the trade when the invalidation or target is unclear.'])
        ], 'A useful level helps define a decision and an invalidation, not a prediction.'),
        lesson('structure-3', 'Match the setup to the environment', [
          section('Trends and ranges reward different assumptions', 'A trend-following idea expects directional continuation. A range idea expects a boundary to hold. Neither is automatically superior. A strategy tested on clear trends may struggle when price rotates sideways. Describe the market condition before evaluating the entry signal.'),
          section('Avoid a beautiful chart with bad trade geometry', 'Even a clear uptrend can offer a poor entry if the invalidation is far away and the next resistance area is close. The chart can be bullish while the specific trade is unattractive under your rules.', null, 'A proposed long is at 100, a logical stop is at 96, and the next resistance is near 102. The initial reward-to-risk is 2 ÷ 4 = 0.5 before costs. Calling the chart an uptrend does not improve that geometry.')
        ], 'Evaluate the market condition and the actual entry price as separate decisions.')
      ],
      quiz: [
        question('Which sequence best describes an uptrend?', ['Lower highs and lower lows', 'Higher highs and higher lows', 'Flat highs and falling lows', 'One large green candle'], 1, 'A repeated sequence of rising swing highs and lows is the usual structural definition; one candle is insufficient.'),
        question('What is the best treatment of a support zone?', ['A guaranteed floor', 'An exact price that never changes', 'An area to observe with a defined failure condition', 'A reason to double every losing position'], 2, 'A zone is a reference for a hypothesis. Its failure must be possible and planned for.'),
        question('Why can labeling the latest bar a confirmed swing high create hindsight?', ['It changes the timeframe', 'It reduces fees', 'It removes the wick', 'Confirmation may require later candles'], 3, 'A local peak is only known after later observations show that it remained a peak.'),
        question('Entry 100, stop 96, target 102: what is the gross reward-to-risk ratio?', ['0.5:1', '2:1', '4:1', '1:1'], 0, 'Potential reward is 2 and planned price risk is 4. Reward divided by risk is 0.5 before costs.')
      ]
    },
    {
      id: 'orders', title: 'Understand orders and trading costs', subtitle: 'Know what an order controls and what it cannot guarantee.', level: 'Execution', minutes: 22,
      skills: ['Choose an order type', 'Explain gaps and slippage', 'Calculate costs'], labId: 'orders', sourceIds: ['sec-orders', 'sec-stops', 'sec-short', 'schwab-orders'],
      lessons: [
        lesson('orders-1', 'Market, limit, and stop orders', [
          section('Match the instruction to the objective', 'A market order seeks execution at available prices; the last price on the chart is not a guaranteed fill. A buy limit specifies the highest acceptable buy price. A sell limit specifies the lowest acceptable sell price. Limit orders may remain unfilled. A stop-market order activates a market order when its trigger condition is met.'),
          section('A stop-limit adds a second condition', 'A stop-limit activates a limit order after the stop trigger. It restricts the acceptable fill price, but a fast move can leave it unfilled. Order availability, trigger standards, and eligible trading sessions depend on the venue and broker.', null, 'You own a hypothetical instrument at 50. A stop-market at 48 is intended to exit if it falls. If the next tradable price is 46, the exit may be around 46, not 48. A stop-limit with a 47.80 limit might not execute at all.'),
          section('Place one protected paper order', 'The guided order ticket opens a simulated market position from the currently revealed close with the displayed slippage and fee assumptions. Buy / Long opens upward exposure; Sell / Short opens downward exposure. Use Close position to exit an existing trade. The attached stop and target are checked when subsequent candles are revealed.', ['Choose the side before entering the numbers.', 'Set a long stop below the expected entry fill and target above it; reverse those directions for a short.', 'Enter quantity and inspect the planned dollar risk and notional exposure.', 'Write the reason and exit rule, submit, then verify the position record.', 'Advance one bar at a time and inspect whether protection or the time rule closes the trade.'])
        ], 'Market orders prioritize execution; limit orders restrict price; neither eliminates market risk.'),
        lesson('orders-2', 'Why a winning price move can lose money', [
          section('Include the round trip', 'The spread is the difference between the available bid and ask. Slippage is the difference between an expected or reference price and the actual fill. Fees may apply on entry and exit. Borrow fees, financing, funding, and taxes can also matter in real accounts. Do not assume one market’s cost schedule applies to another.'),
          section('Calculate before you trade', 'Gross P&L compares entry and exit prices. Net P&L subtracts the relevant costs. If fills already include slippage, do not subtract that same slippage again.', null, 'Buy 100 units at 20 and sell at 20.05: gross profit is $5. If combined entry and exit fees are $6, net P&L is −$1 before any other costs. A positive price move did not create a positive net trade.'),
          section('Reconcile a simulated fill', 'Use the fill price stored in the position, not just the candle close. ReplayLab’s default guided example applies 0.02% adverse slippage to each market fill and a 0.04% fee to each fill’s notional. These are exercise settings, not a quote from a stockbroker.', null, 'At a $100 reference close, 10 shares bought with 0.02% adverse slippage fill at $100.02. The entry fee is about $0.40. If the mark remains $100, open P&L is already −$0.20 and equity is about $0.60 below its starting value, before exit costs. The chart did not need to move for costs to matter.'),
          section('Avoid false precision', 'A fixed fee and slippage model makes training repeatable, but it does not reproduce changing liquidity or queue priority. Treat the replay assumptions as a model and compare results under tougher costs when assessing a strategy.')
        ], 'Judge trades using net results and the assumptions behind the fills.'),
        lesson('orders-3', 'Long, short, and the risks the chart hides', [
          section('Direction changes the arithmetic', 'A long benefits from rising prices. A short benefits from falling prices. For an unleveraged long, the asset can fall toward zero. A real uncovered short can face theoretically unlimited price risk because the price has no fixed upper bound. Borrow availability, recall, margin, and financing introduce further constraints.'),
          section('Simulation is not an account approval', 'A paper Buy or Sell button does not mean your broker offers the same instrument or permits the same trade. Before any real trade, verify current rules for your account and jurisdiction, instrument specifications, settlement, order sessions, fees, and shorting requirements. This course avoids treating changing account rules as universal.'),
          section('Bar data cannot resolve every fill', 'If a historical bar reaches both a stop and a target, OHLC values do not show which was touched first. Read the simulator’s stated convention. Do not interpret an assumed intrabar exit as an observed execution record.')
        ], 'Learn the real instrument and execution rules before applying paper-trading mechanics.')
      ],
      quiz: [
        question('You want to buy for no more than 25 and accept that the order may not fill. Which order fits?', ['Buy market', 'Sell stop', 'Buy limit at 25', 'Any order guarantees 25'], 2, 'A buy limit permits a fill at 25 or lower, but execution is not guaranteed.'),
        question('A sell stop-market is triggered at 48 and the next available price is 46. What is possible?', ['A fill below 48', 'A guaranteed fill at 48', 'No loss because a stop existed', 'An automatic refund'], 0, 'The trigger activates a market order; a gap or thin liquidity can produce a worse fill.'),
        question('A trade makes $12 before fees and pays $4 on entry plus $5 on exit. What is its net result?', ['$12', '$8', '$7', '$3'], 3, '$12 − $4 − $5 = $3. Include both sides of the trade.'),
        question('What does a stop-limit order add compared with a stop-market order?', ['Guaranteed execution', 'A price limit, with the risk of no fill', 'Guaranteed maximum loss', 'No need to monitor the order'], 1, 'A stop-limit restricts execution price after triggering, but can remain unfilled when price moves away.')
      ]
    },
    {
      id: 'sizing', title: 'Size the trade before the entry', subtitle: 'Convert a risk budget and an invalidation into a position size.', level: 'Risk', minutes: 24,
      skills: ['Calculate a risk budget', 'Size from stop distance', 'Separate risk from notional'], labId: 'sizing', sourceIds: ['cme-size', 'cme-risk-plan', 'sec-stops'],
      lessons: [
        lesson('sizing-1', 'The order of decisions matters', [
          section('Start with the hypothesis and its failure', 'Choose the market condition and setup first. Then define the price or condition that would invalidate that setup. Set a paper risk budget. Only then calculate quantity. Picking a large quantity first and squeezing the stop closer to make the numbers look safe reverses the process.'),
          section('Risk budget is a training choice', 'For these examples, a 0.5% budget keeps the arithmetic easy. It is an illustrative practice parameter, not a suitable-risk recommendation for every person or instrument. A smaller percentage still does not guarantee a capped loss because prices can gap and exits can fail.', null, 'Paper equity = $20,000. Illustrative risk fraction = 0.5%. Planned budget = 20,000 × 0.005 = $100. That is a loss estimate to work within, not a target profit or the total purchase value.')
        ], 'Define invalidation and budget before choosing quantity.'),
        lesson('sizing-2', 'Calculate quantity and round down', [
          section('The basic formula', 'For a simple instrument with one unit of P&L per one price unit, quantity = risk budget ÷ absolute(entry − stop). Incorporate estimated entry and stop-exit costs into the per-unit risk for a more conservative estimate. Round down to the instrument’s allowed size increment and respect the notional or buying-power limit.'),
          section('Work a complete example', 'Quantity may be constrained by both risk and available capital. Use the smaller permitted size. Futures and some other products require a contract multiplier or tick value; the simple units formula is not enough for them.', null, 'Budget $100, entry 50, stop 49: price risk is $1 per unit. With $0.10 estimated round-trip cost per unit, estimated stop risk is $1.10. Floor(100 ÷ 1.10) = 90 whole units. Notional is $4,500, and estimated planned loss is $99.'),
          section('A wider stop means less size', 'If a valid setup needs twice the stop distance, keeping the same risk budget generally means roughly half the quantity before costs. Do not widen a stop on an existing position just to delay acknowledging a failed trade.')
        ], 'Round down and check the capital limit after calculating risk-based size.'),
        lesson('sizing-3', 'R, reward-to-risk, and account damage', [
          section('Use one consistent denominator', 'R is the initial planned dollar risk of a trade. A net gain of $150 on a trade with initial risk $100 is +1.5R. A net loss of $120 is −1.2R. Keep the original denominator when reviewing; changing it after a loss makes comparisons misleading.'),
          section('A target is not a probability', 'A proposed target three times as far from entry as the stop gives a gross reward-to-risk ratio of 3:1. It does not say how often the target will be reached. You need observed outcomes after costs to estimate expectancy.'),
          section('Drawdowns make recovery harder', 'Losses and recovery gains use different starting values. A fall from $10,000 to $8,000 is a 20% drawdown. Returning from $8,000 to $10,000 requires a 25% gain. Increasing risk to “catch up” can deepen the problem.')
        ], 'Track initial risk, realized R, and drawdown together.')
      ],
      quiz: [
        question('What is 0.5% of $20,000 paper equity?', ['$10', '$100', '$1,000', '$10,000'], 1, '0.5% is 0.005; $20,000 × 0.005 = $100.'),
        question('Ignoring costs, a $120 budget and a $3 stop distance allow how many units?', ['360', '123', '40', '3'], 2, 'Quantity is $120 ÷ $3 = 40 units. Costs and capital limits may require a smaller size.'),
        question('What should generally happen to quantity if stop distance doubles and the risk budget stays fixed?', ['It doubles', 'It stays the same', 'It becomes unlimited', 'It approximately halves before costs'], 3, 'Quantity and stop distance trade off: the same budget must cover more risk per unit.'),
        question('Initial risk was $80 and net P&L was +$120. What was the result in R?', ['+1.5R', '+0.67R', '+2R', '+40R'], 0, '$120 ÷ $80 = +1.5R. Use the original planned risk denominator.')
      ]
    },
    {
      id: 'setups', title: 'Build one testable setup', subtitle: 'Turn a chart idea into explicit entry, exit, and no-trade rules.', level: 'Execution', minutes: 24,
      skills: ['Write conditional rules', 'Recognize setup failure', 'Avoid chasing'], labId: 'levels', sourceIds: ['cme-strategy', 'cme-trends', 'schwab-plan'],
      lessons: [
        lesson('setups-1', 'A setup needs more than a pattern', [
          section('Use a six-part rule', 'Specify market condition, location, entry trigger, invalidation, target or exit method, and risk budget. Add a no-trade condition. A second person should be able to understand when your rule applies without needing to know what happened next.'),
          section('An educational example', 'Here is a research idea to practise, not a claim of an edge: look for rising swing structure, wait for a pullback to a previously marked support zone, and require a completed candle to close back above the zone. Define the invalidation below the pullback low and evaluate the next resistance before entering.', ['Condition: rising swing highs and lows.', 'Location: a support zone drawn before the pullback.', 'Trigger: the stated completed-bar rule.', 'Skip: unclear invalidation or insufficient room under your written reward-to-risk threshold.']),
          section('Keep the rule stable', 'Record the exact version of the rule before testing. If you change it, start a new labeled sample. Moving the goalposts after every outcome makes the results impossible to interpret.')
        ], 'A setup becomes testable when its conditions are written before the trade.'),
        lesson('setups-2', 'Breakouts, retests, and failed moves', [
          section('Three different ideas', 'A breakout entry acts when price meets a rule for moving beyond a zone. A retest entry waits for price to return and satisfy a holding rule. A failed-breakout idea acts only after the break has failed under a defined condition. They are separate strategies with different trade-offs and should not be mixed during evaluation.'),
          section('Late entry changes the trade', 'If the market runs past your planned entry, the stop may be farther away and the remaining reward smaller. Recalculate at the available price. Do not keep the original reward-to-risk calculation while entering much later.', null, 'Original plan: entry 100, stop 98, target 104 gives 2:1 gross reward-to-risk. If you chase at 103 with the same stop and target, reward is 1 and risk is 5: only 0.2:1.'),
          section('A missed trade is a valid outcome', 'Your plan can say: if price leaves the entry zone without a valid fill, wait for a fresh setup. You do not need to capture every move to practise consistently.')
        ], 'Recalculate from the price you can actually trade, not the entry you wish you had.'),
        lesson('setups-3', 'Create evidence without overfitting', [
          section('Separate development and evaluation', 'Use one group of historical segments to clarify the rule, then a different group to evaluate it without edits. A rule chosen because it fits one memorable chart can fail on new periods. Include trending, ranging, and volatile conditions when they are relevant to your stated scope.'),
          section('Test the complete process', 'Record skipped setups as well as trades. Include costs, ambiguous bar fills, and the chosen session boundary. Compare results for the same setup version rather than pooling unrelated ideas.', ['Write the rule before the sample.', 'Use unseen segments for evaluation.', 'Keep all outcomes and label rule changes.', 'Treat a small successful sample as a reason to keep testing, not proof of profitability.'])
        ], 'A fair test includes fresh data, stable rules, and every outcome.')
      ],
      quiz: [
        question('Which entry rule is most testable?', ['Buy when it feels strong', 'Buy because the chart looks professional', 'Buy after the completed candle closes above the premarked zone, if all other written conditions pass', 'Buy whenever you missed the last move'], 2, 'A completed-bar condition and a premarked zone can be applied consistently without hindsight.'),
        question('Your intended entry was 100, stop 98, target 104. You enter at 103 instead. What is the gross reward-to-risk?', ['0.2:1', '2:1', '3:1', '5:1'], 0, 'At 103, the remaining reward is 1 and the stop distance is 5. 1 ÷ 5 = 0.2.'),
        question('Why use a different historical segment after developing a rule?', ['To guarantee profits', 'To remove losing trades', 'To avoid paying fees', 'To see whether the rule generalizes beyond the charts used to design it'], 3, 'New segments reduce the chance that the apparent success comes only from fitting the development sample.'),
        question('A setup does not meet your written trigger. What follows the test protocol?', ['Enter early to improve price', 'Skip it and record why', 'Change the rule without a note', 'Increase size to compensate'], 1, 'Skipping is part of a consistent process. Quietly changing the trigger would make the results less meaningful.')
      ]
    },
    {
      id: 'management', title: 'Manage the position you actually have', subtitle: 'Plan exits, understand open losses, and handle uncertain candles.', level: 'Risk', minutes: 23,
      skills: ['Follow an exit plan', 'Handle invalidation', 'Understand intrabar uncertainty'], labId: 'riskreward', sourceIds: ['sec-stops', 'cme-losses', 'cme-strategy'],
      lessons: [
        lesson('management-1', 'Decide exits while you can think clearly', [
          section('Three ways a planned trade can end', 'A trade can end because the hypothesis is invalidated, a target or other profit rule is met, or a time limit expires. Define the relevant conditions before entry. A time rule may be useful when a setup is expected to work promptly or when your session is ending.'),
          section('Avoid moving the goalposts', 'A protective stop is placed on the loss side of the intended entry: below for a long and above for a short. A target is on the favorable side. Moving a stop farther away increases exposure if quantity is unchanged. Adding to a loser also changes the original risk and requires a separately tested rule, not an emotional exception.'),
          section('Plan changes are research changes', 'Trailing or partial-exit methods can be studied, but they are different management rules. Compare them on a fresh sample with their costs included. A stop moved to the entry price does not necessarily mean a zero net loss after fees and slippage.')
        ], 'Entry, invalidation, target, and time rules belong in the plan before the position opens.'),
        lesson('management-2', 'Why “I will wait until it comes back” is not an exit plan', [
          section('The entry price is history', 'The market is not required to return to your entry. Ask whether the reason for the position still exists and whether the remaining risk fits the original plan. Wanting the account to look better is not new market evidence.'),
          section('Loss size matters more than avoiding the label', 'Holding a position keeps its exposure alive. A small planned loss can become a much larger one. Closing a failed idea does not erase the lesson; keeping it open does not erase the loss.', null, 'Ten units bought at 100 are worth 900 at a price of 90: the open loss is $100. If price falls to 80, that loss becomes $200. Waiting changed the exposure duration, not the arithmetic.'),
          section('Score the decision fairly', 'A trade that followed its rules and lost can be well executed. A trade that broke every rule and happened to win still deserves a process correction. Record the outcome and the decision quality separately.')
        ], 'A realized loss is an accounting event; risk exists while the position is open.'),
        lesson('management-3', 'Replay fills and difficult edge cases', [
          section('A candle is not a tick-by-tick record', 'Imagine a long entered at 100 with a stop at 98 and target at 104. The next candle has open 101, high 105, low 97, and close 102. Both exits were reachable, but OHLC alone cannot show which occurred first. A conservative stop-first convention is a modeling choice, not a historical fact.'),
          section('Check the next tradable price', 'A gap past the stop can create a worse exit than the stop level. A model should make its gap and same-bar assumptions visible. When comparing strategies, use the same assumptions and record ambiguous trades so they do not quietly inflate apparent performance.'),
          section('End the session deliberately', 'An open position at the end of a dataset is not a completed trade. Decide whether to close it under the training protocol or record it as still open. Do not exclude its unrealized loss when discussing the account result.')
        ], 'Treat uncertain fills and open positions honestly in the performance record.')
      ],
      quiz: [
        question('A long position’s thesis is invalidated at the planned stop. Which action follows the original plan?', ['Move the stop lower because a loss feels bad', 'Add more units automatically', 'Ignore equity until price returns', 'Exit under the planned execution rule'], 3, 'The invalidation condition was defined before the emotion of the open trade. Changing it creates a different and potentially larger risk.'),
        question('A long is entered at 100, with stop 98 and target 104. A later candle reaches both. What does OHLC prove?', ['The target came first', 'Both prices were reached, but the order is unknown', 'The stop came first', 'Neither order could have filled'], 1, 'The high and low show the range, not the path within the bar. A simulator needs an explicit convention.'),
        question('Does moving a stop to the original entry price guarantee a zero net result?', ['No, costs and slippage can still produce a loss', 'Yes, in every market', 'Only for long positions', 'Yes, if the chart is green'], 0, 'An entry-price stop is not a guaranteed fill at that price, and fees can make the net result negative.'),
        question('Which statement about an open losing position is accurate?', ['The loss does not count until exit', 'Waiting guarantees recovery', 'It already reduces equity and continues to expose the account', 'It cannot lose more than the current unrealized loss'], 2, 'The position has a current economic value, and future price changes can increase or decrease the loss.')
      ]
    },
    {
      id: 'psychology', title: 'Build a routine for difficult moments', subtitle: 'Use concrete rules for FOMO, revenge trading, and hesitation.', level: 'Process', minutes: 20,
      skills: ['Recognize behavior triggers', 'Use a pause routine', 'Separate wins from good decisions'], labId: 'discipline', sourceIds: ['cme-psychology', 'schwab-recovery', 'cme-plan-video'],
      lessons: [
        lesson('psychology-1', 'Name the behavior before trying to fix it', [
          section('Use observable language', '“I am bad at trading” is too broad to improve. “I entered after three large candles without a written stop” describes something measurable. Common patterns include chasing a missed move, increasing size after a loss, repeatedly reopening without a fresh signal, and holding a failed trade to avoid realizing a loss.'),
          section('Write an if-then response', 'Choose one behavior to work on for the next session. Pair a clear trigger with a concrete action. The action should be possible at the exact moment you are tempted to break the plan.', ['If I miss the entry zone, I will wait for a fresh setup.', 'If I want to increase size to recover a loss, I will pause and recalculate from the original budget.', 'If I cannot state the invalidation, I will not open the position.', 'If my predefined session loss limit is reached, I will stop taking new trades.'])
        ], 'Replace vague self-criticism with one observable behavior and one response.'),
        lesson('psychology-2', 'Create friction before an impulsive entry', [
          section('A short pre-trade check', 'Before submitting a paper trade, name the setup, point to the invalidation, verify size, and state the exit rule. This is most useful when the price is moving quickly and the urge to act feels strongest. If a requirement is missing, waiting is the planned action.'),
          section('Use a reset after an emotional outcome', 'An original practice routine: pause replay, take your hands off the controls, write one factual sentence about the last decision, and review the next-trade criteria. Resume only when you can explain the next trade independently of the last one. The purpose is to break the immediate reaction, not to erase emotion.'),
          section('Set limits before the session', 'Choose an illustrative session loss budget and a rule for pausing after repeated mistakes. Record the rule before trading. Do not raise the limit because the current session is losing, and do not create a minimum trade quota that pressures you to invent entries.')
        ], 'A good routine slows the specific moment when a decision becomes impulsive.'),
        lesson('psychology-3', 'Judge decisions without rewriting the story', [
          section('Use a two-axis review', 'Ask both “Did I follow the plan?” and “What was the net outcome?” You can have a planned winner, a planned loser, an unplanned winner, or an unplanned loser. The first question evaluates behavior; the second provides performance data. Neither should erase the other.'),
          section('Make the next change small', 'If the last session had several mistakes, choose the most repeated or costly process error and one correction. Changing the instrument, timeframe, entry, exit, and size together makes it hard to know which change mattered.', null, 'A trade wins $40 but entered at twice the planned quantity. Record the $40 result and the sizing breach. The win does not validate doubling size; the next practice goal is correct sizing before submission.')
        ], 'Reward honest execution and honest records, including profitable mistakes.')
      ],
      quiz: [
        question('Which note is most actionable?', ['I always fail', 'The market hates me', 'I entered before my trigger on three trades', 'I need to feel confident'], 2, 'The note identifies a specific behavior that can be counted and changed.'),
        question('You lose a planned trade and want to double the next size to get even. What is the best practice response?', ['Pause and apply the original sizing rule', 'Double it because the next trade is due', 'Remove the stop', 'Trade faster'], 0, 'The next outcome is not owed to you. Increasing risk to recover a loss abandons the existing budget.'),
        question('A rule-breaking trade wins. How should it be recorded?', ['As proof the rule is unnecessary', 'As a perfect process score', 'Delete it from the journal', 'As a positive outcome with a process breach'], 3, 'Outcome and process are separate. A lucky result does not make the decision consistent.'),
        question('Which if-then rule addresses FOMO most directly?', ['If price moves, enter anything', 'If I miss the planned entry zone, wait for a fresh setup', 'If I lose, trade larger', 'If I am bored, take a trade'], 1, 'This gives you an explicit response to a missed move without chasing a worse entry.')
      ]
    },
    {
      id: 'review', title: 'Turn the journal into evidence', subtitle: 'Measure expectancy, drawdown, and execution quality.', level: 'Evaluation', minutes: 26,
      skills: ['Calculate expectancy', 'Interpret win rate', 'Review a consistent sample'], labId: 'expectancy', sourceIds: ['cme-journal', 'schwab-plan', 'cme-losses'],
      lessons: [
        lesson('review-1', 'Record enough to explain the result', [
          section('Capture the plan before the outcome', 'A useful record includes date and time, instrument and venue, timeframe, setup version, direction, entry, initial stop, target or exit rule, size, initial dollar risk, and why the trade qualified. After exit, add net P&L, R, exit reason, adherence, and one useful observation.'),
          section('Use categories you can count', 'Tag a process error only when it actually happened: late entry, excess size, moved stop, no setup, early exit, or no breach. Avoid using “bad luck” as a catch-all. Record a skipped opportunity when your rule said to skip, so restraint is visible in the review.'),
          section('Keep the losing examples', 'Export and retain the journal before resetting a replay account. Deleting poor sessions creates a selective history. A small honest record is more useful than a polished record that excludes mistakes.')
        ], 'The journal should explain the decision, not only list the money result.'),
        lesson('review-2', 'Win rate is only one ingredient', [
          section('Calculate sample expectancy', 'Sample expectancy in dollars is average net P&L per trade. An equivalent form is win fraction × average winner − loss fraction × average loss magnitude, with flat trades contributing zero. In R units, average the individual net R results using the same initial-risk definition.'),
          section('Work an example', 'Profit factor is total positive P&L divided by the absolute total negative P&L. It is undefined when there are no losses; a tiny sample with no losses is not proof of safety.', null, 'Ten trades: four winners averaging +$150 and six losers averaging −$70. Total = 4 × 150 − 6 × 70 = $180. Expectancy = $18 per trade and win rate = 40%. Profit factor = 600 ÷ 420 ≈ 1.43. These are sample statistics, not a forecast.'),
          section('Costs can reverse the conclusion', 'If that example omitted $20 of costs per trade, the ten-trade total would instead be −$20 and expectancy −$2. Verify whether your journal figures are gross or net before comparing strategies.')
        ], 'Combine win rate with win size, loss size, costs, and sample size.'),
        lesson('review-3', 'Look at the path, not only the ending balance', [
          section('Define drawdown explicitly', 'Drawdown is a decline from an earlier peak in the value being measured. A closed-trade balance curve can hide deep losses while positions were open. An equity curve includes open P&L. State which curve a drawdown statistic uses, and keep the definition consistent.'),
          section('Review one question at a time', 'Group trades by setup version or market condition. Ask whether errors are clustered, whether the largest losses came from broken rules, and whether costs are large relative to the typical gross gain. A small sample can suggest where to investigate, but cannot establish a reliable edge.'),
          section('Write a next experiment', 'End the review with one testable adjustment and a new sample definition. For example: “For the next five practice sessions, I will skip entries outside the marked zone and record every skip.” Choose a process measure you control; do not set a required profit for each session.')
        ], 'An honest review states the sample, the costs, the drawdown definition, and the next experiment.')
      ],
      quiz: [
        question('Four wins of $150 and six losses of $70 produce what average P&L per trade?', ['$80', '$18', '−$18', '$180'], 1, 'Total P&L is $600 − $420 = $180. Divide by 10 trades to get $18 per trade.'),
        question('Can a 40% win rate be profitable after costs?', ['Never', 'Always', 'Yes, if net average winners are sufficiently larger than net average losers', 'Only if every loss is deleted'], 2, 'Win rate alone cannot answer profitability. The size of wins and losses and the costs matter.'),
        question('Which record can hide a large loss while a position remains open?', ['A mark-to-market equity curve', 'A timestamped screenshot', 'A full position record', 'A closed-trade balance curve'], 3, 'Closed-trade balance changes only on realized events and may omit the depth of open losses.'),
        question('What is the strongest conclusion from ten profitable paper trades?', ['The sample was profitable under its assumptions and needs more evaluation', 'The strategy is guaranteed to work', 'Real trading will produce the same fills', 'Risk limits are no longer necessary'], 0, 'A small sample is evidence about that sample. It does not establish durable profitability or realistic execution.')
      ]
    },
    {
      id: 'capstone', title: 'Run a disciplined practice session', subtitle: 'Bring the course together in a plan, replay, and evidence-based review.', level: 'Capstone', minutes: 35,
      skills: ['Write a session plan', 'Execute under uncertainty', 'Evaluate readiness honestly'], labId: 'discipline', sourceIds: ['cme-plan-video', 'cme-expectations', 'sec-day-risk', 'fidelity-plan'],
      lessons: [
        lesson('capstone-1', 'Prepare a complete session plan', [
          section('Choose one question for the session', 'Select an unseen replay segment, one instrument, one timeframe, and one setup version. Write what you are testing and what information is allowed. A useful question is “Can I apply my entry and sizing rules consistently?” A required profit target encourages forcing trades.'),
          section('Complete the plan before pressing play', 'Use the checklist below as your own training protocol. The session can legitimately finish with zero trades if no setup qualifies.', ['Name the market condition and the eligible setup.', 'Define the trigger, invalidation, target or exit rule, and session end.', 'Choose the paper risk budget, maximum exposure, and session pause limit.', 'Define no-trade conditions and the response to a missed entry.', 'State the fill assumptions, cost model, and what will count as a rule breach.'])
        ], 'A complete plan makes “wait” and “stop for the session” as clear as “enter.”'),
        lesson('capstone-2', 'Execute, annotate, and keep the evidence', [
          section('One decision at a time', 'At each decision point, pause and describe only the visible evidence. If a setup qualifies, calculate size and record the plan before opening. Advance without looking ahead. Follow the exit rule and record the result. If a setup does not qualify, write a short skip reason.'),
          section('An original completion rubric', 'For this capstone, aim to complete five documented practice sessions with the same setup version, explain every taken trade, and retain all outcomes. Score setup adherence, correct sizing, exit adherence, and completed review separately. These are learning targets, not a statistically sufficient proof of an edge.', ['Keep initial risk attached to each trade.', 'Record any gap or ambiguous candle assumption.', 'Include open P&L in the session assessment.', 'Export the journal and state one lesson for the next session.'])
        ], 'A completed practice session is one with a complete record, not necessarily a profit.'),
        lesson('capstone-3', 'What comes after the course', [
          section('Use the results to choose the next practice', 'If candle or structure recognition is weak, repeat those labs. If sizing is inconsistent, reduce the number of moving parts and practise the arithmetic. If rules are followed but the strategy loses, investigate the setup and its costs. Do not solve every problem by adding another indicator.'),
          section('Build professional habits without a false promise', 'Consistency, record keeping, realistic execution assumptions, and risk control are valuable habits. Real trading also involves operational, emotional, legal, and financial constraints that this course cannot certify. A course completion badge is a learning milestone, not a license or permission to put savings at risk.'),
          section('Keep learning deliberately', 'Before considering real capital, understand the exact product and current broker rules, evaluate a much broader set of unseen conditions, and decide whether the potential losses fit your circumstances. Seek qualified advice when personal financial or regulatory questions matter. Continuing in simulation is a valid choice.')
        ], 'Use course completion to guide further learning, not to declare yourself guaranteed ready for live trading.')
      ],
      quiz: [
        question('A session produces no qualifying setup. What is a successful process outcome?', ['Force a trade to finish the exercise', 'Change the strategy secretly', 'Record the skips and complete the review', 'Keep playing until a profitable trade appears'], 2, 'A no-trade session can follow the plan perfectly. The learning task is consistent decisions and an honest record.'),
        question('Which belongs in the plan before replay begins?', ['The future winning entry', 'Only a required daily profit', 'The exact next candle', 'Risk budget, setup rules, exits, and pause conditions'], 3, 'These are decisions you can define in advance and apply without knowing the outcome.'),
        question('What should happen to losing sessions in the capstone record?', ['Retain them and review them', 'Delete them before calculating statistics', 'Rename them as warm-ups after seeing the result', 'Ignore open losses'], 0, 'Keeping all outcomes prevents selective reporting and gives you useful evidence about weaknesses.'),
        question('What is the appropriate meaning of completing the capstone?', ['Guaranteed professional income', 'A documented learning milestone with more evaluation still needed', 'Exemption from account rules', 'Proof that leverage is safe'], 1, 'The capstone demonstrates participation in a learning process. It cannot certify profitability, licensing, or suitability for real trading.')
      ]
    }
  ];

  const fifthQuestions = {
    foundations: question('You hold 50 units priced at $40. Which amount is the notional exposure?', ['$50', '$40', '$2,000', 'The stop-loss amount'], 2, 'Notional is quantity × current price: 50 × $40 = $2,000. Planned loss to a stop is a different calculation.'),
    candles: question('A candle opens at 80, closes at 77, has a high of 82 and a low of 76. What is the upper wick length?', ['2', '3', '5', '6'], 0, 'The upper edge of the body is the higher of open and close: 80. Upper wick = 82 − 80 = 2.'),
    structure: question('You can describe both rising and falling swing sequences depending on where you start. What is the most defensible next step?', ['Call the trend bullish because you want to buy', 'Ignore the chosen timeframe', 'Use future candles to resolve it', 'Apply your fixed swing definition and label unresolved structure unclear'], 3, 'A consistent observation rule matters. Unclear is a useful state; forcing a label adds confidence without evidence.'),
    orders: question('Your reported entry and exit fills already include simulated slippage. What should you avoid when calculating net P&L?', ['Including entry fees', 'Subtracting that same slippage a second time', 'Including exit fees', 'Recording the actual fill prices'], 1, 'The slippage has already affected the difference between entry and exit. Charging it again would double-count that cost.'),
    sizing: question('A risk calculation permits 250 shares at $50, but the available unleveraged capital is $10,000. Ignoring fees, what is the largest permitted whole-share size?', ['200 shares', '250 shares', '500 shares', '10,000 shares'], 0, 'The capital constraint permits $10,000 ÷ $50 = 200 shares. Use the smaller of the risk-based and capital-based limits; fees may reduce it further.'),
    setups: question('You change the entry rule after seeing several losses. How should subsequent results be tracked?', ['Pool them silently with the old rule', 'Erase the losses', 'Label the new version and evaluate it on fresh data', 'Count only the winners under either version'], 2, 'A changed rule is a new experiment. Keeping its version and evaluation sample separate prevents a misleading combined record.'),
    management: question('The replay ends with an open position down $180. What is an honest session assessment?', ['Report only closed winners', 'Assume it will recover tomorrow', 'Delete the position', 'Include the open loss in equity and state that the position remains open'], 3, 'An unfinished trade still affects account value. Apply the defined session-close rule or report it explicitly as open.'),
    psychology: question('Which review combines outcome and process correctly?', ['Every winner was a good decision', 'Record net P&L and independently score whether the rules were followed', 'Every loser was a mistake', 'Ignore process when the account grew'], 1, 'A result can be profitable despite a rule breach, or lose despite correct execution. Keeping both measures helps you learn.'),
    review: question('A sample has $300 of gains and no losing trades. What is the correct treatment of profit factor?', ['Undefined because the loss denominator is zero', 'Exactly 1', 'Proof of unlimited profit potential', 'Exactly 300'], 0, 'Profit factor divides gains by the magnitude of losses. With zero losses, the denominator is zero; do not turn that into evidence of safety.'),
    capstone: question('You finish the calendar plan but still cannot size a position consistently. What is the appropriate next step?', ['Start live trading because the weeks are complete', 'Skip the sizing requirement', 'Repeat the relevant lessons and demonstrate the calculation correctly', 'Increase leverage to learn faster'], 2, 'Elapsed time is not competence. Progress should respond to demonstrated knowledge and execution, not the calendar alone.')
  };
  modules.forEach(module => module.quiz.push(fifthQuestions[module.id]));

  modules.push(
    {
      id: 'stocks', title: 'Understand stocks and ETFs', subtitle: 'Choose a practice instrument with a clear understanding of its context and data.', level: 'Equities', minutes: 35,
      skills: ['Distinguish company and fund exposure', 'Compare market and sector behavior', 'Recognize corporate-action data issues'], labId: 'structure', sourceIds: ['sec-stocks', 'sec-etfs', 'sec-split', 'fidelity-relative'],
      lessons: [
        lesson('stocks-1', 'A ticker is more than a chart', [
          section('Know what one unit represents', 'A common share represents an ownership interest in one company. An ETF share represents an interest in a fund with a stated objective and holdings. Two tickers with similar-looking charts can have different business exposures, liquidity, fees, and event risks. Learn the instrument before choosing it for a replay session.'),
          section('A fund is not automatically broad diversification', 'A broad-market equity ETF and a narrowly focused sector ETF are different exposures. A fund can be concentrated in a few holdings, one industry, or one type of risk. Its market price can differ from its net asset value. Read the issuer’s current description and holdings rather than inferring the exposure from the name.'),
          section('Build an instrument card', 'For each symbol in your practice list, record the full name, instrument type, quote currency, exchange or data venue, trading session, and what a quantity of one means. Add the main event and liquidity concerns. This is a reference card, not a buy recommendation.', null, 'An illustrative card might say: “ABC common shares; USD per share; regular U.S. equity session; company earnings can affect price; use whole-share sizing in this exercise.” A fund card would also state its investment objective and concentration.')
        ], 'Select an instrument you can describe, not merely a familiar ticker.'),
        lesson('stocks-2', 'Use market and sector context', [
          section('Compare the same window', 'An individual stock can move with broad-market news, sector developments, and company-specific information. Compare percentage changes over the same time window when judging relative performance. A $2 move means different things for a $20 stock and a $200 stock.'),
          section('Relative strength is a comparison', 'Here, relative strength means how one instrument performs compared with another or an index. It is not the same as the Relative Strength Index oscillator, usually called RSI. Outperformance can occur while both instruments are falling, so it does not necessarily mean an outright gain.', null, 'Over the same interval, stock A falls from 100 to 98 (−2%) while its comparison index falls from 200 to 190 (−5%). A outperformed the index by 3 percentage points, yet a long position in A still lost value.'),
          section('Use context as a recorded condition', 'Write the broad-market and sector observations before the entry. If you use them as filters, define the measurement and test it consistently. “The market looked strong” is too vague to reproduce. Context can explain exposure; it cannot guarantee that a stock will follow an index.')
        ], 'Relative outperformance and absolute profit are different statements.'),
        lesson('stocks-3', 'Check events and corporate actions', [
          section('Price history needs a definition', 'Stock splits change share counts and per-share prices without creating an equivalent gain or loss by themselves. Historical data may adjust older prices for splits, dividends, or both. Mixing adjusted and unadjusted fields can create false chart moves or inconsistent comparisons.'),
          section('Work a split example', 'Use a consistent data convention and inspect large discontinuities before treating them as tradable gaps. A replay chart alone may not tell you which corporate actions were applied.', null, 'Before a 2-for-1 split, 30 shares at $120 have a value of $3,600. Ignoring other market movement, afterward there are 60 shares at $60, still worth $3,600. Treating the halved price as a 50% trading loss would be wrong.'),
          section('Prepare for information events', 'Company announcements and scheduled economic releases can change the conditions behind a trade. Use the issuer’s investor-relations information and official release calendars when constructing a real session plan. Decide in advance whether your tested strategy includes those events. Do not pretend that a price-only dataset includes news you have not actually checked.')
        ], 'Before interpreting an unusual move, check the data convention and relevant events.')
      ],
      quiz: [
        question('Which statement about a sector ETF is correct?', ['It is automatically diversified across the whole economy', 'It may concentrate exposure in one industry or group of companies', 'Its price cannot fall', 'It has no trading spread'], 1, 'A sector focus can concentrate exposures. The fund’s actual objective and holdings determine its diversification.'),
        question('A stock falls 2% while its comparison index falls 5% over the same interval. Which is true?', ['The stock made an absolute gain', 'The index outperformed by 3 percentage points', 'The stock outperformed by 3 percentage points while still falling', 'The stock must rise next'], 2, '−2% is 3 percentage points better than −5%, but it remains a negative return.'),
        question('Ignoring other market movement, what follows a 2-for-1 split of 30 shares priced at $120?', ['15 shares at $240', '30 shares at $60', '60 shares at $120', '60 shares at $60'], 3, 'The share count doubles and the per-share price halves, leaving the same $3,600 value before other price changes.'),
        question('What should be checked before treating a large discontinuity in stock history as a trading signal?', ['Corporate actions and the dataset’s adjustment convention', 'Whether the candle is a favorite color', 'Whether a later recovery occurred', 'Only the number of decimal places'], 0, 'A split or inconsistent adjustment can create an apparent jump unrelated to an executable trading opportunity.'),
        question('A $2 rise occurs in both a $20 stock and a $200 stock. What are the respective returns?', ['1% and 10%', '10% and 1%', '2% and 2%', '20% and 200%'], 1, 'Percentage return divides the change by the starting price: 2/20 = 10%; 2/200 = 1%.')
      ]
    },
    {
      id: 'sessions', title: 'Work with sessions, clocks, and liquidity', subtitle: 'Understand U.S. equity hours and why execution changes across the day.', level: 'Equities', minutes: 35,
      skills: ['Convert Eastern time correctly', 'Distinguish regular and extended hours', 'Model spread and gap costs'], labId: 'orders', sourceIds: ['nyse-hours', 'nist-time', 'sec-extended', 'sec-stops'],
      lessons: [
        lesson('sessions-1', 'Use the market’s clock', [
          section('The regular session has boundaries', 'As checked in the NYSE trading-hours reference, the ordinary core equity session is 9:30 a.m. to 4:00 p.m. Eastern Time. Holidays, early closes, instrument rules, and venue schedules can change the available session. Check the official calendar for the date being studied instead of assuming every weekday is identical.'),
          section('Eastern Time changes its UTC offset', 'New York observes standard and daylight time. Eastern Standard Time is UTC−5; Eastern Daylight Time is UTC−4. The local opening time stays 9:30 a.m., while its UTC representation changes. Store an actual timestamp and use a date-aware America/New_York conversion; do not hard-code one offset for every month.', null, 'On an ordinary winter session, 9:30 a.m. EST corresponds to 14:30 UTC. During daylight time, 9:30 a.m. EDT corresponds to 13:30 UTC. A constant 14:30 UTC filter would mislabel daylight-time bars.'),
          section('Label the timestamp convention', 'Confirm whether a bar timestamp marks the interval open or close and whether the dataset includes extended-hours observations. Those choices affect opening-range calculations and session boundaries.')
        ], 'A session label is only reliable when date, timezone, and bar convention agree.'),
        lesson('sessions-2', 'The open, the close, and extended hours', [
          section('Different periods can have different conditions', 'An opening auction and a closing auction are different mechanisms from ordinary continuous trading. Extended-hours markets can have less liquidity, wider spreads, and order-handling differences. A strategy tested only during the regular session has not automatically been tested outside it.'),
          section('Treat the opening gap separately', 'A gap compares a chosen prior reference with a later opening price. State whether the reference is the prior regular-session close or the immediately preceding extended-hours bar. A gap is an observation, not a requirement for price to return to the earlier close.', null, 'Previous regular close = 80; next regular open = 84. The gap is +$4, or +5% relative to 80. That fact alone does not establish whether buying, shorting, or waiting has an advantage.'),
          section('Define your eligible window', 'Choose a session window before testing. If the rule avoids the first few minutes, write the exact interval and the reason being tested. Keep extended-hours trades in a separate labeled sample unless the strategy was designed to include them.')
        ], 'Session boundaries and eligible windows belong in the strategy specification.'),
        lesson('sessions-3', 'Translate liquidity into costs', [
          section('The last trade is not the executable quote', 'A candle close summarizes a transaction price. It does not give the full bid-ask spread or depth available for your intended size. A small trade and a large trade can have different execution costs. Price-only data cannot reconstruct missing quote and queue information.'),
          section('Work the spread arithmetic', 'If you buy at the ask and immediately sell at the bid with no other price change, the spread is a cost per share. Commissions and other fees can add to that cost.', null, 'Bid 49.90, ask 50.10, size 100 shares. Buying at 50.10 and selling at 49.90 produces a $20 gross loss: 100 × $0.20. This example excludes fees and any additional slippage.'),
          section('Stress the model rather than inventing precision', 'Keep the base cost assumptions visible, then repeat the calculation with larger costs. If the apparent advantage disappears after a modest cost change, describe that sensitivity. A fixed slippage number is a training assumption, not a measurement of actual historical execution.')
        ], 'Small price targets must be evaluated against the spread, fees, and uncertain fills.')
      ],
      quiz: [
        question('On a normal NYSE core trading day, what is the regular equity session in Eastern Time?', ['8:00 a.m.–5:00 p.m.', '9:30 a.m.–4:00 p.m.', '24 hours without interruption', '9:30 a.m.–4:00 p.m. UTC'], 1, 'The ordinary core session is 9:30 a.m.–4:00 p.m. ET. Check holidays and early closes for the actual date.'),
        question('What UTC time corresponds to 9:30 a.m. Eastern Daylight Time?', ['14:30 UTC', '09:30 UTC', '13:30 UTC', '04:30 UTC'], 2, 'EDT is UTC−4, so add four hours. Eastern Standard Time would require five hours.'),
        question('Bid is 49.90 and ask is 50.10. Buying then immediately selling 100 shares at those quotes costs how much before fees?', ['$0.20', '$2', '$10', '$20'], 3, 'The $0.20 spread multiplied by 100 shares is $20.'),
        question('What does a gap from a prior close of 80 to an open of 84 establish?', ['A +5% opening change, with no guaranteed later path', 'A guaranteed move back to 80', 'A risk-free short', 'A +4% opening change'], 0, 'The change is 4/80 = 5%. A gap does not by itself predict a fill, continuation, or reversal.'),
        question('Why should an extended-hours sample be labeled separately from a regular-hours sample?', ['The calendar date is never the same', 'Liquidity, spreads, and order handling may differ', 'Fees are always zero outside regular hours', 'Prices cannot move during extended hours'], 1, 'The execution environment may differ materially, so pooling the samples can conceal those differences.')
      ]
    },
    {
      id: 'playbook', title: 'Write a precise trading playbook', subtitle: 'Turn one idea into an auditable rule and a collection of examples.', level: 'Research', minutes: 40,
      skills: ['Specify a reproducible rule', 'Build pass and fail examples', 'Track strategy versions'], labId: 'levels', sourceIds: ['cme-strategy', 'schwab-plan', 'sec-performance'],
      lessons: [
        lesson('playbook-1', 'Write a rule another person could apply', [
          section('Replace adjectives with observations', 'Words such as strong, clean, and obvious hide different interpretations. State the instrument universe, session, timeframe, data source, setup condition, trigger, order model, invalidation, exit rule, risk budget, and exclusions. If discretion remains, name it and record the reason each time it is used.'),
          section('Specify the clock and the information boundary', 'A rule triggered by a completed 15-minute bar cannot know that bar’s final high, low, or close before the interval ends. A historical order model must act after the information is available. Define whether you assume the next bar’s open, a later quote, or another observable execution rule.'),
          section('Keep one controlled question', 'For a learning experiment, keep the market and execution assumptions fixed while testing one rule. This makes interpretation easier. It does not make the rule profitable; it makes the test understandable.', null, 'Vague: “Buy a strong breakout.” Observable research rule: “During the defined regular session, a completed bar closes above the premarked zone; if all risk and no-trade conditions pass, evaluate a long at the next eligible modeled fill.”')
        ], 'Precision helps you test an idea without quietly changing it after the result.'),
        lesson('playbook-2', 'Create a library of examples and non-examples', [
          section('Collect the boundary cases', 'A useful playbook shows qualifying setups, similar-looking non-setups, failed qualifying trades, and missed entries. Save only information available at the decision time, then keep the later outcome separately. The losing examples teach whether the rule was followed even when the hypothesis failed.'),
          section('Annotate the same fields every time', 'For each example, record the condition, level, trigger, invalidation, proposed size, and exclusion checks. Write which single condition caused a skip. If two reasonable readings of the rule disagree, revise its wording during development and then freeze the new version.'),
          section('Avoid an illustration-only playbook', 'A collection of perfect winners is a presentation, not a test. Include the ugly examples that show where the method is hard to apply. A rule can be consistently applied and still have negative expectancy after costs.')
        ], 'The most useful examples often show why a tempting trade does not qualify.'),
        lesson('playbook-3', 'Version changes and compare fairly', [
          section('Record each research decision', 'Assign a simple version label such as pullback-v1. Keep a change log with the date, old rule, new rule, reason, and the fresh data reserved for evaluation. Do not compare a heavily tuned version’s development results with another version’s untouched test results as if they were equivalent.'),
          section('Choose a baseline and a stopping rule', 'A baseline gives the comparison a reference, such as the earlier rule under identical costs or a no-trade result for the session. Before testing, state the sample boundary and what will prompt a review. Stopping a test only after a good streak can make an ordinary strategy look unusually successful.'),
          section('Change one element for an interpretable exercise', 'For this course, compare one change at a time on clearly labeled samples. Keep the original results. If you change entry, exit, session, and risk together, you may learn that the combined package differed, but you will not know which change caused the difference.')
        ], 'Version labels and a fair comparison are part of the strategy, not administrative extras.')
      ],
      quiz: [
        question('Which rule has the clearest information boundary?', ['Enter before a candle closes because its final close will be strong', 'Use tomorrow’s high to set today’s target', 'Act after a completed bar satisfies the written condition', 'Choose only the breakouts that later work'], 2, 'The completed bar’s information is available only after it finishes. The modeled action must respect that timing.'),
        question('What belongs in a useful setup example library?', ['Only large winners', 'Only the final account balance', 'Only memorable charts', 'Qualifying wins and losses, non-setups, and missed entries'], 3, 'A varied set reveals the rule’s boundaries and avoids a selected gallery of success.'),
        question('You alter the stop rule while reviewing a test sample. How should you treat that sample for the new rule?', ['It has now influenced development; reserve fresh data for evaluation', 'It remains completely untouched evidence', 'It proves the new rule works', 'Delete the earlier version'], 0, 'Once outcomes influence a change, the sample is no longer an untouched test for that version.'),
        question('Why keep the cost model identical when comparing two rule versions?', ['To make every trade win', 'To avoid attributing a cost-model change to the trading rule', 'To remove the need for a journal', 'Because real costs never vary'], 1, 'A fair comparison isolates the change being studied. You can separately test sensitivity to different costs.'),
        question('Which test ending is least vulnerable to selectively choosing a good streak?', ['Stop as soon as the account is up', 'Stop after the largest winner', 'Use the sample boundary written before testing', 'Erase the last losing day'], 2, 'A predeclared boundary reduces the temptation to choose an endpoint because it makes results look better.')
      ]
    },
    {
      id: 'testing', title: 'Test an idea without fooling yourself', subtitle: 'Understand bias, unseen samples, uncertainty, and the limits of backtests.', level: 'Research', minutes: 45,
      skills: ['Detect research bias', 'Separate development and evaluation', 'Interpret uncertain estimates'], labId: 'expectancy', sourceIds: ['sec-performance', 'nfa-hypothetical', 'nist-confidence'],
      lessons: [
        lesson('testing-1', 'Four ways a backtest can mislead', [
          section('Hindsight and missing instruments', 'Look-ahead bias uses information that was not available at the decision time. Survivorship bias tests only instruments that remain available or successful today while omitting those that disappeared. Selection bias can also arise from choosing only attractive periods. Record how the instruments and dates were chosen.'),
          section('Too many attempts and unrealistic fills', 'Trying many variations and reporting only the best can find an impressive result by chance. Keep the failed variations and the number of attempts in the research log. A fill model that assumes every limit touch fills, ignores costs, or acts before a signal is known can add another false advantage.'),
          section('Use a data audit before a performance claim', 'Check timestamps, ordering, duplicates, missing bars, corporate-action conventions, session boundaries, and the definition of volume. A clean-looking chart does not establish that these inputs are correct. Hypothetical performance is still hypothetical after the audit.')
        ], 'Before asking whether a strategy made money, ask whether the test was possible and complete.'),
        lesson('testing-2', 'Protect an unseen evaluation sample', [
          section('Three stages with different jobs', 'Development data helps formulate rules. Validation data can help choose between a limited set of versions. A final holdout is reserved for evaluating the selected version after decisions are frozen. If you inspect the holdout and change the rule, it has become part of development; you need a new honest evaluation period.'),
          section('Respect time order', 'For time-dependent market data, a chronological split often better reflects the problem of applying earlier decisions to later observations. Randomly mixing overlapping bars or trades can leak closely related information across the split. Label the actual date ranges and the unit of analysis.'),
          section('Walk forward carefully', 'A walk-forward exercise repeatedly develops a rule on an earlier window and evaluates it on a later window using a process specified beforehand. It can reveal instability, but does not eliminate tuning, execution assumptions, or changes in market behavior. Preserve every window, including the weak ones.')
        ], 'An unseen sample stays unseen only until it influences your decisions.'),
        lesson('testing-3', 'A positive average can still be uncertain', [
          section('Estimate and uncertainty belong together', 'Sample expectancy is an estimate of average outcome under that sample’s conditions. More observations can improve precision when the assumptions are appropriate, while larger variation increases uncertainty. Trade outcomes may be dependent, skewed, or drawn from changing conditions, so a simple textbook interval can be misleading if used without those checks.'),
          section('A simplified confidence-interval example', 'Under a suitable independent-observation model, the standard error of a sample mean is sample standard deviation divided by the square root of sample size. A rough 95% interval uses about two standard errors for a reasonably large sample. This is an illustration of uncertainty, not a claim that market trades satisfy the assumptions.', null, 'For 100 hypothetical observations with mean +0.20R and standard deviation 1.50R: standard error = 1.50/√100 = 0.15R. A rough interval is 0.20 ± 0.30R, or −0.10R to +0.50R. The positive sample mean does not rule out a nonpositive underlying mean under this model.'),
          section('Do not turn a confidence label into a guarantee', 'A frequentist confidence level describes the repeated-sampling behavior of the interval method under its assumptions. It is not a promise about the next trade or a guarantee that the future market will resemble the sample. State limitations, cost sensitivity, and dependence alongside the result.')
        ], 'Report the estimate, sample, assumptions, and uncertainty without promising future returns.')
      ],
      quiz: [
        question('Testing only today’s successful surviving companies while ignoring those that disappeared is an example of what?', ['Slippage', 'A bid-ask spread', 'A trailing stop', 'Survivorship bias'], 3, 'The instrument sample omits failures or unavailable instruments and may make historical results look better.'),
        question('After inspecting the final holdout results, you change the strategy. What happened to that holdout?', ['It influenced development and is no longer untouched evidence for the new version', 'It became more independent', 'It now guarantees future results', 'Its losing trades no longer count'], 0, 'Rule changes based on those outcomes use the holdout information. Evaluate the changed rule on fresh data.'),
        question('Under the simplified independent-observation formula, standard deviation is 1.50R and sample size is 100. What is the standard error?', ['1.50R', '0.15R', '0.015R', '15R'], 1, 'Standard error is s/√n = 1.50/10 = 0.15R under the stated assumptions.'),
        question('An illustrative interval for average outcome runs from −0.10R to +0.50R. What is the defensible interpretation?', ['Every trade will stay inside that range', 'Profitability is certain', 'The estimate remains compatible with a nonpositive average under the model', 'The next trade must win'], 2, 'The interval concerns the average under assumptions, not individual trades, and it includes zero and negative values.'),
        question('A researcher tries 200 rule variations and advertises only the most profitable one. What information is missing?', ['Only the chart colors', 'Only the browser size', 'Nothing important', 'The full search history and an independent evaluation of the selected rule'], 3, 'Selecting the best of many attempts can capitalize on chance. The number of attempts and unseen evaluation matter.')
      ]
    },
    {
      id: 'execution_review', title: 'Review execution and account damage', subtitle: 'Find whether problems come from the idea, the fills, or the behavior.', level: 'Evaluation', minutes: 40,
      skills: ['Separate strategy and execution results', 'Measure adverse and favorable movement', 'Review drawdown and correlated trades'], labId: 'riskreward', sourceIds: ['cme-journal', 'sec-performance', 'nfa-hypothetical'],
      lessons: [
        lesson('execution_review-1', 'Compare the plan with the actual decision', [
          section('A useful review has three layers', 'First ask whether the setup qualified under the rule. Next ask whether the order and size followed the plan. Then examine the financial outcome after costs. This separates a strategy that needs research from an execution habit that needs practice.'),
          section('Measure differences using fixed definitions', 'Record the intended trigger or reference price, modeled fill, planned initial risk, actual quantity, and exit reason. If you calculate entry slippage, state the reference and direction so an adverse cost is consistently positive. Do not combine a change in market price before you decided with execution delay after you decided without labeling them.'),
          section('Use an adherence rate with a denominator', 'Choose a measurable rule such as “quantity was at or below the precomputed size.” Adherence rate is qualifying decisions divided by decisions reviewed. Define what counts as reviewed and keep unknown cases visible.', null, 'Of 20 trades, 17 used the planned size and 3 exceeded it. Sizing adherence was 17/20 = 85%. That metric does not say whether the setup itself was profitable.')
        ], 'A review is more useful when it identifies which layer needs work.'),
        lesson('execution_review-2', 'Learn from movement while the trade was open', [
          section('Define MAE and MFE', 'Maximum adverse excursion (MAE) is the largest move against the position while it was open. Maximum favorable excursion (MFE) is the largest move in its favor. For a simple long, compare entry with the lowest and highest observed prices during the holding period. Reverse the direction for a short. Express the measure in dollars, price units, or initial R and label the convention.'),
          section('Use the measures diagnostically', 'These measures can help ask whether exits consistently allow large givebacks or whether stops are near ordinary adverse movement for a particular setup. They do not identify an optimal stop or target by themselves, and changing exits to fit the same sample risks overfitting.', null, 'A long entered at 100 reaches a low of 99 and high of 104 while definitely open, then exits at 102. With initial price risk of 2, price-based MAE is 1/2 = 0.5R and MFE is 4/2 = 2R; the gross exit is +1R.'),
          section('Respect bar-data uncertainty', 'If the exit happens inside a candle, its full high and low may include prices reached after the position closed. OHLC data cannot resolve that path. Mark an approximation or exclude the ambiguous portion; do not present an unknowable intrabar measurement as exact.')
        ], 'Excursions describe the path of an open trade only as accurately as the data allows.'),
        lesson('execution_review-3', 'Assess drawdown, clusters, and recovery', [
          section('Follow the equity curve', 'Closed-trade balance can hide open losses. Review mark-to-market equity when available and identify peak-to-trough declines with dates and the measurement convention. Ask whether the drawdown came from expected losses, concentrated exposure, broken rules, or model assumptions.'),
          section('Several trades can share one exposure', 'Multiple positions in related companies may respond to the same market or sector event. Counting each trade as an independent bet can understate the common exposure. Even when the simulator permits only one position at a time, a sequence of tightly clustered trades can still reflect the same market condition.'),
          section('Use review thresholds as process rules', 'A training threshold should trigger a pause and diagnosis, not a promise that losses cannot exceed it. Decide it before the session. A 20% loss needs a 25% recovery gain because the recovery starts from a smaller base; increasing risk to force the recovery can make the decline worse.')
        ], 'Evaluate the account path and common exposures, not just the number of winning trades.')
      ],
      quiz: [
        question('Seventeen of twenty reviewed trades used the planned quantity. What is sizing adherence?', ['17%', '20%', '85%', '117%'], 2, '17 ÷ 20 = 0.85, or 85%. It measures that process rule, not profitability.'),
        question('A long enters at 100, trades as low as 99 and as high as 104 while definitely open, and had initial price risk 2. What is its price-based MFE?', ['0.5R', '1R', '4R', '2R'], 3, 'The largest favorable move was 104 − 100 = 4; divided by initial price risk 2, MFE is 2R.'),
        question('Why might an exit candle’s full high and low overstate a trade’s excursions?', ['Those extremes may have occurred after the position closed', 'The candle has no prices', 'The entry fee changes the clock', 'All exits happen at the candle high'], 0, 'OHLC does not show the intrabar order of events. Full-bar extremes may not have occurred during the holding period.'),
        question('Equity falls from 10,000 to 8,000. What gain from 8,000 is required to return to 10,000?', ['20%', '25%', '80%', '2%'], 1, 'The required $2,000 recovery is 2,000/8,000 = 25%.'),
        question('Why can three technology-stock positions share more risk than their count suggests?', ['Three positions are always perfectly independent', 'Their tickers have the same number of letters', 'They may respond to the same sector or market event', 'All ETFs eliminate common exposure'], 2, 'Related instruments can move together under a shared event, creating concentrated exposure.')
      ]
    },
    {
      id: 'business', title: 'Build a sustainable professional routine', subtitle: 'Treat research, operations, capital, and accountability as part of the work.', level: 'Professional habits', minutes: 40,
      skills: ['Separate learning from income promises', 'Plan operational contingencies', 'Set evidence-based progression gates'], labId: 'discipline', sourceIds: ['sec-day-risk', 'cme-expectations', 'cme-plan-video', 'sec-performance'],
      lessons: [
        lesson('business-1', 'A trading result is not a salary', [
          section('Separate the accounts in your thinking', 'Trading capital, living expenses, emergency resources, and business costs serve different purposes. Do not treat a short paper-trading streak as dependable income. Real activity can have subscriptions, data, transaction costs, financing, and jurisdiction-dependent tax obligations, as well as losing periods.'),
          section('Build an illustrative operating budget', 'List recurring and variable costs before discussing a net result. Keep personal withdrawals separate from strategy P&L so performance is not confused with cash movements. This is a planning exercise, not a recommendation about how much capital any individual should trade.', null, 'A hypothetical month shows $600 after trading fees but before $80 of data costs and $40 of other tools. The operating result before tax is $480. Withdrawing $700 would reduce the account by an additional $220 relative to the starting value; the withdrawal is not another trade loss.'),
          section('Define professional habits honestly', 'Preparation, audit trails, risk controls, and review can be practised now. Whether someone is legally permitted to manage money or advise others depends on their role and jurisdiction. Completing this track does not grant those permissions or establish a reliable source of earnings.')
        ], 'Evaluate costs and capital needs without turning hypothetical returns into an income promise.'),
        lesson('business-2', 'Prepare for operational failure', [
          section('The plan includes the tools', 'Consider missing data, stale quotes, an interrupted connection, an order whose status is unknown, and an unexpected session close. In simulation, practice stopping when the information required by the rule is absent. In a real account, learn the broker’s documented procedures before an incident occurs.'),
          section('Write a response, not just a worry', 'For each failure, specify how you detect it, what new activity stops, where you verify the account or order state, and what evidence you retain. An uncertain order should not lead to repeated blind submissions that might create duplicate exposure.'),
          section('Keep records recoverable', 'Export the journal and study work regularly, retain strategy versions and data-source notes, and verify that an export can be read. If progress is stored in a browser, clearing storage or changing devices can remove local state. A backup is useful only if you can understand and recover it.')
        ], 'A calm response to missing information is an execution skill.'),
        lesson('business-3', 'Use competence gates instead of a deadline', [
          section('The sixteen weeks are a scaffold', 'The track supplies a four-month sequence of focused assignments. It is not a deadline for becoming profitable or a professional. Repeat a week when its criteria are not demonstrated. Passing a quiz measures the tested knowledge; it does not replace a record of correctly executed sessions.'),
          section('Review the evidence in several categories', 'Use separate gates for concept knowledge, chart recognition, risk calculations, adherence, data and execution assumptions, journal completeness, and the ability to explain uncertainty. Keep failed attempts and corrections. A weakness in one category cannot be erased by a lucky profit in another.'),
          section('Choose the next step from the record', 'At the end, write a candid assessment: strengths, repeated errors, sample limitations, and the next experiment. Continuing simulation, narrowing the strategy, seeking qualified guidance, or choosing not to day trade can all be reasonable outcomes. Financial suitability and current account rules require decisions beyond this course.')
        ], 'Advance when the evidence supports the next learning task, not simply because time has passed.')
      ],
      quiz: [
        question('Trading P&L is +$600 after trading fees; separate data and tool costs are $120. What is the operating result before tax?', ['$720', '$600', '$120', '$480'], 3, '$600 − $120 = $480. Keep the stated cost convention clear.'),
        question('An order’s status is unknown after a connection interruption. What is the sound operational principle?', ['Verify the existing order and account state before blindly submitting duplicates', 'Submit the same order repeatedly', 'Assume it was canceled', 'Ignore the risk because the chart stopped'], 0, 'Unknown status creates uncertainty about exposure. A documented verification process helps avoid duplicate orders.'),
        question('What does reaching week 16 establish by itself?', ['Guaranteed profitability', 'Only that the scheduled time has elapsed', 'Permission to manage other people’s money', 'Proof that the strategy survives all conditions'], 1, 'Time alone does not establish competence, legal permission, or a durable trading edge.'),
        question('Which item should be tracked separately from strategy P&L?', ['The entry price', 'The exit fee', 'A personal withdrawal from the account', 'The trade’s realized loss'], 2, 'A withdrawal is a cash flow rather than a trading result. Keeping it separate makes performance interpretable.'),
        question('Which end-of-track assessment is strongest?', ['Only show the best week', 'Report a score without the sample', 'Claim every remaining weakness is solved', 'Document strengths, errors, assumptions, limitations, and the next learning experiment'], 3, 'A credible assessment includes what remains uncertain and what evidence should be collected next.')
      ]
    }
  );

  /* Compact teaching flows sit above the longer reference lessons. A guided
     checkpoint checks the stated chart/order facts; written extensions remain
     learner reflection rather than an invented automatic assessment. */
  const guidedTitles = {
    'read-candle': 'Read the actual candle', 'candle-range': 'Measure a candle',
    'identify-trend': 'Classify visible structure', 'map-levels': 'Mark the decision levels',
    'size-long': 'Size and place a long', 'size-short': 'Size and place a short',
    'protect-trade': 'Place a protected trade', 'wait-trigger': 'Wait for the written trigger',
    'handle-loss': 'Follow the exit rule', 'equity-check': 'Read your open account',
    'review-trade': 'Review an actual paper trade', 'complete-plan': 'Plan, trade, and review'
  };
  const lessonFlows = [
    ['foundations-1', 'equity-check',
      'Ten shares move the gross result by $10 for each $1 move in price. Your first job is to understand that exposure, then decide how much of it fits a written plan.',
      'Open the guided account lab, read the share quantity and actual fill, and advance one candle. Work out the effect of that price change before checking the account answer.',
      'Explain the result using quantity and price movement. Whether the practice trade wins is a separate question from whether you understood it.',
      'Complete the actual-entry and account-value checkpoints.', 'In your own notes, explain what one dollar of price movement does to this position.'],
    ['foundations-2', 'equity-check',
      'Balance records the paper account’s realized accounting. Equity adds the current open result. A $10,000 balance with a $100 open loss means $9,900 equity before future exit costs.',
      'Place the lab trade, step forward, and calculate balance plus open P&L using the stored fill and current close. Compare that answer with the marked account.',
      'Explain why leaving a losing trade open does not keep equity unchanged. Include the entry fee when reconciling the starting and current account.',
      'Calculate the actual marked equity within the stated rounding tolerance.', 'Distinguish the account balance, open result, and notional exposure in your notes.'],
    ['foundations-3', 'wait-trigger',
      'A decision is fair only if it uses information that existed at that moment. The fixed trigger line in this exercise comes entirely from the visible starting window.',
      'State whether the trigger is met before advancing. Reveal one candle at a time for the required observation period and make the next decision from the new visible close.',
      'Keep both your initial and later decisions. A later breakout does not excuse an earlier entry that lacked the required evidence.',
      'Complete the wait checkpoint without an early entry.', 'Record which information changed and which rule stayed fixed.'],
    ['candles-1', 'read-candle',
      'Open and close form the body; high and low set the full range. With O 100, H 106, L 98, C 104, the body is 4 and the range is 8.',
      'Read the pinned OHLC values for the highlighted historical candle. Choose its direction and enter the body size before revealing the answer.',
      'If the answer is wrong, identify the two prices you subtracted. Color compares this candle’s close with its own open.',
      'Identify the candle direction correctly.', 'Calculate the body from the pinned open and close.'],
    ['candles-2', 'candle-range',
      'A wick records prices reached outside the body. It cannot identify every participant or guarantee what the next candle will do.',
      'Measure the actual candle’s full range and upper wick. Then inspect its location in the visible chart and write an observation without predicting the next move.',
      'Separate the numerical observation from a possible explanation. A shape can be measured accurately even when its future meaning is uncertain.',
      'Pass the range and upper-wick calculations.', 'Write one observable fact and label any explanation as a hypothesis.'],
    ['candles-3', 'read-candle',
      'A candle’s timeframe and dataset define what it summarizes. The bundled intraday stock examples use three-minute bars and vendor tick volume, not a share-volume count.',
      'Identify the lab’s symbol, interval, and data note. Read the starting candle, then compare it with the neighboring completed bars on that same interval.',
      'Explain why switching to another interval or treating ticks as shares changes the interpretation. Keep those conventions in your practice notes.',
      'Complete the candle-reading checkpoints.', 'Record the actual interval and volume unit rather than assuming them.'],
    ['structure-1', 'identify-trend',
      'Structure describes a sequence, not a single candle. This lab compares two confirmed swing highs and two confirmed swing lows with an explicit tolerance.',
      'Inspect the marked, confirmed swings. Choose uptrend, downtrend, range, or unclear, then answer why the newest potential swing still needs later bars.',
      'Trace your label to both pairs of swings. If they disagree, use unclear instead of forcing a directional story.',
      'Classify the displayed swing evidence under the declared rule.', 'Recognize that a confirmed swing needs later observations.'],
    ['structure-2', 'map-levels',
      'A repeatable level begins with a declared window. Its lowest low and highest high are facts; calling them a durable floor or ceiling is an additional hypothesis.',
      'Enter the low and high of the lab’s pinned twelve-bar window. Compare those reference prices with nearby reactions on the chart.',
      'Explain what would challenge a hold-of-level idea. The lab scores the reference prices and their meaning, not a prediction that either will hold.',
      'Locate both window extremes within the stated tolerance.', 'Identify the levels as references that can fail.'],
    ['structure-3', 'protect-trade',
      'An uptrend and an attractive entry are different claims. Entry 100, stop 96, and target 102 offer only 0.5 units of gross reward for each unit of price risk.',
      'Use the guided bracket exercise to place an actual paper trade with a valid stop, sufficient target distance, and quantity inside its fixed budget.',
      'Calculate the geometry from the actual fill. Explain why a bullish chart alone could not repair a target that was too close.',
      'Place the protected trade that meets the lab’s stated geometry.', 'Describe market direction and trade geometry as separate checks.'],
    ['orders-1', 'protect-trade',
      'An order is an instruction about execution. The replay ticket opens a market position from the visible close; its stop and target govern later revealed candles.',
      'Select the side, enter quantity, set the stop and target, and submit the paper order. Read the resulting position record before checking the checkpoint.',
      'Compare your intended entry with the fill. Describe which instruction limits planned loss, which sets a favorable exit, and why neither guarantees a historical intrabar path.',
      'Submit a real simulated position with valid protection.', 'Read back its actual side, quantity, fill, stop, and target.'],
    ['orders-2', 'equity-check',
      'At a $100 reference, a simulated buy can fill at $100.02 and also pay an entry fee. Equity may start below its original value even before the chart moves.',
      'Place the guided trade and inspect its entry fee and fill. After one new candle, calculate the actual open result and marked equity.',
      'Use the fill price once. Do not subtract a second slippage estimate from a P&L figure that already uses slipped fills.',
      'Reconcile marked equity with balance and the actual fill.', 'List which costs are already reflected and which exit costs remain estimates.'],
    ['orders-3', 'size-short',
      'A short gains from a lower exit price and loses from a higher one. Its protective stop belongs above the entry, while a favorable target lies below.',
      'Calculate the lab’s whole-share short quantity from its fixed stop and cost model, then submit the actual protected short.',
      'Check the directions of both price levels. Explain that the simulated short does not establish real borrow availability or broker permission.',
      'Use the correct short-risk arithmetic.', 'Place a short with the declared stop and quantity.'],
    ['sizing-1', 'size-long',
      'Choose where the trade idea fails before deciding quantity. A $50 budget and $2.50 risk per share allow at most 20 shares before any additional capital restriction.',
      'Read the lab’s fixed invalidation and estimated per-share risk. Calculate the maximum whole-share quantity, then place that quantity with the required stop.',
      'Trace the number back to the budget and risk per share. The exercise uses a chosen paper budget, not a personal recommendation.',
      'Calculate quantity from the provided risk assumptions.', 'Submit the matching protected position.'],
    ['sizing-2', 'size-short',
      'Round a maximum position down. Buying power can bind before the stop-risk budget does, so a correct result checks both constraints.',
      'Use the short lab’s actual reference price, stop, fees, and slippage to find the whole-share maximum. Compare your answer with the order you place.',
      'Explain which constraint limited the size. Rounding upward is a larger risk decision, not harmless formatting.',
      'Match the whole-share calculation and actual order.', 'Explain the role of both stop risk and capital use.'],
    ['sizing-3', 'protect-trade',
      'R is the initial planned dollar risk. A 2:1 price-distance target describes geometry; it does not say there is a two-thirds chance of winning.',
      'Place the bracket lab trade, then write its initial planned dollar risk and gross reward-to-risk before advancing.',
      'Keep that initial risk fixed in the record. After a later exit, divide net P&L by the original risk rather than changing the denominator to improve the result.',
      'Meet the protected-entry checkpoint.', 'Record the initial risk and distinguish reward-to-risk from win probability.'],
    ['setups-1', 'wait-trigger',
      'A usable rule specifies the context, trigger, invalidation, quantity, exit, and no-trade conditions. “It looks strong” leaves the decision open to hindsight.',
      'Apply the exercise’s completed-close trigger to the visible chart. Wait when it is absent and reassess only after the next candle is revealed.',
      'State the exact observation that changed a wait into an eligible decision, or explain why waiting remained correct.',
      'Apply the fixed trigger without entering early.', 'Describe the condition in words another learner could repeat.'],
    ['setups-2', 'wait-trigger',
      'A touch above a line, a completed close above it, and a later retest are different events. A strategy must say which one it requires.',
      'Follow this lab’s close-based breakout rule. Compare any wick through the trigger with the actual closing price before choosing the action.',
      'Describe a touch, a qualifying close, or no signal using only the visible bars. Do not rewrite the rule after seeing what worked.',
      'Distinguish an intrabar touch from the required completed close.', 'Retain a correct no-entry decision when the trigger is absent.'],
    ['setups-3', 'complete-plan',
      'A remembered example is useful for learning controls, but it cannot be an untouched test of the strategy you developed from it.',
      'Complete the integrated paper-plan lab with a written rule. Afterward, identify a separate historical segment you would reserve for later evaluation.',
      'Label this run as guided mechanics practice. List which rule choices must be frozen before using the separate sample.',
      'Complete the actual plan, entry, exit, and review checkpoints.', 'Distinguish practice data from a still-unseen evaluation sample.'],
    ['management-1', 'handle-loss',
      'An exit can be triggered by invalidation, a favorable rule, or a time limit. The time limit belongs in the plan before the open P&L starts influencing you.',
      'Open the lab position with the required stop. Reveal three new bars and close at the stated time rule if the protective stop has not already closed it.',
      'Match the recorded exit to the rule that actually acted. A later bounce cannot change whether the earlier execution followed the plan.',
      'Use the required stop and actual time-exit sequence.', 'Identify the exit reason from the trade record.'],
    ['management-2', 'handle-loss',
      'An open loss already reduces equity. Waiting for the original entry price to return leaves the position exposed; it does not undo the price change.',
      'Follow the lab’s protected entry and three-bar exit rule. Observe the P&L without allowing it to alter the required action.',
      'Explain the account effect of the open trade and the reason for closing it. The grade concerns the action, whether the resulting trade wins or loses.',
      'Follow the planned protection or time exit.', 'Keep the next risk decision independent of the last outcome.'],
    ['management-3', 'review-trade',
      'If a later candle reaches both a stop and a target, OHLC does not reveal which was first. ReplayLab uses a declared conservative convention for that ambiguity.',
      'Execute the guided trade and inspect its recorded exit. Read any gap or ambiguity flags before writing the journal response.',
      'Separate the observed candle range from the modeled execution. State the actual exit category and any assumption that influenced it.',
      'Close or accept the planned protective exit and review the actual record.', 'Label modeling assumptions instead of presenting them as observed ticks.'],
    ['psychology-1', 'wait-trigger',
      '“I entered before the required close” identifies a behavior you can change. “I am terrible at trading” does not identify the decision that needs work.',
      'Use the wait lab to rehearse the moment before a tempting entry. Say the missing condition out loud or write it, then advance without entering early.',
      'Write one if-then response tied to the action: if the completed close has not crossed the trigger, I wait.',
      'Complete the no-early-entry checkpoint.', 'Name one observable impulse and its concrete replacement action.'],
    ['psychology-2', 'complete-plan',
      'A pause is useful when it forces the missing decision to become explicit: setup, invalidation, quantity, and exit rule.',
      'Complete the plan field before submitting the integrated lab trade. Verify the size and protection, then follow the declared exit sequence.',
      'Identify which pre-entry check was easiest to skip. Add one small reminder to your next session plan.',
      'Store a plan before the actual entry.', 'Complete the protected execution and structured review.'],
    ['psychology-3', 'review-trade',
      'A profitable mistake remains a mistake. A correctly executed loss remains a data point from the strategy rather than proof that the process should be abandoned.',
      'Take the lab trade, finish its exit, and answer the adherence question from the rule and record. Then note the net outcome separately.',
      'Classify the run on two axes: followed or broke the plan, and won or lost. Explain any difference between those judgments.',
      'Report the actual exit reason and adherence honestly.', 'Keep the P&L judgment separate from the process judgment.'],
    ['review-1', 'review-trade',
      'A useful journal connects the before-entry reason, the actual execution, and the after-exit result. A dollar amount alone cannot explain a decision.',
      'Complete the lab trade and write a specific journal note. Select the exit category from its actual record and report whether the execution followed the rule.',
      'Check that the note says what you saw, what you did, and what you would keep or change. Local scoring checks completeness and structured facts, not the quality of every sentence.',
      'Complete the actual trade and accurate structured journal fields.', 'Write a factual note that supports your own later review.'],
    ['review-2', 'review-trade',
      'Four $150 wins and six $70 losses total $180 across ten trades: an $18 average despite a 40% win rate. Costs must be included consistently.',
      'Add one fully documented lab trade to your practice record. Calculate its net result and initial-risk multiple, then compare those with the lesson’s ten-trade example.',
      'Explain why this single new trade cannot establish expectancy. Keep its result even if it makes the current average worse.',
      'Record the actual completed trade accurately.', 'Calculate an average only with a stated sample and cost convention.'],
    ['review-3', 'equity-check',
      'A closed-trade balance chart can hide a large open loss. Drawdown measured from equity includes open exposure at the times you observe it.',
      'Complete the open-account lab and write down equity before entry and after the required new bar. Compare the change with the balance display.',
      'State whether your notes track balance or equity. More frequent observations may reveal a deeper intratrade drawdown than these few snapshots.',
      'Calculate the actual marked account value.', 'Label the chosen curve and observation frequency in your record.'],
    ['capstone-1', 'complete-plan',
      'A session plan makes entry, waiting, and stopping equally explicit. Its success criterion is a faithful process with a complete record.',
      'Write the integrated lab plan with direction, invalidation, quantity, favorable exit, and time limit before submitting its protected trade.',
      'Read the plan as though another learner had to execute it. Replace any vague phrase with a checkable condition.',
      'Store the pre-entry plan and satisfy its order requirements.', 'State what would make you wait or stop rather than invent another trade.'],
    ['capstone-2', 'complete-plan',
      'Execution evidence is a sequence: what was visible, which order was placed, when the exit occurred, and how the result was recorded.',
      'Work through every integrated checkpoint, advancing only the required bars. Keep the complete trade and structured review together.',
      'Explain each action from the original rule. Include modeling limitations and choose one repeatable correction if any checkpoint needed a retry.',
      'Pass all guided process checkpoints on an actual paper trade.', 'Keep the record of mistakes and corrections rather than selecting only a winner.'],
    ['capstone-3', 'complete-plan',
      'One completed lab demonstrates a small set of mechanics. Consistent sessions, sound research, and an honest assessment require broader evidence.',
      'Repeat the integrated drill if mechanics remain unclear. Then use the sixteen-week rubric to identify a separate skill that still needs evidence.',
      'Write one demonstrated strength, one unresolved weakness, and the next practice assignment. Completion is a learning milestone rather than a licensing or income claim.',
      'Complete the integrated mechanics sequence.', 'Choose the next practice from recorded skill evidence.'],
    ['stocks-1', 'equity-check',
      'The ticker selects the asset. Quantity specifies shares, not dollars of risk. At $100 per share, 20 shares create $2,000 of notional exposure.',
      'Read the lab stock’s symbol and dataset note, then open its small paper position. Identify share quantity, notional exposure, and account equity separately.',
      'Create an instrument card with the symbol, security type, interval, price convention, and volume unit. Do not confuse an ETF with a single company share.',
      'Complete the share-position and equity checkpoints.', 'Identify the instrument and its data conventions in your notes.'],
    ['stocks-2', 'identify-trend',
      'Relative strength compares the same interval across instruments. A stock down 1% is relatively stronger than a benchmark down 3%, even though both fell.',
      'Classify the lab stock’s visible structure. As a separate written exercise, calculate the lesson’s stock-versus-benchmark comparison using the same start and end times.',
      'Distinguish absolute direction from relative performance. Do not invent benchmark candles that are absent from the selected lab dataset.',
      'Classify the actual stock’s visible structure.', 'State the separate comparison’s inputs and whether benchmark data are available.'],
    ['stocks-3', 'map-levels',
      'An apparent jump may reflect a price move, a session gap, or a data convention such as a split adjustment. The chart needs a source definition.',
      'Mark the actual visible reference prices in the level lab. Read the dataset’s adjustment note and write what is established and what remains unverified.',
      'Explain why a level found in one price convention should not be silently compared with a different convention. Use the lesson’s split example to check the arithmetic.',
      'Locate the actual window extremes.', 'Document the stated adjustment convention without inventing verification.'],
    ['sessions-1', 'wait-trigger',
      'A session rule is tied to the exchange’s clock. New York’s UTC offset changes with daylight saving time; an unlabelled timestamp is ambiguous.',
      'Read the actual starting timestamp and interval in the lab. Complete the visible-bar wait task, then label the recorded time zone in your notes.',
      'Explain why three new bars describe an observation count, while elapsed wall-clock time must also consider any gaps between timestamps.',
      'Observe the required new candles without hindsight.', 'Record the timestamp convention and avoid assuming every adjacent bar is continuous.'],
    ['sessions-2', 'handle-loss',
      'A planned end condition removes the need to decide from emotion at the last moment. A real session boundary and an exercise’s three-bar time exit are different rules.',
      'Rehearse a fixed time exit in the lab: open with protection, observe the required bars, and close on time if the protective exit has not acted.',
      'Describe which rule ended this trade. Then write the separate session boundary you would specify for a later stock-replay experiment.',
      'Follow the actual protected or timed exit.', 'Distinguish a bar-count practice rule from a market-session rule.'],
    ['sessions-3', 'protect-trade',
      'A displayed last price is not a guaranteed executable quote. Spreads and slippage can be material compared with a small target.',
      'Place the bracket lab trade and compare its reference close, modeled fill, and target distance. Write how a larger cost assumption would affect planned net reward.',
      'Keep the simulator’s stated cost model in the conclusion. Historical OHLC alone cannot reconstruct the actual bid-ask spread at your entry.',
      'Complete the protected entry with its actual fill.', 'Identify which execution information is observed and which is modeled.'],
    ['playbook-1', 'wait-trigger',
      '“Completed close above the fixed line” can be checked. “Buy a strong breakout” leaves the definition of strong unresolved.',
      'Apply the lab’s fixed trigger and write the rule as one if-then sentence. Keep the initial level unchanged while new bars appear.',
      'Ask whether another learner could reach the same decision from your sentence. Add the information boundary and the no-entry condition.',
      'Apply the declared trigger without early entry.', 'Write a repeatable rule with an explicit information boundary.'],
    ['playbook-2', 'map-levels',
      'A playbook needs qualifying cases, near misses, and no-trade cases. Selecting only beautiful winners hides where the rule becomes ambiguous.',
      'Mark the level lab’s reference window. Record one visible case that meets your written observation rule and one case that lacks enough evidence.',
      'Label both records with the same fields. Use “not enough evidence” when the current window cannot supply a valid comparison.',
      'Mark the shared reference prices accurately.', 'Retain both an example and a non-example without future-dependent labels.'],
    ['playbook-3', 'complete-plan',
      'A changed entry or exit rule is a new version. It needs its own record rather than being quietly mixed into earlier results.',
      'Write a version label in the integrated lab plan and complete the trade under that version. Record any proposed change only after the run ends.',
      'Explain what would need a fresh test. Replaying the same remembered outcome can test controls but cannot establish that the new rule generalizes.',
      'Complete the planned trade and review with a recorded version.', 'Separate proposed research changes from the completed run’s rule.'],
    ['testing-1', 'wait-trigger',
      'Look-ahead bias occurs when a decision uses a fact that appears later. A peak drawn with two bars to its right was not confirmed before those bars existed.',
      'Complete the wait lab using only its revealed candles. In your research notes, identify which fields would become biased if you filled them using the later outcome.',
      'List the information available at each decision time. Record the simulator’s fill assumptions as a separate limit on the result.',
      'Finish the visible-only trigger sequence.', 'Identify a concrete future-data leak and a concrete execution assumption.'],
    ['testing-2', 'complete-plan',
      'Development data help choose rules; holdout data assess a frozen version. Once the holdout influences a change, it is no longer untouched for that new version.',
      'Treat the integrated lab as development practice. Complete it, then specify a separate chronological sample and the rules you would freeze before opening it.',
      'Record whether the reserved sample has actually been viewed. A label saying “out-of-sample” cannot make familiar data unseen again.',
      'Complete the integrated process with a fixed plan.', 'Define a separate, honestly labelled evaluation sample in your notes.'],
    ['testing-3', 'review-trade',
      'A sample average estimates the result of a defined sample. Uncertainty depends on variation, sample size, and assumptions about dependence.',
      'Complete and record one guided trade. Then use the lesson’s stated numbers to work the simplified standard-error and confidence-interval example.',
      'Explain why a single lab trade cannot support a confidence interval for a strategy’s durable edge. Identify the independence assumption in the numerical example.',
      'Create one complete, factual trade record.', 'Keep the statistical exercise’s inputs and assumptions explicit.'],
    ['execution_review-1', 'review-trade',
      'Review the setup, the execution, and the outcome separately. Ten profitable trades with only six correctly executed entries are not 100% adherence.',
      'Take the review lab trade and compare its actual entry and exit with the required rule. Select the structured adherence answer from those facts.',
      'Write one execution difference and its cause, if there was one. State the number of decisions when calculating an adherence percentage.',
      'Report the actual exit category and rule adherence.', 'Separate an execution error from an unfavorable market outcome.'],
    ['execution_review-2', 'review-trade',
      'MAE describes the largest observed movement against the open position; MFE describes the largest in its favor. They are measurements with timing conventions.',
      'Execute the review lab. Note the visible highs and lows while it was open and identify whether the exit candle creates an uncertain ordering.',
      'Calculate excursion only under a declared convention. Do not use a later high after the exit as an opportunity that the open position definitely experienced.',
      'Complete the actual trade and factual review.', 'State the excursion window and any unresolved exit-bar ambiguity.'],
    ['execution_review-3', 'equity-check',
      'A drawdown is measured from an earlier peak of a specified account-value series. Several correlated trades can increase exposure to the same move.',
      'Calculate marked equity in the open-account lab. Record its starting and later value, then write the lesson’s peak-to-trough calculation separately.',
      'Explain which snapshots are available and which intrabar account path remains unknown. Do not call two observed values a complete drawdown history.',
      'Calculate the available equity snapshot correctly.', 'State the limits of the observed account path.'],
    ['business-1', 'review-trade',
      'A net trading result and an operating result answer different questions. A $600 trading gain less $120 of separate tool costs leaves $480 before tax.',
      'Record the completed lab trade’s net result. In a separate practice budget, distinguish trading costs already included from tool costs and personal withdrawals.',
      'Check for omitted costs and double counting. An exercise result is not a predictable salary or an estimate of your personal future income.',
      'Record the actual net trade result accurately.', 'Separate trading P&L, operating expenses, and withdrawals in your example.'],
    ['business-2', 'protect-trade',
      'Before submitting another order after an interruption, establish whether the earlier order exists and what exposure is open.',
      'Place the protected lab order and read its position record. Pause the replay and rehearse locating the side, quantity, stop, target, and current account value.',
      'Write a short verification sequence for an unknown order status. Avoid a duplicate submit merely because the chart or connection appears delayed.',
      'Verify the actual protected position in the account.', 'Write the order-state checks you would perform before another submission.'],
    ['business-3', 'complete-plan',
      'Sixteen weeks provide a study sequence. Advancement should depend on demonstrated knowledge, execution, and honest evidence rather than elapsed time.',
      'Complete the integrated drill and compare its result with the track’s separate knowledge and process rubric. Identify one category that remains unproven.',
      'Choose a specific next practice with a measurable criterion. Continue simulation when the record does not yet support a broader next step.',
      'Complete the guided process without using profit as the pass condition.', 'Write a candid skill assessment and a concrete next assignment.']
  ];
  const modulePractice = {
    foundations: 'equity-check', candles: 'read-candle', structure: 'identify-trend',
    orders: 'protect-trade', sizing: 'size-long', setups: 'wait-trigger',
    management: 'handle-loss', psychology: 'wait-trigger', review: 'review-trade',
    capstone: 'complete-plan', stocks: 'equity-check', sessions: 'handle-loss',
    playbook: 'wait-trigger', testing: 'complete-plan', execution_review: 'review-trade',
    business: 'complete-plan'
  };
  const flowByLesson = new Map(lessonFlows.map(flow => [flow[0], flow]));
  for (const module of modules) {
    module.guidedLabId = modulePractice[module.id];
    for (const item of module.lessons) {
      const [, guidedLabId, seeIt, tryIt, reviewIt, first, second] = flowByLesson.get(item.id);
      item.practiceFlow = { seeIt, tryIt, reviewIt };
      item.practice = { guidedLabId, title: guidedTitles[guidedLabId], task: tryIt, successCriteria: [first, second] };
    }
  }

  const videos = [
    { id: 'intro', title: 'An Introduction to Technical Analysis', provider: 'Charles Schwab', url: 'https://www.schwab.com/learn/story/getting-started-with-technical-analysis-lesson-1', topics: ['Chart basics', 'Structure'], why: 'Start here when the chart feels unfamiliar. The webcast introduces trends, levels, candles, and timeframes.', task: 'Pause on a chart and describe its timeframe and visible trend without predicting the next move.', note: 'Official webcast page. Examples use Schwab tools.' },
    { id: 'candles-video', title: 'Candlestick Basics', provider: 'Charles Schwab', url: 'https://www.schwab.com/learn/story/getting-started-with-technical-analysis-lesson-4', topics: ['Candles', 'Chart basics'], why: 'A visual explanation of candle construction and how candle shapes relate to nearby price levels.', task: 'Complete the candle lab, then describe five replay candles using open, high, low, and close.', note: 'Official webcast page; lesson 4 of Getting Started with Technical Analysis.' },
    { id: 'levels-video', title: 'Use Support and Resistance to Read Stock Charts', provider: 'Charles Schwab', url: 'https://www.schwab.com/learn/story/use-support-and-resistance-to-read-stock-charts', topics: ['Structure', 'Setups'], why: 'Useful when entries repeatedly run into nearby levels or stops are placed without chart context.', task: 'Mark one support area and one resistance area before revealing the next candles.', note: 'Official video page. Stock examples; test any application to other markets separately.' },
    { id: 'orders-video', title: 'Understanding Market, Limit, and Stop Orders', provider: 'Charles Schwab', url: 'https://www.schwab.com/learn/story/understanding-market-limit-and-stop-orders', topics: ['Orders', 'Risk'], why: 'Explains the execution trade-offs behind three common order types.', task: 'Do the order-choice lab and explain why a stop price is not a guaranteed exit price.', note: 'Official video page. Order availability and policies vary by broker.' },
    { id: 'risk-video', title: 'Risk Management and Your Trade Plan', provider: 'CME Group', url: 'https://www.cmegroup.com/education/courses/building-a-trade-plan/risk-management-and-your-trade-plan', topics: ['Risk', 'Position sizing'], why: 'Connects risk rules with the plan, including trade exposure and session loss limits.', task: 'Write a paper risk budget, a maximum exposure, and a session pause rule; then use the sizing lab.', note: 'Official video lesson. Futures context; example risk percentages are not personal recommendations.' },
    { id: 'psychology-video', title: 'Trading Psychology', provider: 'CME Group', url: 'https://www.cmegroup.com/education/courses/trading-psychology', topics: ['Psychology', 'Discipline'], why: 'A starting point for understanding how reactions to wins and losses can interfere with a trading plan.', task: 'Choose one recurring behavior and write an if-then response before your next replay.', note: 'Official course page with an introductory video and further lessons.' },
    { id: 'plan-video', title: 'Building Your Trading Plan', provider: 'CME Group', url: 'https://www.cmegroup.com/education/videos/building-your-trading-plan', topics: ['Trade plan', 'Discipline'], why: 'Useful when trades are improvised. The video discusses goals, plan preparation, and contingencies.', task: 'Write your entry, invalidation, exit, size, and no-trade rule in five short lines.', note: 'Official educational video with Jeff Quinto; concepts apply to planning, not a promise of results.' },
    { id: 'journal-video', title: 'Keep a Trade Log', provider: 'CME Group', url: 'https://www.cmegroup.com/education/courses/building-a-trade-plan/keep-a-trade-log', topics: ['Journal', 'Review'], why: 'Helps turn a list of wins and losses into records of reasons, decisions, and recurring errors.', task: 'Review three paper trades and attach one factual process note to each.', note: 'Official video lesson with a written companion.' },
    { id: 'basics-video', title: 'Trading Basics: What to Know Before Getting Started', provider: 'Fidelity', url: 'https://www.fidelity.com/learning-center/trading-investing/trading/how-to-trade-series', topics: ['Trade plan', 'Orders', 'Risk'], why: 'A four-part on-demand series spanning preparation, analysis, execution, and exit planning.', task: 'Choose the session closest to your current problem, then complete the matching ReplayLab module.', note: 'Official video series; demonstrations use Fidelity tools.' },
    { id: 'technical-video', title: 'What Is Technical Analysis and How Does It Work?', provider: 'Fidelity', url: 'https://www.fidelity.com/learning-center/trading-investing/technical-trading', topics: ['Chart basics', 'Indicators'], why: 'A compact overview when you need to connect chart types, trends, and indicators.', task: 'Explain what an indicator measures and one thing it cannot tell you.', note: 'Official video page with a transcript.' },
    { id: 'trends-video', title: 'Trend and Continuation Patterns', provider: 'CME Group', url: 'https://www.cmegroup.com/education/courses/technical-analysis/trend-and-continuation-patterns', topics: ['Structure', 'Setups'], why: 'Shows common consolidation shapes while emphasizing that patterns do not always continue.', task: 'Find one candidate consolidation in replay and write both a continuation and a failure condition.', note: 'Official video lesson; pattern examples are hypotheses to test.' },
    { id: 'averages-video', title: 'Understanding Moving Averages', provider: 'CME Group', url: 'https://www.cmegroup.com/education/courses/technical-analysis/understanding-moving-averages', topics: ['Indicators', 'Structure'], why: 'Explains the calculation and interpretation of simple and exponential moving averages.', task: 'Compare the EMA with visible price structure and identify a period where price repeatedly crosses it.', note: 'Official video lesson. Moving averages summarize past prices.' },
    { id: 'stocks-video', title: 'Investing Basics: Stocks', provider: 'Charles Schwab', url: 'https://www.schwab.com/learn/story/investing-basics-stocks', topics: ['Stocks', 'Market basics'], why: 'Explains what stock ownership represents and the risks behind a company ticker.', task: 'Create an instrument card for one stock, identifying what a share represents and its main company-specific risks.', note: 'Official educational video. General investing foundations, not an intraday trading strategy.' },
    { id: 'etfs-video', title: 'Investing Basics: ETFs', provider: 'Charles Schwab', url: 'https://www.schwab.com/learn/story/investing-basics-etfs', topics: ['ETFs', 'Market basics'], why: 'Explains fund structure and why different ETFs can carry different exposures and risks.', task: 'Compare the stated objective and holdings of a broad-market fund and a sector fund without recommending either.', note: 'Official educational video. Fund selection requires understanding the actual prospectus and holdings.' }
  ];

  const problems = [
    { id: 'fomo', title: 'I chase moves after they happen', symptom: 'You enter after a large move because you do not want to miss it.', why: 'A late entry can increase stop distance while leaving less room to the target. The original trade calculation no longer applies.', action: 'Pause before the next entry and recalculate the trade from the current price. If it fails your written criteria, wait for a fresh setup.', checklist: ['Mark the entry zone before playing.', 'Calculate reward and risk from the available price.', 'Record a missed entry as a skip, not a failure.'], moduleIds: ['setups', 'psychology'], labIds: ['levels', 'discipline'], videoIds: ['plan-video', 'levels-video', 'psychology-video'] },
    { id: 'stopouts', title: 'My stops keep getting hit', symptom: 'You repeatedly exit near normal price fluctuations or enter without a clear invalidation.', why: 'Possible causes include a stop unrelated to structure, excess size forcing an artificially tight stop, a late entry, or a setup poorly matched to the market. The next rebound alone does not prove the stop was wrong.', action: 'Review a sample of stopped trades. Mark the planned invalidation before judging the outcome, and check whether quantity was chosen after the stop distance.', checklist: ['Identify the condition that invalidates the trade.', 'Compare the stop with the visible range and structure.', 'Reduce quantity when the tested stop is wider; do not widen an open loser to avoid exit.'], moduleIds: ['structure', 'sizing', 'management'], labIds: ['structure', 'sizing'], videoIds: ['levels-video', 'risk-video', 'orders-video'] },
    { id: 'oversizing', title: 'One loss wipes out my progress', symptom: 'A small price move creates a much larger account loss than you expected.', why: 'The position may be too large for its stop distance, costs, and account budget. Notional exposure and planned stop risk are different measurements.', action: 'Use the sizing lab, then require a calculated paper quantity before every entry.', checklist: ['Write the risk budget in dollars.', 'Include estimated entry and exit costs.', 'Round quantity down and check notional exposure.', 'Keep the original risk denominator in your journal.'], moduleIds: ['sizing', 'orders'], labIds: ['sizing', 'riskreward'], videoIds: ['risk-video', 'orders-video'] },
    { id: 'losers', title: 'I hold losers and hope they return', symptom: 'You delay closing a failed trade because you do not want to realize a loss.', why: 'An open loss already reduces equity. Waiting preserves the exposure and can make the loss larger; the entry price does not oblige the market to return.', action: 'Before the next paper trade, write the invalidation and exit rule. Review equity while the position is open.', checklist: ['State why the trade is still valid using current evidence.', 'Separate account balance from equity.', 'Score exit adherence independently of whether price later rebounds.'], moduleIds: ['foundations', 'management', 'psychology'], labIds: ['riskreward', 'discipline'], videoIds: ['psychology-video', 'risk-video', 'orders-video'] },
    { id: 'overtrading', title: 'I overtrade or try to win losses back', symptom: 'You reopen quickly after a loss, increase size, or trade because you are bored.', why: 'The next decision is being driven by the previous result rather than by a fresh setup. More trades also create more costs.', action: 'Set a session pause rule before replay. After a trigger, pause and write the next setup independently of the last result.', checklist: ['Use the original risk budget after wins and losses.', 'Require a fresh qualifying setup for every trade.', 'Stop taking new trades at the written session limit.', 'Allow a session with no trades.'], moduleIds: ['psychology', 'orders', 'capstone'], labIds: ['discipline', 'orders'], videoIds: ['psychology-video', 'plan-video', 'journal-video'] },
    { id: 'lowwinrate', title: 'I do not know why my results are poor', symptom: 'You focus on the win percentage but cannot explain the net account result.', why: 'Win rate omits win size, loss size, costs, and open exposure. A few large losses or frequent small costs can dominate the result.', action: 'Review all trades from one setup version. Calculate net expectancy and identify whether the largest losses came from the plan or from breaches.', checklist: ['Use net rather than gross results.', 'Compare average winner with average loss.', 'Keep all outcomes in the sample.', 'State whether drawdown uses balance or equity.'], moduleIds: ['review', 'sizing'], labIds: ['expectancy', 'riskreward'], videoIds: ['journal-video', 'risk-video', 'basics-video'] },
    { id: 'noplan', title: 'I do not know when to enter or exit', symptom: 'You change the reason for a trade while it is open, or act on a pattern name alone.', why: 'The idea has not been turned into a full rule with a trigger, invalidation, size, and exit.', action: 'Choose one setup and write its six parts before the next session. Use the capstone to test consistent execution.', checklist: ['Name the market condition and location.', 'Specify a trigger that uses only visible data.', 'Define invalidation, target or time exit, and size.', 'Write at least one no-trade condition.'], moduleIds: ['setups', 'management', 'capstone'], labIds: ['levels', 'discipline'], videoIds: ['plan-video', 'basics-video', 'trends-video'] },
    { id: 'confusion', title: 'Candles and indicators confuse me', symptom: 'You see shapes and lines but struggle to describe the actual price behavior.', why: 'Pattern names are being learned before OHLC, timeframe, and swing structure. Too many indicators can obscure those basics.', action: 'Start with the candle lab, then identify rising, falling, or unclear structure without relying on an indicator.', checklist: ['Read open, high, low, and close.', 'Separate a candle observation from a prediction.', 'Name the timeframe and venue.', 'Explain what each indicator calculates before using it.'], moduleIds: ['candles', 'structure'], labIds: ['candles', 'structure'], videoIds: ['candles-video', 'intro', 'technical-video', 'averages-video'] }
  ];

  const problemPractice = {
    fomo: ['wait-trigger', 'complete-plan'], stopouts: ['map-levels', 'size-long', 'protect-trade'],
    oversizing: ['size-long', 'size-short'], losers: ['handle-loss', 'equity-check'],
    overtrading: ['wait-trigger', 'handle-loss'], lowwinrate: ['review-trade', 'complete-plan'],
    noplan: ['complete-plan', 'protect-trade'], confusion: ['read-candle', 'identify-trend']
  };
  for (const problem of problems) {
    problem.guidedLabIds = problemPractice[problem.id];
    problem.guidedLabId = problem.guidedLabIds[0];
  }

  const sources = [
    { id: 'sec-day-risk', title: 'Thinking of Day Trading? Know the Risks.', publisher: 'SEC Investor.gov', url: 'https://www.investor.gov/additional-resources/spotlight/formerdirectorlorischock-directors-take/thinking-day-trading-know-risks' },
    { id: 'sec-orders', title: 'Understanding Order Types — Investor Bulletin', publisher: 'SEC Investor.gov', url: 'https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-14' },
    { id: 'sec-stops', title: 'Stop, Stop-Limit, and Trailing Stop Orders — Investor Bulletin', publisher: 'SEC Investor.gov', url: 'https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-15' },
    { id: 'sec-short', title: 'An Introduction to Short Sales — Investor Bulletin', publisher: 'SEC Investor.gov', url: 'https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-51' },
    { id: 'sec-stocks', title: 'Stocks — FAQs', publisher: 'SEC Investor.gov', url: 'https://www.investor.gov/introduction-investing/investing-basics/investment-products/stocks' },
    { id: 'sec-etfs', title: 'Updated Investor Bulletin: Exchange-Traded Funds', publisher: 'SEC Investor.gov', url: 'https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-24' },
    { id: 'sec-split', title: 'Stock Split', publisher: 'SEC Investor.gov', url: 'https://www.investor.gov/introduction-investing/investing-basics/glossary/stock-split' },
    { id: 'sec-extended', title: 'Extended-Hours Trading — Investor Bulletin', publisher: 'SEC Investor.gov', url: 'https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-42' },
    { id: 'sec-performance', title: 'Performance Claims — Investor Bulletin', publisher: 'SEC Investor.gov', url: 'https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-47' },
    { id: 'sec-options', title: 'An Introduction to Options — Investor Bulletin', publisher: 'SEC Investor.gov', url: 'https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-63' },
    { id: 'nyse-hours', title: 'Trading Information and Trading Hours', publisher: 'New York Stock Exchange', url: 'https://www.nyse.com/trade/trading-information' },
    { id: 'nist-time', title: 'Local Time FAQs', publisher: 'NIST', url: 'https://www.nist.gov/pml/time-and-frequency-division/local-time-faqs' },
    { id: 'nist-confidence', title: 'Confidence Limits for the Mean', publisher: 'NIST/SEMATECH e-Handbook', url: 'https://www.itl.nist.gov/div898/handbook/eda/section3/eda352.htm' },
    { id: 'nfa-hypothetical', title: 'Use of Promotional Material Containing Hypothetical Performance Results', publisher: 'National Futures Association', url: 'https://www.nfa.futures.org/rulebooksql/rules.aspx?RuleID=9025&Section=9' },
    { id: 'fidelity-relative', title: 'Relative Strength Comparison', publisher: 'Fidelity', url: 'https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/relative-strength-comparison' },
    { id: 'cme-expectations', title: 'Setting Realistic Expectations', publisher: 'CME Group', url: 'https://www.cmegroup.com/education/courses/trade-and-risk-management/setting-realistic-expectations' },
    { id: 'cme-size', title: 'Proper Position Size', publisher: 'CME Group', url: 'https://www.cmegroup.com/education/courses/trade-and-risk-management/proper-position-size' },
    { id: 'cme-risk-plan', title: 'Risk Management and Your Trade Plan', publisher: 'CME Group', url: 'https://www.cmegroup.com/education/courses/building-a-trade-plan/risk-management-and-your-trade-plan' },
    { id: 'cme-losses', title: 'Misconceptions of Taking Losses', publisher: 'CME Group', url: 'https://www.cmegroup.com/education/courses/trade-and-risk-management/misconceptions-of-taking-losses' },
    { id: 'cme-psychology', title: 'Trading Psychology', publisher: 'CME Group', url: 'https://www.cmegroup.com/education/courses/trading-psychology' },
    { id: 'cme-plan-video', title: 'Building Your Trading Plan', publisher: 'CME Group', url: 'https://www.cmegroup.com/education/videos/building-your-trading-plan' },
    { id: 'cme-strategy', title: 'Trading Strategies in Your Trade Plan', publisher: 'CME Group', url: 'https://www.cmegroup.com/education/courses/building-a-trade-plan/trading-strategies-in-your-trade-plan' },
    { id: 'cme-journal', title: 'Keep a Trade Log', publisher: 'CME Group', url: 'https://www.cmegroup.com/education/courses/building-a-trade-plan/keep-a-trade-log' },
    { id: 'cme-trends', title: 'Trend and Continuation Patterns', publisher: 'CME Group', url: 'https://www.cmegroup.com/education/courses/technical-analysis/trend-and-continuation-patterns' },
    { id: 'cme-averages', title: 'Understanding Moving Averages', publisher: 'CME Group', url: 'https://www.cmegroup.com/education/courses/technical-analysis/understanding-moving-averages' },
    { id: 'schwab-candles', title: 'Candlestick Basics', publisher: 'Charles Schwab', url: 'https://www.schwab.com/learn/story/getting-started-with-technical-analysis-lesson-4' },
    { id: 'schwab-intro', title: 'An Introduction to Technical Analysis', publisher: 'Charles Schwab', url: 'https://www.schwab.com/learn/story/getting-started-with-technical-analysis-lesson-1' },
    { id: 'schwab-levels', title: 'Use Support and Resistance to Read Stock Charts', publisher: 'Charles Schwab', url: 'https://www.schwab.com/learn/story/use-support-and-resistance-to-read-stock-charts' },
    { id: 'schwab-orders', title: 'Understanding Market, Limit, and Stop Orders', publisher: 'Charles Schwab', url: 'https://www.schwab.com/learn/story/understanding-market-limit-and-stop-orders' },
    { id: 'schwab-plan', title: '5 Elements of a Smart Trade Plan', publisher: 'Charles Schwab', url: 'https://www.schwab.com/learn/story/5-elements-smart-trade-plan' },
    { id: 'schwab-recovery', title: 'How to Recover From a Big Trading Loss', publisher: 'Charles Schwab', url: 'https://www.schwab.com/learn/story/how-to-recover-from-big-trading-loss' },
    { id: 'fidelity-basics', title: 'Trading Basics: What to Know Before Getting Started', publisher: 'Fidelity', url: 'https://www.fidelity.com/learning-center/trading-investing/trading/how-to-trade-series' },
    { id: 'fidelity-technical', title: 'What Is Technical Analysis and How Does It Work?', publisher: 'Fidelity', url: 'https://www.fidelity.com/learning-center/trading-investing/technical-trading' },
    { id: 'fidelity-plan', title: 'Get Up & Trade: Building a Trading Plan', publisher: 'Fidelity', url: 'https://www.fidelity.com/learning-center/trading-investing/trading/trading-plan' }
  ].map(item => ({ ...item, checked: '2026-11-21' }));

  const glossary = [
    { term: 'Ask', definition: 'The price at which a seller is currently offering to sell. A market buy often begins by taking available asks.' },
    { term: 'Bid', definition: 'The price at which a buyer is currently offering to buy. A market sell often begins by taking available bids.' },
    { term: 'Breakout', definition: 'A move beyond a defined price zone. A breakout can fail and return into the prior range.' },
    { term: 'Candle body', definition: 'The region between a candle’s open and close. Its size is the absolute difference between those prices.' },
    { term: 'Drawdown', definition: 'A decline from an earlier peak. State whether it is calculated on closed-trade balance or mark-to-market equity.' },
    { term: 'EMA', definition: 'Exponential moving average: a weighted average of earlier prices that gives more weight to recent observations.' },
    { term: 'Equity', definition: 'The current account value including the effect of open positions. In the simplified paper account, balance plus unrealized P&L.' },
    { term: 'Expectancy', definition: 'Average outcome per trade in a defined sample, usually measured after costs in dollars or R. A sample estimate is not a guarantee.' },
    { term: 'FOMO', definition: 'Fear of missing out: an urge to chase a move or enter without the conditions required by the plan.' },
    { term: 'Gap', definition: 'A jump between available traded prices, such as from one bar’s close to the next bar’s open. A gap can pass an intended stop level.' },
    { term: 'Invalidation', definition: 'The price or condition that makes the original trade hypothesis no longer meet its rules.' },
    { term: 'Leverage', definition: 'Exposure larger than the capital committed to support it. It magnifies gains and losses and can introduce liquidation or margin requirements.' },
    { term: 'Limit order', definition: 'An order that restricts the acceptable execution price: at the limit or lower for a buy, at the limit or higher for a sell. It may not fill.' },
    { term: 'Liquidity', definition: 'The available ability to trade size at prices near current quotes. Thin liquidity can increase execution difficulty and slippage.' },
    { term: 'Long', definition: 'A position that benefits from an increase in the instrument’s price, before costs.' },
    { term: 'Look-ahead bias', definition: 'Using information from later in time when making or evaluating an earlier decision.' },
    { term: 'Market order', definition: 'An instruction to trade at available prices. It does not guarantee the last chart price as the fill.' },
    { term: 'Notional', definition: 'The size of the exposure expressed as quantity × price for a simple unit-based instrument. It is different from planned stop risk.' },
    { term: 'OHLCV', definition: 'Open, high, low, close, and volume for a specified interval and data source.' },
    { term: 'Overfitting', definition: 'Designing or adjusting rules so closely to one historical sample that the apparent success may not generalize to new data.' },
    { term: 'Position sizing', definition: 'Choosing quantity based on the trade’s risk, costs, capital constraints, and instrument specifications.' },
    { term: 'Profit factor', definition: 'Total positive P&L divided by the absolute total negative P&L in a sample. It is undefined when there are no losses.' },
    { term: 'R', definition: 'The initial planned dollar risk used as a reference unit. Net P&L divided by initial risk gives the trade’s R result.' },
    { term: 'Resistance', definition: 'A price area where advances previously met selling pressure. It is a reference area, not a guaranteed ceiling.' },
    { term: 'Reward-to-risk', definition: 'Potential reward divided by planned risk under a specified entry, stop, and target. It does not state the chance of winning.' },
    { term: 'Short', definition: 'A position that benefits from a fall in price, before costs. Real short selling has additional borrowing, margin, and loss risks.' },
    { term: 'Slippage', definition: 'The difference between an expected or reference execution price and the actual fill. It may worsen the planned result.' },
    { term: 'Spread', definition: 'The difference between the available ask and bid prices.' },
    { term: 'Stop-market', definition: 'An order that activates a market order when its stop condition is met. The stop is a trigger, not a guaranteed fill price.' },
    { term: 'Stop-limit', definition: 'An order that activates a limit order when its stop condition is met. Price is constrained, but execution may not occur.' },
    { term: 'Support', definition: 'A price area where declines previously met buying pressure. It can fail.' },
    { term: 'Swing high / low', definition: 'A local peak or trough relative to surrounding observations. Confirming it may require later bars.' },
    { term: 'Unrealized P&L', definition: 'The change in value of an open position relative to its entry, before it is closed and subject to the stated cost convention.' },
    { term: 'Volume', definition: 'The quantity traded during the interval on the represented venue. It should be compared using consistent units and sources.' },
    { term: 'Win rate', definition: 'The proportion of completed trades with positive P&L in a defined sample. It does not measure profitability by itself.' },
    { term: 'Adherence', definition: 'How consistently a defined process rule was followed. State the rule and the number of decisions reviewed.' },
    { term: 'Backtest', definition: 'A hypothetical application of rules to historical data. Its results depend on data selection, timing, fills, costs, and other assumptions.' },
    { term: 'Corporate action', definition: 'An event such as a split or dividend that can affect shares or how historical prices are represented.' },
    { term: 'ETF', definition: 'Exchange-traded fund: shares in a fund with a stated objective and holdings. A sector ETF may be concentrated, and market price can differ from net asset value.' },
    { term: 'Holdout', definition: 'Data reserved for evaluation after research decisions are frozen. Once its outcomes influence rule changes, it is no longer untouched evidence for the new version.' },
    { term: 'MAE', definition: 'Maximum adverse excursion: the largest observed movement against a position while it was open, under a stated measurement and data convention.' },
    { term: 'MFE', definition: 'Maximum favorable excursion: the largest observed movement in favor of a position while it was open. Full exit-bar extremes may be ambiguous with OHLC data.' },
    { term: 'Out-of-sample', definition: 'An evaluation on observations not used to develop or select the particular rule being tested.' },
    { term: 'Relative strength comparison', definition: 'A comparison of one instrument’s performance with another over a consistent interval. It is different from the RSI oscillator and can be positive while both prices fall.' },
    { term: 'Standard error', definition: 'A measure of uncertainty in an estimate under a specified statistical model. For a suitable independent sample mean, it is sample standard deviation divided by the square root of sample size.' },
    { term: 'Survivorship bias', definition: 'Distortion from analyzing only instruments or strategies that remain available or successful while omitting those that disappeared or failed.' },
    { term: 'Stock option', definition: 'A derivative contract with a strike, expiration, and its own premium and risks. It is not the same as a stock share; a share-price replay does not supply an options pricing or risk model.' },
    { term: 'Walk-forward test', definition: 'A predeclared sequence of developing on earlier data and evaluating on later data. It can reveal instability but does not remove all bias or predict future returns.' }
  ];

  root.ReplayAcademy = {
    title: 'The disciplined trader pathway',
    description: 'Build from chart and risk fundamentals to equities, strategy research, execution review, and a documented professional routine. Progress measures learning and practice, not predicted returns.',
    version: '2026.11.3',
    assessmentVersion: 2,
    checked: '2026-11-21',
    practiceNote: 'Guided labs check explicit chart and paper-order facts with local rules. Additional written reflections are self-review; a passed checkpoint is not a judgment of writing quality or a claim of trading profitability.',
    videoNote: 'Selected for relevance to the skill or problem, from official education providers. Links open the provider’s video page; playback and availability are controlled by that provider. These are educational resources, not endorsements of trades or guarantees of results.',
    modules, problems, videos, sources, glossary
  };
})(typeof window !== 'undefined' ? window : globalThis);
