/* AI Quest Arcade — learn → earn → play loop, adaptive questions, unlocks, achievements. */
window.AIQ_ARCADE = (function () {
  'use strict';
  const { CONCEPTS, Q } = window.AIQ_QUESTIONS;
  const { GAMES, Sound } = window.AIQ_GAMES;
  const KEY = 'ai-quest-arcade-v1';
  const NEED = 2; // correct answers per arcade session
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  /* ----- unlock tables ----- */
  const GAME_NEED = { star: 0, stack: 0, snake: 1, hopper: 2, pop: 3, blocks: 4 }; // sessions played
  const THEMES = [
    { id: 'candy', name: 'Candy Sky', bg: ['#6c63ff', '#00b8a9'], accent: '#8b84ff', need: 0 },
    { id: 'sunset', name: 'Sunset Pop', bg: ['#ff7a59', '#7a3bd6'], accent: '#ff9a4d', need: 300 },
    { id: 'ocean', name: 'Deep Ocean', bg: ['#0b84d6', '#0a2a6b'], accent: '#4cc9f0', need: 800 },
    { id: 'forest', name: 'Mint Forest', bg: ['#2fbf71', '#0d5c63'], accent: '#8ac926', need: 1500 },
    { id: 'neon', name: 'Neon Night', bg: ['#2a0f5c', '#0b0b2b'], accent: '#ff4fd8', need: 2500 },
    { id: 'cotton', name: 'Cotton Candy', bg: ['#ff9ad5', '#9ad0ff'], accent: '#ff5d8f', need: 4000 }
  ];
  const ACH = [
    { id: 'first', i: '✨', n: 'First Spark', d: 'Answer your first question correctly.', t: (s) => s.correct >= 1 },
    { id: 'rookie', i: '🎮', n: 'Arcade Rookie', d: 'Play your first arcade session.', t: (s) => s.sessions >= 1 },
    { id: 'streak', i: '🔥', n: 'Hot Streak', d: 'Get 5 correct answers in a row.', t: (s) => s.bestStreak >= 5 },
    { id: 'comeback', i: '💪', n: 'Comeback Kid', d: 'Correctly answer a question you missed before.', t: (s) => s.reviewed >= 1 },
    { id: 'brain', i: '🧠', n: 'Brainiac', d: 'Answer 25 questions correctly.', t: (s) => s.correct >= 25 },
    { id: 'roller', i: '💎', n: 'High Roller', d: 'Score 400+ in a single game.', t: (s) => s.topScore >= 400 },
    { id: 'combo', i: '⚡', n: 'Combo King', d: 'Reach a 10x combo in one game.', t: (s) => s.bestCombo >= 10 },
    { id: 'collector', i: '🗝️', n: 'Collector', d: 'Unlock every mini-game.', t: (s) => s.sessions >= 4 },
    { id: 'all', i: '🎯', n: 'All-Rounder', d: 'Play every mini-game at least once.', t: (s) => GAMES.every((g) => s.best[g.id] !== undefined) },
    { id: 'stylist', i: '🎨', n: 'Stylist', d: 'Unlock 3 themes.', t: (s) => THEMES.filter((t) => s.points >= t.need).length >= 3 }
  ];

  /* ----- state ----- */
  const fresh = () => ({ pending: 0, owed: 0, correct: 0, wrong: 0, streak: 0, bestStreak: 0, n: 0, sessions: 0, points: 0, best: {}, bestCombo: 0, topScore: 0, seen: {}, weak: {}, review: [], recent: [], reviewed: 0, theme: 'candy', sound: true, ach: {}, lastGame: '', lastConcept: '', lastId: '', cur: null });
  let S, root, modal, cur = null, answered = false, running = null;
  const mem = {};
  function load() { try { S = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY) || mem[KEY] || '{}')); } catch (_) { S = fresh(); } Sound.on = S.sound; }
  function save() { const j = JSON.stringify(S); try { localStorage.setItem(KEY, j); } catch (_) { mem[KEY] = j; } }
  const themeOf = (id) => THEMES.find((t) => t.id === id) || THEMES[0];
  const unlockedGame = (g) => S.sessions >= GAME_NEED[g.id];
  const unlockedTheme = (t) => S.points >= t.need;

  /* ----- adaptive question selection ----- */
  function accuracy() { const r = S.recent.slice(-6); return r.length ? r.filter(Boolean).length / r.length : .6; }
  function nextQuestion() {
    let q = null, review = false;
    const due = S.review.find((r) => r.due <= S.n);
    if (due) {
      S.review = S.review.filter((r) => r !== due);
      const sameC = Q.filter((x) => x.c === due.c && x.id !== S.lastId);
      const fresher = sameC.filter((x) => x.id !== due.id && (S.seen[x.id] || 0) <= Math.min(...sameC.map((y) => S.seen[y.id] || 0)) + 0);
      const pool = fresher.length ? fresher : sameC.filter((x) => x.id !== due.id);
      q = pool.length ? pick(pool) : Q.find((x) => x.id === due.id); review = true;
    }
    if (!q) {
      const acc = accuracy(), target = S.n < 4 ? 1 : acc >= .8 ? 3 : acc >= .5 ? 2 : 1;
      let pool = Q.filter((x) => x.id !== S.lastId && x.c !== S.lastConcept);
      const minSeen = Math.min(...pool.map((x) => S.seen[x.id] || 0));
      pool = pool.filter((x) => (S.seen[x.id] || 0) === minSeen);
      const w = pool.map((x) => (1 + (S.weak[x.c] || 0) * 1.5) / (1 + Math.abs(x.d - target) * 1.4));
      let r = Math.random() * w.reduce((a, b) => a + b, 0); q = pool[pool.length - 1];
      for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) { q = pool[i]; break; } }
    }
    const order = [0, 1, 2, 3].sort(() => Math.random() - .5);
    return { id: q.id, review, order };
  }
  const qOf = (id) => Q.find((x) => x.id === id);

  /* ----- confetti hook from the main app ----- */
  const confetti = () => { try { window.AIQ_APP && window.AIQ_APP.confetti(); } catch (_) { /* ignore */ } };

  /* ----- achievements ----- */
  function checkAch() {
    const fresh = [];
    ACH.forEach((a) => { if (!S.ach[a.id] && a.t(S)) { S.ach[a.id] = Date.now(); fresh.push(a); } });
    if (fresh.length) save();
    return fresh;
  }
  const achToast = (list) => list.forEach((a, i) => setTimeout(() => window.AIQ_APP && window.AIQ_APP.toast(`<span class="t-ic">${a.i}</span><div><b>Achievement: ${a.n}</b><small>${a.d}</small></div>`, 'badge'), 300 + i * 600));

  /* ====================== RENDER ====================== */
  function mount(el) {
    root = el; load();
    root.innerHTML = `
      <div class="wrap sect ax">
        <header class="ax-head">
          <div><p class="eyebrow">Arcade mode</p><h1 class="page-h">Learn → Earn → <span class="grad2">Play</span> → Repeat</h1>
          <p class="sect-p">Answer 2 questions correctly to unlock 30 seconds of real arcade fun. Questions come from the AI Foundations, Tools &amp; Ethics modules and adapt to you.</p></div>
          <div class="ax-tools"><button class="btn small ghost" id="axSound" aria-pressed="${S.sound}"></button></div>
        </header>
        <div class="ax-layout">
          <section class="ax-main" aria-live="polite">
            <div class="ax-meter" id="axMeter"></div>
            <div class="ax-card" id="axCard"></div>
          </section>
          <aside class="ax-side" id="axSide" aria-label="Arcade locker"></aside>
        </div>
      </div>`;
    root.querySelector('#axSound').onclick = () => { S.sound = !S.sound; Sound.on = S.sound; save(); paintSound(); if (S.sound) Sound.play('pop'); };
    paintSound(); paintMeter(); paintSide();
    if (S.owed > 0) showUnlock(); else showQuestion();
    document.addEventListener('keydown', onKey);
  }
  function unmount() {
    document.removeEventListener('keydown', onKey);
    if (running) { running.destroy(); running = null; }
    closeModal(); root = null;
  }
  function paintSound() { const b = root.querySelector('#axSound'); b.textContent = S.sound ? '🔊 Sound on' : '🔇 Sound off'; b.setAttribute('aria-pressed', S.sound); }

  function paintMeter() {
    const el = root.querySelector('#axMeter'), left = NEED - S.pending;
    el.innerHTML = `
      <div class="ax-pips" aria-hidden="true">${Array.from({ length: NEED }, (_, i) => `<span class="pip ${i < S.pending ? 'on' : ''}">${i < S.pending ? '★' : ''}</span>`).join('')}<span class="pip-game">🎮</span></div>
      <div class="ax-meter-t"><b>${S.pending}/${NEED} correct answers until Arcade Time!</b><small>${left === 1 ? 'One more to go!' : 'Answers don\'t need to be in a row.'}</small></div>
      <div class="ax-stats"><span title="Current streak">🔥 ${S.streak}</span><span title="Arcade points">⭐ ${S.points}</span></div>`;
  }

  function paintSide() {
    const el = root.querySelector('#axSide'), th = themeOf(S.theme), nextT = THEMES.find((t) => S.points < t.need);
    const weak = Object.entries(S.weak).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 4);
    el.innerHTML = `
      <div class="card ax-box"><h3>🕹️ Mini-games</h3><ul class="ax-games">${GAMES.map((g) => {
        const ok = unlockedGame(g), need = GAME_NEED[g.id] - S.sessions;
        return `<li class="${ok ? '' : 'lock'}"><span class="gi">${ok ? g.icon : '🔒'}</span><span class="gt"><b>${g.name}</b><small>${ok ? (S.best[g.id] !== undefined ? 'Best: ' + S.best[g.id] : 'Not played yet') : `Play ${need} more session${need === 1 ? '' : 's'} to unlock`}</small></span></li>`;
      }).join('')}</ul></div>
      <div class="card ax-box"><h3>🎨 Themes</h3><div class="ax-themes">${THEMES.map((t) => {
        const ok = unlockedTheme(t);
        return `<button class="swatch ${t.id === S.theme ? 'on' : ''}" data-theme="${t.id}" ${ok ? '' : 'disabled'} style="background:linear-gradient(135deg,${t.bg[0]},${t.bg[1]})" aria-label="${t.name}${ok ? '' : ', locked: ' + t.need + ' points'}" title="${t.name}${ok ? '' : ' · ' + t.need + ' pts'}">${ok ? (t.id === S.theme ? '✓' : '') : '🔒'}</button>`;
      }).join('')}</div><small class="muted">${nextT ? `Next theme at ${nextT.need} pts (${nextT.need - S.points} to go)` : 'All themes unlocked!'} · Using <b>${th.name}</b></small></div>
      <div class="card ax-box"><h3>🏅 Achievements <small>${Object.keys(S.ach).length}/${ACH.length}</small></h3><div class="ax-ach">${ACH.map((a) => `<span class="ach ${S.ach[a.id] ? 'got' : ''}" title="${esc(a.n)}: ${esc(a.d)}"><i>${S.ach[a.id] ? a.i : '🔒'}</i></span>`).join('')}</div></div>
      <div class="card ax-box"><h3>📚 Concepts to review</h3>${weak.length ? `<ul class="ax-weak">${weak.map(([c, v]) => `<li><b>${CONCEPTS[c].label}</b><small>${CONCEPTS[c].mod}</small><span class="miss">${'●'.repeat(Math.min(v, 4))}</span></li>`).join('')}</ul><small class="muted">These will come back for review soon.</small>` : '<p class="muted ax-nowk">No weak spots yet. Keep going!</p>'}
        <div class="ax-acc"><span>✅ ${S.correct} correct</span><span>❌ ${S.wrong} missed</span><span>🏆 Best streak ${S.bestStreak}</span></div></div>`;
    el.querySelectorAll('[data-theme]').forEach((b) => { b.onclick = () => { S.theme = b.dataset.theme; save(); paintSide(); }; });
  }

  /* ----- question card ----- */
  function showQuestion() {
    cur = nextQuestion(); answered = false;
    const q = qOf(cur.id), el = root.querySelector('#axCard'), cc = CONCEPTS[q.c];
    el.className = 'ax-card enter';
    el.innerHTML = `
      <div class="ax-qtop"><span class="chip-c">${cc.label}</span>${cur.review ? '<span class="chip-r">🔁 Review</span>' : ''}<span class="dots" title="Difficulty">${[1, 2, 3].map((i) => `<i class="${i <= q.d ? 'on' : ''}"></i>`).join('')}</span></div>
      <h2 class="ax-q" id="axQ">${esc(q.q)}</h2>
      <div class="ax-opts" role="group" aria-labelledby="axQ">${cur.order.map((oi, k) => `<button class="ax-opt" data-k="${oi}"><span class="q-l">${'ABCD'[k]}</span><span>${esc(q.o[oi])}</span></button>`).join('')}</div>
      <div class="ax-fb" id="axFb" role="status"></div>`;
    el.querySelectorAll('.ax-opt').forEach((b) => (b.onclick = () => answer(+b.dataset.k)));
    setTimeout(() => el.classList.remove('enter'), 400);
  }
  function answer(k) {
    if (answered) return; answered = true;
    const q = qOf(cur.id), ok = k === q.a, el = root.querySelector('#axCard');
    S.n++; S.seen[q.id] = (S.seen[q.id] || 0) + 1; S.lastId = q.id; S.lastConcept = q.c; S.recent.push(ok); S.recent = S.recent.slice(-10);
    let earned = false;
    if (ok) {
      S.correct++; S.streak++; S.bestStreak = Math.max(S.bestStreak, S.streak); S.weak[q.c] = Math.max(0, (S.weak[q.c] || 0) - 1); if (cur.review) S.reviewed++;
      S.pending++; if (S.pending >= NEED) { S.pending = 0; S.owed++; earned = true; }
      Sound.play('good');
    } else {
      S.wrong++; S.streak = 0; S.weak[q.c] = (S.weak[q.c] || 0) + 1; S.review.push({ id: q.id, c: q.c, due: S.n + 3 + Math.floor(Math.random() * 3) });
      Sound.play('bad');
    }
    save();
    el.querySelectorAll('.ax-opt').forEach((b) => { b.disabled = true; const i = +b.dataset.k; if (i === q.a) b.classList.add('right'); if (i === k && !ok) b.classList.add('wrong'); });
    const fb = el.querySelector('#axFb');
    fb.className = 'ax-fb show ' + (ok ? 'good' : 'bad');
    fb.innerHTML = `<b>${ok ? pick(['✅ Correct!', '✅ Nailed it!', '✅ Yes!']) : '❌ Not quite.'}</b> ${esc(q.e)}
      ${ok ? '' : `<div class="ax-note">Your progress is safe. We'll bring this concept back later for review. 🔁</div>`}
      <button class="btn primary" id="axNext">${earned ? '🎮 Unlock arcade!' : 'Next question'} →</button>`;
    const nb = el.querySelector('#axNext'); nb.focus(); nb.onclick = () => (earned ? showUnlock() : showQuestion());
    paintMeter(); paintSide(); if (ok && S.pending === 1) root.querySelector('.pip.on')?.classList.add('pop');
    if (earned) { root.querySelectorAll('.pip').forEach((p) => p.classList.add('pop')); confetti(); }
    const a = checkAch(); if (a.length) { achToast(a); paintSide(); }
  }

  /* ----- modal helpers ----- */
  function openModal(html, cls) {
    closeModal(); modal = document.createElement('div'); modal.className = 'ax-modal ' + (cls || '');
    modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.innerHTML = `<div class="ax-modal-in">${html}</div>`;
    document.body.appendChild(modal); document.body.classList.add('gm-lock'); requestAnimationFrame(() => modal && modal.classList.add('in'));
    return modal;
  }
  function closeModal() { if (modal) { modal.remove(); modal = null; if (!running) document.body.classList.remove('gm-lock'); } }

  /* ----- Arcade Unlocked ----- */
  function showUnlock() {
    Sound.play('win'); confetti();
    const th = themeOf(S.theme);
    const m = openModal(`
      <div class="unlock-head"><div class="unlock-ico" aria-hidden="true">🎮</div><h2>Arcade Unlocked!</h2><p>You earned <b>30 seconds</b> of play${S.owed > 1 ? ` <span class="pill">${S.owed} sessions banked</span>` : ''}. Pick a game:</p></div>
      <div class="pick-grid">${GAMES.map((g) => {
        const ok = unlockedGame(g), need = GAME_NEED[g.id] - S.sessions;
        return `<button class="pick ${ok ? '' : 'lock'}" data-g="${g.id}" ${ok ? '' : 'disabled'}><span class="pi">${ok ? g.icon : '🔒'}</span><b>${g.name}</b><small>${ok ? g.blurb : `Unlocks after ${need} more session${need === 1 ? '' : 's'}`}</small>${ok && S.best[g.id] !== undefined ? `<em>Best ${S.best[g.id]}</em>` : ''}</button>`;
      }).join('')}</div>
      <div class="btn-row center"><button class="btn primary big" id="axSurprise">🎲 Surprise me</button></div>`, 'unlock');
    m.style.setProperty('--ac', th.accent);
    m.querySelectorAll('[data-g]').forEach((b) => (b.onclick = () => startGame(b.dataset.g)));
    m.querySelector('#axSurprise').onclick = () => { const opts = GAMES.filter(unlockedGame), pool = opts.filter((g) => g.id !== S.lastGame); startGame(pick(pool.length ? pool : opts).id); };
    (m.querySelector('#axSurprise')).focus();
  }

  /* ----- run a game ----- */
  function startGame(id) {
    const def = GAMES.find((g) => g.id === id); if (!def || !unlockedGame(def)) return;
    S.owed = Math.max(0, S.owed - 1); S.lastGame = id; save();
    closeModal(); document.body.classList.add('gm-lock');
    running = window.AIQ_GAMES.play(def, themeOf(S.theme), (res) => { running = null; finishGame(def, res); });
  }
  function finishGame(def, res) {
    const prevBest = S.best[def.id], newBest = prevBest === undefined || res.score > prevBest;
    const beforeGames = GAMES.filter(unlockedGame).map((g) => g.id), beforeThemes = THEMES.filter(unlockedTheme).map((t) => t.id);
    S.sessions++; S.points += res.score; if (newBest) S.best[def.id] = res.score; S.bestCombo = Math.max(S.bestCombo, res.maxCombo); S.topScore = Math.max(S.topScore, res.score); save();
    const newGames = GAMES.filter((g) => unlockedGame(g) && !beforeGames.includes(g.id)), newThemes = THEMES.filter((t) => unlockedTheme(t) && !beforeThemes.includes(t.id));
    const ach = checkAch();
    const nextT = THEMES.find((t) => S.points < t.need);
    const stat = def.id === 'stack' ? `Tower height ${res.extra || 0}` : def.id === 'hopper' ? `Climbed ${res.extra} m` : def.id === 'blocks' ? `${res.extra || 0} lines cleared` : '';
    const m = openModal(`
      <div class="res-head"><div class="unlock-ico" aria-hidden="true">${def.icon}</div><h2>${def.name}</h2><p class="muted">Time's up!</p></div>
      <div class="res-score" id="resScore">0</div>
      <div class="res-row"><span>🔥 Max combo <b>${res.maxCombo}</b></span>${stat ? `<span>${stat}</span>` : ''}<span>⭐ Total <b>${S.points}</b></span></div>
      ${newBest ? '<div class="res-best">🏆 New personal best!</div>' : `<div class="res-best soft">Personal best: ${S.best[def.id]}</div>`}
      ${newGames.length ? `<div class="res-unl">🔓 New game unlocked: <b>${newGames.map((g) => g.icon + ' ' + g.name).join(', ')}</b></div>` : ''}
      ${newThemes.length ? `<div class="res-unl">🎨 New theme unlocked: <b>${newThemes.map((t) => t.name).join(', ')}</b></div>` : ''}
      ${ach.length ? `<div class="res-unl">🏅 ${ach.map((a) => a.i + ' ' + a.n).join(' · ')}</div>` : ''}
      ${nextT ? `<div class="res-prog"><div class="bar"><i style="width:${Math.min(100, (S.points / nextT.need) * 100)}%"></i></div><small>${nextT.need - S.points} pts to unlock <b>${nextT.name}</b> theme</small></div>` : ''}
      <div class="btn-row center">${S.owed > 0 ? '<button class="btn primary big" id="axAgain">🎮 Play another (banked)</button>' : '<button class="btn primary big" id="axBack">📚 Back to learning</button>'}</div>`, 'result');
    m.style.setProperty('--ac', themeOf(S.theme).accent);
    // count-up
    const el = m.querySelector('#resScore'), t0 = performance.now(), dur = 900;
    (function tick(n) { const k = Math.min(1, (n - t0) / dur); el.textContent = Math.round(res.score * (1 - Math.pow(1 - k, 3))); if (k < 1 && modal) requestAnimationFrame(tick); })(t0);
    if (newBest || newGames.length || newThemes.length) confetti();
    achToast(ach);
    const back = () => { closeModal(); if (!root) return; paintMeter(); paintSide(); showQuestion(); };
    const b = m.querySelector('#axBack'); if (b) { b.onclick = back; b.focus(); }
    const a = m.querySelector('#axAgain'); if (a) { a.onclick = () => { closeModal(); showUnlock(); }; a.focus(); }
  }

  /* number keys 1-4 answer, Enter = continue */
  function onKey(e) {
    if (!root || running || modal || answered === undefined) return;
    if (/^[1-4]$/.test(e.key) && !answered) { const btn = root.querySelectorAll('.ax-opt')[+e.key - 1]; if (btn) btn.click(); }
  }

  return { mount, unmount };
})();
