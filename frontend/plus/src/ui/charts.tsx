import {useId,useState,type ReactNode} from 'react';
import {moneyAxis} from '../model';
import {formatDate,moneyTick,percent,money,ratio} from './format';
import {DateInspector,Legend,StatusMessage,seriesStyle,type Role,type Quality} from './components';
export function plotLayout(xTitle?:string,yTitle?:string){return {w:480,h:264,l:64,r:18,t:yTitle?34:14,b:xTitle?54:32,xTitle,yTitle};}
type Layout=ReturnType<typeof plotLayout>;
export function ChartFrame({layout,children,label,onPointerDown}:{layout:Layout;children:ReactNode;label:string;onPointerDown?:React.PointerEventHandler<SVGSVGElement>}){return <svg className="ui-chart-svg" viewBox={`0 0 ${layout.w} ${layout.h}`} role="img" aria-label={label} onPointerDown={onPointerDown}>{layout.yTitle&&<text className="ui-axis-title" x={layout.l} y="17">{layout.yTitle}</text>}{children}{layout.xTitle&&<text className="ui-axis-title" x={(layout.l+layout.w-layout.r)/2} y={layout.h-5} textAnchor="middle">{layout.xTitle}</text>}</svg>;}
export function Axis({direction,ticks,position,format,layout}:{direction:'x'|'y';ticks:number[];position(value:number):number;format(value:number):string;layout:Layout}){return <g className={`ui-axis ui-axis-${direction}`}>{ticks.map((v,i)=>direction==='y'?<g key={i}><line x1={layout.l} x2={layout.w-layout.r} y1={position(v)} y2={position(v)} className="ui-gridline"/><text x={layout.l-9} y={position(v)+4} textAnchor="end">{format(v)}</text></g>:<text key={i} x={position(v)} y={layout.h-layout.b+23} textAnchor={i===0?'start':i===ticks.length-1?'end':'middle'}>{format(v)}</text>)}</g>;}
export type Series={key:string;label:string;role:Role;values:(number|null)[];estimated?:boolean[];quality?:Quality};
/** Axis for small unitless values (a Sharpe ratio): steps of 0.1 to 1, always including zero in view when close. */
export function ratioAxis(values:number[]){
 if(!values.length)return {lo:0,hi:1,ticks:[0,1],step:1};
 const min=Math.min(...values,0),max=Math.max(...values),target=Math.max(max-min,.1)/4,step=[.1,.2,.25,.5,1,2].find(v=>v>=target)??5;
 const lo=Math.floor(min/step)*step,hi=Math.max(lo+step,Math.ceil(max/step)*step);
 return {lo,hi,step,ticks:Array.from({length:Math.round((hi-lo)/step)+1},(_,i)=>+(lo+i*step).toFixed(2))};
}
/** Contiguous runs of finite values, so a fill never bridges a gap in the data. */
function runs(values:(number|null)[]){const out:number[][]=[];let cur:number[]=[];values.forEach((v,i)=>{if(v!=null&&Number.isFinite(v))cur.push(i);else if(cur.length){out.push(cur);cur=[];}});if(cur.length)out.push(cur);return out.filter(r=>r.length>1);}
const timestamp=(day:string)=>Date.parse((day.length===7?day+'-01':day)+'T00:00:00Z');
export function TimeSeriesChart({dates,series,label,zeroBaseline=false,resetKey='',xTitle,yTitle,boundary,kind='money'}:{dates:string[];series:Series[];label:string;zeroBaseline?:boolean;resetKey?:string;xTitle?:string;yTitle?:string;boundary?:{date:string;label:string};kind?:'money'|'ratio'}){
 const [inspection,setInspection]=useState<{key:string;index:number}|null>(null);
 const fillId='ufo-fill-'+useId().replace(/[^a-zA-Z0-9_-]/g,'');
 const valid=series.filter(s=>s.values.length===dates.length),primary=valid.find(s=>s.role==='portfolio')??valid[0];
 const key=resetKey+'/'+dates[0]+'/'+dates.at(-1)+'/'+series.map(s=>s.key+':'+s.values.at(-1)).join('/');
 const active=inspection?.key===key?Math.max(0,Math.min(dates.length-1,inspection.index)):dates.length-1;
 if(dates.length<2||!primary||!primary.values.some(v=>v!=null&&Number.isFinite(v)))return <StatusMessage kind="missing">{kind==='ratio'?'Not enough history for this chart.':'Value history is unavailable for this period.'}</StatusMessage>;
 const p=plotLayout(xTitle,yTitle),times=dates.map(timestamp),first=times[0],span=times.at(-1)!-first;
 const finite=valid.flatMap(s=>s.values.filter((v):v is number=>v!=null&&Number.isFinite(v))),bounds=kind==='ratio'?ratioAxis(finite):moneyAxis(finite,zeroBaseline),tick=kind==='ratio'?ratio:moneyTick,show=kind==='ratio'?ratio:money;
 const X=(i:number)=>p.l+(span?(times[i]-first)/span:0)*(p.w-p.l-p.r),Y=(v:number)=>p.t+(bounds.hi-v)/(bounds.hi-bounds.lo||1)*(p.h-p.t-p.b);
 const inspect=(i:number)=>setInspection({key,index:Math.max(0,Math.min(dates.length-1,i))});
 return <div className="ui-chart chart-wrap" tabIndex={0} role="group" aria-label={`${label}. Use arrow keys to inspect dates.`} onKeyDown={e=>{const move={ArrowLeft:active-1,ArrowRight:active+1,Home:0,End:dates.length-1}[e.key];if(move!=null){e.preventDefault();inspect(move);}}}>
 <ChartFrame layout={p} label={label} onPointerDown={e=>{const r=e.currentTarget.getBoundingClientRect();if(!r.width)return;const t=first+((e.clientX-r.left)/r.width*p.w-p.l)/(p.w-p.l-p.r)*span;inspect(times.reduce((best,v,i)=>Math.abs(v-t)<Math.abs(times[best]-t)?i:best,0));}}>
 <defs>{valid.map((s,i)=>{const c=seriesStyle(s.role).color;return <linearGradient key={s.key} id={`${fillId}-${i}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={c} stopOpacity={s.role==='portfolio'?.26:.16}/><stop offset="100%" stopColor={c} stopOpacity="0"/></linearGradient>;})}</defs>
 <Axis direction="y" ticks={bounds.ticks} position={Y} format={tick} layout={p}/>
 {valid.map((s,i)=><g key={s.key} className="ui-area" aria-hidden="true">{runs(s.values).map(r=><path key={r[0]} d={`M${X(r[0])},${p.h-p.b} `+r.map(j=>`L${X(j)},${Y(s.values[j] as number)}`).join(' ')+` L${X(r.at(-1)!)},${p.h-p.b} Z`} fill={`url(#${fillId}-${i})`} stroke="none"/>)}</g>)}
 {boundary&&timestamp(boundary.date)>=first&&timestamp(boundary.date)<=times.at(-1)!&&(()=>{const x=p.l+(timestamp(boundary.date)-first)/span*(p.w-p.l-p.r);return <g aria-label={boundary.label}><rect x={p.l} y={p.t} width={x-p.l} height={p.h-p.t-p.b} fill="var(--ink-3)" opacity=".1"/><line x1={x} x2={x} y1={p.t} y2={p.h-p.b} stroke="var(--ink-2)" strokeDasharray="4 3"/><text x={x+5} y={p.t+14}>{boundary.label}</text></g>})()}
 {valid.map(s=><g key={s.key} data-series={s.key}>{s.values.slice(1).map((v,i)=>{const a=s.values[i];if(a==null||v==null||!Number.isFinite(a)||!Number.isFinite(v))return null;const quality=s.estimated?.[i]||s.estimated?.[i+1]?'estimated':s.quality??'observed',style=seriesStyle(s.role,quality);return <path key={i} d={`M${X(i)},${Y(a)} L${X(i+1)},${Y(v)}`} fill="none" stroke={style.color} strokeWidth={s.role==='portfolio'?2.7:2} strokeDasharray={style.dash} data-quality={quality} data-role={s.role}/>;})}</g>)}
 <line x1={X(active)} x2={X(active)} y1={p.t} y2={p.h-p.b} stroke="var(--ink-3)" strokeDasharray="2 4"/>
 {valid.map(s=>{const value=s.values[active];return value!=null&&Number.isFinite(value)?<circle key={s.key} cx={X(active)} cy={Y(value)} r={s.role==='portfolio'?4:3} fill={seriesStyle(s.role).color}/>:null;})}
 <Axis direction="x" ticks={[0,dates.length-1]} position={X} format={i=>formatDate(dates[i])} layout={p}/>
 </ChartFrame>
 <Legend items={valid.map(s=>({label:s.label,role:s.role,quality:s.estimated?.some(Boolean)?'estimated':s.quality}))}/>
 {series.some(s=>s.role==='benchmark')&&!valid.some(s=>s.role==='benchmark')&&<StatusMessage kind="missing">The selected comparison has no value history for this period.</StatusMessage>}
 <DateInspector format={show} date={dates[active]} values={valid.map(s=>({label:s.label,value:s.values[active]??null,role:s.role}))} previous={()=>inspect(active-1)} next={()=>inspect(active+1)} atStart={active===0} atEnd={active===dates.length-1}/>
 </div>;
}
export type ScatterPoint={key:string;label:string;markerLabel?:string;marker?:'dot'|'ring';x:number;y:number;role:Role;sharpe?:number|null};
/** With `inspect`, tapping, hovering or focusing a point shows its return, volatility and Sharpe ratio below the chart
 * (an SVG title alone does nothing on a phone). The first point is shown until another is chosen. */
export function RiskScatterChart({points,label,xTitle,yTitle,inspect=false}:{points:ScatterPoint[];label:string;xTitle:string;yTitle:string;inspect?:boolean}){
 const [picked,setPicked]=useState<string|null>(null);
 const good=points.filter(v=>Number.isFinite(v.x)&&Number.isFinite(v.y)&&v.x>=0);if(!good.length)return <StatusMessage kind="missing">More monthly history is needed for this comparison.</StatusMessage>;
 const p=plotLayout(xTitle,yTitle),rounded=(v:number)=>[.01,.025,.05,.1,.25,.5,1,2.5,5,10].find(n=>n>=v)??Math.ceil(v);
 const xmax0=Math.max(.01,...good.map(v=>v.x)),sx=rounded(xmax0/3),xmax=Math.ceil(xmax0/sx)*sx;
 const low=Math.min(0,...good.map(v=>v.y)),high=Math.max(.01,...good.map(v=>v.y)),sy=rounded((high-low)/3),ymin=Math.floor(low/sy)*sy,ymax=Math.ceil(high/sy)*sy;
 const X=(v:number)=>p.l+v/xmax*(p.w-p.l-p.r),Y=(v:number)=>p.t+(ymax-v)/(ymax-ymin||1)*(p.h-p.t-p.b);
 const labelBoxes:{x:number;y:number;w:number;h:number}[]=[],labels=new Map<string,{x:number;y:number;anchor:'start'|'end'}>();
 for(const v of good){if(!v.markerLabel)continue;const width=Math.max(10,v.markerLabel.length*8),choices=(v.marker==='ring'?[-1,1]:[1,-1]).flatMap(side=>[-13,4,20,-27,34,48].map(dy=>({x:X(v.x)+side*11,y:Y(v.y)+dy,anchor:(side===1?'start':'end') as 'start'|'end'})));
  for(const q of choices){const box={x:q.anchor==='start'?q.x:q.x-width,y:q.y-12,w:width,h:15};if(box.x<p.l||box.x+box.w>p.w-p.r||box.y<p.t||box.y+box.h>p.h-p.b)continue;if(labelBoxes.some(b=>box.x<b.x+b.w+3&&box.x+box.w+3>b.x&&box.y<b.y+b.h+3&&box.y+box.h+3>b.y))continue;labels.set(v.key,q);labelBoxes.push(box);break;}
  if(!labels.has(v.key))labels.set(v.key,{x:Math.max(p.l,Math.min(p.w-p.r-width,X(v.x)+10)),y:Math.max(p.t+13,Math.min(p.h-p.b-4,Y(v.y)-10)),anchor:'start'});
 }
 return <div className="ui-chart"><ChartFrame layout={p} label={label}><Axis direction="y" ticks={Array.from({length:Math.round((ymax-ymin)/sy)+1},(_,i)=>ymin+i*sy)} position={Y} format={percent} layout={p}/><Axis direction="x" ticks={Array.from({length:Math.round(xmax/sx)+1},(_,i)=>i*sx)} position={X} format={percent} layout={p}/>{good.map(v=><g key={v.key} data-point={v.key} {...(inspect?{tabIndex:0,role:'button','aria-label':`${v.label}: return ${percent(v.y)}, volatility ${percent(v.x)}${v.sharpe!=null?`, Sharpe ${ratio(v.sharpe)}`:''}`,'aria-pressed':(picked??good[0].key)===v.key,className:'ui-point',onClick:()=>setPicked(v.key),onFocus:()=>setPicked(v.key),onPointerEnter:()=>setPicked(v.key)}:{})}><title>{`${v.label}: return ${percent(v.y)}, volatility ${percent(v.x)}`}</title>{inspect&&<circle className="ui-point-hit" cx={X(v.x)} cy={Y(v.y)} r={18} fill="transparent"/>}<circle cx={X(v.x)} cy={Y(v.y)} r={v.marker==='ring'?8:5} fill={v.marker==='ring'?'var(--surface)':seriesStyle(v.role).color} stroke={seriesStyle(v.role).color} strokeWidth={v.marker==='ring'?2:0}/>{v.markerLabel&&labels.has(v.key)&&<text x={labels.get(v.key)!.x} y={labels.get(v.key)!.y} textAnchor={labels.get(v.key)!.anchor}>{v.markerLabel}</text>}</g>)}</ChartFrame>
 {inspect&&(()=>{const v=good.find(x=>x.key===picked)??good[0];return <p className="ui-point-readout" aria-live="polite" data-tone={v.role}><b>{v.label}</b><span>Return {percent(v.y,true)} /yr</span><span>Volatility {percent(v.x)}</span><span>Sharpe {ratio(v.sharpe)}</span></p>;})()}
 </div>;
}
