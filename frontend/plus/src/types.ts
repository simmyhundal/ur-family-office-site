export type Benchmark = {
  value: number | null;
  irr: number | null;
  note: string;
  values?: number[];
};

export type Sources = {opening:number;deposits:number;withdrawals:number;gain:number;value:number};

export type OverviewWindow = {
  sources?: Sources;
  start: string; end: string; annualized: boolean; irr: number | null; value: number;
  months: string[]; values: number[]; estimated: boolean[];
  benchmarks: Record<string, Benchmark>;
};

export type DashboardData = {
  pendingAccounts?: string[];
  schema_version: 1;
  benchmark: string;
  benchmarks: [string, string][];
  windows: [string, string][];
  overview: {
    windows?: Record<string, OverviewWindow>;
    value: number;
    irr: number | null;
    accounts: number;
    as_of: string;
    months: string[];
    values: number[];
    estimated: boolean[];
    missing: string[];
    statements: { label: string; as_of: string }[];
    benchmarks: Record<string, Benchmark>;
  } | null;
};

export type PeriodKey = 'ytd' | '1y' | '3y' | '5y' | 'all' | string;
