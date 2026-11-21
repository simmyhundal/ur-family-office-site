// Plan buttons. A plan with a checkout link (site.json checkout_urls[id] first, else the plan's own checkout_url) goes
// straight to that payment page (a Stripe Payment Link; decision 0012). Without one, the button opens the sign-up form.
import { httpsUrl, esc } from "./config.mjs";

export const checkoutLink = (plan, checkoutUrls = {}) => httpsUrl((checkoutUrls || {})[plan.id]) || httpsUrl(plan.checkout_url);

export function planAction(plan, checkoutUrls = {}, root = "") {
  if (plan.id === "free") return { mode: "try", href: root + "try/?sample=1", label: "Try it free", external: false };
  const link = checkoutLink(plan, checkoutUrls);
  if (link) return { mode: "checkout", href: link, label: "Pre-order " + plan.name, external: true };
  return { mode: "signup", href: root + "signup/?plan=" + encodeURIComponent(plan.id), label: plan.status === "available" ? "Get started" : "Get notified", external: false };
}

// "$67/year, pre-order" while a plan is sold ahead of delivery; a plain price once it ships.
export function priceLabel(plan) {
  if (plan.status === "preorder") return plan.price + ", pre-order";
  if (plan.status === "planned") return plan.price + ", planned";
  if (plan.status === "later") return "Later";
  return plan.price;
}

// Static Plus buttons (Home, Try) ship as "Get notified" links to the sign-up form, so they work without scripts and
// while no checkout link is set. Once one is set, they become "Pre-order Plus" links to the payment page.
// Notes that only make sense once pre-orders are open (data-preorder-note) show only with a checkout link.
// "Have a code?" boxes (data-promo) ship hidden and empty; they show, with the code form, only with a checkout link.
export function upgradePlanLinks(links, plan, checkoutUrls = {}, root = "", notes = [], promos = []) {
  const a = planAction(plan, checkoutUrls, root);
  for (const el of links) {
    el.setAttribute("href", a.href);
    const label = el.querySelector("[data-cta-label]") || el;
    label.textContent = a.label;
    if (a.external) el.setAttribute("rel", "noopener noreferrer"); else el.removeAttribute("rel");
  }
  for (const n of notes) n.hidden = a.mode !== "checkout";
  for (const p of promos) mountPromo(p, a.mode === "checkout" ? a.href : "");
  return a;
}

// The Plus card's clearance badge ("Clearance: Area 67", a wink at Area 51 for a UFO brand). An ID tag, not a code:
// no monospace, no dashed coupon border, and it never reads "AREA67".
const SAUCER = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 9a4 4 0 0 1 8 0"/><ellipse cx="12" cy="11" rx="9" ry="3"/><path d="M9 17l-1 3M15 17l1 3M12 17v3"/></svg>';
export function clearanceHtml(plan) {
  const area = typeof plan.clearance === "string" ? plan.clearance.trim() : "";
  return area ? `<span class="clearance">${SAUCER}<span>Clearance</span> <b>${esc(area)}</b></span>` : "";
}

// ---------- Redemption and coupon codes ----------
// The site never checks a code: it sends the visitor to the Stripe Payment Link with ?prefilled_promo_code=, and Stripe
// accepts or refuses it on its own page. No list of codes is kept here. A code is up to 32 of A-Z, 0-9, "-" and "_";
// input is trimmed and upper-cased (Stripe matches codes case-insensitively). Anything else is refused, not stripped,
// so a typo never turns into a different code.
export const PROMO_MAX = 32;
export function cleanPromoCode(raw) {
  const c = String(raw ?? "").trim().toUpperCase();
  return /^[A-Z0-9_-]{1,32}$/.test(c) ? c : "";
}
// The payment link with the code prefilled; "" if the link is not https or the code is not valid.
export function promoCheckoutUrl(link, code) {
  const base = httpsUrl(link), c = cleanPromoCode(code);
  if (!base || !c) return "";
  const u = new URL(base);
  u.searchParams.set("prefilled_promo_code", c);
  return u.href;
}
let promoSeq = 0;
export function promoHtml(id) {
  return `<button type="button" class="link promo-toggle" aria-expanded="false" aria-controls="${id}">Have a code?</button>
<form class="promo-form" id="${id}" hidden novalidate><label class="sr-only" for="${id}-in">Code</label><input id="${id}-in" name="code" type="text" maxlength="${PROMO_MAX}" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Code" aria-describedby="${id}-err"><button type="submit" class="secondary">Apply</button><p class="field-error" id="${id}-err" role="alert"></p></form>`;
}
// Shows the code box in `el` with a checkout link, or hides and empties it without one. Submitting a valid code goes to
// the payment page (`go` is location.assign in the page; tests pass a fake).
export function mountPromo(el, link, go = (u) => globalThis.location.assign(u)) {
  if (!link) { el.hidden = true; el.innerHTML = ""; return; }
  const id = "promo-" + (++promoSeq);
  el.innerHTML = promoHtml(id);
  el.hidden = false;
  const toggle = el.querySelector(".promo-toggle"), form = el.querySelector("form"), input = form.querySelector("input"), err = form.querySelector(".field-error");
  toggle.addEventListener("click", () => {
    const open = form.hidden; form.hidden = !open; toggle.setAttribute("aria-expanded", String(open)); if (open) input.focus();
  });
  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const url = promoCheckoutUrl(link, input.value);
    if (!url) { err.textContent = "Codes use letters, numbers, - and _ only (up to 32)."; input.setAttribute("aria-invalid", "true"); return; }
    err.textContent = ""; input.removeAttribute("aria-invalid");
    go(url);
  });
}
