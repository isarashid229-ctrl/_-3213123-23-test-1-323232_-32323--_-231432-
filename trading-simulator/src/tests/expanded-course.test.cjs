'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const plain = value => JSON.parse(JSON.stringify(value));
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const run = (context, file) => vm.runInContext(read(file), context, { filename: file });
function setup(order = ['risk-course.js', 'tax-course.js']) {
  const context = vm.createContext({ URL });
  context.window = context;
  for (const file of ['academy.js', 'labs.js', 'training.js', 'guided.js']) run(context, file);
  const core = {
    moduleObjects: context.ReplayAcademy.modules.slice(),
    modules: plain(context.ReplayAcademy.modules),
    training: plain(context.ReplayTraining),
    guided: plain(context.ReplayGuided.items),
    videos: plain(context.ReplayAcademy.videos),
    problems: plain(context.ReplayAcademy.problems)
  };
  for (const file of order) run(context, file);
  for (const file of ['risk-tools.js', 'coach.js']) run(context, file);
  return { context, core };
}
const fixture = setup();
const { ReplayAcademy: A, ReplayTraining: T, ReplayGuided: G, ReplayRiskCases: cases, ReplayRiskTools: R, ReplayCoach: C } = fixture.context;
const nonempty = (value, label) => assert.ok(typeof value === 'string' && value.trim(), label + ': missing text');
function unique(items, key, label) {
  const seen = new Set();
  for (const item of items) {
    nonempty(item[key], label);
    assert.ok(!seen.has(item[key]), label + ': duplicate ' + item[key]);
    seen.add(item[key]);
  }
  return seen;
}
function refs(values, valid, label) {
  assert.ok(Array.isArray(values) && values.length > 0, label + ': no references');
  for (const value of values) assert.ok(valid.has(value), label + ': unresolved ' + value);
}
function gradeable(item, label) {
  assert.ok(Array.isArray(item.choices) && item.choices.length >= 2, label + ': missing choices');
  item.choices.forEach(choice => nonempty(choice, label));
  assert.equal(new Set(item.choices.map(choice => choice.trim().toLowerCase())).size, item.choices.length, label + ': duplicate choices');
  assert.ok(Number.isInteger(item.answer) && item.answer >= 0 && item.answer < item.choices.length, label + ': invalid correct answer');
  nonempty(item.explanation, label + ': corrective explanation');
}

test('integrated curriculum contains 34 modules, 103 lessons, 170 module questions and 48 unique decisions', () => {
  assert.equal(A.modules.length, 34);
  assert.equal(A.modules.flatMap(module => module.lessons).length, 103);
  assert.equal(A.modules.flatMap(module => module.quiz).length, 170);
  assert.equal(cases.length, 48);
  unique(A.modules, 'id', 'module IDs');
  unique(A.modules.flatMap(module => module.lessons), 'id', 'globally persisted lesson IDs');
  unique(cases, 'id', 'decision IDs');
  unique(A.sources, 'id', 'source IDs');
  assert.equal(fixture.context.ReplayRiskCourse.moduleIds.length, 12);
  assert.equal(fixture.context.ReplayRiskCourse.caseIds.length, 36);
  assert.equal(fixture.context.ReplayTaxCourse.moduleIds.length, 6);
  assert.equal(fixture.context.ReplayTaxCourse.caseIds.length, 12);
  assert.equal(new Set(A.glossary.map(item => item.term.trim().toLowerCase())).size, A.glossary.length, 'extensions must not duplicate glossary terms');
});

test('extensions preserve existing course objects, lesson progress keys and learning resources', () => {
  const { core } = fixture;
  assert.equal(core.modules.length, 16);
  core.moduleObjects.forEach((module, index) => assert.equal(A.modules[index], module, 'extension replaced a core module'));
  assert.deepEqual(plain(A.modules.slice(0, 16)), core.modules);
  assert.deepEqual(plain(A.videos), core.videos);
  assert.deepEqual(plain(A.problems), core.problems);
  assert.deepEqual(plain(G.items), core.guided);
  for (const module of core.modules) for (const lesson of module.lessons) {
    assert.ok(A.modules.find(item => item.id === module.id).lessons.some(item => item.id === lesson.id), 'saved lesson key disappeared: ' + lesson.id);
  }
});

test('every decision points to its own module lesson and real source entries', () => {
  const modules = new Map(A.modules.map(module => [module.id, module]));
  const sources = new Set(A.sources.map(source => source.id));
  const reach = new Set();
  for (const item of cases) {
    nonempty(item.title, item.id + ': title');
    nonempty(item.category, item.id + ': category');
    nonempty(item.scenario, item.id + ': scenario');
    gradeable(item, item.id);
    assert.ok(modules.has(item.moduleId), item.id + ': unknown module');
    const module = modules.get(item.moduleId);
    assert.ok(module.lessons.some(lesson => lesson.id === item.lessonId), item.id + ': lesson belongs to a different or missing module');
    refs(item.sourceIds, sources, item.id + ': sources');
    reach.add(item.moduleId);
  }
  for (const id of [...fixture.context.ReplayRiskCourse.moduleIds, ...fixture.context.ReplayTaxCourse.moduleIds]) assert.ok(reach.has(id), id + ': no decision practice');
});

test('expanded lesson, quiz, source and guided-practice references resolve across both extensions', () => {
  const sources = new Set(A.sources.map(source => source.id));
  const oldLabs = new Set(fixture.context.ReplayLabs.items.map(lab => lab.id));
  const guided = new Set(G.items.map(lab => lab.id));
  const prompts = new Set();
  for (const module of A.modules) {
    refs(module.sourceIds, sources, module.id);
    assert.ok(oldLabs.has(module.labId), module.id + ': missing original lab');
    assert.ok(guided.has(module.guidedLabId), module.id + ': missing guided lab');
    assert.equal(module.quiz.length, 5, module.id + ': four of five implements the 80% pass threshold');
    for (const lesson of module.lessons) {
      nonempty(lesson.title, lesson.id);
      nonempty(lesson.takeaway, lesson.id + ': takeaway');
      assert.ok(lesson.sections.length > 0, lesson.id + ': no instructional sections');
      assert.ok(guided.has(lesson.practice?.guidedLabId), lesson.id + ': practice destination');
      for (const stage of ['seeIt', 'tryIt', 'reviewIt']) nonempty(lesson.practiceFlow?.[stage], lesson.id + ': ' + stage);
      assert.equal(lesson.practice.task, lesson.practiceFlow.tryIt, lesson.id + ': inconsistent assignment');
      if (lesson.sourceIds) refs(lesson.sourceIds, sources, lesson.id);
      for (const section of lesson.sections) {
        nonempty(section.heading, lesson.id + ': section heading');
        nonempty(section.text, lesson.id + ': section instruction');
        if (section.sourceIds) refs(section.sourceIds, sources, lesson.id + ': section sources');
      }
    }
    for (const question of module.quiz) {
      nonempty(question.prompt, module.id + ': question');
      assert.ok(!prompts.has(question.prompt), module.id + ': duplicated question prompt');
      prompts.add(question.prompt);
      gradeable(question, module.id + ': ' + question.prompt);
      if (question.sourceIds) refs(question.sourceIds, sources, module.id + ': quiz sources');
    }
  }
  for (const source of A.sources) {
    const url = new URL(source.url);
    assert.equal(url.protocol, 'https:', source.id + ': source must use HTTPS');
    assert.equal(url.username, '', source.id + ': URL credentials');
    assert.equal(url.password, '', source.id + ': URL credentials');
    assert.ok(!['example.com', 'example.org', 'localhost'].includes(url.hostname), source.id + ': placeholder source');
  }
});

test('loading either extension again is idempotent and load order does not discard the other extension', () => {
  for (const order of [['risk-course.js', 'tax-course.js'], ['tax-course.js', 'risk-course.js']]) {
    const { context } = setup(order), academy = context.ReplayAcademy;
    const before = plain({ academy, cases: context.ReplayRiskCases, training: context.ReplayTraining });
    const objects = academy.modules.slice();
    for (const file of [...order, ...order].reverse()) run(context, file);
    assert.deepEqual(plain({ academy, cases: context.ReplayRiskCases, training: context.ReplayTraining }), before);
    objects.forEach((module, index) => assert.equal(academy.modules[index], module));
    const sorted = values => plain(values).sort((a, b) => a.id.localeCompare(b.id));
    assert.deepEqual(sorted(academy.modules), sorted(A.modules), 'module content differs by extension order');
    assert.deepEqual(sorted(context.ReplayRiskCases), sorted(cases), 'decision content differs by extension order');
    assert.deepEqual(sorted(academy.sources), sorted(A.sources), 'sources differ by extension order');
  }
});

test('the 16-week core plan, 80 study sessions and stable diagnostic/capstone assessments survive expansion unchanged', () => {
  assert.deepEqual(plain(T), fixture.core.training);
  assert.equal(T.weeks.length, 16);
  assert.equal(T.weeks.reduce((count, week) => count + week.days.length, 0), 80);
  const coreIds = new Set(fixture.core.modules.map(module => module.id));
  const covered = new Set();
  const sessions = new Set();
  T.weeks.forEach((week, index) => {
    assert.equal(week.id, 'week-' + (index + 1));
    assert.equal(week.days.length, 5);
    refs(week.moduleIds, coreIds, week.id + ': preserved core plan references');
    week.moduleIds.forEach(id => covered.add(id));
    week.days.forEach((day, dayIndex) => {
      assert.equal(day.day, dayIndex + 1);
      sessions.add(week.id + ':' + day.day);
    });
  });
  assert.equal(sessions.size, 80);
  assert.equal(covered.size, 16, 'core plan covers each original module without pretending to cover the entire expanded library');
  assert.deepEqual(plain(T.exams.map(exam => [exam.id, exam.questions.length])), [['diagnostic', 12], ['capstone', 20]]);
  for (const exam of T.exams) {
    assert.equal(exam.passPercent, 80);
    for (const question of exam.questions) assert.ok(coreIds.has(question.moduleId), question.id + ': assessment review destination');
  }
  assert.equal(T.rubric.length, 8);
});

test('saved-case progress keeps all 48 known keys, bounds invalid values and drops foreign keys without mutation', () => {
  const saved = Object.fromEntries(cases.map((item, i) => [item.id, { passed: i % 2 === 0, attempts: i + 1, lastChoice: i % item.choices.length }]));
  const unknown = 'removed-case-from-old-backup';
  saved[unknown] = { passed: true, attempts: 999, lastChoice: 1 };
  const first = cases[0].id, second = cases[1].id, third = cases[2].id;
  saved[first] = { passed: 'true', attempts: 100001, lastChoice: -1 };
  saved[second] = { passed: true, attempts: 0, lastChoice: cases[1].choices.length };
  saved[third] = { passed: false, attempts: 2.5, lastChoice: '1' };
  const before = plain(saved), clean = plain(R.cleanProgress(saved, cases));
  assert.deepEqual(saved, before);
  assert.equal(Object.keys(clean).length, 48);
  assert.equal(clean[unknown], undefined);
  assert.deepEqual(clean[first], { passed: false, attempts: 100000, lastChoice: null });
  assert.deepEqual(clean[second], { passed: true, attempts: 1, lastChoice: null });
  assert.deepEqual(clean[third], { passed: false, attempts: 1, lastChoice: null });
  for (const item of cases.slice(3)) assert.deepEqual(clean[item.id], before[item.id]);
  assert.deepEqual(plain(R.cleanProgress(JSON.parse(JSON.stringify(clean)), cases)), clean, 'backup roundtrip must be stable');
  assert.deepEqual(plain(R.cleanProgress(null, cases)), {});
});

test('the offline coach indexes every module and retrieves local liquidation and wash-sale lessons honestly', () => {
  const index = C.buildIndex(A, G), moduleIds = new Set(index.map(item => item.moduleId).filter(Boolean));
  assert.equal(moduleIds.size, 34);
  for (const [question, expectedModule, content] of [
    ['Why can maintenance margin cause forced liquidation before my own stop is triggered?', 'risk-leverage-margin', /liquidation|maintenance|collateral/i],
    ['How do wash sales change replacement shares and adjusted basis?', 'tax-wash-sales', /wash|replacement|basis/i]
  ]) {
    const reply = C.localReply(question, { index, videos: A.videos });
    assert.equal(reply.mode, 'local');
    assert.ok(reply.references.some(reference => reference.moduleId === expectedModule), question + ': expected module was not retrieved');
    assert.match(reply.text, content);
    assert.doesNotMatch(reply.text, /^That question needs a live connection/, 'built-in concepts should be answerable offline');
    assert.deepEqual(plain(reply.citations), [], 'local retrieval must not manufacture live web citations');
    for (const reference of reply.references) if (reference.moduleId) assert.ok(A.modules.some(module => module.id === reference.moduleId));
  }
  const current = C.localReply('What are today’s latest IRS wash-sale rules?', { index, videos: A.videos });
  assert.equal(current.mode, 'local');
  assert.match(current.text, /needs a live connection and current source verification/);
  assert.equal(current.references.length, 0, 'current-rule requests cannot be presented as verified by a bundled lesson');
  assert.equal(fixture.context.fetch, undefined, 'the integration checks need no network or live API');
});
