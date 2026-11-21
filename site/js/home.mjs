// Home: the hero preview is the sample portfolio, computed at load from the same prices and the same code as Try,
// so the two pages always agree.
import { $, spct, money, revealOnScroll } from "./util.mjs";
import { loadPrices } from "./data.mjs";
import { previewModel, linePaths, heroAnswer, SAMPLE } from "./result.mjs";
import { throughLabel } from "./calc.mjs";

revealOnScroll();

async function preview() {
  const p = await loadPrices();
  const m = previewModel(p.data);
  if (!m || m.mixAnnual == null) return;
  // The question first, then the honest answer (ahead, behind or level), then "Would yours?" (issue 181).
  const ans = heroAnswer(m, m.years);
  $("pv-q").textContent = ans.question; $("pv-ans").textContent = ans.answer; $("pv").dataset.tone = ans.tone;
  $("pv-m").textContent = spct(m.mixAnnual); $("pv-b").textContent = spct(m.benchAnnual); $("pv-bench2").textContent = m.bench;
  $("pv-chip").textContent = `${m.years} years · through ${throughLabel(m.to)}`;
  $("pv-sub").textContent = `${ans.gap} Three accounts, added up.`;
  const [mix, bench, put] = linePaths([m.mixValues, m.benchValues, m.putValues], 480, 190);
  $("pv-mline").setAttribute("d", mix); $("pv-bline").setAttribute("d", bench); $("pv-put").setAttribute("d", put);
  $("pv-fill").setAttribute("d", `${mix}L480,190L0,190Z`);
  $("pv").classList.add("ready");
}
preview().catch(() => { /* the placeholders stay; the card still opens Try */ });
