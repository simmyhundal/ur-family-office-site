import {useState} from 'react';
import {Card,CardHeader,SelectField,StatusMessage,MetricPair,ComparisonSummary,Disclosure,DataCoverage} from './ui/components';
import {TimeSeriesChart} from './ui/charts';
import {money,percent,ratio} from './ui/format';
import type {AdoptionTracking as Tracking} from './research-types';

type Baseline=Tracking['baselines'][number];
const proposalName=(b:Baseline)=>typeof b.proposal==='string'?b.proposal:b.proposal?.label;

/** Since a saved change: recorded values against the saved previous holdings, through the same deposits and withdrawals. */
export function AdoptionTracking({tracking,accounts=[]}:{tracking?:Tracking;accounts?:{id:string;label:string}[]}){
 const [id,setId]=useState('');
 const baseline=tracking?.baselines?.find(b=>b.id===id)??tracking?.baselines?.[0];
 const names=baseline?.account_ids.map(a=>accounts.find(x=>x.id===a)?.label??a)??[];
 const into=baseline&&proposalName(baseline),hasSharpe=baseline?.actual_sharpe!=null&&baseline?.previous_sharpe!=null;
 return <Card><CardHeader title="If you had kept your previous holdings"/>
 {tracking?.error?<StatusMessage kind="error">{tracking.error}</StatusMessage>:!baseline?<StatusMessage kind="info">Before changing your holdings, choose “Save previous-holdings baseline” in the local installer menu. Viewing a proposal does not save a baseline or record a trade.</StatusMessage>:<>
 {tracking!.baselines.length>1&&<SelectField label="Saved baseline" value={baseline.id} onChange={setId} options={tracking!.baselines.map(b=>({value:b.id,label:`${b.label} · ${b.adopted_on}`}))}/>}
 {baseline.status!=='ready'?<StatusMessage kind="missing">{baseline.reason??'Import later observed balances to begin this comparison.'}</StatusMessage>:<>
 <DataCoverage from={baseline.adopted_on} to={baseline.as_of}>since you changed {names.join(', ')}{into?` to ${into}`:''}</DataCoverage>
 <MetricPair left={{label:'Your portfolio',value:baseline.actual_return!=null?percent(baseline.actual_return,true):money(baseline.actual_value),detail:baseline.actual_return!=null?money(baseline.actual_value):undefined}}
  right={{label:'Previous holdings kept',tone:'benchmark',value:baseline.previous_return!=null?percent(baseline.previous_return,true):money(baseline.previous_value),detail:baseline.previous_return!=null?money(baseline.previous_value):undefined}}/>
 <ComparisonSummary difference={baseline.difference} tolerance={.5}>{money(Math.abs(baseline.difference??0))} {(baseline.difference??0)>=0?'more':'less'} than if you had kept them</ComparisonSummary>
 {baseline.chart&&<TimeSeriesChart dates={baseline.chart.dates} label="Recorded value versus previous holdings kept, with the same deposits and withdrawals" series={[{key:'actual',label:'Your portfolio',role:'portfolio',values:baseline.chart.actual,quality:'observed'},{key:'previous',label:'Previous holdings kept',role:'benchmark',values:baseline.chart.previous,quality:'modeled'}]}/>}
 <p className="small">{baseline.months!=null&&baseline.months<36?`${baseline.months} ${baseline.months===1?'month is':'months is'} short; this is not proof. `:''}{hasSharpe?`Sharpe ${ratio(baseline.actual_sharpe)} against ${ratio(baseline.previous_sharpe)} kept. `:'Sharpe needs 12 months. '}Same deposits and withdrawals.{baseline.stopped_early?' Ends at the last date your activity history covers.':''}</p>
 </>}</>}
 <Disclosure title="How this is worked out"><p>{tracking?.policy??'The saved baseline is preserved. Deposits and withdrawals are matched by account; new money and withdrawals are allocated proportionally. Distributions are reinvested.'}</p><p>This is an observed-versus-hypothetical comparison, not proof that UFO caused the difference. Missing historical holdings or observed values are reported as unavailable. Nothing places orders.</p></Disclosure>
 </Card>;
}
