import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { investmentChoices, findInvestments } from "../../site/js/fund-picker.mjs";

const universe = JSON.parse(await readFile(new URL("../../site/data/universe.json", import.meta.url), "utf8"));
const choices = investmentChoices(universe.map(([s]) => s), Object.fromEntries(universe));

test("every bundled investment has a readable name and a description, including company stocks", () => {
  assert.equal(choices.length, universe.length);
  for (const choice of choices) {
    assert.notEqual(choice.name, choice.symbol, choice.symbol);
    assert.ok(!choice.description.includes("No description"), choice.symbol);
  }
  assert.match(choices.find((c) => c.symbol === "VTI").description, /Fund.*basket/);
  assert.match(choices.find((c) => c.symbol === "AAPL").description, /Company stock.*one company/);
  assert.match(investmentChoices(["UNKNOWN"], {})[0].description, /No description available/);
});

test("visitors can find investments by ticker, name, issuer or plain-language description", () => {
  assert.deepEqual(findInvestments(choices, " vti ").map((c) => c.symbol), ["VTI"]);
  assert.deepEqual(findInvestments(choices, "apple").map((c) => c.symbol), ["AAPL"]);
  assert.ok(findInvestments(choices, "Vanguard").some((c) => c.symbol === "VTI"));
  assert.ok(findInvestments(choices, "Treasury bills").some((c) => c.symbol === "SGOV"));
  assert.deepEqual(findInvestments(choices, "nonexistent investment"), []);
  assert.equal(findInvestments(choices, "").length, choices.length);
});

test("demo prices get descriptions without exposing unsupported investments", () => {
  const demo = investmentChoices(["DEMOUS", "DEMOBD", "DEMOGD"], { DEMOUS: "US stocks", DEMOBD: "Bonds", DEMOGD: "Gold" });
  assert.equal(findInvestments(demo, "bonds")[0].symbol, "DEMOBD");
  assert.deepEqual(findInvestments(demo, "VTI"), []);
});
