// Next steps (issue 273): the proposed portfolio and accounts on the left, the holdout evidence on the right.
// Information, not advice. Nothing here places orders or moves money; draft trades are read-only.
import {useState} from 'react';
import {AdoptionTracking} from './AdoptionTracking';
import {Card,CardHeader,CardStack,PageHeader,SplitLayout,SelectField,CheckRow,Disclosure,StatusMessage,DataTable,AllocationBreakdown,MetricPair,ComparisonSummary,DataCoverage} from './ui/components';
import {TimeSeriesChart,type Series} from './ui/charts';
import {money,percent,decimal,formatDate} from './ui/format';
import {BASE,CURRENT,FUND_NAMES,rules,defaultRule,draftTrades,verdictTitle,edgeText,type NextData,type NextPayload,type Rule,type Holdout,type HoldoutRow,type Account,type Move} from './next-model';
export type {NextData} from './next-model';

const WRAPPER:Record<string,string>={taxable:'Taxable',roth_ira:'Roth IRA',traditional_ira:'Traditional IRA',hsa:'HSA','401k':'401(k)'};
const tradeName=(s:string)=>FUND_NAMES[s]??s;

function ProposalCard({list,rule,onRule,n,chosen,onChosen}:{list:Rule[];rule?:Rule;onRule(v:string):void;n:NextPayload;chosen:string[];onChosen(ids:string[]):void}){
 const accounts=n.accounts??[],today=n.today,picked=accounts.filter(a=>chosen.includes(a.id));
 const h=n.holdout;
 return <Card><SelectField label="Proposed portfolio" tone="proposal" value={rule?.name??''} onChange={onRule} options={list.map(r=>({value:r.name,label:r.label,group:r.group}))}/>
 {rule&&<p>{rule.desc}</p>}
 {rule?.weights?<><h3>If started today</h3><AllocationBreakdown weights={rule.weights} names={FUND_NAMES} tone="proposal"/>
  {h?.today?.from&&<p className="small">{rule.row?.kind==='fitted'?`Fitted on ${formatDate(h.today.from)} – ${formatDate(h.today.to)}, the same way as at every test start.`:'Fixed weights.'} Today’s weights are not tested themselves; the test is the evidence.</p>}</>
  :<StatusMessage kind="missing">{h?.today?.error??'Today’s weights are unavailable for this rule.'}</StatusMessage>}
 <div className="ui-current"><Disclosure title="Your current portfolio">{today&&today.total>0?<><p><b className="own-value">{money(today.total)}</b> across your accounts</p>
  <AllocationBreakdown weights={Object.fromEntries([...today.funds.slice(0,8).map(f=>[f.symbol,f.weight]),...today.lines.map(l=>[l.label,l.weight])])} names={FUND_NAMES}/>
  {today.funds.length>8&&<p className="small">Plus {today.funds.length-8} smaller holdings.</p>}</>:<StatusMessage kind="missing">Current holdings are unavailable.</StatusMessage>}</Disclosure></div>
 {accounts.length?<fieldset className="ui-fieldset"><legend>Accounts to change</legend>
  {accounts.map(a=><CheckRow key={a.id} tone="proposal" checked={chosen.includes(a.id)} onChange={on=>onChosen(on?[...chosen,a.id]:chosen.filter(x=>x!==a.id))} title={a.label}
   detail={`${WRAPPER[a.wrapper??'']??'Account'} · ${chosen.includes(a.id)?'would change':'stays as is'}`} value={money(a.value)}/>)}
  <p className="small">{picked.length?<><b className="proposal-value">{money(picked.reduce((s,a)=>s+(a.value??0),0))}</b> in {picked.length} of {accounts.length} accounts</>:'No accounts selected. Nothing changes.'}</p>
 </fieldset>:null}
 {picked.length&&rule?.weights?<Disclosure title="Draft buys and sells (read-only)"><p className="small">Moves each selected account from its holdings to today’s weights, using its latest balance. For review only: UFO never places orders. Check taxes, fees and surrender charges first.</p>
  {picked.map(a=>{const t=draftTrades(a,rule.weights!);return <div className="ui-draft" key={a.id}><h3>{a.label}</h3>{t==null?<StatusMessage kind="missing">Draft trades are unavailable: this account has no fund holdings to trade.</StatusMessage>:t.length?t.map(x=><div className="ui-draft-row" key={x.symbol}><span>{tradeName(x.symbol)}</span><strong>{x.amount<0?'Sell':'Buy'} {money(Math.abs(x.amount))}</strong></div>):<p className="small">Already at these weights.</p>}</div>;})}
 </Disclosure>:null}
 </Card>;
}

function ResultRow({r,tone,label}:{r:HoldoutRow;tone:'proposal'|'benchmark'|'portfolio';label:string}){
 return <tr data-tone={tone}><th>{label}<small>{r.kind==='fitted'?'fitted':r.kind==='reference'?'reference':'fixed'}</small></th><td>{percent(r.median,true)}<small className="ui-range">{percent(r.p10,true)} to {percent(r.p90,true)}</small></td><td>{percent(r.vol)}</td><td>{decimal(r.sharpe)}</td><td>{percent(r.worst,true)}</td></tr>;
}

function Evidence({h,rule}:{h?:Holdout;rule?:Rule}){
 if(!h)return <Card><CardHeader title="How did it hold up?"/><StatusMessage kind="missing">The holdout test did not run for this report. Refresh the report to run it.</StatusMessage></Card>;
 if(h.error||!h.rows?.length)return <Card><CardHeader title="How did it hold up?"/><StatusMessage kind="missing">The holdout test could not run: {h.error??'no result'}.</StatusMessage></Card>;
 const row=rule?.row,base=h.rows.find(r=>r.name===BASE),mine=h.rows.find(r=>r.name===CURRENT),neff=h.n_eff??0,status=h.verdict?.status;
 const shown:[HoldoutRow,'proposal'|'benchmark'|'portfolio',string][]=[...(row&&row.name!==BASE?[[row,'proposal',rule!.label] as [HoldoutRow,'proposal',string]]:[]),...(base?[[base,'benchmark','60/40'] as [HoldoutRow,'benchmark',string]]:[]),...(mine?[[mine,'portfolio','Your mix'] as [HoldoutRow,'portfolio',string]]:[])];
 const path=h.path??{},dates=h.path_dates??[];
 const series:Series[]=shown.filter(([r])=>path[r.name]?.length===dates.length).map(([r,tone,label])=>({key:r.name,label:label+(r.name===CURRENT?' (held fixed)':''),role:tone,values:path[r.name],quality:'modeled'}));
 return <Card id="evidence"><p className="ui-kicker">Compare the evidence</p><h2>How did it hold up?</h2>
 <p>At every month from {formatDate(h.first_start)} to {formatDate(h.last_start)}, each rule looked only at the {(h.train??120)/12} years before, chose its mix, then held it untouched for the next {h.hold??12} months. Rules never saw the months they were judged on.</p>
 <div className="ui-facts"><div><small>Each test</small><b>{(h.train??120)/12} years to choose, {h.hold??12} months held</b></div><div><small>Starting months</small><b>{h.windows}</b></div><div><small>Independent years (effective sample)</small><b>{neff}</b></div></div>
 <div className="ui-verdict" role="status"><h3>{verdictTitle(status)}</h3><p>{h.verdict?.headline}</p>{row&&row.kind==='fitted'&&edgeText(row)&&<p>{rule!.label}: {edgeText(row)}.</p>}
 <p>Starts a month apart share 11 of 12 months, so {h.windows} starts count as about {neff} independent years. Differences smaller than about two standard errors are noise.</p></div>
 <h3>Results over {neff} years of tests</h3>
 <DataTable label="Holdout results: selected rule, 60/40 and your mix"><thead><tr><th>Portfolio</th><th>Median year<small className="ui-range">middle 80%</small></th><th>Volatility</th><th>Sharpe</th><th>Worst year</th></tr></thead><tbody>{shown.map(([r,tone,label])=><ResultRow key={r.name} r={r} tone={tone} label={label}/>)}</tbody></DataTable>
 {!mine&&<p className="small">Your mix is left out: your holdings lack prices for enough of the test.</p>}
 <h3>Growth of $100, one start a year</h3>
 {dates.length>1&&series.length?<TimeSeriesChart key={rule?.name} label={`Growth of $100: each 12-month hold chained onto the last, ${formatDate(dates[0])} to ${formatDate(dates.at(-1))}`} dates={dates} series={series} zeroBaseline/>:<StatusMessage kind="missing">The chained path is unavailable.</StatusMessage>}
 <p className="small">No overlap: one 12-month hold a year, each starting where the last ended. Before tax and trading costs.</p>
 <Disclosure title="Every approach in the test"><DataTable label="All holdout results"><thead><tr><th>Approach</th><th>Median 12 months</th><th>Sharpe</th><th>Worst 12 months</th><th>Beat 60/40</th><th>Years</th></tr></thead>
  <tbody>{h.rows.map(r=><tr key={r.name}><th>{r.name===BASE?'60/40':r.name}<small>{r.kind}</small></th><td>{percent(r.median,true)}</td><td>{decimal(r.sharpe)}</td><td>{percent(r.worst,true)}</td><td>{r.beat==null?'—':percent(r.beat)}</td><td>{r.n_eff}</td></tr>)}</tbody></DataTable>
  {!!h.verdict?.details?.length&&<ul className="small">{h.verdict.details.map((x,i)=><li key={i}>{x}</li>)}</ul>}
  <p className="small">“Beat 60/40” is the share of all starting months a rule did better; neighbouring months overlap, so it is not a count of independent wins.</p></Disclosure>
 </Card>;
}

function Replay({n,rule,chosen,accounts}:{n:NextPayload;rule?:Rule;chosen:string[];accounts:Account[]}){
 const picked=accounts.filter(a=>chosen.includes(a.id)),moves=n.moves??{};
 const get=(a:Account):Move|undefined=>rule?.mixKey?moves[`${a.id}|${rule.mixKey}`]:undefined;
 const one=picked.length===1?get(picked[0]):undefined,acct=one?.account,hh=one?.household;
 return <Card><CardHeader title="With your deposits and withdrawals" caption="Today’s weights replayed through each selected account’s dated deposits and withdrawals. Hindsight, not part of the test."/>
 {!picked.length?<StatusMessage kind="info">Select an account on the left to see this replay.</StatusMessage>:!rule?.mixKey?<StatusMessage kind="missing">This replay is unavailable for this rule.</StatusMessage>
 :picked.length===1?(acct?<><MetricPair left={{label:n.estimated?'Recorded · includes estimates':'Recorded',value:money(acct.actual_value),detail:percent(acct.actual_irr,true)+' /yr'}} right={{label:'With today’s weights',tone:'proposal',value:money(acct.new_value),detail:percent(acct.new_irr,true)+' /yr'}}/>
  <ComparisonSummary difference={acct.new_value-acct.actual_value} tolerance={.5}>{money(Math.abs(acct.new_value-acct.actual_value))} {acct.new_value>=acct.actual_value?'more':'less'} in this replay</ComparisonSummary>
  <TimeSeriesChart key={rule.name+picked[0].id} label={`${picked[0].label}: recorded value and today’s weights replayed with the same payments`} dates={acct.months} series={[{key:'actual',label:'Recorded',role:'portfolio',values:acct.actual,quality:n.estimated?'estimated':'observed'},{key:'replay',label:'Today’s weights',role:'proposal',values:acct.new,quality:'modeled'}]}/>
  <DataCoverage from={acct.first} to={acct.as_of}>same deposits and withdrawals</DataCoverage>
  {hh?<div className="ui-subsection"><h3>Whole household</h3><p className="small">Only {picked[0].label} changes · history through {formatDate(hh.as_of)}</p><MetricPair left={{label:'As is',value:money(hh.as_is.value),detail:percent(hh.as_is.irr,true)+' /yr'}} right={{label:'With the change',tone:'proposal',value:money(hh.moved.value),detail:percent(hh.moved.irr,true)+' /yr'}}/></div>
   :one?.household_note?<p className="small">{one.household_note}</p>:null}</>
  :<StatusMessage kind="missing">{one?.error?`This replay is unavailable: ${one.error}`:'This replay is unavailable for this account.'}</StatusMessage>)
 :<><DataTable label="Replay for each selected account"><thead><tr><th>Account</th><th>Recorded</th><th>With today’s weights</th><th>As of</th></tr></thead><tbody>{picked.map(a=>{const m=get(a)?.account;return <tr key={a.id}><th>{a.label}</th><td className="own-value">{money(m?.actual_value)}</td><td className="proposal-value">{m?money(m.new_value):'Unavailable'}</td><td>{m?formatDate(m.as_of):'—'}</td></tr>;})}</tbody></DataTable>
  <p className="small">The household total is recomputed for one account at a time. Select a single account to see it.</p></>}
 </Card>;
}

export function NextSteps({data}:{data:NextData;onNavigate?(tab:string):void;benchmark?:string;onBenchmark?(symbol:string):void}){
 const n=data.nextSteps,list=rules(n),accounts=n?.accounts??[];
 const [pick,setPick]=useState(''),[chosen,setChosen]=useState<string[]|null>(null);
 if(!n)return null;
 const rule=list.find(r=>r.name===pick)??list.find(r=>r.name===defaultRule(list));
 const selected=chosen??(accounts.find(a=>a.holdings?.length)?[accounts.find(a=>a.holdings?.length)!.id]:[]);
 const h=n.holdout,proposals=(n.proposals??[]).filter(p=>p.status==='available');
 return <CardStack className="next-steps">
 <PageHeader kicker="Investment research" title="Next steps" note={n.asof?`Prices to ${formatDate(n.asof)}`:undefined}/>
 {n.error?<StatusMessage kind="error">{n.error}</StatusMessage>:<>
 <SplitLayout side={<ProposalCard list={list} rule={rule} onRule={setPick} n={n} chosen={selected} onChosen={setChosen}/>}>
  <Evidence h={h} rule={rule}/>
  <Replay n={n} rule={rule} chosen={selected} accounts={accounts}/>
 </SplitLayout>
 {n.adoptionTracking&&<AdoptionTracking tracking={n.adoptionTracking}/>}
 {proposals.length?<Disclosure variant="card" title="Other research · hindsight, not part of this test"><p className="small">These portfolios were chosen with today’s data and an older five-year method. They have not been through the holdout test, so they carry no evidence here. Shown for reference only.</p>
  {proposals.map(p=><div className="ui-subsection" key={p.id}><h3>{p.label} · {p.universe_label}</h3><p className="small">{p.method==='walk_forward'?'Refit each year':'Fitted once'}{p.training?` · training ${formatDate(p.training.from)} – ${formatDate(p.training.to)}`:''}</p><AllocationBreakdown weights={p.weights} names={FUND_NAMES} tone="neutral"/></div>)}</Disclosure>:null}
 <Disclosure variant="card" title="Figures and limitations">
  {h?.universe&&<p>Funds tested ({h.universe.name}, declared {formatDate(h.universe.declared)}): {h.universe.funds.map(tradeName).join(', ')}. At most {percent(h.universe.max_weight)} in any one fund. {h.universe.rationale}</p>}
  {h?.note&&<p>{h.note}</p>}
  <p>“Year” here is any 12-month hold, starting in any month. Sharpe is the average 12-month return above cash divided by its spread across starts. Volatility is the average within each 12-month hold. “Middle 80%” runs from the 10th to the 90th percentile of 12-month returns.</p>
  {n.history_note&&<p>{n.history_note}</p>}{n.assumptions?.length?<ul>{n.assumptions.filter(x=>!(h?.rows&&/walk-forward/i.test(x))).map((x,i)=><li key={i}>{x}</li>)}</ul>:null}
  <p>{n.disclaimer??'Before tax and trading or surrender costs. Past results are not forecasts.'} Information, not investment advice. UFO never places orders or moves money.</p>
 </Disclosure></>}
 </CardStack>;
}
