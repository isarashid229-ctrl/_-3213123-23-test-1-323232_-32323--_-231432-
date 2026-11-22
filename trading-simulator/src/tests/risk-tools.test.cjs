const test=require('node:test');
const assert=require('node:assert/strict');
const R=require('../risk-tools.js');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} versus ${b}`);
const sizing={equity:10000,riskPct:.5,entry:100,stop:98,pointValue:1,step:1,cost:.5,gap:3,side:'long'};
test('sizing includes round-trip costs, rounds down, and exposes gap losses beyond budget',()=>{
 const r=R.size(sizing);assert.equal(r.qty,20);assert.equal(r.budget,50);assert.equal(r.planned,50);assert.equal(r.stress,110);assert.equal(r.notional,2000);
 const wider=R.size({...sizing,stop:96});assert.equal(wider.qty,11);assert.ok(wider.planned<=50);
});
test('contract point values and fractional increments change units without exceeding the budget',()=>{
 const r=R.size({...sizing,pointValue:50,cost:2});assert.equal(r.qty,0);assert.equal(r.planned,0);
 const fractional=R.size({...sizing,step:.01,stop:97});close(fractional.qty,14.28);assert.ok(fractional.planned<=50);
 const short=R.size({...sizing,side:'short',stop:102});assert.equal(short.qty,20);assert.equal(short.stress,110);
});
test('sizing rejects wrong-sided stops, nonfinite inputs, and zero quantity increments',()=>{
 assert.throws(()=>R.size({...sizing,stop:101}),/below/);assert.throws(()=>R.size({...sizing,side:'short'}),/above/);assert.throws(()=>R.size({...sizing,step:0}),/increment/);assert.throws(()=>R.size({...sizing,equity:Infinity}),/Equity/);
});
test('leverage stress uses direction, notional exposure, and disclosed constant maintenance',()=>{
 const r=R.leverage({equity:1000,notional:10000,maintenancePct:5,side:'long'});assert.equal(r.leverage,10);assert.equal(r.maintenance,500);assert.equal(r.moves.find(x=>x.move===-10).equity,0);assert.equal(r.moves.find(x=>x.move===-10).deficit,true);assert.equal(r.moves.find(x=>x.move===-5).deficit,false);
 const short=R.leverage({equity:1000,notional:10000,maintenancePct:5,side:'short'});assert.equal(short.moves.find(x=>x.move===10).equity,0);
});
test('losing streaks compound against remaining capital; total loss has no finite recovery',()=>{
 const r=R.drawdown({equity:10000,riskPct:10,losses:2});close(r.ending,8100);close(r.drawdownPct,19);close(r.recoveryPct,10000/8100*100-100);assert.equal(r.rows.length,2);
 const zero=R.drawdown({equity:10000,riskPct:100,losses:1});assert.equal(zero.ending,0);assert.equal(zero.recoveryPct,null);assert.throws(()=>R.drawdown({equity:100,riskPct:1,losses:1.5}),/whole/);
});
test('trailing and static prop floors use distinct bases and touching the floor breaches',()=>{
 const args={start:50000,peak:52000,current:51000,allowance:2000,planned:800};
 const r=R.prop(args);assert.equal(r.floor,50000);assert.equal(r.afterBuffer,200);assert.equal(R.prop({...args,mode:'static'}).floor,48000);assert.equal(R.prop({...args,current:50000}).breached,true);assert.throws(()=>R.prop({...args,current:53000}),/Peak/);
});
test('tax reserve is user-defined arithmetic and cannot produce a negative additional reserve',()=>{
 assert.deepEqual(R.reserve({base:12000,rate:25,paid:1000}),{target:3000,additional:2000,surplus:0});assert.deepEqual(R.reserve({base:1000,rate:20,paid:300}),{target:200,additional:0,surplus:100});assert.throws(()=>R.reserve({base:100,rate:101,paid:0}),/percentage/);
});
test('case progress restoration only retains known cases and bounded valid choices',()=>{
 const cases=[{id:'one',choices:['a','b']}];const r=R.cleanProgress({one:{passed:true,attempts:100001,lastChoice:20},injected:{passed:true}},cases);assert.deepEqual(r,{one:{passed:true,attempts:100000,lastChoice:null}});
});
