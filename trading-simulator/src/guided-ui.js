/* Guided practice workspace. Each attempt owns a separate paper account and
 * replay cursor. Completion is recorded only after every local check passes.
 */
(function (root, factory) {
  const common = typeof module === 'object' && module.exports;
  const api = factory(root, common ? {
    E: require('./engine.js'), O: require('./order-controller.js'),
    G: require('./guided.js'), I: require('./instruments.js'), T: require('./time.js')
  } : { E: root.ReplayEngine, O: root.ReplayOrders, G: root.ReplayGuided, I: root.ReplayInstruments, T: root.ReplayTime });
  if (common) module.exports = api;
  if (root) root.ReplayGuidedUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root, dependencies) {
  'use strict';
  const { E, O, G, I, T } = dependencies;
  const aliases = Object.freeze({ candles: 'read-candle', structure: 'identify-trend', levels: 'map-levels', sizing: 'size-long', orders: 'protect-trade', riskreward: 'complete-plan', expectancy: 'equity-check', discipline: 'wait-trigger' });
  const escape = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const clone = value => JSON.parse(JSON.stringify(value));
  const money = value => Number(value).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const price = value => Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  const signed = value => (value > 0 ? '+' : '') + money(value);
  const safeURL = value => typeof value === 'string' && /^https:\/\/[^\s]+$/i.test(value) ? value : '';
  const resolveId = value => aliases[value] || value;
  let sequence = 0;

  // This controller is also exported for deterministic checks with the actual
  // engine and curriculum. No DOM or timer is needed to verify an attempt.
  function createSession(labId, options = {}) {
    const item = G.items.find(value => value.id === resolveId(labId));
    if (!item) throw new Error('Choose one of the guided labs.');
    const dataset = options.dataset || I.items.find(value => value.id === item.datasetId);
    if (!dataset || !Array.isArray(dataset.candles)) throw new Error('The historical sample for this lab is unavailable.');
    const scenario = G.createScenario(item.id, dataset.candles, { initialBalance: 10000 });
    const account = E.createAccount(10000, { feeRate: scenario.feeRate, slippageRate: scenario.slippageRate });
    const events = [], answers = {}, passed = {}, results = {};
    let cursor = scenario.startIndex, stepIndex = 0, completed = false, practiceMode = false, checks = 0, lastResult = null;
    const current = () => dataset.candles[cursor];
    const step = () => scenario.steps[stepIndex];
    const context = () => ({ candles: dataset.candles, cursor, account, events });
    function record(type, extra = {}) {
      events.push({ type, barIndex: cursor, time: current().time, ...clone(extra) });
    }
    function requireActive() { if (completed && !practiceMode) throw new Error('This lab is complete. Continue free practice or start a fresh attempt to trade again.'); }
    function order(action, ticket = {}) {
      requireActive();
      const bar = current(), optional = value => value === '' || value == null ? null : Number(value);
      const stop = optional(ticket.stop), target = optional(ticket.target);
      const receipt = O.execute(account, {
        action, price: bar.close, time: bar.time, barIndex: cursor,
        qty: action === 'close' ? undefined : Number(ticket.qty), stop, target,
        riskBudget: stop !== null ? scenario.reference.budget : null,
        plan: typeof ticket.plan === 'string' ? ticket.plan.trim() : '', tags: ['guided', scenario.id],
        allowEntry: cursor < dataset.candles.length - 1
      });
      if (receipt.trade) record('close', { trade: receipt.trade, action });
      if (receipt.position) record('open', { position: receipt.position, action });
      if (!completed) lastResult = null;
      return receipt;
    }
    function advance(count = 1, decision = 'step') {
      requireActive();
      if (!Number.isInteger(count) || count < 1 || count > 1000) throw new Error('Advance a positive number of bars, up to 1,000 at a time.');
      const target = Math.min(dataset.candles.length - 1, cursor + count), exits = [];
      let advanced = 0;
      while (cursor < target) {
        if (!account.position) record('wait', { decision });
        cursor += 1; advanced += 1;
        record('step');
        const trade = E.processCandle(account, current(), cursor);
        if (trade) { exits.push(trade); record('close', { trade, action: 'protective' }); }
      }
      if (!completed) lastResult = null;
      return { advanced, exits, atEnd: cursor === dataset.candles.length - 1 };
    }
    function check(response = null) {
      if (completed) return lastResult;
      const active = step();
      checks += 1; answers[active.id] = clone(response);
      const result = G.evaluate(scenario, active.id, response, context());
      results[active.id] = result; lastResult = result;
      if (result.passed) {
        passed[active.id] = true;
        if (active.type === 'review') {
          const trade = account.trades.find(value => value.id === result.tradeId);
          if (trade) { trade.notes = response.notes.trim(); trade.followedPlan = response.followedPlan; }
          record('review', { tradeId: result.tradeId, notes: response.notes.trim(), followedPlan: response.followedPlan, reason: response.reason });
        }
        if (stepIndex === scenario.steps.length - 1) {
          // Re-check all recorded answers against the current account. A later
          // rule breach cannot be hidden behind an earlier passed checkpoint.
          for (let index = 0; index < scenario.steps.length; index++) {
            const checkpoint = scenario.steps[index];
            const verified = G.evaluate(scenario, checkpoint.id, answers[checkpoint.id] ?? null, context());
            if (!passed[checkpoint.id] || !verified.passed) {
              delete passed[checkpoint.id]; stepIndex = index;
              lastResult = { ...verified, passed: false, status: verified.status === 'pending' ? 'pending' : 'retry', message: 'Revisit this checkpoint: ' + verified.message };
              return lastResult;
            }
          }
          completed = true;
          record('complete', { passedSteps: scenario.steps.length, totalSteps: scenario.steps.length });
        }
      } else delete passed[active.id];
      return lastResult;
    }
    function next() {
      if (!passed[step().id] || stepIndex >= scenario.steps.length - 1) return false;
      stepIndex += 1; lastResult = results[step().id] || null; return true;
    }
    function getContext() {
      const bar = current(), active = step();
      return {
        mode: 'guided-lab', selectedLab: scenario.id, labId: scenario.id, title: scenario.title,
        moduleId: scenario.moduleId, stepId: active.id, stepTitle: active.title, prompt: active.prompt,
        stepIndex, totalSteps: scenario.steps.length, passedSteps: Object.keys(passed).length,
        cursor, startIndex: scenario.startIndex, symbol: dataset.symbol, timeframe: dataset.timeframe,
        timeZone: 'America/New_York', currentCandle: clone(bar),
        revealedCandles: dataset.candles.slice(Math.max(0, cursor - 79), cursor + 1).map(value => clone(value)),
        account: { initialBalance: account.initialBalance, balance: account.balance, equity: E.equity(account, bar.close), feeRate: account.feeRate, slippageRate: account.slippageRate, position: account.position ? clone(account.position) : null, trades: account.trades.slice(-10).map(value => clone(value)) },
        events: events.slice(-40).map(value => clone(value)), result: lastResult ? clone(lastResult) : null,
        videoIds: active.videoIds.slice(), completed, practiceMode, evaluation: 'local-rule-check'
      };
    }
    return {
      scenario, dataset, account, events, passed, answers, current, step, order, advance, check, next, getContext, record,
      get cursor() { return cursor; }, get stepIndex() { return stepIndex; }, get completed() { return completed; },
      get practiceMode() { return practiceMode; },
      continuePractice() { if (!completed) return false; practiceMode = true; record('free-practice'); return true; },
      get checks() { return checks; }, get lastResult() { return lastResult; },
      clearFeedback() { lastResult = null; }
    };
  }

  function create(options) {
    if (!options?.mount || !options.state) throw new Error('A guided-lab mount and application state are required.');
    const mount = options.mount, state = options.state, uid = 'guided-' + (++sequence);
    const toast = typeof options.toast === 'function' ? options.toast : () => {};
    let session = null, chart = null, timer = null, playing = false, disposed = false;
    let ticket = {}, response = null, hints = {}, drawings = [], drawingCounter = 0, tool = 'crosshair';
    let receipt = null, completedSaved = false, seeOpen = true;
    const q = role => mount.querySelector('[data-guided-role="' + role + '"]');
    function progress() { return state.progress?.guided || {}; }
    function emitContext() { if (typeof options.onContext === 'function') options.onContext(getContext()); }
    function getContext() {
      if (!session) return { mode: 'guided-catalog', selectedLab: null, completed: G.items.filter(item => progress()[item.id]?.completed === true).length, total: G.items.length };
      return { ...session.getContext(), hintsShown: hints[session.step().id] || 0, drawings: clone(drawings) };
    }
    function stopPlaying() {
      if (timer !== null) root.clearInterval(timer);
      timer = null; playing = false;
      const button = q('play');
      if (button) { button.textContent = '▶ Play'; button.setAttribute('aria-pressed', 'false'); }
    }
    function cleanupAttempt() {
      stopPlaying(); if (chart) chart.destroy(); chart = null; session = null;
    }
    function actionButton(label, action, extra = '') {
      let className = 'guided-button';
      extra = extra.replace(/\bclass="([^"]*)"/, (_, value) => { className = value; return ''; });
      return `<button type="button" class="${className}" data-guided-action="${action}" ${extra}>${label}</button>`;
    }
    function videosMarkup(ids) {
      const videos = (root.ReplayAcademy?.videos || []).filter(video => ids.includes(video.id) && safeURL(video.url)).slice(0, 2);
      return videos.map(video => `<a class="guided-video" href="${escape(video.url)}" target="_blank" rel="noopener noreferrer"><span class="guided-play-icon" aria-hidden="true">▶</span><span><strong>${escape(video.title)}</strong><small>${escape(video.provider)} · Opens video lesson</small></span></a>`).join('');
    }
    function catalog(unknown) {
      cleanupAttempt();
      const complete = G.items.filter(item => progress()[item.id]?.completed).length;
      mount.innerHTML = `<section class="guided-page guided-catalog" aria-labelledby="${uid}-catalog-title"><header class="guided-catalog-header"><div><p class="guided-eyebrow">LEARN BY DOING</p><h1 id="${uid}-catalog-title">One skill. A real chart. Your decision.</h1><p>Twelve guided labs connect a short lesson to the replay chart and a working paper account. See the idea, try it, then check what happened.</p></div><div class="guided-catalog-progress"><strong>${complete}<span> / ${G.items.length}</span></strong><span>labs completed</span><progress value="${complete}" max="${G.items.length}" aria-label="Guided labs completed">${complete} of ${G.items.length}</progress></div></header>${unknown ? '<p class="guided-notice">Choose a lab from the current practice collection.</p>' : ''}<div class="guided-catalog-note"><span class="guided-note-icon" aria-hidden="true">↗</span><p><strong>Practice without the pressure.</strong> Each attempt starts with its own $10,000 paper account. Checks reward the stated process; a profit is not required.</p></div><div class="button-row" style="margin:0 0 24px"><a class="btn" href="#labs/skills">Recognition exercises</a><a class="btn" href="#risk">Risk decision labs</a></div><div class="guided-card-grid">${G.items.map((item, index) => {
        const done = progress()[item.id]?.completed === true;
        return `<a href="#labs/${escape(item.id)}" class="guided-lab-card ${done ? 'is-complete' : ''}"><div class="guided-card-top"><span class="guided-card-number">${String(index + 1).padStart(2, '0')}</span><span class="guided-card-status">${done ? '✓ Completed' : escape(item.level)}</span></div><h2>${escape(item.title)}</h2><p>${escape(item.subtitle)}</p><div class="guided-card-footer"><span>${item.minutes} min · Real historical replay</span><strong>${done ? 'Practice again' : 'Start lab'}</strong></div></a>`;
      }).join('')}</div><p class="guided-catalog-footnote">Your main replay account stays separate. Completed lab checks are saved with your learning progress. Leaving a lab ends its unfinished practice attempt.</p></section>`;
      emitContext();
    }
    function render(id) {
      if (disposed) return;
      const canonical = resolveId(id);
      if (!canonical || !G.items.some(item => item.id === canonical)) { catalog(Boolean(canonical)); return; }
      startLab(canonical);
    }
    function startLab(id) {
      cleanupAttempt();
      try { session = createSession(id); }
      catch (error) { catalog(true); toast(error.message); return; }
      const sc = session.scenario, d = session.dataset;
      ticket = { qty: sc.tradePreset.qty == null ? '' : String(sc.tradePreset.qty), stop: sc.tradePreset.stop == null ? '' : String(sc.tradePreset.stop), target: sc.tradePreset.target == null ? '' : String(sc.tradePreset.target), plan: '' };
      response = null; hints = {}; drawings = []; drawingCounter = 0; receipt = null; completedSaved = false; tool = 'crosshair'; seeOpen = true;
      const sourceURL = safeURL(d.sourceUrl);
      mount.innerHTML = `<section class="guided-page guided-active" aria-labelledby="${uid}-title"><header class="guided-workspace-heading"><div><a href="#labs" class="guided-back">All guided labs</a><h1 id="${uid}-title">${escape(sc.title)}</h1><p>${escape(sc.subtitle)}</p></div><div class="guided-heading-actions"><span class="guided-badge">${escape(sc.level)} · ${sc.minutes} min</span>${actionButton('Fresh attempt', 'restart', 'title="Restart this lab with a fresh $10,000 paper account"')}</div></header><div class="guided-workspace"><div class="guided-chart-column"><section class="guided-chart-panel" aria-label="Guided historical replay"><div class="guided-chart-heading"><div><strong>${escape(d.symbol)}</strong><span>${escape(d.timeframe)} · Historical sample</span></div><strong data-guided-role="quote"></strong></div><div class="guided-chart-toolbar" role="toolbar" aria-label="Lab chart tools"><div>${actionButton('⌖', 'tool', 'data-tool="crosshair" aria-label="Crosshair cursor" aria-pressed="true" title="Crosshair"')}${actionButton('↖', 'tool', 'data-tool="cursor" aria-label="Select drawings and pan" aria-pressed="false" title="Select and pan"')}${actionButton('—', 'tool', 'data-tool="horizontal" aria-label="Draw horizontal level" aria-pressed="false" title="Horizontal level"')}${actionButton('╱', 'tool', 'data-tool="trendline" aria-label="Draw trendline with two points" aria-pressed="false" title="Trendline"')}${actionButton('↶', 'undo', 'aria-label="Undo your last drawing" title="Undo drawing"')}${actionButton('⌫', 'delete', 'aria-label="Delete selected drawing" title="Delete selected drawing"')}</div><div>${actionButton('−', 'zoom-out', 'aria-label="Zoom out"')}${actionButton('+', 'zoom-in', 'aria-label="Zoom in"')}${actionButton('Auto', 'auto', 'data-guided-role="auto" aria-label="Automatic price scale" aria-pressed="true"')}</div></div><div class="guided-chart-wrap" data-guided-role="chart-wrap"><svg data-guided-role="chart" aria-label="Historical candles for this guided lab"></svg><div class="guided-chart-tooltip" data-guided-role="tooltip" hidden></div></div><div class="guided-replay-controls"><div>${actionButton('▶ Play', 'play', 'data-guided-role="play" aria-pressed="false"')}${actionButton('Next candle', 'step', 'data-guided-role="step"')}${actionButton('Wait + 1', 'wait', 'data-guided-role="wait" title="Stay flat and observe the next candle"')}</div><span data-guided-role="replay-time"></span></div><div class="guided-study-candle"><div><span class="guided-mini-label">STUDY CANDLE · BAR ${sc.startIndex + 1}</span><strong>${escape(T.format(sc.reference.startTime))}</strong></div><div class="guided-ohlc">${[['O', sc.reference.candle.open], ['H', sc.reference.candle.high], ['L', sc.reference.candle.low], ['C', sc.reference.candle.close]].map(([key, value]) => `<span>${key} <b>${price(value)}</b></span>`).join('')}</div></div></section><section class="guided-ticket-panel" aria-label="Lab paper account and order ticket"><div class="guided-account-strip" data-guided-role="account"></div><div class="guided-position-strip" data-guided-role="position"></div><form class="guided-ticket" data-guided-form="ticket" autocomplete="off"><div class="guided-ticket-top"><div><h2>Try it in the market</h2><span class="guided-muted">Paper fills at the current revealed close</span></div><span class="guided-badge">$10,000 lab account</span></div><div class="guided-ticket-fields"><label>Quantity <span>whole shares</span><input type="number" min="1" step="1" inputmode="decimal" data-ticket="qty" aria-label="Lab quantity in whole shares" value="${escape(ticket.qty)}" placeholder="Shares"></label><label>Stop loss <span>optional</span><input type="number" min="0" step="any" inputmode="decimal" data-ticket="stop" aria-label="Lab stop loss price" value="${escape(ticket.stop)}" placeholder="No stop"></label><label>Take profit <span>optional</span><input type="number" min="0" step="any" inputmode="decimal" data-ticket="target" aria-label="Lab take profit price" value="${escape(ticket.target)}" placeholder="No target"></label></div><details class="guided-plan-drawer" ${sc.id === 'complete-plan' ? 'open' : ''}><summary>${sc.id === 'complete-plan' ? 'Write your entry plan · required' : 'Add an entry plan · optional'}</summary><label class="guided-plan-label">Your entry plan <span>${sc.id === 'complete-plan' ? 'Write at least 20 characters before opening' : 'Optional note for this attempt'}</span><textarea data-ticket="plan" rows="2" maxlength="2000" placeholder="Describe the setup, its invalidation and your exit rule."></textarea></label></details><div class="guided-order-actions">${actionButton('Buy / Long', 'buy', 'data-guided-role="buy" class="guided-button guided-buy"')}${actionButton('Sell / Short', 'sell', 'data-guided-role="sell" class="guided-button guided-sell"')}${actionButton('Close position', 'close', 'data-guided-role="close"')}</div><div class="guided-order-preview" data-guided-role="order-preview"></div><p class="guided-order-message" data-guided-role="receipt" role="status" aria-live="polite" hidden></p><details class="guided-fill-details"><summary>Fill assumptions</summary><p class="guided-execution-note">Each fill models ${(sc.feeRate * 100).toFixed(2)}% fees and ${(sc.slippageRate * 100).toFixed(2)}% slippage. With a stop supplied, planned risk is capped at ${money(sc.reference.budget)}. A gap can exceed that plan. Buy/Sell against a position closes it in full.</p></details></form></section><details class="guided-data-details"><summary>Study references &amp; historical data</summary><div class="guided-reference-grid">${sc.reference.stats.map(stat => `<div><span>${escape(stat.label)}</span><strong>${stat.unit === 'USD' ? money(stat.value) : escape(stat.value)}${stat.unit === 'USD' ? '' : ' ' + escape(stat.unit)}</strong></div>`).join('')}${sc.reference.levels.map(level => `<div><span>${escape(level.label)}</span><strong>${price(level.price)}</strong></div>`).join('')}</div><p>The starting window is bars ${sc.reference.windowStart + 1}–${sc.reference.windowEnd + 1}. The outlined candle and the pinned OHLC above refer to the original starting point.</p><div class="guided-table-wrap"><table><caption>The twelve-bar study window · New York</caption><thead><tr><th>Bar / time</th><th>Open</th><th>High</th><th>Low</th><th>Close</th></tr></thead><tbody>${d.candles.slice(sc.reference.windowStart, sc.reference.windowEnd + 1).map((bar, i) => `<tr><th>${sc.reference.windowStart + i + 1} · ${escape(T.axis(bar.time))}</th><td>${price(bar.open)}</td><td>${price(bar.high)}</td><td>${price(bar.low)}</td><td>${price(bar.close)}</td></tr>`).join('')}</tbody></table></div><p>${escape(d.sourceNote || sc.dataNote)} ${escape(d.adjustmentNote || '')}</p>${sourceURL ? `<a href="${escape(sourceURL)}" target="_blank" rel="noopener noreferrer">Historical sample source</a>` : ''}</details></div><aside class="guided-instruction-column" aria-label="Lab lesson and checkpoints"><div data-guided-role="task"></div></aside></div></section>`;
      chart = root.ReplayChart.create(q('chart'), q('tooltip'), {
        getData: () => ({ candles: d.candles, cursor: session.cursor, position: session.account.position, trades: session.account.trades, highlightIndex: sc.startIndex, timeframe: d.timeframe, instrument: d, symbol: d.symbol, volumeKind: d.volumeKind, settings: { ...state.settings, chartType: 'candles', chartTheme: state.settings?.chartTheme === 'dark' ? 'dark' : 'light', ema: false, vwap: false, sessionShading: false, showVolume: true }, drawings: [...sc.reference.levels.map(level => ({ id: 'reference-' + level.id, type: 'horizontal', price: level.price, color: '#8392ac' })), ...drawings] }),
        onDrawing: drawing => {
          drawings.push({ ...drawing, id: uid + '-drawing-' + (++drawingCounter) });
          session.record('drawing', { drawing });
          if (sc.id === 'map-levels' && session.step().type === 'number' && drawing.type === 'horizontal') { response = Number(drawing.price.toFixed(2)); paintTask(); }
          chart.draw(); emitContext();
        },
        onDeleteDrawing: id => {
          if (String(id).startsWith('reference-')) { toast('The lab’s reference lines stay fixed. You can remove your own drawings.'); return; }
          drawings = drawings.filter(drawing => drawing.id !== id); chart.draw(); emitContext();
        },
        onScaleChange: value => q('auto')?.setAttribute('aria-pressed', String(value.auto))
      });
      paintTask(); paint();
    }
    function referenceMarkup() {
      const sc = session.scenario;
      const useful = sc.reference.stats.filter(stat => stat.label === 'Modeled stop risk per share');
      const trading = sc.steps.some(step => step.type === 'trade' || step.type === 'wait');
      if (!trading && !sc.reference.levels.length && sc.id !== 'map-levels') return '';
      return `<div class="guided-check-references">${trading ? `<span>Risk budget <b>${money(sc.reference.budget)}</b></span>` : ''}${sc.id === 'map-levels' ? `<span>Study window <b>Bars ${sc.reference.windowStart + 1}–${sc.reference.windowEnd + 1}</b></span>` : ''}${useful.map(stat => `<span>${escape(stat.label)} <b>${money(stat.value)}</b></span>`).join('')}${sc.reference.levels.map(level => `<span>${escape(level.label)} <b>${price(level.price)}</b></span>`).join('')}</div>`;
    }
    function responseMarkup(step) {
      if (step.type === 'choice') return `<fieldset class="guided-choices"><legend class="guided-sr-only">${escape(step.title)}</legend>${step.choices.map(choice => `<label><input type="radio" name="${uid}-choice" data-response="choice" value="${escape(choice.value)}" ${response === choice.value ? 'checked' : ''}><span>${escape(choice.label)}</span></label>`).join('')}</fieldset>`;
      if (step.type === 'number') return `<label class="guided-answer-label" for="${uid}-number">Your answer <span>${escape(step.unit)}</span></label><input class="guided-number-answer" id="${uid}-number" data-response="number" type="number" step="any" inputmode="decimal" value="${escape(response ?? '')}" placeholder="Enter your calculation">${session.scenario.id === 'map-levels' ? '<p class="guided-input-help">You can also use the horizontal-line tool on the chart to choose a price.</p>' : ''}`;
      if (step.type === 'review') {
        const review = response && typeof response === 'object' ? response : {};
        return `<label class="guided-answer-label">Actual exit category<select data-response="reason"><option value="">Choose the recorded reason</option>${step.choices.map(choice => `<option value="${escape(choice.value)}" ${review.reason === choice.value ? 'selected' : ''}>${escape(choice.label)}</option>`).join('')}</select></label><label class="guided-answer-label">Did the recorded trade follow the lab plan?<select data-response="followedPlan"><option value="">Choose based on the record</option><option value="yes" ${review.followedPlan === true ? 'selected' : ''}>Yes, the plan was followed</option><option value="no" ${review.followedPlan === false ? 'selected' : ''}>No, the plan was changed</option></select></label><label class="guided-answer-label">What happened, and what will you repeat or change?<textarea rows="4" maxlength="2000" data-response="notes" placeholder="Use the entry, exit and timing in the record. At least ${step.minLength} characters.">${escape(review.notes || '')}</textarea></label>`;
      }
      const action = step.type === 'wait' ? 'Use Next candle or Wait + 1 on the chart, then check the revealed result.' : step.action === 'close' ? 'Use the actual Close position button when the exit rule is met. Protective exits are processed as replay advances.' : 'Use the actual Buy or Sell buttons in the order ticket. This check reads your paper account.';
      return `<div class="guided-action-callout"><span aria-hidden="true">↙</span><p>${action}</p></div>`;
    }
    function paintTask() {
      if (!session || disposed) return;
      const sc = session.scenario, step = session.step(), passed = session.passed[step.id] === true, result = session.lastResult;
      const hintCount = hints[step.id] || 0, completed = session.completed;
      q('task').innerHTML = `<div class="guided-checkpoint-progress"><div><strong>${completed ? 'All checkpoints verified' : 'Checkpoint ' + (session.stepIndex + 1) + ' of ' + sc.steps.length}</strong><span>${Object.keys(session.passed).length} passed</span></div><progress value="${Object.keys(session.passed).length}" max="${sc.steps.length}" aria-label="Lab checkpoints passed"></progress></div><details class="guided-see-panel" ${seeOpen ? 'open' : ''}><summary><span class="guided-section-index">1</span><span><small>SEE IT</small><strong>${escape(sc.lesson.seeIt.title)}</strong></span></summary><div><p>${escape(sc.lesson.seeIt.text)}</p><div class="guided-worked-example">${escape(sc.lesson.seeIt.example)}</div></div></details><section class="guided-try-panel" aria-labelledby="${uid}-step-title"><div class="guided-section-heading"><span class="guided-section-index">2</span><span><small>TRY IT</small><h2 id="${uid}-step-title" tabindex="-1">${escape(step.title)}</h2></span></div><p>${escape(step.prompt)}</p>${referenceMarkup()}<form data-guided-form="checkpoint" novalidate>${responseMarkup(step)}<div class="guided-check-actions"><button type="submit" class="guided-button guided-primary" ${passed || completed ? 'disabled' : ''}>${passed ? '✓ Checkpoint passed' : 'Check my work'}</button>${actionButton(hintCount >= step.hints.length ? 'All hints shown' : 'Show hint ' + (hintCount + 1), 'hint', hintCount >= step.hints.length ? 'disabled' : '')}</div></form>${hintCount ? `<div class="guided-hints"><strong>Hints for this checkpoint</strong><ol>${step.hints.slice(0, hintCount).map(hint => `<li>${escape(hint)}</li>`).join('')}</ol></div>` : ''}</section><section class="guided-review-panel ${result ? 'has-result ' + escape(result.status) : ''}" aria-labelledby="${uid}-review-title"><div class="guided-section-heading"><span class="guided-section-index">3</span><span><small>REVIEW IT</small><h2 id="${uid}-review-title">${completed ? 'Lab complete' : 'Check the process'}</h2></span></div><div data-guided-role="feedback" tabindex="-1" role="status" aria-live="polite">${result ? `<strong>${result.passed ? '✓ ' : result.status === 'pending' ? '○ ' : '↻ '}${escape(result.message)}</strong><p>${escape(result.explanation || '')}</p>` : `<p>${escape(sc.lesson.reviewIt.text)}</p><span class="guided-muted">Local rule checks compare your answers and recorded actions with this exercise.</span>`}</div>${completed ? `<div class="guided-complete-card"><strong>✓ ${sc.steps.length} of ${sc.steps.length} checkpoints verified</strong><p>Practice completion saved. Your paper result and the quality of your process are separate questions.</p><a class="guided-button guided-primary" href="#labs">Choose another lab</a>${session.practiceMode ? '<span class="guided-free-practice-note">Free practice is active. Your verified completion is locked.</span>' : actionButton('Continue free practice', 'continue', 'class="guided-button guided-primary"')}${actionButton('Practice again', 'restart')}</div>` : passed ? actionButton('Next checkpoint', 'next', 'class="guided-button guided-primary guided-next"') : result?.status === 'retry' ? `<div class="guided-retry-actions">${['choice', 'number', 'review'].includes(step.type) ? actionButton('Try again', 'retry') : ''}${actionButton('Fresh attempt', 'restart')}</div>` : ''}</section><section class="guided-learn-more"><h3>Watch it, then apply it</h3>${videosMarkup(step.videoIds)}<a class="guided-course-link" href="#course/${escape(sc.moduleId)}">Open the related course module</a></section>`;
      const details = q('task').querySelector('.guided-see-panel');
      details?.addEventListener('toggle', () => { seeOpen = details.open; });
    }
    function nextBoundary() {
      if (session.practiceMode) return null;
      const step = session.step(), p = session.account.position || session.account.trades.at(-1);
      if (step.type === 'wait') return (session.scenario.id === 'wait-trigger' ? session.scenario.startIndex : p?.entryBarIndex ?? session.cursor) + step.minBars;
      if (step.type === 'trade' && step.action === 'close' && p) return p.entryBarIndex + (session.scenario.id === 'review-trade' ? 2 : 3);
      return null;
    }
    function paintPreview() {
      if (!session || !q('order-preview')) return;
      if (session.account.position) { q('order-preview').textContent = 'The position is open. Its stop and target remain fixed; Close exits it at the current revealed close.'; return; }
      try {
        const side = session.scenario.tradePreset.side || 'long';
        const preview = O.preview(session.account, { action: side === 'long' ? 'buy' : 'sell', price: session.current().close, time: session.current().time, barIndex: session.cursor, qty: Number(ticket.qty), stop: ticket.stop || null, target: ticket.target || null, riskBudget: ticket.stop ? session.scenario.reference.budget : null });
        q('order-preview').textContent = `${side === 'long' ? 'Long' : 'Short'} preview · entry fill ${price(preview.position.entryPrice)} · ${preview.position.plannedRisk === null ? 'no planned stop risk — add protection for the lab rule' : 'modeled stop risk ' + money(preview.position.plannedRisk) + ' of ' + money(session.scenario.reference.budget)}`;
      } catch (error) { q('order-preview').textContent = error.message; }
    }
    function paint() {
      if (!session || disposed) return;
      const bar = session.current(), account = session.account, p = account.position;
      const equity = E.equity(account, bar.close), unrealized = equity - account.balance, locked = session.completed ? !session.practiceMode : session.passed[session.step().id] === true;
      q('quote').textContent = '$' + price(bar.close);
      q('replay-time').textContent = T.format(bar.time) + ' · Bar ' + (session.cursor + 1);
      const equityChallenge = session.scenario.id === 'equity-check' && session.step().id === 'equity' && !session.lastResult?.passed;
      q('account').innerHTML = `<div><span>Balance</span><strong>${money(account.balance)}</strong></div><div><span>Equity</span><strong>${equityChallenge ? 'Calculate' : money(equity)}</strong></div><div><span>Open P&amp;L</span><strong class="${unrealized < 0 ? 'guided-negative' : 'guided-positive'}">${signed(unrealized)}</strong></div><div><span>Closed trades</span><strong>${account.trades.length}</strong></div>`;
      const recent = account.trades.at(-1);
      q('position').innerHTML = p ? `<strong>${escape(p.side.toUpperCase())} · ${p.qty} shares</strong><span>Entry ${price(p.entryPrice)} · Stop ${p.stop === null ? 'none' : price(p.stop)} · Target ${p.target === null ? 'none' : price(p.target)}</span><span>${session.cursor - p.entryBarIndex} new bars since entry</span>` : recent ? `<strong>FLAT · Last exit ${escape(recent.exitReason)}</strong><span>${recent.barsHeld} bars held · Net ${signed(recent.netPnl)} after costs</span>` : '<strong>FLAT</strong><span>No paper position in this attempt.</span>';
      q('buy').textContent = p?.side === 'short' ? 'Buy / Close short' : 'Buy / Long';
      q('sell').textContent = p?.side === 'long' ? 'Sell / Close long' : 'Sell / Short';
      q('buy').disabled = locked || p?.side === 'long' || (!p && session.cursor >= session.dataset.candles.length - 1);
      q('sell').disabled = locked || p?.side === 'short' || (!p && session.cursor >= session.dataset.candles.length - 1);
      q('close').disabled = locked || !p;
      q('step').disabled = locked || session.cursor >= session.dataset.candles.length - 1;
      q('wait').disabled = locked || !!p || session.cursor >= session.dataset.candles.length - 1;
      q('play').disabled = locked || session.cursor >= session.dataset.candles.length - 1;
      q('play').textContent = playing ? 'Ⅱ Pause' : '▶ Play'; q('play').setAttribute('aria-pressed', String(playing));
      mount.querySelectorAll('[data-ticket]').forEach(input => { input.disabled = locked || !!p; });
      q('receipt').hidden = !receipt;
      if (receipt) { q('receipt').textContent = receipt.message; q('receipt').className = 'guided-order-message' + (receipt.error ? ' is-error' : ''); }
      paintPreview(); chart?.draw(); emitContext();
    }
    function saveCompletion() {
      if (!session.completed || completedSaved) return;
      if (!state.progress || typeof state.progress !== 'object') state.progress = {};
      if (!state.progress.guided || typeof state.progress.guided !== 'object') state.progress.guided = {};
      const previous = state.progress.guided[session.scenario.id];
      state.progress.guided[session.scenario.id] = { completed: true, completedAt: new Date().toISOString(), attempts: Math.min(100000, Math.max(0, Number.isInteger(previous?.attempts) ? previous.attempts : 0) + 1), passedSteps: session.scenario.steps.length, totalSteps: session.scenario.steps.length };
      completedSaved = true;
      if (typeof options.save === 'function') options.save();
      toast('Guided lab complete. Every checkpoint was verified and your progress is saved.');
    }
    function check() {
      stopPlaying();
      const before = session.step().id;
      session.check(response);
      if (before !== session.step().id) response = session.answers[session.step().id] ?? null;
      if (before === 'quantity' && session.lastResult?.passed && session.step().id === 'quantity') {
        ticket.qty = String(Number(response)); const input = mount.querySelector('[data-ticket="qty"]'); if (input) input.value = ticket.qty;
      }
      saveCompletion(); paintTask(); paint(); q('feedback')?.focus({ preventScroll: true });
    }
    function advance(decision = 'step') {
      const outcome = session.advance(1, decision);
      if (outcome.exits.length) { stopPlaying(); receipt = { message: 'Protective exit: ' + outcome.exits[0].exitReason + ' · Net ' + signed(outcome.exits[0].netPnl) + '. Check the recorded result against your rule.' }; }
      const boundary = nextBoundary();
      if (outcome.atEnd || (boundary !== null && session.cursor >= boundary)) {
        stopPlaying();
        if (!outcome.exits.length) receipt = { message: outcome.atEnd ? 'The sample has ended. You can close an open position and check the exercise.' : 'The checkpoint’s observation period has been reached. Apply the exit rule if needed, then check your work.' };
      }
      chart?.latest(); paintTask(); paint();
    }
    function togglePlay() {
      if (playing) { stopPlaying(); return; }
      const boundary = nextBoundary();
      if (boundary !== null && session.cursor >= boundary) { receipt = { message: 'The observation period is already reached. Apply the rule and check this checkpoint. Next candle remains available for manual practice.' }; paint(); return; }
      playing = true; timer = root.setInterval(() => {
        if (!session || disposed) { stopPlaying(); return; }
        try { advance(); } catch (error) { stopPlaying(); receipt = { error: true, message: error.message }; paint(); }
      }, 1000); paint();
    }
    function onClick(event) {
      const button = event.target.closest?.('[data-guided-action]');
      if (!button || !mount.contains(button) || button.disabled || !session) return;
      const action = button.dataset.guidedAction;
      try {
        if (action === 'restart') { startLab(session.scenario.id); return; }
        if (action === 'continue') { session.continuePractice(); receipt = { message: 'Free practice is active. You can reveal candles and trade while your verified lab result stays locked.' }; paintTask(); paint(); return; }
        if (action === 'next') { stopPlaying(); if (session.next()) { response = null; seeOpen = false; paintTask(); paint(); q('task').querySelector('h2')?.focus({ preventScroll: true }); } }
        else if (action === 'hint') { const step = session.step(); hints[step.id] = Math.min(step.hints.length, (hints[step.id] || 0) + 1); paintTask(); emitContext(); }
        else if (action === 'retry') { session.clearFeedback(); paintTask(); paint(); }
        else if (action === 'play') togglePlay();
        else if (action === 'step' || action === 'wait') { stopPlaying(); advance(action); }
        else if (['buy', 'sell', 'close'].includes(action)) { stopPlaying(); receipt = session.order(action, ticket); paintTask(); paint(); }
        else if (action === 'tool') { tool = button.dataset.tool; chart.setTool(tool); mount.querySelectorAll('[data-tool]').forEach(item => item.setAttribute('aria-pressed', String(item.dataset.tool === tool))); }
        else if (action === 'undo') { if (!chart.cancelDrawing()) drawings.pop(); chart.draw(); emitContext(); }
        else if (action === 'delete') { if (!chart.deleteSelected()) toast('Select one of your drawings first, or press D while the chart has focus.'); }
        else if (action === 'zoom-in' || action === 'zoom-out') chart.zoom(action === 'zoom-in' ? -1 : 1);
        else if (action === 'auto') chart.setAutoscale(!chart.getScaleState().auto);
      } catch (error) { stopPlaying(); receipt = { error: true, message: error.message }; paint(); }
    }
    function onInput(event) {
      if (!session) return;
      const field = event.target.dataset?.ticket, answer = event.target.dataset?.response;
      if ((field || answer) && playing) stopPlaying();
      if (field && ['qty', 'stop', 'target', 'plan'].includes(field)) { ticket[field] = event.target.value; paintPreview(); }
      if (answer === 'choice' || answer === 'number') response = event.target.value;
      else if (['reason', 'notes', 'followedPlan'].includes(answer)) {
        if (!response || typeof response !== 'object') response = {};
        response[answer] = answer === 'followedPlan' ? event.target.value === 'yes' ? true : event.target.value === 'no' ? false : null : event.target.value;
      }
    }
    function onSubmit(event) {
      const form = event.target.closest?.('[data-guided-form]');
      if (!form || !mount.contains(form)) return;
      event.preventDefault();
      if (form.dataset.guidedForm === 'checkpoint' && session && !session.passed[session.step().id]) {
        try { check(); } catch (error) { receipt = { error: true, message: error.message }; paint(); }
      }
    }
    const listeners = { click: onClick, input: onInput, change: onInput, submit: onSubmit };
    for (const [name, listener] of Object.entries(listeners)) mount.addEventListener(name, listener);
    const onThemeChange = () => { if (!disposed && session) chart?.draw(); };
    root.addEventListener?.('replaylab-theme', onThemeChange);
    const observer = root.MutationObserver && root.document?.body ? new root.MutationObserver(onThemeChange) : null;
    observer?.observe(root.document.body, { attributes: true, attributeFilter: ['data-theme'] });
    return {
      render, getContext,
      destroy() { if (disposed) return; disposed = true; cleanupAttempt(); observer?.disconnect(); root.removeEventListener?.('replaylab-theme', onThemeChange); for (const [name, listener] of Object.entries(listeners)) mount.removeEventListener(name, listener); }
    };
  }
  return Object.freeze({ create, createSession, aliases });
});
