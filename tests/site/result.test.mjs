// The completed-month cutoff and the shared result that Home, Try and the lesson all use. Every number is invented,
// except the bundled demo prices, which are invented funds.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { completedMonths, throughLabel, compare, sliceFor } from "../../site/js/calc.mjs";
import { runResult, sampleConfig, previewModel, headline, defaultBenchmark, OTHER, SAMPLE, SAMPLES, sampleId, heroAnswer } from "../../site/js/result.mjs";
import { loadPrices } from "../../site/js/data.mjs";
import { soWhat, sharpeBand, lessonModel } from "../../site/js/lesson.mjs";

const demoFile = JSON.parse(readFileSync(new URL("../../site/data/demo-prices.json", import.meta.url), "utf8"));
const demo = { dates: demoFile.dates, series: demoFile.series, rf: demoFile.rf ?? null };

// ---------- completed months only ----------
test("cutoff: a month counts once it has ended; the current month is dropped", () => {
  const d = { dates: ["2026-09-30", "2026-10-30", "2026-11-12"], series: { A: [1, 2, 3], B: [4, 5, 6] }, rf: [4, 4.1, 4.2] };
  const c = completedMonths(d, "2026-11-13");
  assert.deepEqual(c.dates, ["2026-09-30", "2026-10-30"]);
  assert.deepEqual(c.series, { A: [1, 2], B: [4, 5] });
  assert.deepEqual(c.rf, [4, 4.1]); assert.equal(c.rf.length, c.dates.length);
  assert.equal(throughLabel(c.dates.at(-1)), "Oct 2026");
});
test("cutoff: on the first of a month the previous month is complete", () => {
  const d = { dates: ["2026-10-30", "2026-11-28"], series: { A: [1, 2] }, rf: 4 };
  assert.deepEqual(completedMonths(d, "2026-11-30").dates, ["2026-10-30"]);
  assert.deepEqual(completedMonths(d, "2026-12-01").dates, ["2026-10-30", "2026-11-28"]);
  assert.equal(completedMonths(d, "2026-11-30").rf, 4, "a flat rate is kept as is");
});
test("cutoff: data that already ends on a past month is unchanged (the demo set)", () => {
  assert.equal(completedMonths(demo, "2026-11-13"), demo);
  assert.equal(demo.dates.at(-1).slice(0, 7) < "2026-11", true);
});
test("cutoff is applied when prices load, with a 'through' label from the last kept month", async () => {
  const dates = ["2026-08-31", "2026-09-30", "2026-10-30", "2026-11-12"];
  globalThis.UFO_DATA = { asOf: "2026-11-12", dates, series: { SPY: [1, 1.01, 1.02, 1.03] }, rf: [4, 4, 4, 4] };
  globalThis.UFO_PRESETS = [];
  try {
    const p = await loadPrices("2026-11-13");
    assert.deepEqual(p.data.dates, dates.slice(0, 3)); assert.equal(p.data.rf.length, 3);
    assert.equal(p.through, "Oct 2026"); assert.equal(p.source, "Prices through Oct 2026.");
    assert.ok(!p.source.includes("11-12"));
  } finally { delete globalThis.UFO_DATA; delete globalThis.UFO_PRESETS; }
});

// ---------- the Home preview matches Try ----------
test("Home preview is the sample run exactly as Try runs it (demo prices)", () => {
  const cfg = sampleConfig(demo);
  assert.deepEqual(cfg.weights, SAMPLE.demo.weights); assert.equal(cfg.benchmark, defaultBenchmark(demo.series));
  assert.equal(cfg.initial, SAMPLE.initial); assert.equal(cfg.monthly, SAMPLE.monthly); assert.equal(cfg.years, 5);
  const home = previewModel(demo);
  const tryRes = runResult(demo, cfg), tryHead = headline(tryRes, cfg.name);
  for (const k of ["mixAnnual", "benchAnnual", "mixSharpe", "benchSharpe", "diff", "from", "to", "name", "bench"]) assert.equal(home[k], tryHead[k], k);
  // and both equal an independent compare() over the last five years
  const s = sliceFor(demo, [...Object.keys(cfg.weights), cfg.benchmark], 5);
  const r = compare({ prices: s.series, mix: cfg.weights, benchmark: cfg.benchmark, initial: cfg.initial, monthly: cfg.monthly, rf: s.rf });
  assert.equal(home.mixAnnual, r.mix.m.annualReturn); assert.equal(home.benchSharpe, r.bench.m.sharpe);
  assert.equal(home.months, 60);
});
test("Home and Try share the window: a late-starting 'other' benchmark moves both the same way", () => {
  const n = 30, dates = Array.from({ length: n }, (_, i) => `20${String(20 + Math.floor((i + 1) / 12)).padStart(2, "0")}-${String(((i + 1) % 12) + 1).padStart(2, "0")}-28`);
  const up = (g) => Array.from({ length: n }, (_, i) => 100 * (1 + g) ** i * (1 + 0.02 * Math.sin(i)));
  const series = { VTI: up(0.008), VOO: up(0.0075), VXUS: up(0.004), BND: up(0.002), QQQ: up(0.01), SPY: up(0.007), IWM: [...Array(6).fill(null), ...up(0.006).slice(6)] };
  const data = { dates, series, rf: 2 };
  const home = previewModel(data), tryRes = runResult(data, sampleConfig(data));
  assert.equal(tryRes.slice.dates[0], dates[6], "IWM starts later, so the shared window starts with it");
  assert.equal(home.from, tryRes.slice.dates[0]);
  assert.equal(home.mixAnnual, tryRes.r.mix.m.annualReturn);
  assert.deepEqual(OTHER.filter((x) => x in series), ["SPY", "VTI", "QQQ", "IWM"]);
});
test("the lesson's first card shows the same two Sharpe ratios as Try", () => {
  const cfg = sampleConfig(demo), res = runResult(demo, cfg);
  const m = lessonModel({ r: res.r, data: res.slice });
  assert.ok(m.sM != null && m.sB != null);
  assert.ok(Math.abs(m.sM - res.r.mix.m.sharpe) < 1e-12 && Math.abs(m.sB - res.r.bench.m.sharpe) < 1e-12);
});

// ---------- the samples ----------
test("the household sample's mix is its three accounts added up by value", () => {
  const H = SAMPLES.household, total = H.accounts.reduce((t, a) => t + a.start, 0);
  assert.equal(total, H.initial);
  const sum = {};
  for (const a of H.accounts) for (const [k, w] of Object.entries(a.weights)) sum[k] = (sum[k] || 0) + (a.start * w) / total;
  assert.deepEqual(Object.keys(sum).sort(), Object.keys(H.real.weights).sort());
  for (const k in sum) assert.ok(Math.abs(sum[k] - H.real.weights[k]) < 1e-9, k);
  assert.deepEqual(H.accounts.map((a) => a.label), ["401(k)", "IRA", "Brokerage"]);
  for (const S of Object.values(SAMPLES)) {
    assert.equal(Object.values(S.real.weights).reduce((a, b) => a + b, 0), 100, S.id);
    assert.equal(Object.values(S.demo.weights).reduce((a, b) => a + b, 0), 100, S.id);
    assert.match(S.name, /^Sample /); assert.ok(!/MBA/.test(S.name + S.who));
  }
});
test("?sample= picks a sample: 1 and household give the household, student the student, junk the default", () => {
  assert.equal(SAMPLE.id, "household");
  assert.equal(sampleId("1"), "household"); assert.equal(sampleId("household"), "household");
  assert.equal(sampleId("student"), "student"); assert.equal(sampleId("__proto__"), "household"); assert.equal(sampleId(null), "household");
  const st = sampleConfig(demo, "student");
  assert.deepEqual(st.weights, SAMPLES.student.demo.weights); assert.equal(st.initial, 2000); assert.equal(st.name, "Sample student");
});

// ---------- the Home hero: question first, then the honest answer (issue 181) ----------
test("hero answer reads well ahead, behind and level, and never hides the gap", () => {
  const base = { bench: "SPY", mixAnnual: 0.095, benchAnnual: 0.12 };
  const behind = heroAnswer({ ...base, diff: -25483.4 }, 5);
  assert.equal(behind.question, "Did this household keep up with SPY?");
  assert.equal(behind.answer, "Not quite."); assert.equal(behind.tone, "behind");
  assert.equal(behind.rates, "+9.5% vs +12.0% a year"); assert.equal(behind.gap, "Behind by $25,483 after 5 years.");
  const ahead = heroAnswer({ ...base, mixAnnual: 0.13, diff: 1200 }, 5);
  assert.equal(ahead.answer, "Yes."); assert.equal(ahead.gap, "Ahead by $1,200 after 5 years.");
  const even = heroAnswer({ ...base, diff: 0 }, 5);
  assert.equal(even.answer, "Neck and neck."); assert.equal(even.gap, "The same money after 5 years.");
  for (const a of [behind, ahead, even]) { assert.equal(a.hook, "Would yours?"); assert.ok(!/should|buy|sell/i.test(Object.values(a).join(" "))); }
});
test("the Home hero leads with the question, not a loss", async () => {
  const { readFile } = await import("node:fs/promises");
  const home = await readFile(new URL("../../site/index.html", import.meta.url), "utf8");
  const hero = home.match(/<section class="home-hero[\s\S]*?<\/section>/)[0];
  assert.match(hero, /<h1>Is your portfolio <span class="grad-text">keeping up\?<\/span><\/h1>/);
  assert.ok(hero.indexOf('id="pv-q"') < hero.indexOf('id="pv-headline"'), "question before the answer");
  assert.match(hero, /401\(k\), IRA or brokerage/);
  assert.match(hero, /Would yours\?/);
});

// ---------- "So what?" ----------
test("So what compares the two ratios in one sentence", () => {
  assert.equal(soWhat("Mix", "SPY", 0.42, 0.57), "SPY earned more for every unit of bumpiness than Mix: 0.57 against 0.42.");
  assert.match(soWhat("Mix", "SPY", 0.8, 0.5), /^Mix earned more/);
  assert.match(soWhat("Mix", "SPY", null, 0.5), /cash rate/);
  assert.deepEqual([0.2, 0.7, 1.2, 2].map(sharpeBand), [0, 1, 2, 3]);
});
