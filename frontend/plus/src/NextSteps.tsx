// Next steps: pick a fixed portfolio and the accounts to change on the left; its history, a trailing Sharpe ratio and the
// account replay on the right. Information, not advice. Nothing here places orders or moves money; draft trades are read-only.
import {useState} from 'react';
import {AdoptionTracking} from './AdoptionTracking';
import {ChoiceGate} from './ui/ChoiceGate';
import {Card,CardHeader,CardStack,PageHeader,SplitLayout,SelectField,CheckRow,Disclosure,StatusMessage,DataTable,AllocationBreakdown,Metric,MetricPair,ComparisonSummary,DataCoverage} from './ui/components';
import {TimeSeriesChart,RiskScatterChart,type ScatterPoint} from './ui/charts';
import {money,percent,ratio,formatDate} from './ui/format';
import {FUND_NAMES,PRO_FEATURES,SHELVED_FEATURES,title,portfolios,defaultPortfolio,draftTrades,rollingSharpe,swappedHousehold,monthlyReturns,commonMonths,riskRow,type NextData,type NextPayload,type Mix,type Account,type Row} from './next-model';
export type {NextData} from './next-model';

const WRAPPER:Record<string,string>={taxable:'Taxable',roth_ira:'Roth IRA',traditional_ira:'Traditional IRA',hsa:'HSA','401k':'401(k)'};
const tradeName=(s:string)=>FUND_NAMES[s]??s;

/** The choice itself: portfolio and accounts. Nothing is pre-filled; it lives inside the gate's picker. */
function Choice({list,mix,onMix,n,chosen,onChosen}:{list:Mix[];mix?:Mix;onMix(v:string):void;n:NextPayload;chosen:string[];onChosen(ids:string[]):void}){
 const accounts=n.accounts??[],picked=accounts.filter(a=>chosen.includes(a.id));
 return <>{/* an empty value shows a blank select until a portfolio is picked */}
 <SelectField label="Proposed portfolio" tone="proposal" value={mix?.key??''} onChange={onMix} options={[{value:'',label:'Choose a portfolio',disabled:true},...list.map(m=>({value:m.key,label:title(m),group:m.group}))]}/>
 {accounts.length?<fieldset className="ui-fieldset"><legend>Accounts to change</legend>
  {accounts.map(a=><CheckRow key={a.id} tone="proposal" checked={chosen.includes(a.id)} onChange={on=>onChosen(on?[...chosen,a.id]:chosen.filter(x=>x!==a.id))} title={a.label}
   detail={`${WRAPPER[a.wrapper??'']??'Account'} · ${chosen.includes(a.id)?'would change':'stays as is'}`} value={money(a.value)}/>)}
  <p className="small">{picked.length?<><b className="proposal-value">{money(picked.reduce((s,a)=>s+(a.value??0),0))}</b> in {picked.length} of {accounts.length} accounts</>:'No accounts checked. Nothing changes.'}</p>
 </fieldset>:null}</>;
}

/** What the confirmed portfolio looks like, and your current one; draft trades stay shelved. */
function Details({mix,n,chosen}:{mix?:Mix;n:NextPayload;chosen:string[]}){
 const accounts=n.accounts??[],today=n.today,picked=accounts.filter(a=>chosen.includes(a.id));
 return <Card>
 {mix&&<><h3>If started today</h3><AllocationBreakdown weights={mix.weights} names={FUND_NAMES} tone="proposal"/><p className="small">{mix.desc}</p></>}
 <div className="ui-current"><Disclosure title="Your current portfolio">{today&&today.total>0?<><p><b className="own-value">{money(today.total)}</b> across your accounts</p>
  <AllocationBreakdown weights={Object.fromEntries([...today.funds.slice(0,8).map(f=>[f.symbol,f.weight]),...today.lines.map(l=>[l.label,l.weight])])} names={FUND_NAMES}/>
  {today.funds.length>8&&<p className="small">Plus {today.funds.length-8} smaller holdings.</p>}</>:<StatusMessage kind="missing">Current holdings are unavailable.</StatusMessage>}</Disclosure></div>
 {SHELVED_FEATURES.draftTrades&&picked.length&&mix?<Disclosure title="Draft buys and sells (read-only)"><p className="small">From each account’s holdings to these weights, at its latest balance. UFO never places orders. Check taxes, fees and surrender charges first.</p>
  {picked.map(a=>{const t=draftTrades(a,mix.weights);return <div className="ui-draft" key={a.id}><h3>{a.label}</h3>{t==null?<StatusMessage kind="missing">No fund holdings to trade.</StatusMessage>:t.length?t.map(x=><div className="ui-draft-row" key={x.symbol}><span>{tradeName(x.symbol)}</span><strong>{x.amount<0?'Sell':'Buy'} {money(Math.abs(x.amount))}</strong></div>):<p className="small">Already at these weights.</p>}</div>;})}
 </Disclosure>:null}
 </Card>;
}

function HistoryRow({r,tone,label}:{r:Row;tone:'proposal'|'portfolio';label:string}){
 return <tr data-tone={tone}><th>{label}</th><td>{percent(r.ret,true)}</td><td>{percent(r.vol)}</td><td>{ratio(r.sharpe)}</td><td>{percent(r.worst,true)}</td></tr>;
}

function History({mix}:{mix?:Mix}){
 const c=mix?.compare,h=mix?.history;
 return <Card id="evidence"><CardHeader title="How it did in the past" caption="Past replay. History, not a forecast."/>
 {!mix?<StatusMessage kind="missing">No portfolio is available.</StatusMessage>:!c||c.error||!c.portfolio?<StatusMessage kind="missing">The history is unavailable{c?.error?`: ${c.error}`:''}.</StatusMessage>:<>
  <DataTable label={`${title(mix)} and your current portfolio over the same months`}><thead><tr><th>Portfolio</th><th>Return /yr</th><th>Volatility</th><th>Sharpe</th><th>Worst fall</th></tr></thead>
  <tbody><HistoryRow r={c.portfolio} tone="proposal" label={title(mix)}/>{c.current&&<HistoryRow r={c.current} tone="portfolio" label="Your portfolio"/>}</tbody></DataTable>
  <DataCoverage from={c.from} to={c.to}>same months for both</DataCoverage>
  {!c.current&&<p className="small">Your portfolio is left out: no priced funds.</p>}
  {h&&h.from<(c.from??'')&&<p className="small">{title(mix)} alone, {formatDate(h.from)} – {formatDate(h.to)}: {percent(h.ann,true)} a year, worst fall {percent(h.worst_fall,true)}.</p>}
 </>}
 </Card>;
}

/** Risk versus return (issue 327): your portfolio, the household with the checked accounts switched (value-weighted, recomputed
 * on every change), the proposed portfolio alone and the benchmark, all over the same months. Past replay. */
function RiskReturn({n,mix,chosen,accounts,benchmark}:{n:NextPayload;mix?:Mix;chosen:string[];accounts:Account[];benchmark:string}){
 const g=n.grid;
 if(!g||g.months.length<13||!mix?.grid_returns)return <History mix={mix}/>;
 const asIs=monthlyReturns(g.values,g.net,g.weighted),swap=chosen.length?swappedHousehold(g,n.moves??{},mix.key,chosen):undefined;
 const moved=swap?.used.length?monthlyReturns(swap.values,g.net,g.weighted):undefined,bench=g.bench?.[benchmark];
 const months=commonMonths([asIs,mix.grid_returns,...(bench?[bench]:[]),...(moved?[moved]:[])]);
 const funds=mix.name.split(' · ').at(-1)??mix.name,name=(id:string)=>accounts.find(a=>a.id===id)?.label??id;
 const point=(key:string,label:string,markerLabel:string,role:'portfolio'|'proposal'|'benchmark',rets:(number|null)[],marker:'dot'|'ring'='dot'):ScatterPoint|null=>{
  const r=riskRow(rets,g.rf,months);return r.ret==null||r.vol==null?null:{key,label,markerLabel,role,marker,x:r.vol,y:r.ret,sharpe:r.sharpe};};
 const points=[point('yours','Your portfolio','Yours','portfolio',asIs),moved?point('changed',`With the change (${swap!.used.length===1?name(swap!.used[0]):swap!.used.length+' accounts'} in ${funds})`,'With the change','proposal',moved,'ring'):null,
  point('proposed',`${title(mix)} alone`,funds,'proposal',mix.grid_returns),bench?point('bench',`${benchmark} (benchmark)`,benchmark,'benchmark',bench):null].filter((p):p is ScatterPoint=>p!=null);
 return <Card id="evidence"><CardHeader title="Risk versus return" caption={months.length?`Past replay · ${formatDate(g.months[months[0]])} – ${formatDate(g.months[months.at(-1)!])}`:'Past replay'}/>
 {months.length<12?<StatusMessage kind="missing">Needs at least 12 months that every point shares.</StatusMessage>:<>
  <RiskScatterChart inspect key={mix.key+chosen.join()+benchmark} points={points} label={`Yearly return versus volatility: your portfolio, ${title(mix)}${moved?', the household with the change':''}${bench?` and ${benchmark}`:''}`} xTitle="Volatility / year" yTitle="Return / year"/>
  <p className="small">Tap a point for its numbers.{!chosen.length?' Check an account to add the household with the change.':''}{!bench?` ${benchmark} has no prices for these months.`:''}</p></>}
 </Card>;
}

function SharpeOverTime({n,mix,chosen,accounts}:{n:NextPayload;mix?:Mix;chosen:string[];accounts:Account[]}){
 const g=n.grid;
 if(!g||g.months.length<2)return <Card><CardHeader title="Sharpe ratio over time"/><StatusMessage kind="missing">Needs a household total with monthly values.</StatusMessage></Card>;
 const asIs=rollingSharpe(g.values,g.net,g.weighted,g.rf,g.window);
 const swap=mix?swappedHousehold(g,n.moves??{},mix.key,chosen):undefined;
 const moved=swap?.used.length?rollingSharpe(swap.values,g.net,g.weighted,g.rf,g.window):undefined;
 const start=asIs.findIndex(v=>v!=null),name=(id:string)=>accounts.find(a=>a.id===id)?.label??id;
 return <Card><CardHeader title="Sharpe ratio over time" caption={`Trailing ${g.window/12} years. Past replay with hindsight.`}/>
 {start<0?<StatusMessage kind="missing">Needs {g.window} months of household history.</StatusMessage>:
  <TimeSeriesChart kind="ratio" key={(mix?.key??'')+chosen.join()} label={`Household Sharpe ratio, trailing ${g.window} months: as is${moved?' and with the checked accounts in '+title(mix!):''}`}
   dates={g.months.slice(start)} series={[{key:'as-is',label:'As is',role:'portfolio',values:asIs.slice(start),quality:n.estimated?'estimated':'observed'},
    ...(moved?[{key:'moved',label:`Checked accounts in ${title(mix!)}`,role:'proposal' as const,values:moved.slice(start),quality:'modeled' as const}]:[])]}/>}
 {!chosen.length?<p className="small">Check an account to compare.</p>:swap?.skipped.length?<p className="small">Not in the household total, so left as is: {swap.skipped.map(name).join(', ')}.</p>:null}
 </Card>;
}

/** The household replayed with the checked accounts in the proposed portfolio, through the same dated deposits and withdrawals.
 * Always shown: with nothing checked it is your portfolio alone. Value-weighted by construction (each account's own values). */
function Replay({n,mix,chosen,accounts}:{n:NextPayload;mix?:Mix;chosen:string[];accounts:Account[]}){
 const g=n.grid&&n.grid.months.length>1?n.grid:undefined,moves=n.moves??{},picked=accounts.filter(a=>chosen.includes(a.id));
 const swap=g&&mix&&picked.length?swappedHousehold(g,moves,mix.key,chosen):undefined,changed=swap?.used.length?swap:undefined;
 const name=(id:string)=>accounts.find(a=>a.id===id)?.label??id,quality=n.estimated?'estimated' as const:'observed' as const;
 const now=g?g.values.at(-1):n.today?.total,after=changed?.values.at(-1);
 return <Card className="ui-replay" aria-label="Your portfolio, replayed with the same deposits and withdrawals">
 {changed&&mix?<><MetricPair left={{label:'Your portfolio',value:money(now)}} right={{label:'With the change',tone:'proposal',value:money(after)}}/>
  <ComparisonSummary difference={(after??0)-(now??0)} tolerance={.5}>{money(Math.abs((after??0)-(now??0)))} {(after??0)>=(now??0)?'more':'less'} in this replay</ComparisonSummary></>
  :<div className="ui-metric-pair"><Metric label="Your portfolio" value={money(now)}/></div>}
 {g?<><TimeSeriesChart key={(mix?.key??'')+chosen.join()} label={`Household value: your portfolio${changed&&mix?` and with the checked accounts in ${title(mix)}`:''}`} dates={g.months}
   series={[{key:'as-is',label:'Your portfolio',role:'portfolio',values:g.values,quality},...(changed&&mix?[{key:'moved',label:'With the change',role:'proposal' as const,values:changed.values,quality:'modeled' as const}]:[])]}/>
  <DataCoverage from={g.months[0]} to={g.months.at(-1)}>{changed?'same deposits and withdrawals · past replay':'recorded household value'}</DataCoverage></>
  :<StatusMessage kind="missing">The household’s monthly history is unavailable{picked.length?', so only each checked account is shown':''}.</StatusMessage>}
 {!picked.length?(accounts.length?<p className="small">Check an account to see it in {mix?title(mix):'a portfolio'}.</p>:null):!mix?<StatusMessage kind="missing">No portfolio is available.</StatusMessage>:<>
  {swap?.skipped.length?<p className="small">Not in the household total, so left as is: {swap.skipped.map(name).join(', ')}.</p>:null}
  <Disclosure title={picked.length===1?'The checked account':`The ${picked.length} checked accounts`} defaultOpen={!g}><DataTable label="Replay for each checked account"><thead><tr><th>Account</th><th>As is</th><th>{title(mix)}</th><th>As of</th></tr></thead><tbody>{picked.map(a=>{const m=moves[`${a.id}|${mix.key}`],r=m?.account;return <tr key={a.id}><th>{a.label}</th><td className="own-value">{money(r?.actual_value??a.value)}</td><td className="proposal-value">{r?money(r.new_value):'Unavailable'}</td><td>{r?formatDate(r.as_of):'—'}</td></tr>;})}</tbody></DataTable></Disclosure></>}
 </Card>;
}

// Last confirmed choice, kept for this session only (module memory; never saved to disk).
let remembered:{pick:string;chosen:string[]}|null=null;

export function NextSteps({data,benchmark,initial}:{data:NextData;initial?:{pick:string;chosen:string[]};onNavigate?(tab:string):void;benchmark?:string;onBenchmark?(symbol:string):void}){
 const n=data.nextSteps,list=portfolios(n),accounts=n?.accounts??[];
 const start=initial??remembered,ok=start&&list.some(m=>m.key===start.pick)?start:null;
 const [pick,setPick]=useState(ok?.pick??''),[chosen,setChosen]=useState<string[]>(ok?.chosen.filter(id=>accounts.some(a=>a.id===id))??[]),[confirmed,setConfirmed]=useState(!!ok);
 if(!n)return null;
 const mix=list.find(m=>m.key===pick);
 const standins=mix?.compare?.standins??[];
 const confirm=()=>{remembered={pick,chosen};setConfirmed(true);};
 return <CardStack className="next-steps">
 <PageHeader title="Next steps"/>
 {n.error?<StatusMessage kind="error">{n.error}</StatusMessage>:<>
 <ChoiceGate heading="Your choice" confirmed={confirmed&&!!mix} canConfirm={!!mix} confirmLabel="Show results" onConfirm={confirm} onChange={()=>setConfirmed(false)}
  summary={mix?`${title(mix)} · ${chosen.length} of ${accounts.length} accounts`:''}
  picker={<Choice list={list} mix={mix} onMix={setPick} n={n} chosen={chosen} onChosen={setChosen}/>}
  placeholder={<div className="ui-gate-ghost"><i/><i/></div>}>
 <SplitLayout side={<Details mix={mix} n={n} chosen={chosen}/>}>
  <Replay n={n} mix={mix} chosen={chosen} accounts={accounts}/>
  <RiskReturn n={n} mix={mix} chosen={chosen} accounts={accounts} benchmark={benchmark??data.benchmark}/>
  {PRO_FEATURES.sharpeOverTime&&<SharpeOverTime n={n} mix={mix} chosen={chosen} accounts={accounts}/>}
 </SplitLayout>
 </ChoiceGate>
 {n.adoptionTracking&&<section className="ui-track" aria-labelledby="track-change"><hr className="ui-track-rule"/>
  <h2 id="track-change" className="ui-track-title">Track a change you made</h2>
  <p className="ui-caption">Separate from the proposed portfolio above: once you have changed your real holdings, this compares what happened with keeping the old ones.</p>
  <AdoptionTracking tracking={n.adoptionTracking} accounts={accounts}/></section>}
 <Disclosure variant="card" title="Fine print">
  {standins.length?<p>Stand-ins before a fund existed: {standins.map(s=>`${s.standin} for ${s.fund} before ${formatDate(s.before)}`).join('; ')}.</p>:null}
  {mix?.compare?.current_left_out?.length?<p>Left out of your portfolio (no prices): {mix.compare.current_left_out.join(', ')}. Cash and accounts without fund holdings are left out too.</p>:<p>Your portfolio here is your priced funds at today’s weights; cash and accounts without fund holdings are left out.</p>}
  {n.history_note&&<p>{n.history_note}</p>}{n.assumptions?.length?<ul>{n.assumptions.map((x,i)=><li key={i}>{x}</li>)}</ul>:null}
 </Disclosure></>}
 </CardStack>;
}
