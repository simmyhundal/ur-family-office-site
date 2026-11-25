// Tax tab data and engine (issues 385, 386; decision 0017). Facts from the user's own exports, plus a federal estimate from the
// filing status and pay the user types in (stored only in this browser). Never guessed: a missing figure is reported as missing.
export type TaxAccount={id:string;label:string;value:number;nonMarket:boolean};
export type TaxGroup={key:'taxable'|'deferred'|'free';label:string;meaning:string;value:number;share:number;accounts:TaxAccount[]};
export type TaxHolding={symbol:string;name:string;value:number;basis:number|null;gain:number|null;gainPct:number|null;term:string};
/** One lot sold at a loss would realize. `term` is known only when the source says so. */
export type LossLot={lotId:string;symbol:string;detail:string;loss:number;term:'st'|'lt';wash?:string};
/** This year's realized investment income in taxable accounts. A null figure is not available (never guessed). */
export type Investment={asof:string|null;from:string|null;shortTerm:number|null;ordinaryDividends:number|null;longTerm:number|null;qualifiedDividends:number|null;lots:LossLot[]|null;status:string};
export type TaxData={
 whereTaxesApply:{total:number;groups:TaxGroup[]};
 gains:{accounts:{id:string;label:string;asof:string|null;holdings:TaxHolding[]}[];noPositions:string[];cashOmitted:number;term:string;
  total:{basis:number;value:number;gain:number;gainPct:number|null;excluded:{account:string;symbol:string;value:number}[];excludedValue:number}};
 investment?:Investment;
 disclaimer:string;
};
export const MISSING_BASIS='cost basis not in your export';
export const FOOTER='Estimates from your exports. Information, not tax advice. UFO never sells anything.';
/** "+$1,200" / "−$300" / "—" for a missing figure. Whole dollars. */
export function signedMoney(v:number|null|undefined){
 if(v==null||!Number.isFinite(v))return '—';
 const r=Math.round(Math.abs(v)),s=`$${r.toLocaleString('en-US')}`;
 return r===0?s:`${v>0?'+':'−'}${s}`;
}
export function signedPercent(v:number|null|undefined){
 if(v==null||!Number.isFinite(v))return '—';
 const p=+(Math.abs(v)*100).toFixed(1);
 return p===0?'0.0%':`${v>0?'+':'−'}${p.toFixed(1)}%`;
}
export function gainTone(v:number|null|undefined){return v==null||Math.round(v)===0?undefined:v>0?'up':'down';}
/** The plain sentence naming what the total leaves out. */
export function excludedNote(t:TaxData['gains']['total']){
 if(!t.excluded.length)return '';
 const names=[...new Set(t.excluded.map(e=>e.symbol))];
 return `Left out of the total: ${names.join(', ')} (${t.excluded.length===1?'1 holding':`${t.excluded.length} holdings`} with ${MISSING_BASIS}).`;
}
export const dollars=(n:number)=>`${n<0?'−':''}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;

// ---- 2026 federal tables (as used in the approved mock, v5) ----
export type Status='mfj'|'single'|'hoh';
export const STATUSES:readonly {value:Status;label:string;words:string}[]=[
 {value:'mfj',label:'Married filing jointly',words:'married filing jointly'},
 {value:'single',label:'Single',words:'single'},
 {value:'hoh',label:'Head of household',words:'head of household'}];
export const ORD:Record<Status,[number,number][]>={
 mfj:[[24800,.10],[100800,.12],[211400,.22],[403550,.24],[512450,.32],[768700,.35],[Infinity,.37]],
 single:[[12400,.10],[50400,.12],[105700,.22],[201775,.24],[256225,.32],[640600,.35],[Infinity,.37]],
 hoh:[[17700,.10],[67450,.12],[105700,.22],[201750,.24],[256200,.32],[640600,.35],[Infinity,.37]]};
/** Taxable income where long-term gains start paying 15%, then 20%. */
export const LTT:Record<Status,[number,number]>={mfj:[98900,613700],single:[49450,545500],hoh:[66200,579600]};
export const STD:Record<Status,number>={mfj:32200,single:16100,hoh:24150};
export const LOSS_CAP=3000;
export type Slice=[rate:number,amount:number];
export type Income={shortTerm:number;ordinaryDividends:number;longTerm:number;qualifiedDividends:number};

/** Ordinary income fills the brackets from $0: the slices of `amt` that sit on top of `base`. */
export function ordSlices(st:Status,base:number,amt:number):Slice[]{
 const out:Slice[]=[];let lo=0;
 for(const [t,r] of ORD[st]){const a=Math.max(base,lo),b=Math.min(base+amt,t);if(b-a>0.5)out.push([r,b-a]);lo=t;}
 return out;
}
/** Long-term gains and qualified dividends sit on top of ordinary income and are sliced by the 0/15/20% band they land in. */
export function ltSlices(st:Status,base:number,amt:number):Slice[]{
 const [a,b]=LTT[st],top=base+amt;
 return ([[0,Math.min(top,a)-base],[.15,Math.min(top,b)-Math.max(base,a)],[.20,top-Math.max(base,b)]] as Slice[]).filter(x=>x[1]>0.5);
}
export const taxOf=(sl:Slice[])=>sl.reduce((t,[r,x])=>t+r*x,0);
export type Scenario={payT:number;ordBase:number;ordAmt:number;oS:Slice[];pref:number;lS:Slice[];tax:number;loss:number;ded:number;carry:number;ordTop:number;top:number};
/** One tax-year estimate. stL/ltL: losses realized by sales; extraLT: extra long-term gains (selling everything).
 * Losses net short against long first; then at most $3,000 comes off other income and the rest carries forward.
 * The investment tax is the tax with investments minus the tax on pay alone. */
export function scenario(st:Status,pay:number,inv:Income,stL=0,ltL=0,extraLT=0):Scenario{
 const payT=Math.max(0,pay-STD[st]);
 let nST=inv.shortTerm-stL,nLT=inv.longTerm+extraLT-ltL,loss=0;
 if(nST<0&&nLT>0){nLT+=nST;nST=0;}else if(nLT<0&&nST>0){nST+=nLT;nLT=0;}
 if(nST<0){loss-=nST;nST=0;} if(nLT<0){loss-=nLT;nLT=0;}
 const ded=Math.min(loss,LOSS_CAP),carry=loss-ded;
 const ordInv=nST+inv.ordinaryDividends-ded,ordBase=Math.max(0,payT+Math.min(0,ordInv)),ordAmt=Math.max(0,ordInv);
 const oS=ordSlices(st,ordBase,ordAmt),pref=nLT+inv.qualifiedDividends,lS=ltSlices(st,ordBase+ordAmt,pref);
 const tax=taxOf(ordSlices(st,0,ordBase))-taxOf(ordSlices(st,0,payT))+taxOf(oS)+taxOf(lS);
 return {payT,ordBase,ordAmt,oS,pref,lS,tax,loss,ded,carry,ordTop:ordBase+ordAmt,top:ordBase+ordAmt+pref};
}
export const ordRateAt=(st:Status,x:number)=>ORD[st].find(([t])=>x<t)![1];
export const pct=(r:number)=>`${Math.round(r*100)}%`;
export const words2=(sl:Slice[])=>[...new Set(sl.map(x=>pct(x[0])))].join(' to ');

/** The four income kinds when all are available; null when any is missing. */
export function incomeOf(i?:Investment):Income|null{
 if(!i||i.shortTerm==null||i.ordinaryDividends==null||i.longTerm==null||i.qualifiedDividends==null)return null;
 return {shortTerm:i.shortTerm,ordinaryDividends:i.ordinaryDividends,longTerm:i.longTerm,qualifiedDividends:i.qualifiedDividends};
}

export type Rate={status:Status;pay:number};
export const RATE_KEY='ufo.plus.tax.rate';
export function parseRate(raw:string|null|undefined):Rate|null{
 if(!raw)return null;
 try{const r=JSON.parse(raw);if(STATUSES.some(s=>s.value===r?.status)&&Number.isFinite(r?.pay)&&r.pay>0)return {status:r.status,pay:Math.round(r.pay)};}catch{/* ignore */}
 return null;
}

export type SrcKey='st'|'od'|'lt'|'qd';
export type Kind='ord'|'lt';
export type Group={g:string;kind:Kind;rate:number;income:number;tax:number;label:string};
export type Flow={group:Group;income:number;tax:number};
export type Source={k:SrcKey;name:string;kind:Kind;income:number;tax:number;sub:string;flows:Flow[]};
const SRC:{k:SrcKey;name:string;kind:Kind}[]=[{k:'st',name:'Short-term gains',kind:'ord'},{k:'od',name:'Ordinary dividends',kind:'ord'},{k:'lt',name:'Long-term gains',kind:'lt'},{k:'qd',name:'Qualified dividends',kind:'lt'}];
export type Computed={base:Scenario;total:number;groups:Group[];sources:Source[]};
/** Splits the base scenario into tax-by-source-by-rate (the Sankey). Band width is tax dollars, so sources add up to the total. */
export function compute(r:Rate,inv:Income):Computed{
 const B=scenario(r.status,r.pay,inv),total=B.tax;
 const groups:Group[]=[...B.oS.map(([rate,x],n)=>({g:`o${n}`,kind:'ord' as Kind,rate,income:x,tax:0,label:`${pct(rate)} ordinary rate`})),
  ...B.lS.map(([rate,x],n)=>({g:`l${n}`,kind:'lt' as Kind,rate,income:x,tax:0,label:`${pct(rate)} long-term rate`}))];
 const amount={st:inv.shortTerm,od:inv.ordinaryDividends,lt:inv.longTerm,qd:inv.qualifiedDividends};
 const sources=SRC.map(s=>{
  const income=amount[s.k],pool=s.kind==='ord'?B.ordAmt:B.pref,flows:Flow[]=[];
  groups.filter(G=>G.kind===s.kind).forEach(G=>{const x=pool>0?G.income*income/pool:0,t=x*G.rate;flows.push({group:G,income:x,tax:t});G.tax+=t;});
  const tax=flows.reduce((a,f)=>a+f.tax,0);
  const sub=flows.length===1?`${dollars(income)} × ${pct(flows[0].group.rate)}`:flows.length?`${dollars(income)} at ${flows.map(f=>pct(f.group.rate)).join(' and ')}`:dollars(income);
  return {...s,income,flows,tax,sub};});
 return {base:B,total,groups,sources};
}
/** Tax saved by realizing each loss lot alone; a wash-sale lot saves nothing this year. */
export function lotCut(r:Rate,inv:Income,total:number,lot:LossLot){
 if(lot.wash)return 0;
 return total-(lot.term==='st'?scenario(r.status,r.pay,inv,lot.loss,0):scenario(r.status,r.pay,inv,0,lot.loss)).tax;
}
export const sumLoss=(lots:LossLot[],term:'st'|'lt')=>lots.filter(l=>!l.wash&&l.term===term).reduce((a,l)=>a+l.loss,0);
