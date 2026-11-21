// Checks on the built pages themselves (static HTML): link previews, navigation, wording, the Plus demo.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { mergeConfig, headTags, OG_IMAGE } from "../../site/js/config.mjs";

const site = new URL("../../site/", import.meta.url);
const cfg = mergeConfig(JSON.parse(await readFile(new URL("data/site.json", site), "utf8")));
// Every hand-written page (plus-demo/ is a built page, tested on its own below).
async function pages(dir = "") {
  const out = [];
  for (const e of await readdir(new URL(dir, site), { withFileTypes: true })) {
    if (e.isDirectory() && e.name !== "plus-demo") out.push(...await pages(dir + e.name + "/"));
    else if (e.name === "index.html" && dir !== "plus-demo/") out.push(dir);
  }
  return out;
}
const PAGES = await pages();
const read = (rel) => readFile(new URL(rel + "index.html", site), "utf8");
const meta = (html, attr, key) => (html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)">`)) || [])[1];
const unesc = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

test("there are pages to check", () => { assert.ok(PAGES.length >= 10, PAGES.join(",")); assert.ok(PAGES.includes("") && PAGES.includes("try/")); });

test("every page has link-preview tags with an absolute https image (iMessage ignores relative or SVG images)", async () => {
  assert.match(cfg.base_url, /^https:\/\/[^/]+\/.*\/$/);
  for (const rel of PAGES) {
    const html = await read(rel);
    for (const k of ["og:title", "og:description", "og:type", "og:url", "og:site_name", "og:image", "og:image:width", "og:image:height"])
      assert.ok(meta(html, "property", k), `${rel || "home"}: ${k}`);
    for (const k of ["twitter:card", "twitter:title", "twitter:image"]) assert.ok(meta(html, "name", k), `${rel || "home"}: ${k}`);
    assert.equal(meta(html, "property", "og:image"), cfg.base_url + "img/og-card.png");
    assert.match(meta(html, "property", "og:image"), /^https:\/\/.+\.png$/);
    assert.equal(meta(html, "property", "og:url"), cfg.base_url + rel);
    assert.equal(meta(html, "name", "twitter:card"), "summary_large_image");
    assert.equal(meta(html, "property", "og:site_name"), cfg.name);
    assert.match(html, /<link rel="apple-touch-icon" href="(\.\.\/)*img\/apple-touch-icon\.png">/);
    // in step with the page's own title and description (run node scripts/sync_site_chrome.mjs after editing them)
    const title = unesc(html.match(/<title>([^<]*)<\/title>/)[1]), desc = unesc(meta(html, "name", "description"));
    const root = "../".repeat(rel.split("/").length - 1);
    assert.ok(html.includes(headTags(cfg, rel, root, title, desc)), `${rel || "home"}: run node scripts/sync_site_chrome.mjs`);
    assert.ok(!/<script[^>]+src="https?:/.test(html) && !/<link[^>]+href="https?:[^"]*"[^>]*rel="stylesheet"/.test(html), "no third-party resources");
  }
});

test("the preview images exist at the sizes the tags state", async () => {
  const size = async (p) => { const b = await readFile(new URL(p, site)); assert.equal(b.subarray(1, 4).toString(), "PNG"); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
  assert.deepEqual(await size(OG_IMAGE.path), [OG_IMAGE.width, OG_IMAGE.height]);
  assert.deepEqual(await size("img/apple-touch-icon.png"), [180, 180]);
  assert.ok((await stat(new URL(OG_IMAGE.path, site))).size < 1_000_000, "keep the card under 1 MB for chat apps");
});

test("base_url: https only, always ends in a slash", async () => {
  const { baseUrl } = await import("../../site/js/config.mjs");
  assert.equal(baseUrl("https://example.org/site"), "https://example.org/site/");
  assert.equal(baseUrl("https://example.org/"), "https://example.org/");
  assert.equal(baseUrl("http://example.org/"), mergeConfig({}).base_url);
  assert.equal(baseUrl("javascript:alert(1)"), mergeConfig({}).base_url);
});

test("Teach is not in the top navigation; the instructor page stays reachable from the footer", async () => {
  const { NAV } = await import("../../site/js/config.mjs");
  assert.ok(!NAV.some(([k, label]) => k === "teach" || /teach/i.test(label)));
  for (const rel of PAGES) {
    const nav = (await read(rel)).match(/<nav class="main-nav"[\s\S]*?<\/nav>/)[0];
    assert.ok(!/teach/i.test(nav), `${rel || "home"}: Teach in the nav`);
  }
  assert.match(await read(""), /<nav class="foot-col"[^>]*>[\s\S]*?href="teach\/">For instructors</);
  assert.match(await read("try/"), /<nav class="foot-col"[^>]*>[\s\S]*?href="\.\.\/teach\/">For instructors</);
  assert.match(await read("teach/"), /<h1>For instructors<\/h1>/);
});

test("the owner is not described as an MBA student (About, site.json)", async () => {
  const about = await read("about/");
  assert.ok(!/MBA/i.test(about.match(/<section class="founder[\s\S]*?<\/section>/)[0]), "About founder card");
  assert.ok(!/MBA/i.test(JSON.stringify(cfg.founder)) && !/MBA/i.test(await readFile(new URL("data/site.json", site), "utf8")));
  for (const rel of PAGES) assert.ok(!/(Hundal|founder|I am|I'm)[^.<]{0,60}MBA student/i.test(await read(rel)), rel || "home");
});

test("Home shows the real Plus demo (not a drawn mock-up) and links it as 'See Plus with a sample household'", async () => {
  const home = await read("");
  assert.match(home, /<a class="btn big[^"]*" href="plus-demo\/">See Plus with a sample household/);
  assert.match(home, /<img src="img\/plus-demo-light\.png"/); assert.match(home, /srcset="img\/plus-demo-dark\.png"/);
  assert.ok(!/id="whatif"|class="phone-screen"/.test(home), "the drawn mock-up is gone");
  assert.match(home, /Invented household/);
  for (const f of ["img/plus-demo-light.png", "img/plus-demo-dark.png", "plus-demo/index.html"]) await stat(new URL(f, site));
  assert.equal(home.split("See Plus with a sample household").length - 1, 1, "said once on Home (issue 239)");
});

test("Try: manual entry after the sample, clear investment choices, and Plus-only imports (issues 184, 245)", async () => {
  const t = await read("try/");
  const ns = t.match(/<aside id="next-step"[\s\S]*?<\/aside>/)[0];
  assert.match(ns, /Want this for all your accounts\?/);
  assert.equal([...ns.matchAll(/<a /g)].length, 1, "one link");
  assert.match(ns, /<a class="btn" href="\.\.\/signup\/\?plan=plus" data-plus-cta><span data-cta-label>Get notified<\/span>/);
  assert.match(t, /id="try-own-button"[^>]*>Try your own investments/);
  assert.match(t, /File imports are a Plus feature/);
  assert.doesNotMatch(t, /type="file"|id="(?:positions|csv|drop|template-dl)"/);
  assert.match(t, /id="benchmark-picker"/);
  const app = await readFile(new URL("js/app.js", site), "utf8");
  assert.match(app, /has\("own"\)\) setTimeout\(startTyping/, "?own=1 opens the editor (Home's 'Check your own portfolio')");
  assert.doesNotMatch(app, /loadPositions|parsePositions|parsePricesCsv|file\.text\(|dataTransfer\??\.files/);
  assert.match(app, /createFundPicker/);
  assert.match(app, /Cash rate: 3-month Treasury bills from FRED/, "the price source line lives on Try");
  for (const id of new Set([...app.matchAll(/\$\("([\w-]+)"\)/g)].map((m) => m[1]))) assert.ok(t.includes(`id="${id}"`), `app.js uses #${id}, missing on Try`);
  assert.match(await read(""), /href="try\/\?own=1">Check your own portfolio/);
});

// Issue 238: nothing above the fold waits on a fade-in. The hero and every page head must not be in the scroll-reveal set,
// and the CSS must not start the hero at opacity 0 or animate it; reveals are off under prefers-reduced-motion.
test("above-the-fold content is visible at first paint (no reveal, no fade)", async () => {
  for (const rel of PAGES) {
    const html = await read(rel);
    assert.doesNotMatch(html, /class="[^"]*\b(?:page-head|home-hero|hero-copy|stage)\b[^"]*\breveal\b/, `${rel || "home"}: head or hero is a reveal`);
    assert.doesNotMatch(html, /class="[^"]*\breveal\b[^"]*\b(?:page-head|home-hero|hero-copy|stage)\b/, `${rel || "home"}: head or hero is a reveal`);
  }
  const home = await read("");
  const hero = home.slice(home.indexOf('class="home-hero'), home.indexOf("</section>", home.indexOf('class="home-hero')));
  assert.doesNotMatch(hero, /\breveal\b/);
  const css = await readFile(new URL("style.css", site), "utf8");
  assert.doesNotMatch(css, /\.hero-copy[^{]*\{[^}]*animation/);
  assert.doesNotMatch(css, /\.stage\b[^{]*\{[^}]*animation/);
  assert.doesNotMatch(css, /\.page-head[^{]*\{[^}]*(animation|opacity: *0)/);
  assert.doesNotMatch(css, /\.draw\b[^{]*\{[^}]*animation/);
  // the reveal rule that does hide things only applies when motion is allowed
  const m = css.match(/@media \(prefers-reduced-motion: no-preference\) \{\s*\.js \.reveal \{[^}]*opacity: *0/);
  assert.ok(m, "the .reveal hiding rule must sit inside prefers-reduced-motion: no-preference");
  assert.doesNotMatch(css.replace(/@media \(prefers-reduced-motion: no-preference\) \{[^]*?\n\}\n/g, ""), /\.js \.reveal[^{]*\{[^}]*opacity: *0/);
});

// Issue 239: say each thing once per page. Home keeps the headline, one sentence, two buttons, the sample card, one Plus
// sentence and button, and one privacy line; the rest (chips, floating bubbles, founder line, instructors, closing block) is gone.
test("Home says each thing once (issue 239)", async () => {
  const home = await read("");
  for (const gone of ['class="trust-row"', 'class="hero-lesson"', 'class="float-card', 'class="benefits3"', 'class="founder-line"',
    'class="teach-line', 'class="final-cta', "See pricing", "is not a purchase", "Opens the sample household"]) assert.ok(!home.includes(gone), gone);
  assert.match(home, /<h2 id="priv-h">Your numbers never leave your computer<\/h2>\s*<p><a href="privacy\/">/);
  assert.match(home, /<a class="btn big" href="signup\/\?plan=plus" data-plus-cta><span data-cta-label>Get notified<\/span>/);
  assert.match(home, /Would yours\?<\/b> <span>Try your own →/);
  const js = await readFile(new URL("js/home.mjs", site), "utf8");
  for (const id of js.matchAll(/\$\("([\w-]+)"\)/g)) assert.ok(home.includes(`id="${id[1]}"`), `home.mjs uses #${id[1]}, missing on Home`);
});

// Issue 239: one sign-up path. Try's "Join Plus early access" and Home's Plus button open signup/?plan=plus, which
// preselects Plus; the header's "Sign up" opens the plain form. School shows only for students and instructors.
test("sign-up: ?plan=plus preselects Plus; plan choices match the form; School only for students and instructors", async () => {
  const { parseParams, PLANS, showsSchool } = await import("../../site/js/signup.mjs");
  assert.equal(parseParams("?plan=plus").plan, "plus");
  assert.equal(parseParams("?plan=scheduler").plan, "", "Scheduler is no longer a choice");
  const page = await read("signup/");
  const select = page.match(/<select id="f-plan"[\s\S]*?<\/select>/)[0];
  assert.deepEqual([...select.matchAll(/<option value="(\w+)"/g)].map((m) => m[1]), PLANS, "form options = PLANS");
  assert.match(page, /const pre = parseParams\(location\.search\);\s*if \(pre\.plan\) \$\("f-plan"\)\.value = pre\.plan;/);
  assert.match(page, /<label id="school-field" hidden>/);
  assert.deepEqual(["investor", "student", "instructor", "other", ""].map(showsSchool), [false, true, true, false, false]);
  assert.equal(page.split("Formspree").length - 1, 1, "what is sent is said once");
  assert.ok(!/class="checks"|less than a minute/.test(page));
});

// Issue 239: a word budget per page (visible words in <main>, header and footer excluded; see tests/site/wordcount.mjs).
// Try is counted as after a result (the invitation shown); text the scripts fill in (headline, figures) is not counted.
test("word budget: Home ≤ 220, Sign up ≤ 100, Try ≤ 240 (issue 239)", async () => {
  const { visibleWords } = await import("./wordcount.mjs");
  const afterResult = (h) => h.replace(/(<(?:aside|section)\b[^>]*?)\shidden/g, "$1");
  for (const [rel, max, prep] of [["", 220], ["signup/", 100], ["try/", 240, afterResult]]) {
    const n = visibleWords((prep || ((h) => h))(await read(rel)));
    assert.ok(n <= max, `${rel || "home"}: ${n} words, budget ${max}`);
  }
});

// Trim part 2 (issue 239): Pricing stays short, and its plans are only the ones on sale or planned.
test("Pricing: at most 140 visible words (page text plus the plan cards), one FAQ question, no Scheduler plan", async () => {
  const html = await read("pricing/");
  const { plans } = JSON.parse(await readFile(new URL("data/plans.json", site), "utf8"));
  assert.deepEqual(plans.map((p) => p.id), ["free", "plus"]);
  const main = html.match(/<main[\s\S]*<\/main>/)[0].replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<svg[\s\S]*?<\/svg>/g, " ");
  const text = main.replace(/<[^>]+>/g, " ").replace("Loading plans…", " ");
  const cards = plans.map((p) => [p.status, p.name, p.price, p.blurb, ...p.features, p.teaser ? `See what ${p.name} looks like →` : "", p.id === "free" ? "Try it free" : "Pre-order Plus"].join(" ")).join(" ");
  const words = (text + " " + cards).split(/\s+/).filter(Boolean).length;
  assert.ok(words <= 140, `Pricing has ${words} words`);
  assert.equal((html.match(/<h3>/g) || []).length, 1);
  assert.match(html, /<h3>Am I charged\?<\/h3>/);
  for (const gone of ["No card needed", "not a purchase</li>", "never uploaded", "Scheduler", 'class="assure"']) assert.ok(!html.includes(gone), gone);
});

test("footer: no repeated tagline sentence; the Prices/FRED note shows only on Try", async () => {
  for (const rel of PAGES) {
    const html = await read(rel);
    const foot = html.match(/<footer class="site-foot">[\s\S]*?<\/footer>/)[0];
    assert.ok(!foot.includes("Compare a mix of funds with the market, privately"), `${rel || "home"}: tagline sentence in footer`);
    assert.ok(foot.includes("Information, not investment advice.") && foot.includes("© 2026"), `${rel || "home"}: disclaimer and legal line stay`);
    assert.equal(foot.includes("Cash rate: 3-month Treasury bills from FRED."), rel === "try/", `${rel || "home"}: Prices note only on Try`);
  }
});

// Issue 279: every Plus button on a page is marked so chrome.mjs can turn it into "Pre-order Plus" once a checkout link is
// set; the old waitlist wording is gone; visible text says "portfolio", not "mix"; Plus copy promises no optimizer.
test("Plus buttons are marked for pre-order; no waitlist wording; 'portfolio' not 'mix'; no optimizer promises", async () => {
  const { visibleText } = await import("./wordcount.mjs");
  let marked = 0;
  for (const rel of PAGES) {
    const html = await read(rel);
    for (const m of html.matchAll(/<a\b[^>]*href="(?:\.\.\/)*signup\/\?plan=plus"[^>]*>/g)) { assert.match(m[0], /\bdata-plus-cta\b/, `${rel || "home"}: ${m[0]}`); marked++; }
    assert.ok(!/early access|Join the list|waitlist/i.test(html), `${rel || "home"}: waitlist wording`);
    const title = html.match(/<title>([^<]*)<\/title>/)[1], desc = meta(html, "name", "description");
    for (const text of [visibleText(html), title, desc]) assert.ok(!/\bmix(es)?\b/i.test(text), `${rel || "home"}: says "mix": ${text.match(/.{0,40}\bmix\b.{0,20}/i)?.[0]}`);
  }
  assert.ok(marked >= 3, "Home, Try's next step and Try's imports note");
  assert.match(await read(""), /<p class="lead" data-preorder-note hidden>Pre-order now/, "Home's pay-now line starts hidden");
  for (const f of ["app.js", "share.mjs", "portfolios.mjs", "lesson.mjs", "result.mjs", "home.mjs"]) {
    const js = (await readFile(new URL("js/" + f, site), "utf8")).replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, "");
    for (const m of js.matchAll(/(["`])((?:(?!\1).)*)\1/g)) assert.ok(m[2] === "mix" || !/(?<![-#.])\b[Mm]ix(es)?\b(?![-=(])/.test(m[2].replace(/\$\{[^}]*\}/g, "")), `${f}: "${m[2]}"`);
  }
  const plans = await readFile(new URL("data/plans.json", site), "utf8");
  const home = await read("");
  for (const text of [plans, visibleText(home)]) assert.ok(!/\bmix\b|optimi[sz]|walk-forward|what-if|strateg/i.test(text), "Plus copy matches the product");
  const plus = JSON.parse(plans).plans.find((p) => p.id === "plus");
  assert.equal(plus.status, "preorder");
  assert.ok(plus.features.some((f) => /Conservative, Balanced, Growth, All stocks/.test(f) && /world or US-only/.test(f)));
  assert.ok(plus.features.includes("Your numbers never leave your computer"));
  const chrome = await readFile(new URL("js/chrome.mjs", site), "utf8");
  assert.match(chrome, /querySelectorAll\("\[data-plus-cta\]"\)/); assert.match(chrome, /upgradePlanLinks\(/);
});
