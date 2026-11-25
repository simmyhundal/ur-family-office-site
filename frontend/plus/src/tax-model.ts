// Tax tab data (issues 385, 386; decision 0016). Facts from the user's own exports only: no tax amounts or rates.
export type TaxAccount={id:string;label:string;value:number;nonMarket:boolean};
export type TaxGroup={key:'taxable'|'deferred'|'free';label:string;meaning:string;value:number;share:number;accounts:TaxAccount[]};
export type TaxHolding={symbol:string;name:string;value:number;basis:number|null;gain:number|null;gainPct:number|null;term:string};
export type TaxData={
 whereTaxesApply:{total:number;groups:TaxGroup[]};
 gains:{accounts:{id:string;label:string;asof:string|null;holdings:TaxHolding[]}[];noPositions:string[];cashOmitted:number;term:string;
  total:{basis:number;value:number;gain:number;gainPct:number|null;excluded:{account:string;symbol:string;value:number}[];excludedValue:number}};
 disclaimer:string;
};
export const MISSING_BASIS='cost basis not in your export';
export const FOOTER='Estimates from your exports. Information, not tax advice.';
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
export function takeaway(t:TaxData['gains']['total'],hasHoldings:boolean){
 if(!hasHoldings)return null;
 if(!(t.basis>0))return 'No cost basis in your exports yet, so no total gain or loss';
 const amount=signedMoney(t.gain).slice(1);
 return t.gain>=0?`You are sitting on about ${amount} of unrealized gains in taxable accounts`:`You are sitting on about ${amount} of unrealized losses in taxable accounts`;
}
