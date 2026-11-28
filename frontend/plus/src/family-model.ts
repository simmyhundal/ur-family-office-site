// Family (the family tab). Pure figures from an invented block in the page data; nothing here reads real accounts.
// Ported from docs/mocks/mothership-v2.html. Information, not investment advice.
export type Person={id:string;name:string;sub:string;accts:number};
export type Home={p:string;name:string;yr:number;price:number;idx:number;bal:number;down:number;pay:number;payYrs:number;tax:number};
export type Biz={p:string;value:number;rev:number;mult:number;cash:number;gap:number;start:number};
export type Perf={fam:number;vti:number;mix:number};
export type Advisor={p:string;value:number;fee:number;years:number[];gross:number[];mix:number[];mixCost:number};
export type FamilyData={people:Person[];base:Record<string,{pub:number;cash:number;cry:number}>;perf:Record<string,Perf>;homes:Home[];biz:Biz;advisor:Advisor;now:number;asof?:string};
export type Selection={on:Record<string,boolean>;cash:boolean;cry:boolean};
export const TYPES=[{k:'pub',name:'Public markets',c:'var(--a-pub)'},{k:'biz',name:'The studio',c:'var(--a-biz)'},{k:'re',name:'Real estate',c:'var(--a-re)'},{k:'cash',name:'Bank cash',c:'var(--a-cash)'},{k:'cry',name:'Crypto',c:'var(--a-cry)'}] as const;
export type Kind=typeof TYPES[number]['k'];

export const usd=(n:number)=>(n<0?'−':'')+'$'+Math.abs(Math.round(n)).toLocaleString('en-US');
export const usdM=(n:number)=>Math.abs(n)>=1e6?'$'+(n/1e6).toFixed(2)+' million':usd(n);
export const usdK=(n:number)=>{const a=Math.abs(n);return a>=1e6?'$'+(n/1e6).toFixed(2)+'M':a>=1e3?'$'+Math.round(n/1e3)+'K':usd(n);};
export const pct=(r:number)=>(r<0?'−':'')+Math.abs(r*100).toFixed(1)+'%';
export const words=(s:string)=>s.trim().split(/\s+/).filter(Boolean).length;

export function irr(fl:[number,number][]):number{
 const f=(r:number)=>fl.reduce((s,[t,a])=>s+a/Math.pow(1+r,t),0);let lo=-.99,hi=5;if(f(lo)*f(hi)>0)return NaN;
 for(let i=0;i<200;i++){const m=(lo+hi)/2;if(f(lo)*f(m)<=0)hi=m;else lo=m;}return (lo+hi)/2;
}
export const homeVal=(h:Home)=>Math.round(h.price*h.idx/100)*100;
export const homeEq=(h:Home)=>homeVal(h)-h.bal;
export function homeCash(h:Home,now:number){
 const T=now-h.yr,fl:[number,number][]=[[0,-h.down]];let c=h.down;
 for(let k=0;k<T;k++){const part=Math.min(1,T-k),t=k+part/2;if(k<h.payYrs){fl.push([t,-h.pay*part]);c+=h.pay*part;}fl.push([t,-h.tax*part]);c+=h.tax*part;}
 fl.push([T,homeEq(h)]);return {cash:c,r:irr(fl)};
}
export function bizIrr(b:Biz,now:number,sweat:boolean){
 const T=now-b.start,fl:[number,number][]=[[0,-b.cash]];
 if(sweat)for(let k=0;k<T;k++){const p=Math.min(1,T-k);fl.push([k+p/2,-b.gap*p]);}
 fl.push([T,b.value]);return irr(fl);
}
export type Amounts=Record<Kind,number>;
export function amounts(d:FamilyData,s:Selection,p:string):Amounts{
 const b=d.base[p]??{pub:0,cash:0,cry:0};
 return {pub:b.pub,biz:d.biz.p===p?d.biz.value:0,re:d.homes.filter(h=>h.p===p).reduce((t,h)=>t+homeEq(h),0),cash:s.cash?b.cash:0,cry:s.cry?b.cry:0};
}
export const sum=(o:Record<string,number>)=>Object.values(o).reduce((a,b)=>a+b,0);
export const people=(d:FamilyData,s:Selection)=>d.people.filter(p=>s.on[p.id]);
export function advisorPaths(a:Advisor){
 const start=Math.round(a.value/a.gross.reduce((p,g)=>p*(1+g-a.fee),1)/1000)*1000;
 let x=start,m=start,fees=0;const pa=[x],pm=[m];
 a.gross.forEach((g,i)=>{fees+=x*a.fee;x*=1+g-a.fee;m*=1+a.mix[i]-a.mixCost;pa.push(x);pm.push(m);});
 return {start,fees,pa,pm};
}
/** Family appears only when the page data carries an invented block (never in a real household's page). */
export const hasFamily=(d:unknown):d is {family:FamilyData}=>!!d&&typeof d==='object'&&!!(d as {family?:unknown}).family;
