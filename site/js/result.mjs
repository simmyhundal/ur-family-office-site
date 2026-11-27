// One result, computed the same way on every page (Home preview, Try, the Sharpe lesson). Pure: no DOM, no network.
import { compare, sliceFor, normalizeWeights } from "./calc.mjs";
import { spct, money } from "./util.mjs";

export const OTHER = ["SPY", "VTI", "QQQ", "IWM", "AGG"]; // Try's "other benchmarks" table; they also set the shared window
// The invented samples. The prices are real (bundled); the people are not.
// household (the default: Home hero, ?sample=1): an everyday couple's 401(k), IRA and brokerage account, added up into one mix.
// student (?sample=student): a small monthly investor, used by the instructor session plan.
export const SAMPLES = {
  household: {
    id: "household", name: "Sample household",
    who: "An invented couple with three accounts",
    // Each account's starting value and funds. The mix below is these added up by value (a test checks it);
    // monthly deposits are split by that combined mix.
    accounts: [
      { label: "401(k)", start: 60000, funds: "Target-date style: US stocks, international stocks, bonds", weights: { VTI: 50, VXUS: 25, BND: 25 } },
      { label: "IRA", start: 25000, funds: "An S&P 500 index fund", weights: { VOO: 100 } },
      { label: "Brokerage", start: 15000, funds: "US total market and Nasdaq-100", weights: { VTI: 60, QQQ: 40 } },
    ],
    real: { weights: { VTI: 39, VOO: 25, VXUS: 15, BND: 15, QQQ: 6 } },
    demo: { weights: { DEMOUS: 70, DEMOBD: 20, DEMOGD: 10 } },
    initial: 100000, monthly: 1500, years: 5,
  },
  student: {
    id: "student", name: "Sample student",
    who: "An invented student",
    real: { weights: { VTI: 50, VXUS: 20, BND: 20, QQQ: 10 } },
    demo: { weights: { DEMOUS: 60, DEMOBD: 30, DEMOGD: 10 } },
    initial: 2000, monthly: 500, years: 5,
  },
};
export const SAMPLE = SAMPLES.household; // the default sample
/** "1", "household", "student" (from ?sample=) -> a sample id; anything else gives the default. */
export const sampleId = (v) => (typeof v === "string" && Object.hasOwn(SAMPLES, v) ? v : SAMPLE.id);

export const defaultBenchmark = (series) => ("SPY" in series ? "SPY" : Object.keys(series)[0]);

/** A sample as a full configuration for these prices (real funds when they are there, else the demo funds). */
export function sampleConfig(data, id = SAMPLE.id) {
  const S = SAMPLES[sampleId(id)];
  const has = (x) => x in data.series;
  const pick = Object.keys(S.real.weights).every(has) ? S.real : S.demo;
  if (!Object.keys(pick.weights).every(has)) return null;
  return { weights: { ...pick.weights }, benchmark: defaultBenchmark(data.series), initial: S.initial, monthly: S.monthly,
    strategy: "hold", years: S.years, name: S.name, sample: S.id };
}

/** Mix vs benchmark over the window Try uses: from the latest start among the mix, the benchmark and the other benchmarks. */
export function runResult(data, cfg) {
  const mix = cfg.weights, bench = cfg.benchmark;
  normalizeWeights(mix);
  const unknown = [...Object.keys(mix), bench].filter((x) => !(x in data.series));
  if (unknown.length) throw new Error(`No prices for ${unknown.join(", ")}. Pick from the list, or use your own CSV.`);
  const others = OTHER.filter((x) => x in data.series);
  const needed = [...new Set([...Object.keys(mix), bench, ...others])];
  const slice = sliceFor(data, needed, cfg.years);
  if (slice.dates.length < 3) throw new Error("Not enough months of prices to compare.");
  const r = compare({ prices: slice.series, mix, benchmark: bench, initial: cfg.initial, monthly: cfg.monthly || 0, strategy: cfg.strategy || "hold", rf: slice.rf });
  return { r, slice, others, mix, bench };
}

/** The headline numbers a result screen shows (Home preview and Try read the same object). */
export function headline({ r, slice, bench }, name) {
  const m = r.mix.m, b = r.bench.m;
  return { name, bench, mixAnnual: m.annualReturn, benchAnnual: b.annualReturn, mixSharpe: m.sharpe, benchSharpe: b.sharpe,
    diff: m.endValue - b.endValue, mixEnd: m.endValue, benchEnd: b.endValue, putIn: m.putIn,
    from: slice.dates[0], to: slice.dates.at(-1), months: m.months };
}

/** Try's headline figure: the signed yearly excess, e.g. "+10.0% a year" or "−1.1% a year" (a true minus sign). */
export function excessLine(mixAnnual, benchAnnual) {
  // From the two rounded figures the tiles show, so the headline always matches what people see.
  const r = (x) => Math.round(x * 1000) / 10;
  const d = Math.round((r(mixAnnual) - r(benchAnnual)) * 10) / 10;
  return d === 0 ? "the same each year" : `${Math.abs(d).toFixed(1)}% ${d > 0 ? "more" : "less"} a year`;
}
/** "more", "less" or "same": colours the headline figure (green, red, plain), from the same rounded figures. */
export function excessTone(mixAnnual, benchAnnual) {
  const r = (x) => Math.round(x * 1000) / 10;
  const d = Math.round((r(mixAnnual) - r(benchAnnual)) * 10) / 10;
  return d > 0 ? "more" : d < 0 ? "less" : "same";
}

/** The Home hero card leads with the question, then the honest answer, whichever way the prices go (issue 181).
 *  `h` is a previewModel (or headline) result; the answer is never a recommendation. */
export function heroAnswer(h, years) {
  const tone = h.diff > 0 ? "ahead" : h.diff < 0 ? "behind" : "even";
  const span = years ? ` after ${years} years` : "";
  return {
    tone,
    question: `Did this household keep up with ${h.bench === "SPY" ? "the S&P 500" : h.bench}?`, // SPY tracks the S&P 500
    answer: { ahead: "This one is.", behind: "This one isn't.", even: "Neck and neck." }[tone], // answers the Home headline "Is your portfolio keeping up?"
    rates: `${spct(h.mixAnnual)} vs ${spct(h.benchAnnual)} a year`,
    gap: tone === "even" ? `The same money${span}.` : `${tone === "ahead" ? "Ahead" : "Behind"} by ${money(Math.abs(h.diff))}${span}.`,
    hook: "Would yours?",
  };
}

/** The Home page preview: the sample, run exactly as Try runs it, plus the value series for the small chart. */
export function previewModel(data, id = SAMPLE.id) {
  const cfg = sampleConfig(data, id);
  if (!cfg) return null;
  const res = runResult(data, cfg);
  return { ...headline(res, cfg.name), years: cfg.years,
    mixValues: res.r.mix.sim.values, benchValues: res.r.bench.sim.values, putValues: res.r.mix.sim.contributed };
}

/** SVG path data for value series in a W x H box (shared y scale, 6% headroom). */
export function linePaths(seriesList, W, H, pad = 6) {
  const all = seriesList.flat(), top = Math.max(...all) * 1.06, n = seriesList[0].length;
  const x = (i) => (i / (n - 1)) * W, y = (v) => H - pad - (v / top) * (H - 2 * pad);
  return seriesList.map((v) => v.map((val, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(val).toFixed(1)}`).join(""));
}
