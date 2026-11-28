import {useEffect,useLayoutEffect,useRef,useState} from 'react';
// Hover (or tap) definitions: one tooltip for a whole tab (Tax, Family). Terms carry data-def="key".
export function useDefinitions(DEFS:Record<string,[string,string]>){
 const [tip,setTip]=useState<{k:string;x:number;y:number;below:boolean;target:Element}|null>(null);
 const pop=useRef<HTMLDivElement>(null),[pos,setPos]=useState<{left:number;top:number}>({left:0,top:0});
 useEffect(()=>{
  const open=(t:Element)=>{const k=t.getAttribute('data-def');if(!k||!DEFS[k])return;const r=t.getBoundingClientRect();setTip({k,x:r.left,y:r.bottom+8,below:true,target:t});};
  const find=(e:Event)=>(e.target instanceof Element?e.target.closest('[data-def]'):null);
  const over=(e:MouseEvent)=>{const t=find(e);if(t&&!t.closest('[inert]'))open(t);else setTip(null);};
  const focus=(e:FocusEvent)=>{const t=find(e);if(t)open(t);else setTip(null);};
  const click=(e:MouseEvent)=>{const t=find(e);if(!t){setTip(null);return;}e.preventDefault();setTip(c=>c&&c.target===t?null:(open(t),c));};
  const hide=()=>setTip(null);
  document.addEventListener('mouseover',over);document.addEventListener('focusin',focus);document.addEventListener('click',click);addEventListener('scroll',hide,{passive:true});
  return()=>{document.removeEventListener('mouseover',over);document.removeEventListener('focusin',focus);document.removeEventListener('click',click);removeEventListener('scroll',hide);};
 },[]);
 useLayoutEffect(()=>{
  if(!tip||!pop.current)return;
  const pw=pop.current.offsetWidth,ph=pop.current.offsetHeight;
  let top=tip.y;if(top+ph>innerHeight-8)top=tip.y-16-ph-(tip.target.getBoundingClientRect().height);
  setPos({left:Math.min(Math.max(8,tip.x),innerWidth-pw-8),top});
 },[tip]);
 return tip?<div className="pop" role="tooltip" ref={pop} style={{left:pos.left,top:pos.top}}><b>{DEFS[tip.k][0]}</b>{DEFS[tip.k][1]}</div>:null;
}

