import {useEffect,useState} from 'react';
import sharedStyles from './ui/styles.css';
const sharedStyle=document.createElement('style');sharedStyle.id='plus-shared-ui';sharedStyle.textContent=sharedStyles;document.head.appendChild(sharedStyle);
import {createRoot} from 'react-dom/client';
import {createPortal} from 'react-dom';
import {Details} from './Details';
import {NextSteps} from './NextSteps';
import {Overview} from './Overview';
import {Tax} from './Tax';
import {Mothership} from './Mothership';
import type {MothershipData} from './mothership-model';
import type {TaxData} from './tax-model';
import type {DashboardData} from './types';

type Snapshot={data:DashboardData;benchmark:string;period:string};
declare global {interface Window {
  UFOBridge:{snapshot():Snapshot;benchmark(value:string):void;period(value:string):void;navigate(value:string):void};
  UFOPilot:{ready():void;fail():void;select(mode:'legacy'|'react'):void};
}}
function Pilot(){
  const [state,setState]=useState(()=>window.UFOBridge.snapshot());
  if(state.data.schema_version!==1)throw new Error('Unsupported Overview data version.');
  useEffect(()=>{
    const update=()=>setState(window.UFOBridge.snapshot());
    window.addEventListener('ufo:state',update);
    window.UFOPilot.ready();
    return()=>window.removeEventListener('ufo:state',update);
  },[]);
  const props={...state,onBenchmark:(value:string)=>window.UFOBridge.benchmark(value),onPeriod:(value:string)=>window.UFOBridge.period(value),onNavigate:(value:string)=>window.UFOBridge.navigate(value)};
  const details=document.getElementById('react-details');
  const next=document.getElementById('react-next'),tax=document.getElementById('react-tax'),family=document.getElementById('react-mothership');
  return <><Overview {...props}/>{family&&(state.data as unknown as {mothership?:MothershipData}).mothership&&createPortal(<Mothership data={(state.data as unknown as {mothership?:MothershipData}).mothership}/>,family)}{tax&&createPortal(<Tax data={(state.data as unknown as {tax?:TaxData}).tax}/>,tax)}{details&&createPortal(<Details {...props}/>,details)}{next&&createPortal(<NextSteps data={state.data} benchmark={state.benchmark} onBenchmark={props.onBenchmark} onNavigate={props.onNavigate}/>,next)}</>;
}
try{
  const node=document.getElementById('react-overview');
  if(!node)throw new Error('Missing Overview mount.');
  createRoot(node,{onUncaughtError:()=>window.UFOPilot.fail()}).render(<Pilot/>);
}catch{window.UFOPilot.fail();}
