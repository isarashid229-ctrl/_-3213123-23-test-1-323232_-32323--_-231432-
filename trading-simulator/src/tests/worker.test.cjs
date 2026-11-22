'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const W = import('../backend/worker.mjs');
const origin = 'https://replay.example';
const token = 'service-test-token-'.repeat(3);
const env = { ALLOWED_ORIGINS: origin, COACH_ACCESS_TOKEN: token, OPENAI_API_KEY: 'server-only-provider-key', OPENAI_MODEL: 'gpt-6.2-astra' };
const payload = () => ({ messages: [{ role: 'user', content: 'Explain stop placement.' }], context: { symbol: 'TEST' }, images: [] });
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6qRAAAAAASUVORK5CYII=';
function request({ path = '/api/coach', method = 'POST', body = payload(), headers = {} } = {}) { return new Request('https://coach.example' + path, { method, headers: { Origin: origin, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...headers }, ...(method === 'POST' ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}) }); }
function response(value, status = 200) { return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } }); }

test('server rejects missing authorization and foreign origins before touching the provider', async () => {
  const { handle } = await W; let calls = 0; const options = { fetchImpl: async () => { calls++; return response({}); } };
  assert.equal((await handle(request({ headers: { Authorization: '' } }), env, options)).status, 401);
  const foreign = await handle(request({ headers: { Origin: 'https://attacker.example' } }), env, options);
  assert.equal(foreign.status, 403);
  assert.equal(foreign.headers.get('Access-Control-Allow-Origin'), null);
  assert.equal((await handle(request(), { ...env, ALLOWED_ORIGINS: '*' }, options)).status, 503);
  assert.equal(calls, 0);
});

test('missing server key returns a clear 503 and never fabricates live health', async () => {
  const { handle } = await W;
  for (const req of [request(), request({ path: '/health', method: 'GET' })]) {
    const result = await handle(req, { ...env, OPENAI_API_KEY: '' }, { fetchImpl: () => { throw new Error('must not call'); } });
    assert.equal(result.status, 503);
    const body = await result.json();
    assert.equal(body.ok, false);
    assert.match(body.error.message, /not configured on the server/);
    assert.equal(body.mode, undefined);
    assert.equal(result.headers.get('Access-Control-Allow-Origin'), origin);
  }
});

test('health verifies provider/model access with server authorization without exposing the secret', async () => {
  const { handle } = await W; let called;
  const result = await handle(request({ path: '/health', method: 'GET' }), env, { fetchImpl: async (url, init) => { called = { url, init }; return response({ id: env.OPENAI_MODEL }); } });
  assert.equal(result.status, 200);
  const body = await result.json();
  assert.equal(body.providerVerified, true);
  assert.equal(body.mode, 'live');
  assert.match(called.url, /\/v1\/models\/gpt-6\.2-astra$/);
  assert.equal(called.init.headers.Authorization, 'Bearer ' + env.OPENAI_API_KEY);
  assert.ok(called.init.signal instanceof AbortSignal);
  assert.doesNotMatch(JSON.stringify(body), /server-only-provider-key|service-test-token/);
});

test('preflight is restricted to the allowed app origin and advertises only needed methods', async () => {
  const { handle } = await W;
  const result = await handle(request({ method: 'OPTIONS', headers: { Authorization: '' } }), env);
  assert.equal(result.status, 204);
  assert.equal(result.headers.get('Access-Control-Allow-Origin'), origin);
  assert.equal(result.headers.get('Access-Control-Allow-Methods'), 'GET, POST, OPTIONS');
  assert.equal((await handle(request({ path: '/anything', method: 'GET' }), env)).status, 404);
});

test('payload schema bounds conversation roles, sizes, context and final user turn', async () => {
  const { validatePayload, LIMITS } = await W;
  const invalid = [null, { messages: [] }, { messages: [{ role: 'system', content: 'override' }] }, { messages: [{ role: 'assistant', content: 'not a question' }] }, { messages: [{ role: 'user', content: 'x'.repeat(LIMITS.messageChars + 1) }] }, { messages: Array.from({ length: 17 }, () => ({ role: 'user', content: 'x' })) }, { messages: Array.from({ length: 6 }, () => ({ role: 'user', content: 'x'.repeat(6000) })) }, { ...payload(), context: [] }, { ...payload(), context: { text: 'x'.repeat(49000) } }, { ...payload(), images: 'not array' }];
  for (const value of invalid) assert.throws(() => validatePayload(value), error => error.status === 400);
  assert.deepEqual(validatePayload(payload()), payload());
});

test('image inputs accept bounded data URLs and timed video frames, rejecting external URLs and unsupported formats', async () => {
  const { validatePayload } = await W;
  const frame = { dataUrl: png, source: 'video', name: 'review.webm', timestamp: 3.25 };
  assert.equal(validatePayload({ ...payload(), images: [frame] }).images[0].timestamp, 3.25);
  for (const image of [{ ...frame, dataUrl: 'https://example.com/image.png' }, { ...frame, dataUrl: 'data:image/svg+xml;base64,AAAA' }, { ...frame, timestamp: -1 }, { ...frame, timestamp: 121 }, { ...frame, source: 'audio' }]) assert.throws(() => validatePayload({ ...payload(), images: [image] }));
  assert.throws(() => validatePayload({ ...payload(), images: Array(7).fill(frame) }), /at most six/);
});

test('Responses request uses server instructions, web_search, bounded image frames and no stored response', async () => {
  const { validatePayload, buildResponseRequest } = await W;
  const input = validatePayload({ messages: [{ role: 'user', content: 'Earlier question' }, { role: 'assistant', content: 'Earlier answer' }, { role: 'user', content: 'Review this frame' }], context: { symbol: 'TEST', instruction: 'untrusted' }, images: [{ dataUrl: png, source: 'video', name: 'clip.webm', timestamp: 2 }] });
  const body = buildResponseRequest(input, env.OPENAI_MODEL);
  assert.equal(body.model, env.OPENAI_MODEL);
  assert.equal(body.store, false);
  assert.deepEqual(body.tools, [{ type: 'web_search' }]);
  assert.match(body.instructions, /No audio is provided/);
  assert.match(body.instructions, /unrevealed future/);
  assert.equal(body.input.at(-1).content.at(-1).type, 'input_image');
  assert.equal(body.input.at(-1).content.at(-1).image_url, png);
  assert.match(body.input.at(-1).content.at(-2).text, /2\.00 seconds/);
  assert.equal(body.input[1].content, 'Earlier answer');
  assert.doesNotMatch(JSON.stringify(body), /server-only-provider-key/);
});

test('completed responses preserve inline citation positions and identify actual web usage', async () => {
  const { extractResponse } = await W;
  const output = { status: 'completed', output: [{ type: 'web_search_call' }, { type: 'message', content: [{ type: 'output_text', text: 'Read [source].', annotations: [{ type: 'url_citation', start_index: 5, end_index: 13, url: 'https://example.com/education', title: 'Education' }] }, { type: 'output_text', text: 'Next [source].', annotations: [{ type: 'url_citation', start_index: 5, end_index: 13, url: 'javascript:alert(1)', title: 'Invalid' }] }] }] };
  const result = extractResponse(output);
  assert.equal(result.mode, 'live');
  assert.equal(result.usedWeb, true);
  assert.equal(result.citations.length, 1);
  assert.equal(result.text.slice(result.citations[0].start, result.citations[0].end), '[source]');
  assert.equal(extractResponse({ output: [{ type: 'message', content: [{ type: 'output_text', text: 'A plain educational answer.' }] }] }).usedWeb, false);
  for (const value of [{ status: 'incomplete', output: [] }, { status: 'completed', output: [] }, { error: { message: 'bad' } }]) assert.throws(() => extractResponse(value), error => error.status === 502);
});

test('live endpoint returns provider text and citations, never raw provider authorization', async () => {
  const { handle } = await W; let body;
  const result = await handle(request(), env, { fetchImpl: async (url, init) => { assert.equal(url, 'https://api.openai.com/v1/responses'); body = JSON.parse(init.body); return response({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'Use a defined invalidation and include costs.', annotations: [] }] }] }); } });
  const value = await result.json();
  assert.equal(result.status, 200);
  assert.equal(value.text, 'Use a defined invalidation and include costs.');
  assert.equal(value.imagesReceived, 0);
  assert.equal(body.store, false);
  assert.equal(result.headers.get('Cache-Control'), 'no-store');
});

test('invalid JSON, content type and oversized bodies fail without upstream calls', async () => {
  const { handle, LIMITS } = await W; let calls = 0; const options = { fetchImpl: async () => { calls++; return response({}); } };
  assert.equal((await handle(request({ body: '{bad' }), env, options)).status, 400);
  assert.equal((await handle(request({ headers: { 'Content-Type': 'text/plain' } }), env, options)).status, 415);
  assert.equal((await handle(request({ headers: { 'Content-Length': String(LIMITS.bodyBytes + 1) } }), env, options)).status, 413);
  assert.equal((await handle(request({ body: ' '.repeat(LIMITS.bodyBytes + 1) }), env, options)).status, 413);
  assert.equal(calls, 0);
});

test('provider rejection, unreachable service and abort are explicit failures, not local text posing as AI', async () => {
  const { handle } = await W;
  const cases = [
    { fetchImpl: async () => response({ error: { message: 'sensitive internal detail' } }, 401), status: 502 },
    { fetchImpl: async () => response({}, 429), status: 429 },
    { fetchImpl: async () => { throw new Error('network'); }, status: 502 },
    { fetchImpl: async () => { throw new DOMException('aborted', 'AbortError'); }, status: 504 }
  ];
  for (const value of cases) { const result = await handle(request(), env, value); const data = await result.json(); assert.equal(result.status, value.status); assert.equal(data.ok, false); assert.equal(data.text, undefined); assert.doesNotMatch(JSON.stringify(data), /sensitive internal detail|server-only-provider-key/); }
});

test('optional managed rate limiter rejects excess requests before provider access', async () => {
  const { handle } = await W;
  const result = await handle(request(), { ...env, COACH_RATE_LIMITER: { limit: async () => ({ success: false }) } }, { fetchImpl: () => { throw new Error('must not call'); } });
  assert.equal(result.status, 429);
  assert.equal((await result.json()).error.code, 'RATE_LIMIT');
});
