// Choose first, then reveal (issue 417): a framed picker with a confirm button, and below it the content that depends on the
// choice. Until the user confirms, that content is blurred, inert and hidden from screen readers. The caller owns `confirmed`.
import {useEffect,useId,useRef,type ReactNode} from 'react';
export function ChoiceGate({heading,picker,summary,confirmed,canConfirm=true,confirmLabel='Show',onConfirm,onChange,placeholder,children}:{
 heading:string;picker:ReactNode;summary:ReactNode;confirmed:boolean;canConfirm?:boolean;confirmLabel?:string;onConfirm():void;onChange():void;placeholder?:ReactNode;children:ReactNode}){
 const id=useId(),gate=useRef<HTMLDivElement>(null),pick=useRef<HTMLElement>(null),was=useRef(confirmed),first=useRef(true);
 useEffect(()=>{
  if(first.current){first.current=false;was.current=confirmed;return;}
  if(confirmed&&!was.current)gate.current?.scrollIntoView?.({block:'start',behavior:'smooth'});
  if(!confirmed&&was.current)pick.current?.scrollIntoView?.({block:'start'});
  was.current=confirmed;
 },[confirmed]);
 return <div className="ui-choice">
  {confirmed?<p className="ui-choice-summary" aria-live="polite"><span>{summary}</span><button type="button" onClick={onChange}>Change</button></p>
  :<section ref={pick} className="ui-pick" aria-labelledby={id}><h2 id={id} className="ui-pick-h">{heading}</h2>{picker}
   <button type="button" className="ui-gate-go" disabled={!canConfirm} onClick={onConfirm}>{confirmLabel}</button></section>}
  <div ref={gate} className={`ui-gate${confirmed?'':' blur'}`} data-locked={confirmed?undefined:'true'} inert={!confirmed} aria-hidden={confirmed?undefined:true}>{confirmed?children:placeholder}</div>
 </div>;
}
