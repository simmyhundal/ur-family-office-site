// Tax tab (layout mock v5, docs/mocks/tax-tab-v5.html): a rate picker first, then what depends on it. Information, not tax advice.
// Read-only: nothing is sold or proposed. A figure the exports cannot give is shown as not available, never guessed.
import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {ChoiceGate} from './ui/ChoiceGate';
import {useDefinitions} from './ui/definitions';
import {Card,CardStack,PageHeader,Takeaway,StatusMessage,Disclosure} from './ui/components';
import {money,percent,formatDate} from './ui/format';
import {SankeyWide,SankeyList,useWidth} from './tax-sankey';
import {FOOTER,STATUSES,STD,LTT,ORD,LOSS_CAP,RATE_KEY,dollars,pct,words2,ordRateAt,scenario,compute,lotCut,sumLoss,incomeOf,parseRate,
 type TaxData,type Rate,type Status,type Income,type Investment,type LossLot} from './tax-model';

const DEFS:Record<string,[string,string]>={
 st:['Short-term gains','Profit on shares sold within a year of buying them. Taxed at your ordinary rate, like your pay.'],
 lt:['Long-term gains','Profit on shares held more than a year before selling. Taxed at 0%, 15% or 20%, depending on income.'],
 od:['Ordinary dividends','Dividends that don’t qualify for the lower rate, such as most bond-fund and money-market payouts. Taxed like your pay.'],
 qd:['Qualified dividends','Most stock-fund dividends, if you held the shares more than 60 days around the payout. Taxed at the lower long-term rate.'],
 wash:['Wash sale','Selling at a loss and buying the same or a nearly identical fund within 30 days before or after. The loss moves into the new shares instead of counting this year.'],
 ltcg:['Long-term capital gains tax','What you’d owe if you sold today and every lot had been held over a year, with the gains added on top of this year’s income. A loss lowers it.'],
 taxable:['Taxable','Brokerage accounts. Gains, dividends and interest are taxed the year they happen.'],
 deferred:['Tax-deferred','Traditional IRAs and 401(k)s. No yearly tax; withdrawals are taxed as income.'],
 free:['Tax-free','Roth accounts. No yearly tax, and qualified withdrawals are not taxed.'],
 bracket:['Tax bracket','The rate on your last dollar of ordinary income. Lower dollars are taxed at lower rates.']};
const Def=({k,children}:{k:string;children:string})=><span data-def={k} tabIndex={0}>{children}</span>;
const statusWords=(s:Status)=>STATUSES.find(x=>x.value===s)!.words;
/** The year the investment figures belong to, for the headline. */
const yearOf=(i?:Investment)=>i?.asof?i.asof.slice(0,4):'';

// ---- The rate picker: the choice every exhibit depends on. The gate itself is the shared ChoiceGate (issue 417). ----
function RateFields({status,digits,onStatus,onDigits,onEnter}:{status:Status|null;digits:string;onStatus(s:Status):void;onDigits(d:string):void;onEnter():void}){
 const pay=digits?+digits:null,ok=!!status&&!!pay&&pay>0;
 return <div className="tax-pick">
  <fieldset><legend>Filing status</legend>
   <div className="seg">{STATUSES.map(s=><button type="button" key={s.value} aria-pressed={status===s.value} onClick={()=>onStatus(s.value)}>{s.label}</button>)}</div></fieldset>
  <fieldset><label className="lab" htmlFor="tax-pay">Household pay, before tax</label>
   <div className="money"><span>$</span><input id="tax-pay" inputMode="numeric" autoComplete="off" placeholder="180,000" value={digits?(+digits).toLocaleString('en-US'):''}
    onChange={e=>onDigits(e.target.value.replace(/\D/g,'').slice(0,8))} onKeyDown={e=>{if(e.key==='Enter'&&ok)onEnter();}}/></div>
   <p className="hint">Both of you, before investments. W-2 box 1 is fine.</p></fieldset>
  <p className={`pick-res${ok?'':' wait'}`} aria-live="polite">{ok?`That puts you in the ${pct(ordRateAt(status!,Math.max(0,pay!-STD[status!])))} bracket before any investment income.`:'Pick both to see your rates.'}</p>
 </div>;
}

const NotAvailable=({label,children}:{label:string;children:string})=><Card data-label={label}><Takeaway>{`${label}: not available`}</Takeaway><StatusMessage kind="missing">{children}</StatusMessage></Card>;

// ---- Exhibits ----
function TaxThisYear({r,inv,investment}:{r:Rate;inv:Income;investment?:Investment}){
 const c=useMemo(()=>compute(r,inv),[r,inv]),[ref,w]=useWidth(),B=c.base,yr=yearOf(investment);
 const alt=c.sources.map(s=>`${s.name}: ${s.sub}, ${dollars(s.tax)} tax`).join('. ')+`. Total ${dollars(c.total)}.`;
 return <Card data-label="Tax this year">
  <Takeaway>{`Your ${yr?`${yr} `:''}investment tax so far is estimated at ${dollars(c.total)}`}</Takeaway>
  <div className="sk">
   <div className="sk-wide" ref={ref} role="img" aria-label={alt}><SankeyWide c={c} width={w}/></div>
   <div className="sk-narrow"><SankeyList c={c}/></div>
   <div className="sk-key sk-wide" aria-hidden="true"><span><i style={{background:'var(--tx-ord)'}}/><span>{`Ordinary rates (${words2(B.oS)})`}</span></span>
    <span><i style={{background:'var(--tx-lt)'}}/><span>{`Long-term rates (${words2(B.lS)})`}</span></span></div>
  </div></Card>;
}

function Room({r,inv}:{r:Rate;inv:Income}){
 const B=compute(r,inv).base,s=r.status,[a,b]=LTT[s],OT=B.ordTop,top=B.top;
 const nb=ORD[s].findIndex(([t])=>OT<t),[ordEdge,ordNow]=ORD[s][nb],ordNext=ORD[s][nb+1]?.[1];
 const ltNow=top<a?0:top<b?.15:.20,ltEdge=top<a?a:top<b?b:null,ltRoom=ltEdge?ltEdge-top:null;
 const head=ltRoom!=null?`You could take about ${dollars(ltRoom)} more in long-term gains at ${pct(ltNow)}`:'Every extra long-term gain is taxed at 20% at your income';
 const ordRoom=ordEdge-OT,max=Math.min(Math.max(OT+ordRoom,ltEdge??top)*1.06,Math.max(top*1.6,OT+ordRoom*1.06));
 const P=(x:number)=>`${Math.min(100,x/max*100).toFixed(2)}%`;
 const seg=(x0:number,x1:number,c:string,cls='')=>x1>x0?<i key={`${x0}-${c}`} className={cls} style={{left:P(x0),width:`calc(${P(x1)} - ${P(x0)})`,background:c}}/>:null;
 const mk=(x:number,txt:string,pos:string)=>x>max?null:<div className={`room-mk ${pos}`} style={{left:P(x)}}><span className={x/max>.6?'r':''}>{txt}</span></div>;
 const facts:[string,string][]=[];
 if(ordNext!=null)facts.push([`More short-term gains at ${pct(ordNow)}`,dollars(ordRoom)]);
 if(ltNow>0&&B.lS.some(x=>x[0]<ltNow))facts.push([`Gains a loss could bring down to ${pct(B.lS[0][0])}`,dollars(B.lS.filter(x=>x[0]===ltNow).reduce((t,x)=>t+x[1],0))]);
 facts.push(['Taxable income this year',dollars(top)]);
 return <Card data-label="Room in your tax brackets"><Takeaway>{head}</Takeaway>
  <div className="room" aria-hidden="true"><div className="room-bar">{seg(0,B.payT,'var(--line-2)')}{seg(B.ordBase,OT,'var(--tx-ord)')}{seg(OT,top,'var(--tx-lt)')}{ltEdge?seg(top,Math.min(ltEdge,max),'transparent','room-free'):null}</div>
   {ordNext!=null&&mk(ordEdge,`${pct(ordNext)} ordinary from ${dollars(ordEdge)}`,'up')}{ltEdge&&mk(ltEdge,`${pct(ltNow===0?.15:.20)} long-term from ${dollars(ltEdge)}`,'down')}</div>
  <div className="sk-key room-key" aria-hidden="true"><span><i style={{background:'var(--line-2)'}}/>Pay, after the standard deduction</span><span><i style={{background:'var(--tx-ord)'}}/>Short-term gains, dividends</span>
   <span><i style={{background:'var(--tx-lt)'}}/>Long-term gains, qualified dividends</span>{ltEdge&&<span><i className="room-free"/>Room at your current rate</span>}</div>
  <div className="ui-facts">{facts.map(([k,v])=><div key={k}><small>{k}</small><b>{v}</b></div>)}</div>
  <p className="ui-status room-warn" data-kind="estimated"><b>Loss limit.</b>{` The most losses can cut this year: your ${dollars(inv.shortTerm+inv.longTerm)} of gains plus ${dollars(LOSS_CAP)} of pay. The rest carries to later years.`}</p>
 </Card>;
}

function WhatIf({r,inv,lots,year}:{r:Rate;inv:Income;lots:LossLot[]|null;year:string}){
 const c=useMemo(()=>compute(r,inv),[r,inv]),TOTAL=c.total,[on,setOn]=useState<Set<string>>(new Set());
 if(lots==null)return <NotAvailable label="If you sold at a loss">Your exports do not list tax lots with purchase dates, so lot-by-lot losses are not available.</NotAvailable>;
 const cuts=lots.map(l=>lotCut(r,inv,TOTAL,l)),Y=TOTAL-scenario(r.status,r.pay,inv,sumLoss(lots,'st'),sumLoss(lots,'lt')).tax;
 const ticked=lots.filter(l=>on.has(l.lotId)),sc=scenario(r.status,r.pay,inv,sumLoss(ticked,'st'),sumLoss(ticked,'lt')),cut=TOTAL-sc.tax,after=sc.tax;
 const n=ticked.filter(l=>!l.wash).length,w=ticked.some(l=>l.wash),base=Math.max(TOTAL,1);
 const head=lots.length===0?'You have no holdings at a loss to sell':Y>=0.5?`Selling these could cut it by about ${dollars(Y)}`:'Selling these would not lower this year’s tax';
 const delta=cut>=0.5?`${dollars(cut)} less, from ${n} sale${n>1?'s':''}`+(sc.carry>0.5?`; ${dollars(sc.carry)} of loss carries to next year`:''):(w?'A wash sale changes nothing this year':'Nothing ticked yet');
 return <Card data-label="If you sold at a loss"><Takeaway>{head}</Takeaway>
  {lots.length>0&&<><p className="ui-caption">Tick a holding to see the new estimate.</p>
  <div className="wi"><div className="wi-list" role="group" aria-label="Holdings at a loss">
   <div className="wi-hd" aria-hidden="true"><span/><span>Holding</span><span>Loss</span><span>Tax saved</span></div>
   {lots.map((l,i)=><label className="ui-check-row" data-tone="portfolio" key={l.lotId}>
    <input type="checkbox" checked={on.has(l.lotId)} onChange={e=>setOn(s=>{const t=new Set(s);if(e.target.checked)t.add(l.lotId);else t.delete(l.lotId);return t;})}/>
    <span><span className="wi-nm">{l.symbol}</span><small>{l.detail}<span className="lossm">{` · loss ${dollars(l.loss)}`}</span></small></span>
    <span className="num loss">{`−${dollars(l.loss)}`}</span>
    {l.wash||Math.round(cuts[i])<1?<span className="num zero">$0 this year</span>:<span className="num save">{`saves ${dollars(cuts[i])}`}</span>}
    {l.wash&&<span className="ui-status wi-warn" data-kind="estimated"><b data-def="wash" tabIndex={0}>Wash sale.</b>{` ${l.wash}`}</span>}</label>)}
  </div>
  <div className="wi-sum" aria-live="polite" aria-atomic="true"><span className="ui-label">{`Estimated ${year?`${year} `:''}tax`}</span>
   <div className="wi-ba">{cut>=0.5?<><s><span className="ui-sr">was </span>{dollars(TOTAL)}</s><span aria-hidden="true">→</span><b><span className="ui-sr">now </span>{dollars(after)}</b></>:<b>{dollars(TOTAL)}</b>}</div>
   <div className="wi-bar" aria-hidden="true"><i style={{width:`${Math.max(0,after/base*100)}%`}}/><u style={{left:`${Math.max(0,after/base*100)}%`,width:`${Math.min(100,cut/base*100)}%`}}/></div>
   <div className="wi-delta">{delta}</div></div></div></>}
 </Card>;
}

type Row={symbol:string;value:number;gain:number};
function SellAll({r,inv,data}:{r:Rate;inv:Income|null;data:TaxData}){
 const by=new Map<string,Row>();const missing=new Set<string>();
 for(const a of data.gains.accounts)for(const h of a.holdings){
  if(h.basis==null||h.gain==null){missing.add(h.symbol);continue;}
  const x=by.get(h.symbol)??{symbol:h.symbol,value:0,gain:0};x.value+=h.value;x.gain+=h.gain;by.set(h.symbol,x);}
 const rows=[...by.values()].sort((a,b)=>b.value-a.value);
 if(!rows.length)return <Card data-label="Selling everything"><Takeaway>No gains or losses to show yet</Takeaway><StatusMessage kind="missing">No taxable account with cost basis in a positions file.</StatusMessage></Card>;
 const G=rows.reduce((a,x)=>a+x.gain,0),V=rows.reduce((a,x)=>a+x.value,0);
 const extra=inv?scenario(r.status,r.pay,inv,0,0,G).tax-compute(r,inv).total:null;
 const head=extra==null?`Your unrealized ${G>=0?'gains':'losses'} come to about ${dollars(Math.abs(G))}`:extra>=0.5?`Selling everything today would add about ${dollars(extra)} of tax`:'Selling everything today would add no federal tax';
 const cell=(g:number)=>extra==null||G===0?'—':dollars(extra*g/G);
 return <Card data-label="Selling everything"><Takeaway>{head}</Takeaway>
  {missing.size>0&&<p className="ui-caption">{`Left out: ${[...missing].join(', ')} (no cost basis).`}</p>}
  <div className="ui-table-scroll" role="region" aria-label="Unrealized gains" tabIndex={0}>
   <table className="ui-table gains"><thead><tr><th>Holding</th><th>Value</th><th>Gain or loss</th><th><Def k="ltcg">Long-term capital gains tax</Def></th></tr></thead>
    <tbody>{rows.map(x=><tr key={x.symbol}><th scope="row">{x.symbol}</th><td>{dollars(x.value)}</td><td data-direction={x.gain<0?'down':'up'}>{`${x.gain<0?'':'+'}${dollars(x.gain)}`}</td><td>{cell(x.gain)}</td></tr>)}</tbody>
    <tfoot><tr><th scope="row">Total</th><td>{dollars(V)}</td><td>{`${G<0?'':'+'}${dollars(G)}`}</td><td>{extra==null?'—':dollars(extra)}</td></tr></tfoot></table></div></Card>;
}

function Where({t}:{t:TaxData['whereTaxesApply']}){
 const groups=t.groups;const tax=groups.find(g=>g.key==='taxable');
 const color={taxable:'var(--tx-ord)',deferred:'var(--tx-lt)',free:'var(--tx-pale)'};
 if(!groups.some(g=>g.accounts.length))return <Card data-label="Where taxes apply"><Takeaway>No accounts yet</Takeaway></Card>;
 return <Card data-label="Where taxes apply"><Takeaway>{`${money(tax?.value??0)} of your investments is taxable`}</Takeaway>
  <p className="ui-caption">{`${percent(tax?.share??0)} of ${money(t.total)}.`}</p>
  <div className="split" aria-hidden="true">{groups.map(g=><i key={g.key} className={g.key==='free'?'sw-pale':''} style={{width:`${g.share*100}%`,background:color[g.key]}}/>)}</div>
  <ul className="split-rows">{groups.filter(g=>g.accounts.length).map(g=><li key={g.key}><i className={g.key==='free'?'sw-pale':''} style={{background:color[g.key]}}/>
   <span data-def={g.key} tabIndex={0}>{g.label}</span><b>{`${money(g.value)} · ${percent(g.share)}`}</b>
   <small>{g.accounts.map(a=>a.label+(a.nonMarket?' (non-market)':'')).join(', ')}</small></li>)}</ul></Card>;
}

function FinePrint({r,data}:{r:Rate|null;data:TaxData}){
 const i=data.investment,span=i?.from&&i.asof?`${formatDate(i.from,'day')} to ${formatDate(i.asof,'day')}`:'this year';
 const pos=data.gains.accounts.find(a=>a.asof)?.asof;
 return <Disclosure variant="card" title="Fine print"><ul>
  <li><b>Tax this year</b><ul>
   {r&&<li>{`Federal tax only. From your filing status and pay (${statusWords(r.status)}, about ${dollars(r.pay)}), less the 2026 standard deduction (${dollars(STD[r.status])}). This year's investment income is added on top: short-term gains and ordinary dividends at ordinary rates; long-term gains and qualified dividends at 0%, 15% or 20%, by the band they land in.`}</li>}
   <li>{`From this year's sales and payouts in your taxable accounts, ${span}.`}</li>
   {i?.status&&<li>{i.status}</li>}
   <li>Leaves out state tax, deductions and the 3.8% surtax. An estimate, not your tax bill.</li>
   <li>One rate per kind of income. If your income is near the top of a bracket, part of it may be taxed at the next rate. 2026 IRS brackets.</li>
   <li>In the chart, band width shows tax dollars, not income.</li></ul></li>
  <li><b>Room in your tax brackets</b><ul>
   <li>Assumes the standard deduction. If you itemize, or put pay into a pre-tax 401(k) beyond what W-2 box 1 leaves out, your taxable income is lower.</li>
   <li>Losses first cancel this year's gains. Up to $3,000 more ($1,500 if married filing separately) comes off other income; the rest carries forward with no time limit.</li>
   <li>A harvested loss lowers the cost basis of anything you buy back later, so it mostly delays tax rather than erasing it.</li></ul></li>
  <li><b>If you sold at a loss</b><ul>
   <li>Tax lots from your latest Positions export{pos?` (${formatDate(pos,'day')})`:''}, at the same rates as above.</li>
   <li>Short-term losses offset short-term gains first; long-term losses offset long-term gains.</li>
   <li>Assumes no matching fund is bought within 30 days before or after a sale, in any of your accounts (IRAs and reinvested dividends count).</li>
   <li>Taxable accounts only.</li></ul></li>
  <li><b>Selling everything</b><ul>
   <li>{`Cost basis from your latest Positions export${pos?`, ${formatDate(pos,'day')}`:''}. A holding with no basis is left out, never guessed.`}</li>
   <li>The tax column assumes every lot was held over a year, with the gains added on top of this year's income.</li>
   <li>Nothing is taxed until you sell.</li></ul></li>
  <li><b>Where taxes apply</b><ul><li>From the account type you set for each account.</li></ul></li>
 </ul></Disclosure>;
}

const PLACEHOLDER:Rate={status:'mfj',pay:180000};
function load():Rate|null{try{return parseRate(localStorage.getItem(RATE_KEY));}catch{return null;}}
function save(r:Rate){try{localStorage.setItem(RATE_KEY,JSON.stringify(r));}catch{/* private mode: the answer just isn't remembered */}}

export function Tax({data,initialRate}:{data?:TaxData;initialRate?:Rate|null}){
 const [rate,setRate]=useState<Rate|null>(initialRate??null);
 const [editing,setEditing]=useState(!initialRate);
 const [status,setStatus]=useState<Status|null>(initialRate?.status??null);
 const [digits,setDigits]=useState(initialRate?String(initialRate.pay):'');
 useEffect(()=>{if(initialRate!==undefined)return;const r=load();if(r){setRate(r);setStatus(r.status);setDigits(String(r.pay));setEditing(false);}},[initialRate]);
 const tip=useDefinitions(DEFS);
 if(!data)return <CardStack className="tax2"><PageHeader title="Tax"/><Card><StatusMessage kind="missing">The tax view is not available for this report. Refresh it in the UFO app.</StatusMessage></Card></CardStack>;
 const pay=digits?+digits:null,ok=!!status&&!!pay&&pay>0,confirmed=!!rate&&!editing,inv=incomeOf(data.investment);
 const confirm=()=>{if(!ok)return;const x={status:status!,pay:pay!};save(x);setRate(x);setEditing(false);};
 const why=data.investment?.status||'This year’s sales and dividends are not in your exports.';
 const exhibits=(r:Rate,fine:boolean)=><>
  {inv?<TaxThisYear r={r} inv={inv} investment={data.investment}/>:<NotAvailable label="Tax this year">{why}</NotAvailable>}
  {inv?<Room r={r} inv={inv}/>:<NotAvailable label="Room in your tax brackets">{why}</NotAvailable>}
  {inv?<WhatIf r={r} inv={inv} lots={data.investment?.lots??null} year={yearOf(data.investment)}/>:<NotAvailable label="If you sold at a loss">{why}</NotAvailable>}
  <div className="demoted"><SellAll r={r} inv={inv} data={data}/><Where t={data.whereTaxesApply}/></div>
  <FinePrint r={fine?r:null} data={data}/></>;
 // The bracket named in the summary is the one the last dollar of ordinary income lands in, investments included.
 const bracket=rate?pct(ordRateAt(rate.status,inv?compute(rate,inv).base.ordTop:Math.max(0,rate.pay-STD[rate.status]))):'';
 return <CardStack className="tax2"><PageHeader title="Tax"/>
  <ChoiceGate heading="Determine your tax rate" confirmed={confirmed} canConfirm={ok} confirmLabel="Show my tax" onConfirm={confirm}
   onChange={()=>{if(rate){setStatus(rate.status);setDigits(String(rate.pay));}setEditing(true);}}
   summary={rate?`${bracket} bracket · ${statusWords(rate.status)} · ${dollars(rate.pay)} pay`:''}
   picker={<RateFields status={status} digits={digits} onStatus={setStatus} onDigits={setDigits} onEnter={confirm}/>}
   placeholder={exhibits(PLACEHOLDER,false)}>
   {exhibits(rate??PLACEHOLDER,true)}
  </ChoiceGate>
  <p className="small tax-foot">{FOOTER}</p>{tip}
 </CardStack>;
}
