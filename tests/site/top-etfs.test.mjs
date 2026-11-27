import test from "node:test";
import assert from "node:assert/strict";
import { topEtfs, top5Window } from "../../site/js/top-etfs.mjs";

const dates = Array.from({ length: 62 }, (_, i) => `d${i}`);
const ramp = (g) => dates.map((_, i) => 100 * (1 + g) ** i);
const data = { dates, series: {
  A: ramp(0.010), B: ramp(0.020), C: ramp(0.015), D: ramp(0.005), E: ramp(0.012), F: ramp(0.018), G: ramp(0.001),
  STK: ramp(0.05),                                   // a company stock: left out
  YOUNG: dates.map((_, i) => (i < 10 ? null : 100 * 1.03 ** i)), // under 60 months of data: left out
  GAP: ramp(0.04).map((v, i) => (i === 30 ? null : v)),        // missing month: left out
} };

test("top 5 by 60-month total return, best first, equal inputs for the page", () => {
  const { picks } = topEtfs(data, new Set(["STK"]));
  assert.deepEqual(picks.map((p) => p.sym), ["B", "F", "C", "E", "A"]);
  assert.ok(Math.abs(picks[0].ret - (1.02 ** 60 - 1)) < 1e-9);
});
test("candidates counts ETFs only (stocks out, short history still counted as listed)", () => {
  assert.equal(topEtfs(data, new Set(["STK"])).candidates, 9);
});
test("uses the last 60 completed months, not all history", () => {
  const d = { dates, series: { X: dates.map((_, i) => (i === 0 ? 1 : i === 1 ? 1000 : 1000 + i)), Y: ramp(0.01) } };
  assert.equal(topEtfs(d, new Set(), 1).picks[0].sym, "Y");
});
test("too little history gives no picks", () => {
  assert.deepEqual(topEtfs({ dates: dates.slice(0, 30), series: { A: ramp(0.01).slice(0, 30) } }).picks, []);
});

test("top 5 window follows the horizon, and its name says which", () => {
  const d = { dates: Array.from({ length: 133 }, (_, i) => `${2015 + Math.floor((i + 9) / 12)}-${String(((i + 9) % 12) + 1).padStart(2, "0")}-28`) };
  assert.deepEqual(top5Window(d, 1), { months: 12, name: "Top 5 ETFs, last 1 year" });
  assert.deepEqual(top5Window(d, 3), { months: 36, name: "Top 5 ETFs, last 3 years" });
  assert.deepEqual(top5Window(d, 10), { months: 120, name: "Top 5 ETFs, last 10 years" });
  assert.deepEqual(top5Window(d, 99), { months: 132, name: "Top 5 ETFs since 2015" });
  assert.equal(top5Window({ dates: d.dates.slice(0, 50) }, 10).months, 49, "longer than the data: use all of it");
});

test("a shorter window can pick different funds", () => {
  const dates = Array.from({ length: 61 }, (_, i) => `d${i}`);
  // LATE only rises in the last year; STEADY rises the whole time
  const series = { STEADY: dates.map((_, i) => 100 * 1.02 ** i), LATE: dates.map((_, i) => (i < 48 ? 100 : 100 * 1.08 ** (i - 48))) };
  assert.equal(topEtfs({ dates, series }, new Set(), 1, 60).picks[0].sym, "STEADY");
  assert.equal(topEtfs({ dates, series }, new Set(), 1, 12).picks[0].sym, "LATE");
});
