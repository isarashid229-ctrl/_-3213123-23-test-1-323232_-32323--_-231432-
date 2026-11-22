/* Educational arithmetic, not a broker margin engine or a tax return. */
(function(root){
'use strict';
const finite=(n,label,min=0,max=1e12)=>{n=Number(n);if(!Number.isFinite(n)||n<min||n>max)throw new Error(label+' must be between '+min+' and '+max+'.');return n;};
function size(input){
 const equity=finite(input.equity,'Equity',.01),riskPct=finite(input.riskPct,'Risk percentage',.001,100),entry=finite(input.entry,'Entry',.00000001),stop=finite(input.stop,'Stop',.00000001),pointValue=finite(input.pointValue,'Value per price point',.00000001),step=finite(input.step,'Quantity increment',.00000001),cost=finite(input.cost,'Round-trip cost per unit'),gap=finite(input.gap,'Extra adverse exit move');
 const side=input.side==='short'?'short':'long',direction=side==='long'?1:-1;
 if(direction*(entry-stop)<=0)throw new Error('A long stop must be below entry; a short stop must be above entry.');
 const budget=equity*riskPct/100,perUnit=Math.abs(entry-stop)*pointValue+cost;
 const raw=budget/perUnit,qty=Math.floor((raw+1e-12)/step)*step,planned=qty*perUnit,stress=qty*(perUnit+gap*pointValue);
 return {equity,budget,perUnit,qty,planned,stress,notional:qty*entry*pointValue,unspent:budget-planned,side};
}
function leverage(input){
 const equity=finite(input.equity,'Collateral equity',.01),notional=finite(input.notional,'Position notional',.01),maintenancePct=finite(input.maintenancePct,'Illustrative maintenance rate',0,100),side=input.side==='short'?'short':'long';
 const initialMaintenance=notional*maintenancePct/100,leverage=notional/equity;
 // Constant notional-maintenance assumption intentionally isolates the leverage effect.
 const moves=[-10,-5,-2,-1,0,1,2,5,10].map(move=>{const pnl=notional*move/100*(side==='long'?1:-1),remaining=equity+pnl;return {move,pnl,equity:remaining,buffer:remaining-initialMaintenance,deficit:remaining<initialMaintenance};});
 return {equity,notional,maintenance:initialMaintenance,leverage,buffer:equity-initialMaintenance,moves};
}
function drawdown(input){
 const equity=finite(input.equity,'Starting equity',.01),riskPct=finite(input.riskPct,'Loss fraction per trade',.001,100),losses=finite(input.losses,'Consecutive losses',1,1000);
 if(!Number.isInteger(losses))throw new Error('Consecutive losses must be a whole number.');
 const rows=Array.from({length:Math.min(losses,1000)},(_,i)=>{const balance=equity*Math.pow(1-riskPct/100,i+1);return {trade:i+1,balance,drawdown:(1-balance/equity)*100};});
 const ending=rows.at(-1).balance,drawdownPct=(1-ending/equity)*100,recoveryPct=ending>0?(equity/ending-1)*100:null;
 return {equity,ending,loss:equity-ending,drawdownPct,recoveryPct,rows};
}
function prop(input){
 const start=finite(input.start,'Starting balance',.01),peak=finite(input.peak,'Highest measured equity',.01),current=finite(input.current,'Current equity',0),allowance=finite(input.allowance,'Drawdown allowance',.01),planned=finite(input.planned,'Next trade planned loss');
 if(peak<start||current>peak)throw new Error('Peak must be at least the starting balance and current equity.');
 const trailing=input.mode!=='static',floor=(trailing?peak:start)-allowance,buffer=current-floor;
 return {floor,buffer,breached:current<=floor,afterLoss:current-planned,afterBuffer:buffer-planned,trailing};
}
function reserve(input){
 const base=finite(input.base,'Illustrative taxable amount',0),rate=finite(input.rate,'Planning reserve percentage',0,100),paid=finite(input.paid,'Already reserved or paid',0);
 const target=base*rate/100;return {target,additional:Math.max(0,target-paid),surplus:Math.max(0,paid-target)};
}
function cleanProgress(input,cases){
 const output={};if(!input||typeof input!=='object')return output;
 for(const item of cases||[]){const p=input[item.id];if(!p||typeof p!=='object')continue;const attempts=Number.isInteger(p.attempts)?Math.min(100000,Math.max(1,p.attempts)):1;output[item.id]={passed:p.passed===true,attempts,lastChoice:Number.isInteger(p.lastChoice)&&p.lastChoice>=0&&p.lastChoice<item.choices.length?p.lastChoice:null};}
 return output;
}
const api={size,leverage,drawdown,prop,reserve,cleanProgress};root.ReplayRiskTools=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
