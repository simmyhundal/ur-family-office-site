import test from "node:test";
import assert from "node:assert/strict";
import { mergeConfig, loadSiteConfig, DEFAULTS, headerHtml, footerHtml, nameHtml } from "../../site/js/config.mjs";
import { planAction, priceLabel, upgradePlanLinks, cleanPromoCode, promoCheckoutUrl, promoHtml, mountPromo, PROMO_MAX } from "../../site/js/plans.mjs";
import { buildSignupPayload, validateSignup, submitSignup, parseParams } from "../../site/js/signup.mjs";

test("config: defaults when empty or invalid", () => {
  const c = mergeConfig(null);
  assert.equal(c.name, DEFAULTS.name); assert.equal(c.signup_endpoint, ""); assert.deepEqual(c.checkout_urls, {});
});
test("config: values merge, wordmark follows name, non-https links dropped", () => {
  const c = mergeConfig({ name: "Demo", signup_endpoint: "http://x.example/f", checkout_urls: { plus: "https://pay.example/p", scheduler: "javascript:1" }, contact_email: "hi@example.com" });
  assert.equal(c.wordmark, "Demo"); assert.equal(c.signup_endpoint, "");
  assert.deepEqual(Object.keys(c.checkout_urls), ["plus"]); assert.equal(c.contact_email, "hi@example.com");
});
test("config: loader falls back to defaults on failure and reads on success", async () => {
  assert.equal((await loadSiteConfig("x", async () => { throw new Error("no"); })).name, DEFAULTS.name);
  assert.equal((await loadSiteConfig("x", async () => ({ ok: false, status: 404 }))).name, DEFAULTS.name);
  const ok = await loadSiteConfig("x", async () => ({ ok: true, json: async () => ({ name: "Renamed" }) }));
  assert.equal(ok.name, "Renamed");
});
test("header and footer render the name and links", () => {
  const cfg = mergeConfig({ name: "Renamed", contact_email: "a@example.com" });
  const h = headerHtml(cfg, "../", "pricing");
  assert.match(h, /href="..\/pricing\/" aria-current="page"/); assert.match(h, /Get Plus/);
  assert.match(h, /<img class="brand-mark" src="..\/img\/logo.svg"/);
  assert.match(h, /aria-label="Renamed, home"/); assert.match(h, /<span class="brand-full">Renamed<\/span>/);
  const f = footerHtml(cfg, "../");
  assert.match(f, /<span class="brand-word">Renamed<\/span>/); assert.match(f, /src="..\/img\/logo.svg"/);
  for (const p of ["pricing/", "privacy/", "terms/", "about/"]) assert.ok(f.includes(p));
  assert.match(f, /mailto:a@example.com/);
});

test("header shows the name with the UFO initials marked, and the short wordmark for narrow phones", () => {
  const cfg = mergeConfig({ name: "Ur Family Office", wordmark: "UFO" });
  const h = headerHtml(cfg, "", "home");
  assert.match(h, /<span class="brand-full"><b>U<\/b>r <b>F<\/b>amily <b>O<\/b>ffice<\/span><span class="brand-short">UFO<\/span>/);
  assert.match(h, /aria-label="Ur Family Office, home"/);
  assert.ok(!h.includes(cfg.tagline), "the tagline lives in the footer and the hero, not the header");
  assert.match(footerHtml(cfg, ""), /<span class="brand-word"><b>U<\/b>r <b>F<\/b>amily <b>O<\/b>ffice<\/span>/);
  assert.equal(nameHtml(mergeConfig({ name: "Other Name", wordmark: "XYZ" })), "Other Name");
});

test("config: logo is a path inside the site, anything else falls back", () => {
  assert.equal(mergeConfig({}).logo, "img/logo.svg");
  assert.equal(mergeConfig({ logo: "img/mark.svg" }).logo, "img/mark.svg");
  for (const bad of ["https://x.example/a.svg", "//x.example/a.svg", "javascript:alert(1)", "../a.svg", "img/a.svg\" onerror=\"x", "/img/a.svg"])
    assert.equal(mergeConfig({ logo: bad }).logo, "img/logo.svg", bad);
});

test("plan button: no checkout_url goes to sign-up with the plan", () => {
  const a = planAction({ id: "plus", name: "Plus", status: "planned", checkout_url: "" }, {}, "../");
  assert.equal(a.mode, "signup"); assert.equal(a.href, "../signup/?plan=plus"); assert.equal(a.external, false);
});
test("plan button: checkout_url (plan or site config) goes to the payment link", () => {
  const p = { id: "plus", name: "Plus", status: "planned", checkout_url: "https://pay.example/a" };
  assert.equal(planAction(p, {}, "../").href, "https://pay.example/a");
  assert.equal(planAction(p, { plus: "https://pay.example/b" }, "../").href, "https://pay.example/b");
  assert.equal(planAction(p, {}, "../").mode, "checkout");
  assert.equal(planAction({ ...p, checkout_url: "http://insecure.example" }, {}, "../").mode, "signup");
});
test("plan: free goes to the sample; price label marks planned", () => {
  assert.equal(planAction({ id: "free", name: "Free" }, {}, "../").mode, "try");
  assert.equal(priceLabel({ price: "$67/year", status: "planned" }), "$67/year, planned");
  assert.equal(priceLabel({ price: "$0", status: "available" }), "$0");
  assert.equal(priceLabel({ price: "$67/year", status: "selling" }), "$67/year");
});

// Pre-order (issue 279): with a Stripe Payment Link the Plus button says "Get Plus" and opens it; without one,
// it says "Get notified" and opens the sign-up form with Plus chosen. No card data is ever handled by the site.
test("Plus buying: checkout link set -> 'Get Plus' to the payment page; empty -> 'Get notified' sign-up", () => {
  const plus = { id: "plus", name: "Plus", status: "selling", checkout_url: "" };
  const off = planAction(plus, {}, "../");
  assert.deepEqual(off, { mode: "signup", href: "../signup/?plan=plus", label: "Get notified", external: false });
  const on = planAction(plus, { plus: "https://buy.stripe.example/test_abc" }, "../");
  assert.deepEqual(on, { mode: "checkout", href: "https://buy.stripe.example/test_abc", label: "Get Plus", external: true });
  assert.equal(planAction({ ...plus, checkout_url: "https://buy.stripe.example/plan" }, {}, "").label, "Get Plus", "plans.json link works too");
});

function fakeLink(html) {
  const attrs = { href: "signup/?plan=plus" }, label = { textContent: "Get notified" };
  return { attrs, label, setAttribute: (k, v) => { attrs[k] = v; }, removeAttribute: (k) => { delete attrs[k]; },
    querySelector: (s) => (s === "[data-cta-label]" ? label : null), get textContent() { return html; } };
}
test("static Plus buttons: upgraded to 'Get Plus' only when a checkout link is set", () => {
  const plus = { id: "plus", name: "Plus", status: "selling", checkout_url: "" };
  const a = fakeLink(), b = fakeLink(), note = { hidden: true };
  upgradePlanLinks([a, b], plus, {}, "https://site.example/", [note]);
  assert.equal(note.hidden, true, "no purchase promise while the button only signs you up");
  for (const l of [a, b]) {
    assert.equal(l.attrs.href, "https://site.example/signup/?plan=plus"); assert.equal(l.label.textContent, "Get notified");
    assert.ok(!("rel" in l.attrs));
  }
  upgradePlanLinks([a, b], plus, { plus: "https://buy.stripe.example/x" }, "https://site.example/", [note]);
  assert.equal(note.hidden, false, "the pay-now line shows once buying is open");
  for (const l of [a, b]) {
    assert.equal(l.attrs.href, "https://buy.stripe.example/x"); assert.equal(l.label.textContent, "Get Plus");
    assert.equal(l.attrs.rel, "noopener noreferrer");
  }
  upgradePlanLinks([a], plus, { plus: "javascript:alert(1)" }, "../");
  assert.equal(a.attrs.href, "../signup/?plan=plus", "only https links count");
});

// ---------- "Have a code?" (redemption and coupon codes). Codes here are invented; Stripe checks real ones. ----------
test("promo code: trimmed and upper-cased; up to 32 of A-Z, 0-9, - and _; anything else refused, never stripped", () => {
  assert.equal(PROMO_MAX, 32);
  assert.equal(cleanPromoCode("  testcode1 "), "TESTCODE1");
  assert.equal(cleanPromoCode("Launch_2026-x"), "LAUNCH_2026-X");
  assert.equal(cleanPromoCode("A".repeat(32)), "A".repeat(32));
  assert.equal(cleanPromoCode("A".repeat(33)), "", "33 characters is too long");
  for (const bad of ["", "   ", "TEST CODE", "A&B", "A?B", "A=B", "A/B", "A.B", "A#B", "A%20B", "CAFÉ", "ＡＢＣ", "A\nB", "<b>", null, undefined])
    assert.equal(cleanPromoCode(bad), "", JSON.stringify(bad));
});
test("promo checkout URL: Stripe's prefilled_promo_code on the https payment link, other query parameters kept", () => {
  assert.equal(promoCheckoutUrl("https://buy.stripe.example/test_abc", "testcode1"), "https://buy.stripe.example/test_abc?prefilled_promo_code=TESTCODE1");
  assert.equal(promoCheckoutUrl("https://buy.stripe.example/test_abc?locale=en", "X-1"), "https://buy.stripe.example/test_abc?locale=en&prefilled_promo_code=X-1");
  assert.equal(promoCheckoutUrl("https://buy.stripe.example/a?prefilled_promo_code=OLD", "NEW"), "https://buy.stripe.example/a?prefilled_promo_code=NEW", "one code, the visitor's");
  assert.equal(promoCheckoutUrl("https://buy.stripe.example/a", "A&prefilled_email=x"), "", "no parameter injection");
  assert.equal(promoCheckoutUrl("http://buy.stripe.example/a", "OK"), "", "https only");
  assert.equal(promoCheckoutUrl("", "OK"), "", "no link, no code box");
});
// A minimal fake of the elements mountPromo touches.
function fakePromoBox() {
  const listeners = {}, mk = (extra = {}) => ({ hidden: false, attrs: {}, textContent: "", value: "", setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; },
    addEventListener(t, f) { listeners[t] = f; }, focus() {}, ...extra });
  const input = mk(), err = mk(), form = mk({ hidden: true, querySelector: (s) => (s === "input" ? input : err) }), toggle = mk();
  const box = { hidden: true, innerHTML: "", querySelector: (s) => (s === ".promo-toggle" ? toggle : form) };
  return { box, input, err, form, toggle, listeners };
}
test("'Have a code?': hidden and empty with no checkout link; with one, a valid code goes to Stripe and a bad one stays", () => {
  const plus = { id: "plus", name: "Plus", status: "selling", checkout_url: "" };
  const off = fakePromoBox(); off.box.hidden = false; off.box.innerHTML = "stale";
  upgradePlanLinks([fakeLink()], plus, {}, "../", [], [off.box]);
  assert.equal(off.box.hidden, true); assert.equal(off.box.innerHTML, "", "no code box while the button says 'Get notified'");
  const on = fakePromoBox(), went = [];
  mountPromo(on.box, "https://buy.stripe.example/test_abc", (u) => went.push(u));
  assert.equal(on.box.hidden, false); assert.match(on.box.innerHTML, /Have a code\?/);
  assert.equal(on.form.hidden, true, "the input opens on click");
  on.listeners.click(); assert.equal(on.form.hidden, false); assert.equal(on.toggle.attrs["aria-expanded"], "true");
  on.input.value = "bad code!"; on.listeners.submit({ preventDefault() {} });
  assert.deepEqual(went, []); assert.match(on.err.textContent, /letters, numbers/); assert.equal(on.input.attrs["aria-invalid"], "true");
  on.input.value = " testcode1 "; on.listeners.submit({ preventDefault() {} });
  assert.deepEqual(went, ["https://buy.stripe.example/test_abc?prefilled_promo_code=TESTCODE1"]); assert.equal(on.err.textContent, "");
  const html = promoHtml("p1");
  assert.match(html, /maxlength="32"/); assert.match(html, /<button type="button" class="link promo-toggle" aria-expanded="false" aria-controls="p1">Have a code\?<\/button>/);
  assert.match(html, /autocomplete="off"/); assert.match(html, /role="alert"/);
});
test("upgradePlanLinks shows the code box only with a checkout link", () => {
  const plus = { id: "plus", name: "Plus", status: "selling", checkout_url: "" };
  const box = fakePromoBox();
  upgradePlanLinks([fakeLink()], plus, { plus: "https://buy.stripe.example/x" }, "../", [], [box.box]);
  assert.equal(box.box.hidden, false);
  upgradePlanLinks([fakeLink()], plus, { plus: "javascript:alert(1)" }, "../", [], [box.box]);
  assert.equal(box.box.hidden, true);
});

test("signup payload holds only the five fields", () => {
  const p = buildSignupPayload({ email: " a@example.com ", role: "student", school: "", plan: "plus", consent: true, holdings: "VTI", extra: 1 });
  assert.deepEqual(Object.keys(p).sort(), ["consent", "email", "plan", "role", "school"]);
  assert.equal(p.email, "a@example.com");
});
test("signup validation says what to fix", () => {
  const e = validateSignup(buildSignupPayload({ email: "nope", role: "", plan: "", consent: false }));
  assert.deepEqual(Object.keys(e).sort(), ["consent", "email", "plan", "role"]);
  assert.deepEqual(validateSignup(buildSignupPayload({ email: "a@example.com", role: "other", plan: "free", consent: true })), {});
});
test("nothing is sent without an endpoint", async () => {
  let called = false;
  const r = await submitSignup({ email: "a@example.com" }, "", async () => { called = true; });
  assert.equal(called, false); assert.deepEqual(r, { sent: false, reason: "no-endpoint" });
});
test("with an endpoint, posts only the payload fields and the honeypot", async () => {
  let seen;
  const r = await submitSignup({ email: "a@example.com", role: "student", school: "", plan: "plus", consent: true, secret: "x" }, "https://f.example/s", async (u, o) => { seen = { u, o }; return { ok: true }; });
  assert.equal(r.sent, true); assert.equal(seen.u, "https://f.example/s"); assert.equal(seen.o.method, "POST");
  assert.deepEqual(Object.keys(JSON.parse(seen.o.body)).sort(), ["_gotcha", "consent", "email", "plan", "role", "school"]);
});
test("query params preselect, unknown ignored", () => {
  assert.deepEqual(parseParams("?plan=plus&role=instructor"), { plan: "plus", role: "instructor" });
  assert.deepEqual(parseParams("?plan=x&role=<b>"), { plan: "", role: "" });
});

test("footer carries the legal name; the tagline is the new default", () => {
  const cfg = mergeConfig({});
  assert.equal(cfg.tagline, "A higher view of your money");
  assert.equal(cfg.legal_name, "Mycorrhiza Partners LLC DBA Ur Family Office");
  assert.ok(footerHtml(cfg, "").includes("© 2026 Mycorrhiza Partners LLC DBA Ur Family Office"));
  assert.ok(footerHtml(mergeConfig({ legal_name: "Invented Co" }), "").includes("© 2026 Invented Co"));
});
test("founder: photo is a path inside the site, LinkedIn https only (empty hides it)", () => {
  const c = mergeConfig({ founder: { name: "A. Founder", photo: "img/founder.jpg", linkedin: "" } });
  assert.deepEqual(c.founder, { name: "A. Founder", photo: "img/founder.jpg", linkedin: "" });
  assert.equal(mergeConfig({ founder: { photo: "https://x.example/p.jpg", linkedin: "http://x.example" } }).founder.photo, "");
  assert.equal(mergeConfig({ founder: { linkedin: "javascript:1" } }).founder.linkedin, "");
  assert.equal(mergeConfig({ founder: { linkedin: "https://www.linkedin.com/in/example" } }).founder.linkedin, "https://www.linkedin.com/in/example");
  assert.deepEqual(mergeConfig(null).founder, { name: "", photo: "", linkedin: "" });
});
test("the shipped site.json has the legal name, tagline and founder", async () => {
  const { readFile } = await import("node:fs/promises");
  const c = mergeConfig(JSON.parse(await readFile(new URL("../../site/data/site.json", import.meta.url), "utf8")));
  assert.equal(c.tagline, "A higher view of your money");
  assert.equal(c.legal_name, "Mycorrhiza Partners LLC DBA Ur Family Office");
  assert.equal(c.founder.name, "Simmy Hundal"); assert.equal(c.founder.photo, "img/founder.jpg");
});

test("mailto fallback only with a contact email; subject names the plan", async () => {
  const { mailtoJoin } = await import("../../site/js/signup.mjs");
  assert.equal(mailtoJoin(""), ""); assert.equal(mailtoJoin("not-an-email"), ""); assert.equal(mailtoJoin("a@b.example?bcc=x@y.z"), "");
  assert.equal(mailtoJoin("hello@invented.example", "plus"), "mailto:hello@invented.example?subject=Join%20the%20Plus%20list");
  assert.equal(mailtoJoin("hello@invented.example", "nonsense"), "mailto:hello@invented.example?subject=Join%20the%20list");
});
test("every page's static header and footer match what chrome.mjs renders (pages without JS, the one-file copy)", async () => {
  const { readFile } = await import("node:fs/promises");
  const site = new URL("../../site/", import.meta.url);
  const cfg = mergeConfig(JSON.parse(await readFile(new URL("data/site.json", site), "utf8")));
  const pages = { "index.html": ["", "home"], "try/index.html": ["../", "try"], "learn/index.html": ["../", "learn"], "learn/sharpe/index.html": ["../../", "learn"],
    "teach/index.html": ["../", "teach"], "pricing/index.html": ["../", "pricing"], "signup/index.html": ["../", "signup"], "privacy/index.html": ["../", "privacy"],
    "terms/index.html": ["../", "terms"], "about/index.html": ["../", "about"] };
  for (const [f, [root, key]] of Object.entries(pages)) {
    const html = await readFile(new URL(f, site), "utf8");
    assert.ok(html.includes(`<header class="site-head">${headerHtml(cfg, root, key)}</header>`), f + " header: run node scripts/sync_site_chrome.mjs");
    assert.ok(html.includes(`<footer class="site-foot">${footerHtml(cfg, root, key)}</footer>`), f + " footer: run node scripts/sync_site_chrome.mjs");
    assert.ok(html.includes("© 2026 Mycorrhiza Partners LLC DBA Ur Family Office"), f);
    assert.ok(!/about \d+ minutes|Running on/.test(html), f);
  }
});

test("sign-up: an everyday investor can choose 'Investor'; the payload is still five fields", async () => {
  const { ROLES } = await import("../../site/js/signup.mjs");
  assert.equal(ROLES[0], "investor");
  const p = buildSignupPayload({ email: "a@example.com", role: "investor", school: "", plan: "plus", consent: true });
  assert.deepEqual(validateSignup(p), {}); assert.equal(Object.keys(p).length, 5);
  assert.equal(parseParams("?role=investor").role, "investor");
  const { readFile } = await import("node:fs/promises");
  const html = await readFile(new URL("../../site/signup/index.html", import.meta.url), "utf8");
  assert.match(html, /<option value="investor">Investor/);
  assert.ok(!html.includes("you@school.edu"));
});

// ---------- Formspree sign-ups (issues 180, 168). Tests never post to the real endpoint: fetch is always a mock. ----------
const siteJson = async () => JSON.parse(await (await import("node:fs/promises")).readFile(new URL("../../site/data/site.json", import.meta.url), "utf8"));
const signupHtml = async () => (await import("node:fs/promises")).readFile(new URL("../../site/signup/index.html", import.meta.url), "utf8");

test("sign-up endpoint: read from site.json, https, Formspree", async () => {
  const c = mergeConfig(await siteJson());
  assert.match(c.signup_endpoint, /^https:\/\/formspree\.io\/f\/[A-Za-z0-9]+$/);
  assert.equal(mergeConfig({ signup_endpoint: "http://formspree.io/f/x" }).signup_endpoint, "", "http is refused");
});
test("sign-up post: exactly the five fields plus _gotcha, JSON both ways, to the configured endpoint only", async () => {
  const { submitSignup, MAX } = await import("../../site/js/signup.mjs");
  const calls = [];
  const fake = async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200, json: async () => ({ ok: true, next: "/thanks" }) }; };
  const r = await submitSignup({ email: "a@example.com", role: "investor", school: "", plan: "plus", consent: true, holdings: "VTI 60", extra: 1 }, "https://forms.invalid/f/test", fake);
  assert.deepEqual(r, { sent: true });
  assert.equal(calls.length, 1); assert.equal(calls[0].url, "https://forms.invalid/f/test");
  assert.equal(calls[0].init.method, "POST"); assert.equal(calls[0].init.headers.Accept, "application/json");
  const body = JSON.parse(calls[0].init.body);
  assert.deepEqual(Object.keys(body).sort(), ["_gotcha", "consent", "email", "plan", "role", "school"]);
  assert.equal(body._gotcha, "");
  for (const role of ["investor", "student", "instructor", "other"]) assert.ok(role.length <= MAX.role);
  assert.equal((await submitSignup({ email: "a@example.com" }, "", fake)).reason, "no-endpoint"); assert.equal(calls.length, 1, "no endpoint, nothing sent");
});
test("sign-up reply: success shows the thank-you state; Formspree errors and network failures show a plain retry line", async () => {
  const { submitSignup, signupOutcome } = await import("../../site/js/signup.mjs");
  const p = { email: "a@example.com", role: "investor", plan: "plus", consent: true };
  const reply = (status, json) => async () => ({ ok: status < 300, status, json: async () => json });
  const ok = signupOutcome(await submitSignup(p, "https://forms.invalid/f/x", reply(200, { ok: true })));
  assert.equal(ok.done, true); assert.match(ok.text, /on the list/);
  const bad = signupOutcome(await submitSignup(p, "https://forms.invalid/f/x", reply(422, { errors: [{ field: "email", message: "should be an email" }] })));
  assert.equal(bad.done, false); assert.match(bad.text, /try again/);
  const odd = signupOutcome(await submitSignup(p, "https://forms.invalid/f/x", reply(200, { ok: false })));
  assert.equal(odd.done, false);
  await assert.rejects(submitSignup(p, "https://forms.invalid/f/x", async () => { throw new Error("offline"); }));
  assert.match(signupOutcome({ sent: false, reason: "network" }).text, /try again/);
  const html = await signupHtml();
  assert.match(html, /<h2>Thanks, you’re on the list<\/h2>/);
});
test("sign-up page: honeypot field, length limits, no third-party scripts, no 'open soon' copy", async () => {
  const html = await signupHtml();
  assert.match(html, /<input id="f-gotcha" name="_gotcha" type="text" tabindex="-1"/);
  assert.match(html, /id="f-email"[^>]*maxlength="254"/); assert.match(html, /id="f-school"[^>]*maxlength="120"/);
  for (const m of html.matchAll(/<script[^>]*>/g)) assert.ok(!/src="(https?:)?\/\//.test(m[0]), m[0]);
  assert.ok(!/recaptcha|hcaptcha|formspree\.io\/js/i.test(html));
  assert.ok(!/open soon/i.test(html));
  const { readFile } = await import("node:fs/promises");
  const privacy = await readFile(new URL("../../site/privacy/index.html", import.meta.url), "utf8");
  assert.match(privacy, /Formspree/); assert.match(privacy, /No portfolio data ever leaves your browser/);
});
