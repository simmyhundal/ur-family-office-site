// The "Tax this year" flow: income by kind -> the rate it is taxed at -> estimated tax. Band width is tax dollars.
// Wide screens get the Sankey; phones get the grouped list (CSS picks which one shows).
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {dollars,pct,type Computed} from './tax-model';

function band(x0:number,y0a:number,y0b:number,x1:number,y1a:number,y1b:number,cls:string,key:string){
 const m=(x0+x1)/2;
 return <path key={key} className={`band ${cls}`} d={`M${x0},${y0a}C${m},${y0a} ${m},${y1a} ${x1},${y1a}L${x1},${y1b}C${m},${y1b} ${m},${y0b} ${x0},${y0b}Z`}/>;
}

export function SankeyWide({c,width}:{c:Computed;width:number}){
 const {sources:S,groups:G,total:TOTAL}=c;
 const W=Math.max(600,width),NW=12,top=34,k=300/Math.max(TOTAL,1),SLOT=40,GAP=10,GGAP=26,hh=(t:number)=>Math.max(2,t*k);
 const xL=Math.min(230,W*.24),xM=Math.round(W*.56),xR=W-Math.min(210,W*.22);
 let y=top;const L:Record<string,{y:number;h:number}>={};
 (['ord','lt'] as const).forEach((g,gi)=>{if(gi)y+=GGAP;S.filter(s=>s.kind===g).forEach(s=>{const h=hh(s.tax),slot=Math.max(h,SLOT);L[s.k]={y:y+(slot-h)/2,h};y+=slot+GAP;});});
 let H=y-GAP+12;const M:Record<string,{y:number;h:number}>={};
 (['ord','lt'] as const).forEach(kind=>{
  const ss=S.filter(s=>s.kind===kind).map(s=>L[s.k]),cc=(ss[0].y+ss[ss.length-1].y+ss[ss.length-1].h)/2;
  const gs=G.filter(g=>g.kind===kind),slots=gs.map(g=>Math.max(hh(g.tax),SLOT)),blk=slots.reduce((a,b)=>a+b,0)+GAP*Math.max(0,gs.length-1);
  let my=cc-blk/2;gs.forEach((g,n)=>{const h=hh(g.tax);M[g.g]={y:my+(slots[n]-h)/2,h};my+=slots[n]+GAP;});H=Math.max(H,my+12);});
 const RH=TOTAL*k,RY=Math.max(top,(top+H)/2-RH/2);
 const outOff:Record<string,number>={},inOff:Record<string,number>={};
 S.forEach(s=>{outOff[s.k]=L[s.k].y;});G.forEach(g=>{inOff[g.g]=M[g.g].y;});
 const bands:ReactNode[]=[];
 G.forEach(g=>S.forEach(s=>s.flows.filter(f=>f.group===g&&f.tax>0).forEach(f=>{
  const t=f.tax*k;bands.push(band(xL+NW,outOff[s.k],outOff[s.k]+t,xM,inOff[g.g],inOff[g.g]+t,g.kind,`${s.k}-${g.g}`));outOff[s.k]+=t;inOff[g.g]+=t;})));
 let roff=RY;G.forEach(g=>{if(g.tax>0){const m=M[g.g],t=g.tax*k;bands.push(band(xM+NW,m.y,m.y+t,xR,roff,roff+t,g.kind,`out-${g.g}`));roff+=t;}});
 return <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
  {bands}
  <text x={xL+NW} y={14} textAnchor="end" className="sk-col">This year’s income</text>
  <text x={xM+NW/2} y={14} textAnchor="middle" className="sk-col">Taxed at</text>
  <text x={xR} y={14} className="sk-col">Estimated tax</text>
  {S.map(s=>{const a=L[s.k],cy=a.y+a.h/2;return <g key={s.k}>
   <rect x={xL} y={a.y} width={NW} height={a.h} className={s.kind}/>
   <text x={xL-8} y={cy-3} textAnchor="end" className="sk-name" data-def={s.k} tabIndex={0}>{s.name}</text>
   <text x={xL-8} y={cy+13} textAnchor="end">{s.sub}</text>
   <text x={xL+NW+8} y={cy+4} className="sk-tax">{`= ${dollars(s.tax)}`}</text></g>;})}
  {G.map(g=>{const m=M[g.g];return <g key={g.g}>
   <rect x={xM} y={m.y} width={NW} height={m.h} className={g.kind}/>
   <text x={xM+NW+8} y={m.y+m.h/2-3} className="sk-name">{g.label}</text>
   <text x={xM+NW+8} y={m.y+m.h/2+13}>{`${dollars(g.tax)} tax on ${dollars(g.income)}`}</text></g>;})}
  <rect x={xR} y={RY} width={NW} height={Math.max(2,RH)} className="tot"/>
  <text x={xR+NW+10} y={RY+RH/2+4} className="sk-big">{dollars(TOTAL)}</text>
  <text x={xR+NW+10} y={RY+RH/2+22}>federal, estimated</text>
 </svg>;
}

export function SankeyList({c}:{c:Computed}){
 const {sources:S,groups:G,total:TOTAL}=c;
 return <>{G.map(g=>{const col=g.kind==='ord'?'var(--tx-ord)':'var(--tx-lt)';
  return <div className="skn-group" key={g.g}><div className="skn-head"><span><i style={{background:col}}/>{`At the ${g.label}`}</span><span>{dollars(g.tax)}</span></div>
   {S.flatMap(s=>s.flows.filter(f=>f.group===g).map(f=><div className="skn-row" key={`${g.g}-${s.k}`}>
    <span data-def={s.k} tabIndex={0}>{s.name}</span><small>{`${dollars(f.income)} × ${pct(g.rate)}`}</small><b>{dollars(f.tax)}</b>
    <span className="bar"><i style={{width:`${TOTAL?(f.tax/TOTAL*100).toFixed(1):0}%`,background:col}}/></span></div>))}</div>;})}
  <div className="skn-total"><span>Estimated tax</span><span>{dollars(TOTAL)}</span></div></>;
}

/** Measures its box so the Sankey draws at the real width. */
export function useWidth(){
 const ref=useRef<HTMLDivElement>(null),[w,setW]=useState(900);
 useEffect(()=>{const el=ref.current;if(!el)return;setW(el.clientWidth||900);
  if(typeof ResizeObserver==='undefined')return;
  const ro=new ResizeObserver(()=>setW(el.clientWidth||900));ro.observe(el);return()=>ro.disconnect();},[]);
 return [ref,w] as const;
}
