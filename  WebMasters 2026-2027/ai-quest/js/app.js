/* AI Quest — app shell: routing, gamification state, views. No dependencies. */
(function () {
  'use strict';

  const { MODULES, GLOSSARY } = window.AIQ_DATA;
  const WIDGETS = window.AIQ_WIDGETS;

  /* ============================== Helpers ============================== */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const app = $('#app');

  const XP_LESSON = 50, XP_ACTIVITY = 20, XP_PER_QUIZ_POINT = 20, PASS_SCORE = 3;
  const LEVELS = [
    { xp: 0, name: 'Curious Bot' },
    { xp: 100, name: 'Data Detective' },
    { xp: 250, name: 'Prompt Apprentice' },
    { xp: 450, name: 'Neural Navigator' },
    { xp: 700, name: 'Model Whisperer' },
    { xp: 1000, name: 'AI Sage' }
  ];
  const allLessons = MODULES.flatMap((m) => m.lessons.map((l) => ({ ...l, mod: m })));
  const findLesson = (id) => allLessons.find((l) => l.id === id);
  const findModule = (id) => MODULES.find((m) => m.id === id);
  const MAX_XP = allLessons.length * (XP_LESSON + XP_ACTIVITY) + MODULES.length * MODULES[0].quiz.length * XP_PER_QUIZ_POINT;

  /* ============================== State ============================== */
  const KEY = 'ai-quest-v1';
  const mem = {};
  const store = {
    get() { try { return localStorage.getItem(KEY); } catch (_) { return mem[KEY] || null; } },
    set(v) { try { localStorage.setItem(KEY, v); } catch (_) { mem[KEY] = v; } },
    clear() { try { localStorage.removeItem(KEY); } catch (_) { /* ignore */ } delete mem[KEY]; }
  };
  const fresh = () => ({ name: '', xp: 0, lessons: {}, acts: {}, quiz: {}, badges: {}, flags: {}, log: [], streak: { count: 0, last: '' }, best: 0, theme: '' });
  let S;
  try { S = Object.assign(fresh(), JSON.parse(store.get() || '{}')); } catch (_) { S = fresh(); }
  const save = () => store.set(JSON.stringify(S));

  const dayStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  (function touchStreak() {
    const today = dayStr(new Date());
    if (S.streak.last === today) return;
    const y = new Date(); y.setDate(y.getDate() - 1);
    S.streak.count = S.streak.last === dayStr(y) ? S.streak.count + 1 : 1;
    S.streak.last = today;
    S.best = Math.max(S.best, S.streak.count);
    save();
  })();

  const levelOf = (xp) => { let i = 0; LEVELS.forEach((l, k) => { if (xp >= l.xp) i = k; }); return i; };
  const lessonsDone = (m) => m.lessons.filter((l) => S.lessons[l.id]).length;
  const quizBest = (m) => (S.quiz[m.id] ? S.quiz[m.id].best : -1);
  const quizPassed = (m) => quizBest(m) >= PASS_SCORE;
  const moduleDone = (m) => lessonsDone(m) === m.lessons.length && quizPassed(m);
  const totalSteps = allLessons.length + MODULES.length;
  const stepsDone = () => allLessons.filter((l) => S.lessons[l.id]).length + MODULES.filter(quizPassed).length;
  const pctDone = () => Math.round((stepsDone() / totalSteps) * 100);
  const allDone = () => stepsDone() === totalSteps;

  /* ============================== Badges ============================== */
  const BADGES = [
    { id: 'first', icon: '⚡', name: 'First Spark', desc: 'Complete your first lesson.', test: () => allLessons.some((l) => S.lessons[l.id]) },
    { id: 'found', icon: '🧠', name: 'Foundations Pro', desc: 'Finish every AI Foundations lesson.', test: () => lessonsDone(findModule('foundations')) === 4 },
    { id: 'tools', icon: '🛠️', name: 'Tool Master', desc: 'Finish every AI Tools lesson.', test: () => lessonsDone(findModule('tools')) === 4 },
    { id: 'ethics', icon: '🛡️', name: 'Ethics Guardian', desc: 'Finish every Ethical AI lesson.', test: () => lessonsDone(findModule('ethics')) === 4 },
    { id: 'prompt', icon: '✍️', name: 'Prompt Pro', desc: 'Write a perfect 5/5 prompt in the Prompt Lab.', test: () => !!S.flags.promptpro5 },
    { id: 'bias', icon: '⚖️', name: 'Bias Buster', desc: 'Balance the data to close the fairness gap.', test: () => !!S.acts['ethics-2'] },
    { id: 'perfect', icon: '🎯', name: 'Perfect Score', desc: 'Get 5/5 on any module quiz.', test: () => MODULES.some((m) => quizBest(m) === m.quiz.length) },
    { id: 'quizzes', icon: '🏆', name: 'Quiz Champion', desc: 'Pass all three module quizzes.', test: () => MODULES.every(quizPassed) },
    { id: 'streak', icon: '🔥', name: 'On a Roll', desc: 'Learn 3 days in a row.', test: () => S.best >= 3 },
    { id: 'rising', icon: '⭐', name: 'Rising Star', desc: 'Reach Level 4.', test: () => levelOf(S.xp) >= 3 },
    { id: 'grad', icon: '🎓', name: 'AI Graduate', desc: 'Complete every lesson and pass every quiz.', test: () => allDone() }
  ];

  function checkBadges() {
    BADGES.forEach((b) => {
      if (!S.badges[b.id] && b.test()) {
        S.badges[b.id] = Date.now();
        save();
        toast(`<span class="t-ic">${b.icon}</span><div><b>Badge unlocked: ${b.name}</b><small>${b.desc}</small></div>`, 'badge');
        confetti();
      }
    });
  }

  /* ============================== XP + toasts ============================== */
  function addXP(n, label) {
    if (n <= 0) return;
    const before = levelOf(S.xp);
    S.xp += n;
    S.log.unshift({ t: Date.now(), label, n });
    S.log = S.log.slice(0, 25);
    save();
    toast(`<span class="t-ic">✨</span><div><b>+${n} XP</b><small>${esc(label)}</small></div>`);
    const after = levelOf(S.xp);
    if (after > before) {
      setTimeout(() => { toast(`<span class="t-ic">🚀</span><div><b>Level up! Level ${after + 1}</b><small>${LEVELS[after].name}</small></div>`, 'badge'); confetti(); }, 450);
    }
    updateChip();
    checkBadges();
  }

  let toastTimer;
  function toast(html, kind) {
    const box = $('#toasts');
    const t = document.createElement('div');
    t.className = 'toast ' + (kind || '');
    t.innerHTML = html;
    box.appendChild(t);
    requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 400); }, kind === 'badge' ? 4800 : 2800);
    while (box.children.length > 4) box.firstChild.remove();
    clearTimeout(toastTimer);
  }

  function updateChip() {
    const lv = levelOf(S.xp), cur = LEVELS[lv], nxt = LEVELS[lv + 1];
    const pct = nxt ? ((S.xp - cur.xp) / (nxt.xp - cur.xp)) * 100 : 100;
    $('#xpChip').innerHTML = `<span class="chip-lv">Lv ${lv + 1}</span><span class="chip-bar" aria-hidden="true"><i style="width:${pct}%"></i></span><span class="chip-xp">${S.xp} XP</span>`;
    $('#xpChip').setAttribute('aria-label', `Level ${lv + 1}, ${S.xp} experience points. Open dashboard.`);
  }

  /* ============================== Confetti ============================== */
  const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function confetti() {
    if (reduceMotion) return;
    const c = $('#confetti'), ctx = c.getContext('2d');
    c.width = innerWidth; c.height = innerHeight;
    const colors = ['#6c63ff', '#00bfa6', '#ff7a59', '#ffd23f', '#ff5d8f'];
    const ps = Array.from({ length: 90 }, () => ({ x: innerWidth / 2 + (Math.random() - .5) * 200, y: innerHeight * 0.35, vx: (Math.random() - .5) * 12, vy: Math.random() * -10 - 3, s: 4 + Math.random() * 6, c: colors[(Math.random() * colors.length) | 0], r: Math.random() * 6, vr: (Math.random() - .5) * .4 }));
    let f = 0;
    (function tick() {
      ctx.clearRect(0, 0, c.width, c.height);
      ps.forEach((p) => { p.x += p.vx; p.y += p.vy; p.vy += .28; p.r += p.vr; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * .6); ctx.restore(); });
      if (++f < 110) requestAnimationFrame(tick); else ctx.clearRect(0, 0, c.width, c.height);
    })();
  }

  /* ============================== Hero background ============================== */
  let heroRAF = 0;
  function heroNet() {
    cancelAnimationFrame(heroRAF);
    const c = $('#heroCanvas');
    if (!c) return;
    const ctx = c.getContext('2d');
    let W, H, nodes;
    const size = () => { const r = c.getBoundingClientRect(); W = c.width = r.width * devicePixelRatio; H = c.height = r.height * devicePixelRatio; nodes = Array.from({ length: Math.round(Math.min(60, r.width / 18)) }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .5 * devicePixelRatio, vy: (Math.random() - .5) * .5 * devicePixelRatio })); };
    size();
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const lim = 150 * devicePixelRatio;
      nodes.forEach((a, i) => {
        if (!reduceMotion) { a.x += a.vx; a.y += a.vy; if (a.x < 0 || a.x > W) a.vx *= -1; if (a.y < 0 || a.y > H) a.vy *= -1; }
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j], d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < lim) { ctx.strokeStyle = `rgba(160,170,255,${(1 - d / lim) * .5})`; ctx.lineWidth = devicePixelRatio; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
        }
        ctx.fillStyle = 'rgba(190,200,255,.85)'; ctx.beginPath(); ctx.arc(a.x, a.y, 2.2 * devicePixelRatio, 0, 7); ctx.fill();
      });
      if (!reduceMotion && document.body.contains(c)) heroRAF = requestAnimationFrame(draw);
    };
    draw();
  }

  /* ============================== Views ============================== */
  const ring = (pct, size = 120, label = '') => {
    const r = 46, c = 2 * Math.PI * r;
    return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 120 120" role="img" aria-label="${pct}% complete">
      <circle cx="60" cy="60" r="${r}" class="ring-bg"/>
      <circle cx="60" cy="60" r="${r}" class="ring-fg" stroke-dasharray="${(c * pct) / 100} ${c}" transform="rotate(-90 60 60)"/>
      <text x="60" y="58" text-anchor="middle" class="ring-t">${pct}%</text>
      <text x="60" y="76" text-anchor="middle" class="ring-s">${label}</text></svg>`;
  };

  const nextLesson = () => allLessons.find((l) => !S.lessons[l.id]);
  const modProgressHTML = (m) => {
    const d = lessonsDone(m), tot = m.lessons.length + 1, done = d + (quizPassed(m) ? 1 : 0);
    return `<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${tot}" aria-valuenow="${done}" aria-label="${m.title} progress"><i style="width:${(done / tot) * 100}%"></i></div>`;
  };

  function viewHome() {
    const nl = nextLesson();
    const started = stepsDone() > 0 || S.xp > 0;
    return `
    <section class="hero">
      <canvas id="heroCanvas" aria-hidden="true"></canvas>
      <div class="wrap hero-in">
        <p class="eyebrow">AI learning portal for grades 9–12</p>
        <h1>Understand AI.<br><span class="grad">Use it wisely.</span></h1>
        <p class="lead">Level up from AI-curious to AI-confident. Learn how AI works, master practical tools, and build the ethical habits that make you a smarter student, all through hands-on activities, quizzes, XP and badges.</p>
        <div class="hero-cta">
          ${nl ? `<a class="btn primary big" href="#/lesson/${nl.id}">${started ? '▶ Continue learning' : '🚀 Start learning'}</a>` : `<a class="btn primary big" href="#/dashboard">🎓 View your results</a>`}
          <a class="btn ghost big" href="#/modules">Browse modules</a>
          <a class="btn arcade big" href="#/arcade">🎮 Play Arcade Mode</a>
        </div>
        <ul class="hero-stats">
          <li><b>${MODULES.length}</b><span>Learning modules</span></li>
          <li><b>${allLessons.length}</b><span>Interactive lessons</span></li>
          <li><b>${BADGES.length}</b><span>Badges to earn</span></li>
          <li><b>${MAX_XP.toLocaleString()}</b><span>XP available</span></li>
        </ul>
      </div>
    </section>

    <section class="wrap sect">
      <h2 class="sect-h">Choose your path</h2>
      <p class="sect-p">Three modules take you from fundamentals to responsible use. Start anywhere.</p>
      <div class="grid3">${MODULES.map(moduleCard).join('')}</div>
    </section>

    <section class="wrap sect">
      <div class="cta-band arcade-band">
        <div><h2>🎮 New: Arcade Mode</h2><p>Answer 2 questions correctly, unlock 30 seconds of real arcade games (Star Catcher, Stack Tower, Snake Garden, Sky Hopper, Color Pop and Block Drop), then learn some more. Learn → Earn → Play → Repeat.</p></div>
        <a class="btn primary big" href="#/arcade">Play now</a>
      </div>
    </section>

    <section class="wrap sect">
      <h2 class="sect-h">How it works</h2>
      <div class="grid3 steps">
        <div class="step"><span class="step-n">1</span><h3>📖 Learn</h3><p>Short, clear lessons explain one big idea at a time, written for high school students.</p></div>
        <div class="step"><span class="step-n">2</span><h3>🎮 Play</h3><p>Every lesson has a hands-on activity: train a neuron, craft prompts, spot hallucinations, redact private data.</p></div>
        <div class="step"><span class="step-n">3</span><h3>🏅 Earn</h3><p>Collect XP, level up, unlock badges, keep a streak, and earn a certificate for completing everything.</p></div>
      </div>
    </section>

    <section class="wrap sect">
      <div class="cta-band">
        <div><h2>Ready to find out what you really know?</h2><p>Your progress saves automatically in this browser. No account, no sign-up, and no data leaves your device.</p></div>
        <a class="btn primary big" href="${nl ? '#/lesson/' + nl.id : '#/dashboard'}">${nl ? 'Begin your first lesson' : 'See your dashboard'}</a>
      </div>
    </section>`;
  }

  function moduleCard(m) {
    const d = lessonsDone(m);
    return `<a class="card mod" href="#/module/${m.id}" style="--mc:${m.color}">
      <span class="mod-ic" aria-hidden="true">${m.icon}</span>
      <h3>${m.title}</h3>
      <p>${m.blurb}</p>
      <div class="mod-meta"><span>${m.lessons.length} lessons · quiz</span><span>${d}/${m.lessons.length} done${quizPassed(m) ? ' · ✅ quiz' : ''}</span></div>
      ${modProgressHTML(m)}
      <span class="card-go">${moduleDone(m) ? 'Review module' : d ? 'Continue' : 'Start module'} →</span>
    </a>`;
  }

  function viewModules() {
    return `<div class="wrap sect"><h1 class="page-h">Learning modules</h1>
      <p class="sect-p">Each module has four lessons with interactive activities, plus a quiz to lock in your knowledge.</p>
      <div class="grid3">${MODULES.map(moduleCard).join('')}</div></div>`;
  }

  function viewModule(id) {
    const m = findModule(id);
    if (!m) return viewNotFound();
    const unlocked = lessonsDone(m) === m.lessons.length;
    const best = quizBest(m);
    return `<div class="wrap sect" style="--mc:${m.color}">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="#/modules">Modules</a> › <span>${m.title}</span></nav>
      <header class="mod-head"><span class="mod-ic big" aria-hidden="true">${m.icon}</span>
        <div><h1 class="page-h">${m.title}</h1><p class="sect-p">${m.blurb}</p></div></header>
      ${modProgressHTML(m)}
      <ol class="lesson-list">${m.lessons.map((l, i) => `
        <li><a class="lesson-row ${S.lessons[l.id] ? 'done' : ''}" href="#/lesson/${l.id}">
          <span class="lr-n">${S.lessons[l.id] ? '✓' : i + 1}</span>
          <span class="lr-t"><b>${l.title}</b><small>${l.minutes} min · interactive activity ${S.acts[l.id] ? '· ✅ done' : ''}</small></span>
          <span class="lr-go" aria-hidden="true">→</span></a></li>`).join('')}
        <li><a class="lesson-row quiz ${quizPassed(m) ? 'done' : ''} ${unlocked ? '' : 'locked'}" href="${unlocked ? '#/quiz/' + m.id : '#/module/' + m.id}" ${unlocked ? '' : 'aria-disabled="true"'}>
          <span class="lr-n">${quizPassed(m) ? '✓' : unlocked ? '★' : '🔒'}</span>
          <span class="lr-t"><b>Module quiz</b><small>${unlocked ? (best >= 0 ? `Best score: ${best}/${m.quiz.length}` : `${m.quiz.length} questions · up to ${m.quiz.length * XP_PER_QUIZ_POINT} XP`) : 'Finish all four lessons to unlock'}</small></span>
          <span class="lr-go" aria-hidden="true">→</span></a></li>
      </ol></div>`;
  }

  function viewLesson(id) {
    const l = findLesson(id);
    if (!l) return viewNotFound();
    const m = l.mod, idx = m.lessons.findIndex((x) => x.id === id);
    const done = !!S.lessons[id], actDone = !!S.acts[id];
    const prev = m.lessons[idx - 1], next = m.lessons[idx + 1];
    const nextHref = next ? `#/lesson/${next.id}` : `#/quiz/${m.id}`;
    const nextLabel = next ? `Next: ${next.title}` : 'Take the module quiz';
    return `<div class="wrap sect lesson-layout" style="--mc:${m.color}">
      <aside class="side" aria-label="Lessons in this module">
        <a class="side-mod" href="#/module/${m.id}">${m.icon} ${m.title}</a>
        <ol>${m.lessons.map((x, i) => `<li><a href="#/lesson/${x.id}" class="${x.id === id ? 'cur' : ''} ${S.lessons[x.id] ? 'done' : ''}" ${x.id === id ? 'aria-current="page"' : ''}><span>${S.lessons[x.id] ? '✓' : i + 1}</span>${x.title}</a></li>`).join('')}</ol>
      </aside>
      <article class="lesson">
        <nav class="crumbs" aria-label="Breadcrumb"><a href="#/modules">Modules</a> › <a href="#/module/${m.id}">${m.title}</a> › <span>Lesson ${idx + 1}</span></nav>
        <p class="eyebrow">Lesson ${idx + 1} of ${m.lessons.length} · ${l.minutes} min read</p>
        <h1 class="page-h">${l.title}</h1>
        <div class="prose">${l.body}</div>
        <div class="takeaways"><h3>🔑 Key takeaways</h3><ul>${l.takeaways.map((t) => `<li>${t}</li>`).join('')}</ul></div>
        <section class="activity" aria-labelledby="act-h">
          <div class="act-head"><h2 id="act-h">🎮 Try it: activity</h2><span class="pill ${actDone ? 'ok' : ''}" id="actPill">${actDone ? '✅ Completed' : `+${XP_ACTIVITY} XP`}</span></div>
          <div id="widget" class="widget"></div>
        </section>
        <div class="complete-row">
          <button class="btn primary big" id="completeBtn" ${done ? 'disabled' : actDone ? '' : 'disabled'}>${done ? '✓ Lesson complete' : actDone ? `Mark lesson complete (+${XP_LESSON} XP)` : 'Finish the activity to complete this lesson'}</button>
        </div>
        <div class="pager">
          ${prev ? `<a class="btn ghost" href="#/lesson/${prev.id}">← ${prev.title}</a>` : '<span></span>'}
          <a class="btn ${done ? 'primary' : 'ghost'}" id="nextBtn" href="${nextHref}">${nextLabel} →</a>
        </div>
      </article>
    </div>`;
  }

  function mountLesson(id) {
    const l = findLesson(id);
    const root = $('#widget');
    const make = WIDGETS[l.activity];
    if (!root || !make) return;
    make(root, {
      done(tag) {
        if (tag) { if (!S.flags[tag]) { S.flags[tag] = true; save(); checkBadges(); } }
        if (S.acts[id]) return;
        S.acts[id] = true; save();
        addXP(XP_ACTIVITY, `Activity: ${l.title}`);
        const pill = $('#actPill'); if (pill) { pill.textContent = '✅ Completed'; pill.classList.add('ok'); }
        const btn = $('#completeBtn');
        if (btn && !S.lessons[id]) { btn.disabled = false; btn.textContent = `Mark lesson complete (+${XP_LESSON} XP)`; }
      }
    });
    $('#completeBtn').onclick = () => {
      if (S.lessons[id] || !S.acts[id]) return;
      S.lessons[id] = Date.now(); save();
      addXP(XP_LESSON, `Completed: ${l.title}`);
      const btn = $('#completeBtn'); btn.disabled = true; btn.textContent = '✓ Lesson complete';
      const nb = $('#nextBtn'); nb.classList.remove('ghost'); nb.classList.add('primary');
      $$('.side a.cur').forEach((a) => { a.classList.add('done'); a.firstElementChild.textContent = '✓'; });
      confetti();
    };
  }

  /* ---------- Quiz ---------- */
  function viewQuiz(id) {
    const m = findModule(id);
    if (!m) return viewNotFound();
    if (lessonsDone(m) !== m.lessons.length) {
      return `<div class="wrap sect narrow"><h1 class="page-h">🔒 Quiz locked</h1><p class="sect-p">Complete all ${m.lessons.length} lessons in <b>${m.title}</b> to unlock this quiz.</p><a class="btn primary" href="#/module/${m.id}">Back to module</a></div>`;
    }
    return `<div class="wrap sect narrow" style="--mc:${m.color}"><nav class="crumbs"><a href="#/module/${m.id}">${m.title}</a> › <span>Quiz</span></nav><h1 class="page-h">${m.icon} ${m.title} quiz</h1><div id="quiz" class="quiz"></div></div>`;
  }

  function mountQuiz(id) {
    const m = findModule(id), root = $('#quiz');
    if (!m || !root) return;
    let i = 0, score = 0;
    const N = m.quiz.length;
    function q() {
      if (i >= N) return end();
      const it = m.quiz[i];
      root.innerHTML = `
        <div class="bar" aria-hidden="true"><i style="width:${(i / N) * 100}%"></i></div>
        <p class="eyebrow">Question ${i + 1} of ${N}</p>
        <h2 class="q-text" id="qt">${it.q}</h2>
        <div class="q-opts" role="radiogroup" aria-labelledby="qt">${it.options.map((o, k) => `<button class="q-opt" role="radio" aria-checked="false" data-k="${k}"><span class="q-l">${'ABCD'[k]}</span>${esc(o)}</button>`).join('')}</div>
        <div class="q-fb" role="status"></div>`;
      $$('.q-opt', root).forEach((b) => {
        b.onclick = () => {
          const k = +b.dataset.k, ok = k === it.answer;
          if (ok) score++;
          $$('.q-opt', root).forEach((x) => { x.disabled = true; if (+x.dataset.k === it.answer) x.classList.add('right'); });
          if (!ok) b.classList.add('wrong');
          b.setAttribute('aria-checked', 'true');
          const fb = $('.q-fb', root);
          fb.className = 'q-fb show ' + (ok ? 'good' : 'bad');
          fb.innerHTML = `<b>${ok ? '✅ Correct!' : '❌ Not quite.'}</b> ${it.explain}<div><button class="btn primary" id="qNext">${i + 1 === N ? 'See results' : 'Next question'} →</button></div>`;
          const nb = $('#qNext'); nb.focus(); nb.onclick = () => { i++; q(); };
        };
      });
    }
    function end() {
      const prevBest = quizBest(m);
      const gain = Math.max(0, score - Math.max(prevBest, 0)) * XP_PER_QUIZ_POINT;
      S.quiz[m.id] = { best: Math.max(prevBest, score), last: score };
      save();
      const passed = score >= PASS_SCORE;
      root.innerHTML = `
        <div class="results">
          <div class="big-score ${passed ? 'ok' : ''}" aria-hidden="true">${score}/${N}</div>
          <h2>${score === N ? 'Perfect score! 🎯' : passed ? 'Quiz passed! 🎉' : 'Almost there!'}</h2>
          <p>${passed ? `You've proven your knowledge of <b>${m.title}</b>.` : `You need at least ${PASS_SCORE}/${N} to pass. Review the lessons and try again.`}
          ${gain ? `<br><b>+${gain} XP</b> earned.` : prevBest >= 0 ? '<br>Beat your best score to earn more XP.' : ''}</p>
          <div class="btn-row center">
            <button class="btn ghost" id="retry">↻ Retry quiz</button>
            ${passed ? `<a class="btn primary" href="${nextAfterModule(m)}">${allDone() ? '🎓 Get your certificate' : 'Continue →'}</a>` : `<a class="btn primary" href="#/module/${m.id}">Review lessons</a>`}
          </div>
        </div>`;
      $('#retry').onclick = () => { i = 0; score = 0; q(); };
      if (gain) addXP(gain, `Quiz: ${m.title} (${score}/${N})`);
      if (passed) { confetti(); checkBadges(); }
    }
    q();
  }
  function nextAfterModule(m) {
    if (allDone()) return '#/certificate';
    const idx = MODULES.indexOf(m);
    const nxt = MODULES.slice(idx + 1).concat(MODULES.slice(0, idx)).find((x) => !moduleDone(x));
    return nxt ? '#/module/' + nxt.id : '#/dashboard';
  }

  /* ---------- Dashboard ---------- */
  function viewDashboard() {
    const lv = levelOf(S.xp), cur = LEVELS[lv], nxt = LEVELS[lv + 1];
    const pct = nxt ? Math.round(((S.xp - cur.xp) / (nxt.xp - cur.xp)) * 100) : 100;
    const earned = BADGES.filter((b) => S.badges[b.id]).length;
    return `<div class="wrap sect">
      <h1 class="page-h">Your dashboard</h1>
      <div class="dash-top">
        <div class="card dcard player">
          <label class="namebox">Your name <input id="nameIn" maxlength="40" placeholder="Enter your name" value="${esc(S.name)}"></label>
          <div class="lvl"><div class="lvl-badge" aria-hidden="true">${lv + 1}</div><div><b>Level ${lv + 1}: ${cur.name}</b><small>${S.xp} XP total</small></div></div>
          <div class="bar thick" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Progress to next level"><i style="width:${pct}%"></i></div>
          <small class="muted">${nxt ? `${nxt.xp - S.xp} XP to Level ${lv + 2} (${nxt.name})` : 'Max level reached. You are an AI Sage!'}</small>
        </div>
        <div class="card dcard center">${ring(pctDone(), 130, 'complete')}<small class="muted">${stepsDone()} of ${totalSteps} steps</small></div>
        <div class="card dcard stats">
          <div><b>🔥 ${S.streak.count}</b><span>day streak</span></div>
          <div><b>🏅 ${earned}/${BADGES.length}</b><span>badges</span></div>
          <div><b>✅ ${Object.keys(S.acts).length}/${allLessons.length}</b><span>activities</span></div>
        </div>
      </div>

      <h2 class="sect-h">Module progress</h2>
      <div class="grid3">${MODULES.map((m) => `
        <a class="card mod" href="#/module/${m.id}" style="--mc:${m.color}"><span class="mod-ic" aria-hidden="true">${m.icon}</span><h3>${m.title}</h3>
          <div class="mod-meta"><span>Lessons ${lessonsDone(m)}/${m.lessons.length}</span><span>Quiz ${quizBest(m) >= 0 ? quizBest(m) + '/' + m.quiz.length : '—'}${quizPassed(m) ? ' ✅' : ''}</span></div>
          ${modProgressHTML(m)}</a>`).join('')}</div>

      <h2 class="sect-h">Badges</h2>
      <div class="badges">${BADGES.map((b) => {
        const got = S.badges[b.id];
        return `<div class="badge ${got ? 'got' : ''}" title="${esc(b.desc)}"><span class="b-ic" aria-hidden="true">${got ? b.icon : '🔒'}</span><b>${b.name}</b><small>${b.desc}</small><span class="sr">${got ? 'Unlocked' : 'Locked'}</span></div>`;
      }).join('')}</div>

      ${allDone() ? `<div class="cta-band"><div><h2>🎓 You completed AI Quest!</h2><p>Download your certificate of completion.</p></div><a class="btn primary big" href="#/certificate">View certificate</a></div>` : ''}

      <h2 class="sect-h">Recent activity</h2>
      ${S.log.length ? `<ul class="log">${S.log.slice(0, 8).map((e) => `<li><b>+${e.n} XP</b> ${esc(e.label)}<time>${new Date(e.t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time></li>`).join('')}</ul>` : '<p class="muted">Nothing yet. <a href="#/modules">Start a lesson</a> to earn your first XP.</p>'}

      <div class="danger"><button class="btn ghost small" id="resetBtn">Reset all progress</button></div>
    </div>`;
  }

  function mountDashboard() {
    const n = $('#nameIn');
    if (n) n.oninput = () => { S.name = n.value.trim(); save(); };
    const r = $('#resetBtn');
    if (r) r.onclick = () => {
      if (confirm('Reset ALL progress, XP and badges? This cannot be undone.')) {
        const theme = S.theme; store.clear(); S = fresh(); S.theme = theme; S.streak = { count: 1, last: dayStr(new Date()) }; S.best = 1; save(); updateChip(); render();
      }
    };
  }

  /* ---------- Certificate ---------- */
  function viewCertificate() {
    if (!allDone()) return `<div class="wrap sect narrow"><h1 class="page-h">🔒 Certificate locked</h1><p class="sect-p">Complete every lesson and pass every quiz to earn your certificate. You're ${pctDone()}% there.</p><a class="btn primary" href="#/dashboard">Back to dashboard</a></div>`;
    const date = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    return `<div class="wrap sect narrow">
      <div class="cert-actions no-print"><label class="namebox">Name on certificate <input id="certName" maxlength="40" value="${esc(S.name)}" placeholder="Your name"></label><button class="btn primary" id="printBtn">🖨️ Print / Save as PDF</button></div>
      <div class="cert" id="cert">
        <div class="cert-in">
          <p class="cert-k">AI Quest · Certificate of Completion</p>
          <p>This certifies that</p>
          <h2 id="certNameOut">${esc(S.name || 'Your Name')}</h2>
          <p>has completed all modules of the AI learning portal, covering <b>AI Foundations</b>, <b>AI Tools &amp; Techniques</b>, and <b>Ethical AI Use</b>, earning <b>${S.xp} XP</b> and <b>${Object.keys(S.badges).length} badges</b>.</p>
          <div class="cert-foot"><span>${date}</span><span class="cert-seal" aria-hidden="true">🎓</span><span>Level ${levelOf(S.xp) + 1} · ${LEVELS[levelOf(S.xp)].name}</span></div>
        </div></div></div>`;
  }
  function mountCertificate() {
    const i = $('#certName');
    if (i) i.oninput = () => { S.name = i.value.trim(); save(); $('#certNameOut').textContent = S.name || 'Your Name'; };
    const p = $('#printBtn'); if (p) p.onclick = () => window.print();
  }

  /* ---------- Glossary ---------- */
  function viewGlossary() {
    return `<div class="wrap sect narrow"><h1 class="page-h">AI glossary</h1><p class="sect-p">Quick definitions for the key terms you'll meet in the lessons.</p>
      <label class="sr" for="gq">Search glossary</label><input id="gq" class="search" type="search" placeholder="Search terms…" autocomplete="off">
      <dl class="gloss" id="gl"></dl></div>`;
  }
  function mountGlossary() {
    const gl = $('#gl'), gq = $('#gq');
    const draw = () => {
      const q = gq.value.toLowerCase().trim();
      const rows = GLOSSARY.filter(([t, d]) => !q || t.toLowerCase().includes(q) || d.toLowerCase().includes(q));
      gl.innerHTML = rows.length ? rows.map(([t, d]) => `<div><dt>${t}</dt><dd>${d}</dd></div>`).join('') : '<p class="muted">No matching terms.</p>';
    };
    gq.oninput = draw; draw();
  }

  function viewNotFound() {
    return `<div class="wrap sect narrow"><h1 class="page-h">Page not found</h1><p class="sect-p">That page doesn't exist.</p><a class="btn primary" href="#/home">Go home</a></div>`;
  }

  /* ============================== Router ============================== */
  const TITLE = 'AI Quest: Learn AI, Use It Wisely';
  function render() {
    const parts = (location.hash.replace(/^#\/?/, '') || 'home').split('/');
    const [r, id] = parts;
    let html, mount, title = TITLE, nav = r;
    switch (r) {
      case 'home': html = viewHome(); mount = heroNet; break;
      case 'modules': html = viewModules(); title = 'Modules · ' + TITLE; break;
      case 'module': html = viewModule(id); title = (findModule(id) || {}).title + ' · ' + TITLE; nav = 'modules'; break;
      case 'lesson': html = viewLesson(id); mount = () => mountLesson(id); title = ((findLesson(id) || {}).title || 'Lesson') + ' · ' + TITLE; nav = 'modules'; break;
      case 'quiz': html = viewQuiz(id); mount = () => mountQuiz(id); title = 'Quiz · ' + TITLE; nav = 'modules'; break;
      case 'dashboard': html = viewDashboard(); mount = mountDashboard; title = 'Dashboard · ' + TITLE; break;
      case 'certificate': html = viewCertificate(); mount = mountCertificate; title = 'Certificate · ' + TITLE; nav = 'dashboard'; break;
      case 'arcade': html = '<div id="arcadeRoot"></div>'; mount = () => window.AIQ_ARCADE.mount($('#arcadeRoot')); title = 'Arcade · ' + TITLE; break;
      case 'glossary': html = viewGlossary(); mount = mountGlossary; title = 'Glossary · ' + TITLE; break;
      default: html = viewNotFound(); nav = '';
    }
    cancelAnimationFrame(heroRAF);
    window.AIQ_ARCADE.unmount();
    app.innerHTML = html;
    document.title = title;
    $$('.nav a').forEach((a) => { const on = a.dataset.nav === nav; a.classList.toggle('on', on); on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); });
    $('#nav').classList.remove('open'); $('#navBtn').setAttribute('aria-expanded', 'false');
    if (mount) mount();
    window.scrollTo(0, 0);
    app.focus({ preventScroll: true });
  }
  window.addEventListener('hashchange', render);

  /* ============================== Chrome ============================== */
  function setTheme(t) {
    if (t) document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme');
    const dark = t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    $('#themeBtn').textContent = dark ? '☀️' : '🌙';
    $('#themeBtn').setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  }
  $('#themeBtn').onclick = () => {
    const dark = document.documentElement.getAttribute('data-theme') ? document.documentElement.getAttribute('data-theme') === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    S.theme = dark ? 'light' : 'dark'; save(); setTheme(S.theme);
  };
  $('#navBtn').onclick = () => { const o = $('#nav').classList.toggle('open'); $('#navBtn').setAttribute('aria-expanded', o); };
  $('#yr').textContent = new Date().getFullYear();

  window.AIQ_APP = { confetti, toast };
  setTheme(S.theme);
  updateChip();
  checkBadges();
  render();
})();
