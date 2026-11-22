'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../studio.js');
const T = require('../time.js');

test('chart-setting restoration validates colors and choices without accepting CSS injection or truthy strings', () => {
  const settings = S.cleanSettings({ bullColor: '#12aBcD', bearColor: 'red; background:url(x)', chartType: 'candles<script>', chartTheme: 'dark', showVolume: 'false', showGrid: false, vwap: true, sessionShading: null, unexpected: 1 });
  assert.equal(settings.bullColor, '#12aBcD');
  assert.equal(settings.bearColor, S.DEFAULTS.bearColor);
  assert.equal(settings.chartType, 'candles');
  assert.equal(settings.chartTheme, 'dark');
  assert.equal(settings.showVolume, true);
  assert.equal(settings.showGrid, false);
  assert.equal(settings.vwap, true);
  assert.equal(settings.sessionShading, false);
  assert.equal(Object.hasOwn(settings, 'unexpected'), false);
  settings.bullColor = '#ffffff';
  assert.equal(S.cleanSettings().bullColor, '#2962ff');
});

test('training restoration keeps only recognized tasks and bounded notes/results', () => {
  const definition = { weeks: [{ id: 'week-1', days: [{day:1},{day:2}] }, { id: 'week-2', days: [{day:1}] }], exams: [{id:'diagnostic'},{id:'capstone'}], rubric:[{id:'risk'}] };
  const restored = S.cleanTraining({ training: {'week-1:1':true,'week-1:2':'yes','week-99:1':true}, weekNotes:{'week-1':'x'.repeat(6000),'week-99':'unknown'}, planWeek:'week-2', exams:{diagnostic:{best:80,last:75,attempts:2},capstone:{best:Infinity,last:50,attempts:1}}, rubric:{risk:true,unknown:true} }, definition);
  assert.deepEqual(restored.training, {'week-1:1':true});
  assert.equal(restored.weekNotes['week-1'].length, 5000);
  assert.equal(restored.weekNotes['week-99'], undefined);
  assert.equal(restored.planWeek, 'week-2');
  assert.deepEqual(restored.exams.diagnostic, {best:80,last:75,attempts:2});
  assert.equal(restored.exams.capstone, undefined);
  assert.deepEqual(restored.rubric, {risk:true});
});

test('exam grading uses exact answers, an 80-percent threshold, and per-skill feedback', () => {
  const exam = {id:'test',questions:[
    {choices:['a','b'],answer:0,skill:'Risk',moduleId:'risk'},
    {choices:['a','b'],answer:1,skill:'Risk',moduleId:'risk'},
    {choices:['a','b'],answer:0,skill:'Orders',moduleId:'orders'},
    {choices:['a','b'],answer:1,skill:'Orders',moduleId:'orders'},
    {choices:['a','b'],answer:0,skill:'Review',moduleId:'review'}
  ]};
  const answers = [0,1,0,1,1], before = JSON.stringify(exam);
  const result = S.gradeExam(exam,answers);
  assert.equal(result.score,80); assert.equal(result.passed,true); assert.equal(result.correct,4);
  assert.deepEqual(result.skills.Risk,{correct:2,total:2,moduleId:'risk'});
  assert.deepEqual(result.skills.Review,{correct:0,total:1,moduleId:'review'});
  assert.equal(S.gradeExam(exam,[0,1,0,0,1]).passed,false);
  assert.equal(JSON.stringify(exam),before);
  result.answers[0]=1; assert.equal(answers[0],0);
  for(const incomplete of [[0,1],[0,1,0,1,NaN],[0,1,0,1,2],['0',1,0,1,0]])assert.throws(()=>S.gradeExam(exam,incomplete),/every question/);
});

test('timeframe inference handles intraday session gaps and daily DST/weekend gaps', () => {
  const intraday = [0,60,120,180,240,86400,86460,86520,86580].map(time=>({time:1700000000+time}));
  assert.equal(S.guessTimeframe(intraday),'1m');
  const daily = ['2026-03-04','2026-03-05','2026-03-06','2026-03-09','2026-03-10'].map(date=>({time:T.parseLocal(date,'16:00')}));
  assert.equal(S.guessTimeframe(daily),'1d');
  assert.equal(S.guessTimeframe([{time:0},{time:180},{time:360}]),'3m');
  assert.equal(S.guessTimeframe([{time:0},{time:123},{time:246}]),'CSV');
  assert.equal(S.guessTimeframe([{time:0}]),'CSV');
});
