/* AI Quest — interactive lesson activities.
   Each widget is: function (root, ctx) where ctx.done() marks the activity complete. */
window.AIQ_WIDGETS = (function () {
  'use strict';

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

  /* ---------- Generic "one card at a time" choice deck ---------- */
  function choiceDeck(root, ctx, cfg) {
    let i = 0, score = 0, answered = false;
    function draw() {
      if (i >= cfg.items.length) {
        const pct = Math.round((score / cfg.items.length) * 100);
        root.innerHTML = `
          <div class="deck-end">
            <div class="big-score" aria-hidden="true">${score}/${cfg.items.length}</div>
            <p><strong>${pct >= 80 ? 'Excellent work!' : pct >= 50 ? 'Nice effort!' : 'Good start!'}</strong> You got ${score} of ${cfg.items.length} right.</p>
            <button class="btn ghost" data-w="restart">Try again</button>
          </div>`;
        ctx.done();
        root.querySelector('[data-w=restart]').onclick = () => { i = 0; score = 0; draw(); };
        return;
      }
      const it = cfg.items[i];
      answered = false;
      root.innerHTML = `
        <div class="deck-top"><span>${cfg.prompt}</span><span class="pill">${i + 1} / ${cfg.items.length}</span></div>
        <div class="deck-card" aria-live="polite">${it.html || esc(it.text)}</div>
        <div class="deck-opts" role="group" aria-label="Choose an answer">
          ${cfg.options.map((o) => `<button class="btn opt ${o.cls || ''}" data-id="${o.id}">${o.label}</button>`).join('')}
        </div>
        <div class="deck-fb" role="status"></div>`;
      root.querySelectorAll('.opt').forEach((b) => {
        b.onclick = () => {
          if (answered) return;
          answered = true;
          const ok = b.dataset.id === it.answer;
          if (ok) score++;
          root.querySelectorAll('.opt').forEach((x) => {
            x.disabled = true;
            if (x.dataset.id === it.answer) x.classList.add('right');
          });
          if (!ok) b.classList.add('wrong');
          const fb = root.querySelector('.deck-fb');
          fb.className = 'deck-fb show ' + (ok ? 'good' : 'bad');
          fb.innerHTML = `<strong>${ok ? '✅ Correct!' : '❌ Not quite.'}</strong> ${it.why}
            <div><button class="btn small" data-w="next">${i + 1 === cfg.items.length ? 'See results' : 'Next'} →</button></div>`;
          const nb = fb.querySelector('[data-w=next]');
          nb.onclick = () => { i++; draw(); };
          nb.focus();
        };
      });
    }
    draw();
  }

  /* ---------- Foundations 1: AI or not AI ---------- */
  function sortAI(root, ctx) {
    choiceDeck(root, ctx, {
      prompt: 'Is this an example of AI?',
      options: [{ id: 'ai', label: '🤖 Uses AI', cls: 'o1' }, { id: 'not', label: '⚙️ Not AI', cls: 'o2' }],
      items: [
        { text: 'A spam filter that learns to spot junk email from millions of examples.', answer: 'ai', why: 'It learns patterns from data, which is machine learning.' },
        { text: 'A pocket calculator adding 247 + 389.', answer: 'not', why: 'It follows fixed arithmetic rules and learns nothing.' },
        { text: 'Your phone unlocking when it recognizes your face.', answer: 'ai', why: 'Face recognition uses a neural network trained on images.' },
        { text: 'A hallway light switch.', answer: 'not', why: 'It is a simple mechanical on/off connection.' },
        { text: 'A streaming service suggesting shows you might like.', answer: 'ai', why: 'Recommendation systems learn from your behavior and everyone else\'s.' },
        { text: 'A thermostat that heats to exactly 70°F every day at 6 AM.', answer: 'not', why: 'A timer plus a fixed rule is automation, not learning. (A "smart" thermostat that learns your habits would be AI.)' },
        { text: 'A voice assistant turning your spoken words into text.', answer: 'ai', why: 'Speech recognition relies on trained neural networks.' },
        { text: 'A video game enemy that walks back and forth on a fixed path.', answer: 'not', why: 'Scripted behavior is rule-based. It does not learn or adapt.' }
      ]
    });
  }

  /* ---------- Foundations 2: train a neuron ---------- */
  function neuron(root, ctx) {
    const names = ['Cloud cover', 'Rain chance', 'Wind'];
    const data = [[.9, .8, .4, 1], [.2, .1, .3, 0], [.7, .9, .1, 1], [.1, .05, .6, 0], [.6, .7, .8, 1], [.4, .2, .5, 0]];
    let w, b, steps, test = [50, 50, 50];
    const sig = (z) => 1 / (1 + Math.exp(-z));
    const pred = (x) => sig(x[0] * w[0] + x[1] * w[1] + x[2] * w[2] + b);
    const loss = () => data.reduce((s, d) => { const p = clamp(pred(d), 1e-6, 1 - 1e-6); return s - (d[3] ? Math.log(p) : Math.log(1 - p)); }, 0) / data.length;
    function reset() { w = [0, 0, 0]; b = 0; steps = 0; }
    function train(n) {
      for (let k = 0; k < n; k++) {
        const gw = [0, 0, 0]; let gb = 0;
        data.forEach((d) => { const e = pred(d) - d[3]; for (let j = 0; j < 3; j++) gw[j] += e * d[j]; gb += e; });
        for (let j = 0; j < 3; j++) w[j] -= 2 * gw[j] / data.length;
        b -= 2 * gb / data.length;
        steps++;
      }
    }
    reset();
    root.innerHTML = `
      <p class="w-intro">Predict: <strong>should I bring an umbrella?</strong> The neuron starts knowing nothing (all weights = 0). It sees 6 past days. Click <em>Train</em> to adjust its weights and watch the <strong>loss</strong> (its error) fall.</p>
      <div class="neuron-grid">
        <div>
          <h4>Weights <small>(how much each input matters)</small></h4>
          <div class="wbars"></div>
          <div class="stats"><span>Training steps: <b data-s="steps">0</b></span><span>Loss: <b data-s="loss">0.69</b></span></div>
          <div class="loss-track" aria-hidden="true"><div class="loss-fill" data-s="lossbar"></div></div>
          <div class="btn-row">
            <button class="btn small" data-w="t1">Train ×1</button>
            <button class="btn small primary" data-w="t25">Train ×25</button>
            <button class="btn small ghost" data-w="rs">Reset</button>
          </div>
          <p class="hint" data-s="goal">Goal: get the loss below 0.30.</p>
        </div>
        <div>
          <h4>Test it <small>(drag the sliders)</small></h4>
          ${names.map((n, j) => `<label class="slide">${n}: <b data-v="${j}">50</b>%<input type="range" min="0" max="100" value="50" data-t="${j}"></label>`).join('')}
          <div class="verdict" data-s="verdict" aria-live="polite"></div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    function paint() {
      const L = loss();
      $('[data-s=steps]').textContent = steps;
      $('[data-s=loss]').textContent = L.toFixed(2);
      $('[data-s=lossbar]').style.width = clamp((L / 0.7) * 100, 2, 100) + '%';
      $('.wbars').innerHTML = names.map((n, j) => {
        const pct = clamp(Math.abs(w[j]) / 6 * 50, 0, 50);
        return `<div class="wrow"><span>${n}</span><div class="wtrack"><div class="wfill ${w[j] < 0 ? 'neg' : ''}" style="${w[j] < 0 ? 'right:50%' : 'left:50%'};width:${pct}%"></div></div><b>${w[j].toFixed(1)}</b></div>`;
      }).join('');
      const p = pred(test.map((v) => v / 100));
      $('[data-s=verdict]').innerHTML = `<div class="gauge"><div style="width:${Math.round(p * 100)}%"></div></div>
        <div>${p > .5 ? '☔ Bring the umbrella' : '😎 Leave it home'} <small>(${Math.round(p * 100)}% confident)</small></div>`;
      if (L < 0.3) { $('[data-s=goal]').textContent = '✅ Trained! The rain-chance weight grew the most because it best predicts the outcome.'; ctx.done(); }
    }
    $('[data-w=t1]').onclick = () => { train(1); paint(); };
    $('[data-w=t25]').onclick = () => { train(25); paint(); };
    $('[data-w=rs]').onclick = () => { reset(); paint(); };
    root.querySelectorAll('[data-t]').forEach((r) => {
      r.oninput = () => { test[+r.dataset.t] = +r.value; root.querySelector(`[data-v="${r.dataset.t}"]`).textContent = r.value; paint(); };
    });
    paint();
  }

  /* ---------- Foundations 3: next-word predictor ---------- */
  function nextWord(root, ctx) {
    const LM = {
      'sky is': { blue: .55, clear: .15, cloudy: .1, gray: .08, beautiful: .1, falling: .02 },
      'is blue': { and: .35, '.': .4, because: .15, today: .1 },
      'i love': { pizza: .22, music: .2, learning: .18, it: .15, you: .1, coding: .15 },
      'love to': { learn: .3, play: .2, read: .2, travel: .15, eat: .15 },
      'artificial intelligence': { is: .3, can: .25, will: .2, helps: .15, learns: .1 },
      'intelligence is': { changing: .3, everywhere: .25, a: .25, transforming: .2 },
      'intelligence can': { help: .4, write: .2, learn: .2, make: .2 },
      'can help': { students: .4, people: .3, doctors: .15, us: .15 },
      'my teacher': { said: .4, is: .3, gave: .15, asked: .15 },
      'teacher said': { we: .35, that: .25, to: .2, the: .2 },
      students: { learn: .3, use: .3, can: .2, '.': .2 },
      learn: { faster: .3, new: .3, more: .2, '.': .2 },
      the: { future: .25, world: .25, best: .25, answer: .25 },
      and: { the: .3, then: .25, it: .25, learn: .2 },
      a: { great: .3, new: .3, big: .2, simple: .2 },
      is: { a: .3, the: .3, very: .2, not: .2 },
      we: { will: .3, can: .3, should: .2, learn: .2 },
      will: { change: .3, help: .3, be: .2, learn: .2 },
      '.': { '.': 0 }
    };
    const starters = ['The sky is', 'I love', 'Artificial intelligence', 'My teacher'];
    const fallback = { the: .3, and: .3, to: .2, '.': .2 };
    let text = starters[0], temp = 1, added = 0;
    function dist() {
      const ws = text.toLowerCase().split(/\s+/);
      const k2 = ws.slice(-2).join(' '), k1 = ws[ws.length - 1];
      let d = LM[k2] || LM[k1] || fallback;
      d = Object.entries(d).filter((e) => e[1] > 0);
      if (!d.length) d = Object.entries(fallback);
      const t = Math.max(0.15, temp);
      let pw = d.map(([w, p]) => [w, Math.pow(p, 1 / t)]);
      const s = pw.reduce((a, e) => a + e[1], 0);
      return pw.map(([w, p]) => [w, p / s]).sort((a, b) => b[1] - a[1]);
    }
    function pick(word) {
      text += (word === '.' ? '' : ' ') + word;
      added++;
      if (added >= 4) ctx.done();
      paint();
    }
    function paint() {
      const d = dist().slice(0, 6);
      root.querySelector('.nw-text').textContent = text;
      root.querySelector('.nw-bars').innerHTML = d.map(([w, p]) => `
        <button class="nw-row" data-word="${esc(w)}" aria-label="Choose ${esc(w)}, ${Math.round(p * 100)} percent">
          <span class="nw-w">${esc(w)}</span><span class="nw-track"><span style="width:${Math.max(3, p * 100)}%"></span></span><b>${Math.round(p * 100)}%</b>
        </button>`).join('');
      root.querySelectorAll('.nw-row').forEach((r) => (r.onclick = () => pick(r.dataset.word)));
      root.querySelector('.nw-prog').textContent = added >= 4 ? '✅ You generated text one word at a time, just like an LLM.' : `Add ${4 - added} more word${4 - added === 1 ? '' : 's'} to complete the activity.`;
    }
    root.innerHTML = `
      <p class="w-intro">A language model scores every possible next word. <strong>Click a bar</strong> to choose that word, or press <em>Sample</em> to let the model pick by chance. Slide <strong>temperature</strong> to change how adventurous it is.</p>
      <div class="starter-row">${starters.map((s) => `<button class="chip" data-start="${s}">${s}</button>`).join('')}</div>
      <div class="nw-text" aria-live="polite"></div>
      <div class="nw-bars"></div>
      <div class="nw-controls">
        <label class="slide">Temperature: <b data-s="temp">1.0</b> <small>(low = predictable · high = random)</small><input type="range" min="0.2" max="3" step="0.1" value="1" data-w="temp"></label>
        <div class="btn-row"><button class="btn small primary" data-w="sample">🎲 Sample next word</button><button class="btn small ghost" data-w="reset">Reset</button></div>
      </div>
      <p class="hint nw-prog"></p>
      <p class="hint">This toy model knows only a few dozen words. Real LLMs choose among 100,000+ tokens.</p>`;
    root.querySelectorAll('[data-start]').forEach((b) => (b.onclick = () => { text = b.dataset.start; paint(); }));
    root.querySelector('[data-w=temp]').oninput = (e) => { temp = +e.target.value; root.querySelector('[data-s=temp]').textContent = temp.toFixed(1); paint(); };
    root.querySelector('[data-w=reset]').onclick = () => { text = starters[0]; paint(); };
    root.querySelector('[data-w=sample]').onclick = () => {
      const d = dist(); let r = Math.random();
      for (const [w, p] of d) { r -= p; if (r <= 0) return pick(w); }
      pick(d[0][0]);
    };
    paint();
  }

  /* ---------- Foundations 4: spot the hallucination ---------- */
  function hallucination(root, ctx) {
    choiceDeck(root, ctx, {
      prompt: 'An AI wrote this. Reliable or suspicious?',
      options: [{ id: 'ok', label: '👍 Reliable', cls: 'o1' }, { id: 'bad', label: '🚩 Suspicious', cls: 'o2' }],
      items: [
        { text: '"Python was created by Guido van Rossum."', answer: 'ok', why: 'This is a well-documented fact. For anything important, a quick check is still wise.' },
        { text: '"Humans only use 10% of their brains."', answer: 'bad', why: 'A popular myth. Brain imaging shows we use virtually all of our brain.' },
        { html: '"According to Dr. Helen Marwick (2019), <em>Neural Learning in Teens</em>, Journal of Cognitive Futures, vol. 44, p. 212."', answer: 'bad', why: 'Super-specific citations that you can\'t find are a classic hallucination. Search for the real article before citing it.' },
        { text: '"Water boils at 100°C (212°F) at sea level."', answer: 'ok', why: 'Correct, a standard science fact.' },
        { text: '"Thomas Edison invented the first email system in 1890."', answer: 'bad', why: 'Email did not exist until the 1970s. The AI confidently mixed up an inventor with an invention.' },
        { text: '"The Pacific is the largest ocean on Earth."', answer: 'ok', why: 'Correct. It covers about a third of Earth\'s surface.' }
      ]
    });
  }

  /* ---------- Tools 1: tool explorer ---------- */
  function toolTypes(root, ctx) {
    const T = [
      { icon: '💬', name: 'Chat assistants', does: 'Answer questions, explain topics, brainstorm, and role-play in a back-and-forth conversation.', ex: 'General-purpose chatbots such as ChatGPT, Claude, Gemini, and Microsoft Copilot', use: 'Ask for a concept to be explained three different ways, or have it quiz you.', catch: 'Can hallucinate and sound certain while wrong.' },
      { icon: '✍️', name: 'Writing helpers', does: 'Check spelling, grammar, tone, and clarity in text you already wrote.', ex: 'Grammar and style checkers such as Grammarly or built-in editors', use: 'Catch typos and confusing sentences in your own draft.', catch: 'Accepting every suggestion can erase your voice. Policies on use vary.' },
      { icon: '🔎', name: 'Research tools', does: 'Search the web or your uploaded documents and summarize with source links.', ex: 'Search assistants like Perplexity, and notebook tools like Google NotebookLM', use: 'Get a first overview, then open the linked sources yourself.', catch: 'Summaries can miss nuance or misquote. Read the originals.' },
      { icon: '🎨', name: 'Image & media generators', does: 'Create pictures, audio, or video from text descriptions.', ex: 'Image generators such as DALL·E, Midjourney, and Adobe Firefly', use: 'Make concept art or illustrations for a project, with credit.', catch: 'May copy styles, show biases, or be mistaken for real photos. Label AI images.' },
      { icon: '🧮', name: 'Coding & math helpers', does: 'Explain code, find bugs, and show step-by-step solutions.', ex: 'GitHub Copilot, Wolfram Alpha, and tutoring tools like Khanmigo', use: 'Ask "why does this error happen?" and learn the fix.', catch: 'Copying code or answers you don\'t understand builds no skill.' }
    ];
    const seen = new Set([0]);
    let cur = 0;
    function draw() {
      const t = T[cur];
      root.innerHTML = `
        <p class="w-intro">Open every tab to explore the toolbox (<b>${seen.size}/${T.length}</b> visited).</p>
        <div class="tabs" role="tablist">${T.map((x, i) => `<button role="tab" aria-selected="${i === cur}" class="tab ${i === cur ? 'on' : ''} ${seen.has(i) ? 'seen' : ''}" data-i="${i}">${x.icon} ${x.name}</button>`).join('')}</div>
        <div class="tabpanel" role="tabpanel">
          <h4>${t.icon} ${t.name}</h4>
          <p>${t.does}</p>
          <dl class="tooldl">
            <dt>Examples</dt><dd>${t.ex}</dd>
            <dt>Good for school</dt><dd>${t.use}</dd>
            <dt class="warn">Watch out</dt><dd>${t.catch}</dd>
          </dl>
          <p class="hint">Products change quickly and mentioning a tool is not an endorsement. Always follow your school's rules.</p>
        </div>`;
      root.querySelectorAll('.tab').forEach((b) => (b.onclick = () => { cur = +b.dataset.i; seen.add(cur); draw(); root.querySelector('.tab.on').focus(); }));
      if (seen.size === T.length) ctx.done();
    }
    draw();
  }

  /* ---------- Tools 2: prompt lab ---------- */
  function promptLab(root, ctx) {
    const weak = 'tell me about photosynthesis';
    const strong = 'Act as a friendly biology tutor. I\'m a 10th grader preparing for a quiz. Explain photosynthesis in 5 bullet points with one real-life analogy. Keep it under 120 words and avoid jargon.';
    const checks = [
      { k: 'Role', tip: 'Add who the AI should be: "Act as a ... tutor."', re: /\b(act as|you are|pretend|as a|as an|play the role|role of)\b/i },
      { k: 'Task', tip: 'Start with a clear action verb: explain, summarize, quiz, compare, outline.', re: /\b(explain|summari[sz]e|quiz|compare|outline|list|describe|create|write|give|generate|help me|teach|review|check|solve|brainstorm|translate)\b/i },
      { k: 'Context', tip: 'Say who you are or what you already know: "I\'m a 10th grader ..."', re: /\b(i'?m|i am|my |grade|student|class|beginner|studying|preparing|for a (quiz|test|project|class)|already know|level)\b/i },
      { k: 'Format', tip: 'Describe the output: bullet points, table, steps, 2 paragraphs, an analogy.', re: /\b(bullet|table|steps?|numbered|paragraph|sentences?|outline|list|analogy|example|format|json|checklist|summary)\b/i },
      { k: 'Constraints', tip: 'Set limits: "under 120 words", "avoid jargon", "only use ..."', re: /\b(under|within|at most|no more than|less than|maximum|max|avoid|don'?t|do not|without|only|\d+\s*(words|sentences|minutes|bullets?|points))\b/i }
    ];
    root.innerHTML = `
      <p class="w-intro">Write a prompt below. The lab checks it for the five R-T-C-F-C ingredients. <strong>Get 4 or more to complete the activity.</strong></p>
      <label class="sr" for="pl-text">Your prompt</label>
      <textarea id="pl-text" rows="4" placeholder="Type a prompt, for example: help me study for my chemistry test"></textarea>
      <div class="btn-row"><button class="btn small ghost" data-w="weak">Load weak example</button><button class="btn small ghost" data-w="strong">Load strong example</button></div>
      <div class="pl-score"><div class="meter"><div class="meter-fill" data-s="fill"></div></div><b data-s="score">0 / 5</b></div>
      <ul class="pl-list" aria-live="polite"></ul>`;
    const ta = root.querySelector('textarea');
    function paint() {
      const v = ta.value;
      const res = checks.map((c) => ({ ...c, ok: c.re.test(v) && v.trim().length > 0 }));
      const n = res.filter((r) => r.ok).length;
      root.querySelector('[data-s=score]').textContent = n + ' / 5';
      const f = root.querySelector('[data-s=fill]');
      f.style.width = n * 20 + '%';
      f.dataset.lv = n;
      root.querySelector('.pl-list').innerHTML = res.map((r) => `<li class="${r.ok ? 'ok' : ''}"><span aria-hidden="true">${r.ok ? '✅' : '⬜'}</span><div><b>${r.k}</b>${r.ok ? '' : `<small>${r.tip}</small>`}</div></li>`).join('');
      if (n >= 4) ctx.done('promptpro' + (n === 5 ? '5' : ''));
    }
    ta.oninput = paint;
    root.querySelector('[data-w=weak]').onclick = () => { ta.value = weak; paint(); };
    root.querySelector('[data-w=strong]').onclick = () => { ta.value = strong; paint(); };
    paint();
  }

  /* ---------- Tools 3: study flip cards ---------- */
  function studyCards(root, ctx) {
    const C = [
      { t: 'Explain it back', i: '🗣️', p: 'I\'m going to explain [topic] in my own words. Point out anything I got wrong or left out, but don\'t give me the full answer yet.', w: 'Don\'t just accept praise. Ask it to find gaps.' },
      { t: 'Quiz me', i: '❓', p: 'Quiz me on [unit]. Ask one question at a time, wait for my answer, then tell me if I\'m right and explain why.', w: 'Check tricky answers against your notes.' },
      { t: 'Feedback on my draft', i: '📝', p: 'Here is my paragraph. Give me 3 suggestions about structure and clarity, but do not rewrite it for me.', w: 'You do the rewriting so the voice stays yours. Only if your teacher allows it.' },
      { t: 'Plan my time', i: '📅', p: 'My test is in 7 days on [topics]. I have 45 minutes each evening. Make a day-by-day study plan with review sessions.', w: 'Adjust it to your real schedule.' },
      { t: 'Translate the jargon', i: '🔤', p: 'Explain this paragraph as if I\'m in 9th grade, then give me one example from everyday life: [paste text from your textbook].', w: 'Compare with your textbook to be sure nothing was lost.' }
    ];
    const flipped = new Set();
    root.innerHTML = `
      <p class="w-intro">Click each card to flip it and reveal a ready-to-use prompt (<b data-s="n">0</b>/${C.length} flipped).</p>
      <div class="cards">${C.map((c, i) => `
        <div class="flip" data-i="${i}">
          <button class="flip-in" aria-pressed="false" aria-label="${c.t}: flip card">
            <span class="face front"><span class="ico" aria-hidden="true">${c.i}</span><b>${c.t}</b><small>Click to flip</small></span>
            <span class="face back"><small>Try this prompt:</small><em>${esc(c.p)}</em><small class="w">⚠️ ${c.w}</small></span>
          </button>
          <button class="btn tiny" data-copy="${i}" aria-label="Copy prompt for ${c.t}">Copy prompt</button>
        </div>`).join('')}</div>`;
    root.querySelectorAll('.flip').forEach((f) => {
      const i = +f.dataset.i;
      f.querySelector('.flip-in').onclick = (e) => {
        f.classList.toggle('on');
        e.currentTarget.setAttribute('aria-pressed', f.classList.contains('on'));
        if (f.classList.contains('on')) flipped.add(i);
        root.querySelector('[data-s=n]').textContent = flipped.size;
        if (flipped.size === C.length) ctx.done();
      };
      f.querySelector('[data-copy]').onclick = (e) => {
        const btn = e.currentTarget;
        const done = () => { btn.textContent = 'Copied ✓'; setTimeout(() => (btn.textContent = 'Copy prompt'), 1400); };
        try { navigator.clipboard.writeText(C[i].p).then(done, done); } catch (_) { done(); }
      };
    });
  }

  /* ---------- Tools 4: SIFT checklist ---------- */
  function sift(root, ctx) {
    const steps = [
      { k: 'S', t: 'Stop', q: 'Does this claim feel too good to be true?', a: 'Yes. A "40% jump for everyone" is a bold number. Pause before copying it into your project.' },
      { k: 'I', t: 'Investigate the source', q: 'Who published the study? Does the source exist?', a: 'Ask the AI for the link or title, then search for it yourself. If nothing turns up, it is likely invented.' },
      { k: 'F', t: 'Find better coverage', q: 'What do trusted sources say?', a: 'Search education journals, university sites, or reputable news. Real findings are usually reported in several places.' },
      { k: 'T', t: 'Trace to the original', q: 'Where did the number come from?', a: 'Open the original study. Check sample size, who was studied, and what "scores higher" actually measured.' }
    ];
    const got = new Set();
    root.innerHTML = `
      <div class="w-intro"><p>An AI tells you:</p><blockquote class="quote">"A 2023 study found that students who use AI score 40% higher on every test."</blockquote>
      <p>Click each SIFT step to see how you would check it (<b data-s="n">0</b>/4).</p></div>
      <div class="sift">${steps.map((s, i) => `
        <button class="sift-step" data-i="${i}" aria-expanded="false">
          <span class="sift-k">${s.k}</span>
          <span class="sift-body"><b>${s.t}</b><small>${s.q}</small><span class="sift-a">${s.a}</span></span>
          <span class="sift-chk" aria-hidden="true">○</span>
        </button>`).join('')}</div>
      <p class="hint" data-s="msg"></p>`;
    root.querySelectorAll('.sift-step').forEach((b) => {
      b.onclick = () => {
        b.classList.add('on'); b.setAttribute('aria-expanded', 'true');
        b.querySelector('.sift-chk').textContent = '✓';
        got.add(b.dataset.i);
        root.querySelector('[data-s=n]').textContent = got.size;
        if (got.size === steps.length) { root.querySelector('[data-s=msg]').textContent = '✅ Verified. Now you know whether the claim holds up.'; ctx.done(); }
      };
    });
  }

  /* ---------- Ethics 1: traffic light ---------- */
  function integrity(root, ctx) {
    choiceDeck(root, ctx, {
      prompt: 'Traffic light: how would this be treated in most classes?',
      options: [{ id: 'g', label: '🟢 Fine', cls: 'g' }, { id: 'y', label: '🟡 Ask first', cls: 'y' }, { id: 'r', label: '🔴 Not okay', cls: 'r' }],
      items: [
        { text: 'You ask an AI to explain a concept your teacher covered too fast.', answer: 'g', why: 'Using AI as a tutor to understand material is generally encouraged.' },
        { text: 'You paste the essay prompt into AI and submit what it writes as your own.', answer: 'r', why: 'This is plagiarism: someone (or something) else did the work.' },
        { text: 'You ask AI to check the grammar of your own finished draft.', answer: 'y', why: 'Many teachers allow it, but some assignments don\'t. Check the policy.' },
        { text: 'You ask AI to make you a practice quiz for tomorrow\'s test.', answer: 'g', why: 'Self-quizzing strengthens memory and you do all the thinking.' },
        { text: 'Your teacher said "no AI" for this project, but you use it for the code anyway.', answer: 'r', why: 'Breaking an explicit rule is an integrity violation, even for "small" help.' },
        { text: 'You ask AI to brainstorm topics, then tell your teacher you did that.', answer: 'g', why: 'Brainstorming plus honest disclosure is a good model.' },
        { text: 'You have AI rewrite your whole paragraph in "better words" and submit it.', answer: 'y', why: 'Heavy rewriting can replace your voice and skills, so ask whether it\'s allowed, and disclose it if so.' }
      ]
    });
  }

  /* ---------- Ethics 2: bias slider ---------- */
  function bias(root, ctx) {
    root.innerHTML = `
      <p class="w-intro">A school-club AI is trained on past applications to predict who will be a "good fit." Group B is under-represented. <strong>Slide the amount of Group B data</strong> and watch fairness change.</p>
      <label class="slide">Group B share of training data: <b data-s="pct">5</b>%<input type="range" min="1" max="50" value="5" data-w="r"></label>
      <div class="bias-split" aria-hidden="true"><div class="a" data-s="sa">Group A 95%</div><div class="b" data-s="sb">B</div></div>
      <div class="bias-acc">
        <div><span>Accuracy for Group A</span><div class="meter"><div class="meter-fill acc-a" data-s="fa"></div></div><b data-s="aa"></b></div>
        <div><span>Accuracy for Group B</span><div class="meter"><div class="meter-fill acc-b" data-s="fb"></div></div><b data-s="ab"></b></div>
      </div>
      <p class="verdict" data-s="msg" aria-live="polite"></p>
      <p class="hint">Simplified simulation for learning. Real systems need careful testing, but the lesson is real: who is missing from the data pays the price.</p>`;
    const r = root.querySelector('[data-w=r]'), q = (s) => root.querySelector(`[data-s=${s}]`);
    function paint() {
      const share = +r.value;
      const a = 96, b = Math.round(55 + 40 * (1 - Math.exp(-share / 12)));
      q('pct').textContent = share;
      q('sa').textContent = `Group A ${100 - share}%`; q('sa').style.flexBasis = 100 - share + '%';
      q('sb').textContent = share >= 8 ? `B ${share}%` : ''; q('sb').style.flexBasis = share + '%';
      q('fa').style.width = a + '%'; q('fb').style.width = b + '%';
      q('aa').textContent = a + '%'; q('ab').textContent = b + '%';
      const gap = a - b;
      q('msg').innerHTML = gap > 20 ? `⚠️ <b>${gap}-point gap.</b> The AI works far worse for the group it rarely saw.`
        : gap > 8 ? `🔶 <b>${gap}-point gap.</b> Better, but still unfair. Keep balancing the data.`
        : `✅ <b>${gap}-point gap.</b> Much fairer. Diverse, representative data makes a big difference.`;
      if (share >= 30) ctx.done('bias');
    }
    r.oninput = paint; paint();
  }

  /* ---------- Ethics 3: redact the private info ---------- */
  function privacy(root, ctx) {
    const parts = [
      ['Hi! I\'m ', 0], ['Maya Johnson', 1], [', a junior at ', 0], ['Lincoln High School', 1],
      ['. My student ID is ', 0], ['48291', 1], [' and I live at ', 0], ['214 Oak Street', 1],
      ['. You can text me at ', 0], ['555-0142', 1], [' or email ', 0], ['maya.j@example.com', 1],
      ['. Can you help me outline ', 0], ['an essay on the causes of the Industrial Revolution', 0], ['? ', 0],
      ['My teacher, ', 0], ['Mr. Alvarez', 1], [', said it\'s due Friday.', 0]
    ];
    const on = new Set();
    root.innerHTML = `
      <p class="w-intro">This message is about to be sent to a chatbot. <strong>Click every piece of personal information</strong> to redact it, then press <em>Check</em>. Leave the parts the AI actually needs.</p>
      <div class="msg" role="group" aria-label="Message text">${parts.map(([t, p], i) => p
        ? `<button class="pii" data-i="${i}" aria-pressed="false">${esc(t)}</button>` : `<span>${esc(t)}</span>`).join('')}</div>
      <div class="btn-row"><button class="btn small primary" data-w="check">Check my redactions</button><button class="btn small ghost" data-w="reset">Reset</button></div>
      <p class="verdict" data-s="msg" role="status"></p>`;
    root.querySelectorAll('.pii').forEach((b) => {
      b.onclick = () => {
        const i = b.dataset.i;
        on.has(i) ? on.delete(i) : on.add(i);
        b.classList.toggle('red', on.has(i));
        b.setAttribute('aria-pressed', on.has(i));
        b.classList.remove('good', 'bad');
      };
    });
    const total = parts.filter((p) => p[1]).length;
    root.querySelector('[data-w=reset]').onclick = () => { on.clear(); root.querySelectorAll('.pii').forEach((b) => { b.classList.remove('red', 'good', 'bad'); b.setAttribute('aria-pressed', 'false'); }); root.querySelector('[data-s=msg]').textContent = ''; };
    root.querySelector('[data-w=check]').onclick = () => {
      const missed = [...root.querySelectorAll('.pii')].filter((b) => !on.has(b.dataset.i));
      missed.forEach((b) => b.classList.add('bad'));
      root.querySelector('[data-s=msg]').innerHTML = missed.length
        ? `🚩 You redacted ${on.size} of ${total}. The highlighted items still identify you or others. Try again.`
        : '✅ <b>All personal details redacted!</b> The AI can still help with the essay outline. It needed only the topic, not who you are.';
      if (!missed.length) { root.querySelectorAll('.pii').forEach((b) => b.classList.add('good')); ctx.done(); }
    };
  }

  /* ---------- Ethics 4: citation generator ---------- */
  function cite(root, ctx) {
    const now = new Date();
    const iso = now.toISOString().slice(0, 10);
    root.innerHTML = `
      <p class="w-intro">When AI helped you, give credit. Fill in the details and generate an APA-style reference, an MLA-style entry, and a short disclosure statement. <strong>Generate one to complete the activity.</strong></p>
      <form class="cite-form" autocomplete="off">
        <label>Tool name<input name="tool" value="ChatGPT" required maxlength="60"></label>
        <label>Company<input name="co" value="OpenAI" required maxlength="60"></label>
        <label>Version / model <input name="ver" value="GPT-4o" maxlength="40"></label>
        <label>Date used<input name="date" type="date" value="${iso}" required></label>
        <label class="wide">Your prompt (short)<input name="prompt" value="Explain how photosynthesis works" maxlength="120"></label>
        <label class="wide">Tool web address<input name="url" value="https://chat.openai.com" maxlength="120"></label>
        <label class="wide">How did AI help? <input name="how" value="brainstorming an outline" maxlength="100"></label>
        <button class="btn primary" type="submit">Generate citations</button>
      </form>
      <div class="cite-out" aria-live="polite"></div>
      <p class="hint">Style guides update often and teachers may want a specific format, so always follow your teacher's instructions.</p>`;
    const mon = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    root.querySelector('form').onsubmit = (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target).entries());
      const d = new Date(f.date + 'T12:00:00');
      const y = d.getFullYear(), full = `${mon[d.getMonth()]} ${d.getDate()}, ${y}`;
      const ver = f.ver ? ` (${esc(f.ver)})` : '';
      const apa = `${esc(f.co)}. (${y}). <i>${esc(f.tool)}</i>${ver} [Large language model]. ${esc(f.url)}`;
      const mla = `"${esc(f.prompt)}" prompt. <i>${esc(f.tool)}</i>, ${f.ver ? esc(f.ver) + ', ' : ''}${esc(f.co)}, ${d.getDate()} ${mon[d.getMonth()].slice(0, 3)}. ${y}, ${esc(f.url)}.`;
      const disc = `I used ${esc(f.tool)} (${esc(f.co)}) on ${full} for ${esc(f.how)}. I reviewed and verified the information, and all final writing is my own.`;
      root.querySelector('.cite-out').innerHTML = `
        <div class="cite-box"><h4>APA style</h4><p>${apa}</p></div>
        <div class="cite-box"><h4>MLA style</h4><p>${mla}</p></div>
        <div class="cite-box"><h4>Disclosure statement</h4><p>${disc}</p></div>`;
      ctx.done();
    };
  }

  return { sortAI, neuron, nextWord, hallucination, toolTypes, promptLab, studyCards, sift, integrity, bias, privacy, cite };
})();
