import {useState} from 'react';
import {Card,CardHeader,SelectField,StatusMessage,MetricPair,ComparisonSummary,Disclosure,DataCoverage} from './ui/components';
import {TimeSeriesChart} from './ui/charts';
import {money} from './ui/format';
import type {AdoptionTracking as Tracking} from './research-types';
export function AdoptionTracking({tracking}:{tracking?:Tracking}){
 const [id,setId]=useState('');
 const baseline=tracking?.baselines?.find(b=>b.id===id)??tracking?.baselines?.[0];
 return <Card><CardHeader title="If you had kept your previous holdings" caption="Track recorded account values against a saved pre-change baseline."/>
 {tracking?.error?<StatusMessage kind="error">{tracking.error}</StatusMessage>:!baseline?<StatusMessage kind="info">Before changing your holdings, choose “Save previous-holdings baseline” in the local installer menu. Viewing a proposal does not save a baseline or record a trade.</StatusMessage>:<>
 <SelectField label="Saved baseline" value={baseline.id} onChange={setId} options={tracking!.baselines.map(b=>({value:b.id,label:`${b.label} · ${b.adopted_on}`}))}/>
 {baseline.status!=='ready'?<StatusMessage kind="missing">{baseline.reason??'Import later observed balances to begin this comparison.'}</StatusMessage>:<>
 <DataCoverage from={baseline.adopted_on} to={baseline.as_of}>{baseline.account_ids.length} selected {baseline.account_ids.length===1?'account':'accounts'}</DataCoverage>
 <MetricPair left={{label:'Recorded value',value:money(baseline.actual_value)}} right={{label:'If previous holdings were kept',tone:'benchmark',value:money(baseline.previous_value)}}/>
 <ComparisonSummary difference={baseline.difference} tolerance={.5}>{money(Math.abs(baseline.difference??0))} {(baseline.difference??0)>=0?'above':'below'} the hypothetical kept-holdings value</ComparisonSummary>
 {baseline.chart&&<TimeSeriesChart dates={baseline.chart.dates} label="Recorded value versus previous holdings, with matching deposits and withdrawals" series={[{key:'actual',label:'Recorded selected accounts',role:'portfolio',values:baseline.chart.actual,quality:'observed'},{key:'previous',label:'Previous holdings kept',role:'benchmark',values:baseline.chart.previous,quality:'modeled'}]}/>}
 </>}</>}
 <Disclosure title="Baseline assumptions"><p>{tracking?.policy??'The saved baseline is preserved. Deposits and withdrawals are matched by account; new money and withdrawals are allocated proportionally. Distributions are reinvested.'}</p><p>This is an observed-versus-hypothetical comparison, not proof that UFO caused the difference. Missing historical holdings or observed values are reported as unavailable. Nothing places orders.</p></Disclosure>
 </Card>;
}
