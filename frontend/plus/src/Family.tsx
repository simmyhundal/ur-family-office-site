// Family: the family tab (docs/mocks/mothership-v2.html). Parents' and children's assets together, with the people toggles.
// Shown only when the page data carries a `family` block. Invented figures in the demo. Information, not investment advice.
import {useMemo,useState,type ReactNode} from 'react';
import {Card,CardStack,PageHeader,Takeaway,Disclosure} from './ui/components';
import {useDefinitions} from './ui/definitions';
import {useWidth} from './tax-sankey';
import {TYPES,amounts,advisorPaths,bizIrr,homeCash,homeEq,pct,people,sum,usd,usdK,usdM,type Amounts,type FamilyData,type Selection} from './family-model';

const DEFS:Record<string,[string,string]>={
 irr:['Return per year (IRR)','The yearly growth rate that turns the dated money in and out into today’s value. Comparable across accounts.'],
 vti:['VTI','A fund that holds the whole US stock market.'],
 mix:['60/40','60% in a total US stock fund (VTI) and 40% in a total US bond fund (BND).'],
 sweat:['Pay given up','The pay Mom & Dad could earn elsewhere minus the salary they took. It counts as money put in.'],
 equity:['Equity','What a home is worth minus the mortgage still owed on it.'],
 fee:['Advisor fee','A yearly charge on what the advisor manages. Taken from the account, so it also stops growing.']};
const Def=({k,children}:{k:string;children:string})=><span data-def={k} tabIndex={0}>{children}</span>;
const PERSON_TYPE=(c:string,first:boolean)=>first?c:`color-mix(in srgb,${c} 45%,var(--surface))`;

function band(x0:number,a0:number,b0:number,x1:number,a1:number,b1:number,c:string,key:string){
 const m=(x0+x1)/2;return <path key={key} className="band" style={{fill:c}} d={`M${x0},${a0}C${m},${a0} ${m},${a1} ${x1},${a1}L${x1},${b1}C${m},${b1} ${m},${b0} ${x0},${b0}Z`}/>;
}

function Sankey({ps,A,tot,width}:{ps:{id:string;name:string}[];A:Record<string,Amounts>;tot:number;width:number}){
 const T=TYPES.map(t=>({...t,v:ps.reduce((s,p)=>s+A[p.id][t.k],0)})).filter(t=>t.v>0);
 const W=Math.max(600,width),NW=12,top=30,k=280/tot,SLOT=36,GAP=12,PGAP=28,hh=(v:number)=>Math.max(2,v*k);
 const xL=Math.min(150,W*.18),xM=Math.round(W*.5),xR=W-Math.min(170,W*.2);
 let y=top;const L:Record<string,{y:number;h:number;v:number}>={};
 ps.forEach(p=>{const v=sum(A[p.id]),h=hh(v),slot=Math.max(h,44);L[p.id]={y:y+(slot-h)/2,h,v};y+=slot+PGAP;});
 let H=y-PGAP+12;const blk=T.reduce((s,t)=>s+Math.max(hh(t.v),SLOT),0)+GAP*(T.length-1);
 let my=Math.max(top,(top+H)/2-blk/2);const M:Record<string,{y:number;h:number}>={};
 T.forEach(t=>{const h=hh(t.v),slot=Math.max(h,SLOT);M[t.k]={y:my+(slot-h)/2,h};my+=slot+GAP;});H=Math.max(H,my+12);
 const RH=tot*k,RY=Math.max(top,(top+H)/2-RH/2);
 const out:Record<string,number>={},inn:Record<string,number>={};ps.forEach(p=>{out[p.id]=L[p.id].y;});T.forEach(t=>{inn[t.k]=M[t.k].y;});
 const bands:ReactNode[]=[];
 T.forEach(t=>ps.forEach(p=>{const v=A[p.id][t.k];if(v<=0)return;const d=v*k;bands.push(band(xL+NW,out[p.id],out[p.id]+d,xM,inn[t.k],inn[t.k]+d,t.c,`${p.id}-${t.k}`));out[p.id]+=d;inn[t.k]+=d;}));
 let ro=RY;T.forEach(t=>{const d=t.v*k;bands.push(band(xM+NW,M[t.k].y,M[t.k].y+d,xR,ro,ro+d,t.c,`out-${t.k}`));ro+=d;});
 return <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">{bands}
  <text x={xL+NW} y={14} textAnchor="end" className="sk-col">Who</text><text x={xM+NW/2} y={14} textAnchor="middle" className="sk-col">Held in</text><text x={xR} y={14} className="sk-col">Total</text>
  {ps.map(p=>{const a=L[p.id],cy=a.y+a.h/2;return <g key={p.id}><rect x={xL} y={a.y} width={NW} height={a.h} className="per"/><text x={xL-8} y={cy-3} textAnchor="end" className="sk-name">{p.name}</text><text x={xL-8} y={cy+13} textAnchor="end" className="sk-amt">{usdK(a.v)}</text></g>;})}
  {T.map(t=>{const m=M[t.k];return <g key={t.k}><rect x={xM} y={m.y} width={NW} height={m.h} style={{fill:t.c}}/><text x={xM+NW+8} y={m.y+m.h/2-3} className="sk-name">{t.name}</text><text x={xM+NW+8} y={m.y+m.h/2+13} className="sk-amt">{usdK(t.v)}</text></g>;})}
  <rect x={xR} y={RY} width={NW} height={Math.max(2,RH)} className="tot"/><text x={xR+NW+10} y={RY+RH/2+8} className="sk-big">{usdK(tot)}</text></svg>;
}

function SankeyList({ps,A,tot}:{ps:{id:string;name:string}[];A:Record<string,Amounts>;tot:number}){
 const T=TYPES.map(t=>({...t,v:ps.reduce((s,p)=>s+A[p.id][t.k],0)})).filter(t=>t.v>0);
 return <>{ps.length>1&&<div className="sk-key">{ps.map((p,i)=><span key={p.id}><i style={{background:PERSON_TYPE('var(--ink-3)',i===0)}}/>{p.name}</span>)}</div>}
  {T.map(t=><div className="skn-row" key={t.k}><span><i className="sw2" style={{background:t.c}}/>{t.name}</span>
   <small>{ps.filter(p=>A[p.id][t.k]>0).map(p=>`${p.name} ${usdK(A[p.id][t.k])}`).join(' · ')}</small><b>{usdK(t.v)}</b>
   <span className="bar" style={{display:'flex'}}>{ps.map((p,i)=><i key={p.id} style={{width:`${(A[p.id][t.k]/tot*100).toFixed(1)}%`,background:PERSON_TYPE(t.c,i===0)}}/>)}</span></div>)}
  <div className="skn-total"><span>Total</span><span>{usd(tot)}</span></div></>;
}

function Bars({rows}:{rows:{name:string;v:number;c:string;dim?:boolean;w:number}[]}){
 return <div className="br">{rows.map(r=><div key={r.name} className={`br-row${r.dim?' dim':''}`}><span>{r.name}</span><b>{pct(r.v)}</b><span className="bar"><i style={{width:`${(r.w*100).toFixed(1)}%`,background:r.c}}/></span></div>)}</div>;
}

function AdvisorChart({d}:{d:FamilyData}){
 const a=d.advisor,{start,pa,pm}=advisorPaths(a),n=pa.length,A=pa[n-1],M=pm[n-1];
 const W=640,H=220,L=8,R=86,Tp=14,Bm=26,lo=Math.min(...pa,...pm)*.92,hi=Math.max(...pa,...pm)*1.04;
 const x=(i:number)=>L+(W-L-R)*i/(n-1),y=(v:number)=>Tp+(H-Tp-Bm)*(1-(v-lo)/(hi-lo)),path=(arr:number[])=>arr.map((v,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(v).toFixed(1)).join(' ');
 const area=path(pm)+' '+pa.map((_,i)=>'L'+x(n-1-i).toFixed(1)+' '+y(pa[n-1-i]).toFixed(1)).join(' ')+'Z';
 const ticks:number[]=[];for(let t=Math.ceil(lo/200000)*200000;t<hi;t+=200000)ticks.push(t);
 const first=a.years[0],last=a.years[a.years.length-1]+1;
 return <><div className="lc" role="img" aria-labelledby="ms-ad-alt"><svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
  {ticks.map(t=><g key={t}><line className="g" x1={L} x2={W-R} y1={y(t)} y2={y(t)}/><text x={L} y={y(t)-4}>{usdK(t)}</text></g>)}
  <path className="gap" d={area}/><path className="l-mix" d={path(pm)}/><path className="l-adv" d={path(pa)}/>
  <text x={x(0)} y={H-6}>{first}</text><text x={x(n-1)} y={H-6} textAnchor="end">{last}</text>
  <text className="lab-end" x={W-R+8} y={y(M)+4} style={{fill:'var(--a-pub)'}}>{usdK(M)}</text><text className="lab-end" x={W-R+8} y={y(A)+4} style={{fill:'var(--down)'}}>{usdK(A)}</text></svg></div>
  <p className="ui-sr" id="ms-ad-alt">{`From ${usd(start)} in ${first}: advisor account ${usd(A)}, 60/40 mix ${usd(M)} by ${last}.`}</p>
  <div className="lc-key" aria-hidden="true"><span><i style={{background:'var(--down)'}}/>Advisor account, after fee</span><span><i style={{background:'var(--a-pub)'}}/>Same start in a 60/40 mix</span></div></>;
}

export function Family({data}:{data?:FamilyData}){
 const [sel,setSel]=useState<Selection>({on:Object.fromEntries((data?.people??[]).map(p=>[p.id,true])),cash:true,cry:true});
 const tip=useDefinitions(DEFS);
 const [ref,w]=useWidth();
 const ps=useMemo(()=>data?people(data,sel):[],[data,sel]);
 if(!data||!ps.length)return <CardStack className="ms"><PageHeader title="Family"/><Card><p className="ui-status" data-kind="missing">Family is not available for this report.</p></Card></CardStack>;
 const toggle=(id:string)=>setSel(s=>{const on={...s.on,[id]:!s.on[id]};return Object.values(on).some(Boolean)?{...s,on}:s;});
 const A:Record<string,Amounts>={};ps.forEach(p=>{A[p.id]=amounts(data,sel,p.id);});
 const T=TYPES.map(t=>({...t,v:ps.reduce((s,p)=>s+A[p.id][t.k],0)})).filter(t=>t.v>0),tot=T.reduce((s,t)=>s+t.v,0),big=T.slice().sort((a,b)=>b.v-a.v)[0];
 const two=ps.length===2,onlyYou=ps.length===1&&ps[0].id==='you';
 const nAcc=ps.reduce((s,p)=>s+p.accts,0),homes=data.homes.filter(h=>sel.on[h.p]),biz=sel.on[data.biz.p],adv=sel.on[data.advisor.p];
 const key=two?'both':ps[0].id,perf=data.perf[key],mx=Math.max(perf.fam,perf.vti,perf.mix);
 const whoP=two?'family':onlyYou?'your':'Mom & Dad’s',whoN=two?'Your family':onlyYou?'You':'Mom & Dad';
 const rs=bizIrr(data.biz,data.now,true),rc=bizIrr(data.biz,data.now,false);
 const hc=homes.map(h=>homeCash(h,data.now)),eq=homes.reduce((s,h)=>s+homeEq(h),0),cashIn=hc.reduce((s,x)=>s+x.cash,0);
 const {fees,start}=advisorPaths(data.advisor);void start;
 const years=data.advisor.years.length;
 const toggles=(cls:string)=>data.people.map(p=><button type="button" key={p.id} className={cls} aria-pressed={!!sel.on[p.id]} onClick={()=>toggle(p.id)}><i aria-hidden="true"/>{p.name}</button>);
 return <><div className="ppl" role="group" aria-label="Whose money to show"><span>Showing</span>{toggles('pt')}</div>
 <CardStack className="ms"><PageHeader title="Family"/>
  <Card data-label="Who’s included"><Takeaway>{`${nAcc} accounts${biz?',':' and'} ${homes.length} ${homes.length>1?'homes':'home'}${biz?' and a business':''} in ${two?'2 households':'1 household'}`}</Takeaway>
   <div className="who">{data.people.map(p=><button type="button" key={p.id} aria-pressed={!!sel.on[p.id]} onClick={()=>toggle(p.id)}><i aria-hidden="true"/><b>{p.name}</b>
    <small>{`${p.sub} · ${p.accts} accounts · ${usdK(sum(amounts(data,sel,p.id)))}`}</small></button>)}</div></Card>
  <Card data-label="Where the family’s money is"><Takeaway>{`${usdM(tot)} in ${two?'family':onlyYou?'your':'Mom & Dad’s'} assets; ${Math.round(big.v/tot*100)}% is ${big.name.toLowerCase()}`}</Takeaway>
   <div className="sk"><div className="sk-wide" ref={ref} role="img" aria-label={ps.map(p=>`${p.name} ${usd(sum(A[p.id]))}`).join('; ')+'. '+T.map(t=>`${t.name} ${usd(t.v)}`).join('; ')+'.'}><Sankey ps={ps} A={A} tot={tot} width={w}/></div>
    <div className="sk-narrow"><SankeyList ps={ps} A={A} tot={tot}/></div></div>
   <div className="chips"><label><input type="checkbox" checked={sel.cash} onChange={e=>setSel(s=>({...s,cash:e.target.checked}))}/>Bank cash</label><label><input type="checkbox" checked={sel.cry} onChange={e=>setSel(s=>({...s,cry:e.target.checked}))}/>Crypto</label></div></Card>
  <Card data-label="How the family did"><Takeaway>{`${pct(perf.fam)} a year on ${whoP} investments, vs ${pct(perf.vti)} for `}<Def k="vti">VTI</Def></Takeaway>
   <p className="ui-caption">Same deposits and withdrawals put into each benchmark.</p>
   <Bars rows={[{name:whoN,v:perf.fam,c:'var(--a-pub)',w:perf.fam/mx},{name:'VTI, same money',v:perf.vti,c:'var(--ink-3)',dim:true,w:perf.vti/mx},{name:'60/40, same money',v:perf.mix,c:'var(--ink-3)',dim:true,w:perf.mix/mx}]}/></Card>
  {biz&&<Card data-label="Mom & Dad’s studio"><Takeaway>{`${usd(data.biz.value)} studio (Mom & Dad’s estimate) returned ${Math.round(rs*100)}% a year, counting `}<Def k="sweat">pay given up</Def></Takeaway>
   <Bars rows={[{name:'Counting pay given up',v:rs,c:'var(--a-biz)',w:rs/rc},{name:'Cash only',v:rc,c:'color-mix(in srgb,var(--a-biz) 35%,var(--surface))',dim:true,w:1}]}/></Card>}
  <Card data-label="Real estate"><Takeaway>{`${usdM(eq)} `}<Def k="equity">equity</Def>{` in ${homes.length===2?'two homes':'one home'}, from ${usdM(cashIn)} cash put in`}</Takeaway>
   <div className="ui-table-scroll" role="region" aria-label="Homes" tabIndex={0}><table className="ui-table"><thead><tr><th>Home</th><th>Cash put in</th><th>Equity</th><th><Def k="irr">Per year</Def></th></tr></thead>
    <tbody>{homes.map((h,i)=><tr key={h.name}><td>{h.name}<small>{`Bought ${Math.floor(h.yr)}`}</small></td><td>{usdK(hc[i].cash)}</td><td>{usdK(homeEq(h))}</td><td className={hc[i].r>=0?'fact-up':'fact-down'}>{pct(hc[i].r)}</td></tr>)}</tbody></table></div></Card>
  {adv&&<Card data-label="What the advisor costs"><Takeaway>{`${usd(fees)} in `}<Def k="fee">advisor fees</Def>{` over ${years} years on Mom & Dad’s account`}</Takeaway>
   <p className="ui-caption">A what-if on past years. Not advice.</p><AdvisorChart d={data}/></Card>}
  <Disclosure variant="card" title="Fine print"><ul>
   <li><b>This page.</b> One invented family: you and your partner, and your parents. No real people, accounts or prices. Information, not investment advice.</li>
   <li><b>Your household.</b> “You” is the same invented household as the other tabs: its balance and return since inception are read from them. Mom & Dad’s figures are invented for this demo. The family’s combined return is the two weighted by balance, an approximation.</li>
   <li><b>Who’s included.</b> Each person’s accounts come from their own exports, added with their consent. Turning someone off removes them from every figure.</li>
   <li><b>Where the family’s money is.</b><ul>
    <li>Public markets: brokerage, IRA and 401(k) accounts, as in Plus.</li><li>The business is the owners’ estimate, never an appraisal by UFO.</li>
    <li>Real estate counts equity: value minus the mortgage left. Other debts are not modeled here.</li>
    <li>Bank cash and crypto come from CSV exports; crypto is priced daily from public prices. Hiding them changes the totals on this page only.</li></ul></li>
   <li><b>How the family did.</b> Money-weighted return (IRR) of the public-market accounts, from dated deposits and withdrawals. Each benchmark gets the same money on the same dates. 60/40 = 60% VTI, 40% BND, rebalanced yearly. The business and homes have their own steps.</li>
   <li><b>The studio.</b><ul><li>Value: the owners’ estimate, picked by method (here revenue × 2; last round price and book value are the other choices).</li>
    <li>Pay given up = outside pay minus the salary taken, each year since the studio started. It counts as money put in.</li>
    <li>Cash only counts just the money put in at the start, so it looks far better than it was.</li></ul></li>
   <li><b>Real estate.</b> Value = purchase price moved forward with a public house-price index for the area (for example FHFA); the index here is invented, and the owner can type their own value. Return is on cash put in: down payment, mortgage payments (interest included) and property tax. Rent saved, insurance and repairs are left out.</li>
   <li><b>What the advisor costs.</b> Same start ten years ago in both lines, no deposits or withdrawals. Fee of 1% a year taken on the starting balance each year. 60/40 at 0.04% a year in fund costs. Yearly returns are invented. The gap mixes fees and the advisor’s picks; past years don’t predict future ones.</li>
  </ul></Disclosure>
  <p className="small tax-foot">Invented family and figures. Information, not investment or tax advice. UFO is read-only and never moves money.</p>{tip}
 </CardStack></>;
}
