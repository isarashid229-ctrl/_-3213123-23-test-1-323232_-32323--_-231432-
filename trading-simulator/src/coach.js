/* ReplayLab Coach. A transparent local course guide, with an optional secured
 * live service. No provider API key belongs in this file or browser settings.
 * Call ReplayCoach.create({getContext,openModule,openLab,getVideos,notify}).
 * getContext supplies revealed data only; this module additionally filters by
 * the current candle's time and caps context before it can leave the browser.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ReplayCoach = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const LIMITS = Object.freeze({ threads: 20, messages: 100, text: 6000, attachments: 4, imageBytes: 8 * 1024 * 1024, videoBytes: 25 * 1024 * 1024, queuedBytes: 32 * 1024 * 1024, historyBytes: 100 * 1024 * 1024, videoSeconds: 120, recordSeconds: 60, frames: 6, frameBytes: 512 * 1024 });
  const CONFIG_KEY = 'replaylab-coach-service-v1', TEXT_KEY = 'replaylab-coach-text-v1';
  const cut = (value, length = 1000) => typeof value === 'string' ? value.slice(0, length) : '';
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const uid = () => root.crypto?.randomUUID?.() || Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  const safeURL = value => { try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } };
  const niceNumber = value => Number(value).toLocaleString('en-US', { maximumSignificantDigits: 9 });
  const STOP_WORDS = new Set('a an and are as at be been but by can could do does explain for from get give go help how i if in into is it just know learn learning like me my of on or our please practice question replaylab show some tell than that the their them then there these they this to trading trade understand us use want was we what when where which why will with would you your'.split(' '));
  function tokens(value) { return [...new Set(String(value).toLowerCase().replace(/[^a-z0-9%]+/g, ' ').split(/\s+/).filter(word => word.length > 2 && !STOP_WORDS.has(word)).map(word => word.length > 4 && word.endsWith('s') ? word.slice(0, -1) : word))]; }

  function buildIndex(academy = {}, guided = {}) {
    const documents = [];
    for (const module of academy.modules || []) for (const lesson of module.lessons || []) for (const section of lesson.sections || []) {
      const text = [section.text, ...(section.bullets || []), section.example ? 'Worked example: ' + section.example : ''].filter(Boolean).join('\n');
      documents.push({ id: lesson.id + ':' + section.heading, title: section.heading, sourceTitle: module.title + ' · ' + lesson.title, text, moduleId: module.id, labId: module.labId, takeaway: lesson.takeaway, url: '#course/' + module.id, keywords: [module.title, lesson.title, section.heading, ...(module.skills || [])].join(' ') });
    }
    for (const guide of guided.items || []) for (const key of ['seeIt', 'tryIt', 'reviewIt']) {
      const part = guide.lesson?.[key]; if (!part) continue;
      documents.push({ id: guide.id + ':' + key, title: part.title || guide.title, sourceTitle: 'Guided practice · ' + guide.title, text: [part.text, part.example].filter(Boolean).join('\n'), moduleId: guide.moduleId, guideId: guide.id, videoIds: guide.videoIds || [], url: '#practice', keywords: guide.title + ' ' + guide.subtitle });
    }
    for (const item of academy.glossary || []) documents.push({ id: 'term:' + item.term, title: item.term, sourceTitle: 'ReplayLab glossary', text: item.definition, keywords: item.term });
    for (const item of academy.problems || []) documents.push({ id: 'problem:' + item.id, title: item.title, sourceTitle: 'Problem coach', text: [item.why, item.action, ...(item.checklist || [])].join('\n'), moduleId: item.moduleIds?.[0], labId: item.labIds?.[0], videoIds: item.videoIds || [], url: '#coach/' + item.id, keywords: item.title + ' ' + item.symptom });
    return documents.filter(document => document.text).map(document => ({ ...document, terms: tokens(document.keywords + ' ' + document.text), titleTerms: tokens(document.title + ' ' + document.keywords) }));
  }

  function retrieve(question, index, limit = 3) {
    let query = String(question).toLowerCase();
    const synonyms = [
      [/\b(buy|sell|button|execute|execution|reverse)\b/, 'market orders execution'],
      [/\b(size|sizing|shares|quantity|oversize)\b/, 'position sizing risk quantity'],
      [/\b(stopped|stopouts|stops)\b/, 'stop invalidation risk'],
      [/\b(candle|wick|body|red|green)\b/, 'candles open high low close'],
      [/\b(fomo|chase|chasing)\b/, 'chase late entry'],
      [/\b(revenge|overtrad|bored)\b/, 'overtrade psychology discipline'],
      [/\b(losing|losses|poor results)\b/, 'net expectancy risk review'],
      [/\b(indicator|ema|average|vwap)\b/, 'indicator moving average volume'],
      [/\b(start|beginner|next|first)\b/, 'foundation plan basics']
    ];
    for (const [pattern, expansion] of synonyms) if (pattern.test(query)) query += ' ' + expansion;
    const words = tokens(query);
    if (!words.length) return [];
    return index.map(document => {
      const matched = words.filter(word => document.terms.includes(word));
      const score = matched.length + words.filter(word => document.titleTerms.includes(word)).length * 2;
      return { ...document, score, matched: matched.length };
    }).filter(document => document.score >= 3 && document.matched >= Math.min(2, words.length)).sort((a, b) => b.score - a.score).slice(0, limit);
  }

  function sanitizeContext(raw = {}) {
    const context = {};
    for (const key of ['symbol', 'timeframe', 'source', 'route', 'selectedModule', 'selectedLab']) if (typeof raw[key] === 'string') context[key] = raw[key].slice(0, 200);
    if (Number.isInteger(raw.cursor) && raw.cursor >= 0) context.cursor = raw.cursor;
    const candle = item => {
      if (!item || !['time', 'open', 'high', 'low', 'close'].every(key => finite(item[key]))) return null;
      if (item.time < 0 || item.low <= 0 || item.high < Math.max(item.open, item.close) || item.low > Math.min(item.open, item.close)) return null;
      return { time: item.time, open: item.open, high: item.high, low: item.low, close: item.close, volume: finite(item.volume) && item.volume >= 0 ? item.volume : 0 };
    };
    const current = candle(raw.currentCandle);
    if (current) {
      context.currentCandle = current;
      context.revealedCandles = (Array.isArray(raw.revealedCandles) ? raw.revealedCandles : []).map(candle).filter(item => item && item.time <= current.time).slice(-80);
    }
    const account = raw.account;
    if (account && typeof account === 'object') {
      context.account = {};
      for (const key of ['balance', 'equity', 'initialBalance', 'feeRate', 'slippageRate']) if (finite(account[key])) context.account[key] = account[key];
      const p = account.position;
      if (p && current && finite(p.entryTime) && p.entryTime <= current.time) {
        context.account.position = { side: p.side === 'short' ? 'short' : 'long', plan: cut(p.plan, 1000) };
        for (const key of ['qty', 'entryPrice', 'entryTime', 'stop', 'target', 'plannedRisk', 'entryFee']) if (p[key] === null || finite(p[key])) context.account.position[key] = p[key];
      } else context.account.position = null;
      context.account.trades = (Array.isArray(account.trades) ? account.trades : []).filter(trade => current && finite(trade.exitTime) && trade.exitTime <= current.time).slice(-12).map(trade => {
        const result = { side: trade.side === 'short' ? 'short' : 'long', exitReason: cut(trade.exitReason, 80), plan: cut(trade.plan, 400), notes: cut(trade.notes, 400), followedPlan: typeof trade.followedPlan === 'boolean' ? trade.followedPlan : null };
        for (const key of ['qty', 'entryPrice', 'exitPrice', 'entryTime', 'exitTime', 'netPnl', 'fees', 'plannedRisk', 'rMultiple']) if (trade[key] === null || finite(trade[key])) result[key] = trade[key];
        return result;
      });
    }
    if (raw.learning && typeof raw.learning === 'object') {
      context.learning = {};
      for (const key of ['focus', 'moduleTitle', 'lessonTitle', 'guideTitle', 'problem']) if (typeof raw.learning[key] === 'string') context.learning[key] = cut(raw.learning[key], 200);
      for (const key of ['lessonsReviewed', 'modulesPassed', 'labsPassed']) if (finite(raw.learning[key])) context.learning[key] = raw.learning[key];
    }
    return context;
  }

  function localReply(question, options = {}) {
    const context = sanitizeContext(options.context), index = options.index || [], matches = retrieve(question, index), q = String(question).toLowerCase();
    const observedCandleQuestion = /\b(this|current|visible|latest)\b/.test(q) && /\b(candle|bar|chart)\b/.test(q);
    const needsLive = (!observedCandleQuestion && /\b(latest|today|tomorrow|tonight|news|earnings|forecast|predict|current price|up.to.date|search the web|browse)\b/.test(q)) || /\b(what should i buy|best stock to buy|which stock will)\b/.test(q);
    const mediaNote = options.attachmentCount ? '\n\nYour attachments are kept with this conversation. The Local guide has not inspected them. Connect a live service and send them there for image or sampled-frame analysis.' : '';
    const references = (needsLive ? [] : matches.slice(0, 2)).map(match => ({ title: match.sourceTitle, heading: match.title, moduleId: match.moduleId, labId: match.labId, guideId: match.guideId, url: match.url || '', text: match.text.slice(0, 3500) }));
    let answer;
    if (/^(hi|hello|hey|thanks|thank you)[.!\s]*$/.test(q.trim())) answer = 'You’re using the Local guide. I can find relevant course explanations, suggest a lab or video, and read the numbers already revealed in your replay. Try “Explain this candle”, “How do I buy or sell?”, or describe a trading habit you want to improve.';
    else if (needsLive) answer = 'That question needs a live connection and current source verification. The Local guide cannot look up news, today’s prices, or changing market rules, and it cannot predict future returns. Your replay shows historical data.\n\nConnect a secure coach service in settings for sourced research. For now, I can explain the related course concepts or help you review only the candles already revealed.';
    else if (/\b(buy|sell|order|button|close|reverse)\b/.test(q) && /\b(how|work|working|click|place|open|execute|close|reverse)\b/.test(q)) {
      const position = context.account?.position;
      answer = 'On the replay desk, enter a quantity and press Buy or Sell to place a paper market order at the current revealed close, with the simulator’s fees and adverse slippage. Protective exits are optional. Enable brackets when you want a stop and target; recalculate size after changing them.\n\n' + (position ? 'You currently have a paper ' + position.side + ' of ' + niceNumber(position.qty) + ' units. The opposite-side button closes that entire position. Reverse is the separate action that closes it and opens the other direction. ' : 'There is no open paper position in the supplied context. Buy opens a long; Sell opens a short. ') + 'If an order is rejected, read the ticket’s message: quantity, equity limit, selected risk budget, or a stop/target on the wrong side of the current fill can block entry. The end of a dataset permits closing, but no new entry.';
    } else if (/\b(this|current|visible|latest)\b/.test(q) && /\b(candle|bar|chart)\b/.test(q) && context.currentCandle) {
      const b = context.currentCandle;
      answer = 'For the currently revealed ' + (context.symbol || 'market') + ' ' + (context.timeframe || '') + ' candle: open ' + niceNumber(b.open) + ', high ' + niceNumber(b.high) + ', low ' + niceNumber(b.low) + ', close ' + niceNumber(b.close) + '. The body is ' + niceNumber(Math.abs(b.close - b.open)) + ' and the full range is ' + niceNumber(b.high - b.low) + '. It closed ' + (b.close > b.open ? 'above' : b.close < b.open ? 'below' : 'at') + ' its own open.\n\nThat describes an observed bar. It does not predict the next candle. Compare its location with earlier visible swing points, and state what would invalidate an entry before advancing. This reads app candle data, not an attachment.';
    } else if (/\b(equity|balance|position|pnl|profit|loss)\b/.test(q) && /\b(my|current|this|account)\b/.test(q) && context.account) {
      const a = context.account;
      answer = 'Your supplied paper account shows' + (finite(a.balance) ? ' a realized balance of ' + niceNumber(a.balance) : '') + (finite(a.equity) ? ' and equity of ' + niceNumber(a.equity) : '') + '. ' + (a.position ? 'An open ' + a.position.side + ' position remains exposed to the next revealed candles.' : 'No position is open.') + '\n\nBalance records realized results and fees already paid. Equity also reflects the marked gain or loss of an open position. A stop is a trigger, not a guarantee against a gap. Review the trade’s original thesis and risk budget separately from whether it is currently winning.';
    } else if (matches.length) {
      const first = matches[0];
      answer = 'From ' + first.sourceTitle + ':\n\n' + first.title + '\n' + first.text + (first.takeaway ? '\n\nPractice focus: ' + first.takeaway : '');
      if (matches[1] && matches[1].sourceTitle !== first.sourceTitle && matches[1].score >= first.score * 0.7) answer += '\n\nRelated guidance — ' + matches[1].title + '\n' + matches[1].text.slice(0, 1000);
    } else answer = 'That question needs a live connection or more specific course context. The Local guide searches the built-in lessons; it does not generate an AI answer, browse the web, or inspect attachments.\n\nTry a concrete topic such as stop placement, position size, market orders, candle structure, or reviewing a loss. To ask broader questions or analyze a screenshot, connect the secure coach service in settings.';
    const videoIds = new Set(matches.flatMap(match => match.videoIds || []));
    const words = tokens(question);
    const videos = (needsLive ? [] : options.videos || []).filter(video => safeURL(video.url)).map(video => ({ ...video, score: (videoIds.has(video.id) ? 20 : 0) + words.filter(word => tokens(video.title + ' ' + (video.topics || []).join(' ') + ' ' + video.why).includes(word)).length })).filter(video => video.score >= 2).sort((a, b) => b.score - a.score).slice(0, 2).map(video => ({ title: video.title, url: video.url, provider: video.provider, task: video.task }));
    return { mode: 'local', text: answer + mediaNote, references, videos, citations: [] };
  }

  function cleanConfig(raw = {}) {
    const endpoint = cut(raw.endpoint, 500).trim(), token = cut(raw.token, 300).trim();
    if (!endpoint) return { endpoint: '', token: '' };
    let url; try { url = new URL(endpoint); } catch { throw new Error('Enter the HTTPS URL of your deployed coach service.'); }
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error('Use HTTPS for the coach service (HTTP localhost is allowed for development).');
    if (url.username || url.password || url.search || url.hash) throw new Error('Use the service URL without credentials, a query, or a fragment.');
    if (/^sk-/i.test(token)) throw new Error('This looks like an OpenAI API key. Keep it on the server; enter the separate coach service access token here.');
    if (token.length < 32 || token.length > 256 || /\s|[\x00-\x1f]/.test(token)) throw new Error('Enter the coach service access token (32–256 characters, without spaces).');
    return { endpoint: (url.origin + url.pathname).replace(/\/(?:api\/coach|health)\/?$/, '').replace(/\/$/, ''), token };
  }

  function validateAttachment(file, queued = []) {
    if (!file || !finite(file.size) || file.size <= 0) throw new Error('Choose a nonempty image or video.');
    if (queued.length >= LIMITS.attachments) throw new Error('Attach at most four items per message.');
    const image = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type);
    const video = ['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg'].includes(file.type);
    if (!image && !video) throw new Error('Choose a PNG, JPG, WebP, GIF, MP4, WebM, MOV, or Ogg video.');
    if (file.size > (image ? LIMITS.imageBytes : LIMITS.videoBytes)) throw new Error(image ? 'Images must be 8 MB or smaller.' : 'Videos must be 25 MB or smaller.');
    if (queued.reduce((sum, item) => sum + item.size, 0) + file.size > LIMITS.queuedBytes) throw new Error('Keep this message’s attachments under 32 MB.');
    return { id: uid(), name: cut(file.name, 120) || (image ? 'Screenshot' : 'Video'), type: file.type, size: file.size, kind: image ? 'image' : 'video', blob: file, duration: null };
  }

  function textOnlyThread(thread) {
    return { ...thread, messages: thread.messages.map(message => ({ ...message, attachments: (message.attachments || []).map(({ blob, ...metadata }) => ({ ...metadata, unavailable: true })) })) };
  }

  function createStorage(environment = root, onWarning = () => {}) {
    let database = null, mode = 'memory', cache = new Map(), warned = '', closed = false;
    const deleted = new Set();
    const validThread = thread => thread && typeof thread.id === 'string' && Array.isArray(thread.messages);
    function readFallback() {
      const raw = JSON.parse(environment.localStorage.getItem(TEXT_KEY) || '[]');
      const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.threads) ? raw.threads : [];
      if (Array.isArray(raw?.deleted)) for (const id of raw.deleted) if (typeof id === 'string') deleted.add(id);
      return rows.filter(validThread);
    }
    const warn = value => { if (warned !== value) { warned = value; onWarning(value); } };
    const fallback = () => {
      try { environment.localStorage.setItem(TEXT_KEY, JSON.stringify({ version: 1, threads: [...cache.values()].map(textOnlyThread), deleted: [...deleted] })); mode = 'localstorage'; warn('Text history is saved in this browser. Media will remain available only for this page session because media storage is unavailable.'); }
      catch { mode = 'memory'; warn('Browser storage is unavailable. This conversation lasts only for this page session; export text before leaving.'); }
    };
    const ready = new Promise(resolve => {
      if (!environment.indexedDB) { resolve(null); return; }
      let request, settled = false; try { request = environment.indexedDB.open('replaylab-coach-v1', 1); } catch { resolve(null); return; }
      const timer = setTimeout(() => { settled = true; resolve(null); }, 2500);
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('threads')) request.result.createObjectStore('threads', { keyPath: 'id' }); };
      request.onsuccess = () => { clearTimeout(timer); if (settled || closed) { request.result.close(); resolve(null); return; } settled = true; database = request.result; mode = 'indexeddb'; resolve(database); };
      request.onerror = request.onblocked = () => { clearTimeout(timer); settled = true; resolve(null); };
    });
    async function transact(kind, operation) {
      return new Promise((resolve, reject) => { let result; const tx = database.transaction('threads', kind); const request = operation(tx.objectStore('threads')); if (request) request.onsuccess = () => { result = request.result; }; tx.oncomplete = () => resolve(result); tx.onerror = tx.onabort = () => reject(tx.error || new Error('Storage failed')); });
    }
    return {
      async load() {
        await ready;
        if (closed) return [];
        if (database) {
          try {
            const rows = await transact('readonly', store => store.getAll()); cache = new Map((rows || []).filter(validThread).map(thread => [thread.id, thread]));
            let recovered = []; try { recovered = readFallback(); } catch {}
            for (const id of deleted) { cache.delete(id); await transact('readwrite', store => store.delete(id)); }
            for (const thread of recovered) if (!deleted.has(thread.id) && (!cache.has(thread.id) || (thread.updated || 0) > (cache.get(thread.id).updated || 0))) { await transact('readwrite', store => store.put(thread)); cache.set(thread.id, thread); }
            try { environment.localStorage.removeItem?.(TEXT_KEY); } catch {}
            deleted.clear(); return [...cache.values()];
          } catch { database.close(); database = null; }
        }
        try { cache = new Map(readFallback().filter(thread => !deleted.has(thread.id)).map(thread => [thread.id, thread])); mode = 'localstorage'; } catch { mode = 'memory'; }
        if (mode !== 'indexeddb') warn(mode === 'memory' ? 'Browser storage is unavailable. Export text before leaving this page.' : 'Text history is available; attachment files require IndexedDB to survive a reload.');
        return [...cache.values()];
      },
      async save(thread) { if (closed) return; cache.set(thread.id, thread); deleted.delete(thread.id); await ready; if (closed) return; if (database) { try { await transact('readwrite', store => store.put(thread)); return; } catch { database.close(); database = null; } } fallback(); },
      async remove(id) { if (closed) return; cache.delete(id); deleted.add(id); await ready; if (closed) return; if (database) { try { await transact('readwrite', store => store.delete(id)); deleted.delete(id); return; } catch { database.close(); database = null; } } fallback(); },
      get mode() { return mode; }, close() { closed = true; database?.close(); database = null; }
    };
  }

  function frameFromImage(image, document) {
    const width = image.videoWidth || image.naturalWidth || image.width, height = image.videoHeight || image.naturalHeight || image.height;
    if (!(width > 0 && height > 0)) throw new Error('This attachment has no readable image dimensions.');
    let scale = Math.min(1, 1280 / Math.max(width, height)), result = '';
    const canvas = document.createElement('canvas'), context = canvas.getContext('2d');
    if (!context) throw new Error('This browser cannot prepare image frames.');
    for (let attempt = 0; attempt < 5; attempt++) {
      canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale));
      context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
      result = canvas.toDataURL('image/jpeg', Math.max(0.45, 0.82 - attempt * 0.08));
      if (result.length < LIMITS.frameBytes * 4 / 3) return result;
      scale *= 0.8;
    }
    throw new Error('The frame is still too large. Try a smaller screenshot.');
  }
  function waitMedia(media, event, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const done = () => { cleanup(); resolve(); }, bad = () => { cleanup(); reject(new Error('This browser could not decode the attachment. Try a PNG screenshot or a different video format.')); }, timer = setTimeout(bad, timeout);
      const cleanup = () => { clearTimeout(timer); media.removeEventListener(event, done); media.removeEventListener('error', bad); };
      media.addEventListener(event, done, { once: true }); media.addEventListener('error', bad, { once: true });
    });
  }
  async function openVideo(attachment, document) {
    const video = document.createElement('video'), url = URL.createObjectURL(attachment.blob);
    video.muted = true; video.preload = 'auto'; video.playsInline = true;
    try { const ready = waitMedia(video, 'loadedmetadata'); video.src = url; video.load(); await ready; const duration = Number.isFinite(video.duration) ? video.duration : attachment.duration; if (!(duration > 0) || duration > LIMITS.videoSeconds) throw new Error('Choose a video up to two minutes long with a readable duration.'); return { video, duration, cleanup: () => { video.pause(); video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url); } }; }
    catch (error) { video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url); throw error; }
  }
  async function attachmentFrames(attachments, document) {
    const frames = [], videos = attachments.filter(item => item.kind === 'video');
    let remaining = LIMITS.frames - attachments.filter(item => item.kind === 'image').length, remainingVideos = videos.length;
    for (const attachment of attachments) {
      if (!attachment.blob) throw new Error('The saved file for ' + attachment.name + ' is unavailable. Reattach it before sending.');
      if (attachment.kind === 'image') {
        const image = document.createElement('img'), url = URL.createObjectURL(attachment.blob);
        try { const ready = waitMedia(image, 'load'); image.src = url; await ready; frames.push({ source: 'image', name: attachment.name, dataUrl: frameFromImage(image, document) }); } finally { URL.revokeObjectURL(url); }
      } else {
        const count = Math.min(3, Math.ceil(remaining / remainingVideos)); remaining -= count; remainingVideos--;
        const media = await openVideo(attachment, document);
        try {
          for (let i = 0; i < count; i++) {
            const timestamp = count === 1 ? media.duration / 2 : Math.max(0.01, (media.duration - 0.08) * i / (count - 1));
            const ready = waitMedia(media.video, 'seeked'); media.video.currentTime = timestamp; await ready;
            frames.push({ source: 'video', name: attachment.name, timestamp, dataUrl: frameFromImage(media.video, document) });
          }
        } finally { media.cleanup(); }
      }
    }
    return frames;
  }

  // Browser UI is intentionally isolated from the paper-account and order APIs.
  function create(options = {}) {
    const document = root.document;
    if (!document?.body) throw new Error('The coach requires a browser document.');
    const previous = document.getElementById('replayCoach');
    if (previous) throw new Error('A ReplayLab coach is already mounted.');
    const host = document.createElement('div'); host.id = 'replayCoach'; host.className = 'rl-coach';
    host.innerHTML = `<button class="rc-launcher" type="button" data-rc="open" aria-label="Open trading coach" aria-expanded="false" aria-controls="rcDrawer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v10H9l-4 4V5Z"/><path d="M8 9h8M8 12h5"/></svg><span class="rc-launcher-label">Coach</span></button>
      <section id="rcDrawer" class="rc-drawer" role="dialog" aria-modal="false" aria-label="Trading coach" hidden>
        <header class="rc-header"><div class="rc-brand"><span class="rc-brand-icon" aria-hidden="true">↗</span><div><strong>Trading coach</strong><span id="rcStatus" class="rc-status">Local guide</span></div></div><div class="rc-header-actions"><button type="button" data-rc="settings" aria-label="Coach connection settings" title="Connection settings">⚙</button><button type="button" data-rc="close" aria-label="Close coach">×</button></div></header>
        <section id="rcSettings" class="rc-settings" aria-label="Coach service settings" hidden><h3>Connect your coach service</h3><p>The local guide works now. A deployed service enables live AI, web research and image review.</p><label>Service URL<input id="rcEndpoint" type="url" placeholder="https://your-coach.workers.dev" autocomplete="off"></label><label>Service access token<input id="rcToken" type="password" autocomplete="off" placeholder="Separate service token — never an API key"></label><p class="rc-small">Keep the OpenAI API key on your server. These connection settings are saved only in this browser.</p><div class="rc-settings-actions"><button type="button" data-rc="connect" class="rc-primary">Save &amp; test</button><button type="button" data-rc="disconnect">Use local guide</button></div><p id="rcConnectionMessage" class="rc-small" role="status">No live service connected.</p></section>
        <div class="rc-threadbar"><label class="rc-visually-hidden" for="rcThread">Conversation</label><select id="rcThread" aria-label="Choose a conversation"></select><button type="button" data-rc="new" title="New conversation" aria-label="New conversation">＋</button><button type="button" data-rc="export" title="Export conversation text">Export</button><button type="button" data-rc="delete" title="Delete this conversation" aria-label="Delete this conversation">⌫</button></div>
        <div id="rcContext" class="rc-context"></div>
        <div id="rcMessages" class="rc-messages" role="log" aria-live="polite" aria-relevant="additions text"></div>
        <div id="rcSuggestions" class="rc-suggestions"><button data-rc-ask="How do I buy or sell?" type="button">Buy &amp; sell</button><button data-rc-ask="Explain this candle" type="button">Read this candle</button><button data-rc-ask="Why do my stops keep getting hit?" type="button">Stop placement</button><button data-rc-ask="What should I practice next?" type="button">Next exercise</button></div>
        <div id="rcRecording" class="rc-recording" hidden><span id="rcRecordTime">Recording screen · 0:00</span><button type="button" data-rc="stoprecord">■ Stop recording</button></div>
        <div id="rcAttachments" class="rc-attachments" aria-label="Attachments ready to send"></div>
        <form id="rcForm" class="rc-composer"><label class="rc-visually-hidden" for="rcQuestion">Ask the coach</label><textarea id="rcQuestion" rows="2" maxlength="6000" placeholder="Ask about your chart, a mistake, or a lesson…"></textarea><div class="rc-compose-actions"><div><button type="button" data-rc="attach" title="Attach a screenshot or video">Attach</button><button type="button" data-rc="record" title="Record a screen you choose, up to 60 seconds">Record screen</button><input id="rcFiles" type="file" accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime,video/ogg" multiple hidden></div><button id="rcSend" class="rc-primary" type="submit">Send</button></div></form>
        <p id="rcPrivacy" class="rc-privacy">Attachments stay in this browser until you press Send to a connected service. Videos send selected frames, without audio. Local guide cannot inspect media.</p><p id="rcStorage" class="rc-storage">Loading browser history…</p><p id="rcFeedback" class="rc-feedback" role="status" hidden></p>
      </section>`;
    document.body.appendChild(host);
    const $ = id => host.querySelector('#' + id);
    let threads = [], activeId = '', queued = [], opened = false, destroyed = false, busy = false, addingFiles = false, live = false, connectionGeneration = 0, requestAbort = null, checkAbort = null, mediaSession = null, captureGeneration = 0, feedbackTimer = null, index = buildIndex(root.ReplayAcademy || {}, root.ReplayGuided || {}), config = { endpoint: '', token: '' };
    const objectUrls = new Set();
    const feedback = text => { if (destroyed) return; $('rcFeedback').textContent = text; $('rcFeedback').hidden = false; clearTimeout(feedbackTimer); feedbackTimer = setTimeout(() => { if (!destroyed) $('rcFeedback').hidden = true; }, 9000); options.notify?.(text); };
    const storage = createStorage(root, feedback);
    try { config = cleanConfig(JSON.parse(root.localStorage.getItem(CONFIG_KEY) || '{}')); } catch { /* A malformed or old config never enables live mode. */ }
    $('rcEndpoint').value = config.endpoint; $('rcToken').value = config.token;
    function currentThread() { return threads.find(thread => thread.id === activeId); }
    function getContext() { try { return sanitizeContext(options.getContext?.() || {}); } catch { return {}; } }
    function getVideos() { try { return options.getVideos?.() || root.ReplayAcademy?.videos || []; } catch { return []; } }
    function dateLabel(timestamp) { try { return root.ReplayTime?.format(timestamp / 1000) || new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(timestamp); } catch { return ''; } }
    function releaseUrls() { for (const url of objectUrls) URL.revokeObjectURL(url); objectUrls.clear(); }
    function blobURL(blob) { const url = URL.createObjectURL(blob); objectUrls.add(url); return url; }
    function node(tag, className, text) { const element = document.createElement(tag); if (className) element.className = className; if (text !== undefined) element.textContent = text; return element; }
    function updateStatus() { $('rcStatus').textContent = live ? 'Live AI + web' : 'Local guide'; $('rcStatus').dataset.live = String(live); $('rcStorage').textContent = storage.mode === 'indexeddb' ? 'Conversations and attachments saved in this browser.' : storage.mode === 'localstorage' ? 'Text saved in this browser · media lasts for this page session.' : 'Session only · export text before leaving this page.'; }
    function updateContext() { if (destroyed) return; const c = getContext(); $('rcContext').textContent = [c.symbol, c.timeframe, c.currentCandle ? 'Revealed close ' + niceNumber(c.currentCandle.close) : 'Course & practice guide', c.account?.position ? c.account.position.side + ' position open' : ''].filter(Boolean).join(' · '); }
    function renderCitationText(container, message) {
      const value = cut(message.text, 24000), citations = (message.citations || []).filter(c => Number.isInteger(c.start) && Number.isInteger(c.end) && c.start >= 0 && c.end > c.start && c.end <= value.length && safeURL(c.url)).sort((a, b) => a.start - b.start);
      let at = 0, count = 0;
      for (const citation of citations) { if (citation.start < at) continue; container.appendChild(document.createTextNode(value.slice(at, citation.start))); const link = node('a', 'rc-citation', '[' + (++count) + ' · ' + cut(citation.title, 65) + ']'); link.href = safeURL(citation.url); link.target = '_blank'; link.rel = 'noopener noreferrer'; container.appendChild(link); at = citation.end; }
      container.appendChild(document.createTextNode(value.slice(at)));
    }
    function mediaCard(attachment, removable) {
      const card = node('div', 'rc-media-card'), details = node('div', 'rc-media-details');
      if (attachment.blob) { const media = node(attachment.kind === 'video' ? 'video' : 'img', 'rc-media-preview'); media.src = blobURL(attachment.blob); if (attachment.kind === 'video') { media.controls = true; media.muted = true; media.preload = 'metadata'; } else media.alt = attachment.name; card.appendChild(media); }
      else card.appendChild(node('div', 'rc-media-missing', 'File unavailable after reload'));
      details.appendChild(node('strong', '', attachment.name)); details.appendChild(node('span', '', (attachment.kind === 'video' ? 'Video' : 'Image') + ' · ' + (attachment.size / (1024 * 1024)).toFixed(1) + ' MB' + (attachment.duration ? ' · ' + Math.round(attachment.duration) + 's' : ''))); card.appendChild(details);
      if (removable) { const remove = node('button', 'rc-media-remove', '×'); remove.type = 'button'; remove.dataset.rcRemove = attachment.id; remove.setAttribute('aria-label', 'Remove ' + attachment.name); card.appendChild(remove); }
      return card;
    }
    function render() {
      if (destroyed) return; releaseUrls();
      const thread = currentThread(), list = $('rcMessages'); list.replaceChildren();
      $('rcThread').replaceChildren();
      for (const item of [...threads].sort((a, b) => b.updated - a.updated)) { const option = node('option', '', item.title || 'New conversation'); option.value = item.id; option.selected = item.id === activeId; $('rcThread').appendChild(option); }
      for (const message of thread?.messages || []) {
        const article = node('article', 'rc-message rc-' + message.role), heading = node('div', 'rc-message-heading');
        heading.appendChild(node('strong', '', message.role === 'user' ? 'You' : message.mode === 'live' ? 'Live AI' + (message.usedWeb ? ' · web sources' : '') : 'Local guide')); heading.appendChild(node('time', '', dateLabel(message.created))); article.appendChild(heading);
        const content = node('div', 'rc-message-text'); renderCitationText(content, message); article.appendChild(content);
        if (message.attachments?.length) { const media = node('div', 'rc-message-media'); for (const attachment of message.attachments) media.appendChild(mediaCard(attachment, false)); article.appendChild(media); }
        const refs = node('div', 'rc-references');
        for (const reference of message.references || []) { const card = node('div', 'rc-reference'); card.appendChild(node('span', '', reference.title)); const actions = node('div', 'rc-reference-actions'); if (reference.moduleId) { const button = node('button', '', 'Read lesson'); button.type = 'button'; button.dataset.rcModule = reference.moduleId; actions.appendChild(button); } if (reference.labId) { const button = node('button', '', 'Try lab'); button.type = 'button'; button.dataset.rcLab = reference.labId; actions.appendChild(button); } card.appendChild(actions); refs.appendChild(card); }
        for (const video of message.videos || []) { const url = safeURL(video.url); if (!url) continue; const card = node('a', 'rc-video-link'); card.href = url; card.target = '_blank'; card.rel = 'noopener noreferrer'; card.appendChild(node('strong', '', video.title)); card.appendChild(node('span', '', video.provider + (video.task ? ' · ' + video.task : ''))); refs.appendChild(card); }
        if (refs.childNodes.length) article.appendChild(refs); list.appendChild(article);
      }
      if (!thread?.messages.length) { const intro = node('div', 'rc-welcome'); intro.appendChild(node('span', 'rc-welcome-symbol', '↗')); intro.appendChild(node('h3', '', 'Make your next decision clearer.')); intro.appendChild(node('p', '', 'Ask about a trading problem, read the revealed chart, or find a lesson and a video. The Local guide uses the built-in course.')); list.appendChild(intro); }
      if (busy) list.appendChild(node('div', 'rc-working', live ? 'Preparing your live response…' : 'Finding relevant course guidance…'));
      $('rcAttachments').replaceChildren(); for (const attachment of queued) $('rcAttachments').appendChild(mediaCard(attachment, true));
      $('rcSuggestions').hidden = !!thread?.messages.length;
      $('rcSend').textContent = busy ? 'Stop' : 'Send'; $('rcQuestion').disabled = busy; $('rcThread').disabled = busy; host.querySelector('[data-rc="new"]').disabled = busy; host.querySelector('[data-rc="delete"]').disabled = busy;
      updateStatus(); updateContext(); list.scrollTop = list.scrollHeight;
    }
    async function save(thread) { await storage.save(thread); if (!destroyed) updateStatus(); }
    async function newThread() { if (busy) return; if (threads.length >= LIMITS.threads) { feedback('You have 20 conversations. Export and delete one before starting another.'); return; } const thread = { id: uid(), title: 'New conversation', created: Date.now(), updated: Date.now(), messages: [] }; threads.push(thread); activeId = thread.id; queued = []; await save(thread); render(); $('rcQuestion').focus(); }
    function open(prefill) { if (destroyed) return; opened = true; $('rcDrawer').hidden = false; host.querySelector('.rc-launcher').setAttribute('aria-expanded', 'true'); if (typeof prefill === 'string') $('rcQuestion').value = prefill.slice(0, LIMITS.text); updateContext(); $('rcQuestion').focus(); }
    function close() { if (destroyed) return; opened = false; captureGeneration++; stopRecording(); $('rcDrawer').hidden = true; host.querySelector('.rc-launcher').setAttribute('aria-expanded', 'false'); host.querySelector('.rc-launcher').focus(); }
    async function checkConnection() {
      const generation = ++connectionGeneration; checkAbort?.abort(); live = false; updateStatus();
      try {
        config = cleanConfig({ endpoint: $('rcEndpoint').value, token: $('rcToken').value });
        if (!config.endpoint) throw new Error('Enter the URL and service token to enable live AI.');
        try { root.localStorage.setItem(CONFIG_KEY, JSON.stringify(config)); } catch { feedback('Connection settings will last only for this page session.'); }
        checkAbort = new AbortController(); const timer = setTimeout(() => checkAbort?.abort(), 10000);
        $('rcConnectionMessage').textContent = 'Checking service and provider access…';
        try { const response = await fetch(config.endpoint + '/health', { headers: { Authorization: 'Bearer ' + config.token }, signal: checkAbort.signal }); const result = await response.json(); if (!response.ok || !result.ok || result.mode !== 'live' || result.providerVerified !== true) throw new Error(result.error?.message || 'The service did not verify a live connection.'); if (generation !== connectionGeneration || destroyed) return; live = true; $('rcConnectionMessage').textContent = 'Connected to ' + new URL(config.endpoint).hostname + '. Live AI, web search and image inputs are enabled. A completed answer will identify whether web search was used.'; }
        finally { clearTimeout(timer); }
      } catch (error) { if (generation !== connectionGeneration || destroyed) return; live = false; $('rcConnectionMessage').textContent = error.name === 'AbortError' ? 'Connection check timed out. The Local guide remains available.' : error.message; }
      updateStatus();
    }
    function disconnect() { connectionGeneration++; checkAbort?.abort(); requestAbort?.abort(); live = false; config = { endpoint: '', token: '' }; $('rcEndpoint').value = ''; $('rcToken').value = ''; try { root.localStorage.removeItem(CONFIG_KEY); } catch {} $('rcConnectionMessage').textContent = 'Disconnected. The Local guide searches your built-in lessons.'; updateStatus(); }
    async function addFiles(files, duration) {
      if (busy || addingFiles) { feedback('Wait for the current response or attachment preparation to finish.'); return 0; }
      addingFiles = true; let added = 0;
      try { for (const file of files) {
        try {
          const attachment = validateAttachment(file, queued);
          const storedBytes = threads.flatMap(thread => thread.messages).flatMap(message => message.attachments || []).reduce((sum, item) => sum + (item.blob ? item.size : 0), 0);
          if (storedBytes + queued.reduce((sum, item) => sum + item.size, 0) + attachment.size > LIMITS.historyBytes) throw new Error('Local media has reached its 100 MB limit. Delete an old conversation before attaching more.');
          if (attachment.kind === 'video') { attachment.duration = duration || null; const media = await openVideo(attachment, document); attachment.duration = media.duration; media.cleanup(); }
          if (!destroyed) { queued.push(attachment); added++; }
        } catch (error) { feedback(error.message); }
      } } finally { addingFiles = false; }
      render(); return added;
    }
    function stopRecording() { if (!mediaSession) return; if (mediaSession.recorder.state !== 'inactive') mediaSession.recorder.stop(); for (const track of mediaSession.stream.getTracks()) track.stop(); clearInterval(mediaSession.timer); }
    async function startRecording() {
      if (busy || mediaSession) return;
      if (!root.navigator?.mediaDevices?.getDisplayMedia || !root.MediaRecorder || root.isSecureContext === false) { feedback('Screen recording is unavailable here. Use a secure desktop browser or attach a screenshot/video file.'); return; }
      const generation = ++captureGeneration;
      try {
        // This call occurs only in the Record screen button's user click handler.
        const stream = await root.navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        if (destroyed || !opened || generation !== captureGeneration) { for (const track of stream.getTracks()) track.stop(); return; }
        const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find(type => root.MediaRecorder.isTypeSupported(type));
        let recorder; try { recorder = new root.MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 1800000 } : undefined); } catch (error) { stream.getTracks().forEach(track => track.stop()); throw error; }
        const session = { recorder, stream, chunks: [], bytes: 0, start: Date.now(), timer: null }; mediaSession = session;
        $('rcRecording').hidden = false; $('rcRecordTime').textContent = 'Recording screen · 0:00';
        recorder.ondataavailable = event => { if (event.data?.size) { session.chunks.push(event.data); session.bytes += event.data.size; if (session.bytes >= LIMITS.videoBytes) stopRecording(); } };
        recorder.onerror = () => { feedback('The recording stopped because the browser reported an error.'); stopRecording(); };
        recorder.onstop = async () => {
          clearInterval(session.timer); session.stream.getTracks().forEach(track => track.stop()); if (mediaSession === session) mediaSession = null;
          if (destroyed) return; $('rcRecording').hidden = true;
          const duration = Math.min(LIMITS.recordSeconds + 1, (Date.now() - session.start) / 1000), blob = new Blob(session.chunks, { type: recorder.mimeType || 'video/webm' });
          if (!blob.size) { feedback('No recording was captured.'); return; }
          const extension = blob.type.includes('mp4') ? 'mp4' : 'webm', file = new File([blob], 'ReplayLab-screen-' + new Date().toISOString().replace(/[:.]/g, '-') + '.' + extension, { type: blob.type.split(';')[0] });
          const added = await addFiles([file], duration); if (added) feedback('Recording added locally. Press Send when you are ready to include it. No audio was captured.');
        };
        for (const track of stream.getVideoTracks()) track.addEventListener('ended', stopRecording, { once: true });
        recorder.start(1000);
        session.timer = setInterval(() => { const seconds = Math.floor((Date.now() - session.start) / 1000); if (!destroyed) $('rcRecordTime').textContent = 'Recording screen · ' + Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0'); if (seconds >= LIMITS.recordSeconds) stopRecording(); }, 1000);
      } catch (error) { if (error.name !== 'NotAllowedError') feedback('Could not start screen recording: ' + error.message); else feedback('Screen recording was not started. You can attach a file instead.'); }
    }
    async function ask(value) {
      await ready;
      if (destroyed || busy) return null;
      if (addingFiles) { feedback('Your attachment is still being prepared. Send it when the preview is ready.'); return null; }
      open();
      const question = cut(typeof value === 'string' ? value : $('rcQuestion').value, LIMITS.text).trim() || (queued.length ? 'Please help me review these attachments.' : '');
      if (!question) { $('rcQuestion').focus(); return null; }
      if (mediaSession) { feedback('Stop the recording before sending your message.'); return null; }
      const thread = currentThread(); if (thread.messages.length > LIMITS.messages - 2) { feedback('This conversation has reached 100 messages. Start a new one or export its text.'); return null; }
      const user = { id: uid(), role: 'user', text: question, created: Date.now(), attachments: queued }; queued = []; thread.messages.push(user); if (thread.title === 'New conversation') thread.title = question.slice(0, 52); thread.updated = Date.now(); $('rcQuestion').value = ''; busy = true; await save(thread); if (destroyed) return null; render();
      const context = getContext(), local = localReply(question, { context, index, videos: getVideos(), attachmentCount: user.attachments.length });
      let result = local;
      try {
        if (live && config.endpoint) {
          requestAbort = new AbortController();
          const images = await attachmentFrames(user.attachments, document);
          if (requestAbort.signal.aborted) throw new DOMException('Stopped', 'AbortError');
          const messages = []; let characters = 0;
          for (const message of [...thread.messages].reverse()) { const content = message.text.slice(0, LIMITS.text); if (messages.length >= 16 || characters + content.length > 30000) break; messages.unshift({ role: message.role, content }); characters += content.length; }
          const payload = { messages, context: { ...context, localReferences: local.references }, images };
          const timer = setTimeout(() => requestAbort?.abort(), 50000);
          try { const response = await fetch(config.endpoint + '/api/coach', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + config.token }, body: JSON.stringify(payload), signal: requestAbort.signal }); const data = await response.json(); if (!response.ok || !data.ok || data.mode !== 'live' || typeof data.text !== 'string' || !data.text.trim()) throw new Error(data.error?.message || 'The service returned no completed live answer.'); result = { mode: 'live', text: data.text.slice(0, 24000), citations: data.citations || [], usedWeb: data.usedWeb === true, references: local.references, videos: local.videos, imagesReceived: data.imagesReceived || 0 }; }
          finally { clearTimeout(timer); }
        }
      } catch (error) {
        if (error.name === 'AbortError') result = { mode: 'local', text: 'The live request was stopped or timed out. No completed live answer was saved. Your question and attachments remain in this conversation.', references: [], videos: [], citations: [] };
        else { live = false; result = { ...local, text: 'Live response unavailable: ' + error.message + '\n\nThe following is Local guide content, not an AI analysis.\n\n' + local.text }; $('rcConnectionMessage').textContent = 'Connection unavailable. Save & test to reconnect.'; }
      }
      if (destroyed) return null;
      const message = { ...result, id: uid(), role: 'assistant', created: Date.now(), attachments: [] }; thread.messages.push(message); thread.updated = Date.now(); busy = false; requestAbort = null; await save(thread); render(); $('rcQuestion').focus(); return message;
    }
    function exportThread() { const thread = currentThread(); if (!thread) return; const value = { format: 'ReplayLab coach text export', exportedAt: new Date().toISOString(), note: 'Attachment metadata is included; original media files and connection tokens are not exported.', thread: textOnlyThread(thread) }; const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }), url = URL.createObjectURL(blob), link = node('a'); link.href = url; link.download = 'ReplayLab-coach-' + thread.id + '.json'; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); feedback('Conversation text and attachment details exported. Original media stays in this browser.'); }
    async function deleteThread() { if (busy) return; const thread = currentThread(); if (!thread) return; if (!root.confirm('Delete this conversation and its saved attachments from this browser?')) return; await storage.remove(thread.id); threads = threads.filter(item => item.id !== thread.id); queued = []; if (!threads.length) await newThread(); else { activeId = threads.sort((a, b) => b.updated - a.updated)[0].id; render(); } }
    host.addEventListener('click', event => {
      const target = event.target.closest('button'); if (!target || !host.contains(target)) return;
      if (target.dataset.rcAsk) { ask(target.dataset.rcAsk); return; }
      if (target.dataset.rcModule) { options.openModule?.(target.dataset.rcModule); return; }
      if (target.dataset.rcLab) { options.openLab?.(target.dataset.rcLab); return; }
      if (target.dataset.rcRemove) { queued = queued.filter(item => item.id !== target.dataset.rcRemove); render(); return; }
      const actions = { open: () => opened ? close() : open(), close, settings: () => { $('rcSettings').hidden = !$('rcSettings').hidden; }, connect: checkConnection, disconnect, new: newThread, export: exportThread, delete: deleteThread, attach: () => $('rcFiles').click(), record: startRecording, stoprecord: stopRecording };
      actions[target.dataset.rc]?.();
    });
    $('rcForm').addEventListener('submit', event => { event.preventDefault(); if (busy) requestAbort?.abort(); else ask(); });
    $('rcQuestion').addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); if (!busy) ask(); } });
    $('rcDrawer').addEventListener('keydown', event => { event.stopPropagation(); if (event.key === 'Escape') { event.preventDefault(); close(); } });
    $('rcThread').addEventListener('change', event => { activeId = event.target.value; queued = []; render(); });
    $('rcFiles').addEventListener('change', async event => { await addFiles([...event.target.files]); event.target.value = ''; });
    $('rcDrawer').addEventListener('dragover', event => { if (event.dataTransfer?.types.includes('Files')) event.preventDefault(); });
    $('rcDrawer').addEventListener('drop', event => { if (event.dataTransfer?.files.length) { event.preventDefault(); addFiles([...event.dataTransfer.files]); } });
    const ready = (async () => { const saved = await storage.load(); threads = saved.filter(thread => thread && typeof thread.id === 'string' && Array.isArray(thread.messages)).slice(0, LIMITS.threads).map(thread => ({ ...thread, title: cut(thread.title, 80) || 'Conversation', messages: thread.messages.filter(message => ['user', 'assistant'].includes(message.role) && typeof message.text === 'string').slice(-LIMITS.messages) })); if (destroyed) return; if (!threads.length) await newThread(); else { activeId = [...threads].sort((a, b) => b.updated - a.updated)[0].id; render(); } if (config.endpoint) checkConnection(); })();
    function destroy() { if (destroyed) return; captureGeneration++; connectionGeneration++; requestAbort?.abort(); checkAbort?.abort(); stopRecording(); destroyed = true; clearTimeout(feedbackTimer); storage.close(); releaseUrls(); host.remove(); }
    return Object.freeze({ open, close, ask, updateContext, destroy });
  }

  return Object.freeze({ create, buildIndex, retrieve, localReply, sanitizeContext, cleanConfig, validateAttachment, createStorage, textOnlyThread, LIMITS });
});
