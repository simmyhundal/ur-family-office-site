import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM,VirtualConsole} from 'jsdom';

const page=readFileSync(new URL('../../../site/plus-demo/index.html',import.meta.url),'utf8');
const payload=page.match(/<script id="data" type="application\/json">([\s\S]*?)<\/script>/)![1];
const data=JSON.parse(payload);
const expected=['demo-taxable','demo-roth-a','demo-roth-b','demo-ira','demo-annuity'];
async function until(check:()=>boolean){for(let i=0;i<100;i++){if(check())return;await new Promise(r=>setTimeout(r,20));}assert.ok(check(),'Public household did not become ready');}

test('published household embeds the current shared bundle and only invented accounts',()=>{
 const bundle=readFileSync(new URL('../../../src/ufo/performance/react-assets/overview.js',import.meta.url),'utf8').replaceAll('</script','<\\/script');
 assert.equal(page.match(/<script id="react-overview-bundle" type="text\/plain">([\s\S]*?)<\/script>/)![1],bundle,'Rebuild the public household after changing the shared frontend');
 assert.match(data.demo,/invented household/);
 assert.equal(data.overview.accounts,5);
 assert.deepEqual(data.nextSteps.accounts.map((a:{id:string})=>a.id).sort(),[...expected].sort());
 assert.equal(data.benchmark,'SPY');
 assert.deepEqual(data.nextSteps.mixes.map((m:{key:string})=>m.key),['VT','SPY'].flatMap(s=>[30,60,80,100].map(p=>`fixed:${s}-${p}`)));
 assert.equal(data.nextSteps.holdout,undefined,'the holdout test is shelved (M22)');
 assert.ok(data.nextSteps.grid.months.length>36);
 assert.ok(data.benchmarks.every(([s,label]:[string,string])=>label.endsWith('ETF')&&label.includes(s)));
 assert.doesNotMatch(page,/github\.com|\/Users\/|XMLHttpRequest|WebSocket|sendBeacon|\bfetch\(/);
});

test('public household runs all three shared tabs and changes benchmark, period and account',async()=>{
 const errors:unknown[]=[];
 const console=new VirtualConsole();console.on('jsdomError',e=>errors.push(e));
 const dom=new JSDOM(page,{url:'https://example.test/plus-demo/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:console,beforeParse(w){w.scrollTo=()=>{};w.matchMedia=()=>({matches:false,addListener(){},removeListener(){}}) as unknown as MediaQueryList;}});
 try{
  const w=dom.window;
  await until(()=>w.document.getElementById('legacy-overview')!.hidden===true);
  const overview=w.document.getElementById('react-overview')!;
  assert.match(overview.textContent!,/Your investments/);
  assert.match(overview.textContent!,/Where your money came from/);
  const benchmark=overview.querySelector('select')!;
  benchmark.value=[...benchmark.options].find(o=>o.value!==data.benchmark)!.value;
  benchmark.dispatchEvent(new w.Event('change',{bubbles:true}));
  await until(()=>w.UFOBridge.snapshot().benchmark===benchmark.value);
  const all=[...overview.querySelectorAll('button')].find(b=>b.textContent==='All')!;
  all.click();await until(()=>w.UFOBridge.snapshot().period==='inception');
  w.UFOBridge.navigate('details');
  const details=w.document.getElementById('react-details')!;
  await until(()=>!details.hidden);
  assert.match(details.textContent!,/Risk versus return/);
  const account=details.querySelector('select[aria-label="Account"]') as HTMLSelectElement;
  assert.ok(account.options.length>=4);account.value=account.options[1].value;account.dispatchEvent(new w.Event('change',{bubbles:true}));
  await until(()=>details.textContent!.includes(account.selectedOptions[0].textContent!));
  w.UFOBridge.navigate('next');const next=w.document.getElementById('react-next')!;
  await until(()=>!next.hidden);
  assert.match(next.textContent!,/How it did in the past/);
  const rule=next.querySelector('select[aria-label="Proposed portfolio"]') as HTMLSelectElement;
  rule.value='fixed:SPY-80';rule.dispatchEvent(new w.Event('change',{bubbles:true}));
  await until(()=>[...next.querySelectorAll('#evidence tr[data-tone="proposal"] th')].some(th=>th.textContent==='Growth 80/20 · SPY'));
  assert.ok(next.querySelector('[data-series="moved"]'),'Sharpe over time compares the checked account');
  for(const id of ['react-overview','react-details','react-next']){const t=w.document.getElementById(id)!.textContent!;
   assert.doesNotMatch(t,/\bmix(es)?\b/i,id);assert.doesNotMatch(t,/Information, not (investment )?advice/,id);}
  const foot=w.document.querySelector('footer.foot')!.textContent!;assert.equal(foot.split('Information, not advice').length-1,1,'one disclaimer line, shown under every tab');
  assert.doesNotMatch(foot,/not investment advice/);
  const join=w.document.querySelector('header a.demo-join')!;assert.equal(join.textContent,'Pre-order Plus');assert.equal(join.getAttribute('href'),'../pricing/');
  assert.equal(w.document.querySelector('div.demo'),null,'one invented-household label, in the header');
  assert.equal(w.document.querySelector('header [data-act="opts"]'),null,'no options panel button');
  assert.match(w.document.querySelector('header')!.textContent!,/invented household/);
  assert.doesNotMatch(w.document.getElementById('tabs')!.textContent!,/Learn/);
  assert.deepEqual(errors,[]);
 }finally{dom.window.close();}
});
