// The page. All data stays in the browser: no network calls except loading the bundled demo prices.
import { compare } from "./calc.mjs";
import { $, el, svg, money, pct, spct, monthYear, revealOnScroll, saveMix } from "./util.mjs";
import { runResult, sampleConfig, defaultBenchmark, headline, excessLine, SAMPLES, sampleId } from "./result.mjs";
import { loadPrices } from "./data.mjs";
import { listPortfolios, renamePortfolio, deletePortfolio, clearEverything } from "./portfolios.mjs";
import { investmentChoices, createFundPicker, COMPANY_STOCKS } from "./fund-picker.mjs";
import { topEtfs, top5Window } from "./top-etfs.mjs";
import { decodeShare } from "./share.mjs"; // old share links still open; Try no longer makes new ones

const TIPS = {
  gain: "Ending value minus the money you put in, before taxes.",
  year: "How fast the investments grew each year, as if $1 had stayed in the whole time. Your deposits and timing don't flatter it. Needs 12 months of history.",
  ups: "How much the monthly returns swing, shown as a yearly figure (volatility). Higher means a bumpier ride.",
  fall: "The biggest drop from a previous high point, before it recovered (maximum drawdown).",
  sharpe: "Return above a safe cash rate (3-month Treasury bills) for each unit of ups and downs. Higher is better: below 0.5 is weak, around 1 is good, above 2 is rare. Needs 6 months of history; under a year it is noisy.",
  excess: "How much more (or less) a year than the benchmark.",
  ends: "What the money would be worth on the last date, before taxes.",
};
const tip = (label, key) => el("span", { class: "tip", tabindex: "0", "data-tip": TIPS[key], "aria-description": TIPS[key] }, label);

const state = { years: 5, data: null, labels: {}, demo: true, source: "", rows: [], presets: [], mixName: "Your portfolio", sample: "" };

async function load() {
  const p = await loadPrices();
  state.data = p.data; state.labels = p.labels; state.demo = p.demo; state.source = p.source;
  state.presets = p.presets;
  state.rows = p.demo ? [{ sym: "DEMOUS", w: 60 }, { sym: "DEMOBD", w: 30 }, { sym: "DEMOGD", w: 10 }]
    : state.presets.length ? rowsOf(state.presets[0]) : starter();
  state.mixName = state.presets.length && !p.demo ? state.presets[0].name : "Your portfolio";
  $("benchmark").value = defaultBenchmark(p.data.series);
  setup();
  const shared = decodeShare(location.search);
  if (shared) applyConfig({ ...shared, name: "Shared portfolio" }, { fromLink: true });
  else if (new URLSearchParams(location.search).has("sample")) loadSample(sampleId(new URLSearchParams(location.search).get("sample")));
  if (new URLSearchParams(location.search).has("own")) setTimeout(startTyping, 80); // "Check your own mix" from Home: open the mix editor
  renderSaved();
}

const symbols = () => Object.keys(state.data.series);
const choices = () => investmentChoices(symbols(), state.labels);
let firstFundPicker;
const rowsOf = (p) => Object.entries(p.weights).map(([sym, w]) => ({ sym, w }));
const starter = () => (["VTI", "BND"].every((x) => x in state.data.series) ? [{ sym: "VTI", w: 60 }, { sym: "BND", w: 40 }]
  : symbols().slice(0, 2).map((sym, i) => ({ sym, w: i ? 40 : 60 })));
function markCustom() { state.sample = ""; state.mixName = "Your portfolio"; $("preset").value = "custom"; }

function setup() {
  // Demo data and a visitor's own file get a banner; the built-in real prices get a small plain date line (issue 225).
  const note = state.demo ? "Demo data: invented funds, not real prices." : state.source ? "" : `Your file: ${symbols().length} funds.`;
  $("data-banner").textContent = note; $("data-banner").hidden = !note;
  $("data-date").textContent = state.source ? `${state.source} Month-end closes, completed months only. Cash rate: 3-month Treasury bills from FRED.` : "";
  drawSampleNote();
  drawPresetRow();
  const benchmarkPicker = createFundPicker({ id: "benchmark-choice", label: "Benchmark", symbol: $("benchmark").value, choices: choices(),
    onChange: (symbol) => { $("benchmark").value = symbol; render(); } });
  $("benchmark-picker").replaceChildren(benchmarkPicker.element);
  state.rows = state.rows.filter((r) => symbols().includes(r.sym));
  if (!state.rows.length) state.rows = [{ sym: symbols()[0], w: 100 }];
  const pre = $("preset");
  pre.replaceChildren(...state.presets.map((p, i) => el("option", { value: String(i) }, p.name)), el("option", { value: "custom" }, "Your own"));
  pre.value = state.mixName === "Your portfolio" ? "custom" : String(state.presets.findIndex((p) => p.name === state.mixName));
  pre.closest("label").hidden = !state.presets.length;
  renderRows();
  render();
}

function renderRows() {
  const box = $("rows");
  box.replaceChildren();
  state.rows.forEach((row, i) => {
    const picker = createFundPicker({ id: `fund-${i + 1}`, label: `Investment ${i + 1}`, symbol: row.sym, choices: choices(),
      onChange: (symbol) => { row.sym = symbol; markCustom(); render(); } });
    if (i === 0) firstFundPicker = picker;
    const w = el("input", { type: "number", min: "0", max: "100", step: "1", value: String(row.w), "aria-label": `Weight ${i + 1}, percent` });
    w.addEventListener("input", () => { row.w = Number(w.value); markCustom(); render(); });
    const rm = el("button", { type: "button", class: "rm", "aria-label": `Remove fund ${i + 1}` }, "×");
    rm.addEventListener("click", () => { state.rows.splice(i, 1); markCustom(); renderRows(); render(); });
    box.append(el("div", { class: "mix-row" }, picker.element, el("label", { class: "investment-weight" }, "Weight (%)", w), rm));
  });
}

function mixWeights() {
  const out = {};
  for (const r of state.rows) if (r.w > 0) out[r.sym] = (out[r.sym] || 0) + r.w;
  return out;
}


function render() {
  drawSampleNote();
  markPresetRow();
  $("try-own").hidden = !state.sample;
  const err = $("error");
  err.textContent = "";
  const total = state.rows.reduce((s, r) => s + (r.w > 0 ? r.w : 0), 0);
  $("weight-note").textContent = total === 100 ? "" : `Adds up to ${Math.round(total * 10) / 10}%, scaled to 100%.`;
  try {
    const initial = Number($("initial").value);
    const monthly = Number($("monthly").value) || 0;
    if (!(initial > 0)) throw new Error("Enter a starting amount above zero.");
    const res = runResult(state.data, { weights: mixWeights(), benchmark: $("benchmark").value.trim().toUpperCase(), initial, monthly, strategy: $("strategy").value, years: state.years });
    const { r, slice: data, others, mix, bench } = res;
    draw({ r, dates: data.dates, monthly, bench, limitedBy: data.limitedBy, years: state.years });
    drawOthers({ data, mix, others, initial, monthly, mixEnd: r.mix.m.endValue });
    drawSummary(headline(res, state.mixName));
    saveMix({ rows: state.rows, benchmark: bench, initial, monthly, strategy: $("strategy").value, years: state.years, name: state.mixName, sample: state.sample });
  } catch (e) {
    err.textContent = e.message;
    for (const id of ["verdict", "period-line", "chart-desc", "headline", "headline-sub"]) $(id).textContent = "";
    for (const id of ["cards", "chart", "legend", "benchmarks", "hl-stats"]) $(id).replaceChildren();
    $("next-step").hidden = true;
  }
}

// The first thing a visitor sees: one headline, return and Sharpe for both, one chart, then a next step.
const ratio = (x) => (x == null ? "n/a" : x.toFixed(2));
function drawSummary(h) {
  const a = h.mixAnnual, b = h.benchAnnual;
  $("hl-stats").replaceChildren(
    statPair("Return a year", a == null ? "n/a" : spct(a), b == null ? "n/a" : spct(b), h, "year"),
    statPair("Sharpe ratio", ratio(h.mixSharpe), ratio(h.benchSharpe), h, "sharpe"));
  if (a == null || b == null) {
    $("headline").textContent = `${h.name} ended at ${money(h.mixEnd)}; ${h.bench} at ${money(h.benchEnd)}.`;
    $("headline-sub").textContent = "A yearly rate needs 12 months of prices; open the details for the rest.";
  } else {
    const hl = $("headline");
    hl.textContent = `${h.name} vs ${h.bench}: `;
    hl.append(el("span", { class: "tip", tabindex: "0", "data-tip": TIPS.excess, "aria-description": TIPS.excess }, excessLine(a, b)));
    $("headline-sub").textContent = ""; // one line only: the headline; the chart's axis shows the dates (owner, 2026-11-27)
  }
  $("next-step").hidden = false; // one invitation after a result: "Want this for all your accounts?" (issue 239)
}
function statPair(label, mv, bv, h, key) {
  return el("div", { class: "hl-stat" }, el("span", { class: "k" }, tip(label, key)),
    el("span", { class: "v" }, el("b", { class: "m" }, mv), el("span", { class: "sep" }, " vs "), el("b", { class: "b" }, bv)));
}

function card(kind, title, m) {
  const rows = [
    ["Gain", (m.gain >= 0 ? "+" : "") + money(m.gain)],
    ["Per year", m.annualReturn == null ? "n/a" : spct(m.annualReturn)],
    ["Ups and downs", m.volatility == null ? "n/a" : pct(m.volatility)],
    ["Worst fall", pct(m.maxDrawdown)],
    ["Sharpe ratio", m.sharpe == null ? "n/a" : m.sharpe.toFixed(2)],
  ];
  const keys = ["gain", "year", "ups", "fall", "sharpe"];
  const dl = el("dl");
  rows.forEach(([k, v], i) => dl.append(el("dt", {}, tip(k, keys[i])), el("dd", {}, v)));
  return el("div", { class: `card ${kind}` }, el("h3", {}, title), el("div", { class: "hero" }, money(m.endValue)), dl);
}

function draw({ r, dates, monthly, bench, limitedBy, years }) {
  const { mix, bench: b } = r;
  $("period-line").textContent = `${monthYear(dates[0])} to ${monthYear(dates.at(-1))}.` +
    (limitedBy ? ` Starts when ${limitedBy} does.` : years < 99 && mix.m.months < years * 12 ? " That is all the history there is." : "") + ` Put in ${money(mix.m.putIn)}.` +
    (mix.m.sharpe != null && mix.m.months < 12 ? " Sharpe over less than a year is noisy." : "");
  const mixName = state.mixName, benchName = bench;
  $("cards").replaceChildren(card("mix", mixName, mix.m), card("bench", benchName, b.m));
  const diff = mix.m.endValue - b.m.endValue;
  $("verdict").textContent = diff === 0 ? "Same result."
    : `${mixName} finished ${money(Math.abs(diff))} ${diff > 0 ? "ahead of" : "behind"} ${bench}. Worst fall: ${pct(Math.abs(mix.m.maxDrawdown))} vs ${pct(Math.abs(b.m.maxDrawdown))}.`;
  drawChart({ dates, series: [{ name: mixName, key: "mix", color: "var(--mix)", v: mix.sim.values }, { name: benchName, key: "bench", color: "var(--bench)", v: b.sim.values }], put: monthly > 0 ? mix.sim.contributed : null });
}

// ---------- chart ----------
let lastChart = null;
const PL = 64, PR = 16, PT = 20, PB = 28;

function niceTicks(max) {
  const raw = max / 4, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => s >= raw);
  const out = [];
  for (let v = 0; ; v += step) { out.push(v); if (v >= max) break; }
  return out;
}

function drawOthers({ data, mix, others, initial, monthly, mixEnd }) {
  const box = $("benchmarks");
  if (others.length < 2) { box.replaceChildren(); return; }
  const rows = others.map((b) => {
    const m = compare({ prices: data.series, mix, benchmark: b, initial, monthly, strategy: $("strategy").value }).bench.m;
    const d = mixEnd - m.endValue;
    return el("tr", {}, el("td", {}, b), el("td", {}, money(m.endValue)), el("td", {}, m.annualReturn == null ? "n/a" : spct(m.annualReturn)), el("td", {}, (d >= 0 ? "+" : "-") + money(Math.abs(d))));
  });
  const head = el("tr", {}, ...["Benchmark", "Ends at", "Per year", `${state.mixName} vs it`].map((t, i) => el("th", { scope: "col" }, i === 1 ? tip(t, "ends") : i === 2 ? tip(t, "year") : t)));
  box.replaceChildren(el("h3", {}, "Other benchmarks"), el("table", {}, el("thead", {}, head), el("tbody", {}, ...rows)));
}

function drawChart({ dates, series, put }) {
  lastChart = { dates, series, put };
  const W = Math.max(300, Math.round($("chart").clientWidth || 760)), H = W < 520 ? 240 : 300; // drawn at real size so text stays readable
  const all = series.flatMap((s) => s.v).concat(put || []);
  const ticks = niceTicks(Math.max(...all) * 1.05);
  const top = ticks.at(-1), n = dates.length;
  const x = (i) => PL + (i / (n - 1)) * (W - PL - PR);
  const y = (v) => PT + (1 - v / top) * (H - PT - PB);
  const root = svg("svg", { viewBox: `0 0 ${W} ${H}`, "aria-hidden": "true", focusable: "false" });
  for (const t of ticks) {
    root.append(svg("line", { class: "grid", x1: PL, x2: W - PR, y1: y(t), y2: y(t) }));
    const lab = svg("text", { class: "axis-text", x: PL - 8, y: y(t) + 4, "text-anchor": "end" });
    lab.textContent = money(t);
    root.append(lab);
  }
  for (let i = 0; i < n; i += W < 520 ? 24 : 12) {
    const lab = svg("text", { class: "axis-text", x: x(i), y: H - 8, "text-anchor": i === 0 ? "start" : x(i) > W - PR - 40 ? "end" : "middle" });
    lab.textContent = monthYear(dates[i]);
    root.append(lab);
  }
  const path = (v) => v.map((val, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(val).toFixed(1)}`).join("");
  // a soft fill under the first line (the mix), drawn behind the lines
  const grad = svg("linearGradient", { id: "mix-fill", x1: 0, y1: 0, x2: 0, y2: 1 });
  grad.append(svg("stop", { offset: 0, "stop-color": series[0].color, "stop-opacity": 0.22 }), svg("stop", { offset: 1, "stop-color": series[0].color, "stop-opacity": 0 }));
  const defs = svg("defs"); defs.append(grad);
  root.append(defs, svg("path", { d: `${path(series[0].v)}L${x(n - 1).toFixed(1)},${y(0).toFixed(1)}L${x(0).toFixed(1)},${y(0).toFixed(1)}Z`, fill: "url(#mix-fill)" }));
  if (put) root.append(svg("path", { d: path(put), fill: "none", stroke: "var(--put)", "stroke-width": 2, "stroke-dasharray": "5 4" }));
  for (const s of [...series].reverse()) root.append(svg("path", { d: path(s.v), fill: "none", stroke: s.color, "stroke-width": s === series[0] ? 3 : 2.25, "stroke-linejoin": "round", "stroke-linecap": "round" }));
  // direct end labels (selective): the final value of each line
  const ends = series.map((s) => ({ s, yy: y(s.v.at(-1)) })).sort((a, b) => a.yy - b.yy);
  if (ends.length === 2 && ends[1].yy - ends[0].yy < 14) ends[1].yy = ends[0].yy + 14;
  for (const { s, yy } of W < 520 ? [] : ends) { // narrow screens: the cards already show these
    const t = svg("text", { x: W - PR - 4, y: yy - 6, "text-anchor": "end", "font-size": 12, "font-weight": 600, fill: "var(--ink)" });
    t.textContent = money(s.v.at(-1));
    root.append(t);
  }
  const cross = svg("line", { y1: PT, y2: H - PB, stroke: "var(--ink-2)", "stroke-width": 1, visibility: "hidden" });
  const dots = series.map((s) => svg("circle", { r: 5, fill: s.color, stroke: "var(--surface)", "stroke-width": 2, visibility: "hidden" }));
  root.append(cross, ...dots);
  const tip = el("div", { class: "tooltip", hidden: "" });
  const chart = $("chart");
  chart.replaceChildren(root, tip);

  let idx = n - 1;
  const show = (i) => {
    idx = Math.max(0, Math.min(n - 1, i));
    const px = x(idx);
    cross.setAttribute("x1", px); cross.setAttribute("x2", px); cross.setAttribute("visibility", "visible");
    series.forEach((s, k) => { dots[k].setAttribute("cx", px); dots[k].setAttribute("cy", y(s.v[idx])); dots[k].setAttribute("visibility", "visible"); });
    tip.replaceChildren(el("b", {}, monthYear(dates[idx])),
      ...series.map((s) => el("div", {}, el("span", { class: "k", style: `background:${s.color}` }), `${s.name}: ${money(s.v[idx])}`)),
      ...(put ? [el("div", {}, el("span", { class: "k", style: "background:var(--put)" }), `What you put in: ${money(put[idx])}`)] : []));
    tip.hidden = false;
    const box = chart.getBoundingClientRect(), scale = box.width / W; // 1 unless the page was resized since the draw
    const left = px * scale + 12;
    tip.style.left = (left + tip.offsetWidth > box.width ? px * scale - tip.offsetWidth - 12 : left) + "px";
    tip.style.top = Math.round(box.width * (H / W) * 0.55) + "px"; // lower part of the plot: the lines stay visible
  };
  const hide = () => { cross.setAttribute("visibility", "hidden"); dots.forEach((d) => d.setAttribute("visibility", "hidden")); tip.hidden = true; };
  chart.onpointermove = (e) => { const b = chart.getBoundingClientRect(); show(Math.round(((e.clientX - b.left) / b.width * W - PL) / (W - PL - PR) * (n - 1))); };
  chart.onpointerleave = hide;
  chart.onfocus = () => show(idx);
  chart.onblur = hide;
  chart.onkeydown = (e) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, PageDown: -12, PageUp: 12 }[e.key];
    if (e.key === "Home") { e.preventDefault(); show(0); } else if (e.key === "End") { e.preventDefault(); show(n - 1); }
    else if (step) { e.preventDefault(); show(idx + step); }
  };

  $("legend").replaceChildren(
    ...series.map((s) => el("span", {}, el("i", { style: `background:${s.color}` }), s.name)),
    ...(put ? [el("span", {}, el("i", { style: "background:var(--put)" }), "What you put in")] : []));
  const a = series[0], b = series[1];
  $("chart-desc").textContent = `${state.mixName} goes from ${money(a.v[0])} to ${money(a.v.at(-1))}; the benchmark from ${money(b.v[0])} to ${money(b.v.at(-1))}. Arrow keys step through months.`;
}

// ---------- sample portfolios ----------
// Invented people with invented deposits; the prices are the real bundled ones (or the demo set when running on demo data).
function drawSampleNote() {
  const note = $("sample-note"), S = SAMPLES[state.sample];
  note.hidden = !S && state.sample !== "top5";
  if (state.sample === "top5") {
    const { candidates } = topEtfs(state.data, COMPANY_STOCKS);
    note.replaceChildren(el("p", {}, el("b", {}, `${state.mixName}.`),
      ` Picked with hindsight from our list of ${candidates} funds. Past winners often don't repeat.`));
    return;
  }
  if (!S) return;
  const head = el("p", {}, el("b", {}, `${S.name}.`), ` ${S.who}: ${money(S.initial)} to start, then ${money(S.monthly)} a month.`);
  const parts = [head];
  if (S.accounts) parts.push(el("ul", { class: "sample-accts" }, ...S.accounts.map((a) =>
    el("li", {}, el("b", {}, a.label), ` ${money(a.start)} · ${a.funds}`))),
    el("p", { class: "muted small" }, "The three accounts are added up into one portfolio."));
  note.replaceChildren(...parts);
}
function loadSample(id = "household") {
  const c = sampleConfig(state.data, id);
  if (!c) { $("error").textContent = "The sample is unavailable with these prices."; return; }
  state.rows = rowsOf(c); state.mixName = c.name; state.sample = c.sample;
  $("initial").value = c.initial; $("monthly").value = c.monthly; $("strategy").value = c.strategy; $("benchmark").value = c.benchmark;
  state.years = c.years;
  document.querySelectorAll(".seg button").forEach((o) => o.setAttribute("aria-pressed", String(Number(o.dataset.years) === c.years)));
  setup();
  $("preset").value = "custom";
}

// The top 5 follows the chosen horizon: ranked over the same window the result shows, and named for it.
function loadTop5(years = state.sample === "top5" ? state.years : 5) {
  const { months, name } = top5Window(state.data, years);
  const { picks } = topEtfs(state.data, COMPANY_STOCKS, 5, months);
  if (picks.length < 5) { $("error").textContent = "The top 5 needs five funds with prices for the whole period."; return; }
  state.rows = picks.map((p) => ({ sym: p.sym, w: 20 })); state.mixName = name; state.sample = "top5";
  state.years = years;
  document.querySelectorAll(".seg button").forEach((o) => o.setAttribute("aria-pressed", String(Number(o.dataset.years) === years)));
  setup();
  $("preset").value = "custom";
}

// ---------- the row of portfolio choices above the result ----------
const PICKS = [["sample", "Sample household", () => loadSample("household")], ["student", "Sample student", () => loadSample("student")],
  ["top5", "Top 5 ETFs", () => loadTop5(5)], ["own", "Your own", startTyping]];
function drawPresetRow() {
  const row = $("preset-row");
  const mk = (key, label, fn) => { const b = el("button", { type: "button", class: "secondary", "data-pick": key, "aria-pressed": "false" }, label); b.addEventListener("click", fn); return b; };
  row.replaceChildren(
    ...state.presets.map((p, i) => mk("preset" + i, p.name, () => { $("preset").value = String(i); $("preset").dispatchEvent(new Event("change")); })),
    ...PICKS.map(([k, l, f]) => mk(k, l, f)));
  markPresetRow();
}
function markPresetRow() {
  const cur = state.sample === "household" ? "sample" : state.sample === "student" ? "student" : state.sample === "top5" ? "top5"
    : state.presets.some((p) => p.name === state.mixName) ? "preset" + state.presets.findIndex((p) => p.name === state.mixName) : "own";
  document.querySelectorAll("#preset-row button").forEach((b) => {
    const on = b.dataset.pick === cur;
    b.setAttribute("aria-pressed", String(on));
    if (on) { const row = b.parentElement; row.scrollLeft = Math.max(0, b.offsetLeft - (row.clientWidth - b.offsetWidth) / 2 - row.offsetLeft); }
  });
}

// ---------- apply a saved mix or a shared link ----------
function applyConfig(c, { fromLink = false } = {}) {
  const have = symbols();
  const rows = Object.entries(c.weights).filter(([sym]) => have.includes(sym)).map(([sym, w]) => ({ sym, w }));
  const missing = Object.keys(c.weights).filter((x) => !have.includes(x));
  if (!rows.length) { $("error").textContent = "None of those funds have prices in the current data."; return; }
  state.rows = rows; state.mixName = c.name || "Your portfolio"; state.sample = "";
  if (c.benchmark && have.includes(c.benchmark)) $("benchmark").value = c.benchmark;
  if (c.strategy) $("strategy").value = c.strategy;
  if (c.initial > 0) $("initial").value = c.initial;
  if (c.monthly != null && !fromLink) $("monthly").value = c.monthly;
  if (fromLink) { $("initial").value = 10000; $("monthly").value = 0; }
  if (c.years) state.years = c.years;
  document.querySelectorAll(".seg button").forEach((o) => o.setAttribute("aria-pressed", String(Number(o.dataset.years) === state.years)));
  setup();
  $("preset").value = "custom";
  $("link-note").hidden = !fromLink;
  if (missing.length) $("error").textContent = `No prices for ${missing.join(", ")}; left out.`;
}

// ---------- save / my portfolios (this browser only) ----------
const store = () => { try { return localStorage; } catch { return null; } };
function renderSaved() {
  const st = store(), list = $("saved-list");
  const items = st ? listPortfolios(st) : [];
  $("saved-empty").hidden = items.length > 0;
  list.replaceChildren(...items.map((p) => {
    const open = el("button", { type: "button", class: "secondary" }, "Open");
    open.addEventListener("click", () => { applyConfig(p); $("save-status").textContent = `Opened “${p.name}”.`; });
    const ren = el("button", { type: "button", class: "secondary", "aria-label": `Rename ${p.name}` }, "Rename");
    ren.addEventListener("click", () => { const n = prompt("Name for this portfolio", p.name); if (n) { renamePortfolio(st, p.id, n); renderSaved(); } });
    const del = el("button", { type: "button", class: "secondary", "aria-label": `Delete ${p.name}` }, "Delete");
    del.addEventListener("click", () => { deletePortfolio(st, p.id); renderSaved(); });
    const n = Object.keys(p.weights).length;
    return el("li", {}, el("div", {}, el("div", { class: "nm" }, p.name), el("div", { class: "sub" }, `${n} fund${n === 1 ? "" : "s"} vs ${p.benchmark || "n/a"}, ${p.years >= 99 ? "all history" : p.years + "y"}`)), el("div", { class: "acts" }, open, ren, del));
  }));
}
$("clear-all").addEventListener("click", () => {
  if (!confirm("Remove every saved portfolio and setting from this device? This can't be undone.")) return;
  let n = 0;
  try { n = clearEverything(localStorage, sessionStorage).length; } catch { /* storage blocked: nothing saved */ }
  renderSaved();
  $("save-status").textContent = n ? "Cleared everything saved on this device." : "Nothing was saved on this device.";
});

// ---------- "Check your own mix" (Home's button, ?own=1): open the mix editor on the first fund ----------
function startTyping() {
  const d = $("settings"); d.open = true;
  d.scrollIntoView({ behavior: "smooth", block: "start" });
  firstFundPicker?.focus();
}

$("try-own-button").addEventListener("click", startTyping);
// Free has no import handlers. Until paid Plus access exists, imports are unavailable.
// Prevent dropped files from navigating away; never read their contents.
for (const type of ["dragover", "drop"]) {
  document.addEventListener(type, (event) => {
    if (Array.from(event.dataTransfer?.types || []).includes("Files")) event.preventDefault();
  });
}

// ---------- events ----------
let resizeTimer = null, lastWidth = 0;
new ResizeObserver(() => {
  const w = $("chart").clientWidth;
  if (!lastChart || !w || w === lastWidth) return;
  lastWidth = w;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => drawChart(lastChart), 100);
}).observe($("chart"));
$("preset").addEventListener("change", () => {
  const p = state.presets[Number($("preset").value)];
  state.rows = p ? rowsOf(p) : starter();
  state.sample = "";
  state.mixName = p ? p.name : "Your portfolio";
  renderRows(); render();
});
$("add-row").addEventListener("click", () => {
  const used = new Set(state.rows.map((r) => r.sym));
  state.rows.push({ sym: symbols().find((s) => !used.has(s)) || symbols()[0], w: 10 });
  markCustom(); renderRows(); render();
});
for (const id of ["benchmark", "strategy", "initial", "monthly"]) $(id).addEventListener("input", render);
document.querySelectorAll(".seg button").forEach((b) => b.addEventListener("click", () => {
  state.years = Number(b.dataset.years);
  document.querySelectorAll(".seg button").forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
  if (state.sample === "top5") { loadTop5(state.years); return; } // re-rank for the new horizon so the name and picks match it
  render();
}));

revealOnScroll();
load().catch((e) => { $("error").textContent = "Could not load prices: " + e.message; });
