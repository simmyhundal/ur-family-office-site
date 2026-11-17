import type { DashboardData, PeriodKey, Sources } from './types';

export type ChartSeries = { key: string; label: string; values: (number | null)[] };
export type OverviewView = {
  sources: Sources | null;
  annualized: boolean;
  empty: boolean;
  value: number;
  irr: number | null;
  benchmark: string;
  comparison: { value: number | null; irr: number | null; note: string } | null;
  tone: 'up' | 'down' | 'neutral';
  months: string[];
  values: number[];
  estimated: boolean[];
  series: ChartSeries[];
  start: number;
};

function firstIndex(months: string[], period: PeriodKey): number {
  if (!months.length || period === 'inception' || period === 'all') return 0;
  const end = Date.parse(months[months.length - 1] + 'T00:00:00Z');
  if (!Number.isFinite(end)) throw new Error('Invalid overview date');
  const d = new Date(end);
  const cutoff = period === 'ytd'
    ? Date.UTC(d.getUTCFullYear() - 1, 11, 31)
    : Date.UTC(d.getUTCFullYear() - (period === '1y' ? 1 : period === '3y' ? 3 : 5), d.getUTCMonth(), d.getUTCDate());
  let i = 0;
  for (let n = 0; n < months.length; n++) {
    const t = Date.parse(months[n] + 'T00:00:00Z');
    if (!Number.isFinite(t)) throw new Error('Invalid overview date');
    if (t <= cutoff) i = n;
    else break;
  }
  return i;
}

export function deriveView(data: DashboardData, benchmark: string, period: PeriodKey): OverviewView {
  const base = data.overview;
  const key = period === 'all' ? 'inception' : period;
  const computed = base?.windows?.[key];
  if (base && key !== 'inception' && !computed) throw new Error('Missing period calculations');
  const o = base ? {...base,...computed} : null;
  if (!o) return { sources: null, annualized: true, empty: true, value: 0, irr: null, benchmark, comparison: null, tone: 'neutral', months: [], values: [], estimated: [], series: [], start: 0 };
  if (!Array.isArray(o.months) || !o.months.length) throw new Error('Missing overview dates');
  let previous = -Infinity;
  for (const day of o.months) {
    const time = Date.parse(day + 'T00:00:00Z');
    if (!Number.isFinite(time) || time <= previous) throw new Error('Invalid overview dates');
    previous = time;
  }
  const start = computed ? 0 : firstIndex(o.months, period);
  const months = Array.isArray(o.months) ? o.months.slice(start) : [];
  const selected = o.benchmarks[benchmark];
  if (!Number.isFinite(o.value) || (o.irr != null && !Number.isFinite(o.irr))) throw new Error('Invalid overview headline data');
  if (selected && ((selected.value != null && !Number.isFinite(selected.value)) || (selected.irr != null && !Number.isFinite(selected.irr)))) throw new Error('Invalid benchmark headline data');
  const difference = selected?.irr != null && o.irr != null ? o.irr - selected.irr : null;
  if (o.values.length !== o.months.length || o.estimated.length !== o.months.length) throw new Error('Overview series length mismatch');
  const rawValues = o.values;
  const values = rawValues.slice(start, start + months.length);
  if (values.some((n) => !Number.isFinite(n))) throw new Error('Invalid overview value');
  const estimated = o.estimated.slice(start, start + months.length);
  const series: ChartSeries[] = [{ key: 'portfolio', label: 'Your investments', values }];
  const points = selected?.values;
  if (points?.length) {
    if (points.length !== o.months.length) throw new Error('Benchmark series length mismatch');
    const sliced = points.slice(start, start + months.length);
    if (sliced.some((n) => n != null && !Number.isFinite(n))) throw new Error('Invalid benchmark value');
    series.push({ key: benchmark, label: data.benchmarks.find(([s]) => s === benchmark)?.[1] ?? benchmark, values: sliced });
  }
  return {
    sources: computed?.sources ?? null,
    annualized: computed?.annualized ?? true,
    empty: false, value: o.value, irr: o.irr, benchmark,
    comparison: selected ? { value: selected.value, irr: selected.irr, note: selected.note } : null,
    tone: difference == null || Math.abs(difference) <= 0.005 ? 'neutral' : difference > 0 ? 'up' : 'down',
    months, values, estimated, series, start,
  };
}

// Rounded money steps: prefer $100k on broad ranges, tighter standard steps on short windows.
export function moneyAxis(values:number[], zeroBaseline:boolean){
  if(!values.length)return {lo:0,hi:100000,ticks:[0,100000],step:100000};
  const min=Math.min(...values),max=Math.max(...values),range=Math.max(max-min,1);
  const target=zeroBaseline?Math.max(max-Math.min(min,0),1)/4:range/3;
  const steps=[1,2,5,10,25,50,100,250,500,1000,2500,5000,10000,25000,50000,100000,250000,500000,1000000,2500000,5000000];
  const step=steps.find(v=>v>=target)??Math.pow(10,Math.ceil(Math.log10(target)));
  const lo=Math.floor((zeroBaseline?Math.min(min,0):min)/step)*step;
  const hi=Math.max(lo+step,Math.ceil(max/step)*step);
  return {lo,hi,step,ticks:Array.from({length:Math.round((hi-lo)/step)+1},(_,i)=>lo+i*step)};
}
