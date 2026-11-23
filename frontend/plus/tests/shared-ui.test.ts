import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {money,percent,decimal,formatDate,duration} from '../src/ui/format';
import {seriesStyle} from '../src/ui/components';

test('one formatting policy handles dates, precision, missing values and negative zero',()=>{
 assert.equal(money(1234.56),'$1,235');assert.equal(money(-.1),'$0');
 assert.equal(percent(.12345,true),'+12.3%');assert.equal(percent(-.00001,true),'0.0%');
 assert.equal(decimal(-.00001),'0.0');assert.equal(percent(null),'—');assert.equal(money(NaN),'—');
 assert.equal(formatDate('2026-10-31'),'Oct 2026');assert.equal(formatDate('2026-10-31','day'),'Oct 31, 2026');
 assert.equal(formatDate('2026-10','day'),'Oct 2026');assert.equal(formatDate('invalid'),'—');
 assert.equal(duration(18),'1.5 years');
});

test('series role and data quality share the same line and legend semantics',()=>{
 assert.equal(seriesStyle('portfolio','observed').dash,undefined);
 assert.equal(seriesStyle('portfolio','estimated').dash,'3 4');
 assert.equal(seriesStyle('benchmark','modeled').dash,'8 4');
 assert.equal(seriesStyle('previous','modeled').color,'var(--previous)');
 assert.equal(seriesStyle('previous','modeled').dash,'6 4');
 assert.equal(seriesStyle('portfolio','estimated').color,seriesStyle('portfolio','observed').color);
 assert.notEqual(seriesStyle('portfolio').color,seriesStyle('benchmark').color);
});

test('product tabs compose shared controls, tables, disclosures and charts',()=>{
 for(const name of ['Overview','Details','NextSteps']){
  const source=readFileSync(new URL(`../src/${name}.tsx`,import.meta.url),'utf8');
  const violations=[...source.matchAll(/<\s*(select|details|table|svg)(?=[\s>])/g)].map(m=>m[1]);
  assert.deepEqual(violations,[],`${name} introduced a second implementation of a shared pattern`);
 }
});

test('scatter labels never sit on another point (phone report: labels over dots)',async()=>{
 const React=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');
 const {RiskScatterChart}=await import('../src/ui/charts');const {JSDOM}=await import('jsdom');
 // Invented points shaped like the phone report: three close together near the right edge, one ring.
 const points=[{key:'yours',label:'Your portfolio',markerLabel:'Yours',x:.197,y:.096,role:'portfolio' as const},{key:'changed',label:'With the change',markerLabel:'With the change',marker:'ring' as const,x:.19,y:.093,role:'proposal' as const},
  {key:'proposed',label:'Invented mix',markerLabel:'SPY/BND',x:.16,y:.11,role:'proposal' as const},{key:'bench',label:'SPY',markerLabel:'SPY',x:.172,y:.148,role:'benchmark' as const}];
 const dom=new JSDOM(renderToStaticMarkup(React.createElement(RiskScatterChart,{points,label:'Risk',xTitle:'Risk',yTitle:'Return'})));try{
  const doc=dom.window.document,dots=[...doc.querySelectorAll('g[data-point] circle')].map(c=>({x:+c.getAttribute('cx')!,y:+c.getAttribute('cy')!,r:+c.getAttribute('r')!}));
  for(const t of doc.querySelectorAll('g[data-point] text')){const w=t.textContent!.length*8,x0=t.getAttribute('text-anchor')==='end'?+t.getAttribute('x')!-w:+t.getAttribute('x')!,y0=+t.getAttribute('y')!-12;
   for(const d of dots)assert.ok(!(x0<d.x+d.r&&x0+w>d.x-d.r&&y0<d.y+d.r&&y0+15>d.y-d.r),`${t.textContent} covers a point`);}
 }finally{dom.window.close();}
});
test('scatter labels stay present near plot edges and crowded portfolio markers',async()=>{
 const React=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');
 const {RiskScatterChart}=await import('../src/ui/charts');const {JSDOM}=await import('jsdom');
 const points=[{key:'a',label:'Example A',markerLabel:'1',x:.164,y:.133,role:'portfolio' as const},{key:'b',label:'Example B',markerLabel:'2',x:.185,y:.178,role:'portfolio' as const},{key:'total',label:'Your portfolio',markerLabel:'P',marker:'ring' as const,x:.167,y:.145,role:'portfolio' as const}];
 const html=renderToStaticMarkup(React.createElement(RiskScatterChart,{points,label:'Risk',xTitle:'Risk',yTitle:'Return'}));
 const dom=new JSDOM(html);try{const groups=[...dom.window.document.querySelectorAll('g')].filter(g=>g.querySelector('title'));assert.deepEqual(groups.map(g=>g.querySelector('text')?.textContent),['1','2','P']);}finally{dom.window.close();}
});
