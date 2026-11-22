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
// PR 2 (issues 256, 263, 264): every tab opens with the same masthead, says why figures are missing, and empty states name the fix.
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Details} from '../src/Details';
import {Overview} from '../src/Overview';
const base={schema_version:1,benchmark:'IDX',benchmarks:[['IDX','Index']],windows:[],overview:null} as const;
const noop=()=>{};
test('tabs share the masthead and empty states say what to do',()=>{
 const o=renderToStaticMarkup(React.createElement(Overview,{data:base as never,benchmark:'IDX',period:'1y',onBenchmark:noop,onPeriod:noop,onNavigate:noop}));
 assert.match(o,/<h1 class="ui-sr">/);assert.match(o,/No accounts yet/);assert.match(o,/Add accounts/);
 const d=renderToStaticMarkup(React.createElement(Details,{data:{...base,entities:[]} as never,benchmark:'IDX',period:'1y',onBenchmark:noop,onPeriod:noop,onNavigate:noop}));
 assert.match(d,/<h1 class="ui-sr">/);assert.match(d,/No accounts yet/);
});
test('an account whose statements do not reconcile says so instead of showing bare dashes',()=>{
 const odd={...entity,label:'Example odd account',unreconciled:'Does not reconcile'};
 const d=renderToStaticMarkup(React.createElement(Details,{data:{...base,entities:[entity,odd]} as never,benchmark:'IDX',period:'1y',onBenchmark:noop,onPeriod:noop,onNavigate:noop}));
 assert.match(d,/Statements don’t match the history/);
 assert.equal((d.match(/Statements don’t match/g)??[]).length,1);
});
