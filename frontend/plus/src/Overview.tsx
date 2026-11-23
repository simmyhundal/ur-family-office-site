import {useMemo} from 'react';
import {deriveView} from './model';
import type {DashboardData} from './types';
import {Card,CardStack,PageHeader,Disclosure,SelectField,tupleOptions,PeriodSelector,MetricPair,StatusMessage,Takeaway,SourceLine,compareWords} from './ui/components';
import {TimeSeriesChart} from './ui/charts';
import {money,percent,formatDate,periodWords} from './ui/format';
type Props={data:DashboardData;benchmark:string;period:string;onBenchmark(symbol:string):void;onPeriod(key:string):void;onNavigate(tab:string):void};
export function Overview({data,benchmark,period,onBenchmark,onPeriod}:Props){
 const view=useMemo(()=>deriveView(data,benchmark,period),[data,benchmark,period]);const o=data.overview;
 if(!o||view.empty)return <CardStack className="overview"><PageHeader title="Overview"/><Card><StatusMessage kind="info">No accounts yet. In the UFO app, choose “Add accounts”, then refresh.</StatusMessage></Card></CardStack>;
 const span=periodWords(period);
 const lede=compareWords('Your investments are',view.comparison&&view.irr!=null&&view.comparison.irr!=null?view.irr-view.comparison.irr:null,benchmark,view.annualized&&period!=='1y'?`a year ${span}`:span);
 return <CardStack className="overview">
 <PageHeader title="Overview"/>
 <Card className="overview-hero">{lede.tone!=='neutral'||view.comparison?.irr!=null&&view.irr!=null?<Takeaway tone={lede.tone}>{lede.text}</Takeaway>:null}<div className="ui-headline-controls"><h2>{o.accounts} {o.accounts===1?'account':'accounts'}</h2><SelectField label="Benchmark" tone="benchmark" hideLabel value={benchmark} options={tupleOptions(data.benchmarks)} onChange={onBenchmark}/></div>
 <MetricPair left={{label:'Your investments',hideLabel:true,value:money(view.value),detail:<span className="portfolio-irr" aria-label={`${view.annualized?'Annual':'Period'} IRR ${percent(view.irr,true)}`}>{percent(view.irr,true)}</span>}} right={{label:benchmark,hideLabel:true,tone:'benchmark',value:money(view.comparison?.value),detail:<span aria-label={`${view.annualized?'Annual':'Period'} IRR ${percent(view.comparison?.irr,true)}`}>{percent(view.comparison?.irr,true)}</span>}}/>
 <PeriodSelector value={period} onChange={onPeriod}/>
 <TimeSeriesChart label="Portfolio and benchmark value over the selected period" resetKey={period+'/'+benchmark} dates={view.months} zeroBaseline={period==='inception'||period==='all'} series={view.series.map((s,i)=>({key:s.key,label:i?`${s.key} · same payments`:'Your portfolio',role:i?'benchmark':'portfolio',values:s.values,estimated:i?undefined:view.estimated}))}/>
 <SourceLine>your account histories and statements; {benchmark} month-end prices with dividends reinvested. IRR {view.annualized?'a year':'for the period'}, same deposits and withdrawals for both.</SourceLine>
 </Card>
 {view.sources&&<Card className="overview-sources" aria-labelledby="overview-sources-heading"><h2 id="overview-sources-heading">Where your money came from</h2><p className="ui-caption">Your accounts only, {span}.</p>{(()=>{
 const s=view.sources!,rows:[string,number,string][]=[['Starting balance',s.opening,'var(--k5)'],['Deposits',s.deposits,'var(--accent)'],['Withdrawals',-s.withdrawals,'var(--k3)'],[s.gain>=0?'Investment gain':'Investment loss',s.gain,s.gain>=0?'var(--up)':'var(--down)']],max=Math.max(...rows.map(([,v])=>Math.abs(v)),1);
 return <>{rows.map(([label,value,color])=><div className="ui-source-row" key={label}><span>{label}</span><strong className="own-value">{money(value)}</strong><span className="ui-source-track"><i style={{width:`${Math.abs(value)/max*100}%`,background:color}}/></span></div>)}<div className="ui-source-total"><span>Current value</span><span className="own-value">{money(s.value)}</span></div></>;
 })()}</Card>}
 <Disclosure variant="card" title="Fine print"><p>Periods under a year are cumulative; longer ones are annualized. The benchmark gets the same opening balance and payments. Dashed purple: reconstructed history.</p>{o.missing.length>0&&<StatusMessage kind="estimated">Missing history: {o.missing.join(', ')}</StatusMessage>}{!!data.pendingAccounts?.length&&<StatusMessage kind="missing">Waiting for a balance: {data.pendingAccounts.join(', ')}. Not in totals yet.</StatusMessage>}<ul>{o.statements.map(s=><li key={s.label+s.as_of}>{s.label} · {formatDate(s.as_of,'day')}</li>)}</ul>{view.comparison?.note&&<StatusMessage>{view.comparison.note}</StatusMessage>}</Disclosure>
 </CardStack>;
}
export default Overview;
