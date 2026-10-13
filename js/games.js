/* AI Quest Arcade — game engine + six 30-second mini-games.
   Every game is a real-time canvas game with keyboard AND touch controls. */
window.AIQ_GAMES = (function () {
  'use strict';
  const W = 480, H = 640, TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const ri = (a, b) => Math.floor(rnd(a, b + 1));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const pick = (a) => a[ri(0, a.length - 1)];
  const PAL = ['#ff5d8f', '#ffb703', '#2ee6c8', '#7a6bff', '#4cc9f0', '#8ac926'];

  /* ------------------------------ Sound ------------------------------ */
  const Sound = {
    on: true, ctx: null,
    tone(f, d, type, vol, slide) {
      if (!this.on) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
        this.ctx = this.ctx || new AC();
        const c = this.ctx; if (c.state === 'suspended') c.resume();
        const o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
        o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
        if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
        g.gain.setValueAtTime(vol || .12, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
        o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + d);
      } catch (e) { /* audio is optional */ }
    },
    play(n) {
      const t = (...a) => this.tone(...a), later = (fn, ms) => setTimeout(fn, ms);
      switch (n) {
        case 'pop': t(500 + Math.random() * 250, .09, 'triangle', .16, 300); break;
        case 'coin': t(880, .07, 'square', .06); later(() => t(1320, .1, 'square', .06), 70); break;
        case 'good': t(523, .1, 'sine', .14); later(() => t(659, .1, 'sine', .14), 90); later(() => t(784, .2, 'sine', .14), 180); break;
        case 'bad': t(240, .25, 'sawtooth', .07, -120); break;
        case 'tick': t(760, .05, 'square', .04); break;
        case 'go': t(880, .3, 'triangle', .14); break;
        case 'bump': t(170, .14, 'sine', .2, -70); break;
        case 'land': t(220, .09, 'triangle', .16, -80); break;
        case 'whoosh': t(300, .14, 'sine', .08, 420); break;
        case 'perfect': t(1046, .1, 'triangle', .12); later(() => t(1568, .16, 'triangle', .12), 80); break;
        case 'clear': [523, 659, 784, 1047].forEach((f, i) => later(() => t(f, .12, 'triangle', .12), i * 70)); break;
        case 'win': [523, 659, 784, 1047, 1319].forEach((f, i) => later(() => t(f, .16, 'triangle', .14), i * 110)); break;
      }
    }
  };

  /* ------------------------------ Drawing helpers ------------------------------ */
  function rr(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function star(c, x, y, r, rot) { c.beginPath(); for (let i = 0; i < 10; i++) { const a = rot + (i * Math.PI) / 5 - Math.PI / 2, rad = i % 2 ? r * .45 : r; c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); } c.closePath(); }
  const shade = (hex, amt) => { const n = parseInt(hex.slice(1), 16); const f = (v) => clamp(Math.round(v + amt * 255), 0, 255); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };

  /* ============================== ENGINE ============================== */
  function play(def, theme, onEnd) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const root = document.createElement('div');
    root.className = 'gm-overlay'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', def.name);
    root.innerHTML = `
      <div class="gm-box" style="--ac:${theme.accent}">
        <div class="gm-hud">
          <div class="gm-cell"><small>SCORE</small><b id="gmScore">0</b></div>
          <div class="gm-time"><b id="gmTime">30</b><div class="gm-bar"><i id="gmBar"></i></div></div>
          <div class="gm-cell right"><small>COMBO</small><b id="gmCombo">x1</b></div>
          <button class="gm-pause" id="gmPause" aria-label="Pause game">⏸</button>
        </div>
        <div class="gm-stage"><canvas></canvas><div class="gm-msg" id="gmMsg"></div></div>
        <div class="gm-ctrl" id="gmCtrl"></div>
      </div>`;
    document.body.appendChild(root);
    document.body.classList.add('gm-lock');
    const cv = root.querySelector('canvas'), stage = root.querySelector('.gm-stage'), msg = root.querySelector('#gmMsg');
    cv.width = W * dpr; cv.height = H * dpr;
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const $ = (id) => root.querySelector(id);

    const g = {
      W, H, t: 0, dur: 30000, score: 0, shown: 0, combo: 0, maxCombo: 0, extra: 0,
      keys: {}, ptr: { x: W / 2, y: H / 2, down: false, active: false }, parts: [], texts: [], rings: [], shake: 0, theme, s: {}, clock: 0,
      mult() { return 1 + Math.min(4, Math.floor(this.combo / 3)); },
      hit(x, y, base, color, label) {
        this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo);
        const m = this.mult(), p = Math.round(base * m);
        this.score += p; this.text((label ? label + ' ' : '') + '+' + p, x, y, color || '#fff', m > 1 || !!label);
        if (this.combo > 0 && this.combo % 3 === 0 && this.combo <= 12) { this.text('COMBO x' + this.mult() + '!', W / 2, 150, '#ffd23f', true); Sound.play('coin'); }
        const el = $('#gmCombo'); el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse');
        return p;
      },
      add(x, y, p, color) { this.score += p; this.text('+' + p, x, y, color || '#fff'); },
      miss() { this.combo = 0; },
      text(s, x, y, color, big) { this.texts.push({ s, x, y, c: color, big, life: 900, max: 900 }); },
      burst(x, y, color, n, spd) { n = n || 12; spd = spd || 220; for (let i = 0; i < n; i++) { const a = rnd(0, TAU), v = rnd(spd * .3, spd); this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, c: color || pick(PAL), r: rnd(2, 5), life: rnd(400, 800), max: 800 }); } },
      ring(x, y, color) { this.rings.push({ x, y, r: 6, c: color, life: 450, max: 450 }); },
      bump(n) { this.shake = Math.max(this.shake, n || 6); }
    };

    let phase = 'intro', paused = false, raf = 0, last = performance.now(), cd = 0, lastCd = -1, ended = false, doneT = 0;

    /* touch buttons */
    const ctrl = $('#gmCtrl');
    (def.buttons || []).forEach((b) => {
      const el = document.createElement('button'); el.className = 'gm-btn'; el.textContent = b.l; el.setAttribute('aria-label', b.n || b.l);
      const down = (e) => { e.preventDefault(); if (phase !== 'play' || paused) return; g.keys[b.k] = true; g.ptr.active = false; def.key && def.key(g, b.k, true); };
      const up = (e) => { e.preventDefault(); g.keys[b.k] = false; def.key && phase === 'play' && def.key(g, b.k, false); };
      el.addEventListener('pointerdown', down); el.addEventListener('pointerup', up); el.addEventListener('pointerleave', up); el.addEventListener('pointercancel', up);
      ctrl.appendChild(el);
    });
    if (!(def.buttons || []).length) ctrl.style.display = 'none';

    const toLogical = (e) => { const r = cv.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }; };
    const onPD = (e) => { if (phase !== 'play' || paused) return; const p = toLogical(e); Object.assign(g.ptr, p, { down: true, active: true }); try { stage.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ } def.ptr && def.ptr(g, 'down', p.x, p.y); };
    const onPM = (e) => { const p = toLogical(e); Object.assign(g.ptr, p); if (e.pointerType === 'mouse' || g.ptr.down) g.ptr.active = true; if (phase === 'play' && !paused && def.ptr) def.ptr(g, 'move', p.x, p.y); };
    const onPU = (e) => { g.ptr.down = false; if (e.pointerType !== 'mouse') g.ptr.active = false; if (phase === 'play' && !paused && def.ptr) def.ptr(g, 'up', g.ptr.x, g.ptr.y); };
    stage.addEventListener('pointerdown', onPD); stage.addEventListener('pointermove', onPM); stage.addEventListener('pointerup', onPU); stage.addEventListener('pointercancel', onPU);

    const GAMEKEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'];
    const onKD = (e) => {
      if (e.code === 'Escape' || e.code === 'KeyP') { if (phase === 'play') { e.preventDefault(); setPause(!paused); } return; }
      if (GAMEKEYS.includes(e.code) && phase !== 'intro') e.preventDefault();
      if (phase !== 'play' || paused) return;
      if (!e.repeat) { g.keys[e.code] = true; g.ptr.active = false; def.key && def.key(g, e.code, true); } else g.keys[e.code] = true;
    };
    const onKU = (e) => { g.keys[e.code] = false; if (phase === 'play' && !paused && def.key) def.key(g, e.code, false); };
    const onBlur = () => { if (phase === 'play' && !paused) setPause(true); };
    window.addEventListener('keydown', onKD); window.addEventListener('keyup', onKU); window.addEventListener('blur', onBlur); document.addEventListener('visibilitychange', onBlur);

    function showMsg(html, cls) { msg.className = 'gm-msg show ' + (cls || ''); msg.innerHTML = html; }
    function hideMsg() { msg.className = 'gm-msg'; msg.innerHTML = ''; }

    function intro() {
      showMsg(`<div class="gm-card"><div class="gm-ico">${def.icon}</div><h2>${def.name}</h2><p>${def.how}</p><button class="btn primary big" id="gmStart">▶ Start</button><p class="gm-sub">30 seconds · Esc / P to pause</p></div>`);
      const b = $('#gmStart'); b.focus(); b.onclick = () => { phase = 'count'; cd = 3000; lastCd = -1; hideMsg(); Sound.play('whoosh'); };
    }
    function setPause(p) {
      if (phase !== 'play') return; paused = p;
      $('#gmPause').textContent = p ? '▶' : '⏸'; $('#gmPause').setAttribute('aria-label', p ? 'Resume game' : 'Pause game');
      if (p) {
        g.keys = {}; def.key && ['ArrowLeft', 'ArrowRight', 'ArrowDown'].forEach((k) => def.key(g, k, false));
        showMsg(`<div class="gm-card"><h2>⏸ Paused</h2><p>The 30-second timer is stopped.</p><div class="btn-row center"><button class="btn primary" id="gmRes">Resume</button><button class="btn ghost" id="gmQuit">End game</button></div></div>`);
        $('#gmRes').focus(); $('#gmRes').onclick = () => setPause(false); $('#gmQuit').onclick = () => { paused = false; finish(true); };
      } else { hideMsg(); last = performance.now(); }
    }
    $('#gmPause').onclick = () => setPause(!paused);

    function finish() {
      if (phase === 'done') return; phase = 'done'; doneT = 0; g.keys = {};
      showMsg(`<div class="gm-card time"><h2>⏱ Time's up!</h2><p>Score <b>${Math.round(g.score)}</b></p></div>`); Sound.play('win');
    }
    function destroy() {
      if (ended) return; ended = true; cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKD); window.removeEventListener('keyup', onKU); window.removeEventListener('blur', onBlur); document.removeEventListener('visibilitychange', onBlur);
      root.remove(); document.body.classList.remove('gm-lock');
    }

    function fx(dt) {
      const s = dt / 1000;
      g.parts = g.parts.filter((p) => { p.life -= dt; p.x += p.vx * s; p.y += p.vy * s; p.vy += 520 * s; return p.life > 0; });
      g.texts = g.texts.filter((t) => { t.life -= dt; t.y -= 46 * s; return t.life > 0; });
      g.rings = g.rings.filter((r) => { r.life -= dt; r.r += 150 * s; return r.life > 0; });
      g.shake = Math.max(0, g.shake - dt * .03);
    }

    function drawBg(t) {
      const gr = c.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, theme.bg[0]); gr.addColorStop(1, theme.bg[1]);
      c.fillStyle = gr; c.fillRect(0, 0, W, H);
      c.globalAlpha = .10; c.fillStyle = '#fff';
      for (let i = 0; i < 7; i++) { const x = (i * 97 + t * .012 * (i % 3 + 1)) % (W + 120) - 60, y = (i * 163) % H; c.beginPath(); c.arc(x, y, 30 + (i % 4) * 14, 0, TAU); c.fill(); }
      c.globalAlpha = 1;
    }

    function hud() {
      g.shown += (g.score - g.shown) * .25; if (Math.abs(g.score - g.shown) < .6) g.shown = g.score;
      $('#gmScore').textContent = Math.round(g.shown);
      const left = Math.max(0, g.dur - g.t), sec = Math.ceil(left / 1000);
      const te = $('#gmTime'); if (te.textContent !== String(sec)) { te.textContent = sec; if (sec <= 3 && sec > 0 && phase === 'play') Sound.play('tick'); }
      te.classList.toggle('low', sec <= 5);
      $('#gmBar').style.width = (left / g.dur) * 100 + '%';
      $('#gmCombo').textContent = 'x' + g.mult() + (g.combo > 1 ? ' · ' + g.combo : '');
    }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(50, now - last); last = now;
      if (paused) { draw(); return; }
      if (phase === 'count') {
        cd -= dt; const n = Math.ceil(cd / 1000);
        if (n !== lastCd && n > 0) { lastCd = n; showMsg(`<div class="gm-count">${n}</div>`); Sound.play('tick'); }
        if (cd <= 0) { phase = 'play'; showMsg('<div class="gm-count go">GO!</div>'); Sound.play('go'); setTimeout(() => { if (phase === 'play' && !paused) hideMsg(); }, 500); }
      } else if (phase === 'play') {
        g.t += dt; g.clock += dt;
        def.update(g, dt / 1000);
        if (g.t >= g.dur) { g.t = g.dur; finish(); }
      } else if (phase === 'done') {
        doneT += dt; if (doneT > 1200) { const res = { score: Math.round(g.score), maxCombo: g.maxCombo, extra: g.extra }; destroy(); onEnd(res); return; }
      }
      fx(dt); draw(); hud();
    }
    function draw() {
      c.save();
      drawBg(g.clock);
      if (g.shake > .2) c.translate(rnd(-g.shake, g.shake), rnd(-g.shake, g.shake));
      def.draw(c, g);
      g.rings.forEach((r) => { c.globalAlpha = r.life / r.max; c.strokeStyle = r.c; c.lineWidth = 4; c.beginPath(); c.arc(r.x, r.y, r.r, 0, TAU); c.stroke(); });
      g.parts.forEach((p) => { c.globalAlpha = clamp(p.life / p.max, 0, 1); c.fillStyle = p.c; c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fill(); });
      c.globalAlpha = 1; c.textAlign = 'center'; c.lineJoin = 'round';
      g.texts.forEach((t) => { const k = t.life / t.max; c.globalAlpha = Math.min(1, k * 2); c.font = `900 ${t.big ? 30 : 20}px system-ui, sans-serif`; c.lineWidth = 5; c.strokeStyle = 'rgba(0,0,0,.35)'; c.strokeText(t.s, t.x, t.y); c.fillStyle = t.c; c.fillText(t.s, t.x, t.y); });
      c.restore(); c.globalAlpha = 1;
    }

    def.init(g);
    intro();
    raf = requestAnimationFrame((n) => { last = n; frame(n); });
    return { destroy, root };
  }

  /* ============================== GAME: STAR CATCHER ============================== */
  const starCatcher = {
    id: 'star', name: 'Star Catcher', icon: '⭐', blurb: 'Catch falling stars in your basket. Dodge the grey rocks!',
    how: 'Move the basket with <b>← →</b> or <b>drag / move your pointer</b>. Catch stars to build combos. Grey rocks make you dizzy!',
    buttons: [{ k: 'ArrowLeft', l: '◀', n: 'Move left' }, { k: 'ArrowRight', l: '▶', n: 'Move right' }],
    init(g) { g.s = { x: W / 2, items: [], spawn: .4, squash: 0, dizzy: 0, blink: 0, lean: 0 }; },
    update(g, dt) {
      const s = g.s, dir = (g.keys.ArrowRight || g.keys.KeyD ? 1 : 0) - (g.keys.ArrowLeft || g.keys.KeyA ? 1 : 0);
      const px = s.x;
      if (g.ptr.active) s.x += (g.ptr.x - s.x) * Math.min(1, dt * 16); else s.x += dir * 520 * dt * (s.dizzy > 0 ? .45 : 1);
      s.x = clamp(s.x, 48, W - 48); s.lean += ((s.x - px) * .4 - s.lean) * .3;
      s.dizzy = Math.max(0, s.dizzy - dt); s.squash = Math.max(0, s.squash - dt * 4);
      const sec = g.t / 1000;
      s.spawn -= dt;
      if (s.spawn <= 0) {
        s.spawn = Math.max(.26, .7 - sec * .014) * rnd(.7, 1.2);
        const r = Math.random(), type = r < .13 && sec > 2 ? 'rock' : r < .22 ? 'gold' : 'star';
        s.items.push({ type, x: rnd(30, W - 30), y: -30, vy: 170 + sec * 5 + rnd(0, 70) + (type === 'gold' ? 60 : 0), rot: rnd(0, 6), vr: rnd(-2, 2), r: type === 'gold' ? 20 : type === 'rock' ? 17 : 15 });
      }
      const by = H - 78;
      s.items = s.items.filter((it) => {
        it.y += it.vy * dt; it.rot += it.vr * dt;
        if (it.y > by - 18 && it.y < by + 22 && Math.abs(it.x - s.x) < 54 + it.r * .3) {
          s.squash = 1;
          if (it.type === 'rock') { g.miss(); g.score = Math.max(0, g.score - 5); s.dizzy = .9; g.bump(8); g.text('Oof! -5', it.x, by - 30, '#c7ccd9', true); g.burst(it.x, by, '#9aa0b5', 8, 160); Sound.play('bump'); }
          else { const gold = it.type === 'gold'; g.hit(it.x, by - 30, gold ? 30 : 10, gold ? '#ffd23f' : '#fff'); g.burst(it.x, by - 10, gold ? '#ffd23f' : '#fff6a8', gold ? 18 : 9); if (gold) g.ring(it.x, by - 10, '#ffd23f'); Sound.play(gold ? 'coin' : 'pop'); }
          return false;
        }
        if (it.y > H + 30) { if (it.type !== 'rock') g.miss(); return false; }
        return true;
      });
    },
    draw(c, g) {
      const s = g.s, by = H - 78;
      s.items.forEach((it) => {
        c.save(); c.translate(it.x, it.y); c.rotate(it.rot);
        if (it.type === 'rock') { c.fillStyle = '#8d93ab'; rr(c, -it.r, -it.r * .8, it.r * 2, it.r * 1.6, 8); c.fill(); c.fillStyle = '#a9afc5'; rr(c, -it.r * .6, -it.r * .55, it.r, it.r * .5, 5); c.fill(); }
        else { const gold = it.type === 'gold'; c.shadowColor = gold ? '#ffd23f' : '#fff3a0'; c.shadowBlur = 16; star(c, 0, 0, it.r + 4, 0); c.fillStyle = gold ? '#ffb703' : '#ffe14d'; c.fill(); c.shadowBlur = 0; star(c, 0, 0, it.r * .6, 0); c.fillStyle = gold ? '#fff2a8' : '#fff7b8'; c.fill(); }
        c.restore();
      });
      // basket
      const sq = s.squash, w = 96 + sq * 12, h = 54 - sq * 8;
      c.save(); c.translate(s.x, by); c.rotate(s.lean * .01);
      c.fillStyle = 'rgba(0,0,0,.15)'; c.beginPath(); c.ellipse(0, 40, 50, 7, 0, 0, TAU); c.fill();
      c.fillStyle = '#ffb870'; c.beginPath(); c.moveTo(-w / 2, -h / 2 + 4); c.lineTo(w / 2, -h / 2 + 4); c.lineTo(w / 2 - 12, h / 2 + 6); c.lineTo(-w / 2 + 12, h / 2 + 6); c.closePath(); c.fill();
      c.strokeStyle = '#e08a45'; c.lineWidth = 3; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 18, -h / 2 + 6); c.lineTo(i * 14, h / 2 + 4); c.stroke(); }
      c.fillStyle = '#ff9a4d'; rr(c, -w / 2 - 4, -h / 2 - 4, w + 8, 14, 7); c.fill();
      // face
      c.fillStyle = '#3a2b4d';
      if (s.dizzy > 0) { c.strokeStyle = '#3a2b4d'; c.lineWidth = 3; [-16, 16].forEach((x) => { c.beginPath(); c.moveTo(x - 5, 4); c.lineTo(x + 5, 14); c.moveTo(x + 5, 4); c.lineTo(x - 5, 14); c.stroke(); }); }
      else { [-16, 16].forEach((x) => { c.beginPath(); c.ellipse(x, 10, 5, sq > .3 ? 2 : 6, 0, 0, TAU); c.fill(); }); }
      c.strokeStyle = '#3a2b4d'; c.lineWidth = 3; c.beginPath(); c.arc(0, 18, s.dizzy > 0 ? 4 : 8, s.dizzy > 0 ? Math.PI : 0, s.dizzy > 0 ? TAU : Math.PI); c.stroke();
      c.restore();
    }
  };

  /* ============================== GAME: STACK TOWER ============================== */
  const stackTower = {
    id: 'stack', name: 'Stack Tower', icon: '🧱', blurb: 'Time your taps to stack the tallest, tidiest tower.',
    how: '<b>Tap / click / press Space</b> to drop the sliding block. Line it up perfectly to keep your width and build combos!',
    buttons: [{ k: 'Space', l: '⬇ DROP', n: 'Drop block' }],
    init(g) { const s = g.s = { blocks: [{ x: W / 2 - 110, w: 220 }], bh: 32, cur: null, deb: [], cam: 0, hue: rnd(0, 360), level: 0, best: 0 }; this.spawn(g); },
    spawn(g) { const s = g.s, top = s.blocks[s.blocks.length - 1]; s.cur = { x: Math.random() < .5 ? 0 : W - top.w, w: top.w, dir: Math.random() < .5 ? 1 : -1 }; },
    drop(g) {
      const s = g.s, cur = s.cur, top = s.blocks[s.blocks.length - 1], baseY = H - 110, y = baseY - s.blocks.length * s.bh;
      const color = `hsl(${(s.hue + s.level * 16) % 360},80%,62%)`;
      const left = Math.max(cur.x, top.x), right = Math.min(cur.x + cur.w, top.x + top.w), ov = right - left;
      if (ov <= 3) {
        s.deb.push({ x: cur.x, y, w: cur.w, vy: 0, vx: rnd(-30, 30), rot: 0, vr: rnd(-1, 1), c: color });
        s.blocks.forEach((b, i) => s.deb.push({ x: b.x, y: baseY - i * s.bh, w: b.w, vy: -rnd(0, 120), vx: rnd(-60, 60), rot: 0, vr: rnd(-1.2, 1.2), c: `hsl(${(s.hue + i * 16) % 360},80%,62%)`, soft: true }));
        s.blocks = [{ x: W / 2 - 110, w: 220 }]; s.level = 0; g.miss(); g.bump(9); g.text('Tower tumbled! Fresh start', W / 2, 200, '#fff', true); Sound.play('bad');
      } else {
        let nb;
        if (Math.abs(cur.x - top.x) <= 7) {
          nb = { x: top.x, w: Math.min(260, top.w + 8) }; g.hit(W / 2, 220, 25, '#ffd23f', 'PERFECT!'); g.ring(nb.x + nb.w / 2, y, '#ffd23f'); g.burst(nb.x + nb.w / 2, y, '#ffd23f', 16); Sound.play('perfect');
        } else {
          nb = { x: left, w: ov };
          const cutW = cur.w - ov; if (cutW > 0) s.deb.push({ x: cur.x < top.x ? cur.x : right, y, w: cutW, vy: 0, vx: cur.x < top.x ? -40 : 40, rot: 0, vr: cur.x < top.x ? -1.5 : 1.5, c: color });
          g.add(nb.x + nb.w / 2, y - 20, 10, '#fff'); g.miss(); Sound.play('land');
        }
        s.blocks.push(nb); s.level++; s.best = Math.max(s.best, s.level);
      }
      this.spawn(g);
    },
    key(g, k, down) { if (down && (k === 'Space' || k === 'ArrowDown' || k === 'Enter')) this.drop(g); },
    ptr(g, t) { if (t === 'down') this.drop(g); },
    update(g, dt) {
      const s = g.s, cur = s.cur, speed = Math.min(560, 210 + s.level * 14);
      cur.x += cur.dir * speed * dt;
      if (cur.x < 0) { cur.x = 0; cur.dir = 1; } if (cur.x + cur.w > W) { cur.x = W - cur.w; cur.dir = -1; }
      const target = Math.max(0, (s.blocks.length - 5) * s.bh); s.cam += (target - s.cam) * Math.min(1, dt * 5);
      s.deb.forEach((d) => { d.vy += 1500 * dt; d.y += d.vy * dt; d.x += d.vx * dt; d.rot += d.vr * dt; }); s.deb = s.deb.filter((d) => d.y < H + s.cam + 200);
    },
    draw(c, g) {
      const s = g.s, baseY = H - 110;
      const blk = (x, y, w, col) => { c.fillStyle = col; rr(c, x, y, w, s.bh - 3, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,.28)'; rr(c, x + 3, y + 3, w - 6, 8, 4); c.fill(); };
      c.fillStyle = 'rgba(255,255,255,.35)'; rr(c, 20, baseY + s.bh * 1 - 3 + s.cam, W - 40, 30, 12); c.fill();
      s.blocks.forEach((b, i) => blk(b.x, baseY - i * s.bh + s.cam, b.w, `hsl(${(s.hue + i * 16) % 360},80%,62%)`));
      if (s.cur) { const y = baseY - s.blocks.length * s.bh + s.cam; blk(s.cur.x, y, s.cur.w, `hsl(${(s.hue + s.level * 16) % 360},85%,66%)`); c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(s.blocks[s.blocks.length - 1].x, y + s.bh, s.blocks[s.blocks.length - 1].w, 2); }
      s.deb.forEach((d) => { c.save(); c.translate(d.x + d.w / 2, d.y + s.cam + s.bh / 2); c.rotate(d.rot); c.globalAlpha = d.soft ? .6 : 1; blk(-d.w / 2, -s.bh / 2, d.w, d.c); c.restore(); });
      c.globalAlpha = 1; c.fillStyle = 'rgba(255,255,255,.9)'; c.font = '900 64px system-ui,sans-serif'; c.textAlign = 'center'; c.globalAlpha = .35; c.fillText(s.level, W / 2, 110); c.globalAlpha = 1;
    }
  };

  /* ============================== GAME: SNAKE GARDEN ============================== */
  const snakeGarden = {
    id: 'snake', name: 'Snake Garden', icon: '🐍', blurb: 'Guide a friendly snake to gobble fruit and grow long.',
    how: 'Steer with <b>arrow keys / WASD</b> or <b>swipe</b>. Eat fruit to grow. Bump a wall or your tail and you boing back to size 3!',
    buttons: [{ k: 'ArrowUp', l: '▲', n: 'Up' }, { k: 'ArrowLeft', l: '◀', n: 'Left' }, { k: 'ArrowDown', l: '▼', n: 'Down' }, { k: 'ArrowRight', l: '▶', n: 'Right' }],
    C: 18, R: 24, S: 26, OX: 6, OY: 8,
    init(g) { const s = g.s = { step: .14, acc: 0, q: [], eaten: 0, last: -9, fruit: null, inv: 0, sw: null }; this.reset(g); this.place(g); },
    reset(g) { const s = g.s, cx = this.C >> 1, cy = this.R >> 1; s.body = [{ x: cx, y: cy }, { x: cx, y: cy + 1 }, { x: cx, y: cy + 2 }]; s.prev = s.body.map((b) => ({ ...b })); s.dir = { x: 0, y: -1 }; s.q = []; s.inv = 1; },
    place(g) {
      const s = g.s; let x, y, n = 0; do { x = ri(0, this.C - 1); y = ri(0, this.R - 1); n++; } while (s.body.some((b) => b.x === x && b.y === y) && n < 200);
      const r = Math.random(); s.fruit = { x, y, kind: r < .12 ? 'gold' : pick(['apple', 'orange', 'plum', 'cherry']), born: g.t, pop: 0 };
    },
    steer(g, dx, dy) { const s = g.s, ref = s.q.length ? s.q[s.q.length - 1] : s.dir; if ((dx && ref.x === -dx) || (dy && ref.y === -dy) || (dx === ref.x && dy === ref.y)) return; if (s.q.length < 3) s.q.push({ x: dx, y: dy }); },
    key(g, k, d) { if (!d) return; const m = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] }[k]; if (m) this.steer(g, m[0], m[1]); },
    ptr(g, t, x, y) {
      const s = g.s;
      if (t === 'down') s.sw = { x, y }; else if (t === 'move' && s.sw && g.ptr.down) { const dx = x - s.sw.x, dy = y - s.sw.y; if (Math.hypot(dx, dy) > 26) { if (Math.abs(dx) > Math.abs(dy)) this.steer(g, Math.sign(dx), 0); else this.steer(g, 0, Math.sign(dy)); s.sw = { x, y }; } } else if (t === 'up') s.sw = null;
    },
    update(g, dt) {
      const s = g.s; s.acc += dt; s.inv = Math.max(0, s.inv - dt);
      if (s.fruit.kind === 'gold' && g.t - s.fruit.born > 6000) this.place(g);
      s.step = Math.max(.08, .14 - s.eaten * .002);
      while (s.acc >= s.step) {
        s.acc -= s.step;
        if (s.q.length) s.dir = s.q.shift();
        s.prev = s.body.map((b) => ({ ...b }));
        const h = s.body[0], nx = h.x + s.dir.x, ny = h.y + s.dir.y;
        const wall = nx < 0 || ny < 0 || nx >= this.C || ny >= this.R, self = s.body.slice(0, -1).some((b) => b.x === nx && b.y === ny);
        if (wall || self) {
          if (s.inv > 0) { s.acc = 0; continue; }
          const hx = clamp(h.x, 0, this.C - 1), hy = clamp(h.y, 0, this.R - 1);
          g.bump(9); g.miss(); g.text('Boing!', this.OX + hx * this.S + 13, this.OY + hy * this.S, '#fff', true); g.burst(this.OX + hx * this.S + 13, this.OY + hy * this.S + 13, '#8ac926', 14); Sound.play('bump');
          this.reset(g); s.acc = 0; break;
        }
        s.body.unshift({ x: nx, y: ny });
        const f = s.fruit;
        if (f && f.x === nx && f.y === ny) {
          s.eaten++; if (g.t - s.last > 3600) g.miss(); s.last = g.t;
          const gold = f.kind === 'gold', px = this.OX + nx * this.S + 13, py = this.OY + ny * this.S + 13;
          g.hit(px, py - 10, gold ? 30 : 10, gold ? '#ffd23f' : '#fff'); g.burst(px, py, gold ? '#ffd23f' : { apple: '#ff5d8f', orange: '#ffb703', plum: '#7a6bff', cherry: '#ff3d71' }[f.kind], 12);
          if (gold) { g.ring(px, py, '#ffd23f'); s.body.push({ ...s.body[s.body.length - 1] }); }
          Sound.play(gold ? 'coin' : 'pop'); this.place(g);
        } else s.body.pop();
      }
    },
    draw(c, g) {
      const s = g.s, S = this.S, a = clamp(s.acc / s.step, 0, 1);
      // garden board
      c.fillStyle = 'rgba(20,60,30,.28)'; rr(c, this.OX - 4, this.OY - 4, this.C * S + 8, this.R * S + 8, 16); c.fill();
      for (let y = 0; y < this.R; y++) for (let x = 0; x < this.C; x++) { c.fillStyle = (x + y) % 2 ? 'rgba(255,255,255,.10)' : 'rgba(255,255,255,.04)'; c.fillRect(this.OX + x * S, this.OY + y * S, S, S); }
      const f = s.fruit; if (f) {
        const x = this.OX + f.x * S + S / 2, y = this.OY + f.y * S + S / 2 + Math.sin(g.clock / 200) * 2, col = { apple: '#ff4d6d', orange: '#ffa62b', plum: '#8b6bff', cherry: '#e5174f', gold: '#ffd23f' }[f.kind];
        if (f.kind === 'gold') { c.shadowColor = '#ffd23f'; c.shadowBlur = 18; star(c, x, y, 13, g.clock / 500); c.fillStyle = col; c.fill(); c.shadowBlur = 0; }
        else { c.fillStyle = col; c.beginPath(); c.arc(x, y, 10, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.arc(x - 3, y - 4, 3, 0, TAU); c.fill(); c.fillStyle = '#4caf50'; c.beginPath(); c.ellipse(x + 3, y - 11, 6, 3, -.5, 0, TAU); c.fill(); }
      }
      const pos = (i) => { const b = s.body[i], p = s.prev[i] || s.prev[s.prev.length - 1] || b; return { x: this.OX + (p.x + (b.x - p.x) * a) * S + S / 2, y: this.OY + (p.y + (b.y - p.y) * a) * S + S / 2 }; };
      const blink = s.inv > 0 && Math.floor(g.clock / 90) % 2;
      for (let i = s.body.length - 1; i >= 0; i--) {
        const p = pos(i), r = i === 0 ? 13 : 12 - Math.min(4, i * .12);
        c.globalAlpha = blink ? .45 : 1; c.fillStyle = i === 0 ? '#5ad36a' : i % 2 ? '#7be07f' : '#6fd774';
        c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.fill();
        if (i === 0) {
          const d = s.dir; c.fillStyle = '#fff'; [[-1, 1], [1, 1]].forEach(([k]) => { const ex = p.x + (d.x ? d.x * 5 : k * 5), ey = p.y + (d.y ? d.y * 5 : -2) + (d.x ? k * 5 : 0); c.beginPath(); c.arc(ex, ey, 4, 0, TAU); c.fill(); c.fillStyle = '#222'; c.beginPath(); c.arc(ex + d.x * 1.5, ey + d.y * 1.5, 2, 0, TAU); c.fill(); c.fillStyle = '#fff'; });
        }
      }
      c.globalAlpha = 1;
    }
  };

  /* ============================== GAME: SKY HOPPER ============================== */
  const skyHopper = {
    id: 'hopper', name: 'Sky Hopper', icon: '🦘', blurb: 'Pip hops upward on its own. Steer, grab stars, climb high!',
    how: 'Pip hops automatically. Steer with <b>← →</b> (or A / D), or <b>hold and drag</b>. Grab stars and climb as high as you can. Falling just bubbles you back up!',
    buttons: [{ k: 'ArrowLeft', l: '◀', n: 'Move left' }, { k: 'ArrowRight', l: '▶', n: 'Move right' }],
    init(g) {
      const s = g.s = { x: W / 2, y: H - 90, vy: -720, vx: 0, cam: 0, plats: [], stars: [], maxH: 0, startY: H - 90, sq: 0, bubble: 0, dir: 1 };
      s.plats.push({ x: W / 2 - 50, y: H - 60, w: 100, t: 'n', ph: 0 });
      this.fill(g);
    },
    fill(g) {
      const s = g.s; let top = Math.min(...s.plats.map((p) => p.y));
      while (top > s.cam - 80) {
        const h = (s.startY - top) / 100, gap = rnd(72, 92 + Math.min(52, h * 1.2)); top -= gap;
        const w = rnd(68, 104) - Math.min(18, h * .1), r = Math.random(), t = r < .16 + Math.min(.14, h * .002) ? 'm' : r < .24 ? 's' : 'n';
        const p = { x: rnd(10, W - w - 10), y: top, w, t, v: rnd(60, 100) * (Math.random() < .5 ? 1 : -1), ph: 0 }; s.plats.push(p);
        if (Math.random() < .42) s.stars.push({ x: p.x + w / 2, y: top - 42, p, gold: Math.random() < .12 });
      }
      s.plats = s.plats.filter((p) => p.y < s.cam + H + 60); s.stars = s.stars.filter((st) => st.y < s.cam + H + 60);
    },
    update(g, dt) {
      const s = g.s, k = g.keys;
      const dir = (k.ArrowRight || k.KeyD ? 1 : 0) - (k.ArrowLeft || k.KeyA ? 1 : 0);
      let tvx; if (g.ptr.active) tvx = clamp((g.ptr.x - s.x) * 8, -400, 400); else tvx = dir * 380;
      s.vx += (tvx - s.vx) * Math.min(1, dt * 14); s.x += s.vx * dt; if (s.vx) s.dir = s.vx > 0 ? 1 : -1;
      if (s.x < -15) s.x = W + 15; if (s.x > W + 15) s.x = -15;
      const prevY = s.y; s.vy += 1500 * dt; s.y += s.vy * dt; s.sq = Math.max(0, s.sq - dt * 4); s.bubble = Math.max(0, s.bubble - dt);
      s.plats.forEach((p) => { if (p.t === 'm') { p.x += p.v * dt; if (p.x < 0 || p.x + p.w > W) { p.v *= -1; p.x = clamp(p.x, 0, W - p.w); } } p.ph = Math.max(0, p.ph - dt * 4); });
      s.stars.forEach((st) => { if (st.p.t === 'm') st.x = st.p.x + st.p.w / 2; });
      if (s.vy > 0) for (const p of s.plats) if (prevY + 20 <= p.y + 2 && s.y + 20 >= p.y && s.x > p.x - 10 && s.x < p.x + p.w + 10) {
        s.vy = p.t === 's' ? -1080 : -730; s.y = p.y - 20; s.sq = 1; p.ph = 1; Sound.play(p.t === 's' ? 'whoosh' : 'land'); g.burst(s.x, p.y, '#fff', 4, 90); if (p.t === 's') { g.ring(s.x, p.y, '#ff5d8f'); g.text('BOING!', s.x, p.y - 40, '#ff8fb3'); } break;
      }
      s.stars = s.stars.filter((st) => { if (Math.hypot(st.x - s.x, st.y - s.y) < 30) { g.hit(st.x, st.y - 10, st.gold ? 50 : 20, st.gold ? '#ffd23f' : '#fff'); g.burst(st.x, st.y, '#ffe14d', st.gold ? 18 : 9); Sound.play(st.gold ? 'coin' : 'pop'); return false; } return true; });
      const h = (s.startY - s.y) / 10; if (h > s.maxH) { g.score += (h - s.maxH) * .5; s.maxH = h; g.extra = Math.round(s.maxH); }
      if (s.y < s.cam + H * .42) s.cam = s.y - H * .42;
      if (s.y > s.cam + H + 30) {
        const cands = s.plats.filter((p) => p.y > s.cam + H * .3 && p.y < s.cam + H - 40); const p = cands.length ? cands[cands.length - 1] : { x: s.x - 50, y: s.cam + H - 120, w: 100, t: 'n', ph: 0 };
        if (!cands.length) s.plats.push(p);
        s.x = p.x + p.w / 2; s.y = p.y - 20; s.vy = -760; s.bubble = 1; g.miss(); g.text('Whoops! Bubble boost', W / 2, 260, '#fff', true); g.ring(s.x, p.y, '#4cc9f0'); Sound.play('whoosh');
      }
      this.fill(g);
    },
    draw(c, g) {
      const s = g.s, cy = -s.cam;
      c.fillStyle = 'rgba(255,255,255,.22)'; for (let i = 0; i < 5; i++) { const x = (i * 131) % W, y = ((i * 170 + s.cam * .25) % (H + 80)) ; c.beginPath(); c.ellipse(x, y, 54, 18, 0, 0, TAU); c.ellipse(x + 28, y - 8, 34, 16, 0, 0, TAU); c.fill(); }
      s.plats.forEach((p) => {
        const y = p.y + cy, off = p.ph * 4;
        c.fillStyle = p.t === 'm' ? '#4cc9f0' : '#8ae04a'; rr(c, p.x, y + off, p.w, 14, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,.4)'; rr(c, p.x + 4, y + off + 2, p.w - 8, 4, 2); c.fill();
        if (p.t === 's') { c.fillStyle = '#ff5d8f'; rr(c, p.x + p.w / 2 - 12, y - 8 + off, 24, 10, 5); c.fill(); }
      });
      s.stars.forEach((st) => { const y = st.y + cy + Math.sin(g.clock / 250 + st.x) * 3; c.shadowColor = '#ffe14d'; c.shadowBlur = 12; star(c, st.x, y, st.gold ? 16 : 12, g.clock / 700); c.fillStyle = st.gold ? '#ffb703' : '#ffe14d'; c.fill(); c.shadowBlur = 0; });
      // Pip
      const x = s.x, y = s.y + cy, sq = s.sq, st = 1 + clamp(-s.vy / 3000, -.12, .22);
      if (s.bubble > 0) { c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 3; c.fillStyle = 'rgba(180,230,255,.25)'; c.beginPath(); c.arc(x, y, 34, 0, TAU); c.fill(); c.stroke(); }
      c.save(); c.translate(x, y + 20); c.scale((1 / st) * (1 + sq * .25), st * (1 - sq * .22)); c.translate(0, -20);
      c.fillStyle = '#ff7a59'; c.beginPath(); c.arc(0, 0, 21, 0, TAU); c.fill(); c.fillStyle = '#ffb199'; c.beginPath(); c.ellipse(0, 8, 13, 9, 0, 0, TAU); c.fill();
      c.fillStyle = '#ff7a59'; c.beginPath(); c.moveTo(-14, -14); c.lineTo(-20, -30); c.lineTo(-6, -19); c.fill(); c.beginPath(); c.moveTo(14, -14); c.lineTo(20, -30); c.lineTo(6, -19); c.fill();
      c.fillStyle = '#fff'; [-8, 8].forEach((ex) => { c.beginPath(); c.arc(ex, -3, 6, 0, TAU); c.fill(); }); c.fillStyle = '#2b1d3d'; [-8, 8].forEach((ex) => { c.beginPath(); c.arc(ex + s.dir * 2, -3, 3, 0, TAU); c.fill(); });
      c.strokeStyle = '#2b1d3d'; c.lineWidth = 2.5; c.beginPath(); c.arc(0, 4, 5, .15 * Math.PI, .85 * Math.PI); c.stroke(); c.restore();
      c.fillStyle = 'rgba(255,255,255,.9)'; c.font = '800 16px system-ui,sans-serif'; c.textAlign = 'left'; c.fillText('↑ ' + Math.round(s.maxH) + ' m', 14, 28);
    }
  };

  /* ============================== GAME: BLOCK DROP ============================== */
  const SHAPES = {
    I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], O: [[1, 1], [1, 1]], T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]], Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]], J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]], L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]]
  };
  const BCOL = { I: '#4cc9f0', O: '#ffd23f', T: '#b36bff', S: '#5ad36a', Z: '#ff5d8f', J: '#5b7bff', L: '#ff9a4d', G: '#9aa5d6' };
  const blockDrop = {
    id: 'blocks', name: 'Block Drop', icon: '🧩', blurb: 'Rotate and place falling blocks to clear glowing lines.',
    how: '<b>← →</b> move · <b>↑</b> rotate · <b>↓</b> soft drop · <b>Space</b> hard drop. Fill whole rows to clear them! On touch, use the buttons.',
    buttons: [{ k: 'ArrowLeft', l: '◀', n: 'Left' }, { k: 'ArrowUp', l: '⟳', n: 'Rotate' }, { k: 'ArrowRight', l: '▶', n: 'Right' }, { k: 'ArrowDown', l: '▼', n: 'Soft drop' }, { k: 'Space', l: '⤓', n: 'Hard drop' }],
    C: 10, R: 20, S: 28, OX: 20, OY: 40,
    init(g) { const s = g.s = { grid: [], piece: null, next: null, bag: [], grav: 0, das: 0, clearing: null, lines: 0 }; s.next = this.bag(g); this.fillGarbage(g); this.spawn(g); },
    fillGarbage(g) {
      const s = g.s; s.grid = Array.from({ length: this.R }, () => Array(this.C).fill(null));
      for (let r = this.R - 3; r < this.R; r++) { const holes = new Set(); while (holes.size < 3) holes.add(ri(0, this.C - 1)); for (let x = 0; x < this.C; x++) if (!holes.has(x)) s.grid[r][x] = pick(['I', 'O', 'T', 'S', 'Z', 'J', 'L']); }
    },
    bag(g) { const s = g.s; if (!s.bag.length) s.bag = Object.keys(SHAPES).sort(() => Math.random() - .5); return s.bag.pop(); },
    spawn(g) {
      const s = g.s, t = s.next; s.next = this.bag(g); const m = SHAPES[t].map((r) => r.slice());
      s.piece = { t, m, x: Math.floor((this.C - m[0].length) / 2), y: 0 }; s.grav = 0;
      if (this.hit(g, s.piece.m, s.piece.x, s.piece.y)) { // topped out: gentle reset
        for (let r = 0; r < this.R; r++) for (let x = 0; x < this.C; x++) if (s.grid[r][x]) g.burst(this.OX + x * this.S + 14, this.OY + r * this.S + 14, BCOL[s.grid[r][x]], 1, 200);
        g.miss(); g.bump(8); g.text('Board refreshed!', W / 2, 200, '#fff', true); Sound.play('bump'); this.fillGarbage(g); s.piece.y = 0;
      }
    },
    hit(g, m, px, py) {
      const s = g.s;
      for (let y = 0; y < m.length; y++) for (let x = 0; x < m[y].length; x++) if (m[y][x]) { const gx = px + x, gy = py + y; if (gx < 0 || gx >= this.C || gy >= this.R) return true; if (gy >= 0 && s.grid[gy][gx]) return true; }
      return false;
    },
    move(g, dx) { const p = g.s.piece; if (!p || g.s.clearing) return false; if (!this.hit(g, p.m, p.x + dx, p.y)) { p.x += dx; return true; } return false; },
    rotate(g) {
      const p = g.s.piece; if (!p || g.s.clearing || p.t === 'O') return; const n = p.m.length, r = p.m.map((row) => row.slice());
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) r[x][n - 1 - y] = p.m[y][x];
      for (const k of [0, -1, 1, -2, 2]) if (!this.hit(g, r, p.x + k, p.y)) { p.m = r; p.x += k; Sound.play('tick'); return; }
    },
    drop(g) { const s = g.s; if (!s.piece || s.clearing) return false; if (!this.hit(g, s.piece.m, s.piece.x, s.piece.y + 1)) { s.piece.y++; return true; } this.lock(g); return false; },
    hard(g) { const s = g.s; if (!s.piece || s.clearing) return; let n = 0; while (!this.hit(g, s.piece.m, s.piece.x, s.piece.y + 1)) { s.piece.y++; n++; } g.score += n; g.bump(3); Sound.play('land'); this.lock(g); },
    lock(g) {
      const s = g.s, p = s.piece; p.m.forEach((row, y) => row.forEach((v, x) => { if (v && p.y + y >= 0) s.grid[p.y + y][p.x + x] = p.t; })); s.piece = null;
      const rows = []; for (let r = 0; r < this.R; r++) if (s.grid[r].every(Boolean)) rows.push(r);
      if (rows.length) { s.clearing = { rows, t: 0 }; Sound.play('clear'); rows.forEach((r) => { for (let x = 0; x < this.C; x++) g.burst(this.OX + x * this.S + 14, this.OY + r * this.S + 14, BCOL[s.grid[r][x]], 2, 260); }); }
      else { g.miss(); this.spawn(g); }
    },
    key(g, k, d) {
      if (!d) { if (k === 'ArrowLeft' || k === 'ArrowRight') g.s.das = 0; return; }
      if (k === 'ArrowLeft' || k === 'KeyA') { this.move(g, -1); g.s.das = 0; } else if (k === 'ArrowRight' || k === 'KeyD') { this.move(g, 1); g.s.das = 0; }
      else if (k === 'ArrowUp' || k === 'KeyW' || k === 'KeyX') this.rotate(g); else if (k === 'Space') this.hard(g);
    },
    ptr(g, t) { if (t === 'down') this.rotate(g); },
    update(g, dt) {
      const s = g.s;
      if (s.clearing) {
        s.clearing.t += dt;
        if (s.clearing.t > .32) {
          const rows = s.clearing.rows, n = rows.length; s.grid = s.grid.filter((_, i) => !rows.includes(i)); while (s.grid.length < this.R) s.grid.unshift(Array(this.C).fill(null));
          const base = [0, 100, 300, 500, 800][n]; s.lines += n; g.hit(this.OX + 140, this.OY + rows[0] * this.S, base, '#fff', ['', 'SINGLE', 'DOUBLE!', 'TRIPLE!', 'BLOCK DROP!'][n]); g.ring(this.OX + 140, this.OY + rows[0] * this.S, '#ffd23f'); g.bump(4 + n * 2);
          g.extra = s.lines; s.clearing = null; this.spawn(g);
        }
        return;
      }
      const left = g.keys.ArrowLeft || g.keys.KeyA, right = g.keys.ArrowRight || g.keys.KeyD;
      if (left !== right && (left || right)) { s.das += dt; if (s.das > .17) { s.das -= .055; this.move(g, left ? -1 : 1); } } else s.das = 0;
      const lvl = Math.floor(g.t / 6000), iv = (g.keys.ArrowDown || g.keys.KeyS) ? .045 : Math.max(.12, .40 - lvl * .06);
      s.grav += dt; while (s.grav >= iv && s.piece) { s.grav -= iv; this.drop(g); if (s.clearing) break; }
    },
    draw(c, g) {
      const s = g.s, S = this.S, OX = this.OX, OY = this.OY;
      c.fillStyle = 'rgba(10,15,40,.38)'; rr(c, OX - 6, OY - 6, this.C * S + 12, this.R * S + 12, 14); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = 1; for (let x = 1; x < this.C; x++) { c.beginPath(); c.moveTo(OX + x * S, OY); c.lineTo(OX + x * S, OY + this.R * S); c.stroke(); } for (let y = 1; y < this.R; y++) { c.beginPath(); c.moveTo(OX, OY + y * S); c.lineTo(OX + this.C * S, OY + y * S); c.stroke(); }
      const cell = (x, y, t, a) => { c.globalAlpha = a || 1; const col = BCOL[t]; c.fillStyle = col; rr(c, OX + x * S + 1, OY + y * S + 1, S - 2, S - 2, 6); c.fill(); c.fillStyle = 'rgba(255,255,255,.35)'; rr(c, OX + x * S + 4, OY + y * S + 4, S - 8, 6, 3); c.fill(); c.globalAlpha = 1; };
      s.grid.forEach((row, y) => row.forEach((t, x) => { if (t) { if (s.clearing && s.clearing.rows.includes(y)) { const k = s.clearing.t / .32; c.globalAlpha = 1; cell(x, y, t); c.fillStyle = `rgba(255,255,255,${.4 + .6 * Math.sin(k * 14) ** 2})`; rr(c, OX + x * S, OY + y * S, S, S, 6); c.fill(); } else cell(x, y, t); } }));
      const p = s.piece; if (p) {
        let gy = p.y; while (!this.hit(g, p.m, p.x, gy + 1)) gy++;
        p.m.forEach((row, y) => row.forEach((v, x) => { if (v) { c.globalAlpha = .22; c.fillStyle = '#fff'; rr(c, OX + (p.x + x) * S + 2, OY + (gy + y) * S + 2, S - 4, S - 4, 6); c.fill(); c.globalAlpha = 1; } }));
        p.m.forEach((row, y) => row.forEach((v, x) => { if (v) cell(p.x + x, p.y + y, p.t); }));
      }
      // side panel
      const px = OX + this.C * S + 22; c.fillStyle = 'rgba(10,15,40,.38)'; rr(c, px, OY, 120, 120, 14); c.fill();
      c.fillStyle = 'rgba(255,255,255,.8)'; c.font = '800 13px system-ui,sans-serif'; c.textAlign = 'center'; c.fillText('NEXT', px + 60, OY + 22);
      const nm = SHAPES[s.next], sz = 22, ox = px + 60 - (nm[0].length * sz) / 2, oy = OY + 70 - (nm.length * sz) / 2 + 6;
      nm.forEach((row, y) => row.forEach((v, x) => { if (v) { c.fillStyle = BCOL[s.next]; rr(c, ox + x * sz, oy + y * sz, sz - 2, sz - 2, 5); c.fill(); } }));
      c.fillStyle = 'rgba(10,15,40,.38)'; rr(c, px, OY + 136, 120, 84, 14); c.fill(); c.fillStyle = 'rgba(255,255,255,.8)'; c.fillText('LINES', px + 60, OY + 160); c.font = '900 34px system-ui,sans-serif'; c.fillStyle = '#fff'; c.fillText(s.lines, px + 60, OY + 203);
    }
  };

  /* ============================== GAME: COLOR POP ============================== */
  const colorPop = {
    id: 'pop', name: 'Color Pop', icon: '🫧', blurb: 'Pop groups of matching bubbles for huge combos.',
    how: '<b>Tap / click</b> a group of 2+ matching bubbles to pop it. Bigger groups and quick chains score more. Keyboard: arrows + Space.',
    buttons: [],
    C: 8, R: 10, S: 54, OX: 24, OY: 70,
    init(g) {
      const s = g.s = { grid: [], pops: [], cur: { x: 0, y: 0 }, last: -9, hov: null, usedKey: false };
      for (let r = 0; r < this.R; r++) { s.grid.push([]); for (let x = 0; x < this.C; x++) s.grid[r].push(this.make(r, x, ri(0, 4))); }
    },
    make(r, x, col, y0) { return { col, y: y0 === undefined ? r * this.S : y0, vy: 0 }; },
    group(g, cx, cy) {
      const s = g.s, b = s.grid[cy] && s.grid[cy][cx]; if (!b) return [];
      const seen = new Set([cy * 100 + cx]), out = [[cx, cy]], st = [[cx, cy]];
      while (st.length) { const [x, y] = st.pop(); [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const nx = x + dx, ny = y + dy, k = ny * 100 + nx; if (nx < 0 || ny < 0 || nx >= this.C || ny >= this.R || seen.has(k)) return; const nb = s.grid[ny][nx]; if (nb && nb.col === b.col) { seen.add(k); out.push([nx, ny]); st.push([nx, ny]); } }); }
      return out;
    },
    popAt(g, cx, cy) {
      const s = g.s, grp = this.group(g, cx, cy), S = this.S;
      if (grp.length < 2) { g.text('Need 2+', this.OX + cx * S + S / 2, this.OY + cy * S, '#fff'); Sound.play('bad'); return; }
      if (g.t - s.last > 2200) g.miss(); s.last = g.t;
      const n = grp.length; let mx = 0, my = 0; const col = PAL[s.grid[cy][cx].col];
      grp.forEach(([x, y]) => { const b = s.grid[y][x], px = this.OX + x * S + S / 2, py = this.OY + b.y + S / 2; mx += px; my += py; s.pops.push({ x: px, y: py, col: b.col, t: 0 }); g.burst(px, py, PAL[b.col], 5, 200); s.grid[y][x] = null; });
      g.hit(mx / n, my / n, n * 8 + (n >= 5 ? 20 : 0) + (n >= 8 ? 40 : 0), col, n >= 8 ? 'MEGA!' : n >= 5 ? 'BIG!' : ''); if (n >= 5) g.ring(mx / n, my / n, col); Sound.play('pop');
      // gravity + refill
      for (let x = 0; x < this.C; x++) {
        const col2 = []; for (let r = this.R - 1; r >= 0; r--) if (s.grid[r][x]) col2.push(s.grid[r][x]);
        let miss = this.R - col2.length; for (let i = 0; i < miss; i++) col2.push(this.make(0, x, ri(0, 4), -(i + 1) * S - rnd(0, 40)));
        for (let r = this.R - 1, i = 0; r >= 0; r--, i++) s.grid[r][x] = col2[i];
      }
      if (!this.anyMove(g)) { for (let r = 0; r < this.R; r++) for (let x = 0; x < this.C; x++) s.grid[r][x].col = ri(0, 4); g.text('Shuffle!', W / 2, 150, '#fff', true); }
    },
    anyMove(g) { const s = g.s; for (let r = 0; r < this.R; r++) for (let x = 0; x < this.C; x++) { const c = s.grid[r][x].col; if ((x + 1 < this.C && s.grid[r][x + 1].col === c) || (r + 1 < this.R && s.grid[r + 1][x].col === c)) return true; } return false; },
    cellAt(x, y) { return { x: Math.floor((x - this.OX) / this.S), y: Math.floor((y - this.OY) / this.S) }; },
    ptr(g, t, x, y) { const s = g.s, p = this.cellAt(x, y); s.usedKey = false; if (p.x < 0 || p.y < 0 || p.x >= this.C || p.y >= this.R) { s.hov = null; return; } s.hov = p; if (t === 'down') this.popAt(g, p.x, p.y); },
    key(g, k, d) {
      if (!d) return; const s = g.s; s.usedKey = true;
      if (k === 'ArrowLeft') s.cur.x = Math.max(0, s.cur.x - 1); else if (k === 'ArrowRight') s.cur.x = Math.min(this.C - 1, s.cur.x + 1); else if (k === 'ArrowUp') s.cur.y = Math.max(0, s.cur.y - 1); else if (k === 'ArrowDown') s.cur.y = Math.min(this.R - 1, s.cur.y + 1); else if (k === 'Space' || k === 'Enter') this.popAt(g, s.cur.x, s.cur.y);
    },
    update(g, dt) {
      const s = g.s, S = this.S;
      for (let r = 0; r < this.R; r++) for (let x = 0; x < this.C; x++) { const b = s.grid[r][x]; if (!b) continue; const ty = r * S; if (b.y < ty || b.vy) { b.vy += 2600 * dt; b.y += b.vy * dt; if (b.y >= ty) { b.y = ty; b.vy = b.vy > 300 ? -b.vy * .22 : 0; } } }
      s.pops.forEach((p) => { p.t += dt; }); s.pops = s.pops.filter((p) => p.t < .25);
    },
    draw(c, g) {
      const s = g.s, S = this.S;
      c.fillStyle = 'rgba(10,15,40,.30)'; rr(c, this.OX - 10, this.OY - 10, this.C * S + 20, this.R * S + 20, 22); c.fill();
      c.save(); rr(c, this.OX - 4, this.OY - 4, this.C * S + 8, this.R * S + 8, 16); c.clip();
      let hovSet = null; const tgt = s.usedKey ? s.cur : s.hov; if (tgt) { const gp = this.group(g, tgt.x, tgt.y); if (gp.length >= 2) hovSet = new Set(gp.map(([x, y]) => y * 100 + x)); }
      for (let r = 0; r < this.R; r++) for (let x = 0; x < this.C; x++) {
        const b = s.grid[r][x]; if (!b) continue; const cx = this.OX + x * S + S / 2, cy = this.OY + b.y + S / 2, hot = hovSet && hovSet.has(r * 100 + x), rad = S / 2 - 4 + (hot ? 2 : 0), col = PAL[b.col];
        const gr = c.createRadialGradient(cx - rad * .35, cy - rad * .4, 2, cx, cy, rad); gr.addColorStop(0, '#fff'); gr.addColorStop(.25, col); gr.addColorStop(1, shade(col, -.18));
        c.fillStyle = gr; c.beginPath(); c.arc(cx, cy, rad, 0, TAU); c.fill();
        c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.ellipse(cx - rad * .35, cy - rad * .45, rad * .22, rad * .12, -.6, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 2; c.fillStyle = 'rgba(255,255,255,.75)'; const m = b.col, q = rad * .32;
        c.beginPath(); if (m === 0) c.arc(cx, cy + 3, q * .6, 0, TAU); else if (m === 1) { c.moveTo(cx - q, cy + 3); c.lineTo(cx + q, cy + 3); } else if (m === 2) { c.moveTo(cx, cy - q + 3); c.lineTo(cx + q, cy + q + 3); c.lineTo(cx - q, cy + q + 3); c.closePath(); } else if (m === 3) { c.rect(cx - q * .7, cy + 3 - q * .7, q * 1.4, q * 1.4); } else { c.moveTo(cx, cy - q + 3); c.lineTo(cx + q, cy + 3); c.lineTo(cx, cy + q + 3); c.lineTo(cx - q, cy + 3); c.closePath(); }
        c.stroke(); if (hot) { c.strokeStyle = '#fff'; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, rad + 1, 0, TAU); c.stroke(); }
      }
      s.pops.forEach((p) => { const k = p.t / .25; c.globalAlpha = 1 - k; c.strokeStyle = PAL[p.col]; c.lineWidth = 5 * (1 - k); c.beginPath(); c.arc(p.x, p.y, S / 2 * (1 + k * .8), 0, TAU); c.stroke(); c.globalAlpha = 1; });
      c.restore();
      c.fillStyle = 'rgba(255,255,255,.85)'; c.font = '700 14px system-ui,sans-serif'; c.textAlign = 'center'; c.fillText('Tap a group of matching bubbles', W / 2, 40);
      if (s.usedKey) { c.strokeStyle = '#fff'; c.lineWidth = 3; rr(c, this.OX + s.cur.x * S + 2, this.OY + s.cur.y * S + 2, S - 4, S - 4, 12); c.stroke(); }
    }
  };

  const GAMES = [starCatcher, stackTower, snakeGarden, skyHopper, colorPop, blockDrop];
  return { play, GAMES, Sound, W, H };
})();
