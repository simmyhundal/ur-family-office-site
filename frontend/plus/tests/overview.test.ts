import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveView,moneyAxis} from '../src/model';
import type {DashboardData,OverviewWindow} from '../src/types';
const months=['2020-01-01','2025-11-13','2025-12-31','2026-06-30','2026-11-14'];
const data:DashboardData={schema_version:1,benchmark:'IDX',benchmarks:[['IDX','Index'],['FLAT','Cash']],windows:[],overview:{value:1300,irr:.08,accounts:2,as_of:'2026-11-14',months,values:[100,1100,1150,1250,1300],estimated:[false,true,true,true,false],missing:['Demo'],statements:[],benchmarks:{IDX:{value:1500,irr:.1,note:'',values:[100,1150,1200,1400,1500]},FLAT:{value:1100,irr:0,note:'',values:[100,1000,1000,1100,1100]}}}};
const one:OverviewWindow={start:'2025-11-14',end:'2026-11-14',annualized:true,irr:.12,value:1300,months:['2025-11-14','2025-12-31','2026-06-30','2026-11-14'],values:[1101,1150,1250,1300],estimated:[true,true,true,false],benchmarks:{IDX:{value:1400,irr:.14,note:'',values:[1101,1200,1300,1400]},FLAT:{value:1101,irr:0,note:'',values:[1101,1101,1101,1101]}}};
data.overview!.windows={'1y':one,ytd:{...one,start:'2025-12-31',annualized:false,irr:.06,months:one.months.slice(1),values:one.values.slice(1),estimated:one.estimated.slice(1),benchmarks:{IDX:{value:1350,irr:.1,note:'',values:[1150,1250,1350]}}}};

test('periods use precomputed window IRRs and same-period counterfactual endpoints',()=>{
 const all=deriveView(data,'IDX','inception'),year=deriveView(data,'IDX','1y'),ytd=deriveView(data,'IDX','ytd');
 assert.equal(all.months.length,5);assert.equal(year.months[0],'2025-11-14');assert.equal(ytd.months[0],'2025-12-31');
 assert.equal(year.values.at(-1),1300);assert.equal(year.irr,.12);assert.equal(all.irr,.08);assert.equal(ytd.irr,.06);assert.equal(ytd.annualized,false);
 assert.equal(year.comparison!.value,1400);assert.equal(year.series.length,2);assert.equal(year.series[1].key,'IDX');
 assert.equal(year.values[0],year.series[1].values[0]);
});
test('positive returns can trail; selection updates comparative colour',()=>{
 assert.equal(deriveView(data,'IDX','1y').tone,'down');assert.equal(deriveView(data,'FLAT','1y').tone,'up');
 const close=structuredClone(data);close.overview!.windows!['1y'].irr=.141;assert.equal(deriveView(close,'IDX','1y').tone,'neutral');
});
test('missing benchmark is not zero; missing periods and corrupt data fail',()=>{
 const d=structuredClone(data);delete d.overview!.windows!['1y'].benchmarks.IDX;
 assert.equal(deriveView(d,'IDX','1y').comparison,null);assert.equal(deriveView(d,'IDX','1y').series.length,1);
 assert.throws(()=>deriveView(d,'IDX','5y'));
 d.overview!.values[1]=NaN;assert.throws(()=>deriveView(d,'FLAT','inception'));
});
test('axis labels follow rounded money steps, with a tighter short-period range',()=>{
 const broad=moneyAxis([0,265000,335000],true);assert.equal(broad.step,100000);assert.deepEqual(broad.ticks,[0,100000,200000,300000,400000]);
 const short=moneyAxis([250000,265000,335000],false);assert.ok(short.lo>=200000);assert.ok(short.step<=50000);assert.ok(short.ticks.every(v=>v%short.step===0));
});
