import {useMemo,useState} from 'react';
import {selectedRisk,selectedStats,type DetailsData,latestValue,type Stats} from './details-model';
import type {DashboardData} from './types';
import {Card,CardStack,CardHeader,PageHeader,SelectField,tupleOptions,PeriodSelector,Metric,MetricPair,ComparisonSummary,Disclosure,DataTable,DataCoverage,StatusMessage,Legend,DivergingBars} from './ui/components';
import {TimeSeriesChart,RiskScatterChart,type ScatterPoint} from './ui/charts';
import {money,percent,decimal,comparisonTone,formatDate} from './ui/format';
type Props={data:DashboardData&DetailsData;benchmark:string;period:string;onBenchmark(symbol:string):void;onPeriod(key:string):void;onNavigate(tab:string):void};
function ValueChart({stats,label,benchmark}:{stats:Stats;label:string;benchmark:string}){const c=stats.chart;return c?<TimeSeriesChart label={`${label} value and ${benchmark} comparison over time`} dates={c.months} series={[{key:label,label,role:'portfolio',values:c.values,estimated:c.estimated,quality:c.estimated?undefined:'estimated'},{key:benchmark,label:`${benchmark} · same cash flows`,role:'benchmark',values:c.bench}]}/>:<StatusMessage kind="missing">Value history is unavailable for this period.</StatusMessage>;}
function RiskChart({data,period,benchmark}:{data:DetailsData;period:string;benchmark:string}){
 const r=selectedRisk(data,period,benchmark),accounts=r.accounts.filter(q=>Number.isFinite(q.vol)&&Number.isFinite(q.ret)&&q.vol>=0),portfolio=r.portfolio,bp=r.benchmark;
 const points=[...accounts,...(portfolio?[portfolio]:[]),...(bp?[bp]:[])],excluded=r.excluded.filter(q=>q[2]==='account');
 const plotted:ScatterPoint[]=accounts.map((q,i)=>({key:q.label,label:q.label,markerLabel:String(i+1),x:q.vol,y:q.ret,role:'portfolio'}));
 if(portfolio)plotted.push({key:'portfolio',label:portfolio.label,markerLabel:'P',marker:'ring',x:portfolio.vol,y:portfolio.ret,role:'portfolio'});
 if(bp)plotted.push({key:'benchmark',label:benchmark,markerLabel:benchmark,x:bp.vol,y:bp.ret,role:'benchmark'});
 return <Card><CardHeader title="Risk versus return"/>
 <RiskScatterChart points={plotted} label={`Annual return versus volatility, compared with ${benchmark}`} xTitle="Volatility / year" yTitle="Time-weighted return / year"/>
 <Legend items={[{label:'Accounts',role:'portfolio',marker:'dot'},...(portfolio?[{label:portfolio.label,role:'portfolio' as const,marker:'ring' as const}]:[]),...(bp?[{label:benchmark,role:'benchmark' as const,marker:'dot' as const}]:[])]}/>
 {portfolio&&<><h3>Portfolio Sharpe{portfolio.estimated?' · estimated':''}</h3><DivergingBars label="Whole portfolio Sharpe compared with the selected benchmark" rows={[{label:`Your portfolio${portfolio.accounts?` (${portfolio.accounts} accounts)`:''}`,value:portfolio.sharpe,role:'portfolio'},{label:benchmark,value:bp?.sharpe??null,role:'benchmark'}]}/></>}
 {!bp&&<StatusMessage kind="missing">No benchmark risk figures for this period.</StatusMessage>}
 <Disclosure title="How this is measured"><p>Time-weighted return ignores the timing of deposits and withdrawals; IRR (Overview) includes it.</p>{portfolio?.estimated&&<StatusMessage kind="estimated">Interpolated balances can understate risk.</StatusMessage>}<DataTable label="Risk and return points"><thead><tr><th>Account</th><th>Return / year</th><th>Volatility / year</th><th>Sharpe</th></tr></thead><tbody>{points.map(q=><tr key={q.label}><th scope="row">{q.kind==='benchmark'?benchmark:q.kind==='account'?`${accounts.findIndex(a=>a.label===q.label)+1}. ${q.label}`:`P. ${q.label}`}</th><td className={q.kind==='benchmark'?'benchmark-value':'own-value'}>{percent(q.ret,true)}</td><td>{percent(q.vol)}</td><td>{decimal(q.sharpe)}</td></tr>)}</tbody></DataTable></Disclosure>
 {!!excluded.length&&<Disclosure title={`Data not included (${excluded.length})`}><ul>{excluded.map(q=><li key={q[0]}>{q[0]}: {q[1]}</li>)}</ul></Disclosure>}
 </Card>;
}
export function Details({data,benchmark,period,onBenchmark,onPeriod}:Props){
 const accounts=(data.entities??[]).filter(e=>e.kind==='account'),[selected,setSelected]=useState(accounts[0]?.label??''),entity=accounts.find(e=>e.label===selected)??accounts[0];
 const rows=useMemo(()=>accounts.map(entity=>({entity,stats:selectedStats(entity,period,benchmark,data.benchmark)})),[accounts,period,benchmark,data.benchmark]);
 const shown=entity?selectedStats(entity,period,benchmark,data.benchmark):null;
 return <CardStack className="details">
 <PageHeader title="Details"/>
 {!accounts.length&&<Card><StatusMessage kind="info">No accounts yet. In the UFO app, choose “Add accounts”, then refresh.</StatusMessage></Card>}
 <Card><CardHeader title="Account performance" action={<SelectField label="Benchmark" tone="benchmark" value={benchmark} options={tupleOptions(data.benchmarks)} onChange={onBenchmark}/>}/><PeriodSelector value={period} onChange={onPeriod}/>
 <DataTable label="Account performance"><thead><tr><th>Account</th><th>Value</th><th>IRR</th><th className="benchmark-value">{benchmark} IRR</th><th>Excess</th></tr></thead><tbody>{rows.map(({entity:e,stats:s})=><tr key={e.label}><th scope="row"><button type="button" className="ui-account-link account-name" aria-pressed={selected===e.label} onClick={()=>{setSelected(e.label);document.getElementById('solo-account-analysis')?.scrollIntoView?.({behavior:'smooth',block:'start'});}}>{e.label}</button>{(e.history_incomplete||e.error||e.unreconciled||(!s&&!e.history_incomplete))&&<p className="ui-caption">{e.history_incomplete?'History incomplete':e.unreconciled?'Statements don’t match the history':e.error?'History needs attention':'Not enough history for this period'}</p>}</th><td className="own-value">{money(s?.value??latestValue(e))}</td><td className="own-value">{percent(s?.irr,true)}</td><td className="benchmark-value">{percent(s?.bench_irr,true)}</td><td className={comparisonTone(s?.excess)}>{percent(s?.excess,true)}</td></tr>)}</tbody></DataTable>
 {benchmark!==data.benchmark&&rows.some(r=>r.stats?.bench_irr==null)&&<StatusMessage kind="missing">Some accounts lack this comparison.</StatusMessage>}</Card>
 <Card><CardHeader title="Excess IRR"/>{rows.some(r=>r.stats?.excess!=null)?<DivergingBars label="Excess IRR relative to benchmark zero; exact values are listed in Account performance" rows={rows.filter(r=>r.stats?.excess!=null).sort((a,b)=>b.stats!.excess!-a.stats!.excess!).map(r=>({label:r.entity.label,value:r.stats!.excess,comparison:true}))}/>:<StatusMessage kind="missing">Not available for this period.</StatusMessage>}</Card>
 <RiskChart data={data} period={period} benchmark={benchmark}/>
 <Card id="solo-account-analysis"><CardHeader title="Individual accounts"/>{accounts.length?<SelectField label="Account" tone="portfolio" value={entity?.label??''} onChange={setSelected} options={accounts.map(e=>({value:e.label,label:e.label}))}/>:<StatusMessage kind="missing">No account has enough history yet. Add a statement in the UFO app, then refresh.</StatusMessage>}
 {entity&&<>{entity.history_incomplete?<StatusMessage kind="estimated">Latest statement value {money(entity.statement_value)} as of {formatDate(entity.as_of,'day')}. Comparison waits for complete history.</StatusMessage>:entity.error||!shown?<StatusMessage kind="missing">Not enough history for this period. Latest value: {money(latestValue(entity))}.</StatusMessage>:<>
 <Metric label="Account value" value={money(shown.value)}/><DataCoverage to={shown.thru??entity.as_of}/>
 <MetricPair left={{label:'IRR',value:percent(shown.irr,true),basis:shown.cum?'for this period':'/year'}} right={{label:`${benchmark} IRR`,tone:'benchmark',value:percent(shown.bench_irr,true),basis:shown.cum?'for this period':'/year'}}/>
 <ComparisonSummary difference={shown.excess}>Excess {percent(shown.excess,true)}</ComparisonSummary>
 <ValueChart stats={shown} label={entity.label} benchmark={benchmark}/>
 <Disclosure title="More figures"><p>Time-weighted return {percent(shown.twr,true)} · Sharpe {decimal(shown.sharpe)} · Worst fall {percent(shown.dd)}</p><p>{shown.exact?'IRR from dated payments and the reported value.':'Some past values are estimated.'} {entity.stale?'Statement may be old.':''} {entity.unreconciled?'Statement values do not reconcile.':''}</p>{!!entity.flags?.length&&<ul>{entity.flags.map((f,i)=><li key={i}>{f}</li>)}</ul>}</Disclosure>
 </>}</>}
 </Card>
 <Disclosure title="Fine print" variant="card"><p>Excess IRR: the account’s IRR minus the benchmark’s, with the same payments. Periods under a year are cumulative. Short purple dashes: estimated history.</p></Disclosure>
 </CardStack>;
}
