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
 assert.ok(data.nextSteps.holdout.rows.some((r:{kind:string})=>r.kind==='fitted'));
 assert.ok(data.nextSteps.holdout.verdict.status);
 assert.ok(Object.keys(data.nextSteps.holdout.today.weights).includes('Max Sharpe'));
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
  assert.match(next.textContent!,/How did it hold up/);
  const rule=next.querySelector('select[aria-label="Proposed portfolio"]') as HTMLSelectElement;
  rule.value='Minimum variance';rule.dispatchEvent(new w.Event('change',{bubbles:true}));
  await until(()=>!!next.querySelector('[data-series="Minimum variance"]'));
  assert.match(w.document.querySelector('header')!.textContent!,/invented household/);
  assert.doesNotMatch(w.document.getElementById('tabs')!.textContent!,/Learn/);
  assert.deepEqual(errors,[]);
 }finally{dom.window.close();}
});
