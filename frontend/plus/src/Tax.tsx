// Tax tab: where taxes apply, and the gains and losses in taxable accounts. Information, not tax advice. Read-only: nothing is
// sold or proposed, and no tax amounts or rates are shown (decision 0016).
import {Card,CardStack,CardHeader,PageHeader,Takeaway,SourceLine,DataTable,StatusMessage,Disclosure} from './ui/components';
import {money,percent,formatDate} from './ui/format';
import {MISSING_BASIS,FOOTER,signedMoney,signedPercent,gainTone,excludedNote,takeaway,type TaxData} from './tax-model';

function Where({t}:{t:TaxData['whereTaxesApply']}){
 const groups=t.groups.filter(g=>g.accounts.length);
 const top=[...groups].sort((a,b)=>b.value-a.value)[0];
 return <Card className="tax-where">{top&&t.total>0&&<Takeaway>{`${percent(top.share)} of your money is in ${top.label.toLowerCase()} accounts`}</Takeaway>}
 <CardHeader title="Where taxes apply" caption="The kind of account decides when tax is due."/>
 {!groups.length?<StatusMessage kind="missing">No accounts yet.</StatusMessage>:groups.map(g=><section key={g.key} className="tax-group" data-group={g.key}>
  <h3>{g.label} <span className="tax-share">{money(g.value)} · {percent(g.share)}</span></h3><p className="small">{g.meaning}</p>
  <DataTable label={`${g.label} accounts`}><thead><tr><th>Account</th><th>Value</th></tr></thead><tbody>{g.accounts.map(a=><tr key={a.id}><th scope="row">{a.label}{a.nonMarket&&<span className="small"> · non-market</span>}</th><td>{money(a.value)}</td></tr>)}</tbody></DataTable></section>)}
 <SourceLine>the account type you set for each account.</SourceLine>
 </Card>;
}

function Gains({g}:{g:TaxData['gains']}){
 const any=g.accounts.some(a=>a.holdings.length),note=excludedNote(g.total),lede=takeaway(g.total,any);
 return <Card className="tax-gains">{lede&&<Takeaway tone={g.total.basis>0?gainTone(g.total.gain):undefined}>{lede}</Takeaway>}
 <CardHeader title="Gains and losses you're sitting on" caption="Taxable accounts only. Unrealized: nothing has been sold."/>
 {!g.accounts.length&&<StatusMessage kind="missing">No taxable account with a positions file yet.</StatusMessage>}
 {g.accounts.map(a=><section key={a.id} className="tax-account"><h3>{a.label}</h3>
  {a.holdings.length?<DataTable label={`${a.label} gains and losses`}><thead><tr><th>Holding</th><th>Cost basis</th><th>Value</th><th>Gain or loss</th><th>%</th></tr></thead>
   <tbody>{a.holdings.map(h=><tr key={h.symbol}><th scope="row" title={h.name||undefined}>{h.symbol}</th>
    {h.basis==null?<><td className="tax-missing">{MISSING_BASIS}</td><td>{money(h.value)}</td><td>—</td><td>—</td></>:
     <><td>{money(h.basis)}</td><td>{money(h.value)}</td><td data-direction={gainTone(h.gain)}>{signedMoney(h.gain)}</td><td data-direction={gainTone(h.gain)}>{signedPercent(h.gainPct)}</td></>}</tr>)}</tbody></DataTable>:<StatusMessage kind="missing">No holdings listed.</StatusMessage>}
  {a.asof&&<p className="small">Positions as of {formatDate(a.asof,'day')}.</p>}</section>)}
 {g.noPositions.length>0&&<StatusMessage kind="missing">No positions file for {g.noPositions.join(', ')}, so no gains or losses.</StatusMessage>}
 {any&&<div className="tax-total"><h3>Total</h3><DataTable label="Total gain or loss"><thead><tr><th>Cost basis</th><th>Value</th><th>Gain or loss</th><th>%</th></tr></thead>
  <tbody><tr><td>{money(g.total.basis)}</td><td>{money(g.total.value)}</td><td data-direction={gainTone(g.total.gain)}>{signedMoney(g.total.gain)}</td><td data-direction={gainTone(g.total.gain)}>{signedPercent(g.total.gainPct)}</td></tr></tbody></DataTable>
  {note&&<StatusMessage kind="estimated">{note}</StatusMessage>}</div>}
 <Disclosure title="Short or long term?"><p>Term is unknown: your exports do not show when each lot was bought. Short-term and long-term gains are taxed differently, so check your lot dates before acting.</p></Disclosure>
 <SourceLine>the cost basis column of your latest Positions export. A missing basis is never guessed.</SourceLine>
 </Card>;
}

export function Tax({data}:{data?:TaxData}){
 return <CardStack className="tax"><PageHeader title="Tax"/>
 {!data?<Card><StatusMessage kind="missing">The tax view is not available for this report. Refresh it in the UFO app.</StatusMessage></Card>:<>
  <Where t={data.whereTaxesApply}/><Gains g={data.gains}/>
  <p className="small tax-foot">{FOOTER}</p></>}
 </CardStack>;
}
