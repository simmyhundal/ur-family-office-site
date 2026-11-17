export type Numeric=number|null|undefined;
const valid=(v:Numeric):v is number=>typeof v==='number'&&Number.isFinite(v);
export const money=(v:Numeric)=>valid(v)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Math.round(v)||0):'—';
export const percent=(v:Numeric,signed=false)=>valid(v)?`${signed&&+(v*100).toFixed(1)>0?'+':''}${(+(v*100).toFixed(1)||0).toFixed(1)}%`:'—';
export const decimal=(v:Numeric)=>valid(v)?(+(v.toFixed(1))||0).toFixed(1):'—';
export const duration=(months:Numeric)=>valid(months)?`${(months/12).toFixed(1)} years`:'—';
export function formatDate(day:string|null|undefined,precision:'month'|'day'='month'){
 if(!day)return '—';const monthly=/^\d{4}-\d{2}$/.test(day);const date=new Date((monthly?day+'-01':day)+'T00:00:00Z');
 if(!Number.isFinite(date.getTime()))return '—';
 return new Intl.DateTimeFormat('en-US',{month:'short',year:'numeric',...(!monthly&&precision==='day'?{day:'numeric'} as const:{}),timeZone:'UTC'}).format(date);
}
export function moneyTick(v:number){const a=Math.abs(v);return `${v<0?'−':''}$${a>=1e6?`${+(a/1e6).toFixed(1)}m`:a>=1000?`${+(a/1000).toFixed(1)}k`:+a.toFixed(1)}`;}
export const comparisonTone=(v:Numeric,tolerance=.005)=>!valid(v)||Math.abs(v)<=tolerance?'neutral':v>0?'up':'down';
export const PERIODS=[['ytd','YTD'],['1y','1Y'],['3y','3Y'],['5y','5Y'],['inception','All']] as const;
