// Plan buttons. A plan with a checkout link (site.json checkout_urls[id] first, else the plan's own checkout_url) goes
// straight to that payment page (a Stripe Payment Link; decision 0012). Without one, the button opens the sign-up form.
import { httpsUrl } from "./config.mjs";

export const checkoutLink = (plan, checkoutUrls = {}) => httpsUrl((checkoutUrls || {})[plan.id]) || httpsUrl(plan.checkout_url);

export function planAction(plan, checkoutUrls = {}, root = "") {
  if (plan.id === "free") return { mode: "try", href: root + "try/?sample=1", label: "Try it free", external: false };
  const link = checkoutLink(plan, checkoutUrls);
  if (link) return { mode: "checkout", href: link, label: "Pre-order " + plan.name, external: true };
  return { mode: "signup", href: root + "signup/?plan=" + encodeURIComponent(plan.id), label: plan.status === "available" ? "Get started" : "Get notified", external: false };
}

// "$4/month, pre-order" while a plan is sold ahead of delivery; a plain price once it ships.
export function priceLabel(plan) {
  if (plan.status === "preorder") return plan.price + ", pre-order";
  if (plan.status === "planned") return plan.price + ", planned";
  if (plan.status === "later") return "Later";
  return plan.price;
}

// Static Plus buttons (Home, Try) ship as "Get notified" links to the sign-up form, so they work without scripts and
// while no checkout link is set. Once one is set, they become "Pre-order Plus" links to the payment page.
// Notes that only make sense once pre-orders are open (data-preorder-note) show only with a checkout link.
export function upgradePlanLinks(links, plan, checkoutUrls = {}, root = "", notes = []) {
  const a = planAction(plan, checkoutUrls, root);
  for (const el of links) {
    el.setAttribute("href", a.href);
    const label = el.querySelector("[data-cta-label]") || el;
    label.textContent = a.label;
    if (a.external) el.setAttribute("rel", "noopener noreferrer"); else el.removeAttribute("rel");
  }
  for (const n of notes) n.hidden = a.mode !== "checkout";
  return a;
}
