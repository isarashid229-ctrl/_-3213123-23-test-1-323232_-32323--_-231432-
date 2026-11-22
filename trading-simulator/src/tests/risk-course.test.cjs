const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const script = name => fs.readFileSync(path.join(root, name), 'utf8');
function load(files = ['academy.js', 'labs.js', 'guided.js', 'risk-course.js']) {
  const context = vm.createContext({ Math });
  for (const filename of files) vm.runInContext(script(filename), context, { filename });
  return context;
}
const ctx = load();
const A = ctx.ReplayAcademy;
const R = ctx.ReplayRiskCourse;
const modules = A.modules.filter(item => R.moduleIds.includes(item.id));
const cases = ctx.ReplayRiskCases.filter(item => R.caseIds.includes(item.id));
const sourceIds = new Set(A.sources.map(item => item.id));
const moduleIds = new Set(A.modules.map(item => item.id));
const lessons = A.modules.flatMap(module => module.lessons.map(lesson => ({ module, lesson })));
const lessonMap = new Map(lessons.map(item => [item.lesson.id, item]));
const words = value => String(value || '').trim().split(/\s+/).filter(Boolean).length;
const nonempty = (value, label) => assert.ok(typeof value === 'string' && value.trim(), label);
function unique(values, label) {
  assert.equal(new Set(values).size, values.length, label);
}
function references(values, allowed, label) {
  assert.ok(Array.isArray(values) && values.length, label + ': missing references');
  unique(values, label + ': duplicate reference');
  for (const value of values) assert.ok(allowed.has(value), label + ': unknown ' + value);
}

test('risk extension preserves the original curriculum and existing object identities', () => {
  const context = load(['academy.js']);
  const originalModules = context.ReplayAcademy.modules.slice();
  const originalSources = context.ReplayAcademy.sources.slice();
  const originalSnapshot = JSON.stringify(context.ReplayAcademy);
  vm.runInContext(script('risk-course.js'), context);
  for (let i = 0; i < originalModules.length; i++) assert.equal(context.ReplayAcademy.modules[i], originalModules[i]);
  for (let i = 0; i < originalSources.length; i++) assert.equal(context.ReplayAcademy.sources[i], originalSources[i]);
  const before = JSON.parse(originalSnapshot);
  assert.deepEqual(JSON.parse(JSON.stringify(context.ReplayAcademy.modules.slice(0, before.modules.length))), before.modules);
  assert.deepEqual(JSON.parse(JSON.stringify(context.ReplayAcademy.sources.slice(0, before.sources.length))), before.sources);
  assert.equal(context.ReplayAcademy.version, before.version, 'base assessment/version metadata must not be silently replaced');
  assert.equal(context.ReplayAcademy.modules.length, before.modules.length + 12);
});

test('all added lessons have substantial teaching, a worked example, and valid practice links', () => {
  assert.equal(modules.length, 12);
  assert.equal(modules.flatMap(item => item.lessons).length, 36);
  assert.equal(modules.flatMap(item => item.quiz).length, 60);
  const guidedIds = new Set(ctx.ReplayGuided.items.map(item => item.id));
  const legacyIds = new Set(ctx.ReplayLabs.items.map(item => item.id));
  unique(A.modules.map(item => item.id), 'global module IDs');
  unique(lessons.map(item => item.lesson.id), 'global lesson/progress IDs');
  for (const module of modules) {
    assert.equal(module.lessons.length, 3, module.id + ': lesson count');
    assert.ok(module.quiz.length >= 5, module.id + ': quiz breadth');
    assert.ok(guidedIds.has(module.guidedLabId), module.id + ': guided route');
    assert.ok(legacyIds.has(module.labId), module.id + ': legacy route');
    references(module.sourceIds, sourceIds, module.id);
    for (const lesson of module.lessons) {
      assert.ok(lesson.sections.length >= 3, lesson.id + ': teaching sequence');
      assert.ok(lesson.sections.some(section => words(section.example) >= 20), lesson.id + ': worked example');
      const content = lesson.sections.flatMap(section => [section.text, section.example, ...(section.bullets || [])]).filter(Boolean).join(' ');
      assert.ok(words(content) >= 175, lesson.id + ': substantive original content');
      nonempty(lesson.takeaway, lesson.id + ': takeaway');
      for (const stage of ['seeIt', 'tryIt', 'reviewIt']) nonempty(lesson.practiceFlow[stage], lesson.id + ': ' + stage);
      assert.equal(lesson.practiceFlow.tryIt, lesson.practice.task);
      assert.ok(guidedIds.has(lesson.practice.guidedLabId), lesson.id + ': actual guided lab exists');
      assert.ok(lesson.practice.successCriteria.length >= 2, lesson.id + ': observable criteria');
      assert.match(lesson.practice.scopeNote, /1×/);
      assert.match(lesson.practice.scopeNote, /does not model/);
    }
  }
});

test('quizzes and decisions are gradeable, distinct, explained, and not all in one answer position', () => {
  const questions = modules.flatMap(module => module.quiz);
  const check = (items, promptKey) => {
    unique(items.map(item => item[promptKey]), promptKey + ': duplicates');
    const positions = new Set();
    for (const item of items) {
      assert.equal(item.choices.length, 4, item[promptKey]);
      item.choices.forEach(choice => nonempty(choice, item[promptKey]));
      unique(item.choices, item[promptKey] + ': indistinguishable choices');
      assert.ok(Number.isInteger(item.answer) && item.answer >= 0 && item.answer < item.choices.length, item[promptKey]);
      assert.ok(words(item.explanation) >= 10, item[promptKey] + ': explanatory feedback beyond a bare answer');
      positions.add(item.answer);
    }
    assert.equal(positions.size, 4, 'correct answers should use all available positions');
  };
  check(questions, 'prompt');
  check(cases, 'scenario');
});

test('every decision has a real lesson, source links, and a lesson backlink', () => {
  assert.equal(cases.length, 36);
  unique(cases.map(item => item.id), 'risk decision IDs');
  const categories = new Set();
  for (const item of cases) {
    assert.match(item.id, /^risk-case-\d{2}$/);
    nonempty(item.title, item.id + ': title');
    nonempty(item.category, item.id + ': category');
    assert.ok(words(item.scenario) >= 16, item.id + ': concrete decision facts');
    assert.ok(moduleIds.has(item.moduleId), item.id + ': module route');
    const linked = lessonMap.get(item.lessonId);
    assert.ok(linked, item.id + ': lesson route');
    assert.equal(linked.module.id, item.moduleId, item.id + ': lesson belongs to module');
    assert.ok(linked.lesson.decisionCaseIds.includes(item.id), item.id + ': lesson backlink');
    assert.ok(linked.module.decisionCaseIds.includes(item.id), item.id + ': module backlink');
    references(item.sourceIds, sourceIds, item.id + ': sources');
    categories.add(item.category);
  }
  assert.equal(categories.size, 12, 'distinct risk domains');
  for (const module of modules) for (const lesson of module.lessons) {
    assert.equal(cases.filter(item => item.lessonId === lesson.id).length, 1, lesson.id + ': each lesson has its own decision');
  }
});

test('official and identified primary source links are HTTPS with unique IDs and checked dates', () => {
  unique(A.sources.map(item => item.id), 'global source IDs');
  const permitted = new Set(['www.finra.org', 'syndication.finra.org', 'www.cmegroup.com', 'www.fidelity.com', 'www.investor.gov', 'www.sec.gov', 'help.coinbase.com', 'www.coinbase.com', 'www.cftc.gov', 'www.theocc.com', 'www.optionseducation.org', 'help.topstep.com', 'www.nfa.futures.org']);
  for (const id of R.sourceIds) {
    const source = A.sources.find(item => item.id === id);
    assert.ok(source, id);
    assert.match(id, /^risk-/);
    const url = new URL(source.url);
    assert.equal(url.protocol, 'https:', id);
    assert.ok(permitted.has(url.hostname), id + ': primary publisher');
    assert.equal(source.checked, '2026-11-21', id + ': displayed local check date');
    nonempty(source.title, id + ': title');
    nonempty(source.publisher, id + ': publisher');
  }
  assert.equal(R.checked, '2026-11-21');
});

test('critical rule and scope qualifications are present where the user learns them', () => {
  const margin = lessonMap.get('risk-leverage-margin-3').lesson.sections.map(s => s.text).join(' ');
  assert.match(margin, /June 4, 2026/);
  assert.match(margin, /October 20, 2027/);
  assert.match(margin, /firm may still use the former approach/);
  assert.match(margin, /Cash-account payment and settlement rules are a separate subject/);
  const atr = lessonMap.get('risk-stop-evidence-3').lesson.sections.map(s => s.text).join(' ');
  assert.match(atr, /not a forecast interval/);
  const probability = lessonMap.get('risk-drawdown-2').lesson.sections.map(s => s.text).join(' ');
  assert.match(probability, /arbitrary/);
  assert.match(probability, /not the probability of account ruin/);
  const prop = lessonMap.get('risk-prop-rules-2').lesson.sections.map(s => s.text).join(' ');
  assert.match(prop, /original teaching rules, not any provider’s current offer/);
  assert.match(R.scope, /1×/);
  assert.match(R.scope, /does not model broker margin, forced liquidation, option pricing/);
});

test('worked case answers agree with independently calculated account and contract arithmetic', () => {
  const answer = id => {
    const item = cases.find(value => value.id === 'risk-case-' + String(id).padStart(2, '0'));
    return item.choices[item.answer];
  };
  const money = value => '$' + Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const includes = (id, value) => assert.ok(answer(id).includes(value), 'case ' + id + ': expected independent result ' + value + ', got ' + answer(id));
  includes(1, money(120 * (75 - 72.5)));
  includes(3, String(Math.max(203 - 199, Math.abs(203 - 205), Math.abs(199 - 205))));
  includes(4, money(18000 * .04));
  includes(4, String(18000 * .04 / 6000 * 100) + '%');
  includes(5, money(1500 - 260 - 30 - 1100));
  includes(7, money(4 * 80));
  includes(8, money(15000 + 12000));
  includes(8, money(15000 * .05 + 12000 * .04));
  includes(9, money(180 - 80 - 60));
  includes(10, ((20000 - 14000) / 14000 * 100).toFixed(2) + '%');
  includes(11, money(Math.round(10000 * .9 ** 4)));
  includes(12, money(1000 - [50, 100, 200, 400].reduce((a, b) => a + b, 0)));
  includes(13, money(4 * 16 * 1.25 + 12));
  includes(14, money(2400 - 1900));
  includes(15, '−' + money(Math.round(20000 * (1.253 - 1.25))));
  includes(16, money(3 * .85 * 100 + 6));
  includes(17, money(Math.round((3.1 - 2.8) * 100)));
  includes(18, money(45 * 100));
  includes(19, money(30 * (46 - 28) + 18));
  includes(20, '$' + (24000 * .00015).toFixed(2));
  includes(21, money(3 * 400 * .85 - 3 * 300 * .75));
  includes(24, money(20 * 30 + 80 * 30.25 - 100 * 30));
  includes(25, String(750 / (75000 - 72000) * 100) + '%');
  includes(26, money(52100 - (54000 - 2500)));
  includes(26, money(52100 - (53000 - 2500)));
  includes(27, money(50750 - 1000 - 49000));
  includes(32, '−' + Math.abs(.55 * 1 - .45 * 1 - .15).toFixed(2) + 'R');
  includes(35, money(400 - 230 - 100));
});

test('loading the extension again preserves completed-reference identities and other extensions', () => {
  const context = load(['academy.js']);
  const earlierCase = { id: 'tax-case-before', title: 'An existing decision' };
  context.ReplayRiskCases = [earlierCase];
  vm.runInContext(script('risk-course.js'), context);
  const initialModules = context.ReplayAcademy.modules.slice();
  const initialCases = context.ReplayRiskCases.slice();
  const sourceCount = context.ReplayAcademy.sources.length;
  const glossaryCount = context.ReplayAcademy.glossary.length;
  context.ReplayRiskCases.push({ id: 'tax-case-after', title: 'A later decision' });
  vm.runInContext(script('risk-course.js'), context);
  assert.equal(context.ReplayAcademy.modules.length, initialModules.length);
  assert.equal(context.ReplayAcademy.sources.length, sourceCount);
  assert.equal(context.ReplayAcademy.glossary.length, glossaryCount);
  assert.equal(context.ReplayRiskCases.length, initialCases.length + 1);
  for (let i = 0; i < initialModules.length; i++) assert.equal(context.ReplayAcademy.modules[i], initialModules[i]);
  for (let i = 0; i < initialCases.length; i++) assert.equal(context.ReplayRiskCases[i], initialCases[i]);
  assert.equal(context.ReplayRiskCases[0], earlierCase);
  assert.ok(context.ReplayRiskCases.some(item => item.id === 'tax-case-after'));
});

test('risk and tax extensions preserve each other in either load order', () => {
  if (!fs.existsSync(path.join(root, 'tax-course.js'))) return;
  const riskFirst = load(['academy.js', 'risk-course.js', 'tax-course.js']);
  const taxFirst = load(['academy.js', 'tax-course.js', 'risk-course.js']);
  const sorted = items => Array.from(items, item => item.id).sort();
  assert.deepEqual(sorted(riskFirst.ReplayAcademy.modules), sorted(taxFirst.ReplayAcademy.modules));
  assert.deepEqual(sorted(riskFirst.ReplayAcademy.sources), sorted(taxFirst.ReplayAcademy.sources));
  assert.deepEqual(sorted(riskFirst.ReplayRiskCases), sorted(taxFirst.ReplayRiskCases));
  assert.equal(riskFirst.ReplayRiskCases.length, 48);
  unique(riskFirst.ReplayRiskCases.map(item => item.id), 'combined case IDs');
});
