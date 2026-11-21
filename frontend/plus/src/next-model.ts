// Next steps data contract and pure helpers. Fixed portfolios only (the holdout test is shelved for milestone M22).
// Everything here is read-only: draft trades are for review only.
import type {AdoptionTracking,PersonalReplay} from './research-types';
import type {DashboardData} from './types';

export type Facts={value:number;irr:number|null;sharpe:number|null;ret?:number|null;vol?:number|null;worst?:number|null};
export type Move=PersonalReplay&{household?:{as_is:Facts;moved:Facts;as_of:string}|null;household_note?:string;grid?:number[]};
export type Account={id:string;label:string;wrapper?:string;market?:boolean;value?:number;irr?:number|null;holdings?:{symbol:string;weight:number}[]};
export type Row={ret:number|null;vol:number|null;sharpe:number|null;worst:number|null};
/** The portfolio and your current priced funds over the same months (history, not a forecast). */
export type SameDates={error?:string;from?:string;to?:string;months?:number;standins?:{fund:string;standin:string;before:string}[];
 portfolio?:Row;current?:Row|null;current_funds?:string[];current_left_out?:string[]};
export type Mix={key:string;name:string;group?:string;weights:Record<string,number>;desc:string;error?:string;
 history?:{from:string;to:string;ann:number|null;vol:number|null;worst_fall:number|null};compare?:SameDates};
export type Today={total:number;funds:{symbol:string;name?:string;weight:number;value:number;cash?:boolean}[];lines:{label:string;value:number;weight:number}[]};
/** The household's month-ends, with what the page needs to recompute the total for any set of swapped accounts. */
export type Grid={months:string[];values:number[];net:number[];weighted:number[];rf:number[];window:number;members:string[];actual:Record<string,number[]>};
export type NextPayload={adoptionTracking?:AdoptionTracking;error?:string;asof?:string;estimated?:boolean;
 accounts?:Account[];mixes?:Mix[];moves?:Record<string,Move>;today?:Today;grid?:Grid;assumptions?:string[];disclaimer?:string;history_note?:string};
export type NextData=DashboardData&{nextSteps?:NextPayload;demo?:string};

/** Public facts about common funds, so a weight reads as more than a ticker. */
export const FUND_NAMES:Record<string,string>={SPY:'US stocks · SPY',VT:'World stocks · VT',VTI:'US total stock market · VTI',AGG:'US bonds · AGG',
 EFA:'Developed markets outside the US · EFA',IWM:'US small companies · IWM',GLD:'Gold · GLD',CASH:'Cash (3-month T-bills)',BND:'US bonds · BND',QQQ:'Nasdaq-100 · QQQ'};

/** The portfolios in the left-hand selector, in the payload's fixed order (never sorted by result). */
export function portfolios(n:NextPayload|undefined):Mix[]{return (n?.mixes??[]).filter(m=>!m.error);}
/** The name shown everywhere: the ladder step plus its stock fund, e.g. "Balanced 60/40 · VT", so VT and SPY versions never read alike. */
export const title=(m:Mix)=>{const t=m.group?.match(/\(([^)]+)\)/)?.[1];return t?`${m.name} · ${t}`:m.name;};
/** The default is a fixed position (Balanced 60/40 with world stocks), never the best-looking row. */
export const defaultPortfolio=(list:Mix[])=>(list.find(m=>m.key==='fixed:VT-60')??list[0])?.key??'';

export type Trade={symbol:string;amount:number};
/** Read-only draft: the dollar change per fund to move one account from its holdings to the target weights. Sells first.
 * Returns null when the account has no holdings list (a fixed annuity), so nothing is invented. */
export function draftTrades(account:Account,target:Record<string,number>):Trade[]|null{
 const value=account.value??0;if(account.market===false||!account.holdings?.length||!(value>0))return null;
 const now:Record<string,number>={};for(const h of account.holdings)now[h.symbol]=(now[h.symbol]??0)+h.weight;
 const out=[...new Set([...Object.keys(now),...Object.keys(target)])].map(symbol=>({symbol,amount:Math.round(value*((target[symbol]??0)-(now[symbol]??0)))})).filter(t=>Math.abs(t.amount)>=1);
 return out.sort((a,b)=>a.amount-b.amount);
}

const mean=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/xs.length;
/** Trailing Sharpe ratio at each month-end from modified Dietz monthly returns. Mirrors next_steps.rolling_sharpe in Python. */
export function rollingSharpe(values:number[],net:number[],weighted:number[],rf:number[],window=36):(number|null)[]{
 const rets=values.map((v,i)=>{const prev=i?values[i-1]:0,denom=prev+weighted[i];return denom>1e-9?(v-prev-net[i])/denom:null;});
 return values.map((_,i)=>{
  if(i+1<window)return null;const win=rets.slice(i-window+1,i+1);if(win.some(r=>r==null))return null;
  const ex=win.map((r,j)=>(r as number)-rf[i-window+1+j]),m=mean(ex),sd=Math.sqrt(ex.reduce((a,x)=>a+(x-m)**2,0)/(ex.length-1));
  return sd>1e-12?m/sd*Math.sqrt(12):null;
 });
}
/** The household total with the chosen accounts' month-end values replaced by their replay in one portfolio.
 * Accounts outside the total (or without a replay) are listed in `skipped` and left as they were. */
export function swappedHousehold(grid:Grid,moves:Record<string,Move>,key:string,chosen:string[]){
 const values=[...grid.values],used:string[]=[],skipped:string[]=[];
 for(const id of chosen){const now=grid.actual[id],moved=moves[`${id}|${key}`]?.grid;
  if(!now||!moved||moved.length!==values.length){skipped.push(id);continue;}
  used.push(id);for(let i=0;i<values.length;i++)values[i]+=moved[i]-now[i];}
 return {values,used,skipped};
}
