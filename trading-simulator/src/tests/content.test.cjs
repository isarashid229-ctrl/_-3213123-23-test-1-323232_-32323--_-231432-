const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({ Math });
for (const file of ['academy.js', 'labs.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}
const academy = context.ReplayAcademy;
const labs = context.ReplayLabs;
const nonempty = (value, label) => assert.ok(typeof value === 'string' && value.trim().length > 0, label);
function ids(values, label) {
  const result = new Set();
  for (const item of values) {
    nonempty(item.id, `${label}: missing id`);
    assert.ok(!result.has(item.id), `${label}: duplicate id ${item.id}`);
    result.add(item.id);
  }
  return result;
}
function references(values, valid, label) {
  assert.ok(Array.isArray(values) && values.length > 0, `${label}: no recommendations`);
  for (const value of values) assert.ok(valid.has(value), `${label}: unknown reference ${value}`);
}

test('every course, problem, lab and resource link resolves to existing content', () => {
  const modules = ids(academy.modules, 'modules');
  const labIds = ids(labs.items, 'labs');
  const videos = ids(academy.videos, 'videos');
  const sources = ids(academy.sources, 'sources');
  ids(academy.problems, 'problems');
  // Progress is keyed by lesson ID across the entire course, so duplicates in
  // different modules would accidentally mark both lessons as reviewed.
  ids(academy.modules.flatMap(module => module.lessons), 'all lessons');
  const usedLabs = new Set();
  for (const module of academy.modules) {
    nonempty(module.title, module.id + ': title');
    assert.ok(labIds.has(module.labId), module.id + ': missing practice lab');
    usedLabs.add(module.labId);
    references(module.sourceIds, sources, module.id + ': sources');
    assert.ok(Array.isArray(module.lessons) && module.lessons.length > 0, module.id + ': no lessons');
    ids(module.lessons, module.id + ': lessons');
    for (const lesson of module.lessons) {
      nonempty(lesson.title, lesson.id + ': title');
      nonempty(lesson.takeaway, lesson.id + ': takeaway');
      assert.ok(Array.isArray(lesson.sections) && lesson.sections.length > 0, lesson.id + ': no instruction');
      for (const section of lesson.sections) {
        nonempty(section.heading, lesson.id + ': heading');
        nonempty(section.text, lesson.id + ': explanation');
      }
    }
  }
  for (const problem of academy.problems) {
    references(problem.moduleIds, modules, problem.id + ': course');
    references(problem.labIds, labIds, problem.id + ': labs');
    references(problem.videoIds, videos, problem.id + ': videos');
    problem.labIds.forEach(id => usedLabs.add(id));
    nonempty(problem.action, problem.id + ': missing next action');
  }
  for (const id of labIds) assert.ok(usedLabs.has(id), id + ': lab is unreachable from the learning content');
});

test('quizzes are answerable, gradeable, and have explanatory feedback', () => {
  const prompts = new Set();
  for (const module of academy.modules) {
    assert.ok(Array.isArray(module.quiz) && module.quiz.length >= 3, module.id + ': insufficient quiz');
    for (const question of module.quiz) {
      nonempty(question.prompt, module.id + ': quiz prompt');
      assert.ok(!prompts.has(question.prompt), module.id + ': repeated quiz prompt');
      prompts.add(question.prompt);
      assert.ok(Array.isArray(question.choices) && question.choices.length >= 2, question.prompt);
      const normalized = question.choices.map(choice => String(choice).trim().toLowerCase());
      assert.equal(new Set(normalized).size, question.choices.length, question.prompt + ': duplicate choice');
      question.choices.forEach(choice => nonempty(choice, question.prompt + ': empty choice'));
      assert.ok(Number.isInteger(question.answer) && question.answer >= 0 && question.answer < question.choices.length, question.prompt + ': invalid correct-answer index');
      nonempty(question.explanation, question.prompt + ': no feedback');
    }
  }
});

test('learning links are explicit HTTPS resources and videos include practice instructions', () => {
  for (const resource of academy.sources.concat(academy.videos)) {
    const url = new URL(resource.url);
    assert.equal(url.protocol, 'https:', resource.id + ': insecure or non-web link');
    assert.ok(!['example.com', 'example.org', 'localhost'].includes(url.hostname), resource.id + ': placeholder link');
    assert.equal(url.username, '', resource.id + ': embedded credentials');
    assert.equal(url.password, '', resource.id + ': embedded credentials');
    nonempty(resource.title, resource.id + ': no title');
  }
  for (const video of academy.videos) {
    nonempty(video.provider, video.id + ': no provider');
    nonempty(video.why, video.id + ': no selection reason');
    nonempty(video.task, video.id + ': no follow-up practice');
    assert.ok(Array.isArray(video.topics) && video.topics.length > 0, video.id + ': no search topics');
  }
  const terms = academy.glossary.map(item => item.term.trim().toLowerCase());
  assert.equal(new Set(terms).size, terms.length, 'duplicate glossary term');
  academy.glossary.forEach(item => nonempty(item.definition, item.term + ': empty definition'));
});

test('site template has unique IDs and the built artifact is self-contained executable HTML', () => {
  const template = fs.readFileSync(path.join(root, 'index.template.html'), 'utf8');
  const templateIds = Array.from(template.matchAll(/\bid="([^"]+)"/g), match => match[1]);
  assert.equal(new Set(templateIds).size, templateIds.length, 'duplicate HTML id');
  for (const match of template.matchAll(/\bfor="([^"]+)"/g)) assert.ok(templateIds.includes(match[1]), 'label has no control: ' + match[1]);
  const html = fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8');
  assert.ok(!html.includes('/* SCRIPTS */') && !html.includes('/* STYLES */'), 'unreplaced build marker');
  assert.ok(!/<script\b[^>]*\bsrc\s*=/i.test(html), 'offline bundle depends on an external script');
  assert.ok(!/<link\b[^>]*rel=["']stylesheet["']/i.test(html), 'offline bundle depends on an external stylesheet');
  const scripts = Array.from(html.matchAll(/<script[^>]*>([\s\S]*?)<\/script\s*>/gi));
  assert.ok(scripts.length > 0, 'missing app script');
  for (const script of scripts) assert.doesNotThrow(() => new vm.Script(script[1]), 'built inline JavaScript must parse');
  assert.ok(html.includes('window.REPLAY_ARCHIVE_CSV='), 'missing bundled historical data');
});
