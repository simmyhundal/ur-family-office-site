// Next steps: pick a fixed portfolio and the accounts to change on the left; its history, a trailing Sharpe ratio and the
// account replay on the right. Information, not advice. Nothing here places orders or moves money; draft trades are read-only.
import {useState} from 'react';
import {AdoptionTracking} from './AdoptionTracking';
import {Card,CardHeader,CardStack,PageHeader,SplitLayout,SelectField,CheckRow,Disclosure,StatusMessage,DataTable,AllocationBreakdown,MetricPair,ComparisonSummary,DataCoverage} from './ui/components';
import {TimeSeriesChart} from './ui/charts';
import {money,percent,ratio,formatDate} from './ui/format';
import {FUND_NAMES,title,portfolios,defaultPortfolio,draftTrades,rollingSharpe,swappedHousehold,type NextData,type NextPayload,type Mix,type Account,type Move,type Row} from './next-model';
export type {NextData} from './next-model';

const WRAPPER:Record<string,string>={taxable:'Taxable',roth_ira:'Roth IRA',traditional_ira:'Traditional IRA',hsa:'HSA','401k':'401(k)'};
const tradeName=(s:string)=>FUND_NAMES[s]??s;

function Picker({list,mix,onMix,n,chosen,onChosen}:{list:Mix[];mix?:Mix;onMix(v:string):void;n:NextPayload;chosen:string[];onChosen(ids:string[]):void}){
 const accounts=n.accounts??[],today=n.today,picked=accounts.filter(a=>chosen.includes(a.id));
 return <Card><SelectField label="Proposed portfolio" tone="proposal" value={mix?.key??''} onChange={onMix} options={list.map(m=>({value:m.key,label:title(m),group:m.group}))}/>
 {mix&&<><h3>If started today</h3><AllocationBreakdown weights={mix.weights} names={FUND_NAMES} tone="proposal"/><p className="small">{mix.desc}</p></>}
 <div className="ui-current"><Disclosure title="Your current portfolio">{today&&today.total>0?<><p><b className="own-value">{money(today.total)}</b> across your accounts</p>
  <AllocationBreakdown weights={Object.fromEntries([...today.funds.slice(0,8).map(f=>[f.symbol,f.weight]),...today.lines.map(l=>[l.label,l.weight])])} names={FUND_NAMES}/>
  {today.funds.length>8&&<p className="small">Plus {today.funds.length-8} smaller holdings.</p>}</>:<StatusMessage kind="missing">Current holdings are unavailable.</StatusMessage>}</Disclosure></div>
 {accounts.length?<fieldset className="ui-fieldset"><legend>Accounts to change</legend>
  {accounts.map(a=><CheckRow key={a.id} tone="proposal" checked={chosen.includes(a.id)} onChange={on=>onChosen(on?[...chosen,a.id]:chosen.filter(x=>x!==a.id))} title={a.label}
   detail={`${WRAPPER[a.wrapper??'']??'Account'} · ${chosen.includes(a.id)?'would change':'stays as is'}`} value={money(a.value)}/>)}
  <p className="small">{picked.length?<><b className="proposal-value">{money(picked.reduce((s,a)=>s+(a.value??0),0))}</b> in {picked.length} of {accounts.length} accounts</>:'No accounts checked. Nothing changes.'}</p>
 </fieldset>:null}
 {picked.length&&mix?<Disclosure title="Draft buys and sells (read-only)"><p className="small">From each account’s holdings to these weights, at its latest balance. UFO never places orders. Check taxes, fees and surrender charges first.</p>
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

function Replay({n,mix,chosen,accounts}:{n:NextPayload;mix?:Mix;chosen:string[];accounts:Account[]}){
 const picked=accounts.filter(a=>chosen.includes(a.id)),moves=n.moves??{};
 const get=(a:Account):Move|undefined=>mix?moves[`${a.id}|${mix.key}`]:undefined;
 const one=picked.length===1?get(picked[0]):undefined,acct=one?.account,hh=one?.household;
 return <Card><CardHeader title="With your deposits and withdrawals" caption="The portfolio replayed through each checked account’s own dated payments. Hindsight."/>
 {!picked.length?<StatusMessage kind="info">Check an account on the left to see this replay.</StatusMessage>:!mix?<StatusMessage kind="missing">This replay is unavailable.</StatusMessage>
 :picked.length===1?(acct?<><MetricPair left={{label:n.estimated?'Recorded · includes estimates':'Recorded',value:money(acct.actual_value),detail:percent(acct.actual_irr,true)+' /yr'}} right={{label:title(mix),tone:'proposal',value:money(acct.new_value),detail:percent(acct.new_irr,true)+' /yr'}}/>
  <ComparisonSummary difference={acct.new_value-acct.actual_value} tolerance={.5}>{money(Math.abs(acct.new_value-acct.actual_value))} {acct.new_value>=acct.actual_value?'more':'less'} in this replay</ComparisonSummary>
  <TimeSeriesChart key={mix.key+picked[0].id} label={`${picked[0].label}: recorded value and ${title(mix)} replayed with the same payments`} dates={acct.months} series={[{key:'actual',label:'Recorded',role:'portfolio',values:acct.actual,quality:n.estimated?'estimated':'observed'},{key:'replay',label:title(mix),role:'proposal',values:acct.new,quality:'modeled'}]}/>
  <DataCoverage from={acct.first} to={acct.as_of}>same deposits and withdrawals</DataCoverage>
  {hh?<div className="ui-subsection"><h3>Whole household</h3><p className="small">Only {picked[0].label} changes · through {formatDate(hh.as_of)}</p><MetricPair left={{label:'As is',value:money(hh.as_is.value),detail:percent(hh.as_is.irr,true)+' /yr'}} right={{label:'With the change',tone:'proposal',value:money(hh.moved.value),detail:percent(hh.moved.irr,true)+' /yr'}}/></div>
   :one?.household_note?<p className="small">{one.household_note}</p>:null}</>
  :<StatusMessage kind="missing">{one?.error?`This replay is unavailable: ${one.error}`:'This replay is unavailable for this account.'}</StatusMessage>)
 :<DataTable label="Replay for each checked account"><thead><tr><th>Account</th><th>Recorded</th><th>{title(mix)}</th><th>As of</th></tr></thead><tbody>{picked.map(a=>{const m=get(a)?.account;return <tr key={a.id}><th>{a.label}</th><td className="own-value">{money(m?.actual_value)}</td><td className="proposal-value">{m?money(m.new_value):'Unavailable'}</td><td>{m?formatDate(m.as_of):'—'}</td></tr>;})}</tbody></DataTable>}
 </Card>;
}

export function NextSteps({data}:{data:NextData;onNavigate?(tab:string):void;benchmark?:string;onBenchmark?(symbol:string):void}){
 const n=data.nextSteps,list=portfolios(n),accounts=n?.accounts??[];
 const [pick,setPick]=useState(''),[chosen,setChosen]=useState<string[]|null>(null);
 if(!n)return null;
 const mix=list.find(m=>m.key===pick)??list.find(m=>m.key===defaultPortfolio(list));
 const first=accounts.find(a=>a.holdings?.length),selected=chosen??(first?[first.id]:[]);
 const standins=mix?.compare?.standins??[];
 return <CardStack className="next-steps">
 <PageHeader kicker="Investment research" title="Next steps" note={n.asof?`Prices to ${formatDate(n.asof)}`:undefined}/>
 {n.error?<StatusMessage kind="error">{n.error}</StatusMessage>:<>
 <SplitLayout side={<Picker list={list} mix={mix} onMix={setPick} n={n} chosen={selected} onChosen={setChosen}/>}>
  <History mix={mix}/>
  <SharpeOverTime n={n} mix={mix} chosen={selected} accounts={accounts}/>
  <Replay n={n} mix={mix} chosen={selected} accounts={accounts}/>
 </SplitLayout>
 {n.adoptionTracking&&<AdoptionTracking tracking={n.adoptionTracking}/>}
 <Disclosure variant="card" title="Fine print">
  {standins.length?<p>Stand-ins before a fund existed: {standins.map(s=>`${s.standin} for ${s.fund} before ${formatDate(s.before)}`).join('; ')}.</p>:null}
  {mix?.compare?.current_left_out?.length?<p>Left out of your portfolio (no prices): {mix.compare.current_left_out.join(', ')}. Cash and accounts without fund holdings are left out too.</p>:<p>Your portfolio here is your priced funds at today’s weights; cash and accounts without fund holdings are left out.</p>}
  {n.history_note&&<p>{n.history_note}</p>}{n.assumptions?.length?<ul>{n.assumptions.map((x,i)=><li key={i}>{x}</li>)}</ul>:null}
 </Disclosure>
 <p className="small ui-disclaimer">Information, not advice.</p></>}
 </CardStack>;
}
