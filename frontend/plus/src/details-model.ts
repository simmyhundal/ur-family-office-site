import type { DashboardData, PeriodKey } from './types';

export type ChartData = { months: string[]; values: number[]; bench: number[]; estimated?: boolean[] };
export type Stats = {
  value: number; irr: number | null; excess: number | null; bench_irr: number | null;
  bench_end: number | null; twr: number | null; sharpe: number | null; dd: number | null;
  risk?: { vol: number | null; ret: number | null; sharpe: number | null } | null;
  chart?: ChartData; open?: string | null; thru?: string | null; exact?: boolean; cum?: boolean;
};
export type AltStats = { bench_irr: number | null; excess: number | null; bench_end: number | null; bench: number[] };
export type Entity = {
  label: string; kind: string; groupKind?: string; error?: string; flags?: string[]; type?: string; owner?: string;
  brokerage?: string; closed?: boolean; market?: boolean; history_incomplete?: string;
  excluded?: string[]; members?: string[];
  statement_value?: number; as_of?: string; stale?: string | boolean; unreconciled?: string | boolean;
  windows?: Record<string, Stats | null>; bm?: Record<string, Record<string, AltStats | null>>;
  estimated?: boolean[]; months?: string[] | null; values?: number[] | null; bench?: number[]; start?: string; note?: string;
};
export type RiskPoint = { label: string; kind: string; gk?: string; vol: number; ret: number; sharpe: number | null; exact?: boolean; estimated?: boolean; accounts?: number };
export type RiskWindow = { points: RiskPoint[]; left_off: [string, string, string, string][]; bm: Record<string, RiskPoint>; mkt?: RiskPoint | null };
export type DetailsData = DashboardData & {
  entities?: Entity[]; risk?: Record<string, RiskWindow>; asof?: string;
  estimatedPortfolioRisk?:Record<string,{point:RiskPoint|null;benchmarks:Record<string,RiskPoint>}>;
};

export function selectedStats(entity: Entity, period: PeriodKey, benchmark: string, defaultBenchmark: string): Stats | null {
  const key=period==='all'?'inception':period;
  const raw=entity.windows?.[key];
  const base=raw&&entity.unreconciled?{...raw,chart:undefined}:raw&&key==='inception'&&!raw.chart&&entity.months&&entity.values?{...raw,chart:{months:entity.months,values:entity.values,bench:entity.bench??[],estimated:entity.estimated}}:raw;
  if (!base) return null;
  if (benchmark === defaultBenchmark) return base;
  const alt = entity.bm?.[benchmark]?.[period === 'all' ? 'inception' : period];
  // Missing alternate figures remain unavailable; never reuse the default comparison.
  return alt ? { ...base, bench_irr: alt.bench_irr, excess: alt.excess, bench_end: alt.bench_end,
    chart: base.chart ? { ...base.chart, bench: alt.bench } : base.chart } :
    { ...base, bench_irr: null, excess: null, bench_end: null, chart: base.chart ? { ...base.chart, bench: [] } : base.chart };
}

export function selectedRisk(data: DetailsData, period: PeriodKey, benchmark: string): { accounts: RiskPoint[]; benchmark: RiskPoint | null; portfolio: RiskPoint | null; excluded: [string,string,string,string][] } {
  const r = data.risk?.[period === 'all' ? 'inception' : period];
  const total=(data.entities??[]).find(e=>e.kind==='group'&&e.groupKind==='all');
  const rawPortfolio=(r?.points??[]).find(p=>p.kind==='all');
  const estimate=data.estimatedPortfolioRisk?.[period==='all'?'inception':period];
  const portfolio=estimate?estimate.point:rawPortfolio?{...rawPortfolio,label:total?.excluded?.length?'Available accounts':'Your portfolio'}:null;
  const reference=estimate?(estimate.benchmarks[benchmark]??null):(r?.bm?.[benchmark]??(benchmark===data.benchmark?(r?.points??[]).find(p=>p.kind==='benchmark'&&p.label===benchmark)??null:null));
  return {portfolio,accounts:(r?.points??[]).filter(p=>p.kind==='account'),benchmark:reference,excluded:r?.left_off??[]};
}

export function latestValue(entity:Entity):number|null{
 return entity.statement_value??entity.windows?.inception?.value??null;
}
