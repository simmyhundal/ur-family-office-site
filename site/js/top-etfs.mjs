// "Top 5 ETFs, last 5 years": rank the site's own funds by total return over the last 60 completed months.
// Pure: no DOM, no network. Hindsight by construction; the page says so.
export const TOP_MONTHS = 60;

/** data: {dates, series} (completed months). stocks: symbols to leave out (single companies, not ETFs).
 *  -> { picks: [{sym, ret}] best first, candidates: number of ETFs considered }. */
export function topEtfs(data, stocks = new Set(), n = 5, months = TOP_MONTHS) {
  const last = data.dates.length - 1, first = last - months;
  const syms = Object.keys(data.series).filter((s) => !stocks.has(s));
  const ranked = [];
  if (first >= 0) for (const sym of syms) {
    const a = data.series[sym][first], b = data.series[sym][last];
    const full = data.series[sym].slice(first, last + 1).every((v) => v != null && v > 0);
    if (full) ranked.push({ sym, ret: b / a - 1 });
  }
  ranked.sort((x, y) => y.ret - x.ret || (x.sym < y.sym ? -1 : 1));
  return { picks: ranked.slice(0, n), candidates: syms.length };
}

/** The ranking window for a horizon button (1, 3, 5, 10 years, or 99 = Max: all completed months),
 *  and the portfolio's name for it, so the name never disagrees with the window shown. */
export function top5Window(data, years) {
  const all = data.dates.length - 1;
  if (years >= 99 || years * 12 > all) {
    const from = String(data.dates[0]).slice(0, 4);
    return { months: all, name: `Top 5 ETFs since ${from}` };
  }
  return { months: years * 12, name: `Top 5 ETFs, last ${years} year${years === 1 ? "" : "s"}` };
}
