'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const extension = read('tax-course.js');
const plain = value => JSON.parse(JSON.stringify(value));
const expectedModules = ['tax-records', 'tax-wash-sales', 'tax-planning', 'tax-trader-status', 'tax-products', 'tax-business'];
function setup({ install = true, existingCases } = {}) {
  const context = vm.createContext({});
  context.window = context;
  for (const file of ['academy.js', 'labs.js', 'guided.js']) vm.runInContext(read(file), context, { filename: file });
  if (existingCases) context.ReplayRiskCases = existingCases;
  const before = {
    modules: context.ReplayAcademy.modules.slice(),
    sourceIds: context.ReplayAcademy.sources.map(item => item.id),
    moduleData: plain(context.ReplayAcademy.modules),
    glossary: plain(context.ReplayAcademy.glossary)
  };
  if (install) vm.runInContext(extension, context, { filename: 'tax-course.js' });
  return { context, before };
}
function nonempty(value, label) {
  assert.ok(typeof value === 'string' && value.trim().length > 0, label);
}
function unique(items, key, label) {
  const values = items.map(item => item[key]);
  assert.equal(new Set(values).size, values.length, label);
}
function references(values, valid, label) {
  assert.ok(Array.isArray(values) && values.length, label + ': missing references');
  values.forEach(value => assert.ok(valid.has(value), label + ': unknown ' + value));
}
function selected(module, index) { const item = module.quiz[index]; return item.choices[item.answer]; }
function dollars(text) { return Number(text.replace(/[^\d.-]/g, '')); }

test('extension requires the academy but has no DOM, network, or storage dependency', () => {
  const empty = vm.createContext({});
  assert.throws(() => vm.runInContext(extension, empty), /Load academy\.js before tax-course\.js/);
  const { context } = setup();
  assert.ok(context.ReplayTaxCourse);
  assert.equal(context.document, undefined);
  assert.equal(context.fetch, undefined);
  assert.equal(context.localStorage, undefined);
});

test('six tax modules append without changing existing lessons, quizzes, resources, or progress IDs', () => {
  const { context, before } = setup(), academy = context.ReplayAcademy;
  assert.deepEqual(plain(context.ReplayTaxCourse.moduleIds), expectedModules);
  assert.equal(academy.modules.length, before.modules.length + 6);
  before.modules.forEach((module, index) => assert.equal(academy.modules[index], module, 'existing module object was replaced'));
  assert.deepEqual(plain(academy.modules.slice(0, before.modules.length)), before.moduleData);
  assert.deepEqual(plain(academy.sources.slice(0, before.sourceIds.length).map(item => item.id)), plain(before.sourceIds));
  assert.deepEqual(plain(academy.glossary.slice(0, before.glossary.length)), before.glossary);
  assert.equal(context.ReplayTaxCourse.lessonCount, 19);
  assert.equal(context.ReplayTaxCourse.questionCount, 30);
  unique(academy.modules, 'id', 'module IDs');
  unique(academy.modules.flatMap(module => module.lessons), 'id', 'global lesson IDs');
  unique(academy.sources, 'id', 'source IDs');
  assert.equal(new Set(academy.glossary.map(item => item.term.toLowerCase())).size, academy.glossary.length);
});

test('each lesson has substantive instruction, an example, a concrete drill, and exact source/lab links', () => {
  const { context } = setup(), academy = context.ReplayAcademy;
  const sources = new Set(academy.sources.map(item => item.id));
  const oldLabs = new Set(context.ReplayLabs.items.map(item => item.id));
  const guided = new Set(context.ReplayGuided.items.map(item => item.id));
  const usedSources = new Set(), tasks = new Set();
  for (const module of academy.modules.filter(item => item.id.startsWith('tax-'))) {
    assert.ok(module.lessons.length >= 3, module.id + ': at least three lessons');
    assert.equal(module.quiz.length, 5, module.id + ': exact four-of-five pass threshold remains possible');
    assert.ok(oldLabs.has(module.labId), module.id + ': legacy lab reference');
    assert.ok(guided.has(module.guidedLabId), module.id + ': guided lab reference');
    references(module.sourceIds, sources, module.id);
    module.sourceIds.forEach(id => usedSources.add(id));
    for (const lesson of module.lessons) {
      assert.ok(lesson.id.startsWith(module.id + '-'));
      assert.ok(lesson.sections.length >= 3, lesson.id + ': explain, work, practise');
      assert.ok(lesson.sections.some(item => typeof item.example === 'string' && item.example.length > 80), lesson.id + ': worked example');
      const prose = lesson.sections.map(item => [item.text, item.example || '', ...(item.bullets || [])].join(' ')).join(' ');
      assert.ok(prose.trim().split(/\s+/).length >= 120, lesson.id + ': substantive instruction');
      lesson.sections.forEach(section => {
        nonempty(section.heading, lesson.id + ': section heading');
        nonempty(section.text, lesson.id + ': section explanation');
        if (section.sourceIds) references(section.sourceIds, sources, lesson.id + ': section');
      });
      references(lesson.sourceIds, sources, lesson.id);
      assert.ok(guided.has(lesson.practice.guidedLabId), lesson.id + ': direct chart practice');
      assert.equal(lesson.practice.successCriteria.length, 2);
      for (const stage of ['seeIt', 'tryIt', 'reviewIt']) nonempty(lesson.practiceFlow[stage], lesson.id + ': ' + stage);
      assert.equal(lesson.practice.task, lesson.practiceFlow.tryIt);
      assert.ok(!tasks.has(lesson.practice.task), lesson.id + ': generic repeated task');
      tasks.add(lesson.practice.task);
      assert.match(lesson.practice.scopeNote, /simulator does not apply tax lots, wash sales, tax payments, or liquidation rules/);
      nonempty(lesson.takeaway, lesson.id + ': takeaway');
    }
  }
  context.ReplayTaxCourse.sourceIds.forEach(id => assert.ok(usedSources.has(id), 'unused source: ' + id));
  assert.equal(tasks.size, 19);
});

test('all tax quizzes and twelve decision cases have gradeable choices and usable corrective explanations', () => {
  const { context } = setup(), academy = context.ReplayAcademy;
  const modules = new Map(academy.modules.map(item => [item.id, item]));
  const sources = new Set(academy.sources.map(item => item.id));
  const lessons = new Set(academy.modules.flatMap(module => module.lessons.map(item => item.id)));
  const prompts = new Set();
  for (const module of academy.modules.filter(item => item.id.startsWith('tax-'))) {
    for (const question of module.quiz) {
      nonempty(question.prompt, module.id + ': question prompt');
      assert.ok(!prompts.has(question.prompt), 'duplicate question'); prompts.add(question.prompt);
      assert.equal(question.choices.length, 4);
      assert.equal(new Set(question.choices).size, 4);
      assert.ok(Number.isInteger(question.answer) && question.answer >= 0 && question.answer < 4);
      assert.ok(question.explanation.split(/\s+/).length >= 10);
      references(question.sourceIds, sources, module.id + ': answer sources');
    }
  }
  const cases = context.ReplayRiskCases.filter(item => item.id.startsWith('tax-case-'));
  assert.equal(cases.length, 12);
  assert.deepEqual(plain(cases.map(item => item.id)), Array.from({ length: 12 }, (_, i) => 'tax-case-' + (i + 1)));
  unique(cases, 'id', 'case IDs');
  for (const item of cases) {
    assert.equal(item.category, 'Taxes & records');
    nonempty(item.title, item.id + ': title'); nonempty(item.scenario, item.id + ': scenario');
    assert.equal(item.choices.length, 4);
    assert.equal(new Set(item.choices).size, 4);
    assert.ok(Number.isInteger(item.answer) && item.answer >= 0 && item.answer < 4);
    assert.ok(item.explanation.split(/\s+/).length >= 10);
    assert.ok(modules.has(item.moduleId)); assert.ok(lessons.has(item.lessonId));
    assert.ok(modules.get(item.moduleId).lessons.some(lesson => lesson.id === item.lessonId));
    references(item.sourceIds, sources, item.id + ': source');
    const lesson = modules.get(item.moduleId).lessons.find(lesson => lesson.id === item.lessonId);
    assert.ok(lesson.decisionCaseIds.includes(item.id), item.id + ': lesson back-link');
  }
});

test('original numerical cases and selected quiz answers agree with independent arithmetic', () => {
  const { context } = setup();
  const modules = new Map(context.ReplayAcademy.modules.map(item => [item.id, item]));
  const cases = new Map(context.ReplayRiskCases.map(item => [item.id, item]));
  assert.equal(dollars(selected(modules.get('tax-records'), 1)), (5500 - 5) - (5000 + 5));
  const lossChoice = selected(modules.get('tax-records'), 2);
  assert.match(lossChoice, /\$3,000 deduction; \$9,000 carryover/);
  assert.equal(12000 - Math.min(3000, 12000), 9000);
  assert.equal(dollars(selected(modules.get('tax-wash-sales'), 1)), 1000 / 100 * 40);
  assert.match(modules.get('tax-wash-sales').lessons[0].sections[1].example, /\$2,080/);
  assert.equal(40 * 42 + 1000 / 100 * 40, 2080);
  assert.equal(dollars(selected(modules.get('tax-planning'), 1)), Math.min(0.9 * 30000, 20000) - 12000);
  const higherIncome = cases.get('tax-case-6');
  assert.equal(dollars(higherIncome.choices[higherIncome.answer]), Math.min(0.9 * 30000, 1.1 * 20000) - 12000);
  assert.match(higherIncome.scenario, /single taxpayer/);
  assert.match(higherIncome.scenario, /before installment timing/);
  assert.equal(dollars(selected(modules.get('tax-planning'), 3)), 0.038 * Math.min(40000, 220000 - 200000));
  assert.equal(selected(modules.get('tax-products'), 0), '$3,000 long-term and $2,000 short-term');
  assert.equal(0.6 * 5000 + 0.4 * 5000, 5000);
  assert.equal(dollars(selected(modules.get('tax-products'), 2)), 200 + 5000);
  assert.equal(dollars(selected(modules.get('tax-products'), 3)), 900 - 800);
  assert.equal(selected(modules.get('tax-business'), 2), '$240 reduction; $760 cost');
  assert.equal(1000 * 0.24, 240);
  assert.equal(1000 - 1000 * 0.24, 760);
  assert.equal(dollars(selected(modules.get('tax-business'), 4)), 900 - 120);
});

test('source links use official IRS destinations and scope does not claim a personal filing or tax simulator', () => {
  const { context } = setup(), ids = new Set(context.ReplayTaxCourse.sourceIds);
  assert.equal(ids.size, 31);
  for (const source of context.ReplayAcademy.sources.filter(item => ids.has(item.id))) {
    const url = new URL(source.url);
    assert.equal(url.protocol, 'https:');
    assert.ok(url.hostname === 'irs.gov' || url.hostname.endsWith('.irs.gov'), source.id + ': primary IRS source');
    assert.equal(url.username, ''); assert.equal(url.password, ''); assert.equal(url.search, '');
    assert.equal(source.checked, '2026-11-21');
    assert.equal(source.publisher, 'Internal Revenue Service');
    nonempty(source.title, source.id + ': title');
  }
  assert.match(context.ReplayTaxCourse.scope, /U\.S\. federal/);
  assert.match(context.ReplayTaxCourse.scope, /State, local, non-U\.S\./);
  assert.match(context.ReplayTaxCourse.scope, /not a personal tax calculation/);
  assert.match(context.ReplayTaxCourse.professionalMeaning, /does not establish a professional qualification, tax status, eligibility/);
  assert.match(context.ReplayTaxCourse.practiceNote, /does not apply tax lots/);
});

test('reloading the extension preserves foreign risk cases and does not duplicate or replace content', () => {
  const originalCase = { id: 'risk-case-existing', category: 'Existing category', title: 'An existing exercise' };
  const { context } = setup({ existingCases: [originalCase] });
  const moduleReferences = context.ReplayAcademy.modules.slice();
  const snapshot = plain({ modules: context.ReplayAcademy.modules, sources: context.ReplayAcademy.sources, glossary: context.ReplayAcademy.glossary, cases: context.ReplayRiskCases });
  vm.runInContext(extension, context);
  assert.equal(context.ReplayRiskCases[0], originalCase);
  moduleReferences.forEach((item, index) => assert.equal(context.ReplayAcademy.modules[index], item));
  assert.deepEqual(plain({ modules: context.ReplayAcademy.modules, sources: context.ReplayAcademy.sources, glossary: context.ReplayAcademy.glossary, cases: context.ReplayRiskCases }), snapshot);
  // A later-loaded case collection can append its own category without having
  // the tax extension remove it on another installation.
  const laterCase = { id: 'risk-case-later', category: 'Another category', title: 'Later exercise' };
  context.ReplayRiskCases.push(laterCase);
  vm.runInContext(extension, context);
  assert.ok(context.ReplayRiskCases.includes(laterCase));
  assert.equal(context.ReplayRiskCases.filter(item => item.id.startsWith('tax-case-')).length, 12);
});
