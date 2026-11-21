// Next steps data contract and pure helpers (issue 273). Everything here is read-only: draft trades are for review only.
import type {ResearchProposal,AdoptionTracking,PersonalReplay} from './research-types';
import type {DashboardData} from './types';

export type HoldoutRow={name:string;kind:'fitted'|'fixed'|'reference'|string;desc:string;windows:number;n_eff:number;median:number;p10:number;p90:number;vol:number|null;sharpe:number|null;worst:number;beat:number|null;edge:number|null;se:number|null;verdict:'ahead'|'behind'|'noise'|null};
export type VerdictStatus='none'|'ahead'|'behind'|'too_few';
export type Holdout={error?:string;rows?:HoldoutRow[];path?:Record<string,number[]>;path_dates?:string[];train?:number;hold?:number;windows?:number;n_eff?:number;from?:string;to?:string;first_start?:string;last_start?:string;note?:string;base?:string;
 universe?:{name:string;declared:string;rationale:string;funds:string[];max_weight:number};
 verdict?:{status?:VerdictStatus;headline:string;details:string[];z?:number;n_eff?:number};
 today?:{error?:string;from?:string;to?:string;funds?:string[];weights?:Record<string,Record<string,number>>;mixes?:Record<string,string>}};
export type Facts={value:number;irr:number|null;sharpe:number|null;ret?:number|null;vol?:number|null;worst?:number|null};
export type Move=PersonalReplay&{household?:{as_is:Facts;moved:Facts;as_of:string}|null;household_note?:string};
export type Account={id:string;label:string;wrapper?:string;market?:boolean;value?:number;irr?:number|null;holdings?:{symbol:string;weight:number}[]};
export type Mix={key:string;name:string;weights:Record<string,number>;desc:string;error?:string;holdout_rule?:string};
export type Today={total:number;funds:{symbol:string;name?:string;weight:number;value:number;cash?:boolean}[];lines:{label:string;value:number;weight:number}[]};
export type NextPayload={holdout?:Holdout;proposals?:ResearchProposal[];adoptionTracking?:AdoptionTracking;error?:string;asof?:string;estimated?:boolean;
 accounts?:Account[];mixes?:Mix[];moves?:Record<string,Move>;today?:Today;assumptions?:string[];disclaimer?:string;history_note?:string};
export type NextData=DashboardData&{nextSteps?:NextPayload;demo?:string};

export const BASE='60/40 (VTI/AGG)';
export const CURRENT='Your mix, held fixed';
/** Public facts about the declared funds, so a weight reads as more than a ticker. */
export const FUND_NAMES:Record<string,string>={SPY:'US large companies · SPY',VTI:'US total stock market · VTI',DIA:'Dow 30 companies · DIA',AGG:'US bonds · AGG',IEF:'US Treasuries 7–10 yr · IEF',
 EFA:'Developed markets outside the US · EFA',IWM:'US small companies · IWM',GLD:'Gold · GLD',CASH:'Cash (3-month T-bills)',BND:'US bonds · BND',QQQ:'Nasdaq-100 · QQQ'};
export const PLAIN:Record<string,string>={'Max Sharpe':'Best past return per unit of risk','Minimum variance':'Lowest past volatility','Equal risk contribution':'Equal share of risk per fund',
 [BASE]:'60% US stocks, 40% US bonds','Equal weight':'Equal parts of every fund','VTI':'100% US stocks'};

export type Rule={name:string;label:string;group:string;row?:HoldoutRow;weights?:Record<string,number>;mixKey?:string;desc:string};
/** The choices in the left-hand selector, in a fixed order (never sorted by result). Holdout rules come first; with no holdout,
 * the fixed mixes the payload already replays are offered without evidence. */
export function rules(n:NextPayload|undefined):Rule[]{
 const h=n?.holdout,mixes=(n?.mixes??[]).filter(m=>!m.error);
 if(h?.rows?.length)return h.rows.filter(r=>r.kind!=='reference').map(r=>({name:r.name,label:r.name===BASE?'60/40':r.name,
  group:r.kind==='fitted'?'Fitted on the 10 years before each start':'Fixed, never fitted',row:r,weights:h.today?.weights?.[r.name],mixKey:h.today?.mixes?.[r.name],desc:r.desc}));
 return mixes.filter(m=>!m.key.startsWith('proposal:')).map(m=>({name:m.key,label:m.name,group:'Fixed mixes',weights:m.weights,mixKey:m.key,desc:m.desc}));
}
/** Default to the first fitted rule: a fixed position, never the best-looking row. */
export const defaultRule=(list:Rule[])=>list[0]?.name??'';

export type Trade={symbol:string;amount:number};
/** Read-only draft: the dollar change per fund to move one account from its holdings to the target weights. Sells first.
 * Returns null when the account has no holdings list (a fixed annuity), so nothing is invented. */
export function draftTrades(account:Account,target:Record<string,number>):Trade[]|null{
 const value=account.value??0;if(account.market===false||!account.holdings?.length||!(value>0))return null;
 const now:Record<string,number>={};for(const h of account.holdings)now[h.symbol]=(now[h.symbol]??0)+h.weight;
 const out=[...new Set([...Object.keys(now),...Object.keys(target)])].map(symbol=>({symbol,amount:Math.round(value*((target[symbol]??0)-(now[symbol]??0)))})).filter(t=>Math.abs(t.amount)>=1);
 return out.sort((a,b)=>a.amount-b.amount);
}
export function verdictTitle(status:VerdictStatus|undefined){
 return status==='ahead'?'Ahead of 60/40 in this history':status==='too_few'?'Too few years to judge':'No demonstrated improvement';
}
/** Plain words for one rule's own result against 60/40, from the computed edge and its standard error. */
export function edgeText(r:HoldoutRow|undefined){
 if(!r||r.edge==null||r.se==null)return '';
 const pts=(v:number)=>`${v>=0?'+':'−'}${Math.abs(v*100).toFixed(1)} pts`;
 const word=r.verdict==='ahead'?'ahead of':r.verdict==='behind'?'behind':'not distinguishable from';
 return `${word} 60/40: ${pts(r.edge)} a year, give or take ${(r.se*100).toFixed(1)}`;
}
