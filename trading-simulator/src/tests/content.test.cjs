const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({ Math });
for (const file of ['academy.js', 'labs.js', 'training.js', 'guided.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}
const academy = context.ReplayAcademy;
const labs = context.ReplayLabs;
const training = context.ReplayTraining;
const guided = context.ReplayGuided;
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

test('all lessons and problem-coach recommendations lead to concrete guided chart practice', () => {
  const guidedIds = ids(guided.items, 'guided labs');
  const seenFlows = new Set();
  const reachedLabs = new Set();
  for (const module of academy.modules) {
    assert.ok(guidedIds.has(module.guidedLabId), module.id + ': guided default is reachable');
    for (const lesson of module.lessons) {
      for (const stage of ['seeIt', 'tryIt', 'reviewIt']) nonempty(lesson.practiceFlow[stage], lesson.id + ': ' + stage);
      assert.ok(!seenFlows.has(lesson.practiceFlow.tryIt), lesson.id + ': generic repeated assignment');
      seenFlows.add(lesson.practiceFlow.tryIt);
      assert.ok(guidedIds.has(lesson.practice.guidedLabId), lesson.id + ': guided task is reachable');
      reachedLabs.add(lesson.practice.guidedLabId);
      nonempty(lesson.practice.title, lesson.id + ': practice title');
      assert.equal(lesson.practice.task, lesson.practiceFlow.tryIt);
      assert.equal(lesson.practice.successCriteria.length, 2, lesson.id + ': observable success criteria');
      lesson.practice.successCriteria.forEach(item => nonempty(item, lesson.id + ': success criterion'));
    }
  }
  assert.equal(seenFlows.size, 48);
  for (const id of guidedIds) assert.ok(reachedLabs.has(id), id + ': no direct lesson link');
  for (const problem of academy.problems) {
    references(problem.guidedLabIds, guidedIds, problem.id + ': guided practice');
    assert.equal(problem.guidedLabId, problem.guidedLabIds[0]);
  }
  nonempty(academy.practiceNote, 'honest local-check/reflection distinction');
});

test('quizzes are answerable, gradeable, and have explanatory feedback', () => {
  const prompts = new Set();
  for (const module of academy.modules) {
    assert.ok(Array.isArray(module.quiz) && module.quiz.length === 5, module.id + ': five questions permit an exact 80% threshold');
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

test('expanded course preserves the original progress IDs and delivers the requested scope', () => {
  assert.equal(academy.modules.length, 16);
  assert.equal(academy.modules.flatMap(module => module.lessons).length, 48);
  assert.equal(academy.modules.flatMap(module => module.quiz).length, 80);
  const original = ['foundations', 'candles', 'structure', 'orders', 'sizing', 'setups', 'management', 'psychology', 'review', 'capstone'];
  for (const id of original) {
    const module = academy.modules.find(item => item.id === id);
    assert.ok(module, 'original module progress key was removed: ' + id);
    for (let n = 1; n <= 3; n++) assert.ok(module.lessons.some(item => item.id === id + '-' + n), 'original lesson progress key was removed');
  }
  for (const id of ['stocks', 'sessions', 'playbook', 'testing', 'execution_review', 'business']) {
    assert.ok(academy.modules.some(item => item.id === id), 'advanced module missing: ' + id);
  }
});

test('sixteen-week plan has complete sessions, deliverables, and working course/lab references', () => {
  assert.equal(training.weeks.length, 16);
  ids(training.weeks, 'weeks');
  const moduleIds = new Set(academy.modules.map(item => item.id));
  const labIds = new Set(labs.items.map(item => item.id));
  const coveredModules = new Set();
  const sessionKeys = new Set();
  const tasks = new Set();
  let totalMinutes = 0;
  for (let index = 0; index < training.weeks.length; index++) {
    const week = training.weeks[index];
    assert.equal(week.id, 'week-' + (index + 1), 'stable sequential week ID');
    assert.equal(week.week, index + 1);
    nonempty(week.title, week.id + ': title');
    nonempty(week.phase, week.id + ': phase');
    nonempty(week.objective, week.id + ': objective');
    nonempty(week.deliverable, week.id + ': deliverable');
    assert.ok(Array.isArray(week.criteria) && week.criteria.length > 0, week.id + ': completion evidence');
    week.criteria.forEach(value => nonempty(value, week.id + ': criterion'));
    references(week.moduleIds, moduleIds, week.id + ': modules');
    references(week.labIds, labIds, week.id + ': labs');
    week.moduleIds.forEach(id => coveredModules.add(id));
    assert.equal(week.days.length, 5, week.id + ': five focused sessions');
    week.days.forEach((day, dayIndex) => {
      assert.equal(day.day, dayIndex + 1, week.id + ': stable day number');
      const key = week.id + ':' + day.day;
      assert.ok(!sessionKeys.has(key), 'duplicate persisted session key: ' + key);
      sessionKeys.add(key);
      nonempty(day.title, key + ': title');
      nonempty(day.task, key + ': assignment');
      assert.ok(!tasks.has(day.task), key + ': repeated generic assignment');
      tasks.add(day.task);
      assert.ok(Number.isInteger(day.minutes) && day.minutes >= 30 && day.minutes <= 60, key + ': expected focused 30–60 minute session');
      totalMinutes += day.minutes;
    });
  }
  assert.equal(sessionKeys.size, 80);
  for (const id of moduleIds) assert.ok(coveredModules.has(id), 'course module absent from training plan: ' + id);
  assert.ok(totalMinutes >= 2400 && totalMinutes <= 4800, 'time estimate must match the 80 stated sessions');
});

test('diagnostic and capstone assessments have stable IDs and actionable, unambiguous skill feedback', () => {
  assert.equal(training.exams.length, 2);
  ids(training.exams, 'exams');
  ids(training.exams.flatMap(exam => exam.questions), 'exam questions');
  const moduleIds = new Set(academy.modules.map(item => item.id));
  const expectedCounts = { diagnostic: 12, capstone: 20 };
  for (const exam of training.exams) {
    assert.ok(Object.hasOwn(expectedCounts, exam.id), 'unexpected persisted exam ID');
    assert.equal(exam.questions.length, expectedCounts[exam.id]);
    assert.equal(exam.passPercent, 80);
    nonempty(exam.title, exam.id + ': title');
    nonempty(exam.description, exam.id + ': description');
    const skillModules = new Map();
    const prompts = new Set();
    for (const question of exam.questions) {
      nonempty(question.prompt, question.id + ': prompt');
      assert.ok(!prompts.has(question.prompt), question.id + ': repeated prompt');
      prompts.add(question.prompt);
      assert.equal(question.choices.length, 4, question.id + ': four choices');
      question.choices.forEach(choice => nonempty(choice, question.id + ': choice'));
      assert.equal(new Set(question.choices.map(choice => choice.trim().toLowerCase())).size, 4, question.id + ': duplicate choices');
      assert.ok(Number.isInteger(question.answer) && question.answer >= 0 && question.answer < 4, question.id + ': valid answer');
      nonempty(question.explanation, question.id + ': feedback');
      nonempty(question.skill, question.id + ': skill feedback label');
      assert.ok(moduleIds.has(question.moduleId), question.id + ': review topic is reachable');
      if (skillModules.has(question.skill)) assert.equal(question.moduleId, skillModules.get(question.skill), 'a grouped skill must link to one consistent review module');
      skillModules.set(question.skill, question.moduleId);
    }
  }
  assert.equal(training.exams.find(exam => exam.id === 'capstone').questions.length * 0.8, 16);
  ids(training.rubric, 'process rubric');
  assert.equal(training.rubric.length, 8);
  training.rubric.forEach(item => {
    nonempty(item.title, item.id + ': title');
    nonempty(item.description, item.id + ': criterion');
    nonempty(item.target, item.id + ': observable target');
  });
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
