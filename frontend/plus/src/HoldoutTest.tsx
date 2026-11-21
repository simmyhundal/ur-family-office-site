import {useState} from 'react';
import {Card,SelectField,Disclosure,StatusMessage,DataTable} from './ui/components';
import {TimeSeriesChart} from './ui/charts';
import {percent as pct,decimal as num} from './ui/format';
export type HoldoutRow={name:string;kind:string;desc:string;windows:number;n_eff:number;median:number;p10:number;p90:number;vol:number|null;sharpe:number|null;worst:number;beat:number|null;edge:number|null;se:number|null;verdict:string|null};
export type Holdout={error?:string;rows?:HoldoutRow[];path?:Record<string,number[]>;path_dates?:string[];train?:number;hold?:number;windows?:number;n_eff?:number;from?:string;to?:string;note?:string;universe?:{name:string;declared:string;rationale:string;funds:string[];max_weight:number};verdict?:{headline:string;details:string[]}};
const BASE='60/40 (VTI/AGG)';
export function HoldoutTest({data}:{data?:Holdout}){
 const [pick,setPick]=useState('');
 if(!data)return null;
 if(data.error||!data.rows)return <Card><h2>Rolling holdout test</h2><StatusMessage kind="missing">The rolling holdout test could not run: {data.error??'no result'}</StatusMessage></Card>;
 const names=data.rows.filter(r=>r.name!==BASE).map(r=>r.name),chosen=names.includes(pick)?pick:names[0],path=data.path??{},dates=data.path_dates??[];
 return <Card><h2>Rolling holdout test</h2>
 <p className="small">Fit on the {(data.train??120)/12} years before each start, then hold {(data.hold??12)} months with no rebalancing, at every monthly start from {data.from} to {data.to}. Fitted rules never see the months they are held. Information, not advice.</p>
 <StatusMessage kind="info">{data.verdict?.headline}</StatusMessage>
 <p className="small"><strong>{data.n_eff} non-overlapping years</strong> sit behind {data.windows} overlapping monthly starts. Neighbouring starts share 11 of 12 months, so treat the figures as roughly {data.n_eff} independent observations, not {data.windows}.</p>
 <DataTable label="Rolling holdout results"><thead><tr><th>Approach</th><th>Median 12 months</th><th>10th–90th</th><th>Volatility</th><th>Sharpe</th><th>Worst 12 months</th><th>Beat 60/40</th><th>Years</th></tr></thead>
 <tbody>{data.rows.map(r=><tr key={r.name}><th>{r.name}<span className="small"> · {r.kind==='fitted'?'fitted':r.kind==='reference'?'reference':'fixed'}</span></th><td>{pct(r.median)}</td><td>{pct(r.p10)} to {pct(r.p90)}</td><td>{pct(r.vol)}</td><td>{num(r.sharpe)}</td><td>{pct(r.worst)}</td><td>{r.beat==null?'–':pct(r.beat,false)}</td><td>{r.n_eff}</td></tr>)}</tbody></DataTable>
 {!!data.verdict?.details?.length&&<ul>{data.verdict.details.map((x,i)=><li key={i}>{x}</li>)}</ul>}
 {dates.length>1&&path[chosen]&&path[BASE]&&<>
 <SelectField label="Chained path" value={chosen} onChange={setPick} options={names.map(n=>({value:n,label:n}))}/>
 <p className="small">Growth of $100 from one start a year, each 12-month hold chained onto the last. No overlap.</p>
 <TimeSeriesChart label={`${chosen} and ${BASE}: growth of $100, one non-overlapping start a year`} zeroBaseline dates={dates} series={[{key:chosen,label:chosen,role:'portfolio',values:path[chosen]},{key:BASE,label:BASE,role:'benchmark',values:path[BASE]}]}/></>}
 <Disclosure title="How this was tested">{data.rows.map(r=><p key={r.name} className="small"><strong>{r.name}:</strong> {r.desc}</p>)}
 <p className="small">Funds ({data.universe?.name}, declared {data.universe?.declared}): {data.universe?.funds.join(', ')}. At most {pct(data.universe?.max_weight??0.4)} per fund; a fund joins a start only if it (or its stand-in) covers all 120 training months.</p><p className="small">Sharpe is the average 12-month return above cash divided by its spread across starts. Volatility is the average within-window figure. "Years" is the effective sample size.</p><p className="small">{data.note}</p></Disclosure></Card>;
}
