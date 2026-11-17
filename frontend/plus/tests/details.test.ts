import test from 'node:test';
import assert from 'node:assert/strict';
import {selectedStats,selectedRisk,latestValue,type Entity,type DetailsData} from '../src/details-model';
const stats={value:200,irr:.1,excess:.02,bench_irr:.08,bench_end:190,twr:.09,sharpe:.7,dd:-.1};
const entity:Entity={label:'Example account',kind:'account',months:['2025-01-01','2026-01-01'],values:[100,200],bench:[100,190],windows:{inception:stats,'1y':stats},bm:{ALT:{inception:{bench_irr:.12,excess:-.02,bench_end:220,bench:[100,220]},'1y':{bench_irr:.12,excess:-.02,bench_end:220,bench:[100,220]}}}};
test('existing account figures stay fixed while selected benchmark changes',()=>{
 const base=selectedStats(entity,'inception','IDX','IDX')!,alt=selectedStats(entity,'inception','ALT','IDX')!;
 assert.equal(base.irr,alt.irr);assert.equal(alt.value,base.value);assert.equal(alt.bench_irr,.12);assert.equal(alt.excess,-.02);
 assert.deepEqual(alt.chart?.values,[100,200]);assert.deepEqual(alt.chart?.bench,[100,220]);
});
test('missing alternate and missing windows never masquerade as a default comparison',()=>{
 const missing=selectedStats(entity,'inception','UNKNOWN','IDX')!;
 assert.equal(missing.bench_irr,null);assert.equal(missing.excess,null);assert.deepEqual(missing.chart?.bench,[]);
 assert.equal(selectedStats(entity,'5y','IDX','IDX'),null);assert.equal(latestValue(entity),200);
 assert.equal(latestValue({...entity,statement_value:250,history_incomplete:'Missing statement'}),250);
});
test('risk reference follows selected benchmark instead of default reference',()=>{
 const point={label:'IDX',kind:'benchmark',vol:.1,ret:.08,sharpe:.5};
 const data={benchmark:'IDX',risk:{'1y':{points:[point,{...point,label:'Example account',kind:'account'}],left_off:[],bm:{ALT:{...point,label:'ALT',vol:.2,ret:.12}}}}} as unknown as DetailsData;
 assert.equal(selectedRisk(data,'1y','ALT').benchmark!.label,'ALT');
 assert.equal(selectedRisk(data,'1y','IDX').benchmark!.label,'IDX');
 assert.equal(selectedRisk(data,'1y','UNKNOWN').benchmark,null);
});

test('unreconciled balance curves are withheld while inception IRR is retained',()=>{
 const result=selectedStats({...entity,unreconciled:'Needs reconciliation'},'inception','IDX','IDX')!;
 assert.equal(result.irr,.1);assert.equal(result.chart,undefined);
});

test('whole-portfolio risk estimate takes priority and keeps the matched benchmark',()=>{
 const point={label:'Your portfolio',kind:'all',vol:.2,ret:.1,sharpe:.4,estimated:true,accounts:9};
 const data={benchmark:'IDX',risk:{'1y':{points:[],left_off:[],bm:{}}},estimatedPortfolioRisk:{'1y':{point,benchmarks:{IDX:{...point,label:'IDX',kind:'benchmark',sharpe:.6}}}}} as unknown as DetailsData;
 const selected=selectedRisk(data,'1y','IDX');assert.equal(selected.portfolio!.accounts,9);assert.equal(selected.portfolio!.sharpe,.4);assert.equal(selected.benchmark!.sharpe,.6);
});
