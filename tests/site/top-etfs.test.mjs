import test from "node:test";
import assert from "node:assert/strict";
import { topEtfs } from "../../site/js/top-etfs.mjs";

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
